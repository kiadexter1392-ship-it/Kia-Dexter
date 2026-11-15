'use strict';
// Live, non-destructive Railway check: only creates then revokes login sessions.
// Credentials may be overridden by repository secrets; never print cookies/passwords.
const assert = require('node:assert/strict');
const BASE = (process.env.LIVE_URL || 'https://kia-dexter-production.up.railway.app').replace(/\/$/, '');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(route, options = {}) {
  return fetch(BASE + route, { redirect: 'manual', signal: AbortSignal.timeout(20000),
    ...options, headers: { 'Cache-Control': 'no-cache', ...options.headers } });
}

async function main() {
  const deadline = Date.now() + Number(process.env.DEPLOY_WAIT_MS || 300000);
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const css = await request('/coach/login.css?live-check=' + Date.now());
      const cfg = await (await request('/coach/api/config')).json();
      if (css.ok && (await css.text()).includes('body.coach-login') && cfg.peerSiteUrl === '/' && cfg.membersSiteUrl !== 'null') {
        ready = true; break;
      }
    } catch { /* the service may restart during rollout */ }
    console.log('Waiting for the updated Railway deployment...');
    await pause(10000);
  }
  assert.ok(ready, 'Updated deployment did not become available within the deadline');
  console.log('PASS: updated white login CSS and proxy configuration are live');

  const canonical = await request('/coach');
  assert.equal(canonical.headers.get('location'), '/coach/');
  const legacy = await request('/dashboard');
  assert.equal(legacy.headers.get('location'), '/coach/dashboard');
  const loginPage = await request('/coach/');
  assert.equal(loginPage.status, 200);
  const loginHtml = await loginPage.text();
  assert.match(loginHtml, /class="coach-login"/);
  assert.match(loginHtml, /action="login"/);
  assert.ok(!loginHtml.includes('dojo-3d.css'));
  for (const asset of ['/coach/ui/style.css', '/coach/ui/shell.css', '/coach/ui/ui.js', '/coach/dashboard.js']) {
    assert.equal((await request(asset)).status, 200, asset);
  }
  console.log('PASS: coach redirects, login markup and shared gold/glass assets');

  const login = await request('/coach/login', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: process.env.COACH_USERNAME || 'arsalan', password: process.env.COACH_PASSWORD || 'arsalan123' }) });
  assert.equal(login.status, 302, 'Coach form login must succeed');
  assert.equal(login.headers.get('location'), '/coach/dashboard');
  const setCookie = login.headers.getSetCookie().find(c => c.startsWith('arslan_coach_session='));
  assert.ok(setCookie, 'Coach session cookie is missing');
  const cookie = setCookie.split(';')[0];
  try {
    const panel = await request('/coach/dashboard', { headers: { cookie } });
    assert.equal(panel.status, 200);
    assert.match(await panel.text(), /id="view-overview"/);
    for (const route of ['/coach/api/me', '/coach/api/overview', '/coach/api/members', '/coach/api/plans', '/coach/api/years']) {
      const res = await request(route, { headers: { cookie } });
      assert.equal(res.status, 200, route);
      const data = await res.json();
      assert.notEqual(data.ok, false, route);
      if (route.endsWith('/me')) assert.equal(data.user.role, 'coach');
    }
    console.log('PASS: real coach form login, /coach/dashboard, authenticated dashboard APIs');
  } finally {
    await request('/coach/api/logout', { method: 'POST', headers: { cookie } });
  }
  const expired = await request('/coach/dashboard', { headers: { cookie } });
  assert.equal(expired.headers.get('location'), '/coach/');
  console.log('PASS: coach logout revokes access');

  const home = await (await request('/')).text();
  assert.match(home, /خادم اباد،کوچه لاله چهارم غربی، جنب پلی استیشن فروشی\./);
  assert.ok(!home.includes('حساب تست'));
  assert.match(home, /href="tel:\+989016399804"[^>]*dir="ltr"/);
  const member = await request('/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.MEMBER_USERNAME || 'kia', password: process.env.MEMBER_PASSWORD || '123456' }) });
  assert.equal(member.status, 200, 'Member test account login failed');
  const memberCookie = member.headers.getSetCookie()[0].split(';')[0];
  try {
    assert.equal((await request('/panel', { headers: { cookie: memberCookie } })).status, 200);
  } finally {
    await request('/api/logout', { method: 'POST', headers: { cookie: memberCookie } });
  }
  console.log('PASS: new address, LTR phone, removed test hint, kia login and member panel');
  console.log('LIVE SMOKE CHECK PASSED:', BASE);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
