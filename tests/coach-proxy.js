'use strict';
// End-to-end HTTP + DOM regression for Railway's /coach mount and direct local mode.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');

async function freePort() {
  const s = net.createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return port;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn) {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await pause(50);
  }
  throw new Error('Timed out waiting for rendered dashboard');
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-proxy-test-'));
  const port = await freePort(), coachPort = await freePort(), memberPort = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const direct = `http://127.0.0.1:${coachPort}`;
  const child = spawn(process.execPath, ['start.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), COACH_PORT: String(coachPort), MEMBER_PORT: String(memberPort),
      MEMBERS_SITE_URL: 'null', RESET_DB: '0', ARSLAN_DATA_DIR: dir, ARSLAN_DB: path.join(dir, 'test.db') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  const doms = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(logs)), 15000);
      const read = d => {
        logs += d;
        if (logs.includes('[coach-site] آماده') && logs.includes('[members-site] آماده')) {
          clearTimeout(timer); resolve();
        }
      };
      child.stdout.on('data', read);
      child.stderr.on('data', read);
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exit ${code}: ${logs}`)); });
    });
    const get = (url, cookie) => fetch(url, { redirect: 'manual', headers: cookie ? { cookie } : {} });
    for (const [url, expected] of [
      ['/coach', '/coach/'], ['/dashboard?tab=members', '/coach/dashboard?tab=members'],
      ['/coach/dashboard', '/coach/']
    ]) {
      const res = await get(base + url);
      assert.equal(res.status, 302);
      assert.equal(res.headers.get('location'), expected);
    }
    assert.equal((await get(base + '/coach-not-a-route')).status, 404);
    const bad = await fetch(base + '/coach/login', { method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'arsalan', password: 'incorrect' }) });
    assert.ok(bad.headers.get('location').startsWith('/coach/?error='));

    for (const origin of [base + '/coach', direct]) {
      const res = await fetch(origin + '/login', { method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: 'arsalan', password: 'arsalan123' }) });
      assert.equal(res.status, 302);
      const expected = origin === direct ? '/dashboard' : '/coach/dashboard';
      assert.equal(res.headers.get('location'), expected);
      const cookie = res.headers.getSetCookie()[0].split(';')[0];
      assert.ok(cookie.startsWith('arslan_coach_session='));
      const target = new URL(expected, origin).href;
      const panel = await get(target, cookie);
      assert.equal(panel.status, 200);
      const html = await panel.text();
      const pageErrors = [], apiCalls = [];
      class LocalResources extends ResourceLoader {
        fetch(url, options) {
          if (new URL(url).origin !== new URL(origin).origin) return null;
          return super.fetch(url, options);
        }
      }
      const console = new VirtualConsole();
      console.on('jsdomError', e => {
        if (!/Not implemented|Could not parse CSS/.test(e.message)) pageErrors.push(e.message);
      });
      const dom = new JSDOM(html, {
        url: target, runScripts: 'dangerously', resources: new LocalResources(),
        pretendToBeVisual: true, virtualConsole: console,
        beforeParse(window) {
          window.fetch = (url, opts = {}) => {
            const target = new URL(url, window.location.href).href;
            apiCalls.push(target);
            return fetch(target, { ...opts, headers: { ...opts.headers, cookie } });
          };
          window.scrollTo = () => {};
          window.open = () => null;
        }
      });
      doms.push(dom);
      const doc = dom.window.document;
      await waitFor(() => doc.querySelectorAll('#view-overview .stat').length >= 4);
      assert.ok(doc.querySelector('#meAvatar').children.length > 0);
      for (const view of ['members', 'plans', 'progress', 'news', 'settings']) {
        doc.querySelector(`[data-view="${view}"]`).click();
        await waitFor(() => !doc.querySelector(`#view-${view} .loader`) && doc.querySelector(`#view-${view}`).textContent.trim());
        assert.ok(!doc.querySelector(`#view-${view} > .card.empty`), view + ': ' + doc.querySelector(`#view-${view}`).textContent);
      }
      const prefix = origin === direct ? '/api/' : '/coach/api/';
      assert.ok(apiCalls.length > 8);
      assert.ok(apiCalls.every(url => new URL(url).pathname.startsWith(prefix)));
      assert.deepEqual(pageErrors, []);
      const cfg = await (await fetch(origin + '/api/config')).json();
      assert.equal(cfg.membersSiteUrl, null);
      if (origin !== direct) assert.equal(cfg.peerSiteUrl, '/');
      // Every local script and stylesheet resolves with and without the proxy prefix.
      for (const el of doc.querySelectorAll('script[src], link[rel="stylesheet"]')) {
        const asset = el.src || el.href;
        if (new URL(asset).origin === new URL(origin).origin) assert.equal((await fetch(asset)).status, 200, asset);
      }
      assert.equal((await get(origin + '/', cookie)).headers.get('location'), expected);
      await fetch(origin + '/api/logout', { method: 'POST', headers: { cookie } });
      const after = await get(origin + '/dashboard', cookie);
      assert.equal(after.headers.get('location'), origin === direct ? '/' : '/coach/');
      const unauth = await fetch(origin + '/api/me', { headers: { cookie } });
      assert.equal((await unauth.json()).user, null);
      global.console.log('PASS:', origin === direct ? 'direct local mode' : 'Railway proxy mode', '— login/session/assets, six rendered views, API prefix, logout/access control');
    }
    const loginHtml = await (await fetch(base + '/coach/')).text();
    assert.ok(!loginHtml.includes('dojo-3d'));
    const loginDom = new JSDOM(loginHtml, { url: base + '/coach/' });
    doms.push(loginDom);
    const doc = loginDom.window.document;
    assert.equal(doc.querySelector('form').action, base + '/coach/login');
    const style = doc.createElement('style');
    style.textContent = await (await fetch(base + '/coach/login.css')).text();
    doc.head.appendChild(style);
    assert.equal(loginDom.window.getComputedStyle(doc.body).backgroundColor, 'rgb(255, 255, 255)');
    assert.equal(doc.querySelector('input[name="password"]').type, 'password');
    assert.equal(doc.querySelector('input[name="password"]').autocomplete, 'current-password');
    for (const el of doc.querySelectorAll('script[src], link[rel="stylesheet"]')) {
      const url = el.src || el.href;
      if (new URL(url).origin === base) assert.equal((await fetch(url)).status, 200, url);
    }
    const cfg = await (await fetch(base + '/api/config')).json();
    assert.equal(cfg.peerSiteUrl, '/coach/');
    global.console.log('PASS: white login, relative form/assets, password masking, member ↔ coach same-origin links');
  } finally {
    doms.forEach(dom => dom.window.close());
    child.kill('SIGTERM');
    await once(child, 'exit');
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
