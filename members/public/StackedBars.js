/* ══ Stacked Bars — Vanilla JS ═══════════════════════════
   Adapted from Bencho's React StackedBars.
   An alert-volume card: stacked bars per day/week with
   tooltip, ring highlight, and spring animations.

   Token mapping (Bencho → project):
     --fill-on    → #1a1a2e (project text)
     --fill-slab  → rgba(255,255,255,0.9) (card surface)
     --font-ui    → 'Vazirmatn', Tahoma, sans-serif
     --pane-edge  → rgba(212,168,83,0.2) (gold border)
     --c          → inline per-bar color
     --i          → inline column index (stagger)
     --stb-r      → border-radius (set by JS)
     --stb-rr     → ring radius (set by JS)

   framer-motion replaced with CSS transitions + JS springs.
*/

(function() {
  'use strict';

  const W = 300;
  const PAD = 16;
  const CW = W - PAD * 2;
  const CH = 104;
  const BH = 22;
  const SEG_GAP = 2;
  const LIFT = 2;
  const TIP_W = 140;

  /* Jalali months */
  const MONTHS = ['فرو','ارد','خرد','تیر','مرد','شهر','مهر','آبا','آذر','دی','بهم','اسف'];

  /* Categories — martial arts metrics */
  const CATS = ['استقامت', 'قدرت', 'تکنیک', 'انعطاف'];

  /* Seeded random for consistent data */
  function mulberry(seed) {
    var a = seed >>> 0;
    return function() {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const fmt = function(v) { return Math.round(v).toLocaleString('fa-IR'); };
  const sum = function(a) { return a.reduce(function(s, v) { return s + v; }, 0); };

  function makeBars(mode, n) {
    var rnd = mulberry(mode === 'Day' ? 4396 : 9117);
    var base = [40, 30, 25, 20]; /* scores out of 100 */
    var out = [];
    var totalDays = 30;
    for (var i = 0; i < totalDays; i++) {
      var back = totalDays - 1 - i;
      if (mode === 'Day') {
        /* Use a fixed date range in Jalali */
        var dayNum = 1 + back;
        var monthIdx = 7; /* Aban */
        var wd = (dayNum + 2) % 7; /* rough weekday */
        var quiet = (wd === 5 || wd === 6) ? 0.6 : 1;
        var surge = rnd() < 0.12 ? 1.4 : 1;
        var vals = base.map(function(b, k) {
          return Math.round(b * quiet * (0.5 + rnd() * 0.9) * (k === 0 ? surge : 1));
        });
        var esc = Math.round(2 + rnd() * 8 * quiet * surge);
        var label = dayNum + ' ' + MONTHS[monthIdx];
        out.push({ vals: vals, esc: esc, label: label, short: label });
      } else {
        var weekNum = totalDays - back;
        var vals = base.map(function(b) { return Math.round(b * 4.5 * (0.7 + rnd() * 0.6)); });
        var esc = Math.round(20 + rnd() * 35);
        out.push({ vals: vals, esc: esc, label: 'هفته ' + weekNum, short: 'ه' + weekNum });
      }
    }
    return out.slice(totalDays - n);
  }

  /* Spring animation helper — replaces framer-motion animate() */
  function springTo(el, prop, target, duration) {
    duration = duration || 500;
    var start = parseFloat(el.style[prop] || 0);
    var diff = target - start;
    if (Math.abs(diff) < 0.5) { el.style[prop] = target + 'px'; return; }
    var startTime = performance.now();
    function tick(now) {
      var t = Math.min(1, (now - startTime) / duration);
      /* cubic-bezier(0.22, 1, 0.36, 1) approximation */
      var ease = 1 - Math.pow(1 - t, 3);
      el.style[prop] = (start + diff * ease) + 'px';
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function StackedBars(container, options) {
    if (!container) return;
    options = options || {};
    var barCount = Math.max(2, Math.round(options.bars || 20));
    var colourMode = options.colour || 'Colour';

    var mode = 'Day';
    var at = null;
    var seen = false;

    /* Build DOM */
    var root = document.createElement('div');
    root.className = 'stb';
    root.setAttribute('data-colour', colourMode === 'Colour' ? 'on' : 'off');
    root.style.width = W + 'px';

    /* Header */
    var head = document.createElement('div');
    head.className = 'stb-head';

    var titles = document.createElement('div');
    titles.className = 'stb-titles';
    var titleEl = document.createElement('div');
    titleEl.className = 'stb-title';
    titleEl.textContent = 'پیشرفت ماهانه';
    var subEl = document.createElement('div');
    subEl.className = 'stb-sub';
    titles.appendChild(titleEl);
    titles.appendChild(subEl);

    var segCtl = document.createElement('div');
    segCtl.className = 'stb-seg-ctl';
    segCtl.setAttribute('data-mode', mode);
    segCtl.setAttribute('role', 'tablist');

    var thumb = document.createElement('span');
    thumb.className = 'stb-thumb';
    thumb.setAttribute('aria-hidden', 'true');

    var tabDay = document.createElement('button');
    tabDay.className = 'stb-tab';
    tabDay.setAttribute('data-on', '');
    tabDay.setAttribute('role', 'tab');
    tabDay.textContent = 'روز';
    var tabWeek = document.createElement('button');
    tabWeek.className = 'stb-tab';
    tabWeek.setAttribute('role', 'tab');
    tabWeek.textContent = 'هفته';

    segCtl.appendChild(thumb);
    segCtl.appendChild(tabDay);
    segCtl.appendChild(tabWeek);

    head.appendChild(titles);
    head.appendChild(segCtl);
    root.appendChild(head);

    /* Figure (total number) */
    var figure = document.createElement('div');
    figure.className = 'stb-figure';
    var numEl = document.createElement('span');
    numEl.className = 'stb-num';
    var unitEl = document.createElement('span');
    unitEl.className = 'stb-unit';
    unitEl.textContent = 'مجموع';
    figure.appendChild(numEl);
    figure.appendChild(unitEl);
    root.appendChild(figure);

    /* Plot area */
    var plot = document.createElement('div');
    plot.className = 'stb-plot';
    plot.style.height = (CH + 1 + BH) + 'px';

    var baseLine = document.createElement('span');
    baseLine.className = 'stb-base';
    baseLine.style.top = CH + 'px';
    plot.appendChild(baseLine);

    /* Ring (highlight) */
    var ring = document.createElement('span');
    ring.className = 'stb-ring';
    ring.setAttribute('aria-hidden', 'true');
    plot.appendChild(ring);

    /* Tooltip */
    var tip = document.createElement('div');
    tip.className = 'stb-tip';
    tip.setAttribute('aria-hidden', 'true');
    plot.appendChild(tip);

    root.appendChild(plot);

    /* Axis */
    var axis = document.createElement('div');
    axis.className = 'stb-axis';
    var axisFirst = document.createElement('span');
    var axisLast = document.createElement('span');
    axis.appendChild(axisFirst);
    axis.appendChild(axisLast);
    root.appendChild(axis);

    container.appendChild(root);

    /* Data & render */
    var data = [];
    var layout = [];
    var cols = [];

    function render() {
      data = makeBars(mode, barCount);

      /* Geometry */
      var g = Math.max(1, Math.min(6, (CW - 3 * barCount) / (barCount - 1)));
      var bw = (CW - g * (barCount - 1)) / barCount;
      var r = Math.min(2.5, bw / 2);

      root.style.setProperty('--stb-r', r + 'px');
      root.style.setProperty('--stb-rr', (r + 3) + 'px');

      /* Update header */
      subEl.textContent = barCount + ' ' + (mode === 'Day' ? 'روز اخیر' : 'هفته اخیر');
      segCtl.setAttribute('data-mode', mode);
      tabDay.setAttribute('data-on', mode === 'Day' ? '' : null);
      tabWeek.setAttribute('data-on', mode === 'Week' ? '' : null);

      /* Compute totals & scale */
      var totals = data.map(function(b) { return sum(b.vals); });
      var maxT = Math.max.apply(null, totals);
      var maxE = Math.max.apply(null, data.map(function(b) { return b.esc; }));
      var scale = (CH - LIFT - 2 - SEG_GAP * 3) / maxT;

      /* Update total number with pop animation */
      var total = sum(totals);
      numEl.innerHTML = '';
      var totalStr = fmt(total);
      for (var ci = 0; ci < totalStr.length; ci++) {
        var d = document.createElement('span');
        d.className = 'stb-digit';
        d.setAttribute('data-pop', '');
        d.style.setProperty('--i', ci);
        d.textContent = totalStr[ci];
        numEl.appendChild(d);
      }

      /* Clear existing columns */
      cols.forEach(function(c) { if (c.parentNode) c.parentNode.removeChild(c); });
      cols = [];
      layout = [];

      /* Build columns */
      for (var i = 0; i < data.length; i++) {
        var col = document.createElement('div');
        col.className = 'stb-col';
        col.style.left = (i * (bw + g)) + 'px';
        col.style.width = bw + 'px';
        col.style.setProperty('--i', i);

        var b = data[i];
        var y = 0;
        var segs = [];

        for (var k = 0; k < b.vals.length; k++) {
          var h = Math.max(2, b.vals[k] * scale);
          segs.push({ bottom: y, h: h });

          var bar = document.createElement('span');
          bar.className = 'stb-bar';
          bar.style.setProperty('--c', 'var(--stb-c' + (k + 1) + ')');
          bar.style.bottom = (BH + 1 + LIFT) + 'px';
          bar.style.height = '0px';
          bar.style.setProperty('--i', i);
          col.appendChild(bar);

          y += h + SEG_GAP;
        }

        var esc = document.createElement('span');
        esc.className = 'stb-esc';
        esc.style.top = (CH + 1 + LIFT) + 'px';
        esc.style.height = '0px';
        col.appendChild(esc);

        layout.push({
          segs: segs,
          top: y - SEG_GAP,
          esc: Math.max(3, (b.esc / maxE) * (BH - LIFT - 2))
        });

        plot.appendChild(col);
        cols.push(col);
      }

      /* Axis labels */
      axisFirst.textContent = data[0].short;
      axisLast.textContent = data[data.length - 1].short;

      /* Animate bars in */
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          for (var i = 0; i < data.length; i++) {
            var col = cols[i];
            var bars = col.querySelectorAll('.stb-bar');
            var escEl = col.querySelector('.stb-esc');
            for (var k = 0; k < bars.length; k++) {
              bars[k].style.bottom = (BH + 1 + LIFT + layout[i].segs[k].bottom) + 'px';
              bars[k].style.height = layout[i].segs[k].h + 'px';
            }
            if (escEl) escEl.style.height = layout[i].esc + 'px';
          }
        });
      });
    }

    /* Pointer interaction */
    function pick(e) {
      var b = plot.getBoundingClientRect();
      if (!b || b.width === 0) return;
      var i = Math.floor(((e.clientX - b.left) / b.width) * barCount);
      setAt(Math.max(0, Math.min(barCount - 1, i)));
    }

    function setAt(idx) {
      if (at === idx) return;
      at = idx;

      /* Update scrub state */
      if (idx !== null) {
        root.setAttribute('data-scrub', '');
        cols.forEach(function(c, i) {
          c.setAttribute('data-on', i === idx ? '' : null);
        });

        /* Position ring */
        var L = layout[idx];
        var left = idx * ((CW - Math.max(1, Math.min(6, (CW - 3 * barCount) / (barCount - 1))) * (barCount - 1)) / barCount + Math.max(1, Math.min(6, (CW - 3 * barCount) / (barCount - 1))));
        var g = Math.max(1, Math.min(6, (CW - 3 * barCount) / (barCount - 1)));
        var bw = (CW - g * (barCount - 1)) / barCount;
        left = idx * (bw + g);
        var x = left - 3;
        var up = L.top;
        var down = L.esc;
        var y = CH - LIFT - up - 3;
        var h = up + LIFT + 1 + LIFT + down + 6;

        ring.style.width = (bw + 6) + 'px';
        springTo(ring, 'left', x, 400);
        springTo(ring, 'top', y, 400);
        ring.style.height = h + 'px';

        /* Position tooltip */
        var right = left + bw + 8;
        var tx;
        if (right + TIP_W <= CW || left - 8 - TIP_W < 0) {
          tx = Math.min(CW - TIP_W, right);
        } else {
          tx = left - 8 - TIP_W;
        }
        springTo(tip, 'left', tx, 400);

        /* Fill tooltip */
        var cur = data[idx];
        var top2 = cur.vals.map(function(v, k) { return { v: v, k: k }; })
          .sort(function(a, b) { return b.v - a.v; }).slice(0, 2);

        tip.innerHTML =
          '<div class="stb-tip-head"><span>' + cur.label + '</span><b>' + fmt(sum(cur.vals)) + '</b></div>' +
          top2.map(function(item) {
            return '<div class="stb-tip-row"><i style="--c:var(--stb-c' + (item.k + 1) + ')"></i><span>' + CATS[item.k] + '</span><b>' + fmt(item.v) + '</b></div>';
          }).join('') +
          '<div class="stb-tip-row" data-esc=""><i></i><span>اسکالیت</span><b>' + cur.esc + '</b></div>';
        tip.style.opacity = '1';

      } else {
        root.removeAttribute('data-scrub');
        cols.forEach(function(c) { c.removeAttribute('data-on'); });
        tip.style.opacity = '0';
      }
    }

    plot.addEventListener('pointerdown', function(e) {
      try { plot.setPointerCapture(e.pointerId); } catch(ex) {}
      pick(e);
    });
    plot.addEventListener('pointermove', function(e) {
      if (e.buttons > 0) pick(e);
    });
    plot.addEventListener('pointerup', function(e) {
      try { plot.releasePointerCapture(e.pointerId); } catch(ex) {}
      if (e.pointerType !== 'mouse') setAt(null);
    });
    plot.addEventListener('pointerleave', function() { setAt(null); });

    /* Tab switching */
    tabDay.addEventListener('click', function() {
      if (mode !== 'Day') { mode = 'Day'; setAt(null); render(); }
    });
    tabWeek.addEventListener('click', function() {
      if (mode !== 'Week') { mode = 'Week'; setAt(null); render(); }
    });

    /* Initial render */
    render();
  }

  window.StackedBars = {
    mount: function(container, options) {
      StackedBars(container, options);
    }
  };
})();
