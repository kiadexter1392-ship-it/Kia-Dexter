'use strict';
/*
 * داده اولیه: مربی، چند شاگرد نمونه، تمرین، جدول پیشرفت و اطلاعیه.
 * فقط وقتی اجرا می‌شود که دیتابیس خالی باشد (اطلاعات ثبت‌شده کاربران هرگز
 * پاک نمی‌شود).
 */

const db = require('./db');
const { todayJalali, JALALI_MONTHS } = require('./jalali');

const DEMO = {
  coach: { username: 'arsalan', password: 'arsalan123', full_name: 'استاد ارسلان کیانی' },
  memberPassword: '123456'
};

const MEMBERS = [
  { full_name: 'علی رضایی', username: 'ali', phone: '09121112233', age: 19, weight_kg: 74, height_cm: 178, belt: 'آبی', style: 'کیوکوشین', experience: '۲ سال', gender: 'مرد' },
  { full_name: 'محمد حسینی', username: 'mohammad', phone: '09123334455', age: 22, weight_kg: 81, height_cm: 182, belt: 'قهوه‌ای', style: 'کیوکوشین', experience: '۴ سال', gender: 'مرد' },
  { full_name: 'سارا کریمی', username: 'sara', phone: '09351112233', age: 17, weight_kg: 58, height_cm: 165, belt: 'زرد', style: 'کاراته shotokan', experience: '۱ سال', gender: 'زن' },
  { full_name: 'امیر محمدی', username: 'amir', phone: '09129998877', age: 25, weight_kg: 88, height_cm: 185, belt: 'مشکی دان ۱', style: 'کیوکوشین', experience: '۷ سال', gender: 'مرد' },
  { full_name: 'نگار احمدی', username: 'negar', phone: '09357778899', age: 15, weight_kg: 52, height_cm: 160, belt: 'سفید', style: 'کاراته shotokan', experience: '۶ ماه', gender: 'زن' },
  { full_name: 'حسین موسوی', username: 'hossein', phone: '09124445566', age: 20, weight_kg: 69, height_cm: 175, belt: 'سبز', style: 'کیوکوشین', experience: '۳ سال', gender: 'مرد' },
  { full_name: 'رضا نوروزی', username: 'reza', phone: '09126667788', age: 28, weight_kg: 92, height_cm: 188, belt: 'آبی', style: 'کیک‌بوکسینگ', experience: '۱.۵ سال', gender: 'مرد' },
  { full_name: 'مهسا شریفی', username: 'mahsa', phone: '09352223344', age: 16, weight_kg: 55, height_cm: 163, belt: 'نارنجی', style: 'کاراته shotokan', experience: '۱ سال', gender: 'زن' }
];

