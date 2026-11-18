'use strict';
// No server needed: prove in-flight deduplication does not become a stale/auth cache.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const calls=[];
const window={Jalali:{faNum:String}};
const context=vm.createContext({window,document:{addEventListener(){}},location:{pathname:'/member/panel'},fetch:(url,opts)=>new Promise((resolve,reject)=>calls.push({url,opts,resolve,reject})),URL});
vm.runInContext(fs.readFileSync(require.resolve('../shared/public/ui/ui.js'),'utf8'),context);
const api=window.UI.api;
function finish(call,data={ok:true}) {call.resolve({ok:true,json:async()=>data});}
(async()=>{
  const first=api('/api/me'),second=api('/api/me');assert.equal(first,second);assert.equal(calls.length,1);assert.equal(calls[0].url,'/member/api/me');
  finish(calls[0],{user:{id:1}});await Promise.all([first,second]);
  const fresh=api('/api/me');assert.equal(calls.length,2,'completed private responses must not be cached');finish(calls[1]);await fresh;
  const old=api('/api/me'),logout=api('/api/logout',{method:'POST'}),afterLogout=api('/api/me');
  assert.notEqual(old,afterLogout,'mutations immediately invalidate coalescing');assert.equal(calls.length,5);
  finish(calls[2]);finish(calls[3]);finish(calls[4],{user:null});await Promise.all([old,logout,afterLogout]);
  const failed=api('/api/failing');calls[5].reject(new Error('network offline'));await assert.rejects(failed,/offline/);
  const retry=api('/api/failing');assert.equal(calls.length,7,'failure must not poison future requests');finish(calls[6]);await retry;
  const a=api('/api/plans'),b=api('/api/announcements');assert.equal(calls.length,9,'different paths remain independent');finish(calls[7]);finish(calls[8]);await Promise.all([a,b]);
  console.log('PASS REQUESTS: simultaneous reads coalesced, no completed/auth/error response cache, fresh reads after writes/logout, correct same-origin mounts');
})().catch(err=>{console.error(err);process.exitCode=1;});
