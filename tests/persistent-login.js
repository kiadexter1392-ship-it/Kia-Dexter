'use strict';
// Disposable SQLite + actual Chromium on-disk profiles. Never uses production accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { lifetimeSeconds } = require('../shared/session-policy');
async function freePort() {
  const s = net.createServer().listen(0, '127.0.0.1'); await once(s, 'listening');
  const port = s.address().port; await new Promise(resolve => s.close(resolve)); return port;
}
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-remember-'));
  const env = { ...process.env, ARSLAN_DATA_DIR: dir, ARSLAN_DB: path.join(dir,'test.db'),
    DOJO_TEST_FIXTURES:'0', RESET_DB:'0', PORT:String(await freePort()), COACH_PORT:String(await freePort()), MEMBER_PORT:String(await freePort()) };
  Object.assign(process.env, env);
  const db = require('../shared/db'); require('../shared/academy');
  const password = 'isolated-remember-secret';
  function user(username, role) {
    const u = db.createUser({username,full_name:'آزمایش '+username,password:username==='browser-member'?'123456':password,discipline:'کاراته'},role==='admin'?'coach':role);
    if (role==='admin') db.run('INSERT INTO academy_admins(user_id) VALUES (?)',u.id);
    return u;
  }
  const users = Object.fromEntries(['member','coach','admin'].map(role => [role,user('persistent-'+role,role)]));
  const browserUsers = Object.fromEntries(['member','coach','admin'].map(role => [role,user('browser-'+role,role)]));
  const origin = 'http://127.0.0.1:'+env.PORT;
  const bases = { member:origin, coach:origin+'/coach', admin:origin+'/admin' };
  let child, browserContext;
  async function start() {
    child = spawn(process.execPath,['start.js'],{env,cwd:path.join(__dirname,'..'),stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject) => {
      let logs='';const timer=setTimeout(()=>reject(new Error(logs)),15000);
      function read(chunk){logs+=chunk;if(logs.includes('[coach-site] آماده')&&logs.includes('[members-site] آماده')){clearTimeout(timer);resolve();}}
      child.stdout.on('data',read);child.stderr.on('data',read);
      child.once('exit',()=>{clearTimeout(timer);reject(new Error(logs));});
    });
  }
  async function stop(){ if(child && child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');} }
  async function request(role, route, {method='GET',body,cookie,https=false}={}) {
    const response = await fetch(bases[role]+route,{method,redirect:'manual',headers:{'Content-Type':'application/json','X-Academy-Request':'1',...(cookie?{cookie}:{}),...(https?{'x-forwarded-proto':'https'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const text = await response.text();
    return { response, text, data:response.headers.get('content-type')?.includes('json')?JSON.parse(text):null,
      headers:response.headers.getSetCookie(),cookie:response.headers.getSetCookie()[0]?.split(';')[0] };
  }
  async function login(role, https=false) {
    const r=await request(role,'/api/login',{method:'POST',body:{username:users[role].username,password},https});
    assert.equal(r.response.status,200,r.text);assert.equal(r.headers.length,1);
    assert.match(r.headers[0],new RegExp('Max-Age='+lifetimeSeconds(role)+'(?:;|$)'));
    assert.match(r.headers[0],/Expires=/);assert.match(r.headers[0],/HttpOnly/);
    assert.match(r.headers[0],role==='admin'?/SameSite=Strict/:/SameSite=Lax/);
    assert.equal(r.headers[0].includes('; Secure'),https);
    assert.equal(r.headers[0].includes('Domain='),false,'host-only cookie');
    return r.cookie;
  }
  const token = cookie => decodeURIComponent(cookie.slice(cookie.indexOf('=')+1));
  const endpoint = role => role==='admin'?'/api/config':'/api/me';
  async function authenticated(role,cookie,expected=true){
    const r=await request(role,endpoint(role),{cookie});
    if(expected){assert.equal(r.response.status,200);assert.ok(r.data.user);}
    else if(role==='admin') assert.equal(r.response.status,401);
    else assert.equal(r.data.user,null);
    return r;
  }
  try {
    await start();
    const sessions={};
    for(const role of ['member','coach','admin']) {
      const a=await login(role,true), b=await login(role);
      assert.notEqual(token(a),token(b));sessions[role]=b;
      const before=Date.now();
      db.run('UPDATE sessions SET expires_at=? WHERE token=?',new Date(Date.now()+2*864e5).toISOString(),token(b));
      const renewed=await authenticated(role,b);
      assert.equal(renewed.headers.length,1);assert.equal(renewed.cookie,b,'renewal must not race by rotating a bearer token');
      const persisted=db.get('SELECT expires_at FROM sessions WHERE token=?',token(b));
      assert.ok(Date.parse(persisted.expires_at)>=before+lifetimeSeconds(role)*1000-1000);
      assert.equal((await authenticated(role,b)).headers.length,0,'no SQLite/cookie renewal on every poll');
      const logout=await request(role,'/api/logout',{method:'POST',body:{},cookie:a,https:true});
      assert.match(logout.headers[0],/Max-Age=0/);assert.match(logout.headers[0],/; Secure/);
      const loggedOut=await authenticated(role,a,false);assert.match(loggedOut.headers[0],/Max-Age=0/);
      await authenticated(role,b);
      assert.equal(db.renewSession(token(a),role),null,'a revoked token must never be resurrected');
    }
    const oldMember=db.createSession(users.member.id,'member',90);
    const oldCookie='arslan_member_session='+oldMember.token;
    assert.equal((await authenticated('member',oldCookie)).headers.length,1,'existing valid sessions are upgraded without asking for a password');
    db.run('UPDATE sessions SET expires_at=? WHERE token=?',new Date(Date.now()-1000).toISOString(),oldMember.token);
    await authenticated('member',oldCookie,false);
    assert.equal(db.renewSession(oldMember.token,'member'),null);
    const temp=db.createSession(users.member.id,'member',1);db.run('UPDATE sessions SET impersonated=1 WHERE token=?',temp.token);
    const impersonated=await authenticated('member','arslan_member_session='+temp.token);
    assert.equal(impersonated.headers.length,0);assert.equal(db.get('SELECT expires_at FROM sessions WHERE token=?',temp.token).expires_at,temp.expires);
    const cross=await request('coach','/api/me',{cookie:'arslan_coach_session='+token(sessions.member)});assert.equal(cross.data.user,null);
    // Password change refreshes only this device and invalidates every old token.
    db.run('UPDATE sessions SET expires_at=? WHERE token=?',new Date(Date.now()+864e5).toISOString(),token(sessions.member));
    const changed=await request('member','/api/password',{method:'POST',cookie:sessions.member,body:{current:password,next:'new-isolated-password'}});
    assert.equal(changed.response.status,200,changed.text);assert.equal(changed.headers.length,1,'new login must replace any queued renewal');
    await authenticated('member',sessions.member,false);await authenticated('member',changed.cookie);
    db.updateUser(users.coach.id,{active:false});await authenticated('coach',sessions.coach,false);
    db.updateUser(users.coach.id,{active:true});await authenticated('coach',sessions.coach,false);
    db.run('DELETE FROM academy_admins WHERE user_id=?',users.admin.id);await authenticated('admin',sessions.admin,false);
    db.run('INSERT INTO academy_admins VALUES (?)',users.admin.id);
    console.log('PASS API: persistent HttpOnly/HTTPS Secure cookies, per-role expiry, daily sliding renewal, old-session upgrade, independent devices, expiry/logout/password/deactivation/role revocation and short impersonation sessions');
    if(process.env.BROWSER==='1') {
      const {chromium}=require('playwright-core'), mod=require('@sparticuz/chromium'), binary=mod.default||mod;
      const executablePath=await binary.executablePath(), profile=path.join(dir,'same-browser');
      async function launch(userDataDir) {
        // DNS-block optional external fonts without request interception, so service
        // workers and navigation redirects run exactly as in a normal browser.
        const ctx=await chromium.launchPersistentContext(userDataDir,{executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--host-resolver-rules=MAP cdn.jsdelivr.net ~NOTFOUND, MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND']});
        return ctx;
      }
      const errors=[];
      const profiles=Object.fromEntries(['member','coach','admin'].map(role=>[role,profile+'-'+role]));
      async function open(role, userDataDir=profiles[role]) {
        browserContext=await launch(userDataDir);
        const page=await browserContext.newPage();page.on('pageerror',e=>errors.push(e.message));
        await page.goto(bases[role]+(role==='admin'?'':'/'),{waitUntil:'domcontentloaded'});
        return page;
      }
      async function checkPanel(role,page) {
        if(role==='admin') {await page.locator('#academySession').waitFor({state:'visible'});assert.equal(await page.locator('#adminLogin').isVisible(),false);}
        else {await page.waitForURL(bases[role]+(role==='member'?'/panel':'/dashboard'));}
      }
      async function checkLogin(role,page) {
        await page.locator(role==='admin'?'#adminLogin':'#loginForm').waitFor({state:'visible'});
        assert.equal(new URL(page.url()).pathname,role==='admin'?'/admin':role==='coach'?'/coach/':'/');
      }
      // Separate on-disk browser profiles model an ordinary device for each role,
      // without introducing overlapping service-worker scopes into headless-shell.
      for(const role of ['member','coach','admin']) {
        const page=await open(role);
        if(role==='member') {
          await page.locator('#lUser').fill(browserUsers.member.username);await page.locator('.otp-field').fill('123456');
          await page.locator('#otpMount [data-phase="ok"]').waitFor();await page.locator('#loginBtn').click();
        } else {
          await page.locator('#loginForm [name=username]').fill(browserUsers[role].username);
          await page.locator('#loginForm [name=password]').fill(password);await page.locator('#loginForm [type=submit]').click();
        }
        await checkPanel(role,page);
        const cookies=(await browserContext.cookies()).filter(c=>c.name.includes('session'));
        assert.equal(cookies.length,1);assert.ok(cookies.every(c=>c.httpOnly&&c.expires>Date.now()/1000));
        const stored=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));
        for(const secret of [password,'123456',...cookies.map(c=>c.value)])assert.ok(!stored.includes(secret),'no secret in web storage');
        await browserContext.close();browserContext=null;
      }
      await stop();await start();
      for(const role of ['member','coach','admin']) {
        const page=await open(role);await checkPanel(role,page);
        if(role==='member')await page.locator('#meAvatar .avatar').waitFor();
        if(role==='admin') {
          await page.locator('#sessionExit').click();await page.locator('#adminLogin').waitFor({state:'visible'});
          await browserContext.close();browserContext=null;
          await checkLogin(role,await open(role));
        }
        await browserContext.close();browserContext=null;
      }
      // A different profile must never be identified by IP/UA or a device fingerprint.
      for(const role of ['member','coach','admin']) {
        await checkLogin(role,await open(role,path.join(dir,'different-browser')));
        await browserContext.close();browserContext=null;
      }
      assert.deepEqual(errors,[]);
      console.log('PASS BROWSER: actual coach/member OTP/admin form logins survive fully closing Chromium AND restarting Node with the same SQLite file; a fresh browser profile stays logged out; no passwords/tokens in localStorage');
    }
  } finally {
    if(browserContext)await browserContext.close();await stop();db.db.close();fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
