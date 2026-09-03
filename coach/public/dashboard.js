/* ============================================================
   پنل مربی — باشگاه آنلاین ارسلان دوجو
   ============================================================ */
(function () {
  'use strict';

  const { api, toast, modal, closeModal, confirmBox, esc, fa, STATUS, METRICS, heatClass, avatar, nl2br, peerUrl } = UI;
  const J = window.Jalali;

  let CFG = null;
  let ME = null;
  let MEMBERS = [];
  let YEARS = [];

  const state = {
    view: 'overview',
    memberQuery: '',
    memberBelt: '',
    progressMode: 'member',
    progressUserId: null,
    progressYear: null,
    newsTab: 'list'
  };

  const TITLES = {
    overview: 'داشبورد',
    members: 'شاگردان',
    plans: 'تمرینات',
    progress: 'جدول پیشرفت',
    news: 'اطلاع‌رسانی',
    settings: 'تنظیمات'
  };

  /* ------------------------------ راه‌اندازی ------------------------------ */

  init();

  async function init() {
    try {
      CFG = await UI.loadConfig();
      const me = await api('/api/me');
      if (!me.user) throw Object.assign(new Error('not logged in'), { status: 401 });
      ME = me.user;
    } catch (err) {
      location.href = '/';
      return;
    }

    const links = [document.getElementById('membersSiteLink'), document.getElementById('topMembersLink')];
    links.forEach((a) => { a.href = peerUrl(CFG.memberPort); });

    bindNav();
    await refreshBase();
    switchView('overview');
    pollBell();
    setInterval(pollBell, 45000);
  }

  async function refreshBase() {
    const [m, y] = await Promise.all([api('/api/members'), api('/api/years')]);
    MEMBERS = m.members;
    YEARS = y.years;
    if (!state.progressUserId && MEMBERS.length) state.progressUserId = MEMBERS[0].id;
    if (!state.progressYear) state.progressYear = YEARS[0] || CFG.jalaliYear;
    const cnt = document.getElementById('cntMembers');
    cnt.textContent = fa(MEMBERS.length);
    cnt.classList.remove('hidden');
  }

  function bindNav() {
    document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await api('/api/logout', { method: 'POST' });
      location.href = '/';
    });
    document.getElementById('quickAction').addEventListener('click', () => planForm());
    document.getElementById('bellBtn').addEventListener('click', bellBox);
  }

  async function switchView(view) {
    state.view = view;
    document.querySelectorAll('.nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.section').forEach((s) => s.classList.toggle('active', s.id === 'view-' + view));
    document.getElementById('viewTitle').textContent = TITLES[view];
    const box = document.getElementById('view-' + view);
    box.innerHTML = loadingHTML();
    try {
      if (view === 'overview') await renderOverview(box);
      else if (view === 'members') await renderMembers(box);
      else if (view === 'plans') await renderPlans(box);
      else if (view === 'progress') await renderProgress(box);
      else if (view === 'news') await renderNews(box);
      else if (view === 'settings') await renderSettings(box);
    } catch (err) {
      box.innerHTML = `<div class="card empty"><span class="big">⚠</span>${esc(err.message)}</div>`;
    }
  }

  const loadingHTML = () => '<div class="card center" style="padding:40px"><span class="loader"></span></div>';
  const emptyHTML = (text, icon = '🗂') => `<div class="empty"><span class="big">${icon}</span>${esc(text)}</div>`;

  /* ================================ داشبورد =============================== */

  async function renderOverview(box) {
    const d = await api('/api/overview');
    document.getElementById('todayLabel').textContent =
      `${J.formatJalali(new Date())} — ${CFG.club} — ${fa(d.jalali.monthName)} ${fa(d.jalali.year)}`;

    const club = await api('/api/progress/club?year=' + CFG.jalaliYear);
    const avgByMonth = [];
    for (let m = 1; m <= 12; m += 1) {
      const vals = club.rows.map((r) => (r.months[m] ? r.months[m].overall : null)).filter((v) => v !== null && v !== undefined);
      avgByMonth.push(vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0);
    }
    const maxAvg = Math.max(10, ...avgByMonth);

    box.innerHTML = `
      <div class="stack">
        <div class="grid-4">
          ${statTile('شاگردان فعال', fa(d.stats.activeMembers), `از ${fa(d.stats.members)} عضو ثبت‌شده`, 'var(--red)')}
          ${statTile('تمرین ارسال‌شده', fa(d.stats.plans), `${fa(d.stats.done)} مورد تکمیل شده`, 'var(--gold)')}
          ${statTile('در انتظار انجام', fa(d.stats.pending), 'تمرین باز بین شاگردان', 'var(--blue)')}
          ${statTile('پیشرفت این ماه', fa(d.stats.thisMonth), `${fa(d.jalali.monthName)} ${fa(d.jalali.year)} ثبت شده`, 'var(--green)')}
        </div>

        <div class="split">
          <div class="stack">
            <div class="card">
              <div class="card-head">
                <div class="card-title"><span class="dot"></span> میانگین نمره باشگاه در ${fa(CFG.jalaliYear)}</div>
                <span class="badge dark">نمره کل از ۱۰۰</span>
              </div>
              <div class="mini-bar" style="height:110px">
                ${avgByMonth.map((v, i) => `<i title="${esc(J.MONTHS[i])}: ${fa(v)}" style="height:${Math.max(4, (v / maxAvg) * 100)}%"></i>`).join('')}
              </div>
              <div class="row between tiny" style="margin-top:8px">
                ${J.MONTHS.map((m) => `<span>${esc(m.slice(0, 3))}</span>`).join('')}
              </div>
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--green);box-shadow:0 0 10px var(--green)"></span> آخرین تمرینات تکمیل‌شده</div></div>
              ${d.doneFeed.length ? d.doneFeed.map((f) => `
                <div class="list-item">
                  ${avatar({ full_name: f.full_name, avatar_color: f.avatar_color }, 'sm')}
                  <div class="grow">
                    <div class="title">${esc(f.full_name)} — ${esc(f.plan_title)}</div>
                    <div class="tiny">${J.timeAgo(f.completed_at)} ${f.member_note ? '· ' + esc(f.member_note) : ''}</div>
                  </div>
                  <span class="badge green">تکمیل</span>
                </div>`).join('') : emptyHTML('هنوز تمرینی تکمیل نشده است', '⚑')}
            </div>
          </div>

          <div class="stack">
            <div class="card">
              <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--gold);box-shadow:0 0 10px var(--gold)"></span> خودارزیابی شاگردان</div></div>
              ${d.selfReports.length ? d.selfReports.map((r) => `
                <div class="list-item">
                  <div class="grow">
                    <div class="title">${esc(r.full_name)}</div>
                    <div class="small muted">${esc(J.MONTHS[r.month - 1])} ${fa(r.year)} — ${fa(r.sessions)} جلسه · احساس: ${esc(r.feeling || '—')}</div>
                    ${r.note ? `<div class="tiny">${esc(r.note)}</div>` : ''}
                  </div>
                </div>`).join('') : emptyHTML('خودارزیابی ثبت نشده است', '✎')}
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--blue);box-shadow:0 0 10px var(--blue)"></span> تازه‌ترین شاگردان</div></div>
              ${d.latestMembers.map((m) => `
                <div class="list-item">
                  ${avatar({ full_name: m.full_name, avatar_color: m.avatar_color }, 'sm')}
                  <div class="grow">
                    <div class="title">${esc(m.full_name)}</div>
                    <div class="tiny">@${esc(m.username)} · ${esc(m.belt || '—')} · عضویت ${J.formatShort(m.created_at)}</div>
                  </div>
                  <button class="btn sm ghost" data-open-member="${m.id}">پروفایل</button>
                </div>`).join('')}
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title"><span class="dot"></span> آخرین اطلاعیه‌ها</div></div>
              ${d.announcements.length ? d.announcements.map((a) => `
                <div class="list-item">
                  <div class="grow">
                    <div class="title">${a.pinned ? '📌 ' : ''}${esc(a.title)}</div>
                    <div class="tiny">${esc(a.category)} · ${J.timeAgo(a.created_at)} · دیده‌شده توسط ${fa(a.read_count)} از ${fa(a.reach)}</div>
                  </div>
                </div>`).join('') : emptyHTML('اطلاعیه‌ای منتشر نشده', '✦')}
            </div>
          </div>
        </div>
      </div>`;

    box.querySelectorAll('[data-open-member]').forEach((b) => {
      b.addEventListener('click', () => memberDetail(Number(b.dataset.openMember)));
    });
  }

  function statTile(label, value, sub, color) {
    return `<div class="stat" style="--accent:${color}">
      <div class="label">${esc(label)}</div>
      <div class="value">${value}</div>
      <div class="sub">${esc(sub)}</div>
    </div>`;
  }

  /* ================================ شاگردان =============================== */

  async function renderMembers(box) {
    const belts = [...new Set(MEMBERS.map((m) => m.belt).filter(Boolean))];
    box.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="dot"></span> فهرست شاگردان <span class="badge dark" id="memberCount"></span></div>
          <div class="row wrap">
            <div class="search">
              <span class="ic">⌕</span>
              <input id="memberSearch" type="text" placeholder="جستجوی نام یا نام کاربری" value="${esc(state.memberQuery)}" style="width:220px">
            </div>
            <select id="beltFilter" style="width:150px">
              <option value="">همه کمربندها</option>
              ${belts.map((b) => `<option value="${esc(b)}" ${state.memberBelt === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
            </select>
            <button class="btn primary" id="addMemberBtn">+ ثبت شاگرد جدید</button>
          </div>
        </div>
        <div id="membersTable"></div>
      </div>`;

    const draw = () => {
      const q = state.memberQuery.trim().toLowerCase();
      const rows = MEMBERS.filter((m) =>
        (!q || m.full_name.toLowerCase().includes(q) || m.username.includes(q) || (m.phone || '').includes(q)) &&
        (!state.memberBelt || m.belt === state.memberBelt));
      document.getElementById('memberCount').textContent = fa(rows.length) + ' نفر';
      document.getElementById('membersTable').innerHTML = rows.length ? `
        <div class="table-wrap"><table class="data">
          <thead><tr>
            <th>شاگرد</th><th>کمربند</th><th>سن</th><th>تماس</th>
            <th>میانگین ${fa(CFG.jalaliYear)}</th><th>تمرین باز</th><th>عملیات</th>
          </tr></thead>
          <tbody>
            ${rows.map((m) => `<tr>
              <td>
                <div class="row" style="gap:10px">
                  ${avatar(m)}
                  <div>
                    <div class="bold">${esc(m.full_name)}</div>
                    <div class="tiny">@${esc(m.username)} ${m.active ? '' : '<span class="badge red">غیرفعال</span>'}</div>
                  </div>
                </div>
              </td>
              <td><span class="badge gold">${esc(m.belt || '—')}</span></td>
              <td>${m.age ? fa(m.age) : '—'}</td>
              <td class="en tiny">${esc(m.phone || '—')}</td>
              <td>${m.avg === null ? '<span class="muted tiny">ثبت نشده</span>' : `<span class="heat ${heatClass(m.avg)}">${fa(m.avg)}</span>`}</td>
              <td>${m.pending ? `<span class="badge red">${fa(m.pending)}</span>` : '<span class="badge green">۰</span>'}</td>
              <td>
                <div class="row" style="gap:6px">
                  <button class="btn sm" data-view-member="${m.id}">پروفایل</button>
                  <button class="btn sm ghost" data-progress-member="${m.id}">جدول</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>` : emptyHTML('شاگردی با این مشخصات پیدا نشد');

      box.querySelectorAll('[data-view-member]').forEach((b) => b.addEventListener('click', () => memberDetail(Number(b.dataset.viewMember))));
      box.querySelectorAll('[data-progress-member]').forEach((b) => b.addEventListener('click', () => {
        state.progressUserId = Number(b.dataset.progressMember);
        state.progressMode = 'member';
        switchView('progress');
      }));
    };

    draw();

    let t = null;
    document.getElementById('memberSearch').addEventListener('input', (e) => {
      state.memberQuery = e.target.value;
      clearTimeout(t);
      t = setTimeout(draw, 180);
    });
    document.getElementById('beltFilter').addEventListener('change', (e) => {
      state.memberBelt = e.target.value;
      draw();
    });
    document.getElementById('addMemberBtn').addEventListener('click', () => memberForm());
  }

  function memberForm(existing) {
    const isEdit = !!existing;
    modal({
      title: isEdit ? 'ویرایش شاگرد' : 'ثبت شاگرد جدید',
      wide: true,
      body: `
        <form id="memberForm" class="col" style="gap:14px">
          <div class="grid-3">
            <div class="field"><label>نام و نام خانوادگی *</label><input name="full_name" value="${esc(existing ? existing.full_name : '')}" required></div>
            <div class="field"><label>نام کاربری (انگلیسی) ${isEdit ? '' : '*'}</label>
              <input name="username" class="en" value="${esc(existing ? existing.username : '')}" ${isEdit ? 'disabled' : 'required'}></div>
            <div class="field"><label>شماره موبایل</label><input name="phone" class="en" value="${esc(existing ? existing.phone || '' : '')}" placeholder="09xxxxxxxxx"></div>
          </div>
          <div class="grid-4">
            <div class="field"><label>سن</label><input name="age" type="number" min="4" max="90" value="${existing && existing.age ? existing.age : ''}"></div>
            <div class="field"><label>قد (سانتی‌متر)</label><input name="height_cm" type="number" min="80" max="230" value="${existing && existing.height_cm ? existing.height_cm : ''}"></div>
            <div class="field"><label>وزن (کیلوگرم)</label><input name="weight_kg" type="number" step="0.1" min="15" max="250" value="${existing && existing.weight_kg ? existing.weight_kg : ''}"></div>
            <div class="field"><label>کمربند</label>
              <select name="belt">${(CFG.belts || ['سفید', 'زرد', 'نارنجی', 'سبز', 'آبی', 'قهوه‌ای', 'مشکی دان ۱']).map((b) => `<option ${existing && existing.belt === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
            </div>
          </div>
          <div class="grid-3">
            <div class="field"><label>جنسیت</label>
              <select name="gender"><option value="">—</option><option ${existing && existing.gender === 'مرد' ? 'selected' : ''}>مرد</option><option ${existing && existing.gender === 'زن' ? 'selected' : ''}>زن</option></select>
            </div>
            <div class="field"><label>سبک تمرینی</label><input name="style" value="${esc(existing ? existing.style || '' : '')}" placeholder="کیوکوشین"></div>
            <div class="field"><label>سابقه</label><input name="experience" value="${esc(existing ? existing.experience || '' : '')}" placeholder="۲ سال"></div>
          </div>
          ${isEdit ? '' : `<div class="field"><label>رمز عبور اولیه</label><input name="password" class="en" value="123456"><div class="tiny">شاگرد می‌تواند بعداً از پنل خودش رمز را عوض کند.</div></div>`}
          <div class="field"><label>یادداشت مربی</label><textarea name="notes" placeholder="مثلاً: روی انعطاف بیشتر کار کند">${esc(existing ? existing.notes || '' : '')}</textarea></div>
          ${isEdit ? `<label class="check"><input type="checkbox" name="active" ${existing.active ? 'checked' : ''}> حساب کاربری فعال باشد</label>` : ''}
        </form>`,
      actions: [
        { label: 'انصراف', class: 'ghost', onClick: closeModal },
        {
          label: isEdit ? 'ذخیره تغییرات' : 'ثبت شاگرد',
          class: 'primary',
          onClick: async (overlay) => {
            const f = overlay.querySelector('#memberForm');
            const data = {};
            new FormData(f).forEach((v, k) => { data[k] = v; });
            data.active = !!f.querySelector('input[name=active]')?.checked;
            try {
              if (isEdit) {
                await api('/api/members/' + existing.id, { method: 'PUT', body: data });
                toast('اطلاعات شاگرد ذخیره شد', 'ok');
              } else {
                await api('/api/members', { method: 'POST', body: data });
                toast('شاگرد با موفقیت ثبت شد', 'ok');
              }
              closeModal();
              await refreshBase();
              if (state.view === 'members') switchView('members');
            } catch (err) { toast(err.message, 'warn', 5000); }
          }
        }
      ]
    });
  }

  async function memberDetail(id) {
    modal({ title: 'در حال بارگذاری...', body: loadingHTML() });
    let d;
    try { d = await api('/api/members/' + id + '?year=' + state.progressYear); } catch (err) { closeModal(); return toast(err.message, 'warn'); }
    const m = d.member;

    modal({
      title: 'پروفایل شاگرد',
      wide: true,
      body: `
        <div class="row" style="gap:14px;margin-bottom:14px">
          ${avatar(m, 'lg')}
          <div class="grow">
            <div class="bold" style="font-size:17px">${esc(m.full_name)}</div>
            <div class="tiny">@${esc(m.username)} · عضو از ${J.formatShort(m.created_at)}</div>
            <div class="row" style="gap:6px;margin-top:6px">
              <span class="badge gold">${esc(m.belt || '—')}</span>
              ${m.style ? `<span class="badge blue">${esc(m.style)}</span>` : ''}
              ${m.experience ? `<span class="badge">${esc(m.experience)}</span>` : ''}
              ${m.active ? '' : '<span class="badge red">غیرفعال</span>'}
            </div>
          </div>
        </div>

        <div class="grid-4" style="margin-bottom:16px">
          ${statTile('میانگین سال', d.progress && Object.keys(d.progress).length ? fa(avgOf(d.progress)) : '—', `سال ${fa(d.year)}`, 'var(--gold)')}
          ${statTile('تمرین باز', fa(d.plans.filter((p) => p.status !== 'done').length), 'در انتظار انجام', 'var(--red)')}
          ${statTile('تمرین تکمیل‌شده', fa(d.plans.filter((p) => p.status === 'done').length), 'از ابتدای عضویت', 'var(--green)')}
          ${statTile('خودارزیابی', fa(d.reports.length), 'ثبت شده توسط شاگرد', 'var(--blue)')}
        </div>

        <div class="card" style="background:var(--bg-2)">
          <div class="card-title" style="margin-bottom:10px"><span class="dot"></span> جدول پیشرفت ${fa(d.year)}</div>
          <div class="table-wrap"><table class="data compact">
            <thead><tr><th>شاخص</th>${J.MONTHS.map((mn, i) => `<th>${esc(mn.slice(0, 4))}</th>`).join('')}</tr></thead>
            <tbody>
              ${METRICS.filter((x) => x.score).map((metric) => `<tr>
                <td>${esc(metric.label)}</td>
                ${Array.from({ length: 12 }, (_, i) => {
                  const cell = d.progress[i + 1];
                  const v = cell ? cell[metric.key] : null;
                  return `<td>${v === null || v === undefined ? '<span class="tiny">—</span>' : `<span class="heat ${metric.score ? heatClass(v) : ''}">${fa(v)}</span>`}</td>`;
                }).join('')}
              </tr>`).join('')}
            </tbody>
          </table></div>
        </div>

        <div class="card mt" style="background:var(--bg-2)">
          <div class="card-title" style="margin-bottom:10px"><span class="dot" style="background:var(--blue)"></span> تمرینات</div>
          ${d.plans.length ? d.plans.map((p) => `
            <div class="list-item">
              <div class="grow">
                <div class="title">${esc(p.title)}</div>
                <div class="tiny">${esc(p.category)} ${p.due_on ? '· مهلت ' + J.formatShort(p.due_on) : ''} ${p.member_note ? '· ' + esc(p.member_note) : ''}</div>
              </div>
              <span class="badge ${STATUS[p.status].cls}">${esc(STATUS[p.status].label)}</span>
            </div>`).join('') : emptyHTML('تمرینی برای این شاگرد ارسال نشده', '⚑')}
        </div>

        <div class="card mt" style="background:var(--bg-2)">
          <div class="card-title" style="margin-bottom:10px"><span class="dot" style="background:var(--gold)"></span> خودارزیابی‌ها</div>
          ${d.reports.length ? d.reports.map((r) => `
            <div class="list-item"><div class="grow">
              <div class="title">${esc(J.MONTHS[r.month - 1])} ${fa(r.year)} — ${fa(r.sessions)} جلسه</div>
              <div class="tiny">${esc(r.feeling || '')} ${r.note ? '· ' + esc(r.note) : ''}</div>
            </div></div>`).join('') : emptyHTML('خودارزیابی ثبت نشده', '✎')}
        </div>`,
      actions: [
        { label: 'بستن', class: 'ghost', onClick: closeModal },
        { label: 'بازنشانی رمز', class: '', onClick: () => resetPassword(m) },
        { label: 'ورود به پنل شاگرد', class: '', onClick: () => impersonate(m) },
        { label: 'ویرایش اطلاعات', class: 'primary', onClick: () => memberForm(m) }
      ]
    });
  }

  function avgOf(progressMap) {
    const vals = Object.values(progressMap).map((p) => p.overall).filter((v) => v !== null && v !== undefined);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }

  function resetPassword(m) {
    modal({
      title: 'بازنشانی رمز عبور',
      body: `<p class="muted small">رمز جدید برای <b>${esc(m.full_name)}</b>:</p>
        <div class="field"><input id="np" class="en" value="123456"></div>`,
      actions: [
        { label: 'انصراف', class: 'ghost', onClick: closeModal },
        {
          label: 'ثبت رمز جدید', class: 'primary', onClick: async (o) => {
            try {
              await api(`/api/members/${m.id}/password`, { method: 'POST', body: { password: o.querySelector('#np').value } });
              toast('رمز عبور بازنشانی شد', 'ok');
              closeModal();
            } catch (err) { toast(err.message, 'warn'); }
          }
        }
      ]
    });
  }

  async function impersonate(m) {
    try {
      const r = await api(`/api/members/${m.id}/impersonate`, { method: 'POST' });
      const url = `${peerUrl(CFG.memberPort)}/impersonate?token=${r.token}`;
      window.open(url, '_blank', 'noopener');
      toast('پنل شاگرد در تب جدید باز شد', 'ok');
    } catch (err) { toast(err.message, 'warn'); }
  }

  /* ================================ تمرینات =============================== */

  async function renderPlans(box) {
    const d = await api('/api/plans');
    box.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="dot"></span> تمرینات ارسال‌شده <span class="badge dark">${fa(d.plans.length)}</span></div>
          <button class="btn primary" id="newPlanBtn">+ ارسال تمرین جدید</button>
        </div>
        <div class="stack" id="plansList">
          ${d.plans.length ? d.plans.map(planCard).join('') : emptyHTML('هنوز تمرینی ارسال نشده است', '⚑')}
        </div>
      </div>`;
    document.getElementById('newPlanBtn').addEventListener('click', () => planForm());
    wirePlanCards(box);
  }

  function planCard(p) {
    const pct = p.total ? Math.round((p.done_count / p.total) * 100) : 0;
    return `<div class="card" style="background:var(--bg-2)" data-plan="${p.id}">
      <div class="row between wrap" style="gap:10px">
        <div class="grow">
          <div class="bold">${esc(p.title)}</div>
          <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
            <span class="badge blue">${esc(p.category)}</span>
            <span class="badge ${p.difficulty === 'سنگین' ? 'red' : p.difficulty === 'سبک' ? 'green' : 'gold'}">${esc(p.difficulty)}</span>
            ${p.duration ? `<span class="badge">${esc(p.duration)}</span>` : ''}
            ${p.due_on ? `<span class="badge dark">مهلت ${J.formatShort(p.due_on)}</span>` : ''}
            <span class="badge">ارسال ${J.formatShort(p.created_at)}</span>
          </div>
        </div>
        <div class="row" style="gap:6px">
          <button class="btn sm" data-plan-detail="${p.id}">جزئیات و بازخورد</button>
          <button class="btn sm ghost" data-plan-edit="${p.id}">ویرایش</button>
          <button class="btn sm danger" data-plan-del="${p.id}">حذف</button>
        </div>
      </div>
      ${p.body ? `<div class="small muted" style="margin-top:10px;white-space:pre-line">${esc(p.body)}</div>` : ''}
      <div class="row" style="gap:10px;margin-top:12px">
        <div class="progress-bar grow"><i style="width:${pct}%"></i></div>
        <span class="tiny nowrap">${fa(p.done_count)} از ${fa(p.total)} شاگرد (${fa(pct)}٪)</span>
      </div>
    </div>`;
  }

  function wirePlanCards(box) {
    box.querySelectorAll('[data-plan-detail]').forEach((b) => b.addEventListener('click', () => planDetail(Number(b.dataset.planDetail))));
    box.querySelectorAll('[data-plan-edit]').forEach((b) => b.addEventListener('click', async () => {
      const d = await api('/api/plans/' + b.dataset.planEdit);
      planForm(d.plan);
    }));
    box.querySelectorAll('[data-plan-del]').forEach((b) => b.addEventListener('click', () => {
      confirmBox('این تمرین و وضعیت انجام شاگردان حذف شود؟', async () => {
        await api('/api/plans/' + b.dataset.planDel, { method: 'DELETE' });
        toast('تمرین حذف شد', 'ok');
        switchView('plans');
      }, 'حذف تمرین');
    }));
  }

  function planForm(existing) {
    const isEdit = !!existing;
    const selected = isEdit ? existing.assignments.map((a) => a.user_id) : [];
    modal({
      title: isEdit ? 'ویرایش تمرین' : 'ارسال تمرین جدید',
      wide: true,
      body: `
        <form id="planForm" class="col" style="gap:14px">
          <div class="grid-2">
            <div class="field"><label>عنوان تمرین *</label><input name="title" value="${esc(existing ? existing.title : '')}" required placeholder="مثلاً: تمرین تکنیک‌های پا"></div>
            <div class="field"><label>مدت زمان</label><input name="duration" value="${esc(existing ? existing.duration || '' : '')}" placeholder="۶۰ دقیقه"></div>
          </div>
          <div class="grid-3">
            <div class="field"><label>دسته</label>
              <select name="category">${['تمرین', 'بدنسازی', 'تکنیک', 'کاتا', 'مبارزه', 'کشش و انعطاف'].map((c) => `<option ${existing && existing.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>سختی</label>
              <select name="difficulty">${['سبک', 'متوسط', 'سنگین'].map((c) => `<option ${existing && existing.difficulty === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>مهلت انجام (شمسی)</label>${jalaliDateField('due', existing ? existing.due_on : null)}</div>
          </div>
          <div class="field"><label>شرح تمرین</label>
            <textarea name="body" rows="5" placeholder="حرکت‌ها، تعداد ست و تکرار...">${esc(existing ? existing.body || '' : '')}</textarea>
          </div>
          ${isEdit ? '<div class="hint">برای تغییر گیرندگان تمرین از بخش «جزئیات و بازخورد» استفاده کنید.</div>' : memberPicker(selected)}
        </form>`,
      actions: [
        { label: 'انصراف', class: 'ghost', onClick: closeModal },
        {
          label: isEdit ? 'ذخیره' : 'ارسال به شاگردان',
          class: 'primary',
          onClick: async (overlay) => {
            const f = overlay.querySelector('#planForm');
            const data = {};
            new FormData(f).forEach((v, k) => { data[k] = v; });
            data.due_on = readJalaliDate(overlay, 'due');
            if (isEdit) {
              try {
                await api('/api/plans/' + existing.id, { method: 'PUT', body: data });
                toast('تمرین ذخیره شد', 'ok');
                closeModal();
                switchView('plans');
              } catch (err) { toast(err.message, 'warn'); }
              return;
            }
            data.member_ids = pickedIds(overlay);
            data.all_members = overlay.querySelector('#pickAll').checked;
            try {
              const r = await api('/api/plans', { method: 'POST', body: data });
              toast(`تمرین برای ${fa(r.plan.total)} شاگرد ارسال شد`, 'ok');
              closeModal();
              switchView('plans');
            } catch (err) { toast(err.message, 'warn', 5000); }
          }
        }
      ]
    });
    wireMemberPicker();
  }

  async function planDetail(id) {
    let d;
    try { d = await api('/api/plans/' + id); } catch (err) { return toast(err.message, 'warn'); }
    const p = d.plan;
    modal({
      title: 'جزئیات تمرین',
      wide: true,
      body: `
        <div class="bold" style="font-size:17px">${esc(p.title)}</div>
        <div class="row" style="gap:6px;margin:6px 0 12px">
          <span class="badge blue">${esc(p.category)}</span><span class="badge">${esc(p.difficulty)}</span>
          <span class="badge dark">${fa(p.done_count)} از ${fa(p.total)} تکمیل</span>
        </div>
        ${p.body ? `<div class="card small muted" style="background:var(--bg-2);white-space:pre-line;margin-bottom:14px">${esc(p.body)}</div>` : ''}
        <div class="table-wrap"><table class="data compact">
          <thead><tr><th>شاگرد</th><th>وضعیت</th><th>یادداشت شاگرد</th><th>بازخورد مربی</th></tr></thead>
          <tbody>
            ${p.assignments.map((a) => `<tr>
              <td><div class="row" style="gap:8px">${avatar({ full_name: a.full_name, avatar_color: a.avatar_color }, 'sm')}<span>${esc(a.full_name)}</span></div></td>
              <td>
                <select data-status="${a.id}" style="width:130px">
                  ${Object.keys(STATUS).map((k) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${esc(STATUS[k].label)}</option>`).join('')}
                </select>
              </td>
              <td class="tiny">${esc(a.member_note || '—')}${a.completed_at ? `<div class="tiny">${J.timeAgo(a.completed_at)}</div>` : ''}</td>
              <td>
                <div class="row" style="gap:6px">
                  <input data-note="${a.id}" value="${esc(a.coach_note || '')}" placeholder="بازخورد..." style="min-width:150px">
                  <button class="btn sm" data-send-note="${a.id}">ارسال</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>

        <div class="card mt" style="background:var(--bg-2)">
          <div class="card-title" style="margin-bottom:8px">افزودن شاگرد به این تمرین</div>
          ${memberPicker([])}
          <button class="btn primary mt-s" id="assignMore">ارسال به انتخاب‌شده‌ها</button>
        </div>`,
      actions: [{ label: 'بستن', class: 'ghost', onClick: closeModal }]
    });
    wireMemberPicker();

    const overlay = document.querySelector('.overlay');
    overlay.querySelectorAll('[data-status]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await api('/api/assignments/' + sel.dataset.status, { method: 'PUT', body: { status: sel.value } });
          toast('وضعیت ذخیره شد', 'ok', 1800);
        } catch (err) { toast(err.message, 'warn'); }
      });
    });
    overlay.querySelectorAll('[data-send-note]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id2 = b.dataset.sendNote;
        const note = overlay.querySelector(`[data-note="${id2}"]`).value;
        try {
          await api('/api/assignments/' + id2, { method: 'PUT', body: { coach_note: note } });
          toast('بازخورد برای شاگرد ارسال شد', 'ok');
        } catch (err) { toast(err.message, 'warn'); }
      });
    });
    overlay.querySelector('#assignMore').addEventListener('click', async () => {
      const ids = pickedIds(overlay);
      if (!ids.length) return toast('شاگردی انتخاب نشده', 'warn');
      try {
        await api(`/api/plans/${p.id}/assign`, { method: 'POST', body: { member_ids: ids } });
        toast('تمرین برای شاگردان انتخابی ارسال شد', 'ok');
        planDetail(p.id);
      } catch (err) { toast(err.message, 'warn'); }
    });
  }

  /* ------------------------ انتخاب شاگرد (مشترک) ------------------------ */

  function memberPicker(selected) {
    return `<div class="field">
      <label>گیرندگان</label>
      <label class="check"><input type="checkbox" id="pickAll"> ارسال به همه شاگردان فعال</label>
      <input type="text" id="pickSearch" placeholder="جستجوی شاگرد..." style="margin:6px 0">
      <div class="chip-row" id="pickList" style="max-height:190px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:8px;background:var(--bg-2)">
        ${MEMBERS.map((m) => `<label class="check" data-pick="${esc(m.full_name.toLowerCase())}" style="width:100%">
          <input type="checkbox" class="pick" value="${m.id}" ${selected.includes(m.id) ? 'checked' : ''}>
          <span>${esc(m.full_name)}</span>
          <span class="badge" style="margin-inline-start:auto">${esc(m.belt || '—')}</span>
        </label>`).join('')}
      </div>
    </div>`;
  }

  function wireMemberPicker(scope) {
    const overlay = scope || document.querySelector('.overlay') || document;
    const all = overlay.querySelector('#pickAll');
    const boxes = () => [...overlay.querySelectorAll('.pick')];
    if (all) {
      all.addEventListener('change', () => boxes().forEach((b) => { b.checked = all.checked; }));
    }
    const search = overlay.querySelector('#pickSearch');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        overlay.querySelectorAll('[data-pick]').forEach((l) => {
          l.style.display = !q || l.dataset.pick.includes(q) ? '' : 'none';
        });
      });
    }
  }

  function pickedIds(scope) {
    const root = scope || document;
    return [...root.querySelectorAll('.pick:checked')].map((b) => Number(b.value));
  }

  /* --------------------------- انتخاب تاریخ شمسی -------------------------- */

  function jalaliDateField(name, isoValue) {
    const today = J.toJalali(new Date());
    let jy = today.jy; let jm = today.jm; let jd = today.jd;
    if (isoValue) {
      const d = new Date(isoValue);
      if (!Number.isNaN(d.getTime())) { const t = J.toJalali(d); jy = t.jy; jm = t.jm; jd = t.jd; }
    }
    const hasValue = !!isoValue;
    const years = [];
    for (let y = CFG.jalaliYear - 2; y <= CFG.jalaliYear + 2; y += 1) years.push(y);
    return `<div class="row" style="gap:6px" data-jdate="${name}">
      <select data-j="d">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${jd === i + 1 ? 'selected' : ''}>${fa(i + 1)}</option>`).join('')}</select>
      <select data-j="m">${J.MONTHS.map((mn, i) => `<option value="${i + 1}" ${jm === i + 1 ? 'selected' : ''}>${esc(mn)}</option>`).join('')}</select>
      <select data-j="y"><option value="" ${hasValue ? '' : 'selected'}>بدون مهلت</option>${years.map((y) => `<option value="${y}" ${jy === y ? 'selected' : ''}>${fa(y)}</option>`).join('')}</select>
    </div>`;
  }

  function readJalaliDate(root, name) {
    const box = root.querySelector(`[data-jdate="${name}"]`);
    if (!box) return null;
    const yRaw = box.querySelector('[data-j="y"]').value;
    if (!yRaw) return null;
    const y = Number(yRaw);
    const m = Number(box.querySelector('[data-j="m"]').value);
    const d = Number(box.querySelector('[data-j="d"]').value);
    return J.toGregorianISO(y, m, d);
  }

  /* ============================= جدول پیشرفت ============================= */

  async function renderProgress(box) {
    const years = YEARS.length ? YEARS : [CFG.jalaliYear];
    box.innerHTML = `
      <div class="card">
        <div class="card-head wrap">
          <div class="card-title"><span class="dot"></span> جدول پیشرفت شاگردان</div>
          <div class="row wrap" style="gap:8px">
            <div class="chip-row">
              <button class="chip ${state.progressMode === 'member' ? 'active' : ''}" data-mode="member">جدول یک شاگرد (ماهانه)</button>
              <button class="chip ${state.progressMode === 'club' ? 'active' : ''}" data-mode="club">نمای کلی باشگاه (سالانه)</button>
            </div>
            <select id="yearSel" style="width:120px">${years.map((y) => `<option value="${y}" ${y === state.progressYear ? 'selected' : ''}>سال ${fa(y)}</option>`).join('')}</select>
            <button class="btn sm" id="exportCsv">خروجی اکسل (CSV)</button>
          </div>
        </div>
        <div id="progressBody">${loadingHTML()}</div>
      </div>`;

    box.querySelectorAll('[data-mode]').forEach((c) => c.addEventListener('click', () => {
      state.progressMode = c.dataset.mode;
      renderProgress(box);
    }));
    document.getElementById('yearSel').addEventListener('change', (e) => {
      state.progressYear = Number(e.target.value);
      renderProgress(box);
    });
    document.getElementById('exportCsv').addEventListener('click', () => {
      window.open('/api/export/progress?year=' + state.progressYear, '_blank');
    });

    if (state.progressMode === 'club') await renderClubMatrix(document.getElementById('progressBody'));
    else await renderMemberGrid(document.getElementById('progressBody'));
  }

  async function renderMemberGrid(target) {
    const picker = `
      <div class="row wrap" style="gap:10px;margin-bottom:14px">
        <select id="memberSel" style="min-width:230px">
          ${MEMBERS.map((m) => `<option value="${m.id}" ${m.id === state.progressUserId ? 'selected' : ''}>${esc(m.full_name)} — ${esc(m.belt || '')}</option>`).join('')}
        </select>
        <span class="tiny">روی سرستون هر ماه کلیک کنید تا یادداشت و جزئیات را ثبت کنید. تغییر اعداد بلافاصله ذخیره می‌شود.</span>
      </div>`;
    target.innerHTML = picker + loadingHTML();
    document.getElementById('memberSel').addEventListener('change', (e) => {
      state.progressUserId = Number(e.target.value);
      renderMemberGrid(target);
    });

    const d = await api(`/api/progress?user_id=${state.progressUserId}&year=${state.progressYear}`);
    const p = d.progress;

    const grid = `
      <div class="table-wrap"><table class="data compact" id="progressGrid">
        <thead><tr>
          <th style="min-width:120px">شاخص / ماه</th>
          ${J.MONTHS.map((mn, i) => `<th style="cursor:pointer;min-width:64px" data-month="${i + 1}">${esc(mn)}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${METRICS.filter((x) => !x.score || x.key !== 'overall').map((metric) => `<tr>
            <td class="bold">${esc(metric.label)} <span class="tiny">${esc(metric.unit)}</span></td>
            ${Array.from({ length: 12 }, (_, i) => {
              const cell = p[i + 1];
              const v = cell ? cell[metric.key] : null;
              return `<td><input type="number" data-m="${i + 1}" data-k="${metric.key}" value="${v === null || v === undefined ? '' : v}"
                min="${metric.key === 'sessions' ? 0 : 0}" max="${metric.max}" step="${metric.key === 'weight_kg' ? '0.1' : '1'}"
                style="width:62px;text-align:center"></td>`;
            }).join('')}
          </tr>`).join('')}
          <tr>
            <td class="bold">نمره کل <span class="tiny">خودکار</span></td>
            ${Array.from({ length: 12 }, (_, i) => {
              const cell = p[i + 1];
              const v = cell ? cell.overall : null;
              return `<td class="center"><span class="heat ${heatClass(v)}" style="min-width:44px;display:block">${v === null || v === undefined ? '—' : fa(v)}</span></td>`;
            }).join('')}
          </tr>
          <tr>
            <td class="bold">یادداشت مربی</td>
            ${Array.from({ length: 12 }, (_, i) => {
              const cell = p[i + 1];
              return `<td class="tiny">${cell && cell.note ? esc(cell.note.slice(0, 26)) + (cell.note.length > 26 ? '…' : '') : '<span style="color:#4d4d60">—</span>'}</td>`;
            }).join('')}
          </tr>
        </tbody>
      </table></div>`;

    const reportsHTML = d.selfReports.length ? `
      <div class="card mt" style="background:var(--bg-2)">
        <div class="card-title" style="margin-bottom:8px"><span class="dot" style="background:var(--gold)"></span> خودارزیابی شاگرد در این سال</div>
        ${d.selfReports.map((r) => `<div class="list-item"><div class="grow">
          <div class="title">${esc(J.MONTHS[r.month - 1])} — ${fa(r.sessions)} جلسه تمرین</div>
          <div class="tiny">${esc(r.feeling || '')} ${r.note ? '· ' + esc(r.note) : ''}</div>
        </div></div>`).join('')}
      </div>` : '';

    target.innerHTML = picker + grid + reportsHTML;

    document.getElementById('memberSel').addEventListener('change', (e) => {
      state.progressUserId = Number(e.target.value);
      renderMemberGrid(target);
    });

    target.querySelectorAll('#progressGrid [data-month]').forEach((th) => {
      th.addEventListener('click', () => monthEditor(state.progressUserId, state.progressYear, Number(th.dataset.month)));
    });

    let saveTimer = null;
    target.querySelectorAll('#progressGrid input').forEach((inp) => {
      inp.addEventListener('change', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveMonthFromGrid(target, Number(inp.dataset.m)), 260);
      });
    });
  }

  function readGridMonth(target, month) {
    const data = { user_id: state.progressUserId, year: state.progressYear, month };
    target.querySelectorAll(`#progressGrid input[data-m="${month}"]`).forEach((inp) => {
      data[inp.dataset.k] = inp.value === '' ? null : Number(inp.value);
    });
    return data;
  }

  async function saveMonthFromGrid(target, month) {
    try {
      const r = await api('/api/progress', { method: 'PUT', body: readGridMonth(target, month) });
      const cell = target.querySelector(`#progressGrid tr:nth-last-child(2) td:nth-child(${month + 1}) .heat`);
      if (cell) {
        cell.textContent = r.progress.overall === null ? '—' : fa(r.progress.overall);
        cell.className = 'heat ' + heatClass(r.progress.overall);
      }
      toast(`${J.MONTHS[month - 1]} ذخیره شد`, 'ok', 1600);
    } catch (err) { toast(err.message, 'warn'); }
  }

  async function monthEditor(userId, year, month) {
    const member = MEMBERS.find((m) => m.id === userId) || { full_name: 'شاگرد' };
    const d = await api(`/api/progress?user_id=${userId}&year=${year}`);
    const cell = d.progress[month] || {};
    const self = (d.selfReports || []).find((r) => r.month === month);

    modal({
      title: `${member.full_name} — ${J.MONTHS[month - 1]} ${fa(year)}`,
      body: `
        ${self ? `<div class="hint" style="margin-bottom:12px">خودارزیابی شاگرد: ${fa(self.sessions)} جلسه — ${esc(self.feeling || '')}${self.note ? '<br>' + esc(self.note) : ''}</div>` : ''}
        <form id="monthForm" class="col" style="gap:12px">
          <div class="grid-3">
            ${METRICS.filter((x) => x.key !== 'overall').map((metric) => `
              <div class="field"><label>${esc(metric.label)} <span class="tiny">(${esc(metric.unit)})</span></label>
                <input name="${metric.key}" type="number" step="${metric.key === 'weight_kg' ? '0.1' : '1'}" min="0" max="${metric.max}"
                  value="${cell[metric.key] === null || cell[metric.key] === undefined ? '' : cell[metric.key]}">
              </div>`).join('')}
          </div>
          <div class="field"><label>نمره کل (اختیاری — اگر خالی باشد خودکار محاسبه می‌شود)</label>
            <input name="overall" type="number" min="0" max="100" value="${cell.overall === null || cell.overall === undefined ? '' : cell.overall}">
          </div>
          <div class="field"><label>یادداشت مربی</label>
            <textarea name="note" rows="3" placeholder="نکته‌ای درباره پیشرفت این ماه...">${esc(cell.note || '')}</textarea>
          </div>
        </form>`,
      actions: [
        ...(!cell.id ? [] : [{
          label: 'حذف این ماه', class: 'danger', onClick: async () => {
            if (!cell.id) return;
            await api('/api/progress/' + cell.id, { method: 'DELETE' });
            toast('رکورد حذف شد', 'ok');
            closeModal();
            renderProgress(document.getElementById('view-progress'));
          }
        }]),
        { label: 'بستن', class: 'ghost', onClick: closeModal },
        {
          label: 'ذخیره', class: 'primary', onClick: async (overlay) => {
            const f = overlay.querySelector('#monthForm');
            const data = { user_id: userId, year, month };
            new FormData(f).forEach((v, k) => { data[k] = v; });
            try {
              await api('/api/progress', { method: 'PUT', body: data });
              toast('ذخیره شد و برای شاگرد اطلاع‌رسانی شد', 'ok');
              closeModal();
              renderProgress(document.getElementById('view-progress'));
            } catch (err) { toast(err.message, 'warn'); }
          }
        }
      ]
    });
  }

  async function renderClubMatrix(target) {
    const d = await api('/api/progress/club?year=' + state.progressYear);
    const rows = d.rows;
    if (!rows.length) { target.innerHTML = emptyHTML('شاگردی ثبت نشده است'); return; }

    const monthAvg = [];
    for (let m = 1; m <= 12; m += 1) {
      const vals = rows.map((r) => (r.months[m] ? r.months[m].overall : null)).filter((v) => v !== null && v !== undefined);
      monthAvg.push(vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
    }

    target.innerHTML = `
      <div class="table-wrap"><table class="data compact">
        <thead><tr>
          <th style="min-width:170px">شاگرد</th><th>کمربند</th>
          ${J.MONTHS.map((mn, i) => `<th style="min-width:58px">${esc(mn.slice(0, 4))}</th>`).join('')}
          <th>میانگین</th>
        </tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>
            <td><div class="row" style="gap:8px">${avatar(r.member, 'sm')}<span>${esc(r.member.full_name)}</span></div></td>
            <td class="tiny">${esc(r.member.belt || '—')}</td>
            ${Array.from({ length: 12 }, (_, i) => {
              const c = r.months[i + 1];
              const v = c ? c.overall : null;
              return `<td><span class="heat ${heatClass(v)}" style="display:block;cursor:pointer" data-cell="${r.member.id}" data-cell-month="${i + 1}">${v === null || v === undefined ? '—' : fa(v)}</span></td>`;
            }).join('')}
            <td><span class="heat ${heatClass(r.avg)}">${r.avg === null ? '—' : fa(r.avg)}</span></td>
          </tr>`).join('')}
          <tr style="background:var(--panel)">
            <td class="bold">میانگین باشگاه</td><td></td>
            ${monthAvg.map((v) => `<td><span class="heat ${heatClass(v)}">${v === null ? '—' : fa(v)}</span></td>`).join('')}
            <td></td>
          </tr>
        </tbody>
      </table></div>
      <p class="tiny" style="margin-top:10px">روی هر خانه کلیک کنید تا نمره آن ماه را ثبت یا ویرایش کنید. رنگ خانه‌ها نشان‌دهنده سطح نمره است.</p>`;

    target.querySelectorAll('[data-cell]').forEach((c) => {
      c.addEventListener('click', () => {
        state.progressUserId = Number(c.dataset.cell);
        monthEditor(Number(c.dataset.cell), state.progressYear, Number(c.dataset.cellMonth));
      });
    });
  }

  /* ============================== اطلاع‌رسانی ============================= */

  async function renderNews(box) {
    box.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="dot"></span> اطلاع‌رسانی باشگاه</div>
          <div class="chip-row">
            <button class="chip ${state.newsTab === 'list' ? 'active' : ''}" data-tab="list">اطلاعیه‌ها</button>
            <button class="chip ${state.newsTab === 'compose' ? 'active' : ''}" data-tab="compose">انتشار اطلاعیه</button>
            <button class="chip ${state.newsTab === 'message' ? 'active' : ''}" data-tab="message">پیام مستقیم</button>
            <button class="chip ${state.newsTab === 'inbox' ? 'active' : ''}" data-tab="inbox">رویدادهای دریافتی</button>
          </div>
        </div>
        <div id="newsBody">${loadingHTML()}</div>
      </div>`;
    box.querySelectorAll('[data-tab]').forEach((c) => c.addEventListener('click', () => {
      state.newsTab = c.dataset.tab;
      renderNews(box);
    }));

    const target = document.getElementById('newsBody');
    if (state.newsTab === 'list') await renderAnnouncementList(target);
    else if (state.newsTab === 'compose') renderCompose(target);
    else if (state.newsTab === 'message') renderDirectMessage(target);
    else await renderInbox(target);
  }

  async function renderAnnouncementList(target) {
    const d = await api('/api/announcements');
    target.innerHTML = d.announcements.length ? d.announcements.map((a) => `
      <div class="card" style="background:var(--bg-2);margin-bottom:12px">
        <div class="row between wrap" style="gap:10px">
          <div class="grow">
            <div class="bold">${a.pinned ? '📌 ' : ''}${esc(a.title)}</div>
            <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
              <span class="badge blue">${esc(a.category)}</span>
              <span class="badge dark">${J.formatJalali(a.created_at, true)}</span>
              <span class="badge ${a.read_count ? 'green' : ''}">دیده‌شده: ${fa(a.read_count)} از ${fa(a.reach)}</span>
              <span class="badge">${a.target_all ? 'همه شاگردان' : fa(a.targets.length) + ' نفر'}</span>
            </div>
          </div>
          <div class="row" style="gap:6px">
            <button class="btn sm ghost" data-ann-edit="${a.id}">ویرایش</button>
            <button class="btn sm ${a.pinned ? '' : 'gold'}" data-ann-pin="${a.id}">${a.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}</button>
            <button class="btn sm danger" data-ann-del="${a.id}">حذف</button>
          </div>
        </div>
        <div class="small muted" style="margin-top:10px;white-space:pre-line">${esc(a.body)}</div>
      </div>`).join('') : emptyHTML('اطلاعیه‌ای منتشر نشده است', '✦');

    target.querySelectorAll('[data-ann-del]').forEach((b) => b.addEventListener('click', () => {
      confirmBox('این اطلاعیه حذف شود؟', async () => {
        await api('/api/announcements/' + b.dataset.annDel, { method: 'DELETE' });
        toast('حذف شد', 'ok');
        renderNews(document.getElementById('view-news'));
      }, 'حذف اطلاعیه');
    }));
    target.querySelectorAll('[data-ann-pin]').forEach((b) => b.addEventListener('click', async () => {
      const a = d.announcements.find((x) => String(x.id) === b.dataset.annPin);
      await api('/api/announcements/' + a.id, { method: 'PUT', body: { pinned: a.pinned ? 0 : 1 } });
      toast('انجام شد', 'ok', 1500);
      renderNews(document.getElementById('view-news'));
    }));
    target.querySelectorAll('[data-ann-edit]').forEach((b) => b.addEventListener('click', () => {
      const a = d.announcements.find((x) => String(x.id) === b.dataset.annEdit);
      renderCompose(document.getElementById('newsBody'), a);
      document.querySelectorAll('[data-tab]').forEach((c) => c.classList.toggle('active', c.dataset.tab === 'compose'));
      state.newsTab = 'compose';
    }));
  }

  function renderCompose(target, existing) {
    const isEdit = !!existing;
    target.innerHTML = `
      <form id="annForm" class="col" style="gap:13px">
        <div class="grid-2">
          <div class="field"><label>عنوان *</label><input name="title" value="${esc(existing ? existing.title : '')}" required placeholder="مثلاً: آزمون ارتقای کمربند"></div>
          <div class="field"><label>دسته</label>
            <select name="category">${['عمومی', 'کلاس‌ها', 'آزمون', 'رویداد', 'تغییر برنامه', 'تبریک'].map((c) => `<option ${existing && existing.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="field"><label>متن اطلاعیه *</label>
          <textarea name="body" rows="6" required placeholder="جزئیات، زمان و مکان...">${esc(existing ? existing.body || '' : '')}</textarea>
        </div>
        <label class="check"><input type="checkbox" name="pinned" ${existing && existing.pinned ? 'checked' : ''}> سنجاق کردن در بالای پنل شاگردان</label>
        ${isEdit && existing.target_all ? '<div class="hint">این اطلاعیه برای همه شاگردان است.</div>' : memberPicker(existing ? existing.targets : [])}
        <div><button class="btn primary" type="submit">${isEdit ? 'ذخیره تغییرات' : 'انتشار اطلاعیه'}</button></div>
      </form>`;

    wireMemberPicker(target);
    target.querySelector('#annForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      new FormData(e.target).forEach((v, k) => { data[k] = v; });
      data.pinned = e.target.querySelector('[name=pinned]').checked ? 1 : 0;
      const allBox = e.target.querySelector('#pickAll');
      data.member_ids = pickedIds(e.target);
      if (allBox && allBox.checked) { data.all_members = true; data.member_ids = []; }
      try {
        if (isEdit) {
          await api('/api/announcements/' + existing.id, { method: 'PUT', body: data });
          toast('اطلاعیه ذخیره شد', 'ok');
        } else {
          const r = await api('/api/announcements', { method: 'POST', body: data });
          toast(`اطلاعیه برای ${fa(r.announcement.reach)} شاگرد منتشر شد`, 'ok');
        }
        state.newsTab = 'list';
        renderNews(document.getElementById('view-news'));
      } catch (err) { toast(err.message, 'warn', 5000); }
    });
  }

  function renderDirectMessage(target) {
    target.innerHTML = `
      <form id="msgForm" class="col" style="gap:13px">
        <div class="hint">پیام مستقیم فقط به شکل اعلان در پنل شاگرد نمایش داده می‌شود (مناسب یادآوری شخصی).</div>
        <div class="field"><label>عنوان پیام *</label><input name="title" required placeholder="مثلاً: جلسه فوق‌العاده پنجشنبه"></div>
        <div class="field"><label>متن پیام</label><textarea name="body" rows="4"></textarea></div>
        ${memberPicker([])}
        <div><button class="btn primary" type="submit">ارسال پیام</button></div>
      </form>`;
    wireMemberPicker(target);
    target.querySelector('#msgForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      new FormData(e.target).forEach((v, k) => { data[k] = v; });
      data.member_ids = pickedIds(e.target);
      const allBox = e.target.querySelector('#pickAll');
      if (allBox && allBox.checked) { data.all_members = true; data.member_ids = []; }
      try {
        const r = await api('/api/messages', { method: 'POST', body: data });
        toast(`پیام برای ${fa(r.sent)} شاگرد ارسال شد`, 'ok');
        e.target.reset();
      } catch (err) { toast(err.message, 'warn', 5000); }
    });
  }

  async function renderInbox(target) {
    const d = await api('/api/notifications');
    target.innerHTML = d.notifications.length ? d.notifications.map((n) => `
      <div class="list-item">
        <span class="badge ${n.read ? 'dark' : 'red'}">${n.read ? 'خوانده' : 'جدید'}</span>
        <div class="grow">
          <div class="title">${esc(n.title)}</div>
          ${n.body ? `<div class="tiny">${esc(n.body)}</div>` : ''}
        </div>
        <span class="tiny nowrap">${J.timeAgo(n.created_at)}</span>
      </div>`).join('') : emptyHTML('رویدادی ثبت نشده است', '🔔');
    if (d.unread) {
      await api('/api/notifications/read', { method: 'POST' });
      pollBell();
    }
  }

  /* =============================== تنظیمات =============================== */

  async function renderSettings(box) {
    box.innerHTML = `
      <div class="split">
        <div class="card">
          <div class="card-head"><div class="card-title"><span class="dot"></span> حساب مربی</div></div>
          <form id="profileForm" class="col" style="gap:12px">
            <div class="grid-2">
              <div class="field"><label>نام و نام خانوادگی</label><input name="full_name" value="${esc(ME.full_name)}"></div>
              <div class="field"><label>نام کاربری</label><input class="en" value="${esc(ME.username)}" disabled></div>
            </div>
            <div class="grid-2">
              <div class="field"><label>شماره تماس</label><input name="phone" class="en" value="${esc(ME.phone || '')}"></div>
              <div class="field"><label>درجه / کمربند</label><input name="belt" value="${esc(ME.belt || '')}"></div>
            </div>
            <div class="field"><label>درباره مربی</label><textarea name="notes" rows="3">${esc(ME.notes || '')}</textarea></div>
            <div><button class="btn primary" type="submit">ذخیره</button></div>
          </form>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--gold)"></span> تغییر رمز عبور</div></div>
            <form id="passForm" class="col" style="gap:12px">
              <div class="field"><label>رمز فعلی</label><input type="password" name="current" class="en" required></div>
              <div class="field"><label>رمز جدید</label><input type="password" name="next" class="en" required minlength="6"></div>
              <div><button class="btn gold" type="submit">تغییر رمز</button></div>
            </form>
          </div>

          <div class="card">
            <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--blue)"></span> اتصال به سایت شاگردان</div></div>
            <p class="small muted">سایت دوم (پنل شاگردان) روی همین دیتابیس اجرا می‌شود. هر شاگردی که اینجا ثبت کنید، بلافاصله در سایت دوم قابل ورود است.</p>
            <a class="btn" href="${esc(peerUrl(CFG.memberPort))}" target="_blank" rel="noopener">باز کردن سایت شاگردان ↗</a>
            <div class="tiny mt-s">آدرس: <span class="en">${esc(peerUrl(CFG.memberPort))}</span></div>
          </div>

          <div class="card">
            <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--green)"></span> درباره سامانه</div></div>
            <ul class="small muted" style="margin:0;padding-inline-start:18px">
              <li>داده‌ها در دیتابیس SQLite روی سرور ذخیره می‌شوند و با خاموش/روشن شدن سرویس از بین نمی‌روند.</li>
              <li>تاریخ‌ها به شمسی ذخیره و نمایش داده می‌شوند.</li>
              <li>هر تغییر در جدول پیشرفت، برای شاگرد اطلاع‌رسانی می‌شود.</li>
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
        const me = { user: r.user };
        ME = me.user;
        toast('اطلاعات مربی ذخیره شد', 'ok');
      } catch (err) { toast(err.message, 'warn'); }
    });

    box.querySelector('#passForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/password', {
          method: 'POST',
          body: { current: e.target.current.value, next: e.target.next.value }
        });
        toast('رمز عبور تغییر کرد', 'ok');
        e.target.reset();
      } catch (err) { toast(err.message, 'warn', 5000); }
    });
  }

  /* -------------------------------- اعلان‌ها ------------------------------- */

  async function pollBell() {
    try {
      const d = await api('/api/notifications');
      const dot = document.getElementById('bellDot');
      const cntNews = document.getElementById('cntNews');
      if (d.unread > 0) {
        dot.textContent = fa(d.unread);
        dot.classList.remove('hidden');
        cntNews.textContent = fa(d.unread);
        cntNews.classList.remove('hidden');
      } else {
        dot.classList.add('hidden');
        cntNews.classList.add('hidden');
      }
    } catch (err) { /* نادیده */ }
  }

  async function bellBox() {
    const d = await api('/api/notifications');
    modal({
      title: 'اعلان‌ها',
      body: `<div class="drawer-list">${d.notifications.length ? d.notifications.map((n) => `
        <div class="list-item">
          <span class="badge ${n.read ? 'dark' : 'red'}">${n.read ? '—' : 'جدید'}</span>
          <div class="grow"><div class="title">${esc(n.title)}</div>${n.body ? `<div class="tiny">${esc(n.body)}</div>` : ''}</div>
          <span class="tiny nowrap">${J.timeAgo(n.created_at)}</span>
        </div>`).join('') : emptyHTML('اعلانی ندارید', '🔔')}</div>`,
      actions: [{ label: 'بستن', class: 'ghost', onClick: closeModal }]
    });
    if (d.unread) {
      await api('/api/notifications/read', { method: 'POST' });
      pollBell();
    }
  }
}());
