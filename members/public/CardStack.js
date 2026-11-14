/* ══ CardStack Component — Vanilla JS + React via htm ══
   Adapted from Bencho's React component.
   A pile of pricing cards that fans out on approach.
*/

(function() {
  'use strict';

  const { useState, useEffect, useRef, useLayoutEffect } = React;

  const CARD_W = 156;
  const CARD_H = 208;
  const PIVOT = 260;
  const ARC = 40;
  const SHUT_ROT = 5;
  const SHUT_OFF = 7;
  const RAGGED = 0.22;
  const REST = 0.4;
  const DEEP = 5;
  const SINK = 0.016;
  const LIFT = 20;
  const BEAT = 55;
  const MAX = 6;

  const SEED = [
    { rot: -0.62, dx: 0.41, dy: -0.28, beat: 0.34, tune: -0.22 },
    { rot: 0.83, dx: -0.55, dy: 0.36, beat: -0.47, tune: 0.31 },
    { rot: -0.24, dx: 0.68, dy: 0.52, beat: 0.71, tune: -0.44 },
    { rot: 0.47, dx: -0.31, dy: -0.63, beat: -0.18, tune: 0.58 },
    { rot: -0.91, dx: -0.72, dy: 0.19, beat: 0.52, tune: -0.36 },
    { rot: 0.36, dx: 0.24, dy: -0.47, beat: -0.66, tune: 0.27 },
  ];

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const rad = (deg) => (deg * Math.PI) / 180;

  const MOST = (ARC / 2) * (1 + RAGGED);
  const SWING = PIVOT * Math.sin(rad(MOST));
  const DROP = PIVOT * (1 - Math.cos(rad(MOST)));
  const EXT_X = (CARD_W * Math.cos(rad(MOST)) + CARD_H * Math.sin(rad(MOST))) / 2;
  const EXT_Y = (CARD_W * Math.sin(rad(MOST)) + CARD_H * Math.cos(rad(MOST))) / 2;
  const JIT = SHUT_OFF + (CARD_W * Math.sin(rad(SHUT_ROT)) + CARD_H * (1 - Math.cos(rad(SHUT_ROT)))) / 2;
  const PILE = (MAX - 1) * DEEP;
  const STAGE_W = Math.ceil((SWING + EXT_X + JIT) * 2);
  const ABOVE = Math.max(CARD_H / 2 + PILE, EXT_Y - DROP) + LIFT + JIT;
  const BELOW = Math.max(CARD_H / 2, EXT_Y + DROP) + JIT;
  const STAGE_H = Math.ceil(ABOVE + BELOW);

  const stillness = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function springOf(tune) {
    return { k: 0.08 + (tune / 100) * 0.16, d: 0.62 + (tune / 100) * 0.2 };
  }

  function useSpring(target, tune, instant) {
    const [at, setAt] = useState(target);
    const cur = useRef(target);
    const vel = useRef(0);
    const raf = useRef(0);

    useEffect(() => {
      if (instant) { cur.current = target; vel.current = 0; setAt(target); return; }
      const { k, d } = springOf(tune);
      let prev = 0;
      const tick = (t) => {
        const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
        prev = t;
        vel.current += (target - cur.current) * k * dt;
        vel.current *= Math.pow(d, dt);
        cur.current += vel.current * dt;
        if (Math.abs(target - cur.current) < 0.02 && Math.abs(vel.current) < 0.02) {
          cur.current = target; vel.current = 0; setAt(target); raf.current = 0; return;
        }
        setAt(cur.current);
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf.current); raf.current = 0; };
    }, [target, tune, instant]);

    return at;
  }

  function CardStack({ spread = 85, bounce = 50, scatter = 0, count = 5, corner = 14, cards = [] }) {
    const n = clamp(Math.round(count), 3, MAX);
    const sc = clamp(scatter, 0, 100) / 100;
    const still = stillness();
    const [hover, setHover] = useState(false);
    const [lit, setLit] = useState(() => Array(MAX).fill(false));
    const [near, setNear] = useState(null);
    const [deck, setDeck] = useState(() => Array.from({ length: MAX }, (_, k) => k));
    const timers = useRef([]);

    const on = hover;
    const arc = 10 + (clamp(spread, 0, 100) / 100) * (ARC - 10);
    const step = arc / (n - 1);

    useEffect(() => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const gap = still ? 0 : BEAT;
      for (let i = 0; i < MAX; i++) {
        const place = on ? n - 1 - i : i;
        const at = Math.max(0, gap * (place + SEED[i].beat * sc * 0.6));
        const set = () => setLit(prev => { if (prev[i] === on) return prev; const next = [...prev]; next[i] = on; return next; });
        if (at <= 0) set(); else timers.current.push(window.setTimeout(set, at));
      }
      return () => { timers.current.forEach(clearTimeout); timers.current = []; };
    }, [on, n, sc, still]);

    const tune = (i) => clamp(bounce * (1 + SEED[i].tune * sc * 0.45), 0, 100);
    const springs = Array.from({ length: MAX }, (_, i) => useSpring(lit[i] ? 100 : 0, tune(i), still));

    const PAD = 14;
    const half = rad((arc / 2) * (1 + RAGGED * sc));
    const fanX = PIVOT * Math.sin(half) + (CARD_W * Math.cos(half) + CARD_H * Math.sin(half)) / 2;
    const fanTop = ABOVE - CARD_H / 2 - LIFT;
    const fanBottom = ABOVE + (CARD_W * Math.sin(half) + CARD_H * Math.cos(half)) / 2 + PIVOT * (1 - Math.cos(half));
    const fanPad = { left: STAGE_W / 2 - fanX - PAD, top: fanTop - PAD, width: (fanX + PAD) * 2, height: fanBottom - fanTop + PAD * 2 };
    const shutPad = { left: (STAGE_W - CARD_W) / 2 - 10, top: ABOVE - CARD_H / 2 - PILE - 10, width: CARD_W + 20, height: CARD_H + PILE + 20 };

    return html`
      <div class="stk" style=${{ width: STAGE_W, height: STAGE_H, '--stk-lift': LIFT + 'px', '--stk-r': clamp(corner, 0, CARD_W / 2) + 'px', '--stk-ease': still ? 'linear' : 'cubic-bezier(0.4,0,0.2,1)' }}
        onPointerOver=${() => { if (!hover) setHover(true); }}
        onPointerOut=${(e) => { const to = e.relatedTarget; if (to && e.currentTarget.contains(to)) return; setHover(false); setNear(null); }}>
        <span class="stk-hit" onPointerOver=${() => setNear(null)} style=${on ? fanPad : shutPad} />
        ${Array.from({ length: n }, (_, i) => {
          const u = springs[i] / 100;
          const back = n - 1 - i;
          const c = i - (n - 1) / 2;
          const openRot = c * step + SEED[i].rot * sc * RAGGED * step;
          const shutRot = c * step * REST + SEED[i].rot * sc * SHUT_ROT * 0.6;
          const shutX = SEED[i].dx * sc * SHUT_OFF;
          const shutY = -back * DEEP + SEED[i].dy * sc * SHUT_OFF;
          const lift = on && near === i;
          const rot = mix(shutRot, openRot, u);
          const recede = 1 - back * SINK * (1 - u);
          const id = deck[back];
          const card = cards[id % cards.length] || { discipline: 'Card ' + (id+1), price: '—' };
          return html`
            <span key=${id} class="stk-card" style=${{
              left: (STAGE_W - CARD_W) / 2, top: ABOVE - CARD_H / 2, width: CARD_W, height: CARD_H,
              transformOrigin: '50% ' + (CARD_H / 2 + PIVOT) + 'px',
              transform: 'translate(' + mix(shutX, 0, u).toFixed(2) + 'px, ' + mix(shutY, 0, u).toFixed(2) + 'px) rotate(' + rot.toFixed(3) + 'deg)',
              zIndex: i
            }} onPointerEnter=${() => setNear(i)}>
              <span class="stk-face" data-lift=${lift || undefined} style=${{ scale: recede }}>
                <div class="stk-card-content">
                  <span class="stk-no">${id + 1}</span>
                  <div class="stk-card-discipline">${card.discipline}</div>
                  <div class="stk-card-price">${card.price}</div>
                  <div class="stk-card-unit">هزار تومان</div>
                </div>
              </span>
            </span>
          `;
        })}
      </div>
    `;
  }

  window.CardStack = CardStack;
})();
