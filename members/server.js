'use strict';
/*
 * سایت شماره ۲ — پنل شاگردان «باشگاه آنلاین ارسلان دوجو»
 * پورت پیش‌فرض: ۴۱۷۴
 */

const path = require('node:path');
const { createServer } = require('../shared/server');
const db = require('../shared/db');
const { seedIfEmpty, DEMO } = require('../shared/seed');
const { JALALI_MONTHS, todayJalali, formatJalali, faNum } = require('../shared/jalali');

const PORT = Number(process.env.MEMBER_PORT || 4174);
const COACH_PORT = Number(process.env.COACH_PORT || 4173);
const SITE = 'member';
const PUBLIC_DIR = path.join(__dirname, 'public');
const SHARED_PUBLIC = path.join(__dirname, '..', 'shared', 'public');

seedIfEmpty();

const app = createServer({
  name: 'members-site',
  cookieName: 'arslan_member_session',
  publicDirs: [PUBLIC_DIR, SHARED_PUBLIC]
});

/* -------------------------------- ابزارها -------------------------------- */

function member(ctx) {
  const u = db.sessionUser(ctx.cookies[app.cookieName], SITE);
  return u && u.role === 'member' ? u : null;
}

function needMember(ctx) {
  const u = member(ctx);
  if (!u) {
    ctx.json({ ok: false, error: 'ابتدا وارد پنل کاربری شوید' }, 401);
    return null;
  }
  return u;
}

function bad(ctx, msg, status = 400) {
  ctx.json({ ok: false, error: msg }, status);
  return null;
}

/* ------------------------------ صفحه‌های HTML ----------------------------- */

app.get('/', (ctx) => {
  if (member(ctx)) return ctx.redirect('/panel');
  ctx.file(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/panel', (ctx) => {
  if (!member(ctx)) return ctx.redirect('/');
  ctx.file(path.join(PUBLIC_DIR, 'panel.html'));
});

/* ورود مربی به پنل یک شاگرد (از سایت اول) */
app.get('/impersonate', (ctx) => {
  const token = ctx.query.token;
  const row = token ? db.get('SELECT * FROM impersonations WHERE token = ?', token) : null;
  if (!row || row.used_at) return ctx.redirect('/?error=bad-token');
  if (Date.now() - new Date(row.created_at).getTime() > 5 * 60 * 1000) return ctx.redirect('/?error=expired');
  const u = db.findById(row.user_id);
  if (!u) return ctx.redirect('/?error=bad-token');
  db.run('UPDATE impersonations SET used_at = ? WHERE token = ?', db.now(), token);
  const { token: sessionToken } = db.createSession(u.id, SITE, 1);
  ctx.setCookie(sessionToken, { maxAgeSeconds: 86400 });
  ctx.redirect('/panel');
});

app.get('/api/config', (ctx) => {
  const j = todayJalali();
  ctx.json({
    ok: true,
    site: 'member',
    club: 'باشگاه آنلاین ارسلان دوجو',
    jalaliYear: j.jy,
    jalaliMonth: j.jm,
    coachPort: COACH_PORT,
    months: JALALI_MONTHS,
    belts: ['سفید', 'زرد', 'نارنجی', 'سبز', 'آبی', 'قهوه‌ای', 'مشکی دان ۱', 'مشکی دان ۲']
  });
});

/* --------------------------- ثبت‌نام و ورود --------------------------- */

app.post('/api/register', (ctx) => {
  const b = ctx.body || {};
  const full_name = String(b.full_name || '').trim();
  const username = String(b.username || '').trim().toLowerCase();
  const password = String(b.password || '');

  if (full_name.length < 3) return bad(ctx, 'نام و نام خانوادگی را کامل وارد کنید');
  if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) return bad(ctx, 'نام کاربری باید انگلیسی، بدون فاصله و حداقل ۳ حرف باشد');
  if (db.findByUsername(username)) return bad(ctx, 'این نام کاربری قبلاً ثبت شده است');
  if (password.length < 6) return bad(ctx, 'رمز عبور باید حداقل ۶ حرف باشد');
  if (b.phone && !/^[0-9+\-\s]{7,15}$/.test(String(b.phone))) return bad(ctx, 'شماره موبایل معتبر نیست');
  if (password !== b.password2) return bad(ctx, 'تکرار رمز عبور مطابقت ندارد');

  const user = db.createUser({
    full_name,
    username,
    password,
    phone: b.phone || null,
    gender: b.gender || null,
    birth_date: b.birth_date || null,
    age: b.age,
    weight_kg: b.weight_kg,
    height_cm: b.height_cm,
    belt: b.belt || 'سفید',
    style: b.style || null,
    experience: b.experience || null,
    join_date: new Date().toISOString().slice(0, 10)
  }, 'member');

  const { token } = db.createSession(user.id, SITE, 30);
  ctx.setCookie(token, { maxAgeSeconds: 30 * 86400 });

  db.pushNotification(user.id, {
    type: 'welcome',
    title: 'ثبت‌نام شما با موفقیت انجام شد',
    body: 'به باشگاه آنلاین ارسلان دوجو خوش آمدید. منتظر تمرین‌های مربی باشید.'
  });
  for (const coach of db.all("SELECT id, full_name FROM users WHERE role = 'coach' AND active = 1")) {
    db.pushNotification(coach.id, {
      type: 'new_member',
      title: 'ثبت‌نام شاگرد جدید',
      body: `${full_name} (@${username}) در سایت ثبت‌نام کرد.`
    });
    db.logActivity(coach.id, coach.full_name, 'ثبت‌نام جدید دریافت شد', `${full_name} (@${username})`);
  }
  // تمرین‌های عمومی باشگاه به شاگرد تازه‌وارد هم می‌رسد
  for (const plan of db.all('SELECT * FROM plans WHERE target_all = 1')) {
    db.run('INSERT OR IGNORE INTO plan_assignments (plan_id, user_id, status, assigned_at) VALUES (?,?,?,?)',
      plan.id, user.id, 'todo', db.now());
  }
  ctx.json({ ok: true, user: db.publicUser(user) });
});

