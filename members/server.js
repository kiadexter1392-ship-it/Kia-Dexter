'use strict';
/*
 * سایت شماره ۲ — پنل شاگردان «باشگاه آنلاین ارسلان دوجو»
 * پورت پیش‌فرض: ۴۱۷۴
 */

const path = require('node:path');
const { createServer, rateLimit } = require('../shared/server');
const db = require('../shared/db');
const { seedIfEmpty, DEMO } = require('../shared/seed');
const { JALALI_MONTHS, todayJalali, formatJalali, faNum } = require('../shared/jalali');

const PORT = Number(process.env.MEMBER_PORT || 4174);
const USE_PROXY = !!process.env.PORT;
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
  ctx.setCookie(sessionToken, { maxAgeSeconds: 86400 }); /* 1 day for coach impersonation */
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
    belts: ['سفید', 'زرد', 'نارنجی', 'سبز', 'آبی', 'قهوه‌ای', 'مشکی دان ۱', 'مشکی دان ۲'],
    disciplines: ['کاراته', 'کراسفیت', 'بوکس', 'ژیمناستیک', 'موی تای'],
    supportPhone: '+989016399804',
    baleLink: 'https://ble.ir/+989016399804'
  });
});

/* --------------------------- اطلاعات پرداخت و شهریه --------------------------- */

app.get('/api/payment', (ctx) => {
  ctx.json({
    ok: true,
    cards: [
      { number: '6219861938986279', holder: 'نوید احمدی', label: 'شماره کارت شهریه آقایان' },
      { number: '6219861903417334', holder: 'خانم توکلی شانجانی', label: 'شماره کارت شهریه بانوان' }
    ],
    pricing: [
      { discipline: 'کاراته جوانان و بزرگسالان', price: '۱,۹۰۰', priceNum: 1900 },
      { discipline: 'کاراته نونهالان', price: '۱,۸۰۰', priceNum: 1800 },
      { discipline: 'کراسفیت کودک', price: '۱,۸۰۰', priceNum: 1800 },
      { discipline: 'کراسفیت بزرگسالان و نوجوانان', price: '۱,۸۰۰', priceNum: 1800 },
      { discipline: 'بوکس', price: '۱,۸۰۰', priceNum: 1800 },
      { discipline: 'ژیمناستیک', price: '۱,۵۰۰', priceNum: 1500 },
      { discipline: 'موی تای بانوان', price: '۱,۵۰۰', priceNum: 1500 }
    ],
    supportPhone: '+989016399804',
    baleLink: 'https://ble.ir/+989016399804'
  });
});

/* --------------------------- سوالات متداول --------------------------- */

app.get('/api/faq', (ctx) => {
  ctx.json({
    ok: true,
    faqs: [
      {
        q: 'شهریه ماهانه چقدر است؟',
        a: 'کاراته جوانان و بزرگسالان: ۱,۹۰۰ هزار تومان — کاراته نونهالان: ۱,۸۰۰ هزار تومان — کراسفیت کودک: ۱,۸۰۰ هزار تومان — کراسفیت بزرگسالان و نوجوانان: ۱,۸۰۰ هزار تومان — بوکس: ۱,۸۰۰ هزار تومان — ژیمناستیک: ۱,۵۰۰ هزار تومان — موی تای بانوان: ۱,۵۰۰ هزار تومان. مهلت پرداخت تا ۱۲ هر ماه.'
      },
      {
        q: 'چطور می‌توانم آنلاین شهریه را پرداخت کنم؟',
        a: 'برای پرداخت آنلاین شهریه، می‌توانید مبلغ مورد نظر را به شماره کارت ۶۲۱۹-۸۶۱۹-۳۸۹۸-۶۲۷۹ به نام نوید احمدی (مخصوص آقایان) یا شماره کارت ۶۲۱۹-۸۶۱۹-۰۳۴۱-۷۳۳۴ به نام خانم توکلی شانجانی (مخصوص بانوان) واریز کنید. پس از واریز، لطفاً فیش واریزی را از طریق پیام‌رسان بله به شماره +989016399804 ارسال نمایید.'
      },
      {
        q: 'ساعت کلاس‌های باشگاه چگونه است؟',
        a: 'ساعت کلاس‌ها بسته به رشته و گروه سنی متفاوت است. کلاس بزرگسالان معمولاً شنبه و دوشنبه ساعت ۱۸ تا ۲۰ و کلاس نوجوانان یکشنبه و سه‌شنبه ساعت ۱۷ تا ۱۸:۳۰ برگزار می‌شود. برای اطلاع از ساعت دقیق کلاس رشته خود، از بخش پشتیبانی با ما تماس بگیرید.'
      },
      {
        q: 'آیا امکان ثبت‌نام آزمایشی (یک جلسه رایگان) وجود دارد؟',
        a: 'بله، شما می‌توانید یک جلسه به عنوان مهمان در کلاس مورد نظر شرکت کنید تا با محیط باشگاه و سبک تمرین آشنا شوید. برای هماهنگی با بخش پشتیبانی از طریق بله به شماره +989016399804 پیام دهید.'
      },
      {
        q: 'مهلت پرداخت شهریه تا چه زمانی است؟',
        a: 'مهلت پرداخت شهریه هر ماه تا دوازدهم همان ماه می‌باشد. لطفاً پس از واریز، فیش واریزی را حتماً ارسال نمایید تا نام شما در لیست حاضرین ثبت شود.'
      },
      {
        q: 'آیا امکان تغییر رشته وجود دارد؟',
        a: 'بله، شما می‌توانید با هماهنگی مربی و اطلاع به بخش پشتیبانی، رشته ورزشی خود را تغییر دهید. برای این کار از طریق پیام‌رسان بله با ما در ارتباط باشید.'
      },
      {
        q: 'چگونه جدول پیشرفت من پر می‌شود؟',
        a: 'جدول پیشرفت ماهانه توسط مربی و بر اساس عملکرد شما در تمرینات پر می‌شود. شاخص‌هایی مانند استقامت، قدرت، تکنیک، انعطاف و انضباط هر ماه ارزیابی و نمره‌دهی می‌شوند. شما همچنین می‌توانید خودارزیابی ماهانه ثبت کنید.'
      },
      {
        q: 'اگر تمرین را نتوانم به‌موقع انجام دهم چه کنم؟',
        a: 'در صورت عدم امکان انجام تمرین در مهلت مقرر، می‌توانید از طریق یادداشت در پنل کاربری یا تماس با مربی از طریق بله، موضوع را اطلاع دهید. مربی می‌تواند مهلت را تمدید یا برنامه جایگزین ارائه دهد.'
      }
    ]
  });
});

