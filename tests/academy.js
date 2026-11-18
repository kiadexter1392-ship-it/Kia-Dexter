'use strict';
// Entire suite uses a disposable database. No live data or external services.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {once}=require('node:events');
const {spawn,spawnSync}=require('node:child_process');
async function freePort(){const s=net.createServer().listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dojo-academy-'));
 Object.assign(process.env,{ARSLAN_DATA_DIR:dir,ARSLAN_DB:path.join(dir,'test.db'),DOJO_TEST_FIXTURES:'0',RESET_DB:'0',PORT:String(await freePort()),COACH_PORT:String(await freePort()),MEMBER_PORT:String(await freePort())});
 delete process.env.PAYMENT_PORTAL_URL;
 const db=require('../shared/db');const academy=require('../shared/academy');const j=require('../shared/jalali').todayJalali();
 require('../shared/seed').seedIfEmpty();
 assert.equal(db.get('SELECT COUNT(*) c FROM users').c,0,'normal startup must create no demonstration accounts');
 assert.equal(db.get('SELECT COUNT(*) c FROM progress').c,0);
 const password='isolated-test-secret-2026';
 const make=(name,role='member')=>db.createUser({username:name,full_name:'آزمایش '+name,password,discipline:'کاراته'},role);
 const c=make('coach-test','coach'),c2=make('other-coach','coach'),m=make('student-one'),m2=make('student-two');
 const old=make('legacy-unverified');db.run('UPDATE users SET verified=0 WHERE id=?',old.id);
 db.saveProgress({user_id:old.id,year:j.jy,month:j.jm,overall:99},c.id);db.run('UPDATE progress SET verified=0 WHERE user_id=?',old.id);
 const legacyPlan=db.createPlan({author_id:c.id,title:'legacy fake plan',all_members:true});db.run('UPDATE plans SET verified=0 WHERE id=?',legacyPlan.id);
 const legacyAnn=db.createAnnouncement({author_id:c.id,title:'legacy fake notice',all_members:true});db.run('UPDATE announcements SET verified=0 WHERE id=?',legacyAnn.id);
 const created=spawnSync(process.execPath,['scripts/create-account.js','admin'],{env:{...process.env,ACCOUNT_USERNAME:'admin-test',ACCOUNT_PASSWORD:password,ACCOUNT_NAME:'مدیر آزمایش'},encoding:'utf8'});
 assert.equal(created.status,0,created.stderr);
 const admin=db.findByUsername('admin-test');assert.ok(db.get('SELECT user_id FROM academy_admins WHERE user_id=?',admin.id));
 const again=spawnSync(process.execPath,['scripts/create-account.js','admin'],{env:{...process.env,ACCOUNT_USERNAME:'admin-test',ACCOUNT_PASSWORD:password,ACCOUNT_NAME:'مدیر آزمایش'},encoding:'utf8'});assert.notEqual(again.status,0);
 const child=spawn(process.execPath,['start.js'],{env:process.env,stdio:['ignore','pipe','pipe']});
 const gateway='http://127.0.0.1:'+process.env.PORT,coach='http://127.0.0.1:'+process.env.COACH_PORT,member=coach+'/member';
 let logs='',browser;child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 async function req(base,route,method='GET',body,cookie,expected=200,extra={}){
   const r=await fetch(base+route,{method,redirect:'manual',headers:{'Content-Type':'application/json','X-Academy-Request':'1',...(cookie?{cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
   const text=await r.text();assert.equal(r.status,expected,`${method} ${route}: ${text}`);
   return {data:r.headers.get('content-type')?.includes('json')?JSON.parse(text):text,cookie:r.headers.getSetCookie()[0]?.split(';')[0],response:r};
 }
 try{
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(logs)),15000);const read=()=>{if(logs.includes('[coach-site] آماده')&&logs.includes('[members-site] آماده')){clearTimeout(timer);resolve();}};child.stdout.on('data',read);child.once('exit',()=>{clearTimeout(timer);reject(new Error(logs));});read();});
   const cookieC=(await req(coach,'/api/login','POST',{username:c.username,password})).cookie;
   const cookieC2=(await req(coach,'/api/login','POST',{username:c2.username,password})).cookie;
   const cookieM=(await req(member,'/api/login','POST',{username:m.username,password})).cookie;
   const cookieM2=(await req(member,'/api/login','POST',{username:m2.username,password})).cookie;
   const cookieA=(await req(gateway,'/admin/api/login','POST',{username:admin.username,password},undefined,200,{origin:gateway})).cookie;
   await req(coach,'/admin/api/config','GET',undefined,cookieC,401);
   await req(coach,'/api/login','POST',{username:admin.username,password},undefined,401);
   await req(coach,'/admin/api/login','POST',{username:c.username,password},undefined,401);
   await req(member,'/api/academy/records/nutrition','GET',undefined,undefined,401);
   await req(coach,'/api/academy/records/nutrition','GET',undefined,cookieC,403);
   const cfg=(await req(member,'/api/academy/config','GET',undefined,cookieM)).data;
   assert.equal(cfg.paymentPortal,null);assert.equal(cfg.role,'member');
   const overview=(await req(coach,'/api/overview','GET',undefined,cookieC)).data;
   assert.equal(overview.stats.members,2);assert.equal(overview.stats.thisMonth,0);assert.equal(overview.stats.plans,0);assert.equal(overview.stats.announcements,0);
   assert.equal((await req(member,'/api/plans','GET',undefined,cookieM)).data.plans.length,0);
   assert.equal((await req(member,'/api/announcements','GET',undefined,cookieM)).data.announcements.length,0);
   for(const k of Object.keys(cfg.schema)) assert.equal((await req(member,'/api/academy/records/'+k,'GET',undefined,cookieM)).data.records.length,0,k);
   const review=(await req(coach,'/admin/api/review','GET',undefined,cookieA)).data;
   assert.ok(review.groups.some(g=>g.table==='progress'&&g.count===1));assert.ok(!JSON.stringify(review).includes('password_hash'));assert.ok(!JSON.stringify(review).includes('password_salt'));
   await req(coach,'/admin/api/review/users/'+old.id,'POST',{},cookieA);
   assert.equal((await req(coach,'/api/overview','GET',undefined,cookieC)).data.stats.members,3);
   assert.equal((await req(coach,'/api/overview','GET',undefined,cookieC)).data.stats.thisMonth,0,'verifying a user must not verify their scores');
   const post=async(kind,data,who='coach',status=201)=>req(who==='admin'?coach:who==='member'?member:coach,(who==='admin'?'/admin/api':'/api/academy')+'/records/'+kind,'POST',data,who==='admin'?cookieA:who==='member'?cookieM:cookieC,status);
   const cl=(await post('classes',{title:'کلاس واقعی تست',discipline:'کاراته',coach_id:c.id,group:'بزرگسالان',weekdays:'شنبه و دوشنبه',starts_at:'17:00',ends_at:'18:00',member_ids:[m.id]})).data.record;
   await post('classes',{title:'غیرمجاز'},'member',403);
   await post('classes',{title:'زمان نامعتبر',discipline:'کاراته',coach_id:c.id,group:'الف',weekdays:'شنبه',starts_at:'19:00',ends_at:'18:00'},'coach',400);
   const exposed=(await req(member,'/api/academy/records/classes','GET',undefined,cookieM)).data.records[0];assert.equal(exposed.data.member_ids,undefined);
   await post('coaches',{coach_id:c2.id,discipline:'کاراته',title:'جعل مربی'},'coach',403);
   await post('coaches',{coach_id:c.id,discipline:'کاراته',title:'معرفی واقعی',bio:'معرفی ثبت‌شده توسط مربی'});
   const evaluation={coach_id:c.id,year:j.jy,month:j.jm,score:4,comment:'نظر خصوصی شاگرد'};
   const ev=(await post('evaluations',evaluation,'member')).data.record;
   await post('evaluations',evaluation,'member',409);
   await req(member,'/api/academy/records/evaluations','POST',evaluation,cookieM2,403);
   await req(member,'/api/academy/records/evaluations/'+ev.id,'PUT',evaluation,cookieM2,403);
   const aggregate=(await req(coach,'/api/academy/records/evaluations','GET',undefined,cookieC)).data.records;
   assert.deepEqual(aggregate,[{period:`${j.jy}/${j.jm}`,count:1,average:4}]);assert.ok(!JSON.stringify(aggregate).includes('نظر خصوصی'));
   assert.equal((await req(coach,'/api/academy/records/evaluations','GET',undefined,cookieC2)).data.records.length,0);
   for(const exercise of ['اسکوات','شنا','شکم','دو']){
     const challenge=(await post('challenges',{title:'چالش '+exercise,discipline:'کاراته',exercise,starts_on:'2026-11-01',ends_on:'2026-12-01',status:'باز'})).data.record;
     await post('challenge_results',{challenge_id:challenge.id,user_id:m.id,value:exercise==='دو'?15.5:20});
     await post('challenge_results',{challenge_id:challenge.id,user_id:m.id,value:20},'coach',409);
     await req(coach,'/api/academy/records/challenges/'+challenge.id,'DELETE',undefined,cookieC,409);
   }
   const monthly={user_id:m.id,year:j.jy,month:j.jm,overall:80};
   const score=(await post('monthly_scores',monthly)).data.record;
   await post('monthly_scores',{user_id:m2.id,year:j.jy,month:j.jm,overall:80});
   await post('monthly_scores',monthly,'coach',409);
   await post('monthly_scores',{...monthly,month:1.5},'coach',400);
   await post('monthly_scores',{...monthly,overall:101},'coach',400);
   assert.equal((await req(member,'/api/academy/records/monthly_scores','GET',undefined,cookieM)).data.records.length,1);
   assert.equal((await req(member,'/api/progress?year='+j.jy,'GET',undefined,cookieM)).data.progress[j.jm].overall,80);
   await post('discounts',{title:'تخفیف مصوب',discipline:'کاراته',year:j.jy,month:j.jm,top_rank:1,percent:10},'admin');
   const board=(await req(member,`/api/academy/leaderboard?discipline=${encodeURIComponent('کاراته')}&year=${j.jy}&month=${j.jm}`,'GET',undefined,cookieM)).data.rows;
   assert.equal(board.length,2);assert.deepEqual(board.map(r=>r.rank),[1,1]);assert.deepEqual(board.map(r=>r.discount_percent),[10,10]);assert.ok(!JSON.stringify(board).includes(m2.full_name));
   const exam=(await post('exams',{title:'آزمون ثبت‌شده',discipline:'کاراته',exam_type:'استعدادیابی',event_date:'2026-11-01'})).data.record;
   await post('exam_results',{exam_id:exam.id,user_id:m.id,score:75,note:'بازخورد خصوصی'});
   assert.equal((await req(member,'/api/academy/records/exam_results','GET',undefined,cookieM2)).data.records.length,0);
   await post('competitions',{title:'مسابقه ثبت‌شده',discipline:'کاراته',event_date:'2026-12-12',requirements:'مدارک اعلام‌شده'});
   await post('competitions',{title:'تاریخ غلط',discipline:'کاراته',event_date:'2026-02-30'},'coach',400);
   await post('honours',{title:'افتخار مستند تست',discipline:'کاراته',level:'ملی',athlete:'تیم آزمایش',event_date:'2026-11-01'});
   await post('sports',{title:'کاراته',description:'معرفی ثبت‌شده',video_url:'https://www.youtube.com/watch?v=dQw4w9WgXc',basics_url:'https://www.youtube.com/results?search_query=karate+kihon'});
   await post('sports',{title:'بوکس',video_url:'javascript:alert(1)'},'coach',400);
   await post('sports',{title:'بوکس',video_url:'https://evil.example/video'},'coach',400);
   await post('attendance',{class_id:cl.id,user_id:m.id,event_date:'2026-11-12',status:'حاضر'},'coach',403);
   await post('attendance',{class_id:cl.id,user_id:m.id,event_date:'2026-11-12',status:'حاضر'},'admin');
   await post('attendance',{class_id:cl.id,user_id:c.id,event_date:'2026-11-12',status:'حاضر'},'admin');
   await post('attendance',{class_id:cl.id,user_id:m2.id,event_date:'2026-11-12',status:'حاضر'},'admin',400);
   for(const kind of ['attendance','meetings','discounts']){
     await req(member,'/api/academy/records/'+kind,'GET',undefined,cookieM,403);
     await req(coach,'/api/academy/records/'+kind,'GET',undefined,cookieC,403);
     await req(member,'/api/academy/records/'+kind,'POST',{},cookieM,403);
     await req(coach,'/api/academy/records/'+kind,'POST',{},cookieC,403);
     assert.ok(Array.isArray((await req(coach,'/admin/api/records/'+kind,'GET',undefined,cookieA)).data.records));
   }
   for(const [base,cookie]of [[member,cookieM],[coach,cookieC]]){
     const restricted=(await req(base,'/api/academy/config','GET',undefined,cookie)).data.schema;
     for(const kind of ['attendance','meetings','discounts'])assert.equal(restricted[kind],undefined);
   }
   await post('meetings',{title:'جلسه مدیر',event_date:'2026-11-13',starts_at:'18:00'},'admin');
   const invoice=(await post('invoices',{user_id:m.id,title:'شهریه واقعی',amount:1000000,discount_percent:10,due_on:'2026-12-01',status:'پرداخت‌نشده',payable:1},'admin')).data.record;
   assert.equal(invoice.data.payable,900000);
   assert.equal((await req(member,'/api/academy/records/invoices','GET',undefined,cookieM2)).data.records.length,0);
   await post('invoices',{user_id:m.id,title:'رسید بدون پیگیری',amount:1000,discount_percent:0,due_on:'2026-12-01',status:'تأیید دستی'},'admin',400);
   const product=(await post('products',{title:'قمقمه',price:200000,stock:2},'admin')).data.record;
   const order=(await post('orders',{product_id:product.id,quantity:1,phone:'09121234567',address:'نشانی آزمایشی',total:1,status:'تحویل‌شده'},'member')).data.record;
   assert.equal(order.data.total,200000);assert.equal(order.data.status,'درخواست‌شده');
   await post('orders',{product_id:product.id,quantity:2,phone:'09121234567'},'member',409);
   assert.equal((await req(member,'/api/academy/records/orders','GET',undefined,cookieM2)).data.records.length,0);
   await req(coach,'/admin/api/orders/'+order.id+'/status','POST',{status:'لغوشده'},cookieA);
   await req(coach,'/admin/api/orders/'+order.id+'/status','POST',{status:'لغوشده'},cookieA,409);
   assert.equal(academy.record(product.id).data.stock,2,'cancellation restores stock exactly once');
   await post('nutrition',{weight:70,height:175,age:25,goal:'بهبود تغذیه',phone:'09121234567',consent:false},'member',400);
   const nutrition=(await post('nutrition',{weight:70,height:175,age:25,goal:'بهبود تغذیه',phone:'09121234567',conditions:'اطلاعات خصوصی سلامت',consent:true},'member')).data.record;
   assert.equal((await req(member,'/api/academy/records/nutrition','GET',undefined,cookieM2)).data.records.length,0);
   await req(member,'/api/academy/records/nutrition/'+nutrition.id,'PUT',nutrition.data,cookieM2,403);
   const token=(await req(coach,'/api/members/'+m.id+'/impersonate','POST',{},cookieC)).data.token;
   const impersonated=(await req(member,'/impersonate?token='+token,'GET',undefined,undefined,302)).cookie;
   await req(member,'/api/academy/records/nutrition','GET',undefined,impersonated,403);
   await req(coach,'/api/members/'+m.id,'DELETE',undefined,cookieC,409);
   await req(coach,'/admin/api/users','POST',{full_name:'مربی دوم جدید',username:'created-by-admin',password,role:'coach'},cookieA,201);
   await req(coach,'/admin/api/records/meetings','POST',{title:'CSRF'},cookieA,403,{'X-Academy-Request':'0'});
   await req(gateway,'/admin/api/records/meetings','POST',{title:'CSRF'},cookieA,403,{origin:'https://evil.example'});
   const edited={...db.publicUser(db.findById(m2.id)),active:false};
   await req(coach,'/admin/api/users/'+m2.id,'PUT',edited,cookieA);
   assert.ok((await req(coach,'/admin/api/people','GET',undefined,cookieA)).data.people.some(p=>p.id===m2.id&&!p.active));
   await req(coach,'/admin/api/users/'+m2.id,'PUT',{...edited,active:true},cookieA);
   await req(member,'/api/academy/records/evaluations/'+ev.id,'PUT',{...evaluation,score:5},cookieM);
   assert.equal((await req(coach,'/api/academy/records/evaluations','GET',undefined,cookieC)).data.records[0].average,5);
   await req(coach,'/admin/api/records/invoices/'+invoice.id,'PUT',{...invoice.data,status:'تأیید دستی',reference:'BANK-TEST-REF'},cookieA);
   await req(coach,'/admin/api/records/invoices/'+invoice.id,'DELETE',undefined,cookieA,409);
   const disposable=(await post('meetings',{title:'جلسه حذف‌شدنی تست',event_date:'2026-11-01',starts_at:'17:00'},'admin')).data.record;
   await req(coach,'/admin/api/records/meetings/'+disposable.id,'DELETE',undefined,cookieA);
   assert.ok((await req(coach,'/admin/api/audit','GET',undefined,cookieA)).data.rows.length>20);
   console.log('PASS API: zero demo startup, legacy quarantine/review, independent admin login, role/ownership/impersonation isolation, all feature CRUD, monthly score validation, tied leaderboard/discounts, invoices, stock/order cancellation and private nutrition');
   if(process.env.BROWSER==='1'){
     const {chromium}=require('playwright-core');const mod=require('@sparticuz/chromium');const binary=mod.default||mod;
     browser=await chromium.launch({executablePath:await binary.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
     const context=await browser.newContext();const errors=[];
     await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
     const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
     await page.goto(gateway+'/admin');await page.locator('#adminLogin').waitFor({state:'visible'});
     await page.locator('[name=username]').fill(admin.username);await page.locator('[name=password]').fill(password);await page.locator('#loginForm button').click();await page.locator('#academySession').waitFor({state:'visible'});
     for(const width of [320,390,768,1568]){
       await page.setViewportSize({width,height:900});
       assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'admin viewport must not overflow');
     }
     await page.locator('[data-kind="people"]').click();await page.locator(`[data-person-edit="${m.id}"]`).click();
     await page.locator('#field-phone').fill('09121230000');await page.locator('#saveRecord').click();await page.locator('#recordDialog').waitFor({state:'hidden'});
     assert.equal(db.findById(m.id).phone,'09121230000');
     await page.locator('[data-kind="meetings"]').click();await page.locator('#addRecord').click();await page.locator('#recordDialog').waitFor({state:'visible'});
     await page.locator('#field-title').fill('جلسه ایجادشده در مرورگر');await page.locator('#field-event_date').fill('2026-12-01');await page.locator('#field-starts_at').fill('16:00');await page.locator('#saveRecord').click();
     await page.locator('#recordDialog').waitFor({state:'hidden'});await page.getByRole('heading',{name:'جلسه ایجادشده در مرورگر'}).waitFor();
     const cm=cookieM.split('=');await context.addCookies([{name:cm[0],value:cm.slice(1).join('='),url:coach}]);
     await page.goto(member+'/academy#monthly_scores');await page.locator('#monthlyChart figure').waitFor();assert.equal(await page.locator('#monthlyChart figure').count(),1);
     await page.locator('[data-kind="exam_results"]').click();await page.locator('#actualChart figure').waitFor();assert.equal(await page.locator('#actualChart figure').count(),1);
     await page.locator('[data-kind="nutrition"]').click();await page.locator('#addRecord').click();await page.locator('#recordDialog').waitFor({state:'visible'});assert.equal(await page.locator('#field-consent').count(),1);await page.locator('#closeDialog').click();
     await page.goto(member+'/panel');await page.locator('.csw-card[data-front]').waitFor();await page.locator('.csw-card[data-front]').focus();await page.keyboard.press('Enter');await page.locator('#sportAcademyDetails').waitFor();assert.ok(await page.locator('.overlay').textContent().then(t=>t.includes('چهره‌های شناخته‌شده')));await page.locator('[data-close]').click();
     await page.locator('.stb').waitFor();
     await page.setViewportSize({width:320,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'member panel must not overflow');
     assert.equal(await page.locator('.stb-seg-ctl:visible').count(),0,'synthetic daily/weekly modes must not be shown');
     await page.waitForFunction(()=>document.querySelector('.stb-num')?.textContent==='—');
     assert.ok(!(await page.locator('#toastStackRoot').textContent()).includes('آزمون کمربند هفته آینده'));
     await page.goto(member+'/academy#orders');await page.locator('#academySession').waitFor({state:'visible'});
     for(const width of [320,390,768,1568]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'member viewport must not overflow');}
     assert.deepEqual(errors,[]);console.log('PASS BROWSER: actual admin form login/save, mounted member privacy/forms, actual-score-only yearly chart, sport card details, no synthetic graph modes/notifications, mobile/desktop viewport and no JS errors');
     await context.close();
   }
   // Check persisted records after the server stops. All access uses the same SQLite file.
   child.kill('SIGTERM');await once(child,'exit');
   assert.equal(academy.record(invoice.id).data.payable,900000);assert.equal(db.progressRow(m.id,j.jy,j.jm).overall,80);
 }finally{
   if(browser)await browser.close();if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}
   db.db.close();fs.rmSync(dir,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
