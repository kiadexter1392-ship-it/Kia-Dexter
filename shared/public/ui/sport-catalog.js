/* General sporting information, not claims about the academy, its members or coaches. */
(function () {
  'use strict';
  const catalog = {
    karate: { title:'کاراته',description:'هنر رزمی ژاپنی با تمرین کیهون (تکنیک‌های پایه)، کاتا (فرم) و کومیته (مبارزه). سبک و قواعد تمرین باید با مربی هماهنگ شود.',legends:'گیچین فوناکوشی و کنوا مابونی از چهره‌های تأثیرگذار تاریخی این رشته‌اند.',query:'karate kihon basic punches blocks beginner kata' },
    crossfit: {title:'کراسفیت',description:'تمرینات عملکردی متنوع با ترکیبی از قدرت، مهارت و آمادگی هوازی. شدت و بار تمرین باید متناسب با سطح فرد تنظیم شود.',legends:'مت فریزر و تیا کلر تومی از چهره‌های شناخته‌شدهٔ مسابقات کراسفیت‌اند.',query:'CrossFit foundational movements beginner squat technique'},
    boxing: {title:'بوکس',description:'ورزش مبارزه‌ای مبتنی بر ضربات مشت، گارد، جابه‌جایی و دفاع؛ استفاده از تجهیزات محافظ و آموزش زیر نظر مربی ضروری است.',legends:'محمدعلی کلی و مایک تایسون از نام‌های شناخته‌شدهٔ تاریخ بوکس‌اند.',query:'boxing beginner stance jab cross footwork'},
    gym: {title:'ژیمناستیک',description:'مجموعه‌ای از تمرینات تعادل، هماهنگی، انعطاف و قدرت. حرکات پرخطر و آکروباتیک فقط با مربی و تجهیزات ایمن تمرین شوند.',legends:'سیمون بایلز و کوهی اوچیمورا از چهره‌های شناخته‌شدهٔ ژیمناستیک هنری‌اند.',query:'gymnastics beginner basic shapes safety'},
    muaythai: {title:'موی تای',description:'هنر رزمی تایلندی با تکنیک‌های مشت، لگد، زانو و آرنج و تمرین کلینچ. مبارزه و حرکات برخوردی باید زیر نظر مربی انجام شوند.',legends:'بوآکاو و سنچای از چهره‌های شناخته‌شدهٔ موی تای‌اند.',query:'Muay Thai beginner basic punches teep roundhouse kick'}
  };
  async function show(id) {
    const info=catalog[id];if(!info||!window.UI)return;
    const e=UI.esc;
    const modal=UI.modal({title:info.title,body:`<p>${e(info.description)}</p><h4>چهره‌های شناخته‌شدهٔ جهان</h4><p>${e(info.legends)}</p><p class="tiny">این معرفی عمومی است؛ این افراد مربی یا عضو آکادمی معرفی نمی‌شوند. عکس کارت‌ها نمادین است.</p><p><a href="https://www.youtube.com/results?search_query=${encodeURIComponent(info.query)}" target="_blank" rel="noopener noreferrer">جست‌وجوی آموزش‌های پایه در یوتیوب</a></p><p class="hint">ویدیو جایگزین آموزش حضوری و بررسی ایمنی توسط مربی نیست.</p><div id="sportAcademyDetails">در حال دریافت محتوای ثبت‌شدهٔ مربی…</div><a class="btn" href="${UI.PATH_PREFIX}/academy#sports">رشته‌ها و آموزش‌های آکادمی</a>`});
    try {
      const data=await UI.api('/api/academy/records/sports');
      const row=data.records.find(r=>r.data.title===info.title);
      if(!modal.isConnected)return;
      const body=modal.querySelector('#sportAcademyDetails');
      body.innerHTML=row?`<h4>محتوای ثبت‌شدهٔ مربی</h4><p>${e(row.data.description)}</p>${['video_url','basics_url'].filter(k=>row.data[k]).map(k=>`<p><a href="${e(row.data[k])}" target="_blank" rel="noopener noreferrer">${k==='video_url'?'ویدیوی تمرینات آکادمی':e(row.data.basics_title||'آموزش پایهٔ انتخاب‌شده توسط مربی')}</a></p>`).join('')}`:'<p>هنوز ویدیو یا معرفی اختصاصی آکادمی برای این رشته ثبت نشده است.</p>';
    }catch(error){if(modal.isConnected)modal.querySelector('#sportAcademyDetails').textContent=error.message;}
  }
  window.SportCatalog={show,catalog};
})();
