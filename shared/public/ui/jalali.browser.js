/* تبدیل تاریخ برای مرورگر (بدون وابستگی) — همان الگوریتم سمت سرور */
(function (root) {
  'use strict';

  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const FA = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  const div = (a, b) => ~~(a / b);
  const mod = (a, b) => a - ~~(a / b) * b;

  function jalCal(jy) {
    const bl = BREAKS.length;
    const gy = jy + 621;
    let leapJ = -14, jp = BREAKS[0], jump = 0, n, i;
    for (i = 1; i < bl; i += 1) {
      const jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    return { gy: div(j, 1461) - 100100 + div(8 - mod(div(i, 153), 12) - 1, 6), gm: mod(div(i, 153), 12) + 1, gd: div(mod(i, 153), 5) + 1 };
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
      if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
  }

  function toJalali(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d2j(g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  }

  function toGregorianISO(jy, jm, jd) {
    const g = d2g(j2d(jy, jm, jd));
    const p = (n) => String(n).padStart(2, '0');
    return `${g.gy}-${p(g.gm)}-${p(g.gd)}`;
  }

  const faNum = (v) => (v === null || v === undefined ? '' : String(v).replace(/[0-9]/g, (d) => FA[+d]));
  const enNum = (v) => (v === null || v === undefined ? '' : String(v).replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))));

  function formatJalali(input, withTime) {
    if (!input) return '—';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '—';
    const j = toJalali(d);
    let out = faNum(j.jd) + ' ' + MONTHS[j.jm - 1] + ' ' + faNum(j.jy);
    if (withTime) {
      const p = (n) => faNum(String(n).padStart(2, '0'));
      out += ' — ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    return out;
  }

  function formatShort(input) {
    if (!input) return '—';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '—';
    const j = toJalali(d);
    const p = (n) => String(n).padStart(2, '0');
    return faNum(`${j.jy}/${p(j.jm)}/${p(j.jd)}`);
  }

  function timeAgo(input) {
    if (!input) return '—';
    const diff = Date.now() - new Date(input).getTime();
    if (Number.isNaN(diff)) return '—';
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'همین حالا';
    if (m < 60) return faNum(m) + ' دقیقه پیش';
    const h = Math.floor(m / 60);
    if (h < 24) return faNum(h) + ' ساعت پیش';
    const d = Math.floor(h / 24);
    if (d < 31) return faNum(d) + ' روز پیش';
    return formatShort(input);
  }

  root.Jalali = { MONTHS, toJalali, toGregorianISO, faNum, enNum, formatJalali, formatShort, timeAgo };
}(window));
