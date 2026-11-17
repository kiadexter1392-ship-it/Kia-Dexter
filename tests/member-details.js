'use strict';
process.env.DOJO_TEST_FIXTURES = '1';
// Isolated database + real HTTP checks. Optional Chromium checks: BROWSER=1 node tests/member-details.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { once } = require('node:events');
const { spawn, spawnSync } = require('node:child_process');
const { normalizeMemberDetails, BLOOD_GROUPS } = require('../shared/member-details');
async function port() {
  const server = net.createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const p = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return p;
}

(async () => {
  for (const blood_group of BLOOD_GROUPS) assert.equal(normalizeMemberDetails({ blood_group }).blood_group, blood_group);
  assert.deepEqual(normalizeMemberDetails({}), {});
  assert.deepEqual(normalizeMemberDetails({ birth_date: '', blood_group: '' }), { birth_date: null, blood_group: null });
  assert.equal(normalizeMemberDetails({ birth_date: '۱۳۹۰/۰۵/۲۱' }).birth_date, '2011-08-12');
  assert.equal(normalizeMemberDetails({ birth_date: '1399/12/30' }).birth_date, '2021-03-20');
  for (const birth_date of ['1400/12/30', '1390/07/31', '2023-02-29', '1390/00/10', '1390/05', '2100-01-01', '<script>']) {
    assert.throws(() => normalizeMemberDetails({ birth_date }), error => error.status === 400, birth_date);
  }
  assert.throws(() => normalizeMemberDetails({ blood_group: 'X+' }), error => error.status === 400);
  console.log('PASS: Jalali/ISO validation, leap dates, all blood groups, future/malformed rejection');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-details-'));
  const env = { ...process.env, RESET_DB: '0', ARSLAN_DATA_DIR: dir, ARSLAN_DB: path.join(dir, 'test.db'),
    PORT: String(await port()), COACH_PORT: String(await port()), MEMBER_PORT: String(await port()) };
  // Simulate an existing club database, predating the new column.
  const old = spawnSync(process.execPath, ['-e', `
    const db = require('./shared/db'); require('./shared/seed').seedIfEmpty();
    db.db.exec('ALTER TABLE users DROP COLUMN blood_group'); db.db.close();
  `], { env, cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(old.status, 0, old.stderr);
  const child = spawn(process.execPath, ['start.js'], { env, cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
  const base = 'http://127.0.0.1:' + env.PORT;
  let browser;
  try {
    await new Promise((resolve, reject) => {
      let logs = '';
      const timer = setTimeout(() => reject(new Error(logs)), 15000);
      const read = chunk => {
        logs += chunk;
        if (logs.includes('[coach-site] آماده') && logs.includes('[members-site] آماده')) { clearTimeout(timer); resolve(); }
      };
      child.stdout.on('data', read); child.stderr.on('data', read);
      child.once('exit', () => { clearTimeout(timer); reject(new Error(logs)); });
    });
    async function api(route, body, cookie, method = body ? 'POST' : 'GET') {
      const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json(), cookie: response.headers.getSetCookie()[0]?.split(';')[0] };
    }
    const legacy = await api('/api/login', { username: 'kia', password: '123456' });
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.user.blood_group, null);
    console.log('PASS: old database migration preserves existing account/login');
    const user = { username: 'newmember', full_name: 'شاگرد آزمایشی', password: '123456', password2: '123456', discipline: 'کاراته', blood_group: 'AB-', birth_date: '۱۳۹۰/۰۵/۲۱' };
    const registered = await api('/api/register', user);
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
    const cookie = registered.cookie;
    let me = await api('/api/me', null, cookie);
    assert.equal(me.body.user.birth_date, '2011-08-12');
    assert.equal(me.body.user.blood_group, 'AB-');
    const id = me.body.user.id;
    const login = await api('/api/login', { username: user.username, password: user.password });
    assert.equal(login.body.user.blood_group, 'AB-');
    assert.equal(login.body.user.birth_date, '2011-08-12');
    assert.equal((await api('/api/me', { birth_date: '1400/12/30' }, cookie, 'PUT')).status, 400);
    assert.equal((await api('/api/me', { blood_group: 'bad' }, cookie, 'PUT')).status, 400);
    assert.equal((await api('/api/register', { ...user, username: 'invalidmember', blood_group: 'bad' })).status, 400);
    assert.equal((await api('/api/me', { full_name: 'نام جدید' }, cookie, 'PUT')).body.user.blood_group, 'AB-');
    const updated = await api('/api/me', { birth_date: '1388/01/01', blood_group: 'O+' }, cookie, 'PUT');
    assert.equal(updated.body.user.birth_date, '2009-03-21');
    assert.equal(updated.body.user.blood_group, 'O+');
    const coach = await api('/coach/api/login', { username: 'arsalan', password: 'arsalan123' });
    const detail = await api('/coach/api/members/' + id, null, coach.cookie);
    assert.equal(detail.body.member.blood_group, 'O+');
    assert.equal(detail.body.member.birth_date, '2009-03-21');
    const coachUpdate = await api('/coach/api/members/' + id, { blood_group: 'B+', birth_date: '2011-08-12' }, coach.cookie, 'PUT');
    assert.equal(coachUpdate.body.member.blood_group, 'B+');
    assert.equal((await api('/api/me', null, cookie)).body.user.blood_group, 'B+');
    console.log('PASS: registration, persistence after login, member edits, coach visibility/edits, API rejection');

    if (process.env.BROWSER === '1') {
      const { chromium } = require('playwright-core');
      const binary = require('@sparticuz/chromium');
      const executablePath = await (binary.default || binary).executablePath();
      browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#tabRegister').click();
      const form = page.locator('#registerForm');
      await form.locator('[name="full_name"]').fill('عضو جدید مرورگر');
      await form.locator('[name="username"]').fill('browsermember');
      await form.locator('[name="discipline"]').selectOption({ label: 'کاراته' });
      await form.locator('[name="birth_date"]').fill('۱۳۹۰/۰۵/۲۱');
      await form.locator('[name="blood_group"]').selectOption('A-');
      await form.locator('[name="password"]').fill('123456');
      await form.locator('[name="password2"]').fill('123456');
      await form.locator('[type="submit"]').click();
      await page.waitForURL('**/panel');
      await page.locator('[data-view="profile"]').click();
      await page.locator('#pBirthDate').waitFor();
      assert.equal(await page.locator('#pBirthDate').inputValue(), '1390/05/21');
      assert.equal(await page.locator('#pBloodGroup').inputValue(), 'A-');
      const profile = await page.locator('#view-profile').textContent();
      assert.ok(!profile.includes('پاک نمی‌شود') && !profile.includes('ماه‌به‌ماه'));
      assert.ok(profile.includes('عضو از:') && profile.includes('کمربند ثبت‌شده:'));
      await page.locator('#pBloodGroup').selectOption('O-');
      await page.locator('#pBirthDate').fill('۱۳۸۸/۰۱/۰۱');
      const save = page.waitForResponse(response => response.url().endsWith('/api/me') && response.request().method() === 'PUT');
      await page.locator('#profileForm [type="submit"]').click();
      assert.equal((await (await save).json()).user.blood_group, 'O-');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-view="profile"]').click();
      assert.equal(await page.locator('#pBloodGroup').inputValue(), 'O-');
      assert.equal(await page.locator('#pBirthDate').inputValue(), '1388/01/01');
      await page.locator('[data-view="payment"]').click();
      await page.locator('.tuition-bank-card').first().waitFor();
      for (const width of [1568, 768, 390]) {
        await page.setViewportSize({ width, height: 980 });
        const cards = await page.locator('.tuition-bank-card').evaluateAll(cards => cards.map(card => ({
          background: getComputedStyle(card).backgroundColor, color: getComputedStyle(card).color,
          direction: getComputedStyle(card.querySelector('.tuition-bank-number')).direction,
          number: card.querySelector('.tuition-bank-number').textContent.replace(/\s/g, ''),
          copy: card.querySelector('[data-copy]').dataset.copy,
          fits: card.querySelector('.tuition-bank-number').scrollWidth <= card.clientWidth
        })));
        assert.equal(cards.length, 2);
        for (const card of cards) {
          assert.equal(card.background, 'rgba(212, 168, 83, 0.18)');
          assert.equal(card.color, 'rgb(53, 38, 15)');
          assert.equal(card.direction, 'ltr');
          assert.equal(card.number, card.copy);
          assert.ok(card.fits);
        }
      }
      assert.deepEqual(errors, []);
      console.log('PASS: real browser registration/profile round-trip; removed explanations; gold cards, LTR digits and copy values at mobile/tablet widths');
    }
    const cleared = await api('/api/me', { birth_date: '', blood_group: '' }, cookie, 'PUT');
    assert.equal(cleared.body.user.birth_date, null);
    assert.equal(cleared.body.user.blood_group, null);
  } finally {
    if (browser) await browser.close();
    child.kill('SIGTERM');
    await once(child, 'exit');
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
