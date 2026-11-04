// motion-player: the player half of MOTION_SPEC.md. Loaded after app.js; it reuses app.js globals ($, S, cur, Q, cover,
// openNP, ovOpen, ovClosed, noClickSoon, vibrate…) and replaces setNP / openSheet / closeSheet / gripDrag with spring-driven
// versions. Every motion goes through window.Spring; only transform and opacity move (plus filter on lyrics).
(() => {
  if (!window.Spring) return;
  const SP = window.Spring;
  const off = () => H.dataset.motion === 'off';
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const canDrag = (e) => e.button === 0 && (e.pointerType !== 'mouse' || !desktop()); // desktop mouse clicks, never drags

  // ---------- full player: one offset (y) drives the sheet, the card stack behind it and the artwork morph ----------
  const np = $('#np'), app = $('#app'), barCover = $('#barCover'), npCover = $('#npCover');
  const dim = document.createElement('div'); dim.className = 'mp-dim'; dim.setAttribute('aria-hidden', 'true');
  const fly = document.createElement('img'); fly.className = 'mp-fly'; fly.alt = ''; fly.hidden = true;
  document.body.append(dim, fly);
  npCover.addEventListener('load', () => { if (!geo) fly.src = npCover.currentSrc || npCover.src; }); // new song: the copy is ready before a drag
  let y = 0, want = false, run = null, geo = null, flyT = 0;

  // Measure once per open/close: where the mini and big artwork sit (unscaled page), and the screen height.
  function begin() {
    if (geo) return;
    clearTimeout(flyT);
    const h = innerHeight, stack = !desktop();
    app.style.transform = '';
    np.style.transform = `translate3d(0, ${y}px, 0)`;
    const b = npCover.getBoundingClientRect(), m = barCover.getBoundingClientRect();
    const rad = (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    geo = { h, w: innerWidth, stack, big: { x: b.left, y: b.top - y, w: b.width || 1, h: b.height || 1 },
      mini: m.width ? { x: m.left, y: m.top, w: m.width, h: m.height } : { x: 16, y: h - 64, w: 46, h: 46 },
      rb: rad(npCover) * (b.width / (npCover.offsetWidth || 1)) };
    H.classList.toggle('mp-stack', stack);
    H.classList.add('mp-moving');
    const src = npCover.currentSrc || npCover.src;
    if (fly.src !== src) fly.src = src; // re-setting the same src reloads it: blank for a frame
    // The radius is set once: tweening it every frame re-rastered the art and phones drew it blank for a frame.
    fly.style.cssText = `left:${geo.big.x}px;top:${geo.big.y}px;width:${geo.big.w}px;height:${geo.big.h}px;border-radius:${geo.rb}px`;
    fly.hidden = !npCover.getAttribute('src');
    // The cover the copy starts on (big when open, mini when closed) hides 3 frames later: the copy may not be drawn yet.
    const g = geo, hide = fly.hidden ? '' : '0', [under, other] = y < h / 2 ? [npCover, barCover] : [barCover, npCover];
    other.style.opacity = hide;
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => { if (geo === g) under.style.opacity = hide; })));
  }
  function render() {
    const g = geo, k = clamp01(1 - y / g.h);
    np.style.transform = `translate3d(0, ${y}px, 0)`;
    const s = g.stack ? 1 - 0.08 * k : 1;
    if (g.stack) { app.style.transform = `scale(${s})`; dim.style.opacity = (0.45 * k).toFixed(3); }
    if (fly.hidden) return;
    // The mini artwork rides the shrinking page; the big one rides the sheet. The art leads the sheet a little.
    const { mini: m, big: b } = g, ox = g.w / 2, oy = g.h / 2;
    const mx = ox + (m.x - ox) * s, my = oy + (m.y - oy) * s, mw = m.w * s;
    const w = lerp(mw, b.w, k), x = lerp(mx, b.x, k), top = lerp(my, b.y, k) + 0.6 * k * (1 - k) * g.h + Math.min(0, y);
    const sc = w / b.w;
    fly.style.transform = `translate3d(${x - b.x}px, ${top - b.y}px, 0) scale(${sc})`;
  }
  function settle() {
    run = null;
    // The copy stays a moment over the real cover (same spot) while that draws; swapping on one frame showed it tile by tile.
    barCover.style.opacity = npCover.style.opacity = '';
    clearTimeout(flyT); flyT = setTimeout(() => { if (!geo) fly.hidden = true; }, 250);
    H.classList.remove('mp-moving');
    np.style.transform = '';
    if (want) { geo = null; $('#npClose').focus({ preventScroll: true }); return; }
    openNP(false); H.dataset.np = 'closed';
    app.style.transform = ''; dim.style.opacity = '0'; H.classList.remove('mp-stack');
    geo = null; y = 0;
    npOpener?.focus?.({ preventScroll: true }); npOpener = null;
  }
  function go(to, velocity = 0) {
    run?.stop();
    begin();
    run = SP.animate({ from: y, to, velocity, preset: 'sheet', onUpdate: (v) => { y = v; render(); }, onDone: settle });
  }
  // Same bookkeeping as app.js's setNP (overlay stack, history entry, focus), but the motion is ours.
  function show() {
    if (!np.hidden) { if (!OV.stack.includes('np')) ovOpen('np'); return; }
    npOpener = document.activeElement; ovOpen('np');
    openNP(true); H.dataset.np = 'open';
    y = innerHeight; geo = null;
  }
  function setOpen(on, velocity = 0) {
    if (on && !cur()) return;
    want = on;
    if (on) show(); else ovClosed('np');
    if (np.hidden) return;
    begin(); go(on ? 0 : geo.h, velocity);
  }
  setNP = (on) => { if (on !== want || (on && np.hidden)) setOpen(on); };

  // Vertical drags: up from the mini player opens, down on the player closes. Velocity decides, 30% / 600 px/s commits.
  function dragY(e, { fromBar }) {
    const id = e.pointerId, y0 = e.clientY, x0 = e.clientX, tr = SP.tracker();
    let lock = null, base = 0, raf = 0, dy = 0;
    const move = (ev) => {
      if (ev.pointerId !== id) return;
      dy = ev.clientY - y0;
      if (!lock) {
        const dx = ev.clientX - x0;
        if (Math.hypot(dx, dy) < 10) return;
        if (Math.abs(dx) > Math.abs(dy) || (fromBar && dy > 0)) return done(true, 'x');
        lock = 'y';
        try { (fromBar ? $('#bar') : np).setPointerCapture(id); } catch { /* pointer gone: drag still works */ }
        run?.stop(); run = null;
        if (fromBar) { want = true; show(); }
        begin(); base = y - dy;
      }
      tr.add(ev.clientY, ev.timeStamp);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; const raw = base + dy; y = raw < 0 ? SP.rubber(raw) : raw; render(); });
    };
    const up = (ev) => done(ev.type === 'pointercancel');
    function done(cancel, handOff) {
      H.classList.remove('mp-wake');
      removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
      cancelAnimationFrame(raf);
      if (handOff === 'x') return fromBar && miniSwipeStart(e);
      if (!lock) return;
      noClickSoon();
      const v = cancel ? 0 : tr.velocity(), raw = base + dy;
      y = raw < 0 ? SP.rubber(raw) : raw;
      const open = v < -600 || (v < 600 && y < geo.h * (fromBar ? 0.7 : 0.3));
      setOpen(open, v);
      if (open && fromBar) vibrate(8);
    }
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  }
  np.addEventListener('pointerdown', (e) => {
    if (!canDrag(e) || desktop() || np.hidden) return;
    if (e.target.closest('input, .np-pane, .np-tabs, .vz-top')) return; // the scrubber, lyrics, queue, info and colour pills keep their own gestures
    H.classList.add('mp-wake'); // the hidden page behind starts drawing now, so it is ready when the sheet moves
    dragY(e, { fromBar: false });
  });

  // ---------- mini player: horizontal swipe with the neighbour song peeking in ----------
  const bar = $('#bar'), now = $('#nowMini');
  const parts = [now.querySelector('.cover-wrap'), now.querySelector('.meta')];
  const peek = document.createElement('div'); peek.className = 'mp-peek'; peek.setAttribute('aria-hidden', 'true');
  peek.innerHTML = '<div class="cover-wrap"><img alt="" draggable="false"></div><div class="meta"><b></b><span></span></div>';
  now.append(peek);
  let mrun = null, swiped = { t: 0, dir: 1 };
  const neighbour = (side) => {
    const n = S.queue.length;
    if (side > 0) return n > 1 ? Q(S.queue[(S.qi + 1) % n]) : null; // Next wraps to the start (as next(false) does)
    return S.qi > 0 ? Q(S.queue[S.qi - 1]) : null;
  };
  function paintMini(dx, W) {
    const o = String(1 - Math.min(1, Math.abs(dx) / W) * 0.7);
    for (const p of parts) { p.style.transform = `translate3d(${dx}px, 0, 0)`; p.style.opacity = o; }
    peek.style.transform = `translate3d(${dx + (dx < 0 ? W : -W)}px, 0, 0)`;
  }
  function clearMini() { for (const p of parts) p.style.transform = p.style.opacity = ''; peek.hidden = true; peek.dataset.side = ''; }
  clearMini();
  function fillPeek(side) {
    if (peek.dataset.side === String(side)) return;
    peek.dataset.side = String(side);
    const t = neighbour(side);
    peek.hidden = !t;
    if (!t) return;
    peek.querySelector('img').src = cover(t);
    peek.querySelector('b').textContent = t.title;
    peek.querySelector('span').textContent = t.artist;
  }
  // Called once the drag sniffer in dragY saw a horizontal move; dx counts from the original pointerdown.
  function miniSwipeStart(e) {
    const id = e.pointerId, x0 = e.clientX, tr = SP.tracker();
    const nw = now.getBoundingClientRect(), W = nw.width, cw = parts[0].getBoundingClientRect();
    peek.style.left = `${cw.left - nw.left}px`;
    mrun?.stop(); mrun = null;
    try { bar.setPointerCapture(id); } catch { /* ok */ }
    let dx = 0, raf = 0;
    tr.add(x0, e.timeStamp);
    const move = (ev) => {
      if (ev.pointerId !== id) return;
      const raw = ev.clientX - x0, side = raw < 0 ? 1 : -1;
      fillPeek(side);
      dx = neighbour(side) ? raw : SP.rubber(raw, 40);
      tr.add(ev.clientX, ev.timeStamp);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintMini(dx, W); });
    };
    const up = (ev) => {
      if (ev.pointerId !== id) return;
      removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
      cancelAnimationFrame(raf);
      noClickSoon();
      const v = ev.type === 'pointercancel' ? 0 : tr.velocity(), side = dx < 0 ? 1 : -1;
      const commit = neighbour(side) && Math.sign(v || dx) === Math.sign(dx) && (Math.abs(dx) > W * 0.4 || Math.abs(v) > 500);
      const to = commit ? -side * W : 0;
      if (commit) vibrate(8);
      mrun = SP.animate({ from: dx, to, velocity: v, preset: 'snappy', onUpdate: (val) => paintMini(val, W), onDone: () => {
        mrun = null;
        if (!commit) return clearMini();
        swiped = { t: performance.now(), dir: side };
        if (side > 0) next(false); else prev(true);
        const reset = () => requestAnimationFrame(clearMini);
        barCover.decode ? barCover.decode().then(reset, reset) : reset();
      } });
    };
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  }
  bar.addEventListener('pointerdown', (e) => {
    if (!canDrag(e) || desktop() || !cur() || e.target.closest('input')) return;
    dragY(e, { fromBar: true });
  });

  // ---------- track change: the artwork deals in from the side you went, on a bouncy spring ----------
  function slide(el, dx, preset, delay = 0) {
    if (!el) return;
    const go1 = () => SP.animate({ from: 0, to: 1, preset, onUpdate: (k) => {
      el.style.transform = k >= 1 ? '' : `translate3d(${dx * (1 - k)}px, 0, 0)`;
      el.style.opacity = k >= 1 ? '' : String(clamp01(k * 1.6));
    } });
    el.style.transform = `translate3d(${dx}px, 0, 0)`; el.style.opacity = '0';
    delay ? setTimeout(go1, delay) : go1();
  }
  let lastDir = null;
  function trackMotion(dir) {
    if (off() || document.hidden) return;
    const mine = performance.now() - swiped.t < 1200;
    if (mine) dir = swiped.dir;
    lastDir = { dir, t: performance.now() }; // visualizer.js wipes the album colours in from this side
    if (H.dataset.np === 'open' && !np.hidden) {
      const art = $('#np .cover-wrap.big');
      slide(art, dir * Math.min(innerWidth * 0.5, 260), 'bouncy');
      $$('#np .np-meta > :not([hidden])').forEach((m, i) => slide(m, dir * 28, 'smooth', 40 + i * 30));
    }
    if (!mine && !mrun) parts.forEach((p, i) => slide(p, dir * 16, 'snappy', i * 30));
  }

  // ---------- controls: press springs; scrubber and volume grow while held ----------
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('#play, [data-act="play"], #next, #prev, [data-act="next"], [data-act="prev"]');
    if (b) { b.classList.add('mp-press'); const up = () => { b.classList.remove('mp-press'); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); }; addEventListener('pointerup', up); addEventListener('pointercancel', up); }
    const r = e.target.closest?.('#npSeek, #seek, #vol');
    if (r) {
      r.classList.add('mp-on'); r.parentElement.classList.add('mp-on');
      const up = () => { r.classList.remove('mp-on'); r.parentElement.classList.remove('mp-on'); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
      addEventListener('pointerup', up); addEventListener('pointercancel', up);
    }
  }, true);
  for (const id of ['#npSeek', '#seek', '#vol']) $(id).classList.add('mp-range');

  // ---------- lyrics: the lines move as a spring wave (each one a beat behind), depth by distance ----------
  const lyr = new WeakMap(); // line -> { y, run }
  const touchedAt = new WeakMap(); // scroller -> last time the user scrolled it
  for (const sc of [$('#npLyrics'), $('#drawerBody')]) {
    const mark = () => { touchedAt.set(sc, performance.now()); sc.classList.add('mp-free'); clearTimeout(sc._mpT); sc._mpT = setTimeout(() => sc.classList.remove('mp-free'), 2500); };
    sc.addEventListener('wheel', mark, { passive: true });
    sc.addEventListener('touchmove', mark, { passive: true });
  }
  function lyricScroll(scroller, top, box) {
    const lines = [...box.querySelectorAll('p[data-i]')], on = box.querySelector('p.on'), i = on ? +on.dataset.i : -1;
    for (const p of lines) p.style.setProperty('--d', Math.min(4, Math.abs(+p.dataset.i - i)));
    if (performance.now() - (touchedAt.get(scroller) || -1e9) < 2500) return; // the user is reading elsewhere
    const before = scroller.scrollTop;
    scroller.scrollTop = top;
    const delta = scroller.scrollTop - before;
    if (off() || !delta) return;
    const view = scroller.getBoundingClientRect();
    let k = 0;
    for (const p of lines) {
      const r = p.getBoundingClientRect();
      if (r.bottom < view.top - 200 || r.top > view.bottom + 200) { const s = lyr.get(p); s?.run?.stop(); p.style.translate = ''; lyr.delete(p); continue; }
      const st = lyr.get(p) || { y: 0, run: null };
      st.run?.stop();
      st.y += delta;
      p.style.translate = `0 ${st.y}px`;
      lyr.set(p, st);
      const delay = +p.dataset.i >= i - 1 ? 20 * Math.min(12, k++) : 0;
      setTimeout(() => {
        st.run?.stop();
        st.run = SP.animate({ from: st.y, to: 0, preset: 'smooth', onUpdate: (v) => { st.y = v; p.style.translate = v ? `0 ${v}px` : ''; } });
      }, delay);
    }
  }

  // ---------- bottom sheet: springs up, detents at half and full height, velocity, rubber-band ----------
  const wrap = $('#sheet'), sheet = $('.sheet', wrap), scrim = $('.sheet-scrim', wrap), sbody = $('.sheet-body', wrap);
  let sy = 0, sh = 0, dets = [0], srun = null, closing = false, lifted = null;
  const lowOpen = () => dets[dets.length - 1];
  function sRender() {
    sheet.style.transform = `translate3d(0, ${sy}px, 0)`;
    scrim.style.opacity = String(clamp01((sh - sy) / Math.max(1, sh - lowOpen())));
  }
  function sMeasure() {
    sh = sheet.offsetHeight;
    const vh = innerHeight;
    dets = sh > vh * 0.62 ? [0, sh - vh * 0.5] : [0];
  }
  function sTouch() { // at the half detent the whole sheet drags; at full height a long list scrolls
    sbody.style.touchAction = sy > 1 || sbody.scrollHeight <= sbody.clientHeight + 1 ? 'none' : 'pan-y';
  }
  function sGo(to, velocity, done) {
    srun?.stop();
    srun = SP.animate({ from: sy, to, velocity, preset: 'sheet', onUpdate: (v) => { sy = v; sRender(); }, onDone: () => { srun = null; sTouch(); done?.(); } });
  }
  const openSheet0 = openSheet;
  openSheet = function (items, head) {
    const reopened = closing; // reopened mid-close: take it back from where it is
    if (closing) { closing = false; srun?.stop(); wrap.hidden = true; wrap.style.pointerEvents = ''; }
    const fresh = wrap.hidden;
    openSheet0(items, head);
    sMeasure();
    if (fresh && !reopened) sy = sh;
    sRender();
    sGo(lowOpen(), 0);
  };
  function closeSheet1(velocity = 0) {
    if (wrap.hidden || closing) return;
    closing = true;
    // the bookkeeping happens now (history, focus), only the hide waits for the spring
    H.dataset.sheet = 'closed'; ovClosed('sheet');
    sheetOpener?.focus?.({ preventScroll: true }); sheetOpener = null;
    wrap.style.pointerEvents = 'none';
    unlift();
    sGo(sh, velocity, () => {
      closing = false; wrap.hidden = true; wrap.style.pointerEvents = '';
      sheet.style.transform = scrim.style.opacity = ''; sy = sh;
    });
  }
  closeSheet = () => closeSheet1(0);
  OV.close.sheet = closeSheet;
  sheet.addEventListener('pointerdown', (e) => {
    if (!canDrag(e) || closing) return;
    const inBody = e.target.closest('.sheet-body');
    if (inBody && sbody.style.touchAction !== 'none') return;
    const id = e.pointerId, y0 = e.clientY, x0 = e.clientX, tr = SP.tracker();
    let lock = false, base = 0, dy = 0, raf = 0;
    const move = (ev) => {
      if (ev.pointerId !== id) return;
      dy = ev.clientY - y0;
      if (!lock) {
        if (Math.hypot(ev.clientX - x0, dy) < 8) return;
        if (Math.abs(ev.clientX - x0) > Math.abs(dy)) return end(ev, true);
        lock = true; srun?.stop(); srun = null; base = sy - dy;
        try { sheet.setPointerCapture(id); } catch { /* ok */ }
      }
      tr.add(ev.clientY, ev.timeStamp);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; const raw = base + dy; sy = raw < 0 ? SP.rubber(raw) : raw; sRender(); });
    };
    const end = (ev, abandon) => {
      if (ev.pointerId !== id) return;
      removeEventListener('pointermove', move, true); removeEventListener('pointerup', end, true); removeEventListener('pointercancel', end, true);
      cancelAnimationFrame(raf);
      if (!lock || abandon === true) return;
      noClickSoon();
      const v = ev.type === 'pointercancel' ? 0 : tr.velocity(), raw = base + dy;
      sy = raw < 0 ? SP.rubber(raw) : raw;
      const aim = sy + v * 0.18; // where a flick would carry it
      const pick = [...dets, sh].reduce((a, b) => (Math.abs(b - aim) < Math.abs(a - aim) ? b : a));
      if (pick === sh) closeSheet1(v); else sGo(pick, v);
    };
    addEventListener('pointermove', move, true); addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
  });
  // Long-press lift: app.js fires a synthetic contextmenu when the hold completes; the item pops up under the sheet.
  function unlift() { lifted?.classList.remove('mp-lift'); lifted = null; }
  document.addEventListener('contextmenu', (e) => {
    if (e.isTrusted) return;
    const el = e.target.closest?.('.row, .qrow, .card, .tile, .qp, .gs-item');
    if (!el) return;
    unlift(); lifted = el; el.classList.add('mp-lift');
    setTimeout(() => { if (lifted === el && wrap.hidden) unlift(); }, 1500);
  }, true);

  // ---------- Up next / playlist reorder: the held row lifts, the others make room on a spring ----------
  gripDrag = function (e, row, onDrop) {
    e.preventDefault(); e.stopPropagation();
    const sel = row.classList.contains('qrow') ? '.qrow' : '.row', g = e.currentTarget, y0 = e.clientY;
    const rows = $$(sel, row.parentElement), me = rows.indexOf(row), tops = rows.map((r) => r.getBoundingClientRect().top);
    const mid = tops[me] + row.offsetHeight / 2;
    g.setPointerCapture(e.pointerId);
    row.classList.add('is-dragging'); row.parentElement.classList.add('mp-room');
    let to = me, dy = 0, raf = 0;
    const paint = () => {
      raf = 0;
      row.style.setProperty('--dy', `${dy}px`);
      rows.forEach((r, k) => {
        if (k === me) return;
        const shift = me < k && k <= to ? tops[k - 1] - tops[k] : to <= k && k < me ? tops[k + 1] - tops[k] : 0;
        r.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : '';
      });
    };
    const move = (ev) => {
      dy = ev.clientY - y0;
      const at = mid + dy;
      to = me;
      for (let k = 0; k < rows.length; k++) if (at >= tops[k] && (k === rows.length - 1 || at < tops[k + 1])) to = k;
      if (at < tops[0]) to = 0;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const up = () => {
      g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
      cancelAnimationFrame(raf); paint();
      noClickSoon();
      const finish = () => {
        row.classList.remove('is-dragging'); row.parentElement.classList.remove('mp-room'); row.style.setProperty('--dy', '0px');
        rows.forEach((r) => (r.style.transform = ''));
        if (to !== me) onDrop(+row.dataset.i, +rows[to].dataset.i);
      };
      SP.animate({ from: dy, to: tops[to] - tops[me], preset: 'snappy', onUpdate: (v) => row.style.setProperty('--dy', `${v}px`), onDone: finish });
    };
    g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  };

  // ---------- Up next as a card stack (current on top): drag up or tap to fan it open; fanned, the grips reorder ----------
  const qbox = $('#npQueue');
  const deckBar = document.createElement('div'); deckBar.className = 'mp-deck-bar';
  deckBar.innerHTML = '<button type="button" class="mp-deck-shuf"></button><button type="button" class="mp-deck-btn"></button>';
  const deckBtn = $('.mp-deck-btn', deckBar), shufBtn = $('.mp-deck-shuf', deckBar);
  shufBtn.addEventListener('click', () => $('#np [data-act="shuffle"]').click()); // on a phone the player's own button is off screen here
  let fan = 0, frun = null, deckOn = false, upNext = 0;
  function setFan(v) {
    fan = v;
    qbox.style.setProperty('--fan', v.toFixed(4));
    const open = v >= 0.999;
    qbox.classList.toggle('mp-fanned', open);
    deckBtn.textContent = v > 0.5 ? 'Stack' : `Show all ${upNext}`;
    deckBtn.setAttribute('aria-expanded', String(v > 0.5));
    shufBtn.textContent = S.shuffle ? 'Shuffled' : 'Shuffle'; shufBtn.setAttribute('aria-pressed', String(S.shuffle));
  }
  function fanTo(to, velocity = 0) {
    frun?.stop();
    if (!to) qbox.scrollTop = 0;
    frun = SP.animate({ from: fan, to, velocity, preset: 'snappy', onUpdate: setFan, onDone: () => (frun = null) });
  }
  function deck() { // layout reads only here (after app.js painted the list), never per frame
    const rows = $$('.qrow', qbox), now = rows.find((r) => r.classList.contains('cur'));
    const cards = now ? [now, ...rows.filter((r) => +r.dataset.i > S.qi)] : [];
    deckOn = cards.length > 1;
    qbox.classList.toggle('mp-deck', deckOn);
    if (!deckOn) { deckBar.remove(); return; }
    upNext = cards.length - 1;
    const t0 = now.offsetTop;
    cards.forEach((r, k) => {
      const d = Math.min(k, 5);
      r.classList.add('mp-card'); r.classList.toggle('mp-deep', k > 5);
      r.style.setProperty('--cy', `${t0 + d * 14 - r.offsetTop}px`);
      r.style.setProperty('--cs', String(d * 0.045));
      r.style.setProperty('--tint', `var(--vz-r${(k % 6) + 1}, var(--accent))`);
      r.style.zIndex = String(60 - Math.min(k, 59));
    });
    qbox.style.setProperty('--below', `${t0 + now.offsetHeight + Math.min(upNext, 5) * 14 + 14}px`);
    if (!deckBar.isConnected) qbox.append(deckBar);
    setFan(fan);
  }
  new MutationObserver((recs) => {
    if (recs.every((r) => [...r.addedNodes, ...r.removedNodes].every((n) => n === deckBar))) return;
    deck();
  }).observe(qbox, { childList: true });
  new ResizeObserver(() => qbox.hidden || deck()).observe(qbox);
  deckBtn.addEventListener('click', () => { vibrate(6); fanTo(fan > 0.5 ? 0 : 1); });
  qbox.addEventListener('click', (e) => { // a closed stack opens on a tap instead of playing the card under the finger
    if (!deckOn || fan >= 0.999 || deckBar.contains(e.target)) return;
    e.stopPropagation(); e.preventDefault(); vibrate(6); fanTo(1);
  }, true);
  qbox.addEventListener('pointerdown', (e) => {
    if (!deckOn || fan >= 0.999 || deckBar.contains(e.target)) return;
    e.stopPropagation(); // the grips wait until it is fanned
    if (!canDrag(e)) return;
    const id = e.pointerId, y0 = e.clientY, tr = SP.tracker(), f0 = fan;
    let moved = false, raf = 0, f = fan;
    frun?.stop(); frun = null;
    const move = (ev) => {
      if (ev.pointerId !== id) return;
      const dy = ev.clientY - y0;
      if (!moved && Math.abs(dy) < 8) return;
      if (!moved) { moved = true; try { qbox.setPointerCapture(id); } catch { /* ok */ } }
      tr.add(ev.clientY, ev.timeStamp);
      f = clamp01(f0 - dy / 240);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; setFan(f); });
    };
    const up = (ev) => {
      if (ev.pointerId !== id) return;
      removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
      cancelAnimationFrame(raf);
      if (!moved) return;
      noClickSoon();
      const v = ev.type === 'pointercancel' ? 0 : tr.velocity();
      const open = v < -400 || (v < 400 && f > 0.35);
      if (open) vibrate(8);
      fanTo(open ? 1 : 0, -v / 240);
    };
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  }, true);

  // ---------- Shuffle riffles the queue like a deck: the halves fly in from both sides and interleave ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('#shuffle, [data-act="shuffle"]');
    if (!btn) return;
    vibrate(6);
    if (off()) return;
    const box = !np.hidden && np.dataset.ptab === 'queue' ? qbox : S.drawer === 'queue' ? $('#drawerBody') : null;
    const cards = box ? $$('.qrow', box).filter((r) => +r.dataset.i > S.qi).slice(0, 14) : [];
    if (!cards.length) { // nothing on screen to riffle: the icon does a quick flip instead
      const ico = btn.querySelector('svg');
      if (ico) SP.animate({ from: 1, to: 0, preset: 'bouncy', onUpdate: (v) => (ico.style.rotate = v ? `${v * -180}deg` : '') });
      return;
    }
    cards.forEach((r, k) => {
      const side = k % 2 ? 1 : -1, put = (v) => { r.style.translate = v ? `${side * 72 * v}px 0` : ''; r.style.rotate = v ? `${side * 7 * v}deg` : ''; };
      put(1);
      setTimeout(() => { SP.animate({ from: 1, to: 0, preset: 'bouncy', onUpdate: put }); if (k % 3 === 0) vibrate(4); }, k * 28);
    });
  });

  window.MotionPlayer = { trackMotion, lyricScroll, get dir() { return lastDir; } };
})();
