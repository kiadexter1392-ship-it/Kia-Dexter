(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fa = value => Number(value).toLocaleString('fa-IR');
  const empty = text => `<p class="academy-empty">${esc(text || 'هنوز اطلاعاتی ثبت نشده است.')}</p>`;
  const prefix = document.body.dataset.prefix;
  const admin = /\/admin\/?$/.test(location.pathname);
  const base = prefix + (admin ? '/admin/api' : '/api/academy');
  if (admin) { $('academyTitle').textContent='مدیریت آکادمی';$('backLink').href=prefix+'/';$('backLink').textContent='صفحهٔ اصلی'; }
  let config, people = [], current = '', editing = null, currentRows = [], version = 0;
  const store = {};
  // Lightweight inline SVGs and groups, shared by all roles; permissions still
  // come only from the server schema. No icon library or fabricated counters.
  const navigationGroups = [
    { label:'اعضا و آموزش', icon:'people', kinds:['people','users','sports','coaches','classes','attendance','meetings'] },
    { label:'ارزیابی و پیشرفت', icon:'chart', kinds:['exams','monthly_scores','exam_results','evaluations','leaderboard'] },
    { label:'رویدادها و افتخارات', icon:'award', kinds:['competitions','honours','challenges','challenge_results'] },
    { label:'مالی و خدمات', icon:'wallet', kinds:['invoices','discounts','products','orders','nutrition'] },
    { label:'نظارت و سوابق', icon:'shield', kinds:['review','audit'] }
  ];
  const iconPaths = {
    people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
    chart:'<path d="M4 3v17h17M8 15v-4m5 4V6m5 9V9"/>',
    award:'<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
    wallet:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M17 12h4m-3-7V3H6a3 3 0 0 0 0 6h15"/>',
    shield:'<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>'
  };
  const groupFor = kind => navigationGroups.find(g=>g.kinds.includes(kind)) || {label:'بخش‌های آکادمی',icon:'calendar'};
  const icon = kind => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[['classes','attendance','meetings','exams'].includes(kind)?'calendar':groupFor(kind).icon]}</svg>`;
  let sectionList = [];
  const normalizeSearch = value => value.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u064b-\u065f]/g,'').trim();
  function filterNavigation() {
    const query=normalizeSearch($('navSearch').value);
    document.querySelectorAll('#academyNav button').forEach(button=>{button.hidden=!normalizeSearch(button.textContent).includes(query);});
    document.querySelectorAll('.academy-nav-group').forEach(group=>{group.hidden=![...group.querySelectorAll('button')].some(button=>!button.hidden);});
    $('navEmpty').hidden=!!document.querySelector('#academyNav button:not([hidden])');
  }
  function renderNavigation(sections) {
    sectionList=sections;
    const groups=[...navigationGroups,{label:'بخش‌های آکادمی',icon:'calendar',kinds:sections.map(([kind])=>kind).filter(kind=>!navigationGroups.some(g=>g.kinds.includes(kind)))}];
    $('academyNav').innerHTML=groups.map((group,index)=>{
      const available=sections.filter(([kind])=>group.kinds.includes(kind));
      if(!available.length)return '';
      return `<section class="academy-nav-group" aria-labelledby="navGroup${index}"><h2 id="navGroup${index}">${esc(group.label)}</h2>${available.map(([kind,label])=>`<button type="button" data-kind="${kind}">${icon(kind)}<span>${esc(label)}</span></button>`).join('')}</section>`;
    }).join('');
    $('navSearch').value='';filterNavigation();
    document.querySelectorAll('#academyNav button').forEach(button=>button.onclick=()=>{
      if(location.hash.slice(1)===button.dataset.kind)show(button.dataset.kind);
      else location.hash=button.dataset.kind;
    });
  }
  $('navSearch').oninput=filterNavigation;
  window.addEventListener('hashchange',()=>{
    const kind=decodeURIComponent(location.hash.slice(1));
    if(sectionList.some(([key])=>key===kind))show(kind);
  });

  // Only coalesce simultaneous reads, never persist private API responses.
  // Clear in-flight sharing on writes so a post-save read cannot reuse old data.
  const pendingReads = new Map();
  function api(path, method = 'GET', body) {
    if(method==='GET' && pendingReads.has(path))return pendingReads.get(path);
    if(method!=='GET')pendingReads.clear();
    const request=(async()=>{
      const response = await fetch(base + path, { method, credentials:'same-origin', headers: { 'Content-Type':'application/json','X-Academy-Request':'1' }, body:body === undefined ? undefined : JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw Object.assign(new Error(data.error || 'درخواست انجام نشد'),{status:response.status});
      return data;
    })();
    if(method==='GET') {
      pendingReads.set(path,request);
      request.finally(()=>{if(pendingReads.get(path)===request)pendingReads.delete(path);}).catch(()=>{});
    }
    return request;
  }
  function error(err) { $('academyError').textContent = err.message; }
  const referenceTypes = ['classes','challenges','exams','products'];
  let peopleIndex=new Map(),peopleTime=0;
  const referenceTime=new Map(),referenceIndex=new Map();
  function setPeople(rows){people=rows;peopleIndex=new Map(rows.map(p=>[p.id,p]));peopleTime=Date.now();}
  async function loadPeople(force=false){if(force || !peopleTime || Date.now()-peopleTime>30000)setPeople((await api('/people')).people);}
  function person(id) { return peopleIndex.get(Number(id)); }
  function setReference(kind,rows){store[kind]=rows;referenceTime.set(kind,Date.now());referenceIndex.set(kind,new Map(rows.map(r=>[r.id,r])));}
  function invalidateReferences(kind){referenceTime.delete(kind);if(kind==='orders')referenceTime.delete('products');}
  function labelFor(kind, id) { const r = referenceIndex.get(kind)?.get(Number(id)); return r ? (r.data.title || r.data.product_title || `#${id}`) : `#${id}`; }
  function format(field, value) {
    if (value === null || value === undefined || value === '') return 'ثبت نشده';
    if (field.type === 'checkbox') return value ? 'تأیید شده' : 'خیر';
    if (field.type === 'number') return fa(value);
    if (['member','coach','person'].includes(field.type)) return person(value)?.full_name || `#${value}`;
    if (field.type === 'members') return value.map(id => person(id)?.full_name || `#${id}`).join('، ') || 'هنوز عضوی تعیین نشده';
    if (referenceTypes.includes(field.type)) return labelFor(field.type,value);
    if (field.type === 'date') return new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
    return value;
  }
  function safeLink(value) {
    try { const u=new URL(value,location.origin); return (u.protocol==='https:' || (u.origin===location.origin && value.startsWith('/images/'))) ? u.href : ''; } catch { return ''; }
  }
  function optionsFor(field) {
    if (field.type === 'sport') return config.sports.map(x => [x,x]);
    if (field.type === 'select') return field.options.map(x=>[x,x]);
    if (['member','coach','person','members'].includes(field.type)) return people.filter(p=>p.active!==false).filter(p=>field.type==='person'||(field.type==='members'?p.role==='member':p.role===field.type)).map(p=>[p.id,p.full_name]);
    if (referenceTypes.includes(field.type)) return (store[field.type]||[]).map(r=>[r.id,r.data.title]);
    return null;
  }
  function input(key, field, value) {
    const opts=optionsFor(field), required=field.required?' required':'', id='field-'+key;
    let html;
    if (opts) html=`<select id="${id}" name="${key}"${required}${field.type==='members'?' multiple':''}>${field.type==='members'?'':'<option value="">انتخاب کنید</option>'}${opts.map(([v,label])=>`<option value="${esc(v)}"${(Array.isArray(value)?value.map(String).includes(String(v)):String(value)===String(v))?' selected':''}>${esc(label)}</option>`).join('')}</select>`;
    else if(field.type==='textarea') html=`<textarea id="${id}" name="${key}" maxlength="5000"${required}>${esc(value||'')}</textarea>`;
    else html=`<input id="${id}" name="${key}" type="${field.type==='checkbox'?'checkbox':field.type}"${field.type==='checkbox'?(value?' checked':''):` value="${esc(value??'')}"`}${field.min!==undefined?` min="${field.min}" max="${field.max}" step="${['age','year','month','top_rank','quantity','stock','percent','discount_percent','amount','price'].includes(key)?'1':'any'}"`:''}${field.type==='text'?' maxlength="1000"':''}${required}>`;
    return `<label class="${field.type==='textarea'||field.type==='members'?'academy-wide':''}" for="${id}">${esc(field.label)}${field.required?' *':''}${html}</label>`;
  }
  async function openForm(row) {
    const kind=current, request=version;
    try{await loadReferences(referencesFor(kind));}catch(err){error(err);return;}
    if(current!==kind || request!==version)return;
    editing=row||null;
    const fields=['users','people'].includes(current)?userFields(!!row):config.schema[current].fields;
    $('formTitle').textContent=(row?'ویرایش ':'ثبت ')+(['users','people'].includes(current)?'حساب کاربری':config.schema[current].label);
    const defaults=current==='evaluations'?{year:config.jy,month:config.jm}:current==='invoices'?{discount_percent:0,status:'پرداخت‌نشده'}:{};
    $('formFields').innerHTML=Object.entries(fields).map(([key,field])=>input(key,field,row?row.data[key]:defaults[key])).join('');
    $('formError').textContent='';$('recordDialog').showModal();
  }
  function userFields(edit) {
    if(!edit)return { full_name:{label:'نام کامل',type:'text',required:true},username:{label:'نام کاربری',type:'text',required:true},password:{label:'رمز حداقل ۱۲ کاراکتر',type:'password',required:true},role:{label:'نوع حساب',type:'select',options:['member','coach'],required:true},discipline:{label:'رشته',type:'sport'},phone:{label:'شماره تماس',type:'tel'} };
    return {full_name:{label:'نام کامل',type:'text',required:true},phone:{label:'تلفن',type:'tel'},discipline:{label:'رشته',type:'sport'},gender:{label:'جنسیت',type:'text'},birth_date:{label:'تاریخ تولد',type:'date'},blood_group:{label:'گروه خونی',type:'select',options:['','A+','A-','B+','B-','AB+','AB-','O+','O-']},age:{label:'سن',type:'number',min:0,max:120},weight_kg:{label:'وزن',type:'number',min:0,max:400},height_cm:{label:'قد',type:'number',min:0,max:250},belt:{label:'کمربند ثبت‌شده',type:'text'},notes:{label:'توضیحات',type:'textarea'},active:{label:'حساب فعال است',type:'checkbox'},password:{label:'رمز جدید (اختیاری؛ حداقل ۱۲ کاراکتر)',type:'password'}};
  }
  $('closeDialog').onclick=()=>$('recordDialog').close();
  $('recordForm').onsubmit=async event=>{
    event.preventDefault();const formKind=current, row=editing;
    const fields=['users','people'].includes(formKind)?userFields(!!row):config.schema[formKind].fields;
    const fd=new FormData(event.currentTarget),body={};
    for(const [key,field]of Object.entries(fields))body[key]=field.type==='checkbox'?fd.has(key):field.type==='members'?fd.getAll(key).map(Number):fd.get(key);
    $('saveRecord').disabled=true;$('formError').textContent='';
    try{await api(['users','people'].includes(formKind)?'/users'+(row?'/'+row.id:''):`/records/${formKind}${row?'/'+row.id:''}`,row?'PUT':'POST',body);$('recordDialog').close();invalidateReferences(formKind);if(['users','people'].includes(formKind))await loadPeople(true);if(current===formKind)await show(formKind);}
    catch(err){$('formError').textContent=err.message;}finally{$('saveRecord').disabled=false;}
  };
  function referencesFor(kind){return [...new Set(Object.values(config.schema[kind]?.fields||{}).map(f=>f.type).filter(type=>referenceTypes.includes(type)))];}
  async function loadReferences(kinds=[]) {
    await Promise.all(kinds.map(async kind=>{if(config.schema[kind] && (!referenceTime.has(kind) || Date.now()-referenceTime.get(kind)>30000))setReference(kind,(await api('/records/'+kind)).records);}));
  }
  function paymentNotice() {
    return config.paymentPortal?`<div class="academy-notice"><a href="${esc(config.paymentPortal)}" target="_blank" rel="noopener noreferrer">ورود به سامانهٔ واقعی پرداخت شهریه</a><p>این لینک به سامانهٔ بیرونی است. بازگشت از آن به معنی تأیید خودکار پرداخت نیست؛ سابقهٔ بانکی باید تطبیق داده شود.</p></div>`:'<p class="academy-notice">درگاه بانکی هنوز پیکربندی نشده است. هیچ پرداخت آنلاین یا رسید موفق نمایشی تولید نمی‌شود. کارت‌های شهریه در پنل اصلی موجودند؛ تأیید واریز فقط با شماره پیگیری توسط مدیر انجام می‌شود.</p>';
  }
  async function show(kind) {
    current=kind;const request=++version;
    $('sectionIcon').innerHTML=icon(kind);$('sectionGroup').textContent=groupFor(kind).label;
    $('sectionBody').setAttribute('aria-busy','true');
    $('academyError').textContent='';$('sectionTools').innerHTML='';$('sectionBody').innerHTML=empty('در حال دریافت اطلاعات…');
    $('sectionTitle').textContent=config.schema[kind]?.label||({leaderboard:'لیدربورد هر رشته',people:'اطلاعات شاگردان و مربیان',review:'بازبینی داده‌های قدیمی',audit:'گزارش تغییرات',users:'ایجاد حساب شاگرد یا مربی'}[kind]);
    $('addRecord').hidden=!(config.schema[kind]?.writable||kind==='users');
    document.querySelectorAll('#academyNav button').forEach(b=>{if(b.dataset.kind===kind)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    try{
      if(kind==='leaderboard')return leaderboard();
      if(kind==='people'||kind==='users')return await peopleView();
      if(kind==='review')return await review();
      if(kind==='audit'){const d=await api('/audit');if(request===version)$('sectionBody').innerHTML=d.rows.length?`<div class="academy-scroll"><table><thead><tr><th>زمان</th><th>عملیات</th><th>بخش</th><th>شناسه</th></tr></thead><tbody>${d.rows.map(r=>`<tr><td>${esc(r.created_at)}</td><td>${esc(r.action)}</td><td>${esc(r.kind)}</td><td>${r.record_id}</td></tr>`).join('')}</tbody></table></div>`:empty();return;}
      const [data]=await Promise.all([api('/records/'+kind),loadReferences(referencesFor(kind))]);
      if(request!==version)return;const rows=data.records;currentRows=rows;
      if(referenceTypes.includes(kind))setReference(kind,rows);
      if(kind==='evaluations'&&config.role==='coach'){
        $('sectionBody').innerHTML=rows.length?rows.map(r=>`<article class="academy-record"><h3>${esc(r.period)}</h3><p>تعداد ارزیابی: ${fa(r.count)} · میانگین واقعی: ${fa(r.average)} از ۵</p></article>`).join(''):empty('ارزیابی ماهانه‌ای برای شما ثبت نشده است.');return;
      }
      let notice=kind==='invoices'?paymentNotice():kind==='orders'?'<p class="academy-notice">ثبت سفارش، درخواست خرید است؛ به معنی پرداخت یا تحویل نیست.</p>':kind==='nutrition'?'<p class="academy-notice">اطلاعات این فرم فقط برای خودتان و مدیر قابل مشاهده است. ثبت فرم به معنی ارائهٔ نسخه یا برنامهٔ تغذیه نیست؛ بررسی باید توسط فرد دارای صلاحیت انجام شود.</p>':'';
      if(kind==='evaluations')notice+='<p class="academy-notice">ارزیابی فقط برای ماه جاری و مربی کلاس ثبت‌شدهٔ خودتان است. هر ماه یک ارزیابی قابل ویرایش دارید. مربی فقط میانگین و تعداد را می‌بیند.</p>';
      if(kind==='exam_results'||kind==='monthly_scores')notice+='<div id="examChart"></div>';
      if(kind==='challenge_results')notice+='<div id="challengeBoard"></div>';
      renderRecords(kind,rows,notice);
    }catch(err){if(request===version){$('sectionBody').innerHTML=empty('دریافت اطلاعات انجام نشد.');error(err);}}
    finally{if(request===version)$('sectionBody').setAttribute('aria-busy','false');}
  }
  // Keep at most 24 full cards in the DOM. This is pagination, not truncation:
  // every real record remains reachable; no data is dropped from the API.
  function pageCards(rows,card,afterDraw,leading='') {
    const size=24;let page=0;
    function draw(){
      const pages=Math.max(1,Math.ceil(rows.length/size));
      $('sectionBody').innerHTML=leading+(rows.length?`<div class="academy-grid">${rows.slice(page*size,(page+1)*size).map(card).join('')}</div>`:empty())+(pages>1?`<nav class="academy-pagination" aria-label="صفحه‌بندی رکوردها"><button class="btn" data-page-step="-1"${page===0?' disabled':''}>صفحهٔ قبل</button><span role="status">صفحهٔ ${fa(page+1)} از ${fa(pages)} · ${fa(rows.length)} رکورد ثبت‌شده</span><button class="btn" data-page-step="1"${page===pages-1?' disabled':''}>صفحهٔ بعد</button></nav>`:'');
      $('sectionBody').querySelectorAll('[data-page-step]').forEach(button=>button.onclick=()=>{page+=Number(button.dataset.pageStep);draw();$('sectionTitle').focus({preventScroll:true});});
      afterDraw();
    }
    draw();
  }
  function renderRecords(kind,rows,notice){
    const index=new Map(rows.map(row=>[row.id,row]));
    pageCards(rows,row=>recordCard(kind,row),()=>{
      if(kind==='exam_results')examChart(rows);
      if(kind==='monthly_scores')monthlyChart(rows);
      if(kind==='challenge_results')challengeBoard(rows);
      $('sectionBody').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openForm(index.get(Number(b.dataset.edit))));
      $('sectionBody').querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('این رکورد حذف شود؟'))return;try{await api(`/records/${kind}/${b.dataset.delete}`,'DELETE');invalidateReferences(kind);if(current===kind)await show(kind);}catch(err){error(err);}});
      $('sectionBody').querySelectorAll('[data-order]').forEach(b=>b.onclick=async()=>{try{await api(`/orders/${b.dataset.order}/status`,'POST',{status:b.dataset.status});invalidateReferences(kind);if(current===kind)await show(kind);}catch(err){error(err);}});
    },notice);
  }
  function recordCard(kind,row) {
    const def=config.schema[kind];
    const display=Object.entries(def.fields).filter(([key])=>row.data[key]!==undefined).map(([key,field])=>{
      const value=row.data[key];let rendered=esc(key==='coach_id'&&row.data.coach_name?row.data.coach_name:format(field,value));
      if(field.type==='url'&&value){const link=safeLink(value);rendered=link?key==='image_url'?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer"><img src="${esc(link)}" alt="${esc(row.data.title||'تصویر')}" loading="lazy"></a>`:`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(key==='basics_url'?(row.data.basics_title||'آموزش پایه در یوتیوب'):'باز کردن لینک')}</a>`:'نشانی قابل نمایش نیست';}
      return `<dt>${esc(field.label)}</dt><dd>${rendered}</dd>`;
    }).join('');
    const extra=kind==='invoices'?`<p>مبلغ قابل پرداخت: <b>${fa(row.data.payable)} تومان</b></p>`:kind==='orders'?`<p>${esc(row.data.product_title)} · مبلغ زمان سفارش: ${fa(row.data.total)} تومان · ${esc(row.data.status)}</p>`:kind==='challenge_results'&&row.data.participant?`<p>${row.data.is_me?'شما':esc(row.data.participant)}</p>`:'';
    const editable=def.writable&&kind!=='orders';
    return `<article class="academy-record"><h3>${esc(row.data.title||labelFor(kind,row.id))}</h3><dl>${display}</dl>${extra}<div class="academy-actions">${editable?`<button class="btn sm" data-edit="${row.id}">ویرایش</button>`:''}${editable&&config.role!=='member'?`<button class="btn sm ghost" data-delete="${row.id}">حذف</button>`:''}${kind==='orders'&&config.role==='admin'?['تأییدشده','تحویل‌شده','لغوشده'].map(status=>`<button class="btn sm" data-order="${row.id}" data-status="${status}">${status}</button>`).join(''):''}</div></article>`;
  }
  function examChart(rows){
    const target=$('examChart');const yearField=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',timeZone:'UTC'});
    const yearly=r=>Number(yearField.formatToParts(new Date(r.data.event_date+'T12:00:00Z')).find(p=>p.type==='year').value);
    const exams=store.exams||[],years=[...new Set(exams.map(yearly))].sort((a,b)=>b-a);
    if(!years.length)years.push(config.jy);
    target.innerHTML=`<h3>نمودار آزمون‌های ثبت‌شده در طول سال</h3><div class="academy-tools"><label>سال شمسی<select id="chartYear">${years.map(y=>`<option>${y}</option>`).join('')}</select></label>${config.role!=='member'?`<label>شاگرد<select id="chartPerson">${people.filter(p=>p.role==='member').map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`).join('')}</select></label>`:''}</div><div id="actualChart"></div><p class="subtle">هر ستون فقط یک نتیجهٔ واقعی است؛ برای ماه‌های بدون آزمون، نمرهٔ فرضی تولید نمی‌شود.</p>`;
    function draw(){const year=Number($('chartYear').value),uid=$('chartPerson')?Number($('chartPerson').value):config.user.id;
      const results=rows.map(r=>({result:r,exam:exams.find(e=>e.id===r.data.exam_id)})).filter(x=>x.exam&&x.result.data.user_id===uid&&yearly(x.exam)===year).sort((a,b)=>a.exam.data.event_date.localeCompare(b.exam.data.event_date));
      $('actualChart').innerHTML=results.length?`<div class="academy-chart" role="img" aria-label="نمره‌های واقعی آزمون‌ها از صد">${results.map(({exam,result})=>`<figure><b>${fa(result.data.score)}</b><span class="exam-column" style="height:${result.data.score*1.5}px"></span><figcaption>${esc(exam.data.title)}<br>${esc(format({type:'date'},exam.data.event_date))}</figcaption></figure>`).join('')}</div>`:empty('برای این شاگرد و سال نتیجه‌ای ثبت نشده است.');}
    $('chartYear').onchange=draw;if($('chartPerson'))$('chartPerson').onchange=draw;draw();
  }
  function monthlyChart(rows){
    const target=$('examChart'),years=[...new Set(rows.map(r=>r.data.year))].sort((a,b)=>b-a);
    if(!years.length)years.push(config.jy);
    target.innerHTML=`<h3>آزمون‌های ماهانه در طول سال</h3><div class="academy-tools"><label>سال شمسی<select id="monthlyYear">${years.map(y=>`<option>${y}</option>`).join('')}</select></label>${config.role!=='member'?`<label>شاگرد<select id="monthlyPerson">${people.filter(p=>p.role==='member').map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`).join('')}</select></label>`:''}</div><div id="monthlyChart"></div><p class="subtle">فقط ماه‌های دارای نمره نمایش داده می‌شوند؛ ماه ثبت‌نشده صفر فرض نمی‌شود.</p>`;
    function draw(){const uid=$('monthlyPerson')?Number($('monthlyPerson').value):config.user.id,year=Number($('monthlyYear').value);
      const selected=rows.filter(r=>r.data.user_id===uid&&r.data.year===year&&r.data.overall!==null).sort((a,b)=>a.data.month-b.data.month);
      $('monthlyChart').innerHTML=selected.length?`<div class="academy-chart" role="img" aria-label="نمرات واقعی ماهانه از صد">${selected.map(r=>`<figure><b>${fa(r.data.overall)}</b><span class="exam-column" style="height:${r.data.overall*1.5}px"></span><figcaption>ماه ${fa(r.data.month)}</figcaption></figure>`).join('')}</div>`:empty('در این سال نمره‌ای برای این شاگرد ثبت نشده است.');}
    $('monthlyYear').onchange=draw;if($('monthlyPerson'))$('monthlyPerson').onchange=draw;draw();
  }
  function challengeBoard(rows){
    const groups=(store.challenges||[]).map(c=>{const results=rows.filter(r=>r.data.challenge_id===c.id).sort((a,b)=>c.data.exercise==='دو'?a.data.value-b.data.value:b.data.value-a.data.value);let rank=0,last=null;return results.length?`<h3>${esc(c.data.title)} — رتبه‌بندی ${c.data.exercise==='دو'?'زمان کمتر':'تکرار بیشتر'}</h3><ol>${results.map((r,i)=>{if(last!==r.data.value)rank=i+1;last=r.data.value;return `<li>رتبه ${fa(rank)} · ${r.data.is_me?'شما':esc(r.data.participant||person(r.data.user_id)?.full_name||'ورزشکار')} · ${fa(r.data.value)} ${c.data.exercise==='دو'?'ثانیه':'تکرار'}</li>`;}).join('')}</ol>`:'';}).join('');$('challengeBoard').innerHTML=groups;
  }
  async function peopleView(){
    await loadPeople();if(!['people','users'].includes(current))return;
    $('sectionTools').innerHTML='<label>جست‌وجوی نام، رشته، شماره تماس<input id="peopleSearch" type="search"></label><button id="exportPeople" class="btn">خروجی اطلاعات شاگردان برای مسابقات (CSV)</button>';
    function draw(){const q=$('peopleSearch').value.trim();const list=people.filter(p=>JSON.stringify(p).includes(q));
      const fields={full_name:'نام کامل',active:'حساب فعال است',username:'نام کاربری',role:'نقش',discipline:'رشته',phone:'تلفن',age:'سن',height_cm:'قد',weight_kg:'وزن',style:'سبک',experience:'سابقه',join_date:'تاریخ عضویت',gender:'جنسیت',birth_date:'تاریخ تولد',blood_group:'گروه خونی',belt:'کمربند',weight_kg:'وزن',height_cm:'قد',notes:'توضیحات ثبت‌شده'};
      pageCards(list,p=>`<article class="academy-record"><h3>${esc(p.full_name)}</h3><dl>${Object.entries(fields).map(([k,label])=>`<dt>${label}</dt><dd>${esc(p[k]??'ثبت نشده')}</dd>`).join('')}</dl>${config.role==='admin'?`<button class="btn" data-person-edit="${p.id}">ویرایش اطلاعات و وضعیت</button>`:''}</article>`,()=>{
        document.querySelectorAll('[data-person-edit]').forEach(b=>b.onclick=()=>{const p=person(b.dataset.personEdit);openForm({id:p.id,data:p});});
      });
    }
    $('exportPeople').onclick=()=>{
      const fields=['full_name','username','phone','discipline','gender','birth_date','blood_group','age','weight_kg','height_cm','belt'];
      const cell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';
      const lines=[fields,...people.filter(p=>p.role==='member').map(p=>fields.map(k=>p[k]))].map(row=>row.map(cell).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob(['\uFEFF'+lines],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='academy-students.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    let searchFrame;
    $('peopleSearch').oninput=()=>{cancelAnimationFrame(searchFrame);searchFrame=requestAnimationFrame(()=>{if(['people','users'].includes(current))draw();});};draw();
  }
  function leaderboard(){
    $('sectionTools').innerHTML=`<form id="rankForm" class="academy-tools"><label>رشته<select name="discipline">${config.sports.map(x=>`<option>${x}</option>`).join('')}</select></label><label>سال شمسی<input name="year" type="number" min="1300" max="1600" value="${config.jy}" required></label><label>ماه<input name="month" type="number" min="1" max="12" value="${config.jm}" required></label><button class="btn primary">نمایش</button></form>`;
    $('sectionBody').innerHTML=empty('رشته و ماه را انتخاب کنید؛ رتبه فقط از نمرهٔ ماهانهٔ تأییدشده محاسبه می‌شود.');
    $('rankForm').onsubmit=async event=>{event.preventDefault();const query=new URLSearchParams(new FormData(event.currentTarget));try{const d=await api('/leaderboard?'+query);if(current!=='leaderboard')return;$('sectionBody').innerHTML=`<p>${esc(d.source)}</p><p class="subtle">تخفیفِ نمایش‌داده‌شده واجدشرایط بودن طبق قانون مدیر است؛ مبلغ نهایی فقط در صورتحساب مصوب مشخص می‌شود.</p>`+(d.rows.length?`<div class="academy-scroll"><table><thead><tr><th>رتبه</th><th>ورزشکار</th><th>نمره</th><th>تخفیف واجد شرایط</th></tr></thead><tbody>${d.rows.map(r=>`<tr><td>${fa(r.rank)}</td><td>${esc(r.participant)}</td><td>${fa(r.score)}</td><td>${fa(r.discount_percent)}٪</td></tr>`).join('')}</tbody></table></div>`:empty('برای این رشته و ماه هیچ نمرهٔ تأییدشده‌ای ثبت نشده است.'));}catch(err){error(err);}};
  }
  async function review(){
    const d=await api('/review');if(current!=='review')return;
    $('sectionBody').innerHTML='<p class="academy-notice">این داده‌ها منشأ قابل اعتماد ندارند و از آمار و فهرست‌های عمومی کنار گذاشته شده‌اند. فقط پس از تطبیق با اسناد واقعی، هر رکورد را جداگانه تأیید کنید. تأیید کاربر به معنی تأیید نمره‌ها یا افتخارات او نیست.</p>'+d.groups.map(g=>`<details><summary>${esc(g.table)} — ${fa(g.count)} مورد در انتظار بازبینی (حداکثر ۱۰۰ مورد در هر بار)</summary>${g.rows.map(r=>`<article class="academy-record"><pre dir="auto" style="white-space:pre-wrap">${esc(JSON.stringify(r,null,2))}</pre><button class="btn" data-verify="${g.table}/${r.id}">با سند واقعی تطبیق دادم؛ تأیید</button></article>`).join('')}</details>`).join('');
    document.querySelectorAll('[data-verify]').forEach(b=>b.onclick=async()=>{if(!confirm('واقعی‌بودن تمام محتوای این رکورد را بررسی کرده‌اید؟'))return;try{await api('/review/'+b.dataset.verify,'POST',{});await review();await loadPeople(true);}catch(err){error(err);}});
  }
  async function start(){
    try{
      const [configuration]=await Promise.all([api('/config'),loadPeople(true)]);config=configuration;
      $('adminLogin').hidden=true;$('academySession').hidden=false;$('sessionExit').hidden=!admin;
      $('academyTitle').textContent=admin?'مدیریت آکادمی':'خدمات آکادمی';$('welcome').textContent=`${config.user.full_name} · ${ {member:'پنل شاگرد',coach:'پنل مربی',admin:'پنل مدیریت'}[config.role] }`;
      $('backLink').href=admin?prefix+'/':prefix+(config.role==='member'?'/panel':'/dashboard');if(admin)$('backLink').textContent='صفحهٔ اصلی';
      $('sessionRole').textContent={member:'پنل شاگرد',coach:'پنل مربی',admin:'پنل مدیریت'}[config.role];
      $('sessionAvatar').textContent=config.user.full_name.trim().slice(0,1);
      const today=new Date();$('academyToday').dateTime=today.toISOString().slice(0,10);
      $('academyToday').textContent=new Intl.DateTimeFormat('fa-IR',{dateStyle:'full'}).format(today);

      const sections=[...Object.entries(config.schema).map(([k,v])=>[k,v.label]),['leaderboard','لیدربورد هر رشته']];
      if(config.role!=='member')sections.unshift(['people','اطلاعات شاگردان و مربیان']);
      if(admin)sections.push(['users','ایجاد حساب'],['review','بازبینی داده‌های قدیمی'],['audit','گزارش تغییرات']);
      renderNavigation(sections);
      $('addRecord').onclick=()=>openForm();
      const initial=decodeURIComponent(location.hash.slice(1));await show(sections.some(([k])=>k===initial)?initial:sections[0][0]);
    }catch(err){if(admin){$('adminLogin').hidden=false;$('academySession').hidden=true;if(err.status!==401)error(err);}else error(err);}
  }
  $('loginForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,btn=form.querySelector('button');btn.disabled=true;try{await api('/login','POST',Object.fromEntries(new FormData(form)));form.reset();$('academyError').textContent='';await start();}catch(err){error(err);}finally{btn.disabled=false;}};
  $('sessionExit').onclick=async()=>{try{await api('/logout','POST',{});location.reload();}catch(err){error(err);}};
  start();
})();
