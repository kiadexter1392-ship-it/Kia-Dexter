'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dojo-academy-migration-'));
const env={...process.env,ARSLAN_DATA_DIR:dir,ARSLAN_DB:path.join(dir,'legacy.db'),RESET_DB:'0',DOJO_TEST_FIXTURES:'0'};
function run(code){const r=spawnSync(process.execPath,['-e',code],{cwd:path.join(__dirname,'..'),env,encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout;}
try{
 run(`
 const db=require('./shared/db');
 const u=db.createUser({full_name:'حساب قدیمی واقعی',username:'retained',password:'migration-private-password',discipline:'کاراته',blood_group:'A+'});
 db.saveProgress({user_id:u.id,year:1405,month:8,overall:97},null);
 const {token}=db.createSession(u.id,'member');
 db.run('UPDATE users SET notes=? WHERE id=?',token,u.id);
 for(const table of ['users','progress','plans','plan_assignments','announcements','announcement_reads','activity','notifications','self_reports']) {
   db.db.exec('DROP TRIGGER IF EXISTS verified_new_'+table);
   db.db.exec('ALTER TABLE '+table+' DROP COLUMN verified');
 }
 db.db.exec('ALTER TABLE sessions DROP COLUMN impersonated');
 db.db.close();
 `);
 run(`
 const assert=require('node:assert/strict'),db=require('./shared/db');require('./shared/academy');
 require('./shared/seed').seedIfEmpty();
 const u=db.findByUsername('retained');
 assert.ok(db.verifyPassword('migration-private-password',u.password_hash,u.password_salt));
 assert.equal(db.get('SELECT COUNT(*) c FROM users').c,1);
 assert.equal(u.blood_group,'A+');assert.equal(u.verified,0);
 assert.equal(db.sessionUser(u.notes,'member').id,u.id);
 assert.equal(db.stats().members,0);assert.deepEqual(db.progressYear(u.id,1405).rows,[]);
 assert.equal(db.get('SELECT COUNT(*) c FROM progress').c,1,'raw history must be retained');
 db.updateUser(u.id,{phone:'09121234567'});assert.equal(db.findById(u.id).verified,0,'ordinary editing cannot approve an imported identity');
 db.run('UPDATE users SET verified=1 WHERE id=?',u.id);assert.equal(db.stats().members,1);assert.equal(db.stats().thisMonth,0);
 db.run('UPDATE progress SET verified=1 WHERE user_id=?',u.id);assert.equal(db.progressYear(u.id,1405).months[8].overall,97);
 db.db.close();
 `);
 run(`const assert=require('node:assert/strict'),db=require('./shared/db');require('./shared/academy');require('./shared/seed').seedIfEmpty();assert.equal(db.get('SELECT COUNT(*) c FROM users').c,1);assert.equal(db.progressYear(db.findByUsername('retained').id,1405).months[8].overall,97);db.db.close();`);
 assert.ok(fs.readdirSync(path.join(dir,'backups')).some(n=>n.endsWith('.db')),'legacy migration must create a consistent backup');
 console.log('PASS MIGRATION: pre-verification schema upgrades without deleting records, changing passwords/sessions or publishing unknown scores; explicit approvals survive subsequent process restarts');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
