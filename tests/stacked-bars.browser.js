'use strict';
// Real Chromium layout regression. Optional test-only tools (no production dependency):
// npm install --no-save --package-lock=false playwright-core @sparticuz/chromium
// node tests/stacked-bars.browser.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const chromiumModule = require('@sparticuz/chromium');
const binary = chromiumModule.default || chromiumModule;
const root = path.join(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ executablePath: await binary.executablePath(), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const styles = ['style.css', 'shell.css'].map(file => fs.readFileSync(path.join(root, 'shared/public/ui', file), 'utf8')).join('\n');
    const script = fs.readFileSync(path.join(root, 'members/public/StackedBars.js'), 'utf8');
    for (const direction of ['rtl', 'ltr']) {
      for (const width of [1568, 1024, 768, 390, 320]) {
        await page.goto('about:blank'); // Reset old component listeners between cases.
        await page.setViewportSize({ width, height: 980 });
        await page.setContent(`<html dir="${direction}"><head><style>${styles}</style></head><body><form id="form"><div id="mount" style="width:100%;max-width:900px;margin:auto"></div></form></body></html>`);
        await page.addScriptTag({ content: script });
        await page.evaluate(() => {
          window.submits = 0;
          document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); window.submits++; });
          window.changes = [];
          window.chart = StackedBars.mount(document.getElementById('mount'), { onModeChange: mode => changes.push(mode) });
          window.rows = Array.from({ length: 8 }, (_, i) => ({ vals: [10, 20, 30, 40], esc: 3, label: 'هفته ' + i, short: String(i) }));
          chart.render(rows);
        });
        async function aligned(index) {
          // Wait for actual layout/transition completion rather than a fixed wall-clock sleep.
          await page.waitForFunction(index => {
            const tab = document.querySelectorAll('.stb-tab')[index].getBoundingClientRect();
            const thumb = document.querySelector('.stb-thumb').getBoundingClientRect();
            return Math.abs(tab.x - thumb.x) < 1 && Math.abs(tab.width - thumb.width) < 1;
          }, index, { timeout: 1500 });
          const geometry = await page.evaluate(index => {
            const tabs = Array.from(document.querySelectorAll('.stb-tab'));
            const tab = tabs[index].getBoundingClientRect();
            const thumb = document.querySelector('.stb-thumb').getBoundingClientRect();
            return { dx: Math.abs(tab.x - thumb.x), dw: Math.abs(tab.width - thumb.width),
              selected: tabs.map(t => t.hasAttribute('data-on')), pressed: tabs.map(t => t.getAttribute('aria-pressed')),
              mode: document.querySelector('.stb-seg-ctl').dataset.mode, submits };
          }, index);
          assert.ok(geometry.dx < 1 && geometry.dw < 1, `${direction} ${width}px tab ${index}: ${JSON.stringify(geometry)}`);
          assert.deepEqual(geometry.selected, [0, 1, 2].map(i => i === index));
          assert.deepEqual(geometry.pressed, [0, 1, 2].map(i => String(i === index)));
          assert.equal(geometry.submits, 0);
        }
        await aligned(0);
        // No render/data response follows clicks: the highlight must move immediately.
        for (const index of [1, 2, 0, 2, 1]) {
          await page.locator('.stb-tab').nth(index).click();
          await aligned(index);
        }
        await page.evaluate(() => chart.render([]));
        await aligned(1);
        for (const index of [0, 2, 0, 1, 2]) await page.locator('.stb-tab').nth(index).click();
        await aligned(2);
        // CSS geometry must adapt even before the chart's debounced resize render.
        await page.setViewportSize({ width: width === 320 ? 768 : 320, height: 980 });
        await aligned(2);
        console.log(`PASS: ${direction} ${width}px — initial, all tabs, pending/empty data, rapid clicks, resize`);
      }
    }
    // Initially selected Month must agree with the member panel's first data request.
    await page.evaluate(() => {
      document.getElementById('mount').replaceChildren();
      window.chart = StackedBars.mount(document.getElementById('mount'), { initialMode: 'Month' });
    });
    assert.equal(await page.locator('.stb-seg-ctl').getAttribute('data-mode'), 'Month');
    assert.equal(await page.locator('.stb-tab[data-on]').textContent(), 'ماهانه');
    console.log('PASS: Month initialization');

    // Run the real panel integration with deferred API responses arriving out of order.
    const panelHtml = fs.readFileSync(path.join(root, 'members/public/panel.html'), 'utf8');
    const integration = Array.from(panelHtml.matchAll(/<script>([\s\S]*?)<\/script>/g))
      .map(match => match[1]).find(code => code.includes('makeBarsFromAPI'));
    await page.setContent(`<html dir="rtl"><head><style>${styles}</style></head><body><div id="stackedBarsRoot"></div></body></html>`);
    await page.addScriptTag({ content: script });
    await page.evaluate(() => {
      window.pending = [];
      window.UI = { api: () => new Promise(resolve => pending.push(resolve)) };
    });
    await page.addScriptTag({ content: integration });
    await page.waitForFunction(() => pending.length === 1);
    await page.locator('.stb-tab').nth(0).click();
    await page.locator('.stb-tab').nth(1).click();
    assert.equal(await page.evaluate(() => pending.length), 3);
    await page.evaluate(() => pending[2]({ ok: true, progress: {} }));
    await page.waitForFunction(() => document.querySelectorAll('.stb-col').length === 8);
    await page.evaluate(() => {
      pending[1]({ ok: true, progress: {} });
      pending[0]({ ok: true, progress: { 1: { endurance: 90 } } });
    });
    await page.waitForTimeout(280);
    assert.equal(await page.locator('.stb-col').count(), 8);
    assert.equal(await page.locator('.stb-tab[data-on]').textContent(), 'هفتگی');
    assert.match(await page.locator('.stb-sub').textContent(), /هفته/);
    assert.deepEqual(errors, []);
    console.log('PASS: real panel ignores stale API responses; no browser JavaScript errors');

    if (process.env.LIVE_URL) {
      const base = process.env.LIVE_URL.replace(/\/$/, '');
      const login = await fetch(base + '/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.MEMBER_USERNAME || 'kia', password: process.env.MEMBER_PASSWORD || '123456' })
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.getSetCookie()[0].split(';')[0];
      const separator = cookie.indexOf('=');
      const context = await browser.newContext();
      try {
        await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: base }]);
        const live = await context.newPage();
        const liveErrors = [];
        live.on('pageerror', error => liveErrors.push(error.message));
        // The test must not depend on third-party animation/font CDNs being available.
        await live.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin
          ? route.continue() : route.abort());
        await live.goto(base + '/panel', { waitUntil: 'domcontentloaded' });
        await live.waitForSelector('.stb-tab');
        for (const width of [1568, 1024, 390, 320]) {
          await live.setViewportSize({ width, height: 980 });
          for (const index of [0, 1, 2, 0, 2, 1]) {
            await live.locator('.stb-tab').nth(index).click();
            await live.waitForFunction(index => {
              const tabs = document.querySelectorAll('.stb-tab');
              const button = tabs[index].getBoundingClientRect();
              const thumb = document.querySelector('.stb-thumb').getBoundingClientRect();
              return Math.abs(button.x - thumb.x) < 1 && Math.abs(button.width - thumb.width) < 1
                && document.querySelectorAll('.stb-tab[data-on]').length === 1 && tabs[index].hasAttribute('data-on');
            }, index, { timeout: 3000 });
          }
          console.log(`PASS LIVE: actual Railway member panel, all tabs aligned at ${width}px`);
        }
        await live.locator('[data-view="profile"]').click();
        await live.locator('#pBloodGroup').waitFor();
        assert.equal(await live.locator('#pBloodGroup option').count(), 9);
        assert.equal(await live.locator('#pBirthDate').count(), 1);
        const profile = await live.locator('#view-profile').textContent();
        assert.ok(!profile.includes('پاک نمی‌شود') && !profile.includes('ماه‌به‌ماه'));
        await live.locator('[data-view="payment"]').click();
        await live.locator('.tuition-bank-card').first().waitFor();
        const cards = await live.locator('.tuition-bank-card').evaluateAll(cards => cards.map(card => ({
          bg: getComputedStyle(card).backgroundColor, color: getComputedStyle(card).color,
          direction: getComputedStyle(card.querySelector('.tuition-bank-number')).direction,
          number: card.querySelector('.tuition-bank-number').textContent.replace(/\s/g, ''),
          copy: card.querySelector('[data-copy]').dataset.copy
        })));
        assert.equal(cards.length, 2);
        for (const card of cards) {
          assert.equal(card.bg, 'rgba(212, 168, 83, 0.18)');
          assert.equal(card.color, 'rgb(53, 38, 15)');
          assert.equal(card.direction, 'ltr');
          assert.equal(card.number, card.copy);
        }
        console.log('PASS LIVE: profile blood group/date fields, removed explanations, readable gold cards and intact copy numbers');
        assert.deepEqual(liveErrors, []);
      } finally {
        await context.close();
        await fetch(base + '/api/logout', { method: 'POST', headers: { cookie } });
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