app.post('/api/login', (ctx) => {
  const { username, password } = ctx.body || {};
  const u = db.findByUsername(username);
  if (!u || u.role !== 'member' || !db.verifyPassword(password, u.password_hash, u.password_salt)) {
    return bad(ctx, 'نام کاربری یا رمز عبور اشتباه است', 401);
  }
  if (!u.active) return bad(ctx, 'حساب کاربری شما غیرفعال است؛ با مربی تماس بگیرید', 403);
  const { token } = db.createSession(u.id, SITE, 30);
  ctx.setCookie(token, { maxAgeSeconds: 30 * 86400 });
  db.logActivity(u.id, u.full_name, 'وارد پنل کاربری شد', null);
  ctx.json({ ok: true, user: db.publicUser(u) });
});

app.post('/api/logout', (ctx) => {
  db.destroySession(ctx.cookies[app.cookieName]);
  ctx.clearCookie();
  ctx.json({ ok: true });
});

app.get('/api/me', (ctx) => {
  const u = member(ctx);
  if (!u) return ctx.json({ ok: false, user: null });
  const j = todayJalali();
  ctx.json({
    ok: true,
    user: db.publicUser(u),
    unread: db.unreadCount(u.id),
    pending: db.get('SELECT COUNT(*) AS c FROM plan_assignments WHERE user_id = ? AND status != ?', u.id, 'done').c,
    today: formatJalali(new Date()),
    jalali: { year: j.jy, month: j.jm, monthName: JALALI_MONTHS[j.jm - 1] }
  });
});

app.put('/api/me', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  const b = ctx.body || {};
  if (b.phone && !/^[0-9+\-\s]{7,15}$/.test(String(b.phone))) return bad(ctx, 'شماره موبایل معتبر نیست');
  const updated = db.updateUser(u.id, {
    full_name: b.full_name,
    phone: b.phone,
    gender: b.gender,
    birth_date: b.birth_date,
    age: b.age,
    weight_kg: b.weight_kg,
    height_cm: b.height_cm,
    belt: b.belt,
    style: b.style,
    experience: b.experience
  });
  ctx.json({ ok: true, user: db.publicUser(updated) });
});

