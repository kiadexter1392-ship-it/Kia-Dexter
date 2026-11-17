/* ══ Toast Stack — Vanilla JS ══════════════════════════════
   Adapted from Bencho's React ToastStack.
   Three toasts stacked, fanning into list on hover.

   Token mapping (Bencho → project):
     --fill-on   → #1a1a2e (dark text)
     --fill-slab → rgba(255,255,255,0.85) (surface)
     --font-ui   → 'Vazirmatn', Tahoma, sans-serif
     --ink       → #1a1a2e
     --pane-edge → rgba(212,168,83,0.2) (gold border)
     --signal    → #d4a853 (gold focus)
     --tst-r     → set by JS

   No React, no framer-motion, no lucide-react.
   CSS transitions replace spring animations.
*/

(function() {
  'use strict';

  const W = 300;
  const H = 64;
  const SHOWN = 3;
  const DEFAULT_PEEK = 14;
  const DEFAULT_GAP = 10;
  const DEFAULT_CORNER = 16;

  /* Inline SVG icons (replacing lucide-react) */
  const ICONS = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  // No examples or synthetic notifications. The caller must supply actual events.
  function ToastStack(container, options) {
    if (!container) return;
    options = options || {};
    var peek = options.peek || DEFAULT_PEEK;
    var gap = options.gap || DEFAULT_GAP;
    var corner = options.corner || DEFAULT_CORNER;

    var stack = [];
    var nextId = SHOWN;
    var open = false;
    var leavingId = null;

    (options.items || []).slice(0, SHOWN + 2).forEach(function(item) {
      stack.push(Object.assign({}, item, { id: nextId++ }));
    });
    /* Frame height = open list height */
    var listH = SHOWN * H + (SHOWN - 1) * gap;
    var stackH = H + (SHOWN - 1) * peek;
    var FH = listH;

    /* Build DOM */
    var root = document.createElement('div');
    root.className = 'tst';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'اعلان‌ها');
    root.style.width = W + 'px';
    root.style.height = FH + 'px';
    root.hidden = stack.length === 0;
    root.style.setProperty('--tst-r', corner + 'px');

    container.appendChild(root);

    function place(k) {
      if (open) {
        var top = (FH - listH) / 2;
        return { y: top + (SHOWN - 1 - k) * (H + gap), scale: 1 };
      }
      var top = (FH - stackH) / 2;
      var d = Math.min(k, SHOWN - 1);
      return { y: top + (SHOWN - 1 - d) * peek, scale: 1 - d * 0.05 };
    }

    function render() {
      root.hidden = stack.length === 0;
      root.setAttribute('data-open', open ? '' : null);

      /* Remove old toasts */
      var old = root.querySelectorAll('.tst-toast');
      old.forEach(function(el) { el.remove(); });

      stack.forEach(function(t, k) {
        var p = place(k);
        var front = k === 0;
        var isLeaving = leavingId === t.id;

        var el = document.createElement('div');
        el.className = 'tst-toast';
        el.setAttribute('data-kind', t.kind);
        if (front) el.setAttribute('data-front', '');
        el.style.height = H + 'px';
        el.style.zIndex = SHOWN - k;

        /* Position */
        if (isLeaving) {
          el.style.transform = 'translateY(' + p.y + 'px) translateX(60px) scale(' + p.scale + ')';
          el.style.opacity = '0';
        } else {
          el.style.transform = 'translateY(' + p.y + 'px) scale(' + p.scale + ')';
          el.style.opacity = '1';
        }
        el.style.transformOrigin = '50% 0';
        el.style.transition = 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease';

        /* Icon */
        var icon = document.createElement('span');
        icon.className = 'tst-icon';
        icon.innerHTML = ICONS[t.kind] || ICONS.info;

        /* Text */
        var text = document.createElement('span');
        text.className = 'tst-text';
        text.innerHTML = '<b>' + escHtml(t.title) + '</b><span>' + escHtml(t.body) + '</span>';

        el.appendChild(icon);
        el.appendChild(text);

        /* Action button (for error toasts with retry) */
        if (t.action) {
          var act = document.createElement('button');
          act.type = 'button';
          act.className = 'tst-act';
          act.textContent = t.action;
          act.addEventListener('click', function() {
            // Success must come from an actual operation, never from changing a toast.
            if (typeof t.onAction === 'function') t.onAction();
          });
          el.appendChild(act);
        }

        /* Dismiss button */
        var xBtn = document.createElement('button');
        xBtn.type = 'button';
        xBtn.className = 'tst-x';
        xBtn.setAttribute('aria-label', 'بستن ' + t.title);
        xBtn.innerHTML = ICONS.x;
        xBtn.addEventListener('click', function() { dismiss(t.id); });
        el.appendChild(xBtn);

        root.appendChild(el);
      });
    }

    function dismiss(id) {
      if (leavingId !== null) return;
      leavingId = id;
      render();

      setTimeout(function() {
        stack = stack.filter(function(t) { return t.id !== id; });
        leavingId = null;
        render();
      }, 220);
    }

    /* Hover: open/close */
    root.addEventListener('pointerover', function() {
      open = true;
      render();
    });
    root.addEventListener('pointerout', function(e) {
      var to = e.relatedTarget;
      if (!to || !root.contains(to)) {
        open = false;
        render();
      }
    });
    root.addEventListener('focus', function() { open = true; render(); });
    root.addEventListener('blur', function(e) {
      if (!root.contains(e.relatedTarget)) { open = false; render(); }
    });

    /* Public API */
    return {
      add: function(toast) {
        var n = nextId++;
        stack.unshift(Object.assign({}, toast, { id: n }));
        if (stack.length > SHOWN + 2) stack.length = SHOWN + 2;
        render();
      },
      reset: function() { stack = []; render(); },
      root: root
    };
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.ToastStack = {
    mount: function(container, options) {
      return ToastStack(container, options);
    }
  };
})();
