// Pixel effects layer: small pixel-art bursts, critters and loaders from the vendored pixelfx library (web/pixelfx, MIT).
// window.PixelFX = { spawn(name, {x, y, el, palette, scale, loop}), critters(layerEl, {kinds, count, palette}), list(), level }.
// Hooks, all from this file: likes (wraps FX.burst), finished downloads (reads /api/jobs replies),
// stream loading (audio events) and critters inside the live background scene (html[data-scene]).
(() => {
  const BASE = new URL('pixelfx/', document.currentScript.src).href;
  const root = document.documentElement;
  const KEY = 'ocm.effects';

  // c = the art-space point (from the effect's origin) that sits on the target; once = seconds a loop plays as a one-shot;
  // back = draw the effect's back layer (off where it is a floor shadow); tint = how much the theme ramp replaces its colours.
  const EFFECTS = {
    bird: { src: 'fx/critters/bird.js', tint: 0.4 },
    butterfly: { src: 'fx/critters/butterfly.js', tint: 0.6 },
    fish: { src: 'fx/critters/fish-school.js', tint: 0.5 },
    firefly: { src: 'ours/firefly.js', tint: 0.3 },
    heart: { src: 'fx/pickups/heart-pickup.js', c: [0, -18], back: false, once: 1.3, tint: 1 },
    star: { src: 'fx/pickups/power-star.js', c: [0, -25], back: false, once: 1.6, tint: 1 },
    firework: { src: 'fx/explosions/firework-burst.js', c: [0, 0], tint: 1 },
    orb: { src: 'fx/pickups/xp-orb.js', c: [0, -20], back: false, tint: 1 },
  };
  const mods = {};
  let core = null;
  const load = (name) => (mods[name] ??= Promise.all([core ??= import(BASE + 'core/index.js'), import(BASE + EFFECTS[name].src)]));

  // ---------- level: Off / Subtle / Lively, capped by Motion and the OS ----------
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const pref = () => { try { return localStorage.getItem(KEY) || 'subtle'; } catch { return 'subtle'; } };
  function level() {
    const m = root.dataset.motion || 'full';
    if (m === 'off' || reduce.matches) return 'off';
    return m === 'calm' && pref() === 'lively' ? 'subtle' : pref();
  }
  const phone = () => matchMedia('(max-width: 600px), (pointer: coarse)').matches;
  const sz = (k) => k * (phone() ? 0.75 : 1); // CSS px per art px: a touch smaller on phones

  // ---------- colours: a dark-to-light ramp from the current accent pair (album colours when they're on) ----------
  const rgb = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(c.trim()) || /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c.trim());
    if (m && m.length === 2) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    if (m) return m.slice(1).map((h) => parseInt(h + h, 16));
    const n = c.match(/[\d.]+/g);
    return n && n.length >= 3 ? n.slice(0, 3).map(Number) : null;
  };
  const toHex = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  function themeRamp() {
    const cs = getComputedStyle(root);
    const a = rgb(cs.getPropertyValue('--accent') || '') || [120, 140, 255], b = rgb(cs.getPropertyValue('--accent-2') || '') || mix(a, [255, 255, 255], 0.4);
    const K = [0, 0, 0], W = [255, 255, 255];
    return [mix(K, a, 0.12), mix(K, a, 0.3), mix(K, a, 0.6), a, mix(a, b, 0.5), b, mix(b, W, 0.55), W];
  }
  // the effect's own ramp, pulled towards the theme ramp by k (resampled to the same length)
  function tinted(def, k) {
    if (!def || k <= 0) return null;
    const ramp = themeRamp(), d = def.map(rgb);
    return d.map((c, i) => toHex(mix(c, ramp[Math.round((i / Math.max(1, d.length - 1)) * (ramp.length - 1))], k)));
  }

  // ---------- one rAF loop for every live instance ----------
  const live = new Set();
  let raf = 0, last = 0;
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    for (const it of live) it.step(dt);
    raf = live.size ? requestAnimationFrame(tick) : 0;
  }
  const kick = () => { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); });

  // device-pixel-exact scale, so every art pixel is a whole number of screen pixels
  const snap = (k) => Math.max(1, Math.round(k * devicePixelRatio)) / devicePixelRatio;
  const px = (v) => Math.round(v * devicePixelRatio) / devicePixelRatio;

  // A canvas showing one effect instance. pos() gives where its target point sits (client px or layer px).
  function instance(name, o, host, pos) {
    const spec = EFFECTS[name], it = { el: null, fx: null, stopped: false, gone: false };
    it.stop = () => { it.stopped = true; it.fx?.stop(); if (!it.fx) it.kill(); };
    it.kill = () => { it.gone = true; live.delete(it); it.el?.remove(); };
    load(name).then(([C, mod]) => {
      if (it.gone) return;
      const [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin, [cx, cy] = spec.c || [0, 0];
      const palette = o.palette || tinted(mod.meta.options?.palette, spec.tint ?? 1);
      const fx = C.createFx(mod, { x: ox, y: oy, flip: !!o.flip, seed: (Math.random() * 1e6) | 0, ...(palette && { palette }) });
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h; cv.className = 'pfx-cv';
      const s = snap(o.scale || 1);
      cv.style.width = w * s + 'px'; cv.style.height = h * s + 'px';
      const ctx = cv.getContext('2d'), frame = C.createFrame(w, h), img = ctx.createImageData(w, h);
      const fps = mod.meta.fps || 30, back = spec.back !== false;
      let acc = 1, t = 0;
      it.fx = fx; it.el = cv; it.flip = !!o.flip;
      it.step = (dt) => {
        if (it.paused?.()) return;
        t += dt;
        if (spec.once && !o.loop && t >= spec.once) fx.stop();
        fx.update(dt);
        if (fx.done()) return it.kill();
        const [x, y] = pos(dt, it);
        cv.style.transform = `translate(${px(x - (ox + cx) * s)}px, ${px(y - (oy + cy) * s)}px)`;
        if ((acc += dt) < 1 / fps) return;
        acc = 0;
        C.clearFrame(frame);
        if (back) fx.draw(frame); else fx.draw(frame, 'front');
        C.composite(frame, img.data, null);
        ctx.putImageData(img, 0, 0);
      };
      it.step(0);
      host.appendChild(cv);
      if (it.stopped) fx.stop();
      live.add(it); kick();
    }).catch((e) => { console.warn('PixelFX: could not load', name, e); it.kill(); });
    return it;
  }

  // ---------- one-shots and loops on screen ----------
  let overlay = null;
  const layer = () => {
    if (!overlay?.isConnected) { overlay = document.createElement('div'); overlay.className = 'pfx-overlay'; overlay.setAttribute('aria-hidden', 'true'); document.body.appendChild(overlay); }
    return overlay;
  };
  const centre = (el) => { const r = el.getBoundingClientRect(); return r.width || r.height ? [r.left + r.width / 2, r.top + r.height / 2] : null; };
  const NOOP = { stop() {} };

  /** A burst (or, with loop: true, a loop until stop()) at {x, y} in client px, or following an element's centre. */
  function spawn(name, o = {}) {
    if (!EFFECTS[name] || level() === 'off') return NOOP;
    let at = o.el ? centre(o.el) : [o.x ?? innerWidth / 2, o.y ?? innerHeight / 2];
    if (!at) return NOOP;
    const it = instance(name, { scale: sz(2), ...o }, layer(), () => {
      if (o.el && o.el.isConnected) at = centre(o.el) || at; // follow it while it moves (sheet opening, scroll)
      return at;
    });
    return { stop: () => it.stop() };
  }

  // ---------- critters: little animals wandering a layer ----------
  const PATHS = {
    // across the top, flipping to face where it's going; a long pause off-screen between passes
    bird: { y: [0.08, 0.4], speed: [34, 52], bob: 6, cross: true },
    fish: { y: [0.6, 0.85], speed: [14, 22], bob: 3, cross: true },
    // the rest wander round a slow figure of eight over one spot
    butterfly: { y: [0.3, 0.75], speed: [10, 16], bob: 18 },
    firefly: { y: [0.45, 0.85], speed: [4, 8], bob: 8 },
  };
  const rnd = ([a, b]) => a + Math.random() * (b - a);

  /** Critters living in layerEl (should be positioned). Returns { stop() }. */
  function critters(layerEl, o = {}) {
    const kinds = (o.kinds || ['butterfly']).filter((k) => PATHS[k]), want = Math.min(o.count ?? 2, 6);
    if (!kinds.length || !want) return NOOP;
    const box = document.createElement('div');
    box.className = 'pfx-critters'; box.setAttribute('aria-hidden', 'true');
    layerEl.appendChild(box);
    const its = [];
    const scale = o.scale ?? (phone() ? 1 : 1.25); // small: they live in the background
    for (let i = 0; i < want; i++) {
      const kind = kinds[i % kinds.length], P = PATHS[kind];
      const st = { vx: 0, t: Math.random() * 10, wait: i * 2.5 + Math.random() * 2 };
      const place = (first) => {
        const W = box.clientWidth || innerWidth, H = box.clientHeight || innerHeight, dir = Math.random() < 0.5 ? 1 : -1;
        st.base = rnd(P.y) * H; st.speed = rnd(P.speed);
        if (P.cross) { st.vx = dir * st.speed; st.x = dir > 0 ? -90 : W + 90; }
        else { st.cx = (0.15 + Math.random() * 0.7) * W; if (first) st.wait = 0; }
      };
      place(true);
      const it = instance(kind, { scale, palette: o.palette, flip: st.vx < 0, loop: true }, box, (dt, me) => {
        const W = box.clientWidth || innerWidth;
        st.t += dt;
        if (st.wait > 0) { st.wait -= dt; return [-9999, -9999]; }
        if (P.cross) {
          st.x += st.vx * dt;
          if ((st.vx > 0 && st.x > W + 100) || (st.vx < 0 && st.x < -100)) { place(); st.wait = 4 + Math.random() * 8; if (me.fx && (st.vx < 0) !== me.flip) { me.flip = st.vx < 0; me.fx.options.flip = me.flip; } }
          return [st.x, st.base + P.bob * Math.sin(st.t * 1.3)];
        }
        return [st.cx + st.speed * 4 * Math.sin(st.t * 0.11), st.base + P.bob * Math.sin(st.t * 0.23)];
      });
      it.paused = () => !!document.querySelector('.scn-paused'); // the scene paused itself (hidden or idle)
      its.push(it);
    }
    return { stop() { its.forEach((it) => it.stop()); setTimeout(() => box.remove(), 400); } };
  }

  // ---------- hook: critters in the live background scene ----------
  const SCENE_KINDS = {
    aurora: ['firefly', 'fish'], lighthouse: ['fish'], watchtower: ['firefly'], windmill: ['bird', 'butterfly'],
    deer: ['firefly', 'butterfly'], desert: ['firefly'], peaks: ['bird'], city: ['bird'],
  };
  let herd = null, herdKey = '';
  function syncCritters() {
    const lv = level(), id = root.dataset.scene, host = document.querySelector('.scn-bg');
    const key = id && host && lv !== 'off' ? `${id}|${lv}|${phone()}` : '';
    if (key === herdKey && (!herd || herd.host === host)) return;
    herd?.stop(); herd = null; herdKey = key;
    if (!key) return;
    const count = lv === 'lively' ? 2 : 1;
    // over the scene's scrim (under it they'd be lost), toned down in effects.css
    let mount = host.querySelector('.pfx-scene');
    if (!mount) { mount = document.createElement('div'); mount.className = 'pfx-scene'; host.appendChild(mount); }
    herd = critters(mount, { kinds: SCENE_KINDS[id] || ['butterfly'], count });
    herd.host = host;
  }
  new MutationObserver(syncCritters).observe(root, { attributes: true, attributeFilter: ['data-scene', 'data-motion'] });
  reduce.addEventListener?.('change', syncCritters);

  // ---------- hook: like (app.js calls FX.burst(btn, { kind: 'heart' }) when a song is liked) ----------
  function wrapBurst() {
    const F = window.FX;
    if (!F?.burst) return;
    const orig = F.burst;
    F.burst = function (el, o) {
      const r = orig.apply(this, arguments);
      if (o?.kind === 'heart' && el) spawn('heart', { el, scale: sz(level() === 'lively' ? 2 : 1.5) });
      return r;
    };
  }

  // ---------- hook: finished downloads (diff of the /api/jobs replies app.js already polls) ----------
  const doneIds = new Set();
  let seeded = false;
  const nativeFetch = window.fetch;
  window.fetch = function (input) {
    const p = nativeFetch.apply(this, arguments);
    const url = typeof input === 'string' ? input : input?.url || '';
    if (/\/api\/jobs(\?|$)/.test(url)) p.then((r) => r.clone().json()).then(onJobs).catch(() => {});
    return p;
  };
  function onJobs(jobs) {
    if (!Array.isArray(jobs)) return;
    const fresh = jobs.filter((j) => j.status === 'done' && !doneIds.has(j.id));
    fresh.forEach((j) => doneIds.add(j.id));
    if (!seeded) { seeded = true; return; } // the first reply is history, not news
    if (fresh.length) downloaded();
  }
  const visible = (sel) => [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight; });
  function downloaded() {
    const tab = visible('[data-view="downloads"], #tab-downloads');
    spawn('star', tab ? { el: tab, scale: sz(1.5) } : { y: innerHeight * 0.3 });
    if (level() !== 'lively') return;
    const r = (visible('#main') || document.body).getBoundingClientRect();
    spawn('firework', { x: r.left + r.width / 2, y: r.top + Math.min(r.height, innerHeight) * 0.4 });
  }

  // ---------- hook: a pixel loop while a song is loading ----------
  const playBtn = () => {
    const all = [...document.querySelectorAll('#play, #npPlay, [data-act="play"]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.top < innerHeight && r.bottom > 0; });
    return all.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  };
  let loader = null, loadT = 0;
  function hookAudio() {
    const a = document.getElementById('audio');
    if (!a) return;
    for (const ev of ['play', 'waiting', 'loadstart', 'stalled']) a.addEventListener(ev, () => maybeLoading(a));
    for (const ev of ['playing', 'pause', 'error', 'emptied']) a.addEventListener(ev, stopLoading);
  }
  function maybeLoading(a) {
    clearTimeout(loadT);
    loadT = setTimeout(() => {
      if (a.paused || a.readyState >= 3 || loader) return;
      const b = playBtn();
      if (b) loader = spawn('orb', { el: b, loop: true, scale: sz(2) });
    }, 300); // local files are ready before this, so only slow streams get the loop
  }
  function stopLoading() { clearTimeout(loadT); loader?.stop(); loader = null; }

  // ---------- settings: Off / Subtle / Lively, in the Motion & effects slot ----------
  function picker() {
    const dlg = document.getElementById('settings');
    if (!dlg || document.getElementById('pfxPick')) return;
    const sec = document.createElement('div');
    sec.className = 'set-pref'; sec.id = 'pfxPick';
    sec.innerHTML = '<div class="set-pref-text"><span class="set-lbl" id="pfxTitle">Effects</span><p class="hint" id="pfxHint"></p></div><div class="seg" role="radiogroup" aria-labelledby="pfxTitle">' +
      ['off', 'subtle', 'lively'].map((v) => `<button type="button" role="radio" aria-checked="false" data-pfx-pick="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('') + '</div>';
    (document.getElementById('setFxSlot') || dlg.querySelector('.dlg-card') || dlg).appendChild(sec);
    sec.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pfx-pick]');
      if (!b) return;
      try { localStorage.setItem(KEY, b.dataset.pfxPick); } catch { /* private window: the choice just won't stick */ }
      paint(); syncCritters();
    });
    paint();
  }
  function paint() {
    const p = pref(), lv = level();
    document.querySelectorAll('[data-pfx-pick]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.pfxPick === p)));
    const h = document.getElementById('pfxHint');
    if (h) h.textContent = lv === 'off' && p !== 'off' ? 'Paused while Motion is off.' : lv !== p ? 'Kept subtle while Motion is Calm.' : 'Tiny pixel hearts and stars, and critters in live backgrounds.';
  }
  document.addEventListener('fx:settings', () => { paint(); syncCritters(); });
  reduce.addEventListener?.('change', paint);

  window.PixelFX = { spawn, critters, list: () => Object.keys(EFFECTS), get level() { return level(); } };

  const start = () => { wrapBurst(); hookAudio(); picker(); syncCritters(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
