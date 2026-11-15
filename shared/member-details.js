'use strict';
const { enNum, toGregorian, jalaliMonthLength } = require('./jalali');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

// Store date-only ISO values, while accepting the Jalali dates used in Persian forms.
// Validate in the data layer so member and coach create/update routes behave alike.
function normalizeMemberDetails(data) {
  const fields = {};
  if (data.blood_group !== undefined) {
    const group = String(data.blood_group || '').trim().toUpperCase();
    if (group && !BLOOD_GROUPS.includes(group)) invalid('گروه خونی معتبر نیست');
    fields.blood_group = group || null;
  }
  if (data.birth_date !== undefined) {
    const raw = enNum(String(data.birth_date || '').trim());
    if (!raw) fields.birth_date = null;
    else {
      if (!/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(raw)) invalid('تاریخ تولد را کامل وارد کنید؛ مانند ۱۳۹۰/۰۵/۲۱');
      let [year, month, day] = raw.split(/[/-]/).map(Number);
      if (year >= 1200 && year <= 1600) {
        if (month < 1 || month > 12 || day < 1 || day > jalaliMonthLength(year, month)) invalid('تاریخ تولد معتبر نیست');
        const g = toGregorian(year, month, day);
        year = g.getFullYear(); month = g.getMonth() + 1; day = g.getDate();
      }
      if (year < 1800 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) invalid('تاریخ تولد معتبر نیست');
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) invalid('تاریخ تولد معتبر نیست');
      const iso = date.toISOString().slice(0, 10);
      if (iso > new Date().toISOString().slice(0, 10)) invalid('تاریخ تولد نمی‌تواند در آینده باشد');
      fields.birth_date = iso;
    }
  }
  return fields;
}
module.exports = { BLOOD_GROUPS, normalizeMemberDetails };
