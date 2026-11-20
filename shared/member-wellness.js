'use strict';
// Private member-only progress and meal-plan features. No public credentials.
const db = require('./db');
const { rateLimit } = require('./server');

db.execWithRetry(`
CREATE TABLE IF NOT EXISTS member_progress_logs (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 category TEXT NOT NULL, title TEXT NOT NULL, duration INTEGER, weight REAL, readiness INTEGER,
 note TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS member_progress_logs_owner ON member_progress_logs(user_id,id);
CREATE TABLE IF NOT EXISTS member_meal_plans (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS member_meal_plans_owner ON member_meal_plans(user_id,id);
`);
const text = (v, max) => typeof v === 'string' ? v.trim().slice(0,max) : '';
function bounded(value, min, max, integer = false) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && (!integer || Number.isInteger(n)) && n >= min && n <= max ? n : NaN;
}
function safeWrite(ctx) {
  if (ctx.req.headers['x-wellness-request'] !== '1') return false;
  const origin = ctx.req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === (ctx.req.headers['x-dojo-origin-host'] || ctx.req.headers.host); } catch { return false; }
}
function direct(ctx, needMember) {
  const u = needMember(ctx);
  if (!u) return null;
  if (u.impersonated || !u.verified) { ctx.json({ok:false,error:'برای این بخش ورود مستقیم به حساب تأییدشده لازم است'},403); return null; }
  return u;
}
async function generateMealPlan(request, key, fetcher = fetch) {
  const prompt = `به فارسی پیشنهاد غذایی عمومی و غیرپزشکی ارائه کن. از ارائه رژیم درمانی، وعده کاهش وزن سریع یا تشخیص بیماری خودداری کن. اعداد تغذیه‌ای فقط تخمینی‌اند و فاقد قطعیت. اگر اطلاعات برای پیشنهاد امن کافی نیست راهنمایی به متخصص تغذیه را توضیح بده. خروجی JSON شامل title و summary و meals (آرایه حداکثر ۶ مورد؛ هر مورد title و foods رشته) باشد. تعداد وعده درخواستی: ${request.meals}. هدف: ${request.goal}. غذاهای موردنظر: ${request.foods}. محدودیت‌های غذایی: ${request.restrictions}. توضیحات: ${request.notes}`;
  const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:2048}}),
    signal:AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error('provider failure');
  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.map(p=>p.text || '').join('');
  let result; try { result=JSON.parse(raw); } catch { throw new Error('invalid provider response'); }
  if (!result || !text(result.title,200) || !text(result.summary,4000) || !Array.isArray(result.meals) || result.meals.length < 1 || result.meals.length > 6) throw new Error('invalid provider response');
  const meals=result.meals.map(m=>({title:text(m?.title,100),foods:text(m?.foods,1200)}));
  if (meals.some(m=>!m.title || !m.foods)) throw new Error('invalid provider response');
  return {title:text(result.title,200),summary:text(result.summary,4000),meals};
}
function mount(app, needMember) {
  app.get('/api/wellness/progress',ctx=>{const u=direct(ctx,needMember);if(!u)return;ctx.json({ok:true,logs:db.all('SELECT id,category,title,duration,weight,readiness,note,created_at FROM member_progress_logs WHERE user_id=? ORDER BY id DESC LIMIT 100',u.id)});});
  app.post('/api/wellness/progress',ctx=>{
    const u=direct(ctx,needMember);if(!u)return;
    if(!safeWrite(ctx))return ctx.json({ok:false,error:'درخواست امن معتبر نیست'},403);
    const b=ctx.body || {}, title=text(b.title,120), note=text(b.note,1000), category=b.category;
    const duration=bounded(b.duration,0,1440,true), weight=bounded(b.weight,10,400), readiness=bounded(b.readiness,0,100,true);
    if(!title || !['workout','milestone'].includes(category) || [duration,weight,readiness].some(Number.isNaN))return ctx.json({ok:false,error:'اطلاعات تمرین معتبر نیست'},400);
    const info=db.run('INSERT INTO member_progress_logs(user_id,category,title,duration,weight,readiness,note,created_at) VALUES (?,?,?,?,?,?,?,?)',u.id,category,title,duration,weight,readiness,note,db.now());
    ctx.json({ok:true,id:Number(info.lastInsertRowid)});
  });
  app.post('/api/wellness/progress/:id/delete',ctx=>{
    const u=direct(ctx,needMember);if(!u)return;
    if(!safeWrite(ctx))return ctx.json({ok:false,error:'درخواست امن معتبر نیست'},403);
    const id=Number(ctx.params.id);if(!Number.isSafeInteger(id)||id<1)return ctx.json({ok:false,error:'شناسه معتبر نیست'},400);
    const result=db.run('DELETE FROM member_progress_logs WHERE id=? AND user_id=?',id,u.id);
    if(!result.changes)return ctx.json({ok:false,error:'سابقه پیدا نشد'},404);
    ctx.json({ok:true});
  });
  app.get('/api/wellness/meals',ctx=>{const u=direct(ctx,needMember);if(!u)return;ctx.json({ok:true,available:!!process.env.GEMINI_API_KEY,plans:db.all('SELECT id,title,content,created_at FROM member_meal_plans WHERE user_id=? ORDER BY id DESC LIMIT 30',u.id).map(r=>({...r,content:JSON.parse(r.content)}))});});
  app.post('/api/wellness/meals',async ctx=>{
    const u=direct(ctx,needMember);if(!u)return;
    if(!safeWrite(ctx))return ctx.json({ok:false,error:'درخواست امن معتبر نیست'},403);
    if(!process.env.GEMINI_API_KEY)return ctx.json({ok:false,error:'سرویس هوش مصنوعی هنوز در سرور تنظیم نشده است'},503);
    const b=ctx.body || {}, request={goal:text(b.goal,300),foods:text(b.foods,1000),restrictions:text(b.restrictions,1000),notes:text(b.notes,1000),meals:bounded(b.meals,3,6,true)};
    if(b.consent!==true || b.adult!==true || (u.age && u.age<18) || !request.goal || request.meals===null || Number.isNaN(request.meals))return ctx.json({ok:false,error:'تأیید بزرگسال بودن، رضایت ارسال اطلاعات و هدف و تعداد وعده معتبر لازم است'},400);
    if(!rateLimit('wellness-meal:'+u.id,5,3600000))return ctx.json({ok:false,error:'تعداد درخواست‌ها بیش از حد مجاز است؛ بعداً تلاش کنید'},429);
    try {
      const result=await generateMealPlan(request,process.env.GEMINI_API_KEY);
      const info=db.run('INSERT INTO member_meal_plans(user_id,title,content,created_at) VALUES (?,?,?,?)',u.id,result.title,JSON.stringify(result),db.now());
      ctx.json({ok:true,plan:{id:Number(info.lastInsertRowid),content:result}});
    } catch {ctx.json({ok:false,error:'دریافت برنامه از سرویس هوش مصنوعی انجام نشد؛ بعداً تلاش کنید'},502);}
  });
  app.post('/api/wellness/meals/:id/delete',ctx=>{
    const u=direct(ctx,needMember);if(!u)return;
    if(!safeWrite(ctx))return ctx.json({ok:false,error:'درخواست امن معتبر نیست'},403);
    const id=Number(ctx.params.id);if(!Number.isSafeInteger(id)||id<1)return ctx.json({ok:false,error:'شناسه معتبر نیست'},400);
    const result=db.run('DELETE FROM member_meal_plans WHERE id=? AND user_id=?',id,u.id);
    if(!result.changes)return ctx.json({ok:false,error:'برنامه پیدا نشد'},404);
    ctx.json({ok:true});
  });
}
module.exports={mount,generateMealPlan};
