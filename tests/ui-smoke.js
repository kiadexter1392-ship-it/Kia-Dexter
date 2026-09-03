/* ============================================================
   تست خودکار رابط کاربری دو سایت
   هر دو سرور باید در حال اجرا باشند (npm start)
   اجرا: node tests/ui-smoke.js
   ============================================================ */
'use strict';

const { JSDOM, VirtualConsole } = require('jsdom');

const COACH = process.env.COACH_URL || 'http://localhost:4173';
const MEMBER = process.env.MEMBER_URL || 'http://localhost:4174';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    failures.push(name + (extra ? ' — ' + extra : ''));
    console.log(`  ✘ ${name} ${extra}`);
  }
}

async function login(base, username, password) {
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`login failed: ${body.error}`);
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie()[0] : res.headers.get('set-cookie');
  return setCookie.split(';')[0];
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(fn, timeout = 8000, step = 120) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    let out = null;
    try { out = fn(); } catch { out = null; }
    if (out) return out;
    await sleep(step);
  }
  return null;
}

/** صفحه را با jsdom باز می‌کند و همه درخواست‌های API را با کوکی واقعی به سرور می‌فرستد */
async function openPage(url, cookie) {
  // خودِ صفحه را هم با کوکی می‌گیریم تا ریدایرکت «وارد نشده» اتفاق نیفتد
  const pageRes = await fetch(url, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  if (pageRes.status >= 300 && pageRes.status < 400) {
    throw new Error(`صفعه ${url} به ${pageRes.headers.get('location')} ریدایرکت شد (کوکی معتبر نیست)`);
  }
  const html = await pageRes.text();

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (!/Not implemented|Could not parse CSS|Could not load link/i.test(e.message)) console.log('   [jsdom]', e.message);
  });
  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = (input, init = {}) => {
        const target = typeof input === 'string' ? new URL(input, window.location.href).href : input;
        const headers = { ...(init.headers || {}) };
        if (cookie) headers.cookie = cookie;
        return fetch(target, { ...init, headers, redirect: 'follow' });
      };
      window.open = () => null;
      window.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = function () {};
    }
  });
  return dom;
}

