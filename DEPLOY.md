# 🚀 راهنمای دیپلوی برای ارسال به کارفرما

## گزینه ۱: Railway (ساده‌ترین - رایگان)

### مراحل:
1. وارد [railway.app](https://railway.app) بشو
2. با اکانت GitHub لاگین کن
3. دکمه **New Project** → **Deploy from GitHub repo**
4. ریپوی `Kia-Dexter` رو انتخاب کن
5. Railway خودش Node.js رو تشخیص میده
6. بعد از دیپلوی، یه لینک عمومی مثل `https://arslan-dojo-production.up.railway.app` می‌گیری
7. این لینک رو برای کارفرما بفرست!

### تنظیمات Railway:
- **Start Command:** `npm start`
- **Port:** Railway خودش پورت رو تنظیم می‌کنه (از `PORT` env استفاده کن)

---

## گزینه ۲: Render (رایگان)

### مراحل:
1. وارد [render.com](https://render.com) بشو
2. با GitHub لاگین کن
3. **New +** → **Web Service**
4. ریپوی `Kia-Dexter` رو انتخاب کن
5. تنظیمات:
   - **Name:** `arslan-dojo`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node start.js`
6. دکمه **Create Web Service** رو بزن
7. بعد از چند دقیقه، لینک آماده‌ست!

---

## گزینه ۳: VPS (برای پروژه واقعی و دائمی)

### سرورهای پیشنهادی:
- **Hetzner** (آلمان): ماهانه ~۴ یورو - [hetzner.com](https://hetzner.com)
- **Liara** (ایران): ماهانه ~۱۰۰ هزار تومان - [liara.ir](https://liara.ir)
- **DigitalOcean**: ماهانه ~۶ دلار - [digitalocean.com](https://digitalocean.com)

### مراحل دیپلوی روی VPS:

```bash
# 1. اتصال به سرور
ssh root@YOUR_SERVER_IP

# 2. نصب Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 3. کپی پروژه
git clone https://github.com/YOUR_USERNAME/Kia-Dexter.git
cd Kia-Dexter

# 4. نصب وابستگی‌ها
npm install --production

# 5. اجرای سایت
node start.js

# 6. (اختیاری) اجرای دائمی با PM2
npm install -g pm2
pm2 start start.js --name "arslan-dojo"
pm2 save
pm2 startup
```

### تنظیم دامنه:
اگه دامنه داری (مثل `arslandujo.ir`)، می‌تونی با Nginx یا Caddy سایت رو پشت دامنه بذاری.

---

## 🔧 تغییرات لازم برای دیپلوی

### 1. پورت داینامیک
کد الان از `PORT` environment variable استفاده می‌کنه، پس روی Railway/Render کار می‌کنه.

### 2. دیتابیس
دیتابیس SQLite روی دیسک ذخیره می‌شه. روی Railway/Render، دیتابیس با هر دیپلوی جدید پاک **نمی‌شه** (چون persistent storage دارن).

### 3. HTTPS
Railway و Render خودشون HTTPS رو فعال می‌کنن.

---

## 📤 بعد از دیپلوی

لینک سایت رو برای کارفرما بفرست همراه با:
- آدرس پنل مربی: `https://yoursite.com` (پورت 4173)
- آدرس پنل شاگردان: `https://yoursite.com` (پورت 4174)
- نام کاربری مربی: `arsalan`
- رمز مربی: `arsalan123`

**نکته:** برای امنیت بیشتر، بعد از دیپلوی رمز مربی رو عوض کن!

---

## 💡 نکات مهم

1. **حجم پروژه:** این پروژه خیلی سبکه (~2MB) و روی همه پلن‌های رایگان اجرا می‌شه
2. **دیتابیس:** SQLite هست و نیازی به دیتابیس خارجی نداره
3. **Node.js:** نسخه 22.5 یا بالاتر لازم داره (Railway و Render هر دو پشتیبانی می‌کنن)
4. **بدون وابستگی:** هیچ `npm install` برای اجرا لازم نیست (به جز jsdom برای تست)
