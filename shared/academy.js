'use strict';
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const authSession = require('./auth-session');
const schema = require('./academy-schema');
const { todayJalali, enNum } = require('./jalali');
const { rateLimit } = require('./server');
const SPORTS = ['کاراته','کراسفیت','بوکس','ژیمناستیک','موی تای'];
// Administrative operations never appear in student/coach services, even read-only.
const ADMIN_ONLY = new Set(['attendance','meetings','discounts']);
const PUBLIC = new Set(['sports','coaches','honours','competitions','classes','challenges','challenge_results','exams','products']);
const REF = { challenge_id: 'challenges', exam_id: 'exams', class_id: 'classes', product_id: 'products' };
const ADMIN_COOKIE = 'dojo_admin_session';
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function transaction(fn) {
  db.execWithRetry('BEGIN IMMEDIATE');
  try { const result = fn(); db.db.exec('COMMIT'); return result; }
  catch (error) { db.db.exec('ROLLBACK'); throw error; }
}
function init() {
  db.execWithRetry(`
    CREATE TABLE IF NOT EXISTS academy_admins (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS academy_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, user_id INTEGER REFERENCES users(id),
      slot TEXT, data TEXT NOT NULL, author_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(kind, slot));
    CREATE INDEX IF NOT EXISTS academy_kind ON academy_records(kind, user_id);
    CREATE TABLE IF NOT EXISTS academy_links (record_id INTEGER NOT NULL REFERENCES academy_records(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES academy_records(id) ON DELETE RESTRICT, PRIMARY KEY(record_id,target_id));
    CREATE TABLE IF NOT EXISTS academy_record_people (record_id INTEGER NOT NULL REFERENCES academy_records(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, PRIMARY KEY(record_id,user_id));
    CREATE TABLE IF NOT EXISTS academy_audit (id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL, record_id INTEGER, kind TEXT, created_at TEXT NOT NULL);
  `);
}
init();
function record(id, kind) {
  if (!Number.isSafeInteger(Number(id)) || Number(id)<1) fail('شناسه نامعتبر است');
  const row = db.get('SELECT * FROM academy_records WHERE id=?', Number(id));
  if (!row || (kind && row.kind !== kind)) fail('رکورد مرجع پیدا نشد', 404);
  return { ...row, data: JSON.parse(row.data) };
}
function records(kind, userId) {
  const rows=userId===undefined?db.all('SELECT * FROM academy_records WHERE kind=? ORDER BY id DESC',kind):db.all('SELECT * FROM academy_records WHERE kind=? AND user_id=? ORDER BY id DESC',kind,userId);
  return rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
}
function staff(role) { return role === 'coach' || role === 'admin'; }
function canRead(kind, role) {
  if (!schema[kind]) return false;
  if (role === 'admin') return true;
  if (ADMIN_ONLY.has(kind)) return false;
  return (role === 'coach' && !['nutrition','orders','invoices'].includes(kind)) || role === 'member';
}
function visible(kind, actor, role) {
  if (!schema[kind] || !canRead(kind, role)) fail('دسترسی مجاز نیست', 403);
  if (role === 'coach' && kind === 'evaluations') {
    const own = records(kind).filter(r => r.data.coach_id === actor.id);
    const groups = new Map();
    for (const r of own) {
      const key = `${r.data.year}/${r.data.month}`;
      const g = groups.get(key) || { period: key, count: 0, total: 0 };
      g.count++; g.total += r.data.score; groups.set(key, g);
    }
    // No individual reviews or names are revealed to the evaluated coach.
    return [...groups.values()].map(g => ({ period: g.period, count: g.count, average: g.total / g.count }));
  }
  const own=role==='member' && !PUBLIC.has(kind);
  let rows = kind === 'monthly_scores' ? (own?db.all('SELECT * FROM progress WHERE verified=1 AND user_id=? ORDER BY year DESC,month DESC',actor.id):db.all('SELECT * FROM progress WHERE verified=1 ORDER BY year DESC,month DESC')).map(r => ({ id:r.id, user_id:r.user_id, data:{...r, overall:db.computeOverall(r)}, created_at:r.updated_at, updated_at:r.updated_at })) : records(kind,own?actor.id:undefined);
  const coachNames=new Map();
  return rows.map(r => {
    const output = { id: r.id, data: { ...r.data }, created_at: r.created_at, updated_at: r.updated_at };
    if (r.data.coach_id) {
      if(!coachNames.has(r.data.coach_id))coachNames.set(r.data.coach_id,db.findById(r.data.coach_id)?.full_name || 'ثبت نشده');
      output.data.coach_name=coachNames.get(r.data.coach_id);
    }
    if (role === 'member' && kind === 'classes') delete output.data.member_ids;
    if (role === 'member' && kind === 'challenge_results') {
      delete output.data.user_id; delete output.data.note;
      output.data.participant = `شرکت‌کننده ${r.id}`; output.data.is_me = r.data.user_id === actor.id;
    }
    return output;
  });
}
function validate(kind, raw, actor, role) {
  const def = schema[kind];
  if (!def || !def.write.includes(role)) fail('اجازهٔ ثبت این بخش را ندارید', 403);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('فرم نامعتبر است');
  const data = {}, people = new Set(), links = new Set();
  for (const [key, field] of Object.entries(def.fields)) {
    let value = raw[key];
    if (field.type === 'checkbox') {
      if (value !== true && value !== false && value !== undefined) fail('مقدار تأیید نامعتبر است');
      value = value === true;
      if (field.required && !value) fail('تأیید رضایت لازم است');
    } else if (field.type === 'members') {
      value = value || [];
      if (!Array.isArray(value) || value.length > 500) fail('فهرست شاگردان معتبر نیست');
      value = [...new Set(value.map(Number))];
      for (const id of value) {
        const u = db.findById(id);
        if (!u || u.role !== 'member' || !u.active || !u.verified) fail('شاگرد کلاس معتبر نیست');
        people.add(id);
      }
    } else if (['number','member','coach','person',...Object.values(REF)].includes(field.type)) {
      if (value === '' || value === undefined || value === null) { if (field.required) fail(`${field.label} لازم است`); value = null; }
      else {
        value = Number(enNum(String(value)));
        if (!Number.isFinite(value)) fail(`${field.label} باید عدد باشد`);
        if (field.type === 'number') {
          if (value < field.min || value > field.max) fail(`${field.label} خارج از بازه است`);
          if (['year','month','top_rank','percent','quantity','stock','discount_percent','amount','price','age'].includes(key) && !Number.isInteger(value)) fail(`${field.label} باید صحیح باشد`);
        } else {
          if (!Number.isSafeInteger(value) || value < 1) fail('شناسه نامعتبر است');
          if (['member','coach','person'].includes(field.type)) {
            const u = db.findById(value);
            if (!u || !u.active || !u.verified || db.get('SELECT user_id FROM academy_admins WHERE user_id=?',u.id) || (field.type !== 'person' && u.role !== field.type)) fail(`${field.label} معتبر نیست`);
            people.add(value);
          } else { record(value, field.type); links.add(value); }
        }
      }
    } else {
      if (value !== undefined && value !== null && typeof value !== 'string') fail(`${field.label} معتبر نیست`);
      value = String(value || '').trim();
      if (value.length > (field.type === 'textarea' ? 5000 : 1000)) fail(`${field.label} طولانی است`);
      if (field.required && !value) fail(`${field.label} لازم است`);
      if (value && field.type === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail('تاریخ معتبر نیست');
      }
      if (value && field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('ساعت معتبر نیست');
      if (field.type === 'select' && !field.options.includes(value)) fail('گزینه معتبر نیست');
      if (field.type === 'sport' && !SPORTS.includes(value)) fail('رشته معتبر نیست');
      if (value && field.type === 'url') {
        if (key === 'image_url' && /^\/images\/[a-zA-Z0-9._/-]+$/.test(value) && !value.includes('..')) { /* local approved asset */ }
        else {
          let parsed; try { parsed = new URL(value); } catch { fail('نشانی وب معتبر نیست'); }
          if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail('فقط نشانی امن HTTPS مجاز است');
          if (['video_url','basics_url'].includes(key) && !['youtube.com','www.youtube.com','youtu.be'].includes(parsed.hostname)) fail('ویدیو باید لینک یوتیوب باشد');
        }
      }
      if (field.type === 'tel' && !/^[+\d\s-]{7,20}$/.test(enNum(value))) fail('تلفن معتبر نیست');
    }
    data[key] = value;
  }
  if (kind === 'coaches' && role === 'coach' && data.coach_id !== actor.id) fail('فقط معرفی خودتان قابل ثبت است',403);
  if (kind === 'classes' && data.starts_at >= data.ends_at) fail('ساعت پایان باید پس از شروع باشد');
  if (kind === 'challenges' && data.starts_on > data.ends_on) fail('تاریخ پایان باید پس از شروع باشد');
  const today=new Date().toISOString().slice(0,10);
  if (['honours','attendance'].includes(kind) && data.event_date>today) fail('ثبت نتیجه یا حضور برای تاریخ آینده مجاز نیست');
  if (kind === 'monthly_scores') { const j=todayJalali(); if(data.year>j.jy||(data.year===j.jy&&data.month>j.jm))fail('نمرهٔ ماه آینده هنوز قابل ثبت نیست'); }
  if (kind === 'invoices' && data.status === 'تأیید دستی' && !data.reference) fail('برای تأیید پرداخت شماره پیگیری لازم است');
  if (kind === 'evaluations') {
    const j = todayJalali();
    if (data.year !== j.jy || data.month !== j.jm || !Number.isInteger(data.score)) fail('ارزیابی فقط برای ماه جاری و امتیاز صحیح مجاز است');
    const assigned = records('classes').some(r => r.data.coach_id === data.coach_id && r.data.member_ids.includes(actor.id));
    if (!assigned) fail('فقط مربی کلاس خودتان قابل ارزیابی است', 403);
  }
  if (kind === 'challenge_results') {
    const c = record(data.challenge_id, 'challenges').data;
    const u = db.findById(data.user_id);
    if (c.starts_on>today) fail('چالش هنوز شروع نشده است');
    if (u.discipline !== c.discipline) fail('رشتهٔ شاگرد و چالش باید یکسان باشد');
    if (c.exercise !== 'دو' && !Number.isInteger(data.value)) fail('تعداد تکرار باید صحیح باشد');
  }
  if (kind === 'exam_results') {
    const exam = record(data.exam_id, 'exams').data;
    if (exam.event_date>today)fail('آزمون هنوز برگزار نشده است');
    if (db.findById(data.user_id).discipline !== exam.discipline) fail('رشتهٔ آزمون و شاگرد باید یکسان باشد');
  }
  if (kind === 'attendance') {
    const c = record(data.class_id, 'classes').data;
    if (data.user_id !== c.coach_id && !c.member_ids.includes(data.user_id)) fail('این فرد عضو کلاس نیست');
  }
  return { data, people, links };
}
function save(kind, raw, actor, role, id) {
  return transaction(() => {
    if (kind === 'monthly_scores') {
      const { data } = validate(kind,raw,actor,role);
      if (!Number.isInteger(data.year) || !Number.isInteger(data.month)) fail('ماه و سال باید صحیح باشند');
      const existing = db.progressRow(data.user_id,data.year,data.month);
      if (!id && existing && existing.verified) fail('این ماه قبلاً ثبت شده؛ رکورد قبلی را ویرایش کنید',409);
      if (id && (!existing || existing.id !== id)) fail('شاگرد و دوره در ویرایش قابل تغییر نیستند',409);
      const saved=db.saveProgress(data,actor.id);
      db.run('INSERT INTO academy_audit(actor_id,action,record_id,kind,created_at) VALUES (?,?,?,?,?)',actor.id,id?'update':'create',saved.id,kind,db.now());
      return {id:saved.id,data:saved};
    }
    let old;
    if (id) {
      old = record(id, kind);
      if (role === 'coach' && kind === 'coaches' && old.data.coach_id !== actor.id) fail('ویرایش معرفی مربی دیگر مجاز نیست',403);
      if (role === 'member' && old.user_id !== actor.id) fail('دسترسی مجاز نیست', 403);
      if (kind === 'orders') fail('سفارش پس از ثبت فقط توسط مدیر تعیین وضعیت می‌شود', 409);
    }
    const { data, people, links } = validate(kind, raw, actor, role);
    const userId = schema[kind].own && role === 'member' ? actor.id : (data.user_id || null);
    let slot = null;
    if (kind === 'evaluations') slot = `${actor.id}:${data.coach_id}:${data.year}:${data.month}`;
    if (kind === 'exam_results') slot = `${data.user_id}:${data.exam_id}`;
    if (kind === 'challenge_results') slot = `${data.user_id}:${data.challenge_id}`;
    if (kind === 'attendance') slot = `${data.user_id}:${data.class_id}:${data.event_date}`;
    if (kind === 'sports') slot = data.title;
    if (kind === 'coaches') slot = `${data.coach_id}:${data.discipline}`;
    if (slot && db.get('SELECT id FROM academy_records WHERE kind=? AND slot=? AND id!=?', kind, slot, id || 0)) fail('این ثبت تکراری است؛ رکورد قبلی را ویرایش کنید', 409);
    if (kind === 'invoices') data.payable = Math.round(data.amount * (100-data.discount_percent) / 100);
    if (kind === 'orders') {
      const product = record(data.product_id, 'products');
      if (data.quantity > product.data.stock) fail('موجودی کافی نیست', 409);
      data.product_title = product.data.title; data.unit_price = product.data.price;
      data.total = data.quantity * product.data.price; data.status = 'درخواست‌شده';
      product.data.stock -= data.quantity;
      db.run('UPDATE academy_records SET data=?,updated_at=? WHERE id=?', JSON.stringify(product.data), db.now(), product.id);
    }
    const ts = db.now();
    if (id) db.run('UPDATE academy_records SET user_id=?,slot=?,data=?,updated_at=? WHERE id=?', userId, slot, JSON.stringify(data), ts, id);
    else id = Number(db.run('INSERT INTO academy_records(kind,user_id,slot,data,author_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', kind,userId,slot,JSON.stringify(data),actor.id,ts,ts).lastInsertRowid);
    db.run('DELETE FROM academy_links WHERE record_id=?', id);
    db.run('DELETE FROM academy_record_people WHERE record_id=?', id);
    for (const target of links) db.run('INSERT INTO academy_links VALUES (?,?)', id, target);
    if (userId) people.add(userId);
    for (const user of people) db.run('INSERT INTO academy_record_people VALUES (?,?)', id, user);
    db.run('INSERT INTO academy_audit(actor_id,action,record_id,kind,created_at) VALUES (?,?,?,?,?)',actor.id,old ? 'update' : 'create',id,kind,ts);
    return { id, data };
  });
}
function adminUser(ctx) {
  return authSession.restore(ctx, ADMIN_COOKIE, 'admin', user => !!db.get('SELECT user_id FROM academy_admins WHERE user_id=?',user.id));
}
function paymentPortal() {
  const raw = process.env.PAYMENT_PORTAL_URL || '';
  try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
function mount(app, options) {
  const admin = options.admin === true;
  const base = admin ? '/admin/api' : '/api/academy';
  const roleFor = () => admin ? 'admin' : options.role;
  function auth(ctx) {
    const user = admin ? adminUser(ctx) : options.user(ctx);
    if (!user || (!admin && user.role !== options.role)) fail('ابتدا وارد پنل مربوط شوید', 401);
    if (!admin && user.impersonated) fail('برای خدمات آکادمی و اطلاعات خصوصی، ورود مستقیم شاگرد لازم است',403);
    return user;
  }
  function mutating(ctx) {
    const origin = ctx.req.headers.origin;
    if (ctx.req.headers['x-academy-request'] !== '1' || (origin && new URL(origin).host !== (ctx.req.headers['x-dojo-origin-host'] || ctx.req.headers.host))) fail('درخواست امن معتبر نیست',403);
  }
  const pagePath = admin ? '/admin' : '/academy';
  function page(ctx) {
    if (!admin && !options.user(ctx)) return ctx.redirect('./');
    const requestedPrefix = ctx.req.headers['x-dojo-mount'] || '';
    const prefix = ['', '/coach', '/member'].includes(requestedPrefix) ? requestedPrefix : '';
    const html = fs.readFileSync(path.join(__dirname,'public','academy.html'),'utf8').replaceAll('__ASSET_BASE__', prefix);
    ctx.text(html,200,'text/html; charset=utf-8');
  }
  app.get(pagePath, page); app.get(pagePath+'/',page);
  if (admin) {
    app.post(base+'/login', ctx => {
      mutating(ctx);
      if (!rateLimit('academy-admin:'+ctx.req.socket.remoteAddress,5,300000)) fail('تعداد تلاش زیاد است؛ بعداً تلاش کنید',429);
      const user = db.findByUsername(String(ctx.body.username || '').trim());
      if (!user || !user.active || !db.get('SELECT user_id FROM academy_admins WHERE user_id=?',user.id) || !db.verifyPassword(ctx.body.password,user.password_hash,user.password_salt)) fail('نام کاربری یا رمز مدیر صحیح نیست',401);
      authSession.signIn(ctx, user.id, 'admin', ADMIN_COOKIE);
      ctx.json({ok:true});
    });
    app.post(base+'/logout', ctx => { mutating(ctx); authSession.signOut(ctx, ADMIN_COOKIE, 'admin'); ctx.json({ok:true}); });
  }
  app.get(base+'/config', ctx => {
    const user = auth(ctx), role = roleFor();
    const defs = Object.fromEntries(Object.entries(schema).filter(([k]) => canRead(k,role)).map(([k,v]) => [k,{ ...v, writable:v.write.includes(role) }]));
    ctx.json({ ok:true, user: {id:user.id,full_name:user.full_name}, role, schema:defs, sports:SPORTS, ...todayJalali(), paymentPortal:paymentPortal() });
  });
  app.get(base+'/people', ctx => {
    const user = auth(ctx), role = roleFor();
    let people = db.all(`SELECT * FROM users WHERE verified=1 ${role==='admin'?'':'AND active=1'} AND id NOT IN (SELECT user_id FROM academy_admins) ORDER BY full_name`);
    if (role === 'member') {
      const coaches = new Set(records('classes').filter(r => r.data.member_ids.includes(user.id)).map(r => r.data.coach_id));
      people = people.filter(p => p.id === user.id || (p.role === 'coach' && coaches.has(p.id)));
      ctx.json({ok:true,people:people.map(p => ({id:p.id,full_name:p.full_name,role:p.role,discipline:p.discipline}))});
    } else ctx.json({ok:true,people:people.map(db.publicUser)});
  });
  app.get(base+'/records/:kind',ctx => { const u=auth(ctx); ctx.json({ok:true,records:visible(ctx.params.kind,u,roleFor())}); });
  app.post(base+'/records/:kind',ctx => { mutating(ctx); const u=auth(ctx); ctx.json({ok:true,record:save(ctx.params.kind,ctx.body,u,roleFor())},201); });
  app.put(base+'/records/:kind/:id',ctx => { mutating(ctx); const u=auth(ctx); ctx.json({ok:true,record:save(ctx.params.kind,ctx.body,u,roleFor(),Number(ctx.params.id))}); });
  app.delete(base+'/records/:kind/:id',ctx => {
    mutating(ctx); const u=auth(ctx), kind=ctx.params.kind, role=roleFor();
    if (!schema[kind] || !schema[kind].write.includes(role) || !staff(role)) fail('حذف مجاز نیست',403);
    if (kind==='monthly_scores') {
      if (!db.get('SELECT id FROM progress WHERE id=?',Number(ctx.params.id))) fail('نتیجه پیدا نشد',404);
      transaction(()=>{db.deleteProgress(ctx.params.id);db.run('INSERT INTO academy_audit(actor_id,action,record_id,kind,created_at) VALUES (?,?,?,?,?)',u.id,'delete',Number(ctx.params.id),kind,db.now());});
      return ctx.json({ok:true});
    }
    const r=record(ctx.params.id,kind);
    if (kind==='invoices' && r.data.status==='تأیید دستی') fail('حذف سابقهٔ پرداخت مجاز نیست',409);
    if (db.get('SELECT record_id FROM academy_links WHERE target_id=?',r.id)) fail('این رکورد در بخش دیگری استفاده شده است',409);
    transaction(() => { db.run('DELETE FROM academy_records WHERE id=?',r.id); db.run('INSERT INTO academy_audit(actor_id,action,record_id,kind,created_at) VALUES (?,?,?,?,?)',u.id,'delete',r.id,kind,db.now()); });
    ctx.json({ok:true});
  });
  app.get(base+'/leaderboard',ctx => {
    const u=auth(ctx), year=Number(ctx.query.year), month=Number(ctx.query.month), discipline=ctx.query.discipline;
    if (!Number.isInteger(year)||year<1300||year>1600||!Number.isInteger(month)||month<1||month>12||!SPORTS.includes(discipline)) fail('دوره و رشته را انتخاب کنید');
    const rows=db.all(`SELECT p.*,u.full_name FROM progress p JOIN users u ON u.id=p.user_id WHERE p.verified=1 AND u.verified=1 AND u.active=1 AND u.role='member' AND u.discipline=? AND p.year=? AND p.month=?`,discipline,year,month)
      .map(r=>({...r,score:db.computeOverall(r)})).filter(r=>r.score!==null).sort((a,b)=>b.score-a.score||a.user_id-b.user_id);
    let rank=0, prev=null;
    const rules=records('discounts').filter(r=>r.data.discipline===discipline&&r.data.year===year&&r.data.month===month);
    ctx.json({ok:true,source:'نمرهٔ کل ثبت‌شده و تأییدشدهٔ آزمون ماهانه؛ رتبه‌های مساوی مشترک‌اند',rows:rows.map((r,i)=>{
      if(prev!==r.score) rank=i+1; prev=r.score;
      const percent=Math.max(0,...rules.filter(rule=>rank<=rule.data.top_rank).map(rule=>rule.data.percent));
      return {rank,participant:roleFor()==='member'?(r.user_id===u.id?'شما':`ورزشکار ${i+1}`):r.full_name,score:r.score,discount_percent:percent};
    })});
  });
  if (admin) {
    app.get(base+'/review',ctx=>{auth(ctx); const tables=['users','progress','plans','plan_assignments','announcements','announcement_reads','activity','notifications','self_reports']; ctx.json({ok:true,groups:tables.map(table=>({table,count:db.get(`SELECT COUNT(*) AS c FROM ${table} WHERE verified=0`).c,rows:db.all(`SELECT * FROM ${table} WHERE verified=0 LIMIT 100`).map(row=>{delete row.password_hash; delete row.password_salt; return row;})}))});});
    app.post(base+'/review/:table/:id',ctx=>{
      mutating(ctx);const u=auth(ctx);const table=ctx.params.table;
      if(!['users','progress','plans','plan_assignments','announcements','announcement_reads','activity','notifications','self_reports'].includes(table)) fail('بخش نامعتبر');
      if(!db.get(`SELECT id FROM ${table} WHERE id=? AND verified=0`,Number(ctx.params.id))) fail('رکورد پیدا نشد',404);
      transaction(()=>{db.run(`UPDATE ${table} SET verified=1 WHERE id=?`,Number(ctx.params.id));db.run('INSERT INTO academy_audit(actor_id,action,record_id,kind,created_at) VALUES (?,?,?,?,?)',u.id,'verify',Number(ctx.params.id),table,db.now());});ctx.json({ok:true});
    });
    app.post(base+'/users',ctx=>{
      mutating(ctx);const actor=auth(ctx),b=ctx.body;
      if(!['member','coach'].includes(b.role)||!/^[-a-zA-Z0-9._]{3,30}$/.test(b.username||'')||String(b.password||'').length<12||String(b.full_name||'').trim().length<3) fail('نام، نقش، نام کاربری و رمز حداقل ۱۲ کاراکتری لازم است');
      if(db.findByUsername(b.username))fail('نام کاربری تکراری است',409);
      if(b.discipline&&!SPORTS.includes(b.discipline)) fail('رشته نامعتبر');
      if(b.phone&&!/^[+0-9 -]{7,20}$/.test(b.phone)) fail('تلفن معتبر نیست');
      const user=db.createUser({full_name:b.full_name,username:b.username,password:b.password,phone:b.phone||null,discipline:b.discipline||null},b.role);
      db.logActivity(actor.id,actor.full_name,'ساخت حساب',user.username);ctx.json({ok:true,user:db.publicUser(user)},201);
    });
    app.put(base+'/users/:id',ctx=>{
      mutating(ctx); const actor=auth(ctx), user=db.findById(ctx.params.id),b=ctx.body;
      if(!user || db.get('SELECT user_id FROM academy_admins WHERE user_id=?',user.id)) fail('حساب قابل ویرایش نیست',404);
      if(typeof b.full_name!=='string'||b.full_name.trim().length<3||b.full_name.length>150)fail('نام کامل معتبر نیست');
      if(b.discipline&&!SPORTS.includes(b.discipline))fail('رشته نامعتبر');
      if(b.phone&&!/^[+0-9 -]{7,20}$/.test(b.phone))fail('تلفن معتبر نیست');
      if(typeof b.active!=='boolean')fail('وضعیت حساب معتبر نیست');
      if(b.password&&String(b.password).length<12)fail('رمز جدید حداقل ۱۲ کاراکتر باشد');
      for(const key of ['age','weight_kg','height_cm'])if(b[key]!==''&&b[key]!==undefined&&b[key]!==null&&(!Number.isFinite(Number(b[key]))||Number(b[key])<0||Number(b[key])>400))fail('مقدار بدنی معتبر نیست');
      const patch={};for(const key of ['full_name','phone','discipline','gender','birth_date','blood_group','age','weight_kg','height_cm','belt','notes','active'])if(b[key]!==undefined)patch[key]=b[key];
      transaction(()=>{db.updateUser(user.id,patch);if(b.password)db.setPassword(user.id,b.password);db.logActivity(actor.id,actor.full_name,'ویرایش حساب توسط مدیر',user.username);});
      ctx.json({ok:true,user:db.publicUser(db.findById(user.id))});
    });
    app.post(base+'/orders/:id/status',ctx=>{
      mutating(ctx); const u=auth(ctx); const r=record(ctx.params.id,'orders');const status=ctx.body.status;
      if(!['تأییدشده','تحویل‌شده','لغوشده'].includes(status))fail('وضعیت نامعتبر');
      transaction(()=>{
        const current=record(r.id,'orders');
        if(current.data.status==='لغوشده'||current.data.status==='تحویل‌شده')fail('سفارش نهایی شده است',409);
        if(status==='لغوشده'){const p=record(current.data.product_id,'products');p.data.stock+=current.data.quantity;db.run('UPDATE academy_records SET data=? WHERE id=?',JSON.stringify(p.data),p.id);}
        current.data.status=status;db.run('UPDATE academy_records SET data=?,updated_at=? WHERE id=?',JSON.stringify(current.data),db.now(),r.id);
        db.run('INSERT INTO academy_audit(actor_id,action,record_id,kind,created_at) VALUES (?,?,?,?,?)',u.id,'order:'+status,r.id,'orders',db.now());
      });ctx.json({ok:true});
    });
    app.get(base+'/audit',ctx=>{auth(ctx);ctx.json({ok:true,rows:db.all('SELECT * FROM academy_audit ORDER BY id DESC LIMIT 200')});});
  }
}
module.exports={mount,init,save,records,record,adminUser,transaction};