async function coachTests() {
  console.log('\n=== سایت ۱: پنل مربی ===');
  const cookie = await login(COACH, 'arsalan', 'arsalan123');
  check('ورود مربی و دریافت کوکی', !!cookie);

  const dom = await openPage(`${COACH}/dashboard`, cookie);
  const { window } = dom;
  const doc = window.document;

  const stats = await waitFor(() => {
    const n = doc.querySelectorAll('#view-overview .stat').length;
    return n >= 4 ? n : null;
  });
  check('داشبورد با کارت‌های آماری رندر شد', !!stats, stats ? `(${stats} کارت)` : 'چیزی رندر نشد');

  const title = doc.getElementById('todayLabel') ? doc.getElementById('todayLabel').textContent : '';
  check('تاریخ شمسی در بالای داشبورد', /[۰-۹]{4}/.test(title), title);

  // رفتن به بخش شاگردان
  doc.querySelector('.nav-item[data-view="members"]').click();
  const rows = await waitFor(() => {
    const n = doc.querySelectorAll('#view-members tbody tr').length;
    return n > 0 ? n : null;
  });
  check('فهرست شاگردان از سرور بارگذاری شد', !!rows, rows ? `(${rows} ردیف)` : '');

  const firstMemberBtn = doc.querySelector('#view-members [data-view-member]');
  check('دکمه پروفایل شاگرد وجود دارد', !!firstMemberBtn);

  // بخش تمرینات
  doc.querySelector('.nav-item[data-view="plans"]').click();
  const planCards = await waitFor(() => {
    const n = doc.querySelectorAll('#view-plans [data-plan]').length;
    return n > 0 ? n : null;
  });
  check('تمرینات ارسال‌شده نمایش داده شد', !!planCards, planCards ? `(${planCards} تمرین)` : '');

  const detailBtn = doc.querySelector('#view-plans [data-plan-detail]');
  if (detailBtn) {
    detailBtn.click();
    const modalTable = await waitFor(() => doc.querySelectorAll('.overlay table tbody tr').length > 0);
    check('مودال جزئیات تمرین با وضعیت شاگردان باز شد', !!modalTable);
    window.UI.closeModal();
  }

  // بخش جدول پیشرفت — حالت شاگرد
  doc.querySelector('.nav-item[data-view="progress"]').click();
  const gridInputs = await waitFor(() => {
    const n = doc.querySelectorAll('#progressGrid input').length;
    return n > 50 ? n : null;
  });
  check('جدول ماهانه پیشرفت با خانه‌های ورودی رندر شد', !!gridInputs, gridInputs ? `(${gridInputs} خانه)` : '');

  const overallCells = doc.querySelectorAll('#progressGrid tr:nth-last-child(2) .heat').length;
  check('ردیف نمره کل در جدول ماهانه', overallCells === 12, `${overallCells} خانه`);

  // تغییر یک عدد و ذخیره خودکار
  const target = doc.querySelector('#progressGrid input[data-m="3"][data-k="strength"]');
  if (target) {
    const memberId = doc.querySelector('#memberSel').value;
    target.value = '88';
    target.dispatchEvent(new window.Event('change', { bubbles: true }));
    await sleep(900);
    const chk = await fetch(`${COACH}/api/progress?user_id=${memberId}&year=${new Date().getFullYear()}`, { headers: { cookie } });
    void chk;
    const saved = await (await fetch(`${COACH}/api/progress?user_id=${memberId}`, { headers: { cookie } })).json();
    check('تغییر عدد در جدول، سمت سرور ذخیره شد', !!saved.ok);
  }
  check('خانه ورودی جدول پیشرفت پیدا شد', !!target);

  // حالت نمای کلی باشگاه
  doc.querySelector('#view-progress [data-mode="club"]').click();
  const heatCells = await waitFor(() => {
    const n = doc.querySelectorAll('#view-progress [data-cell]').length;
    return n > 50 ? n : null;
  });
  check('جدول سالانه باشگاه (خانه‌های حرارتی) رندر شد', !!heatCells, heatCells ? `(${heatCells} خانه)` : '');

  // اطلاع‌رسانی
  doc.querySelector('.nav-item[data-view="news"]').click();
  const annCards = await waitFor(() => {
    const n = doc.querySelectorAll('#newsBody .card').length;
    return n > 0 ? n : null;
  });
  check('فهرست اطلاعیه‌ها رندر شد', !!annCards);

  doc.querySelector('#view-news [data-tab="compose"]').click();
  const composeForm = await waitFor(() => !!doc.querySelector('#annForm'));
  check('فرم انتشار اطلاعیه باز شد', !!composeForm);
  check('لیست گیرندگان در فرم اطلاعیه', doc.querySelectorAll('#annForm .pick').length > 0);

  doc.querySelector('#view-news [data-tab="message"]').click();
  const msgForm = await waitFor(() => !!doc.querySelector('#msgForm'));
  check('فرم پیام مستقیم باز شد', !!msgForm);
  check('لیست گیرندگان در فرم پیام مستقیم', doc.querySelectorAll('#msgForm .pick').length > 0);

  // تنظیمات
  doc.querySelector('.nav-item[data-view="settings"]').click();
  const profileForm = await waitFor(() => !!doc.querySelector('#profileForm'));
  check('فرم پروفایل مربی رندر شد', !!profileForm);

  dom.window.close();
}

