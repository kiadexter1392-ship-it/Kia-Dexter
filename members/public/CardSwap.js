/* ══ Card Swap — Vanilla JS ═══════════════════════════════
   Adapted from Bencho's React CardSwap.
   A stack of photo cards in depth. Press the front card
   and it goes to the back while the rest step forward.

   Token mapping (Bencho → project):
     --fill-on   → project text color (#1a1a2e)
     --fill-slab → project card surface (rgba(255,255,255,0.9))
     --t         → inline per-card transform (set by JS)
*/

(function() {
  'use strict';

  const W = 360;
  const H = 350;
  const CW = 196;
  const CH = 246;
  const STEP_X = 34;
  const STEP_Y = 26;
  const STEP_Z = 70;

  /* Martial arts themed cards — self-contained with emoji art */
  const CARDS = [
    { id: 'karate',  title: 'کاراته',   emoji: '🥋', bg: 'linear-gradient(135deg, #d4a853, #e8c878)' },
    { id: 'crossfit',title: 'کراسفیت',  emoji: '🏋️', bg: 'linear-gradient(135deg, #e07050, #f09070)' },
    { id: 'boxing',  title: 'بوکس',     emoji: '🥊', bg: 'linear-gradient(135deg, #5080c0, #70a0e0)' },
    { id: 'gym',     title: 'ژیمناستیک',emoji: '🤸', bg: 'linear-gradient(135deg, #50b080, #70d0a0)' },
  ];

  function slot(k) {
    return 'translate3d(' + (k * STEP_X) + 'px,' + (-k * STEP_Y) + 'px,' + (-k * STEP_Z) + 'px) skewY(6deg)';
  }

  function CardSwap(container, options) {
    if (!container) return;
    options = options || {};
    var auto = options.auto || false;
    var every = Math.max(1.5, options.every || 4);

    var order = CARDS.map(function(c) { return c.id; });
    var els = {};
    var state = { hover: false, drag: null };
    var unhook = function() {};

    /* Send front card to back */
    function settle() {
      for (var id in els) {
        var el = els[id];
        if (el) { el.style.transition = ''; el.style.transform = ''; }
      }
    }

    function swap() {
      settle();
      order = order.slice(1).concat(order[0]);
      render();
    }

    /* Drag logic */
    function grab(e, id, front) {
      if (!front || state.drag || e.button !== 0) return;
      var el = e.currentTarget;
      state.drag = {
        id: id,
        real: e.isTrusted,
        pid: e.pointerId,
        x: e.clientX, y: e.clientY,
        dx: 0, dy: 0, t: performance.now()
      };
      el.style.transition = 'none';

      var rub = function(d) { return 160 * Math.tanh(d / 160); };
      var mine = function(ev) {
        return !!state.drag && ev.pointerId === state.drag.pid && ev.isTrusted === state.drag.real;
      };

      var mv = function(ev) {
        if (!mine(ev) || !state.drag) return;
        var d = state.drag;
        d.dx = ev.clientX - d.x;
        d.dy = ev.clientY - d.y;
        var x = rub(d.dx), y = rub(d.dy);
        el.style.transform = slot(0) + ' translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (x * 0.05).toFixed(2) + 'deg)';
      };

      var up = function(ev) {
        if (!mine(ev) || !state.drag) return;
        var d = state.drag;
        state.drag = null;
        unhook();
        var far = Math.hypot(d.dx, d.dy);
        var quick = far / Math.max(1, performance.now() - d.t) > 0.6;
        if (ev.type !== 'pointercancel' && (far < 6 || far > 70 || (quick && far > 24))) { swap(); return; }
        settle();
        render();
      };

      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      unhook = function() {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        unhook = function() {};
      };
    }

    /* Render cards */
    function render() {
      var stage = container.querySelector('.csw-stage');
      if (!stage) return;
      stage.innerHTML = '';

      CARDS.forEach(function(c) {
        var k = order.indexOf(c.id);
        var front = k === 0;
        var el = document.createElement('div');
        el.className = 'csw-card';
        if (front) el.setAttribute('data-front', '');
        el.style.zIndex = CARDS.length - k;
        el.style.setProperty('--t', slot(k));

        /* Photo area — colored gradient with emoji */
        var photo = document.createElement('div');
        photo.className = 'csw-photo';
        photo.style.background = c.bg;
        photo.style.display = 'flex';
        photo.style.alignItems = 'center';
        photo.style.justifyContent = 'center';
        photo.style.fontSize = '64px';
        photo.textContent = c.emoji;

        /* Title tag */
        var tag = document.createElement('div');
        tag.className = 'csw-tag';
        tag.textContent = c.title;

        el.appendChild(photo);
        el.appendChild(tag);

        el.addEventListener('pointerdown', function(e) { grab(e, c.id, front); });
        els[c.id] = el;
        stage.appendChild(el);
      });
    }

    /* Build DOM */
    var root = document.createElement('div');
    root.className = 'csw';
    root.style.width = W + 'px';
    root.style.height = H + 'px';

    var stage = document.createElement('div');
    stage.className = 'csw-stage';
    stage.style.width = CW + 'px';
    stage.style.height = CH + 'px';

    root.appendChild(stage);
    container.appendChild(root);

    root.addEventListener('pointerenter', function() { state.hover = true; });
    root.addEventListener('pointerleave', function() { state.hover = false; });

    render();

    /* Auto-swap timer */
    if (auto) {
      setInterval(function() {
        if (!state.hover && !state.drag && !document.hidden) swap();
      }, every * 1000);
    }
  }

  /* Expose */
  window.CardSwap = {
    mount: function(container, options) {
      CardSwap(container, options);
    }
  };
})();
