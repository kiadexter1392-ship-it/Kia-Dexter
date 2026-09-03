'use strict';
/* پاک‌کردن دیتابیس و بازگرداندن داده نمونه (سرورها باید خاموش باشند) */
const fs = require('node:fs');
const path = require('node:path');

const dir = process.env.ARSLAN_DATA_DIR || path.join(__dirname, '..', 'data');
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
let removed = 0;
for (const f of files) {
  if (/^arslan-dojo\.db/.test(f)) {
    fs.unlinkSync(path.join(dir, f));
    removed += 1;
  }
}
console.log(removed ? `${removed} فایل دیتابیس پاک شد — با اجرای دوباره، داده نمونه ساخته می‌شود.` : 'دیتابیسی برای پاک‌کردن پیدا نشد.');
