'use strict';
/*
 * داده اولیه: حساب مربی و شاگردان نمونه، فقط در دیتابیس خالی.
 * نام کاربری حساب تست قدیمی بدون حذف اطلاعاتش مهاجرت می‌کند.
 */

const db = require('./db');

const DEMO = {
  coach: { username: 'arsalan', password: 'arsalan123', full_name: 'ارسلان کیانی' },
  memberPassword: '123456'
};

// Only migrate the known seeded member; never overwrite an existing kia account
// or change credentials belonging to a real member. The ID and related data stay intact.
function migrateDemoMember() {
  const legacy = db.findByUsername('ali');
  if (!legacy || legacy.role !== 'member' || legacy.full_name !== 'علی رضایی' ||
      !db.verifyPassword(DEMO.memberPassword, legacy.password_hash, legacy.password_salt)) return;
  db.run(`UPDATE users SET username = 'kia', updated_at = ?
          WHERE id = ? AND username = 'ali'
          AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'kia')`, db.now(), legacy.id);
}

function seedIfEmpty() {
  const existing = db.get('SELECT COUNT(*) AS c FROM users');
  if (existing && existing.c > 0) {
    migrateDemoMember();
    return { seeded: false, coach: db.findByUsername(DEMO.coach.username) };
  }

  db.execWithRetry('BEGIN IMMEDIATE');
  const recheck = db.get('SELECT COUNT(*) AS c FROM users');
  if (recheck && recheck.c > 0) {
    db.db.exec('ROLLBACK');
    migrateDemoMember();
    return { seeded: false, coach: db.findByUsername(DEMO.coach.username) };
  }

  const ts = db.now();
  const coach = db.createUser({
    full_name: DEMO.coach.full_name,
    username: DEMO.coach.username,
    phone: '09120000000',
    password: DEMO.coach.password,
    belt: 'مشکی دان ۴',
    style: 'کاراته',
    experience: '۲۰ سال',
    avatar_color: '#e2483d',
    notes: 'مربی و بنیان‌گذار باشگاه ارسلان دوجو',
    join_date: ts.slice(0, 10)
  }, 'coach');

  /* ساخت چند شاگرد نمونه برای تست */
  const demoMembers = [
    { full_name: 'علی رضایی', username: 'kia', gender: 'مرد', discipline: 'کاراته', belt: 'سبز', age: 16 },
    { full_name: 'مریم احمدی', username: 'maryam', gender: 'زن', discipline: 'ژیمناستیک', belt: 'زرد', age: 14 },
    { full_name: 'حسین محمدی', username: 'hossein', gender: 'مرد', discipline: 'بوکس', belt: 'سفید', age: 18 },
    { full_name: 'زهرا کریمی', username: 'zahra', gender: 'زن', discipline: 'موی تای', belt: 'نارنجی', age: 20 },
    { full_name: 'امیر حسینی', username: 'amir', gender: 'مرد', discipline: 'کراسفیت', belt: 'آبی', age: 22 },
  ];

  const members = demoMembers.map((m) => {
    return db.createUser({
      full_name: m.full_name,
      username: m.username,
      password: DEMO.memberPassword,
      gender: m.gender,
      discipline: m.discipline,
      belt: m.belt,
      age: m.age,
      join_date: ts.slice(0, 10)
    }, 'member');
  });

  db.db.exec('COMMIT');
  return { seeded: true, coach, members };
}

module.exports = { seedIfEmpty, DEMO };
