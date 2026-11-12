'use strict';
/*
 * داده اولیه: فقط حساب مربی.
 * هیچ شاگرد، تمرین، اطلاعیه یا آمار ساختگی ایجاد نمی‌شود.
 * فقط وقتی اجرا می‌شود که دیتابیس خالی باشد.
 */

const db = require('./db');

const DEMO = {
  coach: { username: 'arsalan', password: 'arsalan123', full_name: 'ارسلان کیانی' },
  memberPassword: '123456'
};

function seedIfEmpty() {
  const existing = db.get('SELECT COUNT(*) AS c FROM users');
  if (existing && existing.c > 0) {
    return { seeded: false, coach: db.findByUsername(DEMO.coach.username) };
  }

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
    style: 'کاراته',
    experience: '۲۰ سال',
    avatar_color: '#e2483d',
    notes: 'مربی و بنیان‌گذار باشگاه ارسلان دوجو',
    join_date: ts.slice(0, 10)
  }, 'coach');

  db.db.exec('COMMIT');
  return { seeded: true, coach, members: [] };
}

module.exports = { seedIfEmpty, DEMO };
