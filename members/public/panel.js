/* ============================================================
   پنل شاگرد — باشگاه آنلاین ارسلان دوجو
   ============================================================ */
(function () {
  'use strict';

  const { api, toast, modal, closeModal, esc, fa, STATUS, METRICS, heatClass, avatar, peerUrl } = UI;
  const J = window.Jalali;

  let CFG = null;
  let ME = null;
  const state = { view: 'home', year: null, newsTab: 'news' };

  const TITLES = {
    home: 'خانه',
    plans: 'تمرینات من',
    progress: 'جدول پیشرفت من',
    news: 'اطلاعیه‌ها و اعلان‌ها',
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
      location.href = '/';
      return;
    }

    document.getElementById('coachLink').href = peerUrl(CFG.coachPort);
    document.getElementById('meAvatar').innerHTML = UI.avatar(ME);
    document.getElementById('todayLabel').textContent = J.formatJalali(new Date());

    document.querySelectorAll('.nav-item[data-view]').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await api('/api/logout', { method: 'POST' });
      location.href = '/';
    });
    document.getElementById('bellBtn').addEventListener('click', bellBox);
    document.getElementById('quickProgress').addEventListener('click', selfReportForm);

    await switchView('home');
    pollBell();
    setInterval(pollBell, 45000);
  }

  const loadingHTML = () => '<div class="card center" style="padding:40px"><span class="loader"></span></div>';
  const emptyHTML = (t, icon = '🗂') => `<div class="empty"><span class="big">${icon}</span>${esc(t)}</div>`;

  async function switchView(view) {
    state.view = view;
    document.querySelectorAll('.nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.section').forEach((s) => s.classList.toggle('active', s.id === 'view-' + view));
    document.getElementById('viewTitle').textContent = TITLES[view];
    const box = document.getElementById('view-' + view);
    box.innerHTML = loadingHTML();
    try {
      if (view === 'home') await renderHome(box);
      else if (view === 'plans') await renderPlans(box);
      else if (view === 'progress') await renderProgress(box);
      else if (view === 'news') await renderNews(box);
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

    const series = progress.history.filter((h) => h.overall !== null).slice(-8);

    box.innerHTML = `
      <div class="stack">
        <div class="card pad-lg">
          <div class="row between wrap" style="gap:16px">
            <div class="row" style="gap:14px">
              ${avatar(ME, 'lg')}
              <div>
                <div class="bold" style="font-size:19px">سلام ${esc(ME.full_name)} 🥋</div>
                <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
                  <span class="badge gold">کمربند ${esc(ME.belt || 'سفید')}</span>
                  ${ME.style ? `<span class="badge blue">${esc(ME.style)}</span>` : ''}
                  ${ME.experience ? `<span class="badge">سابقه: ${esc(ME.experience)}</span>` : ''}
                  <span class="badge dark">عضو از ${J.formatShort(ME.created_at)}</span>
                </div>
              </div>
            </div>
            <div class="row" style="gap:10px">
              <button class="btn primary" data-goto="plans">تمرینات من (${fa(open.length)})</button>
              <button class="btn ghost" data-goto="progress">جدول پیشرفت</button>
            </div>
          </div>
        </div>

        <div class="grid-4">
          ${stat('تمرین باز', fa(open.length), 'باید انجام دهی', 'var(--red)')}
          ${stat('تکمیل‌شده', fa(done.length), 'از ابتدای عضویت', 'var(--green)')}
          ${stat('آخرین نمره', last && last.overall !== null ? fa(last.overall) : '—', lastMonth ? J.MONTHS[lastMonth - 1] + ' ' + fa(state.year) : 'ثبت نشده', 'var(--gold)')}
          ${stat('اطلاعیه خوانده‌نشده', fa(unreadNews), 'از سمت باشگاه', 'var(--blue)')}
        </div>

        <div class="split">
          <div class="stack">
            <div class="card">
              <div class="card-head">
                <div class="card-title"><span class="dot"></span> تمرین‌های پیش رو</div>
                <button class="btn sm ghost" data-goto="plans">همه ←</button>
              </div>
              ${open.length ? open.slice(0, 4).map((p) => planRow(p)).join('') : emptyHTML('تمرین بازی نداری — آفرین! 🎉', '⚑')}
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--gold);box-shadow:0 0 10px var(--gold)"></span> روند نمره کل</div></div>
              ${series.length > 1 ? `
                <div class="mini-bar" style="height:120px">
                  ${series.map((s) => `<i title="${esc(J.MONTHS[s.month - 1])} ${fa(s.year)}: ${fa(s.overall)}" style="height:${Math.max(6, s.overall)}%"></i>`).join('')}
                </div>
                <div class="row between tiny" style="margin-top:8px">
                  ${series.map((s) => `<span>${esc(J.MONTHS[s.month - 1].slice(0, 4))}</span>`).join('')}
                </div>
                <div class="hint mt-s">آخرین نمره: <b>${fa(series[series.length - 1].overall)}</b> از ۱۰۰</div>`
                : emptyHTML('هنوز نمره‌ای توسط مربی ثبت نشده است', '📊')}
            </div>
          </div>

          <div class="stack">
            <div class="card">
              <div class="card-head">
                <div class="card-title"><span class="dot" style="background:var(--green);box-shadow:0 0 10px var(--green)"></span> اطلاعیه‌های باشگاه</div>
                <button class="btn sm ghost" data-goto="news">همه ←</button>
              </div>
              ${ann.announcements.slice(0, 4).map((a) => `
                <div class="list-item" style="cursor:pointer" data-open-ann="${a.id}">
                  <div class="grow">
                    <div class="title">${a.pinned ? '📌 ' : ''}${esc(a.title)} ${a.read ? '' : '<span class="badge red">جدید</span>'}</div>
                    <div class="tiny">${esc(a.category)} · ${J.timeAgo(a.created_at)}</div>
                  </div>
                </div>`).join('') || emptyHTML('اطلاعیه‌ای نیست', '✦')}
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--blue);box-shadow:0 0 10px var(--blue)"></span> آخرین ثبت پیشرفت</div></div>
              ${last ? metricBars(last) : emptyHTML('مربی هنوز جدولی برای تو پر نکرده است', '▦')}
            </div>
          </div>
        </div>
      </div>`;

    wireGoto(box);
    box.querySelectorAll('[data-open-ann]').forEach((el) => el.addEventListener('click', () => openAnnouncement(Number(el.dataset.openAnn))));
    box.querySelectorAll('[data-plan-open]').forEach((b) => b.addEventListener('click', () => planModal(plans.plans.find((p) => p.id === Number(b.dataset.planOpen)))));
    box.querySelectorAll('[data-quick-done]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markDone(Number(b.dataset.quickDone));
      switchView('home');
    }));
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

  /* =========================== جدول پیشرفت من =========================== */

  async function renderProgress(box) {
    const d = await api('/api/progress?year=' + state.year);
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
              <input name="sessions" type="number" min="0" max="31" value="8"></div>
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
              <div class="field"><label>کمربند</label>
                <select name="belt">${belts.map((b) => `<option ${ME.belt === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
              </div>
            </div>
            <div class="grid-2">
              <div class="field"><label>سبک تمرینی</label><input name="style" value="${esc(ME.style || '')}"></div>
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
              <li>کمربند ثبت‌شده: ${esc(ME.belt || 'سفید')}</li>
              <li>اطلاعات تو در دیتابیس باشگاه ذخیره شده و پاک نمی‌شود.</li>
              <li>مربی می‌تواند جدول پیشرفت تو را ماه‌به‌ماه ببیند و پر کند.</li>
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

  async function pollBell() {
    try {
      const d = await api('/api/notifications');
      const ann = await api('/api/announcements');
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
    } catch (err) { /* نادیده */ }
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
