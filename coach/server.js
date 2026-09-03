'use strict';
/*
 * سایت شماره ۱ — پنل مربی «باشگاه آنلاین ارسلان دوجو»
 * پورت پیش‌فرض: ۴۱۷۳
 */

const path = require('node:path');
const { createServer } = require('../shared/server');
const db = require('../shared/db');
const { seedIfEmpty, DEMO } = require('../shared/seed');
const { JALALI_MONTHS, todayJalali, formatJalali, faNum } = require('../shared/jalali');

const PORT = Number(process.env.COACH_PORT || 4173);
const MEMBER_PORT = Number(process.env.MEMBER_PORT || 4174);
const SITE = 'coach';
const PUBLIC_DIR = path.join(__dirname, 'public');
const SHARED_PUBLIC = path.join(__dirname, '..', 'shared', 'public');

seedIfEmpty();

const app = createServer({
  name: 'coach-site',
  cookieName: 'arslan_coach_session',
  publicDirs: [PUBLIC_DIR, SHARED_PUBLIC]
});

/* -------------------------------- ابزارها -------------------------------- */

function coach(ctx) {
  return db.sessionUser(ctx.cookies[app.cookieName], SITE);
}

function needCoach(ctx) {
  const u = coach(ctx);
  if (!u) {
    ctx.json({ ok: false, error: 'ابتدا وارد پنل مربی شوید' }, 401);
    return null;
  }
  return u;
}