async function memberTests() {
  console.log('\n=== سایت ۲: پنل شاگردان ===');

  // ثبت‌نام کاربر تازه (ثابت‌ماندگاری اطلاعات)
  const username = 'test' + Date.now().toString().slice(-6);
  const reg = await fetch(`${MEMBER}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'کاربر تست رابط', username, password: 'test1234', password2: 'test1234',
      age: 20, weight_kg: 72, height_cm: 175, belt: 'سفید', phone: '09120000001'
    })
  });
  const regBody = await reg.json();
  check('ثبت‌نام شاگرد جدید از طریق API', regBody.ok === true, regBody.error || '');

  // ورود دوباره با همان نام کاربری => اطلاعات نپریده است
  const cookie = await login(MEMBER, username, 'test1234');
  check('ورود مجدد با حساب ثبت‌شده', !!cookie);

  const dom = await openPage(`${MEMBER}/panel`, cookie);
  const { window } = dom;
  const doc = window.document;

  const home = await waitFor(() => doc.querySelectorAll('#view-home .stat').length >= 4);
  check('خانه پنل شاگرد رندر شد', !!home);

  const greet = doc.querySelector('#view-home .bold') ? doc.querySelector('#view-home .bold').textContent : '';
  check('نام شاگرد در خوش‌آمدگویی', greet.includes('کاربر تست'), greet);

  doc.querySelector('.nav-item[data-view="progress"]').click();
  const table = await waitFor(() => doc.querySelectorAll('#view-progress table tbody tr').length >= 5);
  check('جدول پیشرفت ۱۲ ماهه رندر شد', !!table);
  const monthHeaders = doc.querySelectorAll('#view-progress thead th').length;
  check('جدول شامل ۱۲ ماه شمسی + ستون شاخص', monthHeaders === 13, `${monthHeaders} ستون`);

  const selfBtn = doc.querySelector('#view-progress #selfBtn');
  check('دکمه ثبت خودارزیابی وجود دارد', !!selfBtn);
  if (selfBtn) {
    selfBtn.click();
    const form = await waitFor(() => !!doc.querySelector('#selfForm'));
    check('فرم خودارزیابی باز شد', !!form);
    if (form) {
      const saveBtn = [...doc.querySelectorAll('.overlay .modal-actions .btn')].find((b) => b.textContent.includes('ثبت'));
      check('دکمه ثبت خودارزیابی در مودال', !!saveBtn);
      if (saveBtn) { saveBtn.click(); await sleep(800); }
    }
  }

  doc.querySelector('.nav-item[data-view="news"]').click();
  const newsBody = await waitFor(() => doc.querySelector('#newsBody').textContent.length > 10);
  check('بخش اطلاعیه‌ها رندر شد', !!newsBody);

  doc.querySelector('.nav-item[data-view="profile"]').click();
  const profile = await waitFor(() => !!doc.querySelector('#profileForm'));
  check('فرم پروفایل شاگرد رندر شد', !!profile);

  dom.window.close();
  return username;
}

(async function main() {
  console.log('تست رابط کاربری — باشگاه آنلاین ارسلان دوجو');
  try {
    await coachTests();
    const u = await memberTests();

    // بررسی ثابت‌ماندگاری: کاربر تست هنوز در دیتابیس هست؟
    const coachCookie = await login(COACH, 'arsalan', 'arsalan123');
    const list = await fetch(`${COACH}/api/members?q=${encodeURIComponent(u)}`, { headers: { cookie: coachCookie } });
    const listBody = await list.json();
    check('شاگرد ثبت‌شده در فهرست مربی دیده می‌شود (اطلاعات نپریده)', listBody.members.some((m) => m.username === u));

    // پاک‌کردن کاربر تست تا فهرست شاگردان تمیز بماند
    const victim = listBody.members.find((m) => m.username === u);
    if (victim) {
      await fetch(`${COACH}/api/members/${victim.id}`, { method: 'DELETE', headers: { cookie: coachCookie } });
      console.log(`  ↺ کاربر تست (${u}) پاک شد`);
    }

    console.log(`\nنتیجه: ${passed} موفق، ${failed} ناموفق`);
    if (failed) {
      console.log('موارد ناموفق:\n - ' + failures.join('\n - '));
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('\nخطای غیرمنتظره:', err);
    process.exit(1);
  }
}());
