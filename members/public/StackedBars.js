/* ══ Stacked Bars — Vanilla JS ═══════════════════════════
   Adapted from Bencho's React StackedBars.
   Real data from API, Day/Week/Month modes, full width.

   Token mapping (Bencho → project):
     --fill-on    → #1a1a2e (project text)
     --fill-slab  → rgba(255,255,255,0.9) (card surface)
     --font-ui    → 'Vazirmatn', Tahoma, sans-serif
     --pane-edge  → rgba(212,168,83,0.2) (gold border)
*/

(function() {
  'use strict';

  /* Responsive: full width with max */
  const MAX_W = 900;
  const PAD = 20;
  const CH = 140;
  const BH = 28;
  const SEG_GAP = 3;
  const LIFT = 2;
  const TIP_W = 160;

  const JALALI_MONTHS = ['فرووردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const JALALI_MONTHS_SHORT = ['فرو','ارد','خرد','تیر','مرد','شهر','مهر','آبا','آذر','دی','بهم','اسف'];

  /* Categories — martial arts metrics */
  const CATS = ['استقامت', 'قدرت', 'تکنیک', 'انعطاف'];

  function fmt(v) { return Math.round(v).toLocaleString('fa-IR'); }
  function sum(a) { return a.reduce(function(s, v) { return s + v; }, 0); }

  /* Spring animation */
  function springTo(el, prop, target, duration) {
    duration = duration || 400;
    var current = parseFloat(el.style[prop] || 0);
    var diff = target - current;
    if (Math.abs(diff) < 0.5) { el.style[prop] = target + 'px'; return; }
    var startTime = performance.now();
    function tick(now) {
      var t = Math.min(1, (now - startTime) / duration);
      var ease = 1 - Math.pow(1 - t, 3);
      el.style[prop] = (current + diff * ease) + 'px';
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function StackedBars(container, options) {
    if (!container) return;
    options = options || {};

    var mode = 'Day'; /* Day | Week | Month */
    var at = null;
    var data = [];
    var layout = [];
    var cols = [];
    var barCount = 0;
    var g = 0;
    var bw = 0;
    var plotW = 0;

    /* Build DOM */
    var root = document.createElement('div');
    root.className = 'stb stb-wide';
    root.setAttribute('data-colour', 'on');

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
    segCtl.className = 'stb-seg-ctl stb-seg-3';
    segCtl.setAttribute('data-mode', mode);

    var thumb = document.createElement('span');
    thumb.className = 'stb-thumb';

    var tabDay = document.createElement('button');
    tabDay.className = 'stb-tab';
    tabDay.setAttribute('data-on', '');
    tabDay.textContent = 'روزانه';

    var tabWeek = document.createElement('button');
    tabWeek.className = 'stb-tab';
    tabWeek.textContent = 'هفتگی';

    var tabMonth = document.createElement('button');
    tabMonth.className = 'stb-tab';
    tabMonth.textContent = 'ماهانه';

    segCtl.appendChild(thumb);
    segCtl.appendChild(tabDay);
    segCtl.appendChild(tabWeek);
    segCtl.appendChild(tabMonth);

    head.appendChild(titles);
    head.appendChild(segCtl);
    root.appendChild(head);

    /* Figure */
    var figure = document.createElement('div');
    figure.className = 'stb-figure';
    var numEl = document.createElement('span');
    numEl.className = 'stb-num';
    var unitEl = document.createElement('span');
    unitEl.className = 'stb-unit';
    unitEl.textContent = 'مجموع نمره';
    figure.appendChild(numEl);
    figure.appendChild(unitEl);
    root.appendChild(figure);

    /* Plot */
    var plot = document.createElement('div');
    plot.className = 'stb-plot';
    plot.style.height = (CH + 1 + BH) + 'px';

    var baseLine = document.createElement('span');
    baseLine.className = 'stb-base';
    baseLine.style.top = CH + 'px';
    plot.appendChild(baseLine);

    var ring = document.createElement('span');
    ring.className = 'stb-ring';
    plot.appendChild(ring);

    var tip = document.createElement('div');
    tip.className = 'stb-tip';
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

    /* Tab widths for 3-mode thumb */
    function updateThumb() {
      var third = 100 / 3;
      thumb.style.width = 'calc(' + third + '% - 2px)';
      if (mode === 'Day') thumb.style.transform = 'translateX(0)';
      else if (mode === 'Week') thumb.style.transform = 'translateX(' + third + '%)';
      else thumb.style.transform = 'translateX(' + (third * 2) + '%)';
    }

    /* Compute geometry */
    function computeGeometry() {
      plotW = root.offsetWidth - PAD * 2;
      if (plotW < 100) plotW = 400;
      barCount = data.length;
      if (barCount < 1) return;
      g = Math.max(2, Math.min(8, (plotW - 4 * barCount) / (barCount - 1 || 1)));
      bw = (plotW - g * (barCount - 1)) / barCount;
    }

    /* Render with data */
    function render(newData) {
      if (newData) data = newData;
      if (data.length < 1) return;

      computeGeometry();

      /* Update header */
      subEl.textContent = barCount + ' ' +
        (mode === 'Day' ? 'روز اخیر' : mode === 'Week' ? 'هفته اخیر' : 'ماه اخیر');
      segCtl.setAttribute('data-mode', mode);
      tabDay.setAttribute('data-on', mode === 'Day' ? '' : null);
      tabWeek.setAttribute('data-on', mode === 'Week' ? '' : null);
      tabMonth.setAttribute('data-on', mode === 'Month' ? '' : null);
      updateThumb();

      /* Totals & scale */
      var totals = data.map(function(b) { return sum(b.vals); });
      var maxT = Math.max.apply(null, totals);
      var maxE = Math.max.apply(null, data.map(function(b) { return b.esc || 0; }));
      if (maxT < 1) maxT = 100;
      if (maxE < 1) maxE = 10;
      var scale = (CH - LIFT - 2 - SEG_GAP * 3) / maxT;

      /* Total number with pop */
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

      /* Clear columns */
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

        var escVal = b.esc || 0;
        var esc = document.createElement('span');
        esc.className = 'stb-esc';
        esc.style.top = (CH + 1 + LIFT) + 'px';
        esc.style.height = '0px';
        col.appendChild(esc);

        layout.push({
          segs: segs,
          top: y - SEG_GAP,
          esc: Math.max(3, (escVal / maxE) * (BH - LIFT - 2))
        });

        plot.appendChild(col);
        cols.push(col);
      }

      /* Axis */
      axisFirst.textContent = data[0].short;
      axisLast.textContent = data[data.length - 1].short;

      /* Animate in */
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

      if (idx !== null && idx < barCount) {
        root.setAttribute('data-scrub', '');
        cols.forEach(function(c, i) {
          c.setAttribute('data-on', i === idx ? '' : null);
        });

        var L = layout[idx];
        var left = idx * (bw + g);
        var x = left - 3;
        var up = L.top;
        var down = L.esc;
        var y = CH - LIFT - up - 3;
        var h = up + LIFT + 1 + LIFT + down + 6;

        ring.style.width = (bw + 6) + 'px';
        springTo(ring, 'left', x, 400);
        springTo(ring, 'top', y, 400);
        ring.style.height = h + 'px';

        /* Tooltip position */
        var right = left + bw + 8;
        var tx;
        if (right + TIP_W <= plotW || left - 8 - TIP_W < 0) {
          tx = Math.min(plotW - TIP_W, right);
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
          '<div class="stb-tip-row" data-esc=""><i></i><span>جلسات</span><b>' + (cur.esc || 0) + '</b></div>';
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

    /* Tabs */
    function setMode(m) {
      if (mode !== m) {
        mode = m;
        setAt(null);
        /* Request new data for this mode */
        if (options.onModeChange) options.onModeChange(m);
      }
    }
    tabDay.addEventListener('click', function() { setMode('Day'); });
    tabWeek.addEventListener('click', function() { setMode('Week'); });
    tabMonth.addEventListener('click', function() { setMode('Month'); });

    /* Resize handler */
    var resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() { render(); }, 200);
    });

    /* Public API */
    var api = {
      render: render,
      setMode: setMode,
      root: root
    };

    return api;
  }

  window.StackedBars = {
    mount: function(container, options) {
      return StackedBars(container, options);
    }
  };
})();
