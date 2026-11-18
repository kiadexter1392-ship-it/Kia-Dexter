'use strict';
process.env.DOJO_TEST_FIXTURES = '1';
// BROWSER=1 enables real login/link/navigation tests (optional playwright-core + Chromium).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { readPorts } = require('../shared/ports');
async function freePort() {
  const s = net.createServer().listen(0, '127.0.0.1'); await once(s, 'listening');
  const p = s.address().port; await new Promise(resolve => s.close(resolve)); return p;
}
(async () => {
  assert.deepEqual(readPorts({}), { gateway: 8080, coach: 4174, member: 4173 });
  assert.throws(() => readPorts({ PORT: '4174' }), /must be different/);
  assert.throws(() => readPorts({ MEMBER_PORT: 'invalid' }), /Invalid/);
  const ports = process.env.TEST_DEFAULT_PORTS === '1' ? readPorts({})
    : { gateway: await freePort(), coach: await freePort(), member: await freePort() };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-roles-'));
  const child = spawn(process.execPath, ['start.js'], { cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(ports.gateway), COACH_PORT: String(ports.coach), MEMBER_PORT: String(ports.member),
      MEMBERS_SITE_URL: '', RESET_DB: '0', ARSLAN_DATA_DIR: dir, ARSLAN_DB: path.join(dir, 'test.db') },
    stdio: ['ignore', 'pipe', 'pipe'] });
  const coach = `http://127.0.0.1:${ports.coach}`, gateway = `http://127.0.0.1:${ports.gateway}`;
  let browser;
  try {
    await new Promise((resolve, reject) => {
      let logs = ''; const timer = setTimeout(() => reject(new Error(logs)), 15000);
      const read = d => { logs += d; if (logs.includes('[coach-site] آماده') && logs.includes('[members-site] آماده')) { clearTimeout(timer); resolve(); } };
      child.stdout.on('data', read); child.stderr.on('data', read);
      child.once('exit', () => { clearTimeout(timer); reject(new Error(logs)); });
    });
    const cfg = async base => (await fetch(base + '/api/config')).json();
    assert.equal((await cfg(gateway)).site, 'member');
    assert.equal((await cfg(coach)).site, 'coach');
    assert.equal((await cfg(gateway + '/coach')).site, 'coach');
    assert.equal((await cfg(coach + '/member')).site, 'member');
    assert.equal((await cfg(coach)).peerSiteUrl, '/member/');
    assert.equal((await cfg(coach + '/member')).peerSiteUrl, '/');
    const canonical = await fetch(coach + '/member?from=test', { redirect: 'manual' });
    assert.equal(canonical.headers.get('location'), '/member/?from=test');
    const legacy = await fetch(coach + '/coach/dashboard', { redirect: 'manual' });
    assert.equal(legacy.headers.get('location'), '/dashboard');
    const oldPanel = await fetch(coach + '/panel', { redirect: 'manual' });
    assert.equal(oldPanel.headers.get('location'), '/dashboard');
    const manifest = await (await fetch(coach + '/member/manifest.json')).json();
    assert.equal(manifest.scope, '/member/');
    assert.ok(manifest.icons.every(icon => icon.src.startsWith('/member/')));
    for (const asset of ['/ui/ui.js', '/ui/shell.css', '/panel.js', '/CardSwap.js', '/images/card-karate.jpg', '/sw.js']) {
      assert.equal((await fetch(coach + '/member' + asset)).status, 200, asset);
    }
    const form = await fetch(coach + '/member/login', { method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'username=kia&password=123456' });
    assert.equal(form.status, 302);
    assert.equal(form.headers.get('location'), '/member/panel');
    const cookie = form.headers.getSetCookie()[0].split(';')[0];
    const panel = await (await fetch(coach + '/member/panel', { headers: { cookie } })).text();
    assert.match(panel, /src="\/member\/panel\.js(?:\?[^"]*)?"/);
    const wrongRole = await fetch(coach + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'kia', password: '123456' }) });
    assert.equal(wrongRole.status, 401);
    console.log('PASS: defaults 8080=member / 4174=coach, proxy mounts, canonical paths, streamed POST, assets, manifest, role separation');

    if (process.env.BROWSER === '1') {
      const { chromium } = require('playwright-core'); const module = require('@sparticuz/chromium');
      browser = await chromium.launch({ executablePath: await (module.default || module).executablePath(),
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
      const context = await browser.newContext();
      await context.route('**/*', route => [new URL(coach).origin, new URL(gateway).origin].includes(new URL(route.request().url()).origin)
        ? route.continue() : route.abort());
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(coach, { waitUntil: 'domcontentloaded' });
      await page.locator('[name="username"]').fill('arsalan');
      await page.locator('[name="password"]').fill('arsalan123');
      await page.locator('#loginForm [type="submit"]').click();
      await page.waitForURL(coach + '/dashboard');
      await page.locator('#view-overview .stat').first().waitFor();
      for (const key of ['members', 'plans', 'progress', 'settings', 'overview']) {
        await page.locator('.gdock-item[data-key="' + key + '"]').click();
        await page.waitForFunction(key => document.querySelector('#view-' + key)?.classList.contains('active')
          && document.querySelector('.gdock-item[aria-current="page"]')?.dataset.key === key, key);
      }
      await page.locator('.sidebar [data-view="news"]').click();
      assert.equal(await page.locator('.gdock-item[aria-current]').count(), 0);
      await page.locator('.sidebar [data-view="overview"]').click();
      assert.equal(await page.locator('.gdock-item[aria-current]').getAttribute('data-key'), 'overview');
      const memberUrl = await page.locator('#membersSiteLink').getAttribute('href');
      assert.equal(memberUrl, coach + '/member/');
      const member = await context.newPage(); member.on('pageerror', error => errors.push(error.message));
      const memberApis = [];
      member.on('request', request => { if (request.url().includes('/api/')) memberApis.push(new URL(request.url()).pathname); });
      await member.goto(memberUrl, { waitUntil: 'domcontentloaded' });
      await member.locator('#lUser').fill('kia');
      await member.locator('.otp-field').fill('123456');
      await member.locator('#otpMount [data-phase="ok"]').waitFor();
      await member.locator('#loginBtn').click();
      await member.waitForURL(coach + '/member/panel');
      await member.locator('#meAvatar .avatar').waitFor();
      assert.equal(await member.locator('#coachLink').getAttribute('href'), coach + '/');
      for (const key of ['plans', 'progress', 'news', 'profile', 'home']) {
        await member.locator('.gdock-item[data-key="' + key + '"]').click();
        await member.waitForFunction(key => document.querySelector('#view-' + key)?.classList.contains('active')
          && document.querySelector('.gdock-item[aria-current="page"]')?.dataset.key === key, key);
      }
      await member.locator('[data-view="profile"]').click(); await member.locator('#pBloodGroup').waitFor();
      await member.locator('[data-view="payment"]').click(); await member.locator('.tuition-bank-card').first().waitFor();
      assert.equal(await member.locator('.gdock-item[aria-current]').count(), 0);
      for (const width of [320, 390, 768, 1024, 1568]) {
        await member.setViewportSize({ width, height: 980 });
        const rect = await member.locator('.gdock').boundingBox();
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= 980);
      }
      await member.waitForSelector('.csw-card img');
      assert.ok((await member.locator('.csw-card img').first().getAttribute('src')).startsWith('/member/images/'));
      assert.ok(memberApis.length > 5 && memberApis.every(url => url.startsWith('/member/api/')), memberApis.join(','));
      await member.locator('#logoutBtn').click(); await member.waitForURL(coach + '/member/');
      await member.locator('#tabRegister').click();
      const form = member.locator('#registerForm');
      await form.locator('[name="full_name"]').fill('شاگرد مسیر جدید');
      await form.locator('[name="username"]').fill('mounteduser');
      await form.locator('[name="discipline"]').selectOption({ label: 'کاراته' });
      await form.locator('[name="blood_group"]').selectOption('A+');
      await form.locator('[name="birth_date"]').fill('۱۳۹۰/۰۵/۲۱');
      await form.locator('[name="password"]').fill('123456'); await form.locator('[name="password2"]').fill('123456');
      await form.locator('[type="submit"]').click(); await member.waitForURL(coach + '/member/panel');
      await member.locator('[data-view="profile"]').click();
      assert.equal(await member.locator('#pBloodGroup').inputValue(), 'A+');
      await page.locator('#logoutBtn').click(); await page.waitForURL(coach + '/');
      assert.deepEqual(errors, []);
      console.log('PASS BROWSER: coach login/dashboard, same-origin cross-links, mounted member OTP login/registration/profile/payment/images/logout');
    }
  } finally {
    if (browser) await browser.close(); child.kill('SIGTERM'); await once(child, 'exit');
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