function bad(ctx, msg, status = 400) {
  ctx.json({ ok: false, error: msg }, status);
  return null;
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampScore(v) {
  const n = numOrNull(v);
  if (n === null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/* ------------------------------ صفحه‌های HTML ----------------------------- */

app.get('/', (ctx) => {
  if (coach(ctx)) return ctx.redirect('/dashboard');
  ctx.file(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/dashboard', (ctx) => {
  if (!coach(ctx)) return ctx.redirect('/');
  ctx.file(path.join(PUBLIC_DIR, 'dashboard.html'));
});

/* -------------------------------- پیکربندی -------------------------------- */

app.get('/api/config', (ctx) => {
  const j = todayJalali();
  ctx.json({
    ok: true,
    site: 'coach',
    club: 'باشگاه آنلاین ارسلان دوجو',
    jalaliYear: j.jy,
    jalaliMonth: j.jm,
    memberPort: MEMBER_PORT,
    months: JALALI_MONTHS,
    belts: ['سفید', 'زرد', 'نارنجی', 'سبز', 'آبی', 'قهوه‌ای', 'مشکی دان ۱', 'مشکی دان ۲', 'مشکی دان ۳', 'مشکی دان ۴']
  });
});

/* ------------------------------ ورود و خروج ------------------------------ */

app.post('/api/login', (ctx) => {
  const { username, password } = ctx.body || {};
  const user = db.findByUsername(username);
  if (!user || user.role !== 'coach' || !db.verifyPassword(password, user.password_hash, user.password_salt)) {
    return bad(ctx, 'نام کاربری یا رمز عبور اشتباه است', 401);
  }
  if (!user.active) return bad(ctx, 'این حساب غیرفعال شده است', 403);
  const { token } = db.createSession(user.id, SITE, 30);
  ctx.setCookie(token, { maxAgeSeconds: 30 * 86400 });
  db.logActivity(user.id, user.full_name, 'وارد پنل مربی شد', null);
  ctx.json({ ok: true, user: db.publicUser(user) });
});

app.post('/api/logout', (ctx) => {
  db.destroySession(ctx.cookies[app.cookieName]);
  ctx.clearCookie();
  ctx.json({ ok: true });
});

app.get('/api/me', (ctx) => {
  const u = coach(ctx);
  if (!u) return ctx.json({ ok: false, user: null });
  ctx.json({ ok: true, user: db.publicUser(u), demo: DEMO });
});

app.put('/api/me', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const b = ctx.body || {};
  const updated = db.updateUser(u.id, {
    full_name: b.full_name,
    phone: b.phone,
    belt: b.belt,
    notes: b.notes,
    style: b.style
  });
  ctx.json({ ok: true, user: db.publicUser(updated) });
});

app.post('/api/password', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const { current, next } = ctx.body || {};
  if (!db.verifyPassword(current, u.password_hash, u.password_salt)) return bad(ctx, 'رمز فعلی درست نیست');
  if (!next || String(next).length < 6) return bad(ctx, 'رمز جدید باید حداقل ۶ حرف باشد');
  db.setPassword(u.id, next);
  const { token } = db.createSession(u.id, SITE, 30);
  ctx.setCookie(token, { maxAgeSeconds: 30 * 86400 });
  ctx.json({ ok: true });
});

/* -------------------------------- نمای کلی -------------------------------- */

app.get('/api/overview', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const j = todayJalali();
  const doneFeed = db.all(
    `SELECT pa.*, u.full_name, u.avatar_color, u.belt, p.title AS plan_title
     FROM plan_assignments pa JOIN users u ON u.id = pa.user_id JOIN plans p ON p.id = pa.plan_id
     WHERE pa.status = 'done' ORDER BY pa.completed_at DESC LIMIT 8`
  );
  const selfReports = db.all(
    `SELECT sr.*, u.full_name FROM self_reports sr JOIN users u ON u.id = sr.user_id
     ORDER BY sr.created_at DESC LIMIT 8`
  );
  const latestMembers = db.all(
    "SELECT id, full_name, username, belt, avatar_color, join_date, created_at FROM users WHERE role='member' ORDER BY created_at DESC LIMIT 5"
  );
  ctx.json({
    ok: true,
    stats: db.stats(),
    today: formatJalali(new Date()),
    jalali: { year: j.jy, month: j.jm, monthName: JALALI_MONTHS[j.jm - 1] },
    activity: db.recentActivity(12),
    doneFeed,
    selfReports,
    latestMembers,
    plans: db.listPlans().slice(0, 5),
    announcements: db.listAnnouncements().slice(0, 5),
    notifications: db.notificationsFor(u.id, 15)
  });
});

/* -------------------------------- شاگردان -------------------------------- */

app.get('/api/members', (ctx) => {
  if (!needCoach(ctx)) return;
  const rows = db.listMembers({ q: ctx.query.q, belt: ctx.query.belt });
  const members = rows.map((m) => {
    const j = todayJalali();
    const { rows: pr } = db.progressYear(m.id, j.jy);
    const filled = pr.filter((r) => r.overall !== null);
    const last = [...pr].sort((a, b) => b.month - a.month)[0] || null;
    const pending = db.get('SELECT COUNT(*) AS c FROM plan_assignments WHERE user_id = ? AND status != ?', m.id, 'done').c;
    return {
      ...db.publicUser(m),
      avg: filled.length ? Math.round(filled.reduce((s, r) => s + r.overall, 0) / filled.length) : null,
      last_overall: last ? last.overall : null,
      last_month: last ? last.month : null,
      pending
    };
  });
  ctx.json({ ok: true, members, belts: db.all("SELECT DISTINCT belt FROM users WHERE role='member' AND belt IS NOT NULL ORDER BY belt").map((r) => r.belt) });
});

app.post('/api/members', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const b = ctx.body || {};
  if (!b.full_name || !String(b.full_name).trim()) return bad(ctx, 'نام و نام خانوادگی الزامی است');
  if (!b.username || !/^[a-zA-Z0-9._-]{3,}$/.test(String(b.username).trim())) {
    return bad(ctx, 'نام کاربری باید انگلیسی و حداقل ۳ حرف باشد');
  }
  if (db.findByUsername(b.username)) return bad(ctx, 'این نام کاربری قبلاً گرفته شده است');
  const password = b.password || DEMO.memberPassword;
  if (String(password).length < 4) return bad(ctx, 'رمز عبور باید حداقل ۴ حرف باشد');
  const member = db.createUser({ ...b, username: String(b.username).trim().toLowerCase(), password }, 'member');
  db.logActivity(u.id, u.full_name, 'شاگرد جدید ثبت کرد', member.full_name);

  // اگر تمرین‌های «برای همه» فعال باشند، به او هم اختصاص بده
  for (const plan of db.all('SELECT * FROM plans WHERE target_all = 1')) {
    db.run('INSERT OR IGNORE INTO plan_assignments (plan_id, user_id, status, assigned_at) VALUES (?,?,?,?)',
      plan.id, member.id, 'todo', db.now());
  }
  db.pushNotification(member.id, {
    type: 'welcome',
    title: 'به باشگاه آنلاین ارسلان دوجو خوش آمدید',
    body: 'پنل کاربری شما ساخته شد. تمرینات و جدول پیشرفت در دسترس شماست.'
  });
  ctx.json({ ok: true, member: db.publicUser(member) });
});

