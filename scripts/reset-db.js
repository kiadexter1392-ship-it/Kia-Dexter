'use strict';
/* ابزار تخریبیِ توسعه؛ سرورها خاموش و نسخهٔ پشتیبان موجود باشد. */
const fs = require('node:fs');
const path = require('node:path');

if (process.env.NODE_ENV === 'production' || !process.argv.includes('--confirm-delete')) {
  console.error('حذف لغو شد. فقط در توسعه، پس از پشتیبان‌گیری و خاموش‌کردن سرور: npm run reset-db -- --confirm-delete');
  process.exit(1);
}
const dir = process.env.ARSLAN_DATA_DIR || path.join(__dirname, '..', 'data');
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
let removed = 0;
for (const f of files) {
  if (/^arslan-dojo\.db/.test(f)) {
    fs.unlinkSync(path.join(dir, f));
    removed += 1;
  }
}
console.log(removed ? `${removed} فایل دیتابیس پاک شد — در اجرای بعد هیچ دادهٔ نمونه یا حساب پیش‌فرضی ساخته نمی‌شود.` : 'دیتابیسی برای پاک‌کردن پیدا نشد.');
