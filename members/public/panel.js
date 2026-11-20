/* ============================================================
   پنل شاگرد — باشگاه آنلاین ارسلان دوجو
   ============================================================ */
(function () {
  'use strict';

  const { api, toast, modal, closeModal, esc, fa, STATUS, METRICS, heatClass, avatar, peerUrl } = UI;
  const J = window.Jalali;

  let CFG = null;
  let ME = null;
  let magnifyingDock = null;
  const state = { view: 'home', year: null, newsTab: 'news' };

  const TITLES = {
    home: 'خانه',
    plans: 'تمرینات من',
    meal: 'برنامه غذایی هوشمند',
    progress: 'جدول پیشرفت من',
    news: 'اطلاعیه‌ها و اعلان‌ها',
    payment: 'پرداخت شهریه',
    support: 'پشتیبانی',
    profile: 'پروفایل من'
  };

  init();

  async function init() {
    try {
      CFG = await UI.loadConfig();
      const me = await api('/api/me');
      if (!me.user) throw Object.assign(new Error('no session'), { status: 401 });
      ME = me.user;
      state.year = me.jalali.year;
    } catch (err) {
      location.href = UI.PATH_PREFIX + '/';
      return;
    }

    document.getElementById('coachLink').href = peerUrl(CFG.coachPort);
    document.getElementById('meAvatar').innerHTML = UI.avatar(ME);
    document.getElementById('todayLabel').textContent = J.formatJalali(new Date());

    document.querySelectorAll('.nav-item[data-view]').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await api('/api/logout', { method: 'POST' });
      location.href = UI.PATH_PREFIX + '/';
    });
    document.getElementById('bellBtn').addEventListener('click', bellBox);
    document.getElementById('quickProgress').addEventListener('click', selfReportForm);

    if (window.MagnifyingDock) {
      magnifyingDock = MagnifyingDock.mount(document.getElementById('magnifyingDock'), {
        active: 'home',
        label: 'ناوبری سریع پنل',
        items: [
          { key: 'home', label: 'خانه', icon: 'home' },
          { key: 'plans', label: 'تمرینات من', icon: 'files' },
          { key: 'progress', label: 'پیشرفت', icon: 'progress' },
          { key: 'news', label: 'اطلاعیه‌ها', icon: 'news' },
          { key: 'profile', label: 'پروفایل من', icon: 'you' }
        ],
        onSelect: view => switchView(view)
      });
    }

    const initialBell=pollBell();
    await switchView('home');
    await initialBell;
    setInterval(()=>{if(!document.hidden)pollBell();}, 45000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollBell();});
  }

  const loadingHTML = () => '<div class="card center" style="padding:40px"><span class="loader"></span></div>';
  const emptyHTML = (t, icon = '🗂') => `<div class="empty"><span class="big">${icon}</span>${esc(t)}</div>`;

  async function switchView(view) {
    state.view = view;
    if (magnifyingDock) magnifyingDock.setActive(view);
    document.querySelectorAll('.nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.section').forEach((s) => s.classList.toggle('active', s.id === 'view-' + view));
    document.getElementById('viewTitle').textContent = TITLES[view];
    const box = document.getElementById('view-' + view);
    box.innerHTML = loadingHTML();
    try {
      if (view === 'home') await renderHome(box);
      else if (view === 'plans') await renderPlans(box);
      else if (view === 'meal') await renderMeal(box);
      else if (view === 'progress') await renderProgress(box);
      else if (view === 'news') await renderNews(box);
      else if (view === 'payment') await renderPayment(box);
      else if (view === 'support') await renderSupport(box);
      else if (view === 'profile') renderProfile(box);
    } catch (err) {
      box.innerHTML = `<div class="card empty"><span class="big">⚠</span>${esc(err.message)}</div>`;
    }
  }

  /* ================================= خانه ================================= */

  async function renderHome(box) {
    const [plans, progress, ann] = await Promise.all([
      api('/api/plans'),
      api('/api/progress?year=' + state.year),
      api('/api/announcements')
    ]);

    const open = plans.plans.filter((p) => p.status !== 'done');
    const done = plans.plans.filter((p) => p.status === 'done');
    const months = Object.keys(progress.progress).map(Number).sort((a, b) => a - b);
    const lastMonth = months.length ? months[months.length - 1] : null;
    const last = lastMonth ? progress.progress[lastMonth] : null;
    const unreadNews = ann.announcements.filter((a) => !a.read).length;

    const series = progress.history.filter((h) => Number.isFinite(h.overall)).slice(-8);
    const statusCounts = ['todo', 'doing', 'done'].map(key => ({ key, count: plans.plans.filter(p => p.status === key).length }));
    const totalPlans = plans.plans.length;
    const tableRows = rows => rows.slice(0, 6).map(p => `<tr data-home-plan-status="${esc(p.status)}"><td><button type="button" class="member-table-link" data-plan-open="${p.id}">${esc(p.title)}</button></td><td>${esc(p.category || 'ثبت نشده')} · ${esc(p.difficulty || 'ثبت نشده')}${p.duration ? ' · ' + esc(p.duration) : ''}</td><td>${p.due_on ? esc(J.formatShort(p.due_on)) : 'ثبت نشده'}</td><td><span class="member-status status-${esc(p.status)}">${esc(STATUS[p.status]?.label || 'ثبت نشده')}</span></td><td>${p.status !== 'done' ? `<button type="button" class="btn sm" data-quick-done="${p.id}">انجام شد</button>` : '—'}</td></tr>`).join('');

    box.innerHTML = `
      <div class="stack member-overview">
        <div class="member-overview-heading"><div><span>پنل شاگرد</span><h2>نمای کلی</h2><p>خلاصهٔ تمرین‌ها و پیشرفت شما</p></div><a href="${esc(UI.PATH_PREFIX)}/academy">خدمات آکادمی ←</a></div>
        <div class="card pad-lg member-welcome">
          <div class="row between wrap" style="gap:16px">
            <div class="row" style="gap:14px">
              ${avatar(ME, 'lg')}
              <div>
                <div class="bold" style="font-size:19px">سلام ${esc(ME.full_name)} 🥋</div>
                <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
                  ${ME.belt ? `<span class="badge gold">کمربند ${esc(ME.belt)}</span>` : '<span class="badge">کمربند ثبت نشده</span>'}
                  ${ME.style ? `<span class="badge blue">${esc(ME.style)}</span>` : ''}
                  ${ME.experience ? `<span class="badge">سابقه: ${esc(ME.experience)}</span>` : ''}
                  ${ME.verified ? `<span class="badge dark">عضو از ${J.formatShort(ME.created_at)}</span>` : '<span class="badge">اطلاعات قدیمی در انتظار بازبینی مدیر</span>'}
                </div>
              </div>
            </div>
            <div class="row" style="gap:10px">
              <button class="btn primary" data-goto="plans">تمرینات من (${fa(open.length)})</button>
              <button class="btn ghost" data-goto="progress">جدول پیشرفت</button>
            </div>
          </div>
        </div>

        <div class="grid-4 member-metrics" aria-label="خلاصهٔ وضعیت">
          ${stat('تمرین باز', fa(open.length), 'باید انجام دهی', 'var(--red)')}
          ${stat('تکمیل‌شده', fa(done.length), 'از ابتدای عضویت', 'var(--green)')}
          ${stat('آخرین نمره', last && last.overall !== null ? fa(last.overall) : '—', lastMonth ? J.MONTHS[lastMonth - 1] + ' ' + fa(state.year) : 'ثبت نشده', 'var(--gold)')}
          ${stat('اطلاعیه خوانده‌نشده', fa(unreadNews), 'از سمت باشگاه', 'var(--blue)')}
        </div>

        <div class="member-dashboard-grid">
          <section class="card member-chart-card">
            <div class="card-head"><div><div class="member-eyebrow">پیشرفت شما</div><div class="card-title">روند نمره کل</div></div><button class="btn sm ghost" data-goto="progress">مشاهده جدول ←</button></div>
            <div class="member-chart-summary"><div><strong>${series.length ? fa(series[series.length - 1].overall) : '—'}</strong><span>آخرین نمره از ۱۰۰</span></div><div><strong>${fa(series.length)}</strong><span>ماه ثبت‌شده در نمودار</span></div><label>بازه <select id="homeChartRange"><option value="8">۸ ثبت اخیر</option><option value="4">۴ ثبت اخیر</option></select></label></div>
            <div id="homeChart"></div>
          </section>
          <section class="card member-breakdown-card">
            <div class="card-head"><div><div class="member-eyebrow">برنامهٔ تمرینی</div><div class="card-title">وضعیت تمرین‌ها</div></div><button class="btn sm ghost" data-goto="plans">جزئیات ←</button></div>
            <div class="member-breakdown-total"><span>کل تمرین‌ها</span><strong>${fa(totalPlans)}</strong></div>
            <div class="member-segments" aria-label="تفکیک وضعیت تمرین‌ها">${statusCounts.map(x => `<i class="status-${x.key}" style="width:${totalPlans ? x.count / totalPlans * 100 : 0}%"></i>`).join('')}</div>
            <div class="member-breakdown-list">${statusCounts.map(x => `<div><span><i class="status-${x.key}"></i>${esc(STATUS[x.key].label)}</span><b>${fa(x.count)}</b></div>`).join('')}</div>
          </section>
          <section class="card member-table-card">
            <div class="card-head"><div><div class="member-eyebrow">برنامهٔ شما</div><div class="card-title">تمرین‌های پیش رو</div></div><div class="member-plan-controls"><label for="homePlanFilter">وضعیت</label><select id="homePlanFilter"><option value="all">همهٔ تمرین‌های باز</option><option value="todo">شروع نشده</option><option value="doing">در حال انجام</option><option value="done">تکمیل شده</option></select><button class="btn sm ghost" data-goto="plans">همه ←</button></div></div>
            <div class="member-table-scroll"><table class="member-table"><thead><tr><th>تمرین</th><th>دسته</th><th>مهلت</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody id="homePlanRows">${tableRows(open)}</tbody></table></div><p class="member-filter-empty" id="homePlanEmpty" ${open.length ? 'hidden' : ''}>تمرینی با این وضعیت ثبت نشده است.</p>
          </section>
          <section class="card member-news-card">
            <div class="card-head"><div><div class="member-eyebrow">اخبار باشگاه</div><div class="card-title">اطلاعیه‌های باشگاه</div></div><button class="btn sm ghost" data-goto="news">همه ←</button></div>
            ${ann.announcements.slice(0, 4).map((a) => `<div class="list-item" style="cursor:pointer" data-open-ann="${a.id}"><div class="grow"><div class="title">${a.pinned ? '📌 ' : ''}${esc(a.title)} ${a.read ? '' : '<span class="badge red">جدید</span>'}</div><div class="tiny">${esc(a.category)} · ${J.timeAgo(a.created_at)}</div></div></div>`).join('') || emptyHTML('اطلاعیه‌ای نیست', '✦')}
          </section>
          <section class="card member-progress-card"><div class="card-head"><div><div class="member-eyebrow">عملکرد فردی</div><div class="card-title">آخرین ثبت پیشرفت</div></div><button class="btn sm ghost" data-goto="progress">جدول پیشرفت ←</button></div>${last ? metricBars(last) : emptyHTML('مربی هنوز جدولی برای تو پر نکرده است', '▦')}</section>
        </div>
      </div>`;

    wireGoto(box);
    const chart = box.querySelector('#homeChart');
    function drawChart() {
      const points = series.slice(-Number(box.querySelector('#homeChartRange').value));
      chart.innerHTML = points.length ? `<div class="member-chart-plot" role="img" aria-label="نمره‌های ثبت‌شده: ${points.map(p => `${esc(J.MONTHS[p.month-1])} ${fa(p.year)}: ${fa(p.overall)}`).join('، ')}">${points.map(p => `<div class="member-chart-col"><span>${fa(p.overall)}</span><div class="member-chart-track"><i style="height:${Math.max(0, Math.min(100, p.overall))}%"></i></div><small>${esc(J.MONTHS[p.month-1])}<br>${fa(p.year)}</small></div>`).join('')}</div>` : emptyHTML('هنوز نمره‌ای توسط مربی ثبت نشده است', '📊');
    }
    box.querySelector('#homeChartRange').addEventListener('change', drawChart);
    drawChart();
    const planFilter = box.querySelector('#homePlanFilter');
    planFilter.addEventListener('change', () => {
      const rows = planFilter.value === 'all' ? open : plans.plans.filter(p => p.status === planFilter.value);
      box.querySelector('#homePlanRows').innerHTML = tableRows(rows);
      box.querySelector('#homePlanEmpty').hidden = rows.length > 0;
      bindHomePlans();
    });
    box.querySelectorAll('[data-open-ann]').forEach((el) => el.addEventListener('click', () => openAnnouncement(Number(el.dataset.openAnn))));
    function bindHomePlans() {
    box.querySelectorAll('[data-plan-open]').forEach((b) => b.addEventListener('click', () => planModal(plans.plans.find((p) => p.id === Number(b.dataset.planOpen)))));
    box.querySelectorAll('[data-quick-done]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markDone(Number(b.dataset.quickDone));
      switchView('home');
    }));
    }
    bindHomePlans();
  }

  function stat(label, value, sub, color) {
    return `<div class="stat" style="--accent:${color}"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="sub">${esc(sub)}</div></div>`;
  }

  function metricBars(row) {
    return METRICS.filter((m) => m.score && m.key !== 'overall').map((m) => `
      <div style="margin-bottom:10px">
        <div class="row between small"><span>${esc(m.label)}</span><span class="bold">${row[m.key] === null || row[m.key] === undefined ? '—' : fa(row[m.key])}</span></div>
        <div class="progress-bar"><i style="width:${Math.min(100, row[m.key] || 0)}%"></i></div>
      </div>`).join('');
  }

  function planRow(p) {
    return `<div class="list-item" style="cursor:pointer" data-plan-open="${p.id}">
      <div class="grow">
        <div class="title">${esc(p.title)}</div>
        <div class="tiny">
          ${esc(p.category)} · ${esc(p.difficulty)}
          ${p.due_on ? '· مهلت ' + J.formatShort(p.due_on) : ''}
          ${p.duration ? '· ' + esc(p.duration) : ''}
        </div>
      </div>
      ${p.status === 'done'
        ? '<span class="badge green">تکمیل شد</span>'
        : `<button class="btn sm primary" data-quick-done="${p.id}">انجام شد</button>`}
    </div>`;
  }

  function wireGoto(box) {
    box.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.goto)));
  }

  /* ============================== تمرینات من ============================== */

  async function renderPlans(box) {
    const d = await api('/api/plans');
    const open = d.plans.filter((p) => p.status !== 'done');
    const done = d.plans.filter((p) => p.status === 'done');
    const cnt = document.getElementById('cntPlans');
    if (open.length) { cnt.textContent = fa(open.length); cnt.classList.remove('hidden'); } else { cnt.classList.add('hidden'); }

    box.innerHTML = `
      <div class="stack">
        <div class="card">
          <div class="card-head">
            <div class="card-title"><span class="dot"></span> تمرین‌های باز <span class="badge red">${fa(open.length)}</span></div>
          </div>
          ${open.length ? `<div class="stack">${open.map((p) => planCard(p)).join('')}</div>` : emptyHTML('همه تمرین‌ها را انجام داده‌ای!', '🏆')}
        </div>
        <div class="card">
          <div class="card-head">
            <div class="card-title"><span class="dot" style="background:var(--green);box-shadow:0 0 10px var(--green)"></span> تکمیل‌شده‌ها <span class="badge green">${fa(done.length)}</span></div>
          </div>
          ${done.length ? `<div class="stack">${done.map((p) => planCard(p)).join('')}</div>` : emptyHTML('هنوز تمرینی تکمیل نکرده‌ای', '⚑')}
        </div>
      </div>`;

    box.querySelectorAll('[data-plan-open]').forEach((b) => b.addEventListener('click', () => planModal(d.plans.find((p) => p.id === Number(b.dataset.planOpen)))));
    box.querySelectorAll('[data-set-status]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await setStatus(Number(b.dataset.setPlan), b.dataset.setStatus);
      switchView('plans');
    }));
  }

  function planCard(p) {
    return `<div class="card" style="background:var(--bg-2)" data-plan-open="${p.id}">
      <div class="row between wrap" style="gap:10px">
        <div class="grow">
          <div class="bold">${esc(p.title)}</div>
          <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
            <span class="badge blue">${esc(p.category)}</span>
            <span class="badge ${p.difficulty === 'سنگین' ? 'red' : p.difficulty === 'سبک' ? 'green' : 'gold'}">${esc(p.difficulty)}</span>
            ${p.duration ? `<span class="badge">${esc(p.duration)}</span>` : ''}
            ${p.due_on ? `<span class="badge dark">مهلت ${J.formatShort(p.due_on)}</span>` : ''}
            <span class="badge ${STATUS[p.status].cls}">${esc(STATUS[p.status].label)}</span>
          </div>
        </div>
        <div class="row" style="gap:6px">
          ${p.status !== 'done' ? `<button class="btn sm" data-set-status="doing" data-set-plan="${p.id}">شروع کردم</button>
            <button class="btn sm primary" data-set-status="done" data-set-plan="${p.id}">انجام شد ✓</button>` : ''}
        </div>
      </div>
      ${p.body ? `<div class="small muted" style="margin-top:10px;white-space:pre-line">${esc(p.body)}</div>` : ''}
      ${p.coach_note ? `<div class="hint" style="margin-top:10px">بازخورد مربی: ${esc(p.coach_note)}</div>` : ''}
      ${p.member_note ? `<div class="tiny" style="margin-top:8px">یادداشت تو: ${esc(p.member_note)}</div>` : ''}
    </div>`;
  }

  function planModal(p) {
    if (!p) return;
    modal({
      title: p.title,
      wide: true,
      body: `
        <div class="row" style="gap:6px;margin-bottom:12px;flex-wrap:wrap">
          <span class="badge blue">${esc(p.category)}</span>
          <span class="badge ${p.difficulty === 'سنگین' ? 'red' : 'gold'}">${esc(p.difficulty)}</span>
          ${p.duration ? `<span class="badge">${esc(p.duration)}</span>` : ''}
          ${p.due_on ? `<span class="badge dark">مهلت ${J.formatShort(p.due_on)}</span>` : ''}
          <span class="badge ${STATUS[p.status].cls}">${esc(STATUS[p.status].label)}</span>
        </div>
        ${p.body ? `<div class="card" style="background:var(--bg-2);white-space:pre-line">${esc(p.body)}</div>` : ''}
        ${p.coach_note ? `<div class="hint mt">💬 بازخورد مربی: ${esc(p.coach_note)}</div>` : ''}
        <div class="field mt"><label>یادداشت تو برای مربی (اختیاری)</label>
          <textarea id="planNote" rows="3" placeholder="مثلاً: ست آخر را نتوانستم کامل بزنم">${esc(p.member_note || '')}</textarea>
        </div>`,
      actions: [
        { label: 'بستن', class: 'ghost', onClick: closeModal },
        { label: 'در حال انجام', class: '', onClick: () => saveStatus(p, 'doing') },
        { label: 'انجام شد ✓', class: 'primary', onClick: () => saveStatus(p, 'done') }
      ]
    });
  }

  async function saveStatus(p, status) {
    const note = document.getElementById('planNote') ? document.getElementById('planNote').value : undefined;
    try {
      await api('/api/assignments/' + p.id, { method: 'PUT', body: { status, note } });
      toast(status === 'done' ? 'عالی! به مربی اطلاع داده شد' : 'وضعیت ذخیره شد', 'ok');
      closeModal();
      switchView(state.view === 'home' ? 'home' : 'plans');
    } catch (err) { toast(err.message, 'warn'); }
  }

  async function setStatus(id, status) {
    try {
      await api('/api/assignments/' + id, { method: 'PUT', body: { status } });
      toast(status === 'done' ? 'تمرین تکمیل شد — آفرین!' : 'وضعیت به‌روز شد', 'ok');
    } catch (err) { toast(err.message, 'warn'); }
  }

  async function markDone(id) {
    await setStatus(id, 'done');
  }

  // Sensitive wellness routes require a direct session and an explicit same-origin request header.
  async function wellness(path, body) {
    const response = await fetch(UI.PATH_PREFIX + '/api/wellness/' + path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Wellness-Request': '1' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'درخواست انجام نشد');
    return data;
  }

  async function renderMeal(box) {
    const data = await wellness('meals');
    const renderPlan = (plan, id) => `<article class="card meal-plan-result"><h3>${esc(plan.title)}</h3><p>${esc(plan.summary)}</p><ul>${plan.meals.map(m=>`<li><b>${esc(m.title)}</b><p>${esc(m.foods)}</p></li>`).join('')}</ul>${id ? `<button type="button" class="btn sm ghost" data-delete-meal="${id}">حذف برنامه</button>` : ''}</article>`;
    box.innerHTML = `<div class="stack"><div class="card"><h2>برنامه غذایی هوشمند</h2><p class="hint">پیشنهاد هوش مصنوعی جایگزین متخصص تغذیه نیست و برای درمان بیماری یا رژیم کودکان مناسب نیست. اطلاعاتی که وارد می‌کنید با رضایت شما به سرویس Google Gemini ارسال می‌شود و نتیجه در حساب سایت ذخیره می‌شود؛ با اپ اندروید همگام نیست.</p>
      ${data.available ? `<form id="mealForm" class="stack"><label class="field">هدف<input name="goal" maxlength="300" required placeholder="مثلاً تغذیه متعادل"></label><label class="field">تعداد وعده<select name="meals"><option value="3">۳</option><option value="4">۴</option><option value="5">۵</option><option value="6">۶</option></select></label><label class="field">غذاهای دلخواه<textarea name="foods" maxlength="1000"></textarea></label><label class="field">محدودیت‌های غذایی<textarea name="restrictions" maxlength="1000"></textarea></label><label class="field">توضیحات<textarea name="notes" maxlength="1000"></textarea></label><label><input type="checkbox" name="adult" required> تأیید می‌کنم ۱۸ سال یا بیشتر دارم.</label><label><input type="checkbox" name="consent" required> با ارسال اطلاعات واردشده به Google Gemini برای ساخت پیشنهاد موافقم.</label><p class="hint">از وارد کردن نام، شماره تماس یا اطلاعات پزشکی غیرضروری خودداری کنید.</p><button class="btn primary" type="submit">ساخت برنامه غذایی</button><p id="mealError" role="alert"></p></form>` : `<p class="hint">سرویس ساخت برنامه هنوز در سرور تنظیم نشده است. برای ثبت درخواست از <a href="${esc(UI.PATH_PREFIX)}/academy#nutrition">فرم درخواست تغذیه</a> استفاده کنید.</p>`}</div>
      <h3>برنامه‌های ذخیره‌شده</h3>${data.plans.length ? data.plans.map(p=>renderPlan(p.content,p.id)).join('') : emptyHTML('هنوز برنامه‌ای ذخیره نشده است.', '◌')}</div>`;
    const form=box.querySelector('#mealForm');
    if(form) form.addEventListener('submit',async event=>{
      event.preventDefault(); if(!form.reportValidity())return;
      const f=new FormData(form), submit=form.querySelector('button[type=submit]');
      submit.disabled=true;
      try { await wellness('meals',{goal:f.get('goal'),meals:Number(f.get('meals')),foods:f.get('foods'),restrictions:f.get('restrictions'),notes:f.get('notes'),adult:f.has('adult'),consent:f.has('consent')}); if(state.view==='meal') await renderMeal(box); }
      catch(err) { if(form.isConnected) form.querySelector('#mealError').textContent=err.message; }
      finally { submit.disabled=false; }
    });
    box.querySelectorAll('[data-delete-meal]').forEach(button=>button.addEventListener('click',async()=>{
      if(!confirm('این برنامه حذف شود؟'))return;
      try { await wellness('meals/'+Number(button.dataset.deleteMeal)+'/delete',{}); if(state.view==='meal')await renderMeal(box); } catch(err) {toast(err.message,'warn');}
    }));
  }

  /* =========================== جدول پیشرفت من =========================== */

  async function renderProgress(box) {
    const [d, personalLogs] = await Promise.all([api('/api/progress?year=' + state.year), wellness('progress').catch(() => null)]);
    const years = d.years.length ? d.years : [state.year];
    const p = d.progress;

    const scoreMetrics = METRICS.filter((m) => m.score && m.key !== 'overall');
    const overallRow = Array.from({ length: 12 }, (_, i) => (p[i + 1] ? p[i + 1].overall : null));
    const filled = overallRow.filter((v) => v !== null && v !== undefined);
    const avg = filled.length ? Math.round(filled.reduce((a, b) => a + b, 0) / filled.length) : null;
    const best = filled.length ? Math.max(...filled) : null;

    box.innerHTML = `
      <div class="stack">
        <div class="grid-3">
          ${stat('میانگین سال', avg === null ? '—' : fa(avg), `سال ${fa(state.year)}`, 'var(--gold)')}
          ${stat('بهترین ماه', best === null ? '—' : fa(best), best !== null ? J.MONTHS[overallRow.indexOf(best)] : '', 'var(--green)')}
          ${stat('ماه‌های ثبت‌شده', fa(filled.length), 'از ۱۲ ماه', 'var(--blue)')}
        </div>

        <div class="card member-progress-dashboard">
          <div class="card-head wrap"><div><div class="card-title">نمودار پیشرفت ماهانه</div><p class="tiny">فقط نمره‌های ثبت‌شده توسط مربی نمایش داده می‌شوند.</p></div></div>
          ${filled.length ? `<div class="member-progress-chart" role="list" aria-label="نمره‌های واقعی ماهانه">${overallRow.map((score, i) => score === null || score === undefined ? '' : `<div class="member-progress-column" role="listitem" aria-label="${esc(J.MONTHS[i])}: ${fa(score)} از ۱۰۰"><span>${fa(score)}</span><div class="member-progress-track"><i style="height:${Math.max(0, Math.min(100, Number(score)))}%"></i></div><small>${esc(J.MONTHS[i])}</small></div>`).join('')}</div>` : emptyHTML('نمره‌ای برای این سال ثبت نشده است', '📊')}
        </div>

        <div class="card">
          <div class="card-head wrap">
            <div class="card-title"><span class="dot"></span> جدول ماهانه پیشرفت</div>
            <div class="row" style="gap:8px">
              <select id="yearSel" style="width:130px">${years.map((y) => `<option value="${y}" ${y === state.year ? 'selected' : ''}>سال ${fa(y)}</option>`).join('')}</select>
              <button class="btn sm" id="selfBtn">ثبت خودارزیابی</button>
            </div>
          </div>

          <div class="table-wrap"><table class="data compact">
            <thead><tr>
              <th style="min-width:130px">شاخص / ماه</th>
              ${J.MONTHS.map((mn) => `<th style="min-width:60px">${esc(mn)}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${scoreMetrics.map((m) => `<tr>
                <td class="bold">${esc(m.label)}</td>
                ${Array.from({ length: 12 }, (_, i) => {
                  const c = p[i + 1];
                  const v = c ? c[m.key] : null;
                  return `<td>${v === null || v === undefined ? '<span class="tiny">—</span>' : `<span class="heat ${heatClass(v)}">${fa(v)}</span>`}</td>`;
                }).join('')}
              </tr>`).join('')}
              <tr>
                <td class="bold">جلسات تمرین</td>
                ${Array.from({ length: 12 }, (_, i) => `<td>${p[i + 1] && p[i + 1].sessions !== null ? fa(p[i + 1].sessions) : '<span class="tiny">—</span>'}</td>`).join('')}
              </tr>
              <tr>
                <td class="bold">وزن (کیلوگرم)</td>
                ${Array.from({ length: 12 }, (_, i) => `<td>${p[i + 1] && p[i + 1].weight_kg !== null ? fa(p[i + 1].weight_kg) : '<span class="tiny">—</span>'}</td>`).join('')}
              </tr>
              <tr style="background:var(--panel)">
                <td class="bold">نمره کل</td>
                ${overallRow.map((v) => `<td><span class="heat ${heatClass(v)}">${v === null || v === undefined ? '—' : fa(v)}</span></td>`).join('')}
              </tr>
            </tbody>
          </table></div>
          <p class="tiny" style="margin-top:10px">این جدول توسط مربی پر می‌شود. اگر فکر می‌کنی عددی درست نیست، با خودارزیابی به مربی اطلاع بده.</p>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title">سوابق تمرین و دستاوردهای شخصی</div></div>
          <p class="tiny">این یادداشت‌ها فقط در حساب سایت شما ذخیره می‌شوند و از نمره‌های مربی جدا هستند.</p>
          ${personalLogs ? `<form id="progressLogForm" class="stack"><label class="field">نوع ثبت<select name="category"><option value="workout">تمرین</option><option value="milestone">دستاورد</option></select></label><label class="field">عنوان<input name="title" maxlength="120" required></label><div class="grid-3"><label class="field">مدت (دقیقه، اختیاری)<input type="number" name="duration" min="0" max="1440"></label><label class="field">وزن (کیلوگرم، اختیاری)<input type="number" name="weight" min="10" max="400" step="0.1"></label><label class="field">آمادگی از ۱۰۰ (اختیاری)<input type="number" name="readiness" min="0" max="100"></label></div><label class="field">یادداشت<textarea name="note" maxlength="1000"></textarea></label><button class="btn primary" type="submit">ثبت سابقه</button><p id="progressLogError" role="alert"></p></form><div class="member-personal-logs">${personalLogs.logs.length ? personalLogs.logs.map(log=>`<div class="list-item"><div class="grow"><b>${esc(log.title)}</b><div class="tiny">${log.category==='workout'?'تمرین':'دستاورد'} · ${J.timeAgo(log.created_at)}${log.duration===null?'':' · '+fa(log.duration)+' دقیقه'}${log.weight===null?'':' · '+fa(log.weight)+' کیلوگرم'}${log.readiness===null?'':' · آمادگی '+fa(log.readiness)+'/۱۰۰'}</div>${log.note?`<p>${esc(log.note)}</p>`:''}</div><button type="button" class="btn sm ghost" data-delete-log="${log.id}">حذف</button></div>`).join('') : emptyHTML('هنوز سابقه‌ای ثبت نشده است.', '✎')}</div>` : '<p class="hint">برای مشاهده و ثبت سوابق شخصی ورود مستقیم لازم است.</p>'}
        </div>
        <div class="split">
          <div class="card">
            <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--gold);box-shadow:0 0 10px var(--gold)"></span> یادداشت‌های مربی</div></div>
            ${Object.keys(p).length ? Object.keys(p).sort((a, b) => b - a).map((k) => (p[k].note ? `
              <div class="list-item"><div class="grow">
                <div class="title">${esc(J.MONTHS[k - 1])} ${fa(state.year)}</div>
                <div class="small muted">${esc(p[k].note)}</div>
              </div></div>` : '')).join('') || emptyHTML('یادداشتی ثبت نشده', '✎') : emptyHTML('جدولی پر نشده است', '▦')}
          </div>

          <div class="card">
            <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--blue);box-shadow:0 0 10px var(--blue)"></span> خودارزیابی‌های من</div></div>
            ${d.selfReports.length ? d.selfReports.slice().reverse().map((r) => `
              <div class="list-item"><div class="grow">
                <div class="title">${esc(J.MONTHS[r.month - 1])} — ${fa(r.sessions)} جلسه</div>
                <div class="tiny">${esc(r.feeling || '')} ${r.note ? '· ' + esc(r.note) : ''} · ${J.timeAgo(r.created_at)}</div>
              </div></div>`).join('') : emptyHTML('خودارزیابی ثبت نکرده‌ای', '✎')}
            <button class="btn mt-s" id="selfBtn2">+ ثبت خودارزیابی جدید</button>
          </div>
        </div>
      </div>`;

    const logForm = box.querySelector('#progressLogForm');
    if (logForm) logForm.addEventListener('submit', async event => {
      event.preventDefault(); if (!logForm.reportValidity()) return;
      const values=Object.fromEntries(new FormData(logForm));
      const submit=logForm.querySelector('button[type=submit]'); submit.disabled=true;
      try { await wellness('progress',values); if(state.view==='progress') await renderProgress(box); }
      catch(err) { if(logForm.isConnected) logForm.querySelector('#progressLogError').textContent=err.message; }
      finally { submit.disabled=false; }
    });
    box.querySelectorAll('[data-delete-log]').forEach(button => button.addEventListener('click',async()=>{
      if(!confirm('این سابقه حذف شود؟')) return;
      try { await wellness('progress/'+Number(button.dataset.deleteLog)+'/delete',{}); if(state.view==='progress') await renderProgress(box); }
      catch(err) { toast(err.message,'warn'); }
    }));
    document.getElementById('yearSel').addEventListener('change', (e) => {
      state.year = Number(e.target.value);
      renderProgress(box);
    });
    document.getElementById('selfBtn').addEventListener('click', selfReportForm);
    document.getElementById('selfBtn2').addEventListener('click', selfReportForm);
  }

  function selfReportForm() {
    const today = J.toJalali(new Date());
    modal({
      title: 'ثبت خودارزیابی ماهانه',
      body: `
        <form id="selfForm" class="col" style="gap:12px">
          <div class="grid-2">
            <div class="field"><label>ماه</label>
              <select name="month">${J.MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === today.jm ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>تعداد جلساتی که تمرین کردی</label>
              <input name="sessions" type="number" min="0" max="31" placeholder="تعداد جلسات" required></div>
          </div>
          <div class="field"><label>احساس کلی از این ماه</label>
            <select name="feeling">
              <option>عالی</option><option selected>خوب</option><option>متوسط</option><option>خسته</option><option>نیاز به برنامه سبک‌تر</option>
            </select>
          </div>
          <div class="field"><label>توضیح برای مربی</label>
            <textarea name="note" rows="3" placeholder="مثلاً: روی انعطاف پا بیشتر کار کردم"></textarea></div>
        </form>`,
      actions: [
        { label: 'انصراف', class: 'ghost', onClick: closeModal },
        {
          label: 'ثبت و ارسال به مربی', class: 'primary', onClick: async (o) => {
            const f = o.querySelector('#selfForm');
            if (!f.reportValidity()) return;
            const data = { year: state.year };
            new FormData(f).forEach((v, k) => { data[k] = v; });
            try {
              await api('/api/self-report', { method: 'POST', body: data });
              toast('خودارزیابی برای مربی ارسال شد', 'ok');
              closeModal();
              if (state.view === 'progress') switchView('progress');
            } catch (err) { toast(err.message, 'warn'); }
          }
        }
      ]
    });
  }

  /* =========================== اطلاعیه و اعلان ========================== */

  async function renderNews(box) {
    box.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="dot"></span> اطلاع‌رسانی باشگاه</div>
          <div class="chip-row">
            <button class="chip ${state.newsTab === 'news' ? 'active' : ''}" data-tab="news">اطلاعیه‌ها</button>
            <button class="chip ${state.newsTab === 'inbox' ? 'active' : ''}" data-tab="inbox">اعلان‌های من</button>
          </div>
        </div>
        <div id="newsBody">${loadingHTML()}</div>
      </div>`;
    box.querySelectorAll('[data-tab]').forEach((c) => c.addEventListener('click', () => {
      state.newsTab = c.dataset.tab;
      renderNews(box);
    }));

    const target = document.getElementById('newsBody');
    if (state.newsTab === 'news') {
      const d = await api('/api/announcements');
      target.innerHTML = d.announcements.length ? d.announcements.map((a) => `
        <div class="card" style="background:var(--bg-2);margin-bottom:12px">
          <div class="row between wrap" style="gap:8px">
            <div class="bold">${a.pinned ? '📌 ' : ''}${esc(a.title)}</div>
            <div class="row" style="gap:6px">
              <span class="badge blue">${esc(a.category)}</span>
              <span class="badge dark">${J.formatJalali(a.created_at)}</span>
              ${a.read ? '' : '<span class="badge red">خوانده نشده</span>'}
            </div>
          </div>
          <div class="small muted" style="margin-top:10px;white-space:pre-line">${esc(a.body)}</div>
          <div class="tiny" style="margin-top:8px">${a.author ? 'از طرف: ' + esc(a.author) : ''}</div>
        </div>`).join('') : emptyHTML('اطلاعیه‌ای منتشر نشده است', '✦');

      const cnt = document.getElementById('cntNews');
      const unread = d.announcements.filter((a) => !a.read).length;
      if (unread) { cnt.textContent = fa(unread); cnt.classList.remove('hidden'); } else { cnt.classList.add('hidden'); }
    } else {
      const d = await api('/api/notifications');
      target.innerHTML = d.notifications.length ? d.notifications.map((n) => `
        <div class="list-item">
          <span class="badge ${n.read ? 'dark' : 'red'}">${n.read ? '—' : 'جدید'}</span>
          <div class="grow"><div class="title">${esc(n.title)}</div>${n.body ? `<div class="tiny">${esc(n.body)}</div>` : ''}</div>
          <span class="tiny nowrap">${J.timeAgo(n.created_at)}</span>
        </div>`).join('') : emptyHTML('اعلانی نداری', '🔔');
      if (d.unread) {
        await api('/api/notifications/read', { method: 'POST' });
        pollBell();
      }
    }
  }

  async function openAnnouncement(id) {
    const d = await api('/api/announcements');
    const a = d.announcements.find((x) => x.id === id);
    if (!a) return;
    modal({
      title: a.title,
      body: `<div class="row" style="gap:6px;margin-bottom:10px">
          <span class="badge blue">${esc(a.category)}</span><span class="badge dark">${J.formatJalali(a.created_at, true)}</span>
        </div>
        <div style="white-space:pre-line">${esc(a.body)}</div>`,
      actions: [{ label: 'بستن', class: 'ghost', onClick: closeModal }]
    });
    await api('/api/announcements/' + a.id + '/read', { method: 'POST' });
    pollBell();
  }

  /* ============================= پرداخت شهریه ============================ */

  async function renderPayment(box) {
    let paymentData, faqData;
    try {
      const [p, f] = await Promise.all([api('/api/payment'), api('/api/faq')]);
      paymentData = p; faqData = f;
    } catch (err) {
      box.innerHTML = '<div class="card empty"><span class="big">⚠</span>' + esc(err.message) + '</div>';
      return;
    }

    box.innerHTML = `
      <div class="stack">
        <div class="card">
          <div class="card-head">
            <div class="card-title"><span class="dot" style="background:var(--gold);box-shadow:0 0 10px var(--gold)"></span> 💳 شماره کارت‌های شهریه</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
            ${paymentData.cards.map(function (c) {
              return '<div class="tuition-bank-card">' +
                '<div class="tuition-bank-label">' + esc(c.label) + '</div>' +
                '<div class="tuition-bank-number" dir="ltr">' +
                  esc(c.number.replace(/(.{4})/g, '$1 ').trim()) +
                '</div>' +
                '<div class="tuition-bank-holder">' + esc(c.holder) + '</div>' +
                '<button class="btn sm ghost" data-copy="' + esc(c.number) + '">📋 کپی شماره کارت</button>' +
              '</div>';
            }).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title"><span class="dot"></span> 📋 تعرفه شهریه ماهانه</div>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>رشته</th><th>شهریه (هزار تومان)</th><th>پرداخت</th></tr></thead>
              <tbody>
                ${paymentData.pricing.map(function (p) {
                  return '<tr>' +
                    '<td class="bold">' + esc(p.discipline) + '</td>' +
                    '<td><span class="badge gold">' + esc(p.price) + ' هزار تومان</span></td>' +
                    '<td><a href="' + esc(paymentData.baleLink) + '" target="_blank" class="btn sm primary">ارسال فیش</a></td>' +
                  '</tr>';
                }).join('')}
              </tbody>
            </table>
          </div>
          <p class="tiny" style="margin-top:12px">📌 مهلت پرداخت شهریه تا ۱۲ هر ماه. لطفاً پس از واریز فیش را از بله ارسال نمایید.</p>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title"><span class="dot" style="background:var(--blue);box-shadow:0 0 10px var(--blue)"></span> ❓ سوالات متداول</div>
          </div>
          <div id="panelFaq">
            ${(faqData.faqs || []).map(function (f, i) {
              return '<div style="border-bottom:1px solid var(--line-soft);padding:12px 0">' +
                '<div style="font-weight:600;cursor:pointer;font-size:13.5px" data-faq-toggle="' + i + '">' + esc(f.q) + ' ▾</div>' +
                '<div class="small muted" style="margin-top:6px;display:none;line-height:2" data-faq-body="' + i + '">' + esc(f.a) + '</div>' +
              '</div>';
            }).join('')}
          </div>
        </div>
      </div>`;

    // کپی شماره کارت
    box.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(btn.dataset.copy).then(function () {
          toast('شماره کارت کپی شد', 'ok');
        }).catch(function () {
          toast('کپی نشد', 'warn');
        });
      });
    });

    // باز/بسته کردن FAQ
    box.querySelectorAll('[data-faq-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = el.dataset.faqToggle;
        var body = box.querySelector('[data-faq-body="' + idx + '"]');
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
      });
    });
  }

  /* ============================== پشتیبانی ============================== */

  async function renderSupport(box) {
    let faqData;
    try { faqData = await api('/api/faq'); } catch { faqData = { faqs: [] }; }

    box.innerHTML = `
      <div class="stack">
        <div class="card">
          <div class="card-head">
            <div class="card-title"><span class="dot" style="background:var(--green);box-shadow:0 0 10px var(--green)"></span> 📞 راه‌های ارتباطی</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">
            <div style="text-align:center;padding:24px;background:var(--bg-2);border-radius:16px;border:1px solid var(--line)">
              <div style="font-size:36px;margin-bottom:12px">📱</div>
              <h4 style="margin:0 0 8px">پیام‌رسان بله</h4>
              <p class="muted small" style="margin:0 0 14px">سریع‌ترین راه ارتباط با ما</p>
              <a href="https://ble.ir/+989016399804" target="_blank" class="btn primary">باز کردن بله</a>
              <div class="en tiny" style="margin-top:10px;color:var(--gold)">+989016399804</div>
            </div>
            <div style="text-align:center;padding:24px;background:var(--bg-2);border-radius:16px;border:1px solid var(--line)">
              <div style="font-size:36px;margin-bottom:12px">📞</div>
              <h4 style="margin:0 0 8px">تماس تلفنی</h4>
              <p class="muted small" style="margin:0 0 14px">در ساعات اداری</p>
              <a href="tel:+989016399804" class="btn ghost">تماس بگیرید</a>
              <div class="en tiny" style="margin-top:10px;color:var(--gold)">+989016399804</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title"><span class="dot" style="background:var(--blue);box-shadow:0 0 10px var(--blue)"></span> ❓ سوالات متداول</div>
          </div>
          <div id="supportFaq">
            ${(faqData.faqs || []).map(function (f, i) {
              return '<div style="border-bottom:1px solid var(--line-soft);padding:14px 0">' +
                '<div style="font-weight:600;cursor:pointer;font-size:14px" data-sfaq-toggle="' + i + '">' + esc(f.q) + ' ◂</div>' +
                '<div class="small muted" style="margin-top:8px;display:none;line-height:2.2" data-sfaq-body="' + i + '">' + esc(f.a) + '</div>' +
              '</div>';
            }).join('')}
          </div>
        </div>
      </div>`;

    box.querySelectorAll('[data-sfaq-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = el.dataset.sfaqToggle;
        var body = box.querySelector('[data-sfaq-body="' + idx + '"]');
        var isOpen = body.style.display === 'block';
        body.style.display = isOpen ? 'none' : 'block';
        el.textContent = faqData.faqs[idx].q + (isOpen ? ' ◂' : ' ▾');
      });
    });
  }

  /* ============================== پروفایل =============================== */

  function renderProfile(box) {
    const belts = CFG.belts || ['سفید'];
    box.innerHTML = `
      <div class="split">
        <div class="card">
          <div class="card-head"><div class="card-title"><span class="dot"></span> اطلاعات من</div></div>
          <form id="profileForm" class="col" style="gap:12px">
            <div class="grid-2">
              <div class="field"><label>نام و نام خانوادگی</label><input name="full_name" value="${esc(ME.full_name)}"></div>
              <div class="field"><label>نام کاربری</label><input class="en" value="${esc(ME.username)}" disabled></div>
            </div>
            <div class="grid-3">
              <div class="field"><label>شماره موبایل</label><input name="phone" class="en" value="${esc(ME.phone || '')}"></div>
              <div class="field"><label>سن</label><input name="age" type="number" min="4" max="90" value="${ME.age || ''}"></div>
              <div class="field"><label>جنسیت</label>
                <select name="gender"><option value="">—</option><option ${ME.gender === 'مرد' ? 'selected' : ''}>مرد</option><option ${ME.gender === 'زن' ? 'selected' : ''}>زن</option></select>
              </div>
            </div>
            <div class="grid-3">
              <div class="field"><label>قد (سانتی‌متر)</label><input name="height_cm" type="number" value="${ME.height_cm || ''}"></div>
              <div class="field"><label>وزن (کیلوگرم)</label><input name="weight_kg" type="number" step="0.1" value="${ME.weight_kg || ''}"></div>
              <div class="field"><label>رشته ورزشی</label>
                <select name="discipline">
                  <option value="">—</option>
                  ${(CFG.disciplines || ['کاراته', 'کراسفیت', 'بوکس', 'ژیمناستیک', 'موی تای']).map((d) => `<option ${(ME.discipline || ME.style) === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="grid-2">
              <div class="field"><label for="pBirthDate">تاریخ دقیق تولد (شمسی)</label><input id="pBirthDate" name="birth_date" class="en" dir="ltr" placeholder="۱۳۹۰/۰۵/۲۱" maxlength="10" value="${esc(UI.birthDateValue(ME.birth_date))}"></div>
              <div class="field"><label for="pBloodGroup">گروه خونی</label><select id="pBloodGroup" name="blood_group" dir="ltr"><option value="">نامشخص</option>${UI.BLOOD_GROUPS.map(group => `<option ${ME.blood_group === group ? 'selected' : ''}>${group}</option>`).join('')}</select></div>
            </div>
            <div class="grid-2">
              <div class="field"><label>سابقه تمرین</label><input name="experience" value="${esc(ME.experience || '')}"></div>
            </div>
            <div><button class="btn primary" type="submit">ذخیره تغییرات</button></div>
          </form>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--gold);box-shadow:0 0 10px var(--gold)"></span> تغییر رمز عبور</div></div>
            <form id="passForm" class="col" style="gap:12px">
              <div class="field"><label>رمز فعلی</label><input type="password" name="current" class="en" required></div>
              <div class="field"><label>رمز جدید (حداقل ۶ حرف)</label><input type="password" name="next" class="en" minlength="6" required></div>
              <div><button class="btn gold" type="submit">تغییر رمز</button></div>
            </form>
          </div>

          <div class="card">
            <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--green);box-shadow:0 0 10px var(--green)"></span> خلاصه عضویت</div></div>
            <ul class="small muted" style="margin:0;padding-inline-start:18px">
              <li>عضو از: ${J.formatJalali(ME.created_at)}</li>
              <li>کمربند ثبت‌شده: ${esc(ME.belt || 'ثبت نشده')}</li>
            </ul>
          </div>
        </div>
      </div>`;

    box.querySelector('#profileForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      new FormData(e.target).forEach((v, k) => { data[k] = v; });
      try {
        const r = await api('/api/me', { method: 'PUT', body: data });
        ME = r.user;
        document.getElementById('meAvatar').innerHTML = UI.avatar(ME);
        toast('اطلاعات ذخیره شد', 'ok');
      } catch (err) { toast(err.message, 'warn'); }
    });

    box.querySelector('#passForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/password', { method: 'POST', body: { current: e.target.current.value, next: e.target.next.value } });
        toast('رمز عبور تغییر کرد', 'ok');
        e.target.reset();
      } catch (err) { toast(err.message, 'warn', 5000); }
    });
  }

  /* -------------------------------- اعلان‌ها ------------------------------ */

  let bellPending=false;
  async function pollBell() {
    if(bellPending || document.hidden)return;bellPending=true;
    try {
      const [d,ann] = await Promise.all([api('/api/notifications'),api('/api/announcements')]);
      const unreadNews = ann.announcements.filter((a) => !a.read).length;
      const total = d.unread + unreadNews;
      const dot = document.getElementById('bellDot');
      const cntNews = document.getElementById('cntNews');
      if (total > 0) {
        dot.textContent = fa(total);
        dot.classList.remove('hidden');
        cntNews.textContent = fa(unreadNews);
        cntNews.classList.toggle('hidden', unreadNews === 0);
      } else {
        dot.classList.add('hidden');
        cntNews.classList.add('hidden');
      }
    } catch (err) { /* نادیده */ } finally {bellPending=false;}
  }

  async function bellBox() {
    const d = await api('/api/notifications');
    modal({
      title: 'اعلان‌های من',
      body: `<div class="drawer-list">${d.notifications.length ? d.notifications.map((n) => `
        <div class="list-item">
          <span class="badge ${n.read ? 'dark' : 'red'}">${n.read ? '—' : 'جدید'}</span>
          <div class="grow"><div class="title">${esc(n.title)}</div>${n.body ? `<div class="tiny">${esc(n.body)}</div>` : ''}</div>
          <span class="tiny nowrap">${J.timeAgo(n.created_at)}</span>
        </div>`).join('') : emptyHTML('اعلانی نداری', '🔔')}</div>`,
      actions: [{ label: 'بستن', class: 'ghost', onClick: closeModal }]
    });
    if (d.unread) {
      await api('/api/notifications/read', { method: 'POST' });
      pollBell();
    }
  }
}());
