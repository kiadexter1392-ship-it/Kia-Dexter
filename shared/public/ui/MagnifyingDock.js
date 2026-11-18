/* MagnifyingDock — adapted from Bencho's Magnifying dock (MIT).
   Source/licence: https://bencho.dev/licence
   Vanilla JS for this project's no-build panels; inline SVGs avoid a React runtime.
   Original interaction/geometry comments are retained below. */
(function (root) {
  'use strict';
  const mounted = new WeakMap();
  const ICONS = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    files: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    saved: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    you: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    progress: '<path d="M4 3v17h17M8 16v-5m5 5V7m5 9V4"/>',
    news: '<path d="m3 10 15-6v16L3 14v-4Zm3 5 2 6h3l-2-5M21 8v8"/>',
    members: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m3 10v-2a6 6 0 0 0-3-5"/>',
    settings: '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="5"/>'
  };
  /* the dock's set; the icon bar (GlassIconBar.tsx) carries the same
     five: they are the same navigation in two different materials.
     Here the panels supply their own real destinations rather than dead demo links. */
  const DEFAULT_ITEMS = [
    { key: 'home', label: 'خانه', icon: 'home' },
    { key: 'search', label: 'جستجو', icon: 'search' },
    { key: 'files', label: 'پرونده‌ها', icon: 'files' },
    { key: 'saved', label: 'ذخیره‌شده‌ها', icon: 'saved' },
    { key: 'you', label: 'پروفایل', icon: 'you' }
  ];
  const number = (value, fallback, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

  /* ══ dock, distance based magnification ═══════════════════
     Scale falls off with distance from the cursor rather than
     applying only to the hovered item, which is what stops it
     reading as a row of buttons that happen to grow. */
  function mount(container, options) {
    if (!container) return null;
    options = options || {};
    if (mounted.has(container)) mounted.get(container).destroy();
    const seen = new Set();
    const items = (options.items || DEFAULT_ITEMS).filter(item => {
      if (!item || typeof item.key !== 'string' || seen.has(item.key)) return false;
      seen.add(item.key); return true;
    });
    if (!items.length) return null;
    /* what the glyph under the cursor grows to */
    const magnify = number(options.magnify, 1.32, 1, 2);
    /* how many neighbours either side feel it. This is the knob
       that decides whether the dock reads as a row of buttons
       that happen to grow or as a sheet being pushed up from
       underneath — at 0 it is the former, and no amount of
       magnification rescues it. */
    const spread = number(options.spread, 2, 0, items.length);
    /* how far the nearest glyph rises out of the bar */
    const lift = number(options.lift, 8, 0, 24);
    const labels = options.labels !== false;
    let hover = null, active = options.active === undefined ? items[0].key : options.active;
    let down = null, chose = false, disposed = false;
    const cleanups = [];
    const bar = document.createElement('nav');
    bar.className = 'gdock';
    bar.dataset.surface = options.surface === 'flat' ? 'flat' : 'glass';
    bar.setAttribute('aria-label', options.label || 'ناوبری سریع');
    const buttons = items.map(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gdock-item';
      button.dataset.key = item.key;
      button.setAttribute('aria-label', item.label || item.key);
      const glyph = document.createElement('span');
      glyph.className = 'gdock-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + (ICONS[item.icon] || ICONS.home) + '</svg>';
      const dot = document.createElement('span');
      dot.className = 'gdock-dot'; dot.setAttribute('aria-hidden', 'true');
      button.append(glyph, dot); bar.appendChild(button); return button;
    });
    container.appendChild(bar);
    const inside = target => !!target && typeof target.nodeType === 'number' && bar.contains(target);
    const listen = (target, type, fn, capture = false) => {
      target.addEventListener(type, fn, capture);
      cleanups.push(() => target.removeEventListener(type, fn, capture));
    };

    /* ── ONE TIP THAT TRAVELS ─────────────────────────────────
       After the avatar tooltip in transitions.dev's share dialog: not a
       label per icon blinking on and off, but one pill that slides
       along to whichever icon is under the pointer and changes width to
       fit the new word as it goes, both on one short curve. It keeps the
       last word while it fades, so leaving the dock does not empty it
       mid-fade. Its place is read off the item it sits over, centre to
       centre, since a magnified dock does not lay out evenly. */
    const tip = labels ? document.createElement('span') : null;
    const word = labels ? document.createElement('span') : null;
    let last = 0, readyFrame = null;
    if (tip) {
      tip.className = 'gdock-tip'; tip.setAttribute('aria-hidden', 'true');
      tip.appendChild(word); bar.appendChild(tip);
    }
    function placeTip() {
      if (!tip || disposed) return;
      word.textContent = items[last].label || items[last].key;
      /* offsetLeft is layout, so the glyph's own scale does not skew it */
      const width = Math.ceil(word.scrollWidth) + 24;
      const rect = bar.getBoundingClientRect();
      const item = buttons[last];
      const centre = item.offsetLeft + item.offsetWidth / 2;
      // Keep Persian labels inside a narrow viewport, including the two end icons.
      const x = Math.max(8 - rect.left, Math.min(centre - width / 2, root.innerWidth - 8 - rect.left - width));
      tip.style.width = width + 'px';
      tip.style.transform = 'translateX(' + x + 'px)';
      /* the first placing must not slide in from the bar's left edge:
         until it has been placed once it moves without a transition */
      if (!tip.hasAttribute('data-ready') && readyFrame === null) {
        readyFrame = requestAnimationFrame(() => { readyFrame = null; if (!disposed) tip.dataset.ready = ''; });
      }
    }
    function paint() {
      buttons.forEach((button, i) => {
        const d = hover === null ? Infinity : Math.abs(i - hover);
        /* A raised cosine over the reach, rather than the three
           hand-picked steps this used to carry. Those could not
           be made adjustable without also picking every
           intermediate value by hand, and a curve is what the
           effect was always imitating: 1 under the cursor,
           easing to 0 at the edge of the reach, and flat zero
           past it. */
        const f = d > spread ? 0 : (1 + Math.cos((Math.PI * d) / (spread + 1))) / 2;
        /* the glyph magnifies, not the button. Scaling the
           whole item dragged the dot and the label along
           with it — the label ended up 15px further from
           the bar purely as a side effect of the zoom. */
        button.querySelector('.gdock-glyph').style.transform = 'translateY(' + (-lift * f) + 'px) scale(' + (1 + (magnify - 1) * f) + ')';
        if (d <= 1) button.dataset.near = String(d); else delete button.dataset.near;
        const selected = items[i].key === active;
        button.dataset.active = String(selected);
        button.querySelector('.gdock-dot').dataset.on = String(selected);
        if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      });
      if (tip) {
        if (hover !== null) { last = hover; placeTip(); }
        tip.dataset.on = String(hover !== null);
      }
    }
    function setActive(key) { active = key; paint(); }
    function select(i) {
      if (i === null || items[i].key === active) return;
      setActive(items[i].key);
      if (typeof options.onSelect === 'function') options.onSelect(active);
    }

    /* ── THE BAR READS THE POINTER, THE ITEMS DO NOT ─────────
       Each item used to carry its own onMouseEnter, which fails
       on a touch screen twice over. A mouse event is the smaller
       half of it — the real problem is that a touch is captured
       to whatever it started on, so sliding a finger along the
       dock keeps sending every event to the first icon you
       landed on and nothing else ever learns the finger arrived.

       One handler on the bar, and the index comes from where the
       pointer is: the nearest item centre to the pointer's x.
       Measured rather than derived from the index, because the
       items are not all the same width once one of them is
       magnified — the geometry moves as you sweep, which is
       exactly what makes a dock a dock, and an arithmetic guess
       would lag it. */
    function at(clientX) {
      let best = 0, gap = Infinity;
      buttons.forEach((button, i) => {
        const b = button.getBoundingClientRect();
        const d = Math.abs(clientX - (b.left + b.width / 2));
        if (d < gap) { gap = d; best = i; }
      });
      return best;
    }
    /* Crossing onto a glyph, not hovering one: a sound on hover
       fires on every pixel of a sweep. Quiet, floored, and
       pitched by position so running along the dock is a scale.
       This adaptation stays silent, matching the rest of the club UI. */
    const to = i => { if (hover !== i) { hover = i; paint(); } };
    function track(e) {
      /* a mouse magnifies on hover, the way it always did; a
         finger has to be down, or the bar would answer a scroll
         passing over it */
      if (e.pointerType !== 'mouse' && down !== e.pointerId) return;
      if (down !== null && down !== e.pointerId) return;
      to(at(e.clientX));
    }
    /* ── CAPTURE PHASE, and no pointer capture ───────────
       Two different things with confusingly similar names.

       The phase is capture because each item stops
       pointerdown propagating — it has to, or the wall card
       behind it treats a press on the dock as a press on the
       card. Bubbling handlers here never ran: measured, the
       magnification sat on item 0 through a full sweep.
       Capture runs top-down, before the child can stop it.

       What this does NOT do is call setPointerCapture. The
       touch is already captured to the item it began on
       whether we ask or not, and those events reach here
       with their real coordinates, which is all this needs.
       Capturing on the bar as well would retarget the click
       and take it from the item — breaking the mouse to fix
       the finger. */
    listen(bar, 'pointerdown', e => {
      if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
      down = e.pointerId;
      /* ── disarmed HERE, not by the click ────────────────
         `chose` used to be cleared by the click it was meant
         to swallow, which assumes a click always follows a
         touch. It does not: a finger that lands on one item
         and lifts over another is a drag, and a browser is
         entitled to send no click at all. Measured — the flag
         stayed armed and ate the next real mouse click, so
         the dock ignored the first thing you pressed after
         any touch sweep. Cleared at the start of the next
         gesture instead, which is true whatever the browser
         decided to do with the last one. */
      chose = false; to(at(e.clientX));
    }, true);
    listen(bar, 'pointermove', track, true);
    /* ── and the touch has to CHOOSE something ────────────
       With the bar holding the capture the button underneath
       never gets its click, so the lift is where a finger
       picks: whichever item it came to rest over. A mouse is
       untouched by this — it still clicks the button. */
    listen(bar, 'pointerup', e => {
      if (down !== e.pointerId) return;
      if (e.pointerType !== 'mouse') {
        // Even an out-of-bounds lift must swallow a synthetic click on the start icon.
        chose = true;
        const b = bar.getBoundingClientRect();
        if (e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom) {
          select(at(e.clientX));
        }
      }
      down = null;
      if (e.pointerType !== 'mouse') to(null);
    }, true);
    listen(bar, 'pointercancel', e => { if (down === e.pointerId) { down = null; to(null); } }, true);
    listen(bar, 'pointerleave', () => { if (down === null) to(null); });
    // Mouse releases outside the bar do not bubble through it; do not leave a stuck hover.
    listen(root, 'pointerup', e => {
      if (down === e.pointerId && !inside(e.target)) { down = null; to(null); }
    }, true);
    // A moving SVG can change hit-testing mid-transition without a pointerleave.
    listen(root, 'pointermove', e => {
      if (e.pointerType === 'mouse' && down === null && !inside(e.target)) to(null);
    }, true);
    listen(root, 'blur', () => { down = null; to(null); });
    buttons.forEach((button, i) => {
      listen(button, 'pointerdown', e => e.stopPropagation());
      listen(button, 'click', e => {
        /* the lift already chose — see `chose`. Keyboard/assistive clicks
           have detail=0, so a previous touch must never swallow them. */
        if (chose && e.detail !== 0) return;
        select(i);
      });
      listen(button, 'focus', () => to(i));
    });
    listen(bar, 'focusout', e => { if (!inside(e.relatedTarget)) to(null); });
    listen(bar, 'keydown', e => {
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;
      const rtl = root.getComputedStyle(bar).direction === 'rtl';
      let next;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = buttons.length - 1;
      else if (e.key === 'ArrowRight') next = (current + (rtl ? -1 : 1) + buttons.length) % buttons.length;
      else if (e.key === 'ArrowLeft') next = (current + (rtl ? 1 : -1) + buttons.length) % buttons.length;
      else return;
      e.preventDefault(); buttons[next].focus();
    });
    const observer = root.ResizeObserver ? new ResizeObserver(placeTip) : null;
    if (observer) observer.observe(bar);
    listen(root, 'resize', placeTip);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!disposed) placeTip(); });
    paint();
    const api = {
      root: bar, setActive,
      destroy() {
        if (disposed) return;
        disposed = true; cleanups.forEach(fn => fn());
        if (observer) observer.disconnect();
        if (readyFrame !== null) cancelAnimationFrame(readyFrame);
        bar.remove(); mounted.delete(container);
      }
    };
    mounted.set(container, api);
    return api;
  }
  root.MagnifyingDock = { mount };
})(window);
