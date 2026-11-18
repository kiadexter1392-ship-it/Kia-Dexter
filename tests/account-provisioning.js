'use strict';
// Exercises server tools on an isolated temporary database, never on production.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dojo-accounts-'));
const env={...process.env, ARSLAN_DATA_DIR:dir, ARSLAN_DB:path.join(dir,'test.db'), RESET_DB:'0', DOJO_TEST_FIXTURES:'0'};
Object.assign(process.env,env);
const db=require('../shared/db'); require('../shared/academy');
const run=(script,role,vars={})=>spawnSync(process.execPath,[`scripts/${script}.js`,role],{cwd:path.join(__dirname,'..'),env:{...env,...vars},encoding:'utf8'});
try {
  const first='Test-Secret-For-Local-Only-1', second='Test-Secret-For-Local-Only-2';
  assert.equal(run('create-account','admin',{ACCOUNT_USERNAME:'admin-local',ACCOUNT_NAME:'Local admin',ACCOUNT_PASSWORD:first}).status,0);
  assert.equal(run('create-account','coach',{ACCOUNT_USERNAME:'coach-local',ACCOUNT_NAME:'Local coach',ACCOUNT_PASSWORD:first}).status,0);
  const admin=db.findByUsername('admin-local'),coach=db.findByUsername('coach-local');
  const session=db.createSession(coach.id,'coach',1);
  const wrong=run('reset-account-password','admin',{ACCOUNT_USERNAME:'coach-local',ACCOUNT_PASSWORD:second});
  assert.notEqual(wrong.status,0);assert.ok(db.verifyPassword(first,db.findById(coach.id).password_hash,db.findById(coach.id).password_salt));
  assert.ok(db.get('SELECT token FROM sessions WHERE token=?',session.token));
  assert.notEqual(run('reset-account-password','coach',{ACCOUNT_USERNAME:'coach-local',ACCOUNT_PASSWORD:'short'}).status,0);
  assert.notEqual(run('reset-account-password','coach',{ACCOUNT_USERNAME:'admin-local',ACCOUNT_PASSWORD:second}).status,0);
  assert.notEqual(run('reset-account-password','coach',{ACCOUNT_USERNAME:'unknown-user',ACCOUNT_PASSWORD:second}).status,0);
  db.run('UPDATE users SET active=0 WHERE id=?',coach.id);
  assert.notEqual(run('reset-account-password','coach',{ACCOUNT_USERNAME:'coach-local',ACCOUNT_PASSWORD:second}).status,0);
  db.run('UPDATE users SET active=1 WHERE id=?',coach.id);
  const result=run('reset-account-password','coach',{ACCOUNT_USERNAME:'coach-local',ACCOUNT_PASSWORD:second});
  assert.equal(result.status,0,result.stderr);assert.ok(!result.stdout.includes(second));assert.ok(!result.stderr.includes(second));
  const after=db.findById(coach.id);assert.equal(after.id,coach.id);assert.ok(db.verifyPassword(second,after.password_hash,after.password_salt));
  assert.ok(!db.verifyPassword(first,after.password_hash,after.password_salt));assert.equal(db.get('SELECT token FROM sessions WHERE token=?',session.token),null);
  assert.ok(db.verifyPassword(first,db.findById(admin.id).password_hash,db.findById(admin.id).password_salt));
  assert.equal(run('reset-account-password','admin',{ACCOUNT_USERNAME:'admin-local',ACCOUNT_PASSWORD:second}).status,0);
  assert.ok(db.verifyPassword(second,db.findById(admin.id).password_hash,db.findById(admin.id).password_salt));
  assert.notEqual(run('create-account','coach',{ACCOUNT_USERNAME:'coach-local',ACCOUNT_NAME:'Local coach',ACCOUNT_PASSWORD:first}).status,0);
  console.log('PASS: private account provisioning, distinct roles, safe reset, session revocation and collision protection');
} finally {db.db.close();fs.rmSync(dir,{recursive:true,force:true});}
