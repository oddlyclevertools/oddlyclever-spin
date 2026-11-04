// motion-nav: native-feeling navigation (MOTION_SPEC.md, Navigation). Push/pop with parallax and dim, interactive
// swipe-back, per-tab memory, staggered first reveal and rubber-band on Home. Hooks app.js from outside: it wraps the
// globals go(), vt() and renderNav() and FX.enter, and reads S / NAV / OV / LIB_VIEWS. Every motion runs on window.Spring.
// Slides use the `translate` property, so `transform` / `scale` on #main stay free for the player's card stack.
(() => {
  'use strict';
  if (!window.Spring || typeof go !== 'function' || typeof vt !== 'function') return;
  const html = document.documentElement, app = document.getElementById('app'), main = document.getElementById('main');
  const off = () => html.dataset.motion === 'off' || document.hidden;
  const tabOf = (v) => (v === 'home' || v === 'shelf' ? 'home' : v === 'search' || v === 'downloads' ? v : LIB_VIEWS.includes(v) ? 'library' : null);

  const kinds = {};          // history index -> how we got there: 'push' | 'pop' | 'tab'
  const scrolls = {};        // history index -> scrollTop when we left it
  const tabAt = {};          // history index -> the tab it belongs to
  const tabs = {};           // tab -> { view, arg, top }: where that tab was left
  const cache = new Map();   // history index -> { el, top }: the page's DOM, kept for swipe-back
  let shownP = NAV.p, curTab = tabOf(S.view), force = null, tabTo = null, next = null, lastKind = 'push';
  let anim = null, swipe = null, rbSpring = null;

  const dim = Object.assign(document.createElement('div'), { className: 'mn-dim' });
  // A page layer is a <main> so it picks up exactly the same box, padding and background as #main.
  function layer() {
    const el = document.createElement('main');
    el.className = 'mn-layer'; el.inert = true; el.setAttribute('aria-hidden', 'true');
    return el;
  }
  // p = 1: the top page fully in; p = 0: it has gone off to the right. The page under it sits 30% left, dimmed.
  function place(top, under, p, W) {
    top.style.translate = `${(1 - p) * W}px 0`;
    under.style.translate = `${-0.3 * W * p}px 0`;
    if (desktop()) under.style.clipPath = `inset(0 0 0 ${0.3 * W * p}px)`; // keep it off the sidebar
    dim.style.opacity = 0.12 * p;
  }
  function stage(top, under) {
    top.classList.add('mn-top'); under.classList.add('mn-under');
    main.after(dim);
  }
  function unstage() {
    for (const el of [main, ...app.querySelectorAll(':scope > .mn-layer')]) { el.classList.remove('mn-top', 'mn-under'); el.style.translate = el.style.clipPath = ''; }
    dim.remove();
  }
  function keep(p, el, top) {
    el.remove(); el.classList.remove('mn-top', 'mn-under'); el.style.translate = '';
    cache.delete(p); cache.set(p, { el, top });
    for (const k of cache.keys()) if (k >= NAV.p || cache.size > 4) cache.delete(k); // forward pages and the oldest go
  }
  // Spring the stack from p to `to`; `velocity` is in p per second.
  function run(kind, top, under, from, to, velocity, done) {
    const W = main.offsetWidth;
    const end = () => { if (anim === a) anim = null; done(); };
    const a = { kind, p: from, top, under, end };
    anim = a; // set first: with Motion off the spring finishes synchronously inside animate()
    a.spring = Spring.animate({ from, to, velocity, preset: 'smooth', onUpdate: (p) => { a.p = p; place(top, under, p, W); }, onDone: end });
  }
  // Jump a running page animation to its end (a new navigation or gesture takes over).
  function settle() {
    rbSpring?.stop(); rbSpring = null;
    const a = anim; if (!a) return; anim = null; a.spring.stop(); a.end();
  }

  // ---------- page changes: app.js calls vt(fn, { kind: 'page' }) from go() ----------
  const goOrig = window.go;
  window.go = function (view, arg = null, push = true) {
    const same = view === S.view && (arg ?? null) === (S.arg ?? null);
    const back = NAV.p < shownP, fwd = NAV.p > shownP;
    next = { push: push && !same, kind: force || (swipe?.committed ? 'swipe' : push ? (same ? 'none' : 'push')
      : back ? ({ push: 'pop', pop: 'push', tab: 'tab' }[kinds[shownP]] || 'pop') : fwd ? kinds[NAV.p] || 'push' : 'none') };
    force = null;
    return goOrig.apply(this, arguments);
  };
  const vtOrig = window.vt;
  window.vt = function (fn, o) {
    if (o?.kind !== 'page' || !next) return vtOrig(fn, o);
    const { kind, push } = next; next = null;
    if (kind !== 'swipe') settle();
    const from = shownP, top0 = main.scrollTop, target = tabTo, outTab = tabAt[from] || tabOf(S.view); tabTo = null;
    scrolls[from] = top0;
    if (outTab) tabs[outTab] = { view: S.view, arg: S.arg, top: top0, seen: true };
    lastKind = kind === 'tab' && tabs[target?.tab]?.seen ? 'back' : kind; // a tab you come back to appears as you left it

    let ghost = null;
    if (kind === 'push' || (kind === 'pop' && !off())) { // a pushed-over page is kept for swipe-back even with Motion off
      ghost = layer();
      const r = document.createRange(); r.selectNodeContents(main); ghost.append(r.extractContents());
      main.after(ghost); ghost.scrollTop = top0;
    }
    fn(); // app.js renders the new page into #main here (and calls renderNav + FX.enter)
    if (push) kinds[NAV.p] = kind === 'tab' ? 'tab' : kind === 'pop' ? 'pop' : 'push';
    shownP = NAV.p; tabAt[NAV.p] = curTab;
    if (target) main.scrollTop = target.top;
    else if (!push && scrolls[NAV.p] != null) main.scrollTop = scrolls[NAV.p];
    if (!push && kind !== 'push') cache.delete(NAV.p); // #main shows this page live again

    if (kind === 'swipe') { const s = swipe; swipe = null; unstage(); s.layer.remove(); clearTimeout(s.timer); }
    else if (ghost && kind === 'push' && off()) keep(from, ghost, top0);
    else if (ghost && kind === 'push') { stage(main, ghost); place(main, ghost, 0, main.offsetWidth); run('push', main, ghost, 0, 1, 0, () => { unstage(); keep(from, ghost, top0); }); }
    else if (ghost) { stage(ghost, main); place(ghost, main, 1, main.offsetWidth); run('pop', ghost, main, 1, 0, 0, () => { unstage(); ghost.remove(); }); }
    else if (kind === 'tab' && !off()) Spring.animate({ from: 0, to: 1, preset: 'press', onUpdate: (v) => (main.style.opacity = Math.min(1, v)), onDone: () => (main.style.opacity = '') });
    return Promise.resolve();
  };

  // Tabs: the tab you are in, not the kind of page (an album opened from Home stays in Home).
  const renderNavOrig = window.renderNav;
  window.renderNav = function () {
    renderNavOrig.apply(this, arguments);
    document.querySelectorAll('#tabbar .tab').forEach((b) => {
      const on = b.dataset.view === curTab;
      b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
    });
  };
  // History steps carry their tab back with them.
  window.addEventListener('popstate', (e) => { const p = e.state?.p; if (p != null && tabAt[p]) curTab = tabAt[p]; }, true);
  // Desktop sidebar: a switch between sections, not a push.
  document.getElementById('nav')?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]'); if (!b) return;
    force = 'tab'; curTab = tabOf(b.dataset.view) || curTab;
  }, true);
  document.getElementById('tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    const tab = b.dataset.view;
    if (tab === 'search') { if (tab !== curTab) { force = 'tab'; curTab = tab; } return; } // app.js opens the search layer
    e.stopPropagation();
    if (tab === curTab) { // re-tap: scroll to the top first, then back to the tab's first page
      if (main.scrollTop > 1) Spring.animate({ from: main.scrollTop, to: 0, preset: 'smooth', onUpdate: (v) => (main.scrollTop = v) });
      else if (S.view !== tab) { force = 'pop'; go(tab); }
      return;
    }
    const t = tabs[tab] || { view: tab, arg: null, top: 0 };
    force = 'tab'; curTab = tab; tabTo = { tab, top: t.top };
    go(t.view, t.arg);
  }, true);

  // ---------- first reveal: sections fade up 8px, 30 ms apart, at most 6; never on back ----------
  if (window.FX?.enter) {
    const enterOrig = FX.enter;
    FX.enter = (el, o) => {
      if (el !== main || o?.selector) return enterOrig(el, o);
      if (off() || lastKind === 'pop' || lastKind === 'back' || lastKind === 'swipe' || lastKind === 'none') return;
      const { easing, ms } = Spring.css('smooth'), calm = html.dataset.motion === 'calm';
      [...main.children].slice(0, 6).forEach((it, i) => it.animate(
        calm ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: ms, easing, delay: i * 30, fill: 'backwards' }));
    };
  }

  // ---------- interactive back: drag the page right (touch only), release with velocity ----------
  const NOSWIPE = '.shelf-track, .shelf .cards, .quick-grid, .chips, input, textarea, select, .grip, [data-noswipe]';
  let raf = 0;
  main.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !e.isPrimary || swipe) return;
    if (kinds[NAV.p] !== 'push' || !(cache.has(NAV.p - 1) || anim) || OV.stack.length || NAV.skip || NAV.queue.length) return;
    const edge = e.clientX - main.getBoundingClientRect().left < 24;
    if (!edge && e.target.closest(NOSWIPE)) return;
    swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, dx: 0, t: Spring.tracker() };
  });
  main.addEventListener('pointermove', (e) => {
    const s = swipe; if (!s || e.pointerId !== s.id || s.done) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { swipe = null; return; }
      if (dx < 10 || dx < Math.abs(dy) * 1.2) return;
      if (!grab(s, e)) { swipe = null; return; }
    }
    s.dx = Math.max(0, s.base + dx - s.slop); s.t.add(s.dx);
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (swipe === s && !s.done) place(main, s.layer, 1 - s.dx / s.W, s.W); });
  });
  function grab(s, e) {
    let base = 0;
    if (anim?.kind === 'push') { // caught mid-push: hold the page where it is
      const a = anim; anim = null; a.spring.stop(); base = (1 - a.p) * main.offsetWidth;
      s.layer = a.under; s.fromPush = { p: NAV.p - 1, top: scrolls[NAV.p - 1] ?? 0 };
    } else {
      settle();
      const c = cache.get(NAV.p - 1); if (!c) return false;
      s.layer = c.el; main.after(c.el); c.el.scrollTop = c.top; stage(main, c.el);
    }
    s.on = true; s.W = main.offsetWidth; s.base = base; s.slop = e.clientX - s.x;
    main.setPointerCapture(e.pointerId);
    return true;
  }
  const release = (e) => {
    const s = swipe; if (!s || e.pointerId !== s.id || s.done) return;
    if (!s.on) { swipe = null; return; }
    s.done = true; cancelAnimationFrame(raf); raf = 0;
    const v = e.type === 'pointercancel' ? 0 : s.t.velocity(), p = 1 - s.dx / s.W;
    const commit = e.type !== 'pointercancel' && (s.dx > 0.35 * s.W || v > 500) && v > -300;
    const settleBack = () => { // the page stays: put the one underneath back in the cache
      unstage(); swipe = null;
      if (s.fromPush) keep(s.fromPush.p, s.layer, s.fromPush.top); else s.layer.remove();
    };
    run('release', main, s.layer, p, commit ? 0 : 1, -v / s.W, commit ? () => {
      s.committed = true; history.back(); // popstate -> go(prev, false) -> vt() swaps #main to the real page, same frame
      s.timer = setTimeout(() => { if (swipe === s) settleBack(); }, 900); // history never answered: undo
    } : settleBack);
  };
  main.addEventListener('pointerup', release);
  main.addEventListener('pointercancel', release);
  // While a page is held or flying home, taps don't navigate (they'd race the history step).
  document.addEventListener('click', (e) => { if (swipe?.on) { e.stopPropagation(); e.preventDefault(); } }, true);

  // ---------- Home: pulling down past the top rubber-bands and springs back ----------
  let rb = null;
  main.addEventListener('touchstart', (e) => {
    if (rbSpring) { rbSpring.stop(); rbSpring = null; main.style.translate = ''; }
    rb = html.dataset.view === 'home' && e.touches.length === 1 && !swipe && !anim && main.scrollTop <= 0
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false, d: 0, t: Spring.tracker() } : null;
  }, { passive: true });
  main.addEventListener('touchmove', (e) => {
    if (!rb) return;
    const t = e.touches[0], dy = t.clientY - rb.y, dx = t.clientX - rb.x;
    if (!rb.on) {
      if (dy <= 0 || Math.abs(dx) > dy || !e.cancelable || main.scrollTop > 0) { if (Math.abs(dx) + Math.abs(dy) > 6) rb = null; return; }
      rb.on = true; rb.y = t.clientY;
    }
    e.preventDefault();
    rb.d = Spring.rubber(Math.max(0, t.clientY - rb.y), 140); rb.t.add(rb.d);
    main.style.translate = `0 ${rb.d}px`;
  }, { passive: false });
  const rbEnd = () => {
    const r = rb; rb = null; if (!r?.on) return;
    rbSpring = Spring.animate({ from: r.d, to: 0, velocity: r.t.velocity(), preset: 'sheet', onUpdate: (y) => (main.style.translate = y ? `0 ${y}px` : ''), onDone: () => (rbSpring = null) });
  };
  main.addEventListener('touchend', rbEnd);
  main.addEventListener('touchcancel', rbEnd);

  // ---------- large title: the hero title collapses into a compact bar (scroll-linked in CSS) ----------
  const bar = document.createElement('div');
  bar.className = 'mn-bar'; bar.setAttribute('aria-hidden', 'true'); bar.hidden = true;
  bar.innerHTML = '<b class="mn-title"></b>';
  main.after(bar);
  const syncBar = () => {
    const h = main.querySelector(':scope > .hero h1');
    bar.hidden = !h; if (h) bar.firstChild.textContent = h.textContent;
    setScrolled();
  };
  // The frosted backing (header + compact bar) keys off a class, not a scroll timeline: Android WebView drew it at scroll 0.
  const setScrolled = () => app.classList.toggle('mn-scrolled', main.scrollTop > 4);
  main.addEventListener('scroll', setScrolled, { passive: true });
  new MutationObserver(syncBar).observe(main, { childList: true });
  syncBar();
  // fx.js grows the hero art out of the tapped tile; during a push the page itself slides in, so drop that morph.
  // Registered after fx.js boots (DOMContentLoaded), so this rAF runs after fx's in the same frame: no flash.
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => {
    if (anim?.kind === 'push') requestAnimationFrame(() => main.querySelectorAll(':scope > .hero > .hero-art, :scope > .hero > .hero-banner').forEach((h) => h.getAnimations().forEach((a) => a.cancel())));
  }).observe(main, { childList: true }), { once: true });
})();