app.get('/api/members/:id', (ctx) => {
  if (!needCoach(ctx)) return;
  const m = db.findById(ctx.params.id);
  if (!m || m.role !== 'member') return bad(ctx, 'شاگرد پیدا نشد', 404);
  const years = db.all('SELECT DISTINCT year FROM progress ORDER BY year DESC').map((r) => r.year);
  const year = Number(ctx.query.year) || todayJalali().jy;
  const prog = db.progressYear(m.id, year);
  const reports = db.all('SELECT * FROM self_reports WHERE user_id = ? ORDER BY year DESC, month DESC', m.id);
  const plans = db.all(
    `SELECT pa.*, p.title, p.category, p.due_on FROM plan_assignments pa JOIN plans p ON p.id = pa.plan_id
     WHERE pa.user_id = ? ORDER BY p.created_at DESC`, m.id
  );
  ctx.json({
    ok: true,
    member: db.publicUser(m),
    years: years.includes(year) ? years : [year, ...years],
    year,
    progress: prog.months,
    reports,
    plans,
    activity: db.all('SELECT * FROM activity WHERE actor_id = ? ORDER BY created_at DESC LIMIT 10', m.id)
  });
});

app.put('/api/members/:id', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const m = db.findById(ctx.params.id);
  if (!m || m.role !== 'member') return bad(ctx, 'شاگرد پیدا نشد', 404);
  const updated = db.updateUser(m.id, ctx.body || {});
  db.logActivity(u.id, u.full_name, 'اطلاعات شاگرد را ویرایش کرد', updated.full_name);
  ctx.json({ ok: true, member: db.publicUser(updated) });
});

app.post('/api/members/:id/password', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const m = db.findById(ctx.params.id);
  if (!m || m.role !== 'member') return bad(ctx, 'شاگرد پیدا نشد', 404);
  const next = (ctx.body || {}).password;
  if (!next || String(next).length < 4) return bad(ctx, 'رمز عبور باید حداقل ۴ حرف باشد');
  db.setPassword(m.id, next);
  db.logActivity(u.id, u.full_name, 'رمز عبور شاگرد را بازنشانی کرد', m.full_name);
  ctx.json({ ok: true });
});

app.delete('/api/members/:id', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const m = db.findById(ctx.params.id);
  if (!m || m.role !== 'member') return bad(ctx, 'شاگرد پیدا نشد', 404);
  db.run('DELETE FROM users WHERE id = ?', m.id);
  db.logActivity(u.id, u.full_name, 'شاگرد را حذف کرد', m.full_name);
  ctx.json({ ok: true });
});

app.post('/api/members/:id/impersonate', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const m = db.findById(ctx.params.id);
  if (!m || m.role !== 'member') return bad(ctx, 'شاگرد پیدا نشد', 404);
  const token = require('node:crypto').randomBytes(24).toString('hex');
  db.run('INSERT INTO impersonations (token, user_id, created_at) VALUES (?,?,?)', token, m.id, db.now());
  db.logActivity(u.id, u.full_name, 'پنل شاگرد را مشاهده کرد', m.full_name);
  ctx.json({ ok: true, token });
});