function rnd(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function seedIfEmpty() {
  const existing = db.get('SELECT COUNT(*) AS c FROM users');
  if (existing && existing.c > 0) {
    return { seeded: false, coach: db.findByUsername(DEMO.coach.username) };
  }

  // دو سرور ممکن است هم‌زمان بالا بیایند؛ با تراکنش انحصاری از ثبت دوباره جلوگیری می‌کنیم
  db.execWithRetry('BEGIN IMMEDIATE');
  const recheck = db.get('SELECT COUNT(*) AS c FROM users');
  if (recheck && recheck.c > 0) {
    db.db.exec('ROLLBACK');
    return { seeded: false, coach: db.findByUsername(DEMO.coach.username) };
  }

  const ts = db.now();
  const coach = db.createUser({
    full_name: DEMO.coach.full_name,
    username: DEMO.coach.username,
    phone: '09120000000',
    password: DEMO.coach.password,
    belt: 'مشکی دان ۴',
    style: 'کیوکوشین کاراته',
    experience: '۲۰ سال',
    avatar_color: '#e2483d',
    notes: 'مربی و بنیان‌گذار باشگاه ارسلان دوجو',
    join_date: ts.slice(0, 10)
  }, 'coach');

  const j = todayJalali();
  const members = MEMBERS.map((m, i) => db.createUser({ ...m, password: DEMO.memberPassword, avatar_color: undefined, join_date: ts.slice(0, 10) }, 'member'));

  /* ---- جدول پیشرفت: سال جاری تا ماه جاری + سه ماه پایانی سال قبل ---- */
  for (let mi = 0; mi < members.length; mi += 1) {
    const m = members[mi];
    const base = 45 + Math.round(rnd(mi + 1) * 25);

    // سال قبل: ماه‌های ۱۰ تا ۱۲
    for (let month = 10; month <= 12; month += 1) {
      const k = month - 10;
      db.saveProgress({
        user_id: m.id, year: j.jy - 1, month,
        sessions: 8 + Math.round(rnd(mi * 31 + month) * 8),
        endurance: base + k * 2,
        strength: base - 4 + k * 2,
        technique: base - 2 + k * 3,
        flexibility: base - 8 + k * 2,
        discipline: base + 2 + k * 2,
        weight_kg: m.weight_kg + (rnd(mi + month) > 0.5 ? 0.6 : -0.4),
        note: null
      }, coach.id);
    }

    // سال جاری: از فروردین تا ماه جاری
    for (let month = 1; month <= j.jm; month += 1) {
      const growth = month * 3 + mi % 3;
      db.saveProgress({
        user_id: m.id, year: j.jy, month,
        sessions: 10 + Math.round(rnd(mi * 17 + month) * 10),
        endurance: base + growth,
        strength: base - 4 + growth,
        technique: base - 2 + growth + 2,
        flexibility: base - 8 + Math.round(growth * 0.8),
        discipline: base + 2 + growth,
        weight_kg: Math.round((m.weight_kg + (rnd(mi + month * 3) - 0.5) * 1.6) * 10) / 10,
        note: month === j.jm ? 'روند پیشرفت مثبت است؛ روی انعطاف بیشتر کار شود.' : null
      }, coach.id);
    }
  }

  /* -------------------------------- تمرینات ------------------------------- */
  const iso = (offsetDays) => new Date(Date.now() + offsetDays * 864e5).toISOString().slice(0, 10);

  db.createPlan({
    author_id: coach.id,
    title: 'برنامه آمادگی جسمانی هفته اول',
    body: 'گرم کردن ۱۰ دقیقه\n۳ ست ۱۵ تایی شنا سوئدی\n۳ ست ۲۰ تایی اسکوات\nپلانک ۳ ست ۴۰ ثانیه‌ای\nکشش پایانی ۱۰ دقیقه',
    category: 'بدنسازی',
    difficulty: 'متوسط',
    starts_on: iso(-6),
    due_on: iso(1),
    duration: '۶۰ دقیقه',
    targets: members.slice(0, 5).map((m) => m.id)
  });

  db.createPlan({
    author_id: coach.id,
    title: 'تمرین تکنیک‌های پا (ماواشی‌گری)',
    body: 'ماواشی‌گری جلو: ۵۰ تکرار هر پا\nماواشی‌گری چرخشی: ۳۰ تکرار هر پا\nکار با کیسه: ۴ راند ۳ دقیقه‌ای\nتمرین با یار: ۱۵ دقیقه',
    category: 'تکنیک',
    difficulty: 'سنگین',
    starts_on: iso(-3),
    due_on: iso(4),
    duration: '۹۰ دقیقه',
    targets: members.slice(1, 6).map((m) => m.id)
  });

  db.createPlan({
    author_id: coach.id,
    title: 'تمرین کاتا برای کمربندهای پایین',
    body: 'کاتا تایکیوکو ۱ تا ۳\nهر کاتا ۵ بار با تمرکز روی تنفس\nفیلم اجرای خود را برای مربی ارسال کنید',
    category: 'کاتا',
    difficulty: 'سبک',
    starts_on: iso(-1),
    due_on: iso(6),
    duration: '۴۵ دقیقه',
    targets: members.filter((m) => ['سفید', 'زرد', 'نارنجی'].includes(m.belt)).map((m) => m.id)
  });

  const plans = db.listPlans();
  // چند تمرین را «انجام شده» علامت می‌زنیم تا داشبورد واقعی به نظر برسد
  if (plans[0]) {
    const a = plans[0].assignments;
    db.setAssignmentStatus(a[0].id, a[0].user_id, 'done', 'انجام شد، ست آخر کمی سخت بود.');
    if (a[1]) db.setAssignmentStatus(a[1].id, a[1].user_id, 'done', 'کامل انجام شد.');
    if (a[2]) db.setAssignmentStatus(a[2].id, a[2].user_id, 'doing', null);
  }
  if (plans[1] && plans[1].assignments[0]) {
    db.setAssignmentStatus(plans[1].assignments[0].id, plans[1].assignments[0].user_id, 'done', 'با کیسه کار کردم.');
  }

  /* ------------------------------- اطلاعیه‌ها ------------------------------ */
  db.createAnnouncement({
    author_id: coach.id,
    title: 'شروع کلاس‌های ترم پاییز',
    body: `کلاس‌های ترم جدید از هفته آینده شروع می‌شود.\nساعت کلاس بزرگسالان: شنبه و دوشنبه ۱۸ تا ۲۰\nساعت کلاس نوجوانان: یکشنبه و سه‌شنبه ۱۷ تا ۱۸:۳۰\nحضور همه شاگردان الزامی است.`,
    category: 'کلاس‌ها',
    pinned: 1,
    targets: []
  });

  db.createAnnouncement({
    author_id: coach.id,
    title: 'آزمون ارتقای کمربند',
    body: `آزمون کمربند ماه ${JALALI_MONTHS[j.jm - 1]} در هفته آخر ماه برگزار می‌شود.\nمتقاضیان تا پایان هفته فرصت دارند نام خود را به مربی اعلام کنند.\nهزینه آزمون طبق تعرفه فدراسیون است.`,
    category: 'آزمون',
    pinned: 1,
    targets: []
  });

  db.createAnnouncement({
    author_id: coach.id,
    title: 'تعطیلی سالن در روز جمعه',
    body: 'به دلیل سرویس سالن، روز جمعه کلاسی برگزار نمی‌شود. تمرینات خانگی طبق برنامه ارسال‌شده انجام شود.',
    category: 'عمومی',
    pinned: 0,
    targets: []
  });

  db.logActivity(coach.id, coach.full_name, 'سامانه راه‌اندازی شد', 'ثبت‌نام شاگردان و ارسال تمرین فعال است');

  db.db.exec('COMMIT');
  return { seeded: true, coach, members };
}

module.exports = { seedIfEmpty, DEMO };
