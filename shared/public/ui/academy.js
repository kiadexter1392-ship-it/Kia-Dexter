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
    { label:'نمای کلی', icon:'grid', kinds:['dashboard'] },
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
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
    grid:'<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>'
  };
  const groupFor = kind => navigationGroups.find(g=>g.kinds.includes(kind)) || {label:'بخش‌های آکادمی',icon:'calendar'};
  const icon = kind => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[['classes','attendance','meetings','exams'].includes(kind)?'calendar':groupFor(kind).icon]}</svg>`;
  let sectionList = [];
  const normalizeSearch = value => value.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u064b-\u065f]/g,'').trim();
  function filterNavigation() {
    const query=normalizeSearch($('navSearch').value);
    document.querySelectorAll('#academyNav button[data-kind]').forEach(button=>{button.hidden=!normalizeSearch(button.textContent).includes(query);});
    document.querySelectorAll('.academy-nav-group').forEach(group=>{group.hidden=![...group.querySelectorAll('button[data-kind]')].some(button=>!button.hidden); if(query && !group.hidden) { group.classList.remove('collapsed'); group.querySelector('.academy-nav-toggle').setAttribute('aria-expanded','true'); }});
    $('navEmpty').hidden=!!document.querySelector('#academyNav button[data-kind]:not([hidden])');
  }
  function renderNavigation(sections) {
    sectionList=sections;
    const groups=[...navigationGroups,{label:'بخش‌های آکادمی',icon:'calendar',kinds:sections.map(([kind])=>kind).filter(kind=>!navigationGroups.some(g=>g.kinds.includes(kind)))}];
    $('academyNav').innerHTML=groups.map((group,index)=>{
      const available=sections.filter(([kind])=>group.kinds.includes(kind));
      if(!available.length)return '';
      return `<section class="academy-nav-group" aria-labelledby="navGroup${index}"><h2 id="navGroup${index}"><button type="button" class="academy-nav-toggle" aria-expanded="true" aria-controls="navGroupBody${index}"><span>${esc(group.label)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></h2><div class="academy-nav-body" id="navGroupBody${index}">${available.map(([kind,label])=>`<button type="button" data-kind="${kind}">${icon(kind)}<span>${esc(label)}</span></button>`).join('')}</div></section>`;
    }).join('');
    $('navSearch').value='';filterNavigation();
    document.querySelectorAll('.academy-nav-toggle').forEach(toggle=>toggle.onclick=()=>{
      const group=toggle.closest('.academy-nav-group');
      const collapsed=group.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded',String(!collapsed));
    });
    document.querySelectorAll('#academyNav button[data-kind]').forEach(button=>button.onclick=()=>{
      button.closest('.academy-nav-group')?.classList.remove('collapsed');
      button.closest('.academy-nav-group')?.querySelector('.academy-nav-toggle')?.setAttribute('aria-expanded','true');
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
    $('sectionTitle').textContent=config.schema[kind]?.label||({dashboard:'داشبورد',leaderboard:'لیدربورد هر رشته',people:'اطلاعات شاگردان و مربیان',review:'بازبینی داده‌های قدیمی',audit:'گزارش تغییرات',users:'ایجاد حساب شاگرد یا مربی'}[kind]);
    $('addRecord').hidden=!(config.schema[kind]?.writable||kind==='users');
    document.querySelectorAll('#academyNav button').forEach(b=>{if(b.dataset.kind===kind)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    try{
      if(kind==='dashboard')return await dashboardView();
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
  // Overview dashboard: every figure comes from /dashboard (real rows only).
  // A null value renders as "داده‌ای ثبت نشده" — never as a fabricated zero.
  const dashNum = value => value === null || value === undefined ? '—' : fa(value);
  function miniBars(series) {
    const values = (series || []).filter(v => v !== null && v !== undefined);
    if (!values.length) return '<span class="dash-mini-empty">داده‌ای ثبت نشده</span>';
    const max = Math.max(...values, 1);
    return `<span class="dash-mini" aria-hidden="true">${(series || []).map(v => `<i style="height:${v === null || v === undefined ? 0 : Math.max(8, v / max * 100)}%"></i>`).join('')}</span>`;
  }
  function trendText(trend) {
    if (!trend) return '';
    return `<span class="dash-trend ${trend.up ? 'up' : 'down'}">${trend.up ? '▲' : '▼'} ${fa(Math.abs(trend.value))}</span>`;
  }
  function areaChart(points) {
    const data = points.filter(p => p.value !== null && p.value !== undefined);
    if (!data.length) return empty('برای این بازه داده‌ای ثبت نشده است.');
    const w = 560, h = 190, pad = 26;
    const max = Math.max(...data.map(p => p.value), 1);
    const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
    const coords = data.map((p, i) => [w - pad - i * step, h - pad - (p.value / max) * (h - pad * 2)]);
    const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
    const dots = coords.map((c, i) => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3.5"/><text x="${c[0].toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(data[i].label)}</text><text x="${c[0].toFixed(1)}" y="${(c[1] - 8).toFixed(1)}" text-anchor="middle" class="dash-chart-value">${fa(data[i].value)}</text>`).join('');
    return `<svg class="dash-area" viewBox="0 0 ${w} ${h}" role="img" aria-label="نمودار عملکرد ماهانه"><defs><linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c9a462" stop-opacity=".35"/><stop offset="100%" stop-color="#c9a462" stop-opacity="0"/></linearGradient></defs><path d="${line} L${coords[coords.length - 1][0]},${h - pad} L${coords[0][0]},${h - pad} Z" fill="url(#dashAreaFill)"/><path d="${line}" fill="none" stroke="#967137" stroke-width="2.5" stroke-linecap="round"/>${dots}</svg>`;
  }
  function barChart(rows, series) {
    const max = Math.max(1, ...rows.flatMap(r => series.map(s => r[s.key] || 0)));
    return `<div class="dash-bars" role="img" aria-label="نمودار میله‌ای">${rows.map(r => `<figure><span class="dash-bar-group">${series.map(s => `<i class="dash-bar ${s.key}" style="height:${Math.max(r[s.key] ? 3 : 0, (r[s.key] || 0) / max * 100)}%" title="${esc(s.label)}: ${fa(r[s.key] || 0)}"></i>`).join('')}</span><figcaption>${esc(r.label)}</figcaption></figure>`).join('')}</div>`;
  }
  async function dashboardView() {
    const d = await api('/dashboard');
    if (current !== 'dashboard') return;
    const dash = d.dashboard;
    const isAttendance = dash.chart && dash.chart.kind === 'attendance';
    const rangeOptions = isAttendance
      ? [['weeks', 'هفته‌های اخیر'], ['months', 'ماه‌های اخیر']]
      : [['6', '۶ ماه اخیر'], ['3', '۳ ماه اخیر']];
    const dateText = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' }).format(new Date(dash.today.iso + 'T12:00:00Z'));
    const loadRows = dash.load || [];
    const loadTotal = loadRows.reduce((s, r) => s + (r.value || 0), 0);
    const capacity = dash.capacity;
    const capacityMax = capacity ? Math.max(1, ...capacity.rows.map(r => r.value)) : 1;
    $('sectionBody').innerHTML = `
      <div class="dash">
        <div class="dash-head">
          <div class="dash-greeting">
            <h3>سلام، ${esc(config.user.full_name)}</h3>
            <p><time datetime="${esc(dash.today.iso)}">${esc(dateText)}</time></p>
          </div>
          <div class="dash-actions">
            <button type="button" class="btn" id="dashExport">خروجی CSV</button>
            <label class="dash-range">بازه<select id="dashRange">${rangeOptions.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
            <button type="button" class="btn primary" id="dashAdd">ثبت جدید</button>
          </div>
        </div>
        <div class="dash-metrics">
          ${dash.metrics.map(m => `<article class="dash-metric"><div class="dash-metric-top"><h4>${esc(m.label)}</h4></div><div class="dash-metric-bottom"><div><p class="dash-metric-value">${dashNum(m.value)}</p><p class="dash-metric-trend">${trendText(m.trend)}</p></div>${miniBars(m.series)}</div></article>`).join('')}
        </div>
        <div class="dash-row">
          <section class="dash-card dash-chart-card">
            <div class="dash-card-head"><h4>${esc(dash.chart.title)}</h4><div class="dash-legend" id="dashLegend"></div></div>
            <div class="dash-chart-stats">${dash.chart.stats.map(s => `<div><b>${dashNum(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>
            <div id="dashChart"></div>
          </section>
          <section class="dash-card dash-load-card">
            <div class="dash-card-head"><h4>${esc(dash.loadTitle || 'شاگردان به تفکیک رشته')}</h4></div>
            ${loadRows.length ? `<div class="dash-load-total"><span>مجموع</span><b>${fa(loadTotal)}</b></div><div class="dash-load-bar">${loadRows.map((r, i) => `<i style="--seg-width:${loadTotal ? (r.value || 0) / loadTotal * 100 : 0}%" class="dash-load-seg seg-${i % 5}"></i>`).join('')}</div><ul class="dash-load-list">${loadRows.map((r, i) => `<li><span class="dash-swatch seg-${i % 5}"></span><span class="dash-load-name">${esc(r.label)}</span><span class="dash-load-line"></span><b>${fa(r.value)}</b><span class="dash-load-pct">${fa(r.percent)}٪</span></li>`).join('')}</ul>` : empty('داده‌ای ثبت نشده است.')}
          </section>
        </div>
        <div class="dash-row">
          <section class="dash-card dash-table-card">
            <div class="dash-card-head"><h4>${esc(dash.table.title)}</h4>${dash.table.filterable === 'status' ? `<label class="dash-filter">وضعیت<select id="dashStatusFilter"><option value="">همه</option><option>حاضر</option><option>غایب</option><option>موجه</option></select></label>` : ''}</div>
            ${dash.table.rows.length ? `<div class="academy-scroll"><table><thead><tr>${dash.table.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody id="dashTableBody">${dash.table.rows.map(r => `<tr data-status="${esc(r[r.length - 1])}">${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="dash-filter-empty" id="dashFilterEmpty" hidden>برای این وضعیت رکوردی نیست.</p>` : empty('برای نمایش چیزی ثبت نشده است.')}
          </section>
          <div class="dash-side">
            <section class="dash-card dash-perf-card">
              <div class="dash-card-head"><h4>${esc(dash.performance.title)}</h4></div>
              ${dash.performance.rows.length ? `<ul class="dash-perf-list">${dash.performance.rows.map(r => `<li>${r.id ? `<button type="button" class="dash-perf-row" data-person="${r.id}">` : '<span class="dash-perf-row">'}<span class="dash-avatar">${esc(r.name.trim().slice(0, 1))}</span><span class="dash-perf-info"><b>${esc(r.name)}</b><small>${esc(r.discipline)}</small></span><span class="dash-perf-stats"><b>${dashNum(r.avg)}</b><small>از ۵ · ${fa(r.count)} ارزیابی</small></span>${r.id ? '</button>' : '</span>'}</li>`).join('')}</ul>` : empty('ارزیابی ثبت‌شده‌ای وجود ندارد.')}
            </section>
            ${capacity ? `<section class="dash-card dash-cap-card"><div class="dash-card-head"><h4>${esc(capacity.title)}</h4></div>${capacity.rows.length ? `<ul class="dash-cap-list">${capacity.rows.map(r => `<li><span class="dash-cap-name">${esc(r.label)}</span><span class="dash-cap-bar"><i style="--cap-width:${r.value / capacityMax * 100}%"></i></span><b>${fa(r.value)}</b></li>`).join('')}</ul>` : empty('کلاسی ثبت نشده است.')}</section>` : ''}
          </div>
        </div>
      </div>
      <dialog id="personDialog" aria-labelledby="personTitle">
        <div class="academy-dialog-head"><div><span class="academy-eyebrow">جزئیات</span><h2 id="personTitle">—</h2></div><button type="button" class="btn ghost" id="closePerson" aria-label="بستن">✕</button></div>
        <div id="personBody"></div>
      </dialog>`;
    const drawChart = () => {
      const range = $('dashRange').value;
      if (isAttendance) {
        const rows = range === 'months' ? dash.chart.months : dash.chart.weeks;
        const series = [{ key: 'present', label: 'حضور' }, { key: 'absent', label: 'غیبت' }, { key: 'excused', label: 'موجه' }];
        $('dashLegend').innerHTML = series.map(s => `<span><i class="dash-swatch ${s.key}"></i>${s.label}</span>`).join('');
        $('dashChart').innerHTML = barChart(rows, series);
      } else {
        const rows = dash.chart.months.slice(range === '3' ? -3 : undefined);
        $('dashLegend').innerHTML = '';
        $('dashChart').innerHTML = areaChart(rows);
      }
    };
    $('dashRange').onchange = drawChart;
    drawChart();
    $('dashExport').onclick = () => {
      const rows = isAttendance
        ? ($('dashRange').value === 'months' ? dash.chart.months : dash.chart.weeks).map(r => [r.label, r.present, r.absent, r.excused])
        : dash.chart.months.map(r => [r.label, r.value ?? '']);
      const header = isAttendance ? ['بازه', 'حضور', 'غیبت', 'موجه'] : ['ماه', 'نمره'];
      const cell = v => '"' + String(v ?? '').replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""') + '"';
      const lines = [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'academy-dashboard.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    $('dashAdd').onclick = () => {
      const writable = Object.entries(config.schema).find(([, v]) => v.writable);
      if (writable) { location.hash = writable[0]; }
    };
    $('sectionBody').querySelectorAll('[data-person]').forEach(b => b.onclick = () => openPerson(Number(b.dataset.person)));
    $('closePerson').onclick = () => $('personDialog').close();
    const statusFilter = $('dashStatusFilter');
    if (statusFilter) statusFilter.onchange = () => {
      const value = statusFilter.value;
      let visible = 0;
      document.querySelectorAll('#dashTableBody tr').forEach(row => {
        const show = !value || row.dataset.status === value;
        row.hidden = !show;
        if (show) visible++;
      });
      if ($('dashFilterEmpty')) $('dashFilterEmpty').hidden = visible > 0;
    };
  }
  async function openPerson(id) {
    const dialog = $('personDialog');
    $('personBody').innerHTML = empty('در حال دریافت اطلاعات…');
    if (!dialog.open) dialog.showModal();
    try {
      const d = await api('/dashboard/person/' + id);
      if (!$('personBody')) return;
      const p = d.person;
      $('personTitle').textContent = p.name;
      const extra = p.role === 'coach'
        ? `<div class="dash-person-stats"><div><b>${fa(p.classes)}</b><span>کلاس فعال</span></div><div><b>${dashNum(p.evalAvg)}</b><span>میانگین ارزیابی از ۵</span></div><div><b>${fa(p.evalCount)}</b><span>تعداد ارزیابی</span></div></div>`
        : `<div class="dash-person-stats"><div><b>${fa(p.classes)}</b><span>کلاس فعال</span></div></div>`;
      const skills = p.components && p.components.length
        ? `<ul class="dash-skill-list">${p.components.map(([label, value]) => `<li><span class="dash-skill-name">${esc(label)}</span><span class="dash-skill-bar"><i style="--skill-width:${Math.min(100, value)}%"></i></span><b>${fa(value)}</b></li>`).join('')}</ul>`
        : p.classesList && p.classesList.length
          ? `<ul class="dash-skill-list">${p.classesList.map(c => `<li><span class="dash-skill-name">${esc(c.title)}</span><span class="dash-load-line"></span><span>${esc(c.discipline)} · ${esc(c.starts_at || '')}</span><b>${fa(c.enrolled)} شاگرد</b></li>`).join('')}</ul>`
          : empty('برای این بازه داده‌ای ثبت نشده است.');
      const activity = p.activity && p.activity.length
        ? `<ul class="dash-activity-list">${p.activity.map(a => `<li><span>${esc(a.action)}</span><span class="dash-load-line"></span><span>${esc(a.kind)}</span><time>${esc(a.created_at)}</time></li>`).join('')}</ul>`
        : empty(p.activity === null ? 'گزارش فعالیت فقط در دسترس مدیریت است.' : 'فعالیتی ثبت نشده است.');
      $('personBody').innerHTML = `
        <div class="dash-person-head"><span class="dash-avatar big">${esc(p.name.trim().slice(0, 1))}</span><div><h3>${esc(p.name)}</h3><p>${p.role === 'coach' ? 'مربی' : 'شاگرد'} · ${esc(p.discipline)}</p></div></div>
        <div class="dash-tabs" role="tablist" aria-label="بخش‌های جزئیات">
          <button type="button" class="dash-tab" role="tab" aria-selected="true" id="person-tab-overview" aria-controls="person-panel-overview" data-tab="overview">نمای کلی</button>
          <button type="button" class="dash-tab" role="tab" aria-selected="false" id="person-tab-skills" aria-controls="person-panel-skills" data-tab="skills">مهارت‌ها</button>
          <button type="button" class="dash-tab" role="tab" aria-selected="false" id="person-tab-activity" aria-controls="person-panel-activity" data-tab="activity">فعالیت</button>
        </div>
        <div class="dash-tab-panel" role="tabpanel" id="person-panel-overview" aria-labelledby="person-tab-overview" data-panel="overview">
          ${extra}
          <h4 class="dash-person-h">عملکرد ماهانه</h4>
          ${areaChart(p.months)}
          <h4 class="dash-person-h">اطلاعات ثبت‌شده</h4>
          ${p.info.length ? `<dl class="dash-person-info">${p.info.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : empty('اطلاعات تکمیلی ثبت نشده است.')}
        </div>
        <div class="dash-tab-panel" role="tabpanel" id="person-panel-skills" aria-labelledby="person-tab-skills" data-panel="skills" hidden>${skills}</div>
        <div class="dash-tab-panel" role="tabpanel" id="person-panel-activity" aria-labelledby="person-tab-activity" data-panel="activity" hidden>${activity}</div>`;
      $('personBody').querySelectorAll('.dash-tab').forEach(tab => tab.onclick = () => {
        $('personBody').querySelectorAll('.dash-tab').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
        $('personBody').querySelectorAll('.dash-tab-panel').forEach(panel => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
      });
    } catch (err) {
      if ($('personBody')) $('personBody').innerHTML = empty(err.message);
    }
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

      const sections=[['dashboard','داشبورد'],...Object.entries(config.schema).map(([k,v])=>[k,v.label]),['leaderboard','لیدربورد هر رشته']];
      if(config.role!=='member')sections.splice(1,0,['people','اطلاعات شاگردان و مربیان']);
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