/* -------------------------------- تمرینات -------------------------------- */

app.get('/api/plans', (ctx) => {
  if (!needCoach(ctx)) return;
  ctx.json({ ok: true, plans: db.listPlans() });
});

app.post('/api/plans', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const b = ctx.body || {};
  if (!b.title || !String(b.title).trim()) return bad(ctx, 'عنوان تمرین الزامی است');
  let targets = (b.member_ids || []).map(Number).filter((n) => !Number.isNaN(n));
  if (!targets.length && !b.all_members) return bad(ctx, 'حداقل یک شاگرد را انتخاب کنید');
  if (b.all_members) targets = [];
  const plan = db.createPlan({
    author_id: u.id,
    title: String(b.title).trim(),
    body: b.body,
    category: b.category,
    difficulty: b.difficulty,
    starts_on: b.starts_on,
    due_on: b.due_on,
    duration: b.duration,
    targets,
    all_members: !!b.all_members
  });
  db.logActivity(u.id, u.full_name, 'تمرین ارسال کرد', `${plan.title} — ${plan.total} شاگرد`);
  ctx.json({ ok: true, plan });
});

app.get('/api/plans/:id', (ctx) => {
  if (!needCoach(ctx)) return;
  const plan = db.getPlan(ctx.params.id);
  if (!plan) return bad(ctx, 'تمرین پیدا نشد', 404);
  ctx.json({ ok: true, plan });
});

app.put('/api/plans/:id', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const plan = db.getPlan(ctx.params.id);
  if (!plan) return bad(ctx, 'تمرین پیدا نشد', 404);
  const updated = db.updatePlan(plan.id, ctx.body || {});
  db.logActivity(u.id, u.full_name, 'تمرین را ویرایش کرد', updated.title);
  ctx.json({ ok: true, plan: updated });
});

app.delete('/api/plans/:id', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const plan = db.getPlan(ctx.params.id);
  if (!plan) return bad(ctx, 'تمرین پیدا نشد', 404);
  db.deletePlan(plan.id);
  db.logActivity(u.id, u.full_name, 'تمرین را حذف کرد', plan.title);
  ctx.json({ ok: true });
});

app.post('/api/plans/:id/assign', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const plan = db.getPlan(ctx.params.id);
  if (!plan) return bad(ctx, 'تمرین پیدا نشد', 404);
  const ids = (ctx.body || {}).member_ids || [];
  for (const id of ids) {
    const m = db.findById(id);
    if (!m) continue;
    const added = db.run('INSERT OR IGNORE INTO plan_assignments (plan_id, user_id, status, assigned_at) VALUES (?,?,?,?)',
      plan.id, Number(id), 'todo', db.now());
    if (added.changes > 0) {
      db.pushNotification(id, { type: 'plan', title: `تمرین جدید: ${plan.title}`, body: 'به پنل تمرینات من سر بزنید.' });
    }
  }
  db.logActivity(u.id, u.full_name, 'تمرین را برای شاگردان بیشتری ارسال کرد', `${plan.title} — ${ids.length} نفر`);
  ctx.json({ ok: true, plan: db.getPlan(plan.id) });
});

app.put('/api/assignments/:id', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const a = db.get('SELECT * FROM plan_assignments WHERE id = ?', ctx.params.id);
  if (!a) return bad(ctx, 'تخصیص پیدا نشد', 404);
  const { status, coach_note } = ctx.body || {};
  const fields = [];
  const values = [];
  if (status && ['todo', 'doing', 'done'].includes(status)) { fields.push('status = ?'); values.push(status); }
  if (coach_note !== undefined) { fields.push('coach_note = ?'); values.push(coach_note); }
  if (fields.length) {
    values.push(a.id);
    db.run(`UPDATE plan_assignments SET ${fields.join(', ')} WHERE id = ?`, ...values);
  }
  if (coach_note) {
    const m = db.findById(a.user_id);
    const p = db.get('SELECT title FROM plans WHERE id = ?', a.plan_id);
    db.pushNotification(a.user_id, {
      type: 'feedback',
      title: 'بازخورد مربی',
      body: `${p ? p.title : 'تمرین'}: ${coach_note}`
    });
    db.logActivity(u.id, u.full_name, 'به تمرین شاگرد بازخورد داد', m ? m.full_name : null);
  }
  ctx.json({ ok: true, assignment: db.get('SELECT * FROM plan_assignments WHERE id = ?', a.id) });
});