app.post('/api/password', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  const { current, next } = ctx.body || {};
  if (!db.verifyPassword(current, u.password_hash, u.password_salt)) return bad(ctx, 'رمز فعلی درست نیست');
  if (!next || String(next).length < 6) return bad(ctx, 'رمز جدید باید حداقل ۶ حرف باشد');
  db.setPassword(u.id, next);
  const { token } = db.createSession(u.id, SITE, 30);
  ctx.setCookie(token, { maxAgeSeconds: 30 * 86400 });
  ctx.json({ ok: true });
});

/* ------------------------------ تمرینات من ------------------------------- */

app.get('/api/plans', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  ctx.json({ ok: true, plans: db.plansForUser(u.id) });
});

app.put('/api/assignments/:id', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  const { status, note } = ctx.body || {};
  if (!['todo', 'doing', 'done'].includes(status)) return bad(ctx, 'وضعیت نامعتبر');
  const a = db.setAssignmentStatus(ctx.params.id, u.id, status, note);
  if (!a) return bad(ctx, 'تمرین پیدا نشد', 404);
  ctx.json({ ok: true, assignment: a });
});

/* --------------------------- جدول پیشرفت من ---------------------------- */

app.get('/api/progress', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  const year = Number(ctx.query.year) || todayJalali().jy;
  const prog = db.progressYear(u.id, year);
  const reports = db.all('SELECT * FROM self_reports WHERE user_id = ? AND year = ? ORDER BY month', u.id, year);
  const years = db.all('SELECT DISTINCT year FROM progress WHERE user_id = ? ORDER BY year DESC', u.id).map((r) => r.year);
  if (!years.includes(year)) years.unshift(year);
  const history = db.all(
    'SELECT year, month, sessions, overall, endurance, strength, technique, flexibility, discipline, weight_kg FROM progress WHERE user_id = ? ORDER BY year, month',
    u.id
  ).map((r) => ({ ...r, overall: db.computeOverall(r) }));
  ctx.json({ ok: true, year, years, progress: prog.months, selfReports: reports, history });
});

app.post('/api/self-report', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  const b = ctx.body || {};
  const year = Number(b.year) || todayJalali().jy;
  const month = Number(b.month) || todayJalali().jm;
  const row = db.saveSelfReport({
    user_id: u.id, year, month,
    sessions: b.sessions,
    feeling: b.feeling,
    note: b.note
  });
  ctx.json({ ok: true, report: row });
});

/* ------------------------------ اطلاعیه‌ها ------------------------------ */

app.get('/api/announcements', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  ctx.json({ ok: true, announcements: db.announcementsFor(u.id) });
});

app.post('/api/announcements/:id/read', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  db.markAnnouncementRead(ctx.params.id, u.id);
  ctx.json({ ok: true });
});

app.get('/api/notifications', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  ctx.json({ ok: true, notifications: db.notificationsFor(u.id, 40), unread: db.unreadCount(u.id) });
});

app.post('/api/notifications/read', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  db.markNotificationsRead(u.id);
  ctx.json({ ok: true });
});

app.get('/api/club', (ctx) => {
  const u = needMember(ctx);
  if (!u) return;
  // نمای سالانه باشگاه (فقط نمره کل؛ برای انگیزه و مقایسه سالم)
  const year = Number(ctx.query.year) || todayJalali().jy;
  const rows = db.clubMatrix(year).map((r) => ({
    name: r.member.full_name,
    belt: r.member.belt,
    color: r.member.avatar_color,
    avg: r.avg,
    last: r.last_overall,
    me: r.member.id === u.id
  }));
  ctx.json({ ok: true, year, rows });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`سایت شاگردان: http://localhost:${PORT}  |  نمونه: ali / ${DEMO.memberPassword}`);
  console.log(`دیتابیس: ${db.DB_PATH}`);
});
