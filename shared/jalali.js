'use strict';
/*
 * تبدیل تاریخ میلادی <-> شمسی (الگوریتم استاندارد jalaali)
 * بدون هیچ وابستگی بیرونی.
 */

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function div(a, b) { return ~~(a / b); }
function mod(a, b) { return a - ~~(a / b) * b; }

function jalCal(jy) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;

  if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال شمسی نامعتبر: ' + jy);

  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/** میلادی -> شمسی */
function toJalali(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d2j(g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()));
}

/** شمسی -> میلادی */
function toGregorian(jy, jm, jd) {
  const g = d2g(j2d(jy, jm, jd));
  return new Date(g.gy, g.gm - 1, g.gd);
}

function isJalaliLeap(jy) { return jalCal(jy).leap === 0; }
function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function faNum(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

function enNum(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** مثال خروجی: ۱۲ شهریور ۱۴۰۵ */
function formatJalali(date, withTime = false) {
  const d = date instanceof Date ? date : new Date(date);
  const j = toJalali(d);
  let out = faNum(j.jd) + ' ' + JALALI_MONTHS[j.jm - 1] + ' ' + faNum(j.jy);
  if (withTime) out += ' — ' + faNum(pad2(d.getHours()) + ':' + pad2(d.getMinutes()));
  return out;
}

/** مثال خروجی: ۱۴۰۵/۰۶/۱۲ */
function formatJalaliShort(date) {
  const j = toJalali(date instanceof Date ? date : new Date(date));
  return faNum(j.jy + '/' + pad2(j.jm) + '/' + pad2(j.jd));
}

function jalaliWeekday(date) {
  const d = date instanceof Date ? date : new Date(date);
  // getDay(): 0=یکشنبه ... 6=شنبه
  const map = [1, 2, 3, 4, 5, 6, 0];
  return WEEKDAYS[map[d.getDay()]];
}

function todayJalali() {
  return toJalali(new Date());
}

/** فاصله زمانی به فارسی: «۳ ساعت پیش» */
function timeAgo(date) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'همین حالا';
  if (m < 60) return faNum(m) + ' دقیقه پیش';
  const h = Math.floor(m / 60);
  if (h < 24) return faNum(h) + ' ساعت پیش';
  const d = Math.floor(h / 24);
  if (d < 30) return faNum(d) + ' روز پیش';
  return formatJalaliShort(date);
}

/**
 * چون تاریخ‌ها در دیتابیس به صورت میلادی ذخیره می‌شوند،
 * این تابع «ماه شمسی» یک رکورد را برمی‌گرداند.
 */
function jalaliOfNow() {
  const j = todayJalali();
  return { year: j.jy, month: j.jm };
}

module.exports = {
  JALALI_MONTHS,
  WEEKDAYS,
  toJalali,
  toGregorian,
  jalaliMonthLength,
  isJalaliLeap,
  faNum,
  enNum,
  pad2,
  formatJalali,
  formatJalaliShort,
  jalaliWeekday,
  todayJalali,
  jalaliOfNow,
  timeAgo
};
