# اپ موبایل ارسلان دوجو

اپ موبایل مستقل (مثل دیجی‌کالا و ChatGPT) با React Native و Expo.

## ویژگی‌ها:
- لاگین/ثبت‌نام
- پنل مربی: مدیریت شاگردان، تمرینات، اطلاعیه‌ها
- پنل شاگرد: مشاهده تمرینات، وضعیت پیشرفت
- تم طلایی/خاکستری
- ذخیره امن توکن در SecureStore

## نصب و اجرا:

### ۱. نصب وابستگی‌ها:
```bash
cd mobile
npm install
```

### ۲. اجرای اپ:
```bash
npm start
```

### ۳. اجرا روی گوشی:
- **اندروید:** Expo Go app رو از Play Store نصب کن، QR code رو اسکن کن
- **iOS:** Expo Go app رو از App Store نصب کن

### ۴. بیلد APK:
```bash
eas build --platform android
```

## تغییر آدرس سرور:
توی `src/services/api.js`، `API_BASE` رو تغییر بده به آدرس Railway خودت.
