'use strict';
const assert = require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dojo-wellness-'));
Object.assign(process.env,{ARSLAN_DATA_DIR:dir,ARSLAN_DB:path.join(dir,'test.db'),RESET_DB:'0',DOJO_TEST_FIXTURES:'0'});
const {generateMealPlan}=require('../shared/member-wellness');
const db=require('../shared/db');
(async()=>{
  try {
    let args;
    const mock=async(url,options)=>{args={url,options};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({title:'برنامه',summary:'پیشنهاد عمومی',meals:[{title:'صبحانه',foods:'نان و پنیر'}]})}]}}]})};};
    const result=await generateMealPlan({meals:3,goal:'تغذیه متعادل',foods:'',restrictions:'',notes:''},'test-only-secret',mock);
    assert.equal(result.meals[0].foods,'نان و پنیر');
    assert.equal(args.options.headers['x-goog-api-key'],'test-only-secret');assert.ok(!args.url.includes('test-only-secret'));
    await assert.rejects(generateMealPlan({meals:3,goal:'x',foods:'',restrictions:'',notes:''},'test-only-secret',async()=>({ok:true,json:async()=>({candidates:[]})})));
    await assert.rejects(generateMealPlan({meals:3,goal:'x',foods:'',restrictions:'',notes:''},'test-only-secret',async()=>({ok:false})));
    console.log('PASS: mock Gemini validation, private header and upstream failure handling');
  } finally {db.db.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exitCode=1});
