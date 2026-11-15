'use strict';
// Optional test tools: npm i --no-save --package-lock=false playwright-core @sparticuz/chromium
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const modulePath = require('@sparticuz/chromium');
const binary = modulePath.default || modulePath;
const base = path.join(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ executablePath: await binary.executablePath(), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const context = await browser.newContext({ hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const css = ['style.css', 'shell.css'].map(name => fs.readFileSync(path.join(base, 'shared/public/ui', name), 'utf8')).join('\n');
    const script = fs.readFileSync(path.join(base, 'shared/public/ui/MagnifyingDock.js'), 'utf8');
    async function fixture(direction, width, options = {}) {
      await page.goto('about:blank');
      await page.setViewportSize({ width, height: 850 });
      await page.setContent(`<html dir="${direction}"><head><style>${css}</style></head><body class="has-magnifying-dock" style="direction:${direction}"><div class="shell"><aside class="sidebar"></aside><main class="main"><div style="height:2000px"></div><div class="magnifying-dock-slot" id="dock"></div></main></div></body></html>`);
      await page.addScriptTag({ content: script });
      await page.evaluate(options => {
        window.changes = []; window.parentPresses = 0;
        document.querySelector('.main').addEventListener('pointerdown', () => parentPresses++);
        window.dock = MagnifyingDock.mount(document.getElementById('dock'), { ...options, onSelect: key => changes.push(key) });
      }, options);
    }
    const item = i => page.locator('.gdock-item').nth(i);
    async function centre(i) {
      const box = await item(i).boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    async function active(key) {
      await page.waitForFunction(key => document.querySelector('.gdock-item[aria-current="page"]')?.dataset.key === key, key);
      assert.equal(await page.locator('.gdock-item[aria-current="page"]').count(), 1);
    }
    for (const direction of ['rtl', 'ltr']) {
      for (const width of [320, 390, 768, 1024, 1568]) {
        await fixture(direction, width);
        const bounds = await page.locator('.gdock').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `${direction} ${width}: dock fits viewport`);
        await active('home');
        const middle = await centre(2);
        await page.mouse.move(middle.x, middle.y);
        await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelectorAll('.gdock-glyph')[2]).transform).a > 1.3);
        const scales = await page.locator('.gdock-glyph').evaluateAll(glyphs => glyphs.map(g => new DOMMatrix(getComputedStyle(g).transform).a));
        assert.ok(scales[2] > scales[1] && scales[1] > scales[0]);
        assert.equal(await page.locator('.gdock-tip').count(), 1);
        assert.equal(await page.locator('.gdock-tip').textContent(), 'پرونده‌ها');
        await item(2).click(); await active('files');
        assert.equal(await page.evaluate(() => parentPresses), 0);
        await page.mouse.move(2, 2);
        await page.waitForFunction(() => document.querySelector('.gdock-tip').dataset.on === 'false');
        assert.equal(await page.locator('.gdock-tip').textContent(), 'پرونده‌ها');
        const keyboardFocus = item(1);
        await keyboardFocus.focus(); await page.keyboard.press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
        assert.equal(await item(2).evaluate(el => document.activeElement === el), true);
        await page.keyboard.press('End'); await page.keyboard.press('Enter'); await active('you');
        await page.keyboard.press('Home'); await page.keyboard.press('Space'); await active('home');
        const token = await page.evaluate(() => ({ outside: getComputedStyle(document.documentElement).getPropertyValue('--ink'),
          inside: getComputedStyle(dock.root).getPropertyValue('--ink-rgb').trim() }));
        assert.equal(token.outside, ''); assert.equal(token.inside, '26, 26, 46');
        console.log(`PASS: ${direction} ${width}px — bounds, distance magnification, single fading tooltip, mouse and keyboard, isolated tokens`);
      }
    }

    await fixture('rtl', 390);
    const client = await context.newCDPSession(page);
    async function touch(type, point) {
      await client.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 1 }] : [] });
    }
    const from = await centre(0), to = await centre(4);
    await touch('touchStart', from);
    for (let step = 1; step <= 8; step++) await touch('touchMove', { x: from.x + (to.x - from.x) * step / 8, y: from.y });
    await touch('touchEnd');
    await active('you');
    assert.deepEqual(await page.evaluate(() => changes), ['you']);
    // A drag may send no synthetic click. The very next real mouse click must still work.
    await item(1).click(); await active('search');
    await touch('touchStart', await centre(0)); await touch('touchCancel');
    await active('search');
    await item(3).focus(); await page.keyboard.press('Enter'); await active('saved');
    const before = await page.evaluate(() => changes.length);
    await touch('touchStart', await centre(0));
    await touch('touchMove', { x: 5, y: from.y }); await touch('touchEnd');
    assert.equal(await page.evaluate(() => changes.length), before);
    await item(2).click(); await active('files');
    // pan-y should scroll/cancel rather than activate an icon during a vertical swipe.
    const vertical = await centre(0);
    await touch('touchStart', vertical);
    await touch('touchMove', { x: vertical.x, y: vertical.y - 80 });
    await touch('touchMove', { x: vertical.x, y: vertical.y - 220 });
    await touch('touchEnd');
    await active('files');
    assert.ok(await page.evaluate(() => scrollY > 0));
    console.log('PASS: real touch sweep, trailing-click suppression, touch-to-mouse/keyboard, cancellation, out-of-bounds lift and vertical scrolling');

    await fixture('rtl', 320, { labels: false, spread: 0 });
    assert.equal(await page.locator('.gdock-tip').count(), 0);
    await item(2).hover();
    await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelectorAll('.gdock-glyph')[2]).transform).a > 1.3);
    assert.equal(await item(1).locator('.gdock-glyph').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a), 1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await item(2).locator('.gdock-glyph').evaluate(el => getComputedStyle(el).transform), 'none');
    await page.evaluate(() => { dock.setActive('unknown-sidebar-view'); });
    assert.equal(await page.locator('.gdock-item[aria-current]').count(), 0);
    await page.evaluate(() => { dock.destroy(); dock.destroy(); dispatchEvent(new Event('resize')); });
    assert.equal(await page.locator('.gdock').count(), 0);
    await page.evaluate(() => {
      const el = document.getElementById('dock');
      MagnifyingDock.mount(el); MagnifyingDock.mount(el, { surface: 'flat' });
    });
    assert.equal(await page.locator('.gdock').count(), 1);
    assert.equal(await page.locator('.gdock').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    await page.evaluate(() => {
      MagnifyingDock.mount(document.getElementById('dock'));
      document.body.dataset.surface = 'flat';
      document.body.dataset.stroke = 'on';
    });
    const flat = await page.locator('.gdock').evaluate(el => ({ filter: getComputedStyle(el).backdropFilter,
      shadow: getComputedStyle(el).boxShadow, rim: getComputedStyle(el, '::before').backgroundImage,
      border: getComputedStyle(el, '::before').borderTopColor }));
    assert.equal(flat.filter, 'none'); assert.equal(flat.shadow, 'none'); assert.equal(flat.rim, 'none');
    assert.notEqual(flat.border, 'rgba(0, 0, 0, 0)');
    assert.deepEqual(errors, []);
    console.log('PASS: labels/spread knobs, reduced motion, sidebar-only views, idempotent cleanup/remount and flat mode');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
