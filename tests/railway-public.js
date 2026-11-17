'use strict';
// Public deployment verification. Never creates accounts, seeds samples or changes club data.
const assert = require('node:assert/strict');
const coach = (process.env.COACH_URL || 'https://kia-dexter-production-cd4745b0.up.railway.app').replace(/\/$/, '');
const member = (process.env.MEMBER_URL || coach + '/member').replace(/\/$/, '');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function get(url) {
  return fetch(url, { redirect:'manual', signal:AbortSignal.timeout(15000), headers:{'Cache-Control':'no-cache'} });
}
(async () => {
  const deadline = Date.now() + Number(process.env.DEPLOY_WAIT_MS || 300000);
  let available = false, lastError;
  do {
    try {
      const [c,m] = await Promise.all([get(coach+'/api/config'), get(member+'/api/config')]);
      const cc = await c.json(), mc = await m.json();
      assert.equal(c.status,200); assert.equal(m.status,200);
      assert.equal(cc.site,'coach'); assert.equal(mc.site,'member');
      assert.equal(cc.features?.academy,'v1'); assert.equal(mc.features?.academy,'v1');
      if (process.env.EXPECTED_SHA) assert.equal(cc.release,process.env.EXPECTED_SHA);
      assert.equal(cc.features.sampleData,false); assert.equal(mc.features.sampleData,false);
      assert.equal(cc.peerSiteUrl,'/member/'); assert.equal(mc.peerSiteUrl,'/');
      available = true; console.log('PASS LIVE: new Railway release, separate coach/student routes and no automatic sample data:',cc.release);
      break;
    } catch(error) { lastError=error.message; }
    console.log('Waiting for the new public Railway release; last check:',lastError);
    await delay(10000);
  } while(Date.now()<deadline);
  assert.ok(available,'Railway public domain did not expose the new academy release: '+lastError);
  const admin = await get(coach+'/admin'); assert.equal(admin.status,200);
  const adminHtml=await admin.text();assert.match(adminHtml,/id="adminLogin"/);
  assert.match(adminHtml,/ui\/fonts\/vazirmatn\.css/,'new management page must use the local Persian font');
  assert.match(adminHtml,/id="navSearch"/,'new grouped navigation must be deployed');
  const font=await get(coach+'/ui/fonts/vazirmatn-arabic-wght-normal.woff2');assert.equal(font.status,200);
  assert.equal(Buffer.from(await font.arrayBuffer()).subarray(0,4).toString(),'wOF2','public font URL must serve a real WOFF2, not HTML');
  for(const [base,route] of [[coach,'/admin/api/config'],[coach,'/admin/api/records/nutrition'],[coach,'/admin/api/records/invoices'],[member,'/api/academy/records/nutrition'],[member,'/api/academy/records/monthly_scores']]) {
    assert.equal((await get(base+route)).status,401,'Private data must not be readable anonymously: '+route);
  }
  for(const base of [coach,member]) for(const asset of ['/ui/academy.js','/ui/academy.css','/ui/sport-catalog.js','/ui/MagnifyingDock.js']) assert.equal((await get(base+asset)).status,200,base+asset);
  const landing=await (await get(member+'/')).text(); assert.match(landing,/href="\.\.\/admin"/); assert.match(landing,/name="birth_date"/);
  if(process.env.BROWSER==='1') {
    const {chromium}=require('playwright-core'), mod=require('@sparticuz/chromium'), binary=mod.default||mod;
    const browser=await chromium.launch({executablePath:await binary.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
    try {
      const page=await browser.newPage(); const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(coach).origin?r.continue():r.abort());
      await page.goto(coach+'/admin',{waitUntil:'domcontentloaded'}); await page.locator('#adminLogin').waitFor({state:'visible'});
      assert.equal(await page.locator('#academySession').isVisible(),false);
      await page.evaluate(()=>document.fonts.ready);
      assert.ok(await page.evaluate(()=>document.fonts.check('600 16px Vazirmatn','مدیریت آکادمی')),'Persian font must really load on Railway');
      assert.ok(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('/ui/fonts/vazirmatn-arabic-wght-normal.woff2'))),'font must come from the deployed local asset');
      for(const width of [320,390,768,1568]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
      await page.goto(member+'/',{waitUntil:'domcontentloaded'});await page.locator('#loginForm').waitFor({state:'visible'});
      assert.deepEqual(errors,[]);
      console.log('PASS LIVE BROWSER: real Railway admin login and student landing load in Chromium at mobile/desktop widths, without public access to private data or JavaScript errors.');
    }finally{await browser.close();}
  }
  console.log('PASS LIVE: admin entry/assets and anonymous data protection. Authenticated workflows require real production accounts; preview credentials are never copied.');
  console.log('Coach:',coach+'/');console.log('Students:',member+'/');console.log('Administration:',coach+'/admin');
})().catch(error=>{console.error(error);process.exitCode=1;});
