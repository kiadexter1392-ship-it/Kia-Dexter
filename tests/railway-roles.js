'use strict';
// Non-destructive production check: login/read/logout only. No live users are created.
const assert = require('node:assert/strict');
const COACH = (process.env.COACH_URL || 'https://kia-dexter-production-cd4745b0.up.railway.app').replace(/\/$/, '');
const MEMBER = (process.env.MEMBER_URL || COACH + '/member').replace(/\/$/, '');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const request = (base, route, options = {}) => fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(15000),
  ...options, headers: { 'Cache-Control': 'no-cache', ...options.headers } });

(async () => {
  let ready = false;
  const deadline = Date.now() + Number(process.env.DEPLOY_WAIT_MS || 300000);
  while (Date.now() < deadline) {
    try {
      const coach = await (await request(COACH, '/api/config?verify=' + Date.now())).json();
      const member = await (await request(MEMBER, '/api/config?verify=' + Date.now())).json();
      const dock = await (await request(COACH, '/ui/MagnifyingDock.js?verify=' + Date.now())).text();
      if (dock.includes('root.MagnifyingDock = { mount }') && coach.site === 'coach' && member.site === 'member' && coach.peerSiteUrl === '/member/' && member.peerSiteUrl === '/') {
        ready = true; break;
      }
    } catch { /* container may be restarting */ }
    console.log('Waiting for coach root and separate member route...');
    await pause(10000);
  }
  assert.ok(ready, 'Dedicated coach domain did not become available');
  const coachHtml = await (await request(COACH, '/')).text();
  const memberHtml = await (await request(MEMBER, '/')).text();
  assert.match(coachHtml, /class="coach-login"/);
  assert.match(memberHtml, /name="blood_group"/);
  assert.match(memberHtml, /name="birth_date"/);
  const manifest = await (await request(MEMBER, '/manifest.json')).json();
  assert.equal(manifest.scope, '/member/');
  console.log('PASS: live root is coach, /member/ is students, mounted manifest and registration fields');

  const memberPath = new URL(MEMBER).pathname;
  const sessions = [];
  try {
    for (const [base, username, password, expectedRole, target] of [
      [COACH, process.env.COACH_USERNAME || 'arsalan', process.env.COACH_PASSWORD || 'arsalan123', 'coach', '/dashboard'],
      [MEMBER, process.env.MEMBER_USERNAME || 'kia', process.env.MEMBER_PASSWORD || '123456', 'member', memberPath + '/panel']
    ]) {
      const login = await request(base, '/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }) });
      assert.equal(login.status, 302, expectedRole + ' login');
      assert.equal(login.headers.get('location'), target);
      const cookie = login.headers.getSetCookie()[0].split(';')[0];
      sessions.push({ base, cookie });
      const me = await (await request(base, '/api/me', { headers: { cookie } })).json();
      assert.equal(me.user.role, expectedRole);
      const page = await request(base, expectedRole === 'coach' ? '/dashboard' : '/panel', { headers: { cookie } });
      assert.equal(page.status, 200);
      const html = await page.text();
      if (expectedRole === 'coach') {
        assert.match(html, /id="view-overview"/);
        assert.match(html, /src="ui\/MagnifyingDock.js"/);
      }
      else {
        assert.match(html, /src="\/member\/panel.js"/);
        assert.match(html, /src="\/member\/ui\/MagnifyingDock.js"/);
        assert.match(html, /id="view-profile"/);
        assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
      }
      const assets = expectedRole === 'coach' ? ['/ui/style.css', '/ui/ui.js', '/ui/MagnifyingDock.js', '/dashboard.js']
        : ['/ui/style.css', '/ui/ui.js', '/ui/MagnifyingDock.js', '/panel.js', '/CardSwap.js', '/images/card-karate.jpg'];
      for (const asset of assets) assert.equal((await request(base, asset)).status, 200, expectedRole + asset);
      console.log('PASS: live', expectedRole, 'form login, role-specific session/dashboard and all assets');
    }
  } finally {
    for (const { base, cookie } of sessions) {
      await request(base, '/api/logout', { method: 'POST', headers: { cookie } });
      const me = await (await request(base, '/api/me', { headers: { cookie } })).json();
      assert.equal(me.user, null);
    }
  }
  console.log('PASS: both live sessions logged out; no production member data changed');
  console.log('Coach:', COACH + '/');
  console.log('Students:', MEMBER + '/');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
