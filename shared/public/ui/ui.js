/* ابزارهای مشترک رابط کاربری دو سایت */
(function (root) {
  'use strict';

  const fa = (v) => root.Jalali.faNum(v);
  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ----------------------------- درخواست HTTP ---------------------------- */

  async function api(path, options = {}) {
    const opts = { method: options.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (options.body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(options.body);
    }
    const res = await fetch(path, opts);
    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || `خطای سرور (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* -------------------------------- توست --------------------------------- */

  function toast(message, kind = 'info', ms = 3600) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : '');
    t.textContent = message;
    box.appendChild(t);
    setTimeout(() => {
      t.style.transition = '0.25s';
      t.style.opacity = '0';
      t.style.transform = 'translateX(-12px)';
      setTimeout(() => t.remove(), 260);
    }, ms);
  }

  /* -------------------------------- مودال -------------------------------- */

  function modal({ title, body, actions = [], wide = false, onMount }) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="row between" style="margin-bottom:12px">
          <h3>${esc(title || '')}</h3>
          <button class="btn icon ghost" data-close aria-label="بستن">✕</button>
        </div>
        <div class="modal-body">${body || ''}</div>
        <div class="modal-actions"></div>
      </div>`;
    const actionsBox = overlay.querySelector('.modal-actions');
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.class || '');
      b.textContent = a.label;
      b.onclick = () => a.onClick && a.onClick(overlay);
      actionsBox.appendChild(b);
    });
    if (!actions.length) actionsBox.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    overlay.querySelector('[data-close]').onclick = closeModal;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    if (onMount) onMount(overlay);
    return overlay;
  }

  function closeModal() {
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    document.body.style.overflow = '';
  }

  function confirmBox(message, onYes, yesLabel = 'تأیید') {
    modal({
      title: 'تأیید عملیات',
      body: `<p class="muted">${esc(message)}</p>`,
      actions: [
        { label: 'انصراف', class: 'ghost', onClick: closeModal },
        { label: yesLabel, class: 'danger', onClick: () => { closeModal(); onYes(); } }
      ]
    });
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ------------------------------- نمایش داده ----------------------------- */

  function heatClass(score) {
    if (score === null || score === undefined || score === '') return 'h0';
    const v = Number(score);
    if (!Number.isFinite(v)) return 'h0';
    if (v < 40) return 'h1';
    if (v < 60) return 'h2';
    if (v < 80) return 'h3';
    return 'h4';
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts.length > 1 ? parts[0].slice(0, 1) + parts[1].slice(0, 1) : String(name || '?').slice(0, 2);
  }

  function avatar(user, size = '') {
    const c = (user && user.avatar_color) || '#e2483d';
    return `<span class="avatar ${size}" style="--c:${esc(c)}">${esc(initials(user && user.full_name))}</span>`;
  }

  const STATUS = {
    todo: { label: 'انجام نشده', cls: 'red' },
    doing: { label: 'در حال انجام', cls: 'gold' },
    done: { label: 'تکمیل شده', cls: 'green' }
  };

  const METRICS = [
    { key: 'sessions', label: 'جلسات تمرین', unit: 'جلسه', max: 31, score: false },
    { key: 'endurance', label: 'استقامت', unit: '٪', max: 100, score: true },
    { key: 'strength', label: 'قدرت', unit: '٪', max: 100, score: true },
    { key: 'technique', label: 'تکنیک', unit: '٪', max: 100, score: true },
    { key: 'flexibility', label: 'انعطاف', unit: '٪', max: 100, score: true },
    { key: 'discipline', label: 'انضباط', unit: '٪', max: 100, score: true },
    { key: 'weight_kg', label: 'وزن', unit: 'کیلوگرم', max: 200, score: false },
    { key: 'overall', label: 'نمره کل', unit: '٪', max: 100, score: true }
  ];

  /* --------------------------- آدرس سایت دیگر ---------------------------- */
  /* در محیط پیش‌نمایش، نام میزبان با شماره پورت شروع می‌شود: 4174-xxxx.e2b.app */
  function peerUrl(port) {
    const host = root.location.hostname;
    const match = host.match(/^(\d+)-(.+)$/);
    if (match) return `${root.location.protocol}//${port}-${match[2]}`;
    return `${root.location.protocol}//${host}:${port}`;
  }

  async function loadConfig() {
    const cfg = await api('/api/config');
    root.CLUB = cfg;
    return cfg;
  }

  function nl2br(text) {
    return esc(text).replace(/\n/g, '<br>');
  }

  root.UI = {
    fa, esc, api, toast, modal, closeModal, confirmBox,
    heatClass, initials, avatar, STATUS, METRICS, peerUrl, loadConfig, nl2br
  };
}(window));