/* --------------------------- ثبت‌نام و ورود --------------------------- */

function doRegister(ctx, b) {
  const full_name = String(b.full_name || '').trim();
  const username = String(b.username || '').trim().toLowerCase();
  const password = String(b.password || '');

  if (full_name.length < 3) return 'نام و نام خانوادگی را کامل وارد کنید';
  if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) return 'نام کاربری باید انگلیسی، بدون فاصله و حداقل ۳ حرف باشد';
  if (db.findByUsername(username)) return 'این نام کاربری قبلاً ثبت شده است';
  if (password.length < 6) return 'رمز عبور باید حداقل ۶ حرف باشد';
  if (b.phone && !/^[0-9+\-\s]{7,15}$/.test(String(b.phone))) return 'شماره موبایل معتبر نیست';
  if (password !== b.password2) return 'تکرار رمز عبور مطابقت ندارد';

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
    discipline: b.discipline || b.style || null,
    style: b.discipline || b.style || null,
    experience: b.experience || null,
    join_date: new Date().toISOString().slice(0, 10)
  }, 'member');

  const { token } = db.createSession(user.id, SITE, 90);
  ctx.setCookie(token, { maxAgeSeconds: 90 * 86400 });

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
  for (const plan of db.all('SELECT * FROM plans WHERE target_all = 1')) {
    db.run('INSERT OR IGNORE INTO plan_assignments (plan_id, user_id, status, assigned_at) VALUES (?,?,?,?)',
      plan.id, user.id, 'todo', db.now());
  }
  return null;
}

app.post('/api/register', (ctx) => {
  const b = ctx.body || {};
  const err = doRegister(ctx, b);
  if (err) return bad(ctx, err);
  ctx.json({ ok: true, user: db.publicUser(db.findByUsername(String(b.username || '').trim().toLowerCase())) });
});

/* ثبت‌نام مستقیم (فرم HTML → ریدایرکت) — مرورگر خودش کوکی رو مدیریت می‌کنه */
app.post('/register', (ctx) => {
  const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket.remoteAddress || '';
  if (!rateLimit('reg:' + ip, 5, 600000)) {
    ctx.redirect('/?error=' + encodeURIComponent('تعداد ثبت‌نام بیش از حد — لطفاً ۱۰ دقیقه صبر کنید'));
    return;
  }
  const b = ctx.body || {};
  const err = doRegister(ctx, b);
  if (err) {
    ctx.redirect('/?error=' + encodeURIComponent(err));
    return;
  }
  ctx.redirect('/panel');
});

app.post('/login', (ctx) => {
  const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket.remoteAddress || '';
  if (!rateLimit('login:' + ip, 10, 300000)) {
    ctx.redirect('/?error=' + encodeURIComponent('تعداد تلاش بیش از حد — لطفاً ۵ دقیقه صبر کنید'));
    return;
  }
  const b = ctx.body || {};
  const u = db.findByUsername(b.username);
  if (!u || u.role !== 'member' || !db.verifyPassword(b.password, u.password_hash, u.password_salt)) {
    ctx.redirect('/?error=' + encodeURIComponent('نام کاربری یا رمز عبور اشتباه است'));
    return;
  }
  if (!u.active) {
    ctx.redirect('/?error=' + encodeURIComponent('حساب شما غیرفعال است'));
    return;
  }
  const { token } = db.createSession(u.id, SITE, 90);
  ctx.setCookie(token, { maxAgeSeconds: 90 * 86400 });
  db.logActivity(u.id, u.full_name, 'وارد پنل کاربری شد', null);
  ctx.redirect('/panel');
});

app.post('/api/login', (ctx) => {
  const { username, password } = ctx.body || {};
  const u = db.findByUsername(username);
  if (!u || u.role !== 'member' || !db.verifyPassword(password, u.password_hash, u.password_salt)) {
    return bad(ctx, 'نام کاربری یا رمز عبور اشتباه است', 401);
  }
  if (!u.active) return bad(ctx, 'حساب کاربری شما غیرفعال است؛ با مربی تماس بگیرید', 403);
  const { token } = db.createSession(u.id, SITE, 90);
  ctx.setCookie(token, { maxAgeSeconds: 90 * 86400 });
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
  const { token } = db.createSession(u.id, SITE, 90);
  ctx.setCookie(token, { maxAgeSeconds: 90 * 86400 });
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
  console.log(`سایت شاگردان: http://localhost:${PORT}`);
  console.log(`دیتابیس: ${db.DB_PATH}`);
});