/* ------------------------------ جدول پیشرفت ------------------------------ */

app.get('/api/progress', (ctx) => {
  if (!needCoach(ctx)) return;
  const userId = Number(ctx.query.user_id);
  const m = db.findById(userId);
  if (!m || m.role !== 'member') return bad(ctx, 'شاگرد پیدا نشد', 404);
  const year = Number(ctx.query.year) || todayJalali().jy;
  const prog = db.progressYear(userId, year);
  const reports = db.all('SELECT * FROM self_reports WHERE user_id = ? AND year = ? ORDER BY month', userId, year);
  ctx.json({ ok: true, member: db.publicUser(m), year, progress: prog.months, selfReports: reports });
});

app.put('/api/progress', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const b = ctx.body || {};
  const m = db.findById(b.user_id);
  if (!m || m.role !== 'member') return bad(ctx, 'شاگرد پیدا نشد', 404);
  const year = Number(b.year);
  const month = Number(b.month);
  if (!year || !month || month < 1 || month > 12) return bad(ctx, 'سال و ماه معتبر وارد کنید');
  const row = db.saveProgress({
    user_id: m.id, year, month,
    sessions: b.sessions,
    endurance: clampScore(b.endurance),
    strength: clampScore(b.strength),
    technique: clampScore(b.technique),
    flexibility: clampScore(b.flexibility),
    discipline: clampScore(b.discipline),
    weight_kg: numOrNull(b.weight_kg),
    overall: clampScore(b.overall),
    note: b.note === undefined ? undefined : b.note
  }, u.id);
  db.pushNotification(m.id, {
    type: 'progress',
    title: `جدول پیشرفت ${JALALI_MONTHS[month - 1]} ${faNum(year)} ثبت شد`,
    body: row.overall !== null ? `نمره کل: ${faNum(row.overall)} از ۱۰۰` : 'مربی مقادیر این ماه را ثبت کرد.'
  });
  db.logActivity(u.id, u.full_name, 'جدول پیشرفت را به‌روزرسانی کرد', `${m.full_name} — ${JALALI_MONTHS[month - 1]} ${year}`);
  ctx.json({ ok: true, progress: row });
});

app.delete('/api/progress/:id', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const row = db.get('SELECT * FROM progress WHERE id = ?', ctx.params.id);
  if (!row) return bad(ctx, 'رکورد پیدا نشد', 404);
  db.deleteProgress(row.id);
  db.logActivity(u.id, u.full_name, 'یک رکورد پیشرفت را حذف کرد', null);
  ctx.json({ ok: true });
});

app.get('/api/progress/club', (ctx) => {
  if (!needCoach(ctx)) return;
  const year = Number(ctx.query.year) || todayJalali().jy;
  ctx.json({ ok: true, year, rows: db.clubMatrix(year) });
});

app.get('/api/years', (ctx) => {
  if (!needCoach(ctx)) return;
  const years = db.all('SELECT DISTINCT year FROM progress ORDER BY year DESC').map((r) => r.year);
  const current = todayJalali().jy;
  if (!years.includes(current)) years.unshift(current);
  ctx.json({ ok: true, years });
});

