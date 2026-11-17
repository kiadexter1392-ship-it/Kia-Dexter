/* ══ One-Time Code — Vanilla JS ════════════════════════════
   Adapted from Bencho's React Otp component.
   Six cells, caret, merge capsule with goo filter.

   Token mapping (Bencho → project):
     --card      → rgba(212,168,83,0.18) (amber glass)
     --fill-on   → #1a1a2e (dark text)
     --fill-slab → rgba(255,255,255,0.85) (cell surface)
     --font-ui   → 'Vazirmatn', Tahoma, sans-serif
     --ink       → #1a1a2e (same as fill-on)

   No React, no framer-motion, no lucide-react.
   Spring physics + SVG goo filter in vanilla JS.
*/

(function() {
  'use strict';

  const W = 40;
  const H = 50;
  const G = 8;
  const CAP = 160;
  const POP_MS = 260;
  const SHAKE_MS = 620;

  const MERGE_K = 0.075;
  const MERGE_D = 1 - 2 * 0.42 * Math.sqrt(MERGE_K);

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) {
    var u = clamp((v - a) / (b - a), 0, 1);
    return u * u * (3 - 2 * u);
  }

  function OneTimeCode(container, options) {
    if (!container) return;
    options = options || {};
    var length = options.length || 6;
    var answer = options.answer || 'Accept';
    var onVerify = options.onVerify || function() {};

    var code = '';
    var phase = 'type'; /* type | check | ok | no */
    var focus = false;

    var caret = { x: W / 2, v: 0 };
    var popAt = [];
    var mergeState = { m: 0, v: 0, to: 0 };
    var shookAt = 0;
    var rafId = 0;
    var timers = [];

    /* Build goo filter SVG */
    var gooId = 'otp-goo-' + Math.random().toString(36).slice(2, 8);
    var svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgDefs.setAttribute('class', 'liq-defs');
    svgDefs.setAttribute('aria-hidden', 'true');
    svgDefs.innerHTML =
      '<defs><filter id="' + gooId + '" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="3" result="smear"/>' +
      '<feColorMatrix in="smear" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -12"/>' +
      '</filter></defs>';

    /* Root */
    var root = document.createElement('div');
    root.className = 'otp';
    root.appendChild(svgDefs);

    var rowW = length * W + (length - 1) * G;

    /* Row */
    var row = document.createElement('div');
    row.className = 'otp-row';
    row.style.width = rowW + 'px';
    row.style.height = H + 'px';

    /* Goo layer (cells + capsule) */
    var gooLayer = document.createElement('div');
    gooLayer.className = 'otp-goo';
    row.appendChild(gooLayer);

    /* Slots (digits) */
    var slots = [];
    for (var i = 0; i < length; i++) {
      var slot = document.createElement('span');
      slot.className = 'otp-slot';
      slot.style.width = W + 'px';
      slots.push(slot);
      row.appendChild(slot);
    }

    /* Caret */
    var caretEl = document.createElement('i');
    caretEl.className = 'otp-caret';
    row.appendChild(caretEl);

    /* OK label */
    var okEl = document.createElement('span');
    okEl.className = 'otp-ok';
    /* Inline checkmark SVG (replaces lucide Check) */
    okEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> تأیید شد';
    row.appendChild(okEl);

    /* Hidden input */
    var input = document.createElement('input');
    input.className = 'otp-field';
    input.type = 'text';
    input.inputMode = 'numeric';
    input.setAttribute('autocomplete', 'one-time-code');
    input.setAttribute('data-1p-ignore', '');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('maxlength', length);
    input.setAttribute('aria-label', length + '-digit code');
    input.spellcheck = false;
    row.appendChild(input);

    root.appendChild(row);
    container.appendChild(root);

    /* Animation loop */
    var tickCount = 0;
    function wake() {
      if (rafId) return;
      var prev = 0;
      function tick(t) {
        var dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
        prev = t;
        var busy = false;

        /* Caret spring */
        var target = Math.min(code.length, length - 1) * (W + G) + W / 2;
        caret.v += (target - caret.x) * 0.2 * dt;
        caret.v *= Math.pow(0.62, dt);
        caret.x += caret.v * dt;
        if (Math.abs(target - caret.x) < 0.05 && Math.abs(caret.v) < 0.05) {
          caret.x = target; caret.v = 0;
        } else { busy = true; }

        /* Merge spring */
        var mg = mergeState;
        if (mg.m !== mg.to || mg.v !== 0) {
          mg.v += (mg.to - mg.m) * MERGE_K * dt;
          mg.v *= Math.pow(MERGE_D, dt);
          mg.m += mg.v * dt;
          if (Math.abs(mg.to - mg.m) < 0.0008 && Math.abs(mg.v) < 0.0008) {
            mg.m = mg.to; mg.v = 0;
          } else { busy = true; }
        }

        /* Shake timing */
        if (performance.now() - shookAt < SHAKE_MS + 200) busy = true;

        /* Pop timing */
        for (var pi = 0; pi < popAt.length; pi++) {
          if (popAt[pi] !== undefined && performance.now() - popAt[pi] < POP_MS) { busy = true; break; }
        }

        tickCount++;
        render();
        rafId = busy ? requestAnimationFrame(tick) : 0;
      }
      rafId = requestAnimationFrame(tick);
    }

    function fuse(to) {
      mergeState = { m: mergeState.m, v: mergeState.v, to: to };
      wake();
    }

    function render() {
      var now = performance.now();
      var raw = mergeState.m;
      var m = clamp(raw, 0, 1);
      var mid = (rowW - W) / 2;
      var since = now - shookAt;
      var shaking = phase === 'no' && since < SHAKE_MS;

      /* Cell positions */
      var cells = gooLayer.querySelectorAll('.otp-cell');
      for (var i = 0; i < length; i++) {
        var home = i * (W + G);
        var shake = shaking ? 5 * Math.exp(-since / 190) * Math.sin((since / 1000) * Math.PI * 2 * 10 + i * 0.55) : 0;
        var x = mix(home, mid, m) + shake;

        /* Pop scale */
        var at = popAt[i];
        var popScale = 1;
        if (at !== undefined) {
          var u = (now - at) / POP_MS;
          if (u > 0 && u < 1) popScale = 1 + 0.04 * Math.sin(Math.PI * u);
        }

        /* Breath during check */
        var breathScale = popScale;
        if (phase === 'check') {
          var bu = ((now % 900) / 900) * (length + 2) - i;
          if (bu > 0 && bu < 2) breathScale *= 1 - 0.07 * Math.sin((bu / 2) * Math.PI);
        }

        var cellR = mix(10, H / 2, smooth(0.15, 0.7, m));

        if (cells[i]) {
          cells[i].style.transform = 'translateX(' + x.toFixed(2) + 'px) scale(' + breathScale.toFixed(3) + ')';
          cells[i].style.borderRadius = cellR + 'px';
        }
      }

      /* Capsule */
      var capsule = gooLayer.querySelector('.otp-capsule');
      var over = raw - 1;
      var capW = CAP * smooth(0.3, 1, m) * (1 + Math.max(-0.12, over) * 0.9);
      var capSy = 1 - Math.max(-0.12, over) * 0.55;
      if (capsule && capW > 0.5) {
        capsule.style.display = '';
        capsule.style.width = capW.toFixed(1) + 'px';
        capsule.style.transform = 'translateX(' + ((rowW - capW) / 2).toFixed(2) + 'px) scaleY(' + capSy.toFixed(3) + ')';
      } else if (capsule) {
        capsule.style.display = 'none';
      }

      /* Digits */
      for (var i = 0; i < length; i++) {
        var d = code[i];
        var home = i * (W + G);
        var shake = shaking ? 5 * Math.exp(-since / 190) * Math.sin((since / 1000) * Math.PI * 2 * 10 + i * 0.55) : 0;
        var x = mix(home, mid, m) + shake;

        slots[i].style.transform = 'translateX(' + x.toFixed(2) + 'px)';
        slots[i].style.opacity = 1 - smooth(0, 0.45, m);

        if (d) {
          var out = phase === 'no' ? smooth(0, 1, (since - 300 - (length - 1 - i) * 45) / 220) : 0;
          slots[i].innerHTML = '<span class="otp-digit" style="translate:0 ' + (out * 8).toFixed(2) + 'px;opacity:' + (1 - out) + '">' + d + '</span>';
        } else {
          slots[i].innerHTML = '';
        }
      }

      /* Caret */
      var typing = phase === 'type' && focus;
      caretEl.setAttribute('data-on', typing && code.length < length && m < 0.08 ? 'true' : '');
      caretEl.style.transform = 'translateX(' + (caret.x - 1).toFixed(2) + 'px) scaleX(' + (1 + Math.min(5, Math.abs(caret.v) * 0.9)).toFixed(3) + ')';

      /* OK label */
      okEl.style.opacity = smooth(0.72, 1, m);
      okEl.style.transform = 'scale(' + mix(0.92, 1, smooth(0.72, 1, m)) + ')';

      /* Phase attribute */
      root.setAttribute('data-phase', phase);

      /* Goo filter */
      gooLayer.style.filter = 'url(#' + gooId + ')';
    }

    /* Build cell elements */
    function buildCells() {
      gooLayer.innerHTML = '';
      for (var i = 0; i < length; i++) {
        var cell = document.createElement('span');
        cell.className = 'otp-cell';
        cell.style.width = W + 'px';
        cell.style.borderRadius = '10px';
        gooLayer.appendChild(cell);
      }
      var capsule = document.createElement('span');
      capsule.className = 'otp-cell otp-capsule';
      capsule.style.borderRadius = (H / 2) + 'px';
      capsule.style.display = 'none';
      gooLayer.appendChild(capsule);
    }
    buildCells();

    /* Input handling */
    input.addEventListener('input', function(e) {
      if (phase !== 'type') return;
      var next = e.target.value.replace(/\D/g, '').slice(0, length);

      /* Pop animation for new digits */
      if (next.length > code.length) {
        var t0 = performance.now();
        for (var i = code.length; i < next.length; i++) {
          popAt[i] = t0 + (i - code.length) * 45;
        }
        wake();
      }

      code = next;
      if (code.length < length) return;

      /* Full code entered */
      phase = 'check';
      wake();

      setTimeout(function() {
        if (answer !== 'Reject') {
          phase = 'ok';
          fuse(1);
          input.blur();
          if (onVerify) onVerify(code);
        } else {
          phase = 'no';
          shookAt = performance.now();
          wake();
          setTimeout(function() {
            code = '';
            phase = 'type';
            input.value = '';
            buildCells();
          }, SHAKE_MS + length * 45 + 160);
        }
      }, 420);
    });

    input.addEventListener('focus', function() { focus = true; wake(); });
    input.addEventListener('blur', function() { focus = false; });

    /* Click capsule to reopen */
    okEl.addEventListener('click', function() {
      if (phase !== 'ok') return;
      code = '';
      phase = 'type';
      fuse(0);
      input.value = '';
      buildCells();
      input.focus();
    });

    /* Click anywhere on row to focus input */
    row.addEventListener('click', function(e) {
      if (phase === 'ok') return;
      input.focus();
    });

    /* Initial render */
    render();

    return {
      reset: function() {
        code = '';
        phase = 'type';
        mergeState = { m: 0, v: 0, to: 0 };
        input.value = '';
        buildCells();
        render();
      },
      focus: function() { input.focus(); }
    };
  }

  window.OneTimeCode = {
    mount: function(container, options) {
      return OneTimeCode(container, options);
    }
  };
})();
