'use strict';
// The sample is compiled with Vite before this isolated real-browser test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-gooey-'));
  const server = net.createServer().listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const env = { ...process.env, ARSLAN_DATA_DIR: dir, ARSLAN_DB: path.join(dir, 'test.db'), MEMBER_PORT: String(port) };
  const child = spawn(process.execPath, ['members/server.js'], { cwd: path.join(__dirname, '..'), env, stdio: ['ignore','pipe','pipe'] });
  let browser, logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(logs)), 15000);
      const ready = () => { if (logs.includes('آماده')) { clearTimeout(timeout); resolve(); } };
      child.stdout.on('data', ready); child.once('exit', () => { clearTimeout(timeout); reject(new Error(logs)); }); ready();
    });
    const { chromium } = require('playwright-core'), mod = require('@sparticuz/chromium'), binary = mod.default || mod;
    browser = await chromium.launch({ executablePath: await binary.executablePath(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    for (const colorScheme of ['light','dark']) for (const reducedMotion of ['no-preference','reduce']) {
      const context = await browser.newContext({ colorScheme, reducedMotion, viewport: {width:390,height:800} });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if(e.type()==='error') errors.push(e.text()); });
      await page.goto(`http://127.0.0.1:${port}/gooey-demo/index.html`);
      const button=page.locator('button'), input=page.locator('input');
      assert.equal(await input.isDisabled(), true);
      assert.equal(await button.evaluate(el=>getComputedStyle(el).backgroundColor), colorScheme === 'light' ? 'rgb(23, 23, 23)' : 'rgb(250, 250, 250)');
      await button.click(); await input.waitFor({state:'visible'}); assert.equal(await input.isEnabled(), true);
      assert.equal(await input.evaluate(el=>el===document.activeElement),true);
      await input.fill('نمونه'); assert.equal(await input.inputValue(),'نمونه');
      await input.blur(); assert.equal(await input.isEnabled(),true,'nonempty input stays expanded');
      await input.fill(''); await input.blur(); await page.waitForFunction(()=>document.querySelector('input').disabled);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: Gooey input light/dark, focus, editing, collapse and reduced-motion browser modes');
  } finally {
    if(browser) await browser.close();
    if(child.exitCode===null) { child.kill('SIGTERM'); await once(child, 'exit'); }
    fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(error => { console.error(error); process.exitCode=1; });