app.get('/api/export/progress', (ctx) => {
  if (!needCoach(ctx)) return;
  const year = Number(ctx.query.year) || todayJalali().jy;
  const rows = db.clubMatrix(year);
  const header = ['نام شاگرد', 'کمربند', ...JALALI_MONTHS.map((m) => m + ' ' + year), 'میانگین سال'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const cells = [r.member.full_name, r.member.belt || '-'];
    for (let mth = 1; mth <= 12; mth += 1) {
      const p = r.months[mth];
      cells.push(p && p.overall !== null ? String(p.overall) : '-');
    }
    cells.push(r.avg === null ? '-' : String(r.avg));
    lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
  }
  const csv = '\uFEFF' + lines.join('\r\n');
  ctx.res.setHeader('Content-Disposition', `attachment; filename="progress-${year}.csv"`);
  ctx.text(csv, 200, 'text/csv; charset=utf-8');
});

/* ------------------------------- اطلاع‌رسانی ------------------------------ */

app.get('/api/announcements', (ctx) => {
  if (!needCoach(ctx)) return;
  ctx.json({ ok: true, announcements: db.listAnnouncements() });
});

app.post('/api/announcements', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const b = ctx.body || {};
  if (!b.title || !String(b.title).trim()) return bad(ctx, 'عنوان اطلاعیه الزامی است');
  if (!b.body || !String(b.body).trim()) return bad(ctx, 'متن اطلاعیه الزامی است');
  const targets = (b.member_ids || []).map(Number).filter(Boolean);
  const a = db.createAnnouncement({
    author_id: u.id,
    title: String(b.title).trim(),
    body: String(b.body),
    category: b.category || 'عمومی',
    pinned: b.pinned ? 1 : 0,
    targets: b.all_members ? [] : targets
  });
  if (!a.targets.length && !b.all_members) return bad(ctx, 'حداقل یک شاگرد را انتخاب کنید');
  db.logActivity(u.id, u.full_name, 'اطلاعیه منتشر کرد', a.title);
  ctx.json({ ok: true, announcement: a });
});

app.put('/api/announcements/:id', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const a = db.getAnnouncement(ctx.params.id);
  if (!a) return bad(ctx, 'اطلاعیه پیدا نشد', 404);
  const b = ctx.body || {};
  const patch = {};
  for (const k of ['title', 'body', 'category', 'pinned']) if (b[k] !== undefined) patch[k] = b[k];
  if (b.member_ids !== undefined) patch.targets = (b.member_ids || []).map(Number).filter(Boolean);
  const updated = db.updateAnnouncement(a.id, patch);
  db.logActivity(u.id, u.full_name, 'اطلاعیه را ویرایش کرد', updated.title);
  ctx.json({ ok: true, announcement: updated });
});

app.delete('/api/announcements/:id', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const a = db.getAnnouncement(ctx.params.id);
  if (!a) return bad(ctx, 'اطلاعیه پیدا نشد', 404);
  db.deleteAnnouncement(a.id);
  db.logActivity(u.id, u.full_name, 'اطلاعیه را حذف کرد', a.title);
  ctx.json({ ok: true });
});

app.post('/api/messages', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  const b = ctx.body || {};
  const title = String(b.title || '').trim();
  if (!title) return bad(ctx, 'عنوان پیام الزامی است');
  let ids = (b.member_ids || []).map(Number).filter(Boolean);
  if (b.all_members) ids = db.listMembers({ active: 1 }).map((m) => m.id);
  if (!ids.length) return bad(ctx, 'گیرنده‌ای انتخاب نشده است');
  for (const id of ids) {
    db.pushNotification(id, { type: 'message', title, body: b.body || null });
  }
  db.logActivity(u.id, u.full_name, 'پیام مستقیم فرستاد', `${title} — ${ids.length} نفر`);
  ctx.json({ ok: true, sent: ids.length });
});

app.get('/api/notifications', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  ctx.json({ ok: true, notifications: db.notificationsFor(u.id, 40), unread: db.unreadCount(u.id) });
});

app.post('/api/notifications/read', (ctx) => {
  const u = needCoach(ctx);
  if (!u) return;
  db.markNotificationsRead(u.id);
  ctx.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`پنل مربی: http://localhost:${PORT}  |  ورود: ${DEMO.coach.username} / ${DEMO.coach.password}`);
  console.log(`دیتابیس: ${db.DB_PATH}`);
});
