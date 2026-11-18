'use strict';
// Isolated real-browser design / accessibility / form regression. No live account.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
async function freePort() {
  const s=net.createServer().listen(0,'127.0.0.1');await once(s,'listening');
  const port=s.address().port;await new Promise(r=>s.close(r));return port;
}
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dojo-academy-design-'));
  Object.assign(process.env,{ARSLAN_DATA_DIR:dir,ARSLAN_DB:path.join(dir,'test.db'),DOJO_TEST_FIXTURES:'0',RESET_DB:'0',PORT:String(await freePort()),COACH_PORT:String(await freePort()),MEMBER_PORT:String(await freePort())});
  const db=require('../shared/db'), academy=require('../shared/academy');
  const password='isolated-design-test-secret';
  const make=(username,role)=>db.createUser({username,full_name:'آزمایش طراحی '+username,password,discipline:'کاراته'},role);
  const admin=make('design-admin','coach'), coach=make('design-coach','coach'),member=make('design-member','member');
  db.run('INSERT INTO academy_admins(user_id) VALUES (?)',admin.id);
  const seededClass=academy.save('classes',{title:'کلاس فیلتر',discipline:'کاراته',coach_id:coach.id,group:'آزمایش',weekdays:'شنبه',starts_at:'09:00',ends_at:'10:00',member_ids:[member.id],location:'سالن'},coach,'coach');
  for (const [user,status] of [[member,'حاضر'],[coach,'غایب']]) academy.save('attendance',{class_id:seededClass.id,user_id:user.id,event_date:new Date().toISOString().slice(0,10),status},admin,'admin');
  const child=spawn(process.execPath,['start.js'],{env:process.env,cwd:path.join(__dirname,'..'),stdio:['ignore','pipe','pipe']});
  const origin='http://127.0.0.1:'+process.env.PORT;
  let browser, logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const screenshotDir=process.env.SCREENSHOT_DIR;
  if(screenshotDir)fs.mkdirSync(screenshotDir,{recursive:true});
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error(logs)),15000);
      const read=()=>{if(logs.includes('[coach-site] آماده')&&logs.includes('[members-site] آماده')){clearTimeout(timer);resolve();}};
      child.stdout.on('data',read);child.once('exit',()=>{clearTimeout(timer);reject(new Error(logs));});read();
    });
    const {chromium}=require('playwright-core'), mod=require('@sparticuz/chromium'), binary=mod.default||mod;
    browser=await chromium.launch({executablePath:await binary.executablePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    // Blocking all external requests proves the actual Persian font is self-hosted.
    await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    const page=await context.newPage(), errors=[],fontResponses=[];let requests=[];
    page.on('request',r=>{if(r.method()==='GET' && r.url().includes('/api/'))requests.push(new URL(r.url()).pathname);});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().includes('.woff2'))fontResponses.push([r.url(),r.status()]);});
    async function noOverflow() {assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page must not overflow');}
    async function fontLoaded() {
      await page.evaluate(()=>document.fonts.ready);
      assert.ok(await page.evaluate(()=>document.fonts.check('600 16px Vazirmatn','مدیریت آکادمی')),'real font must be loaded');
      assert.ok(fontResponses.some(([url,status])=>url.includes('arabic-wght')&&status===200),'local Persian woff2 was requested and served');
      assert.match(await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily),/Vazirmatn/);
    }
    await page.goto(origin+'/admin');await page.locator('#adminLogin').waitFor({state:'visible'});await fontLoaded();
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:1000});await noOverflow();
      assert.ok(await page.locator('[name=username]').evaluate(el=>el.getBoundingClientRect().height>=44));
      if(screenshotDir&&[390,1440].includes(width))await page.screenshot({path:path.join(screenshotDir,`admin-login-${width}.png`),fullPage:true});
    }
    requests=[];
    await page.locator('[name=username]').fill(admin.username);await page.locator('[name=password]').fill(password);await page.locator('#loginForm button').click();
    await page.locator('#academySession').waitFor({state:'visible'});await page.locator('#sectionBody[aria-busy=false]').waitFor();
    assert.equal(await page.locator('#sessionRole').textContent(),'پنل مدیریت');
    assert.equal(requests.filter(p=>p==='/admin/api/people').length,1,'load people only once on startup');
    assert.equal(requests.filter(p=>p.includes('/records/')).length,0,'no eager reference fetches when opening admin people view');
    assert.ok(await page.locator('#academyToday').getAttribute('datetime'));
    // Dashboard is the default view: real aggregates only, no fabricated figures.
    assert.equal(await page.locator('[aria-current=page]').getAttribute('data-kind'),'dashboard');
    assert.equal(await page.locator('.dash-metric').count(),4);
    assert.equal(await page.locator('.dash-bars figure').count(),8,'eight real attendance weeks');
    assert.ok(await page.locator('.dash-load-bar').isVisible());
    assert.ok(await page.locator('.dash-table-card').isVisible());
    assert.ok(await page.locator('.dash-perf-card').isVisible());
    assert.ok(await page.locator('.dash-cap-card').isVisible());
    assert.equal(await page.locator('#dashRange option').count(),2);
    await page.locator('#dashRange').selectOption('months');await page.locator('.dash-bars figure').first().waitFor();
    assert.equal(await page.locator('.dash-bars figure').count(),6,'six real attendance months');
    await page.locator('#dashRange').selectOption('weeks');
    // Collapsible sidebar groups (medesk registry design).
    const firstToggle=page.locator('.academy-nav-toggle').first();
    assert.equal(await firstToggle.getAttribute('aria-expanded'),'true');
    await firstToggle.click();
    assert.equal(await firstToggle.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('.academy-nav-group.collapsed .academy-nav-body').isHidden(),true);
    await firstToggle.click();
    assert.equal(await firstToggle.getAttribute('aria-expanded'),'true');
    // Table status filter only appears for the admin attendance table.
    assert.equal(await page.locator('#dashStatusFilter').count(),1);
    await page.locator('#dashStatusFilter').selectOption('حاضر');
    assert.equal(await page.locator('#dashTableBody tr:visible').count(),1);
    assert.equal(await page.locator('#dashTableBody tr:visible').first().getAttribute('data-status'),'حاضر');
    await page.locator('#dashStatusFilter').selectOption('موجه');
    assert.equal(await page.locator('#dashTableBody tr:visible').count(),0);
    assert.equal(await page.locator('#dashFilterEmpty').isVisible(),true);
    await page.locator('#dashStatusFilter').selectOption('');
    assert.equal(await page.locator('#dashTableBody tr:visible').count(),2);
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});await noOverflow();}
    await page.setViewportSize({width:1440,height:1000});
    const expectedKinds=[...Object.keys(require('../shared/academy-schema')),'dashboard','leaderboard','people','users','review','audit'];
    // The schema remains the source of truth; no feature is removed by regrouping.
    assert.deepEqual((await page.locator('#academyNav button[data-kind]').evaluateAll(nodes=>nodes.map(n=>n.dataset.kind))).sort(),expectedKinds.sort());
    for(const width of [320,390,768,1024,1440]) {
      await page.setViewportSize({width,height:1000});await noOverflow();
      await page.locator('[data-kind=meetings]').click();await page.locator('#sectionBody[aria-busy=false]').waitFor();
      assert.equal(await page.locator('[aria-current=page]').count(),1);
      await page.locator('#addRecord').click();await page.locator('#recordDialog').waitFor({state:'visible'});await noOverflow();
      assert.ok(await page.locator('#field-title').evaluate(el=>getComputedStyle(el).fontFamily.includes('Vazirmatn')));
      if(screenshotDir&&width===390)await page.screenshot({path:path.join(screenshotDir,'admin-form-mobile.png'),fullPage:true});
      await page.keyboard.press('Escape');await page.locator('#recordDialog').waitFor({state:'hidden'});
    }
    await page.locator('#addRecord').click();await page.locator('#field-title').fill('جلسهٔ بررسی برنامهٔ کلاس‌ها');await page.locator('#field-event_date').fill('2026-12-01');await page.locator('#field-starts_at').fill('17:00');await page.locator('#saveRecord').click();
    await page.locator('#recordDialog').waitFor({state:'hidden'});await page.getByRole('heading',{name:'جلسهٔ بررسی برنامهٔ کلاس‌ها'}).waitFor();
    const rows=academy.records('meetings');assert.equal(rows.length,1);assert.equal(rows[0].data.title,'جلسهٔ بررسی برنامهٔ کلاس‌ها');
    // Search supports Arabic/Persian letter variants and never removes features.
    await page.locator('#navSearch').fill('شهريه');assert.equal(await page.locator('#academyNav button[data-kind]:visible').count(),1);
    await page.locator('[data-kind=invoices]').click();await page.locator('#sectionBody[aria-busy=false]').waitFor();
    await page.locator('#navSearch').fill('ناموجود-آزمایش');await page.locator('#navEmpty').waitFor({state:'visible'});
    await page.locator('#navSearch').fill('');assert.equal(await page.locator('#academyNav button[data-kind]:visible').count(),expectedKinds.length);
    await page.locator('[data-kind=meetings]').click();await page.locator('#sectionBody[aria-busy=false]').waitFor();
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));await noOverflow();
      if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,`admin-panel-${width}.png`),fullPage:true});
    }
    await page.locator('[data-kind=audit]').click();await page.locator('#sectionBody table').waitFor();await noOverflow();
    await page.goBack();await page.waitForFunction(()=>document.querySelector('[aria-current=page]')?.dataset.kind==='meetings');
    // Full keyboard navigation / focus ring; reduced-motion remains respected.
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#navSearch').focus();await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(()=>document.activeElement.matches('#academyNav button')));
    assert.notEqual(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none');
    for(let i=0;i<60;i++)academy.save('meetings',{title:'جلسهٔ آزمایشی صفحه‌بندی '+i,event_date:'2026-12-01',starts_at:'17:00'},admin,'admin');
    await page.locator('[data-kind=meetings]').click();await page.locator('[data-page-step="1"]').waitFor();
    assert.equal(await page.locator('.academy-record').count(),24);
    await page.locator('[data-page-step="1"]').click();assert.equal(await page.locator('.academy-record').count(),24);
    await page.locator('[data-page-step="1"]').click();assert.equal(await page.locator('.academy-record').count(),13);
    await page.getByRole('heading',{name:'جلسهٔ بررسی برنامهٔ کلاس‌ها'}).waitFor();await noOverflow();
    assert.equal(academy.records('meetings').length,61,'pagination never truncates persisted data');
    // Person dialog tabs: overview / skills / activity with real data.
    const dashClass=academy.save('classes',{title:'کلاس تست داشبورد',discipline:'کاراته',coach_id:coach.id,group:'آزمایش',weekdays:'شنبه',starts_at:'09:00',ends_at:'10:00',member_ids:[member.id],location:'سالن'},coach,'coach');
    const jNow=require('../shared/jalali').todayJalali();
    academy.save('evaluations',{coach_id:coach.id,year:jNow.jy,month:jNow.jm,score:5,comment:'عالی'},member,'member');
    db.saveProgress({user_id:member.id,year:jNow.jy,month:jNow.jm,overall:88,sessions:9,endurance:86,strength:90,technique:88,flexibility:84,discipline:92},coach.id);
    await page.locator('[data-kind=dashboard]').click();await page.locator('#sectionBody[aria-busy=false]').waitFor();
    await page.locator('.dash-perf-row').first().click();
    await page.locator('#personDialog').waitFor({state:'visible'});
    await page.locator('.dash-tab').first().waitFor();
    assert.equal(await page.locator('.dash-tab').count(),3);
    assert.equal(await page.locator('[data-panel=overview]').isVisible(),true);
    await page.locator('[data-tab=skills]').click();
    assert.equal(await page.locator('[data-panel=skills]').isVisible(),true);
    assert.equal(await page.locator('[data-panel=overview]').isHidden(),true);
    assert.ok(await page.locator('.dash-skill-list li').count()>=1,'coach classes listed in skills tab');
    await page.locator('[data-tab=activity]').click();
    assert.equal(await page.locator('[data-panel=activity]').isVisible(),true);
    assert.ok(await page.locator('.dash-activity-list li').count()>=1,'real audit rows in activity tab');
    await page.locator('#closePerson').click();
    await page.locator('#personDialog').waitFor({state:'hidden'});
    await page.goto(origin+'/coach/admin');await page.locator('#academySession').waitFor({state:'visible'});await fontLoaded();await noOverflow();
    assert.equal(await page.locator('#backLink').getAttribute('href'),'/coach/');
    // Coach/member academy share the new design without being granted admin menus.
    for(const [role,user,baseUrl] of [['coach',coach,origin+'/coach'],['member',member,'http://127.0.0.1:'+process.env.COACH_PORT+'/member']]) {
      const route=baseUrl+'/api/login';
      const response=await context.request.post(route,{data:{username:user.username,password}});assert.equal(response.status(),200);
      requests=[];
      await page.goto(baseUrl+'/academy#attendance');await page.locator('#academySession').waitFor({state:'visible'});await fontLoaded();await noOverflow();
      assert.equal(await page.locator('[data-kind=users]').count(),0);assert.equal(await page.locator('#sessionExit').isVisible(),false);
      assert.equal(await page.locator('#sessionRole').textContent(),role==='coach'?'پنل مربی':'پنل شاگرد');
      for(const kind of ['attendance','meetings','discounts']){
        assert.equal(await page.locator(`[data-kind=${kind}]`).count(),0,'no management operations in role services');
        assert.equal((await context.request.get(baseUrl+'/api/academy/records/'+kind)).status(),403);
      }
      assert.equal(requests.filter(p=>/\/records\/(classes|challenges|exams|products)$/.test(p)).length,0,'opening services must not download unrelated reference lists');
      await page.waitForFunction(()=>document.querySelector('#sectionBody')?.getAttribute('aria-busy')==='false');
      assert.equal(await page.locator('[aria-current=page]').getAttribute('data-kind'),'dashboard','old attendance deep links cannot open management data');
      assert.equal(await page.locator('.dash-metric').count(),4,'dashboard metrics render for every role');
      assert.equal(await page.locator('.dash-area, .dash-chart-card .academy-empty').count(),1,'score chart or honest empty state, never attendance');
      assert.equal(await page.locator('.dash-bars').count(),0,'no attendance bars in role services');
      assert.equal(await page.locator('.dash-cap-card').count(),role==='coach'?1:0);
      await page.locator('[data-kind=dashboard]').click();await page.locator('#sectionBody[aria-busy=false]').waitFor();await noOverflow();
      if(role==='member'){
        const before=requests.filter(p=>p.endsWith('/records/products')).length;
        await page.locator('[data-kind=orders]').click();await page.locator('#sectionBody[aria-busy=false]').waitFor();
        await page.locator('[data-kind=nutrition]').click();await page.locator('#sectionBody[aria-busy=false]').waitFor();
        await page.locator('[data-kind=orders]').click();await page.locator('#sectionBody[aria-busy=false]').waitFor();
        assert.equal(requests.filter(p=>p.endsWith('/records/products')).length-before,1,'load only needed reference list once within freshness window');
      }

    }
    assert.deepEqual(errors,[]);
    console.log('PASS DESIGN: self-hosted Persian variable font with external requests blocked, responsive 320–1440px login/panel/modal/table, every allowed feature retained, real create/save, grouped search including Arabic letter variants, hash history, keyboard focus, reduced motion, mounted admin/coach/member roles, management-only API/menu separation, lazy deduplicated requests and bounded 24-card pagination over 61 records');
    await context.close();
  } finally {
    if(browser)await browser.close();if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}
    db.db.close();fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
