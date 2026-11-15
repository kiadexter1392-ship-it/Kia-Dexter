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
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
