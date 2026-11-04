// visualizer: VISUAL_V4 ideas 7-9 for Now Playing. Loaded after motion-player.js; reuses app.js globals ($, $$, H, S,
// cur, cover, toast, desktop). The cover's 6-colour ramp (--vz-r1..6 on <html>), the ramp as soft bands behind the player
// with a liquid S-curve wipe on track change, the tappable hex pills, and a canvas visualizer (Pills / Bands / Blob).
// Audio is tapped with audio.captureStream(), never a MediaElementSource, so playback, background play and the Android
// media controls keep using #audio exactly as before; where captureStream is missing the visuals breathe on their own.
(() => {
  const SP = window.Spring;
  const np = $('#np'), npBg = $('#npBg'), npCover = $('#npCover'), audio = $('#audio');
  const full = () => H.dataset.motion === 'full';
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window */ } } };

  // ---------- album ramp: 6 colours, dark -> light ----------
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const DEFAULT = [[0, 18, 51], [2, 62, 125], [4, 102, 200], [92, 103, 125], [125, 133, 151], [151, 157, 172]]; // Deep Sea
  let ramp = DEFAULT.map((c) => hex(...c)), rampRGB = DEFAULT;
  const rampCache = new Map();
  // Full-screen washes sit under text, so they get a copy pushed dark (or light) enough for body text on top: 4.5:1+
  // (0.14 luminance under white ink is 5.5:1 before #npBg::after dims it further).
  const relLum = (c) => c.reduce((s, v, i) => { v /= 255; return s + [0.2126, 0.7152, 0.0722][i] * (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); }, 0);
  let safe = ramp;
  function makeSafe() {
    const dark = H.dataset.mode !== 'light', to = dark ? [0, 0, 0] : [255, 255, 255];
    safe = rampRGB.map((c) => { let k = 0, x = c; while (k < 1 && (dark ? relLum(x) > 0.14 : relLum(x) < 0.5)) { k += 0.05; x = mix(c, to, k); } return hex(...x); });
  }
  makeSafe();

  function loadPixels(url) {
    // same fallback as fx.js: a remote cover that taints the canvas goes through the same-origin /api/img proxy
    const proxy = /^https?:\/\//.test(url) && !url.startsWith(location.origin) ? `/api/img?u=${encodeURIComponent(url)}` : null;
    const load = (src, retry) => new Promise((res) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; img.decoding = 'async';
      const fail = () => res(retry ? load(retry, null) : null);
      img.onload = () => {
        try {
          const c = Object.assign(document.createElement('canvas'), { width: 32, height: 32 }), cx = c.getContext('2d', { willReadFrequently: true });
          cx.drawImage(img, 0, 0, 32, 32); res(cx.getImageData(0, 0, 32, 32).data);
        } catch { fail(); }
      };
      img.onerror = fail;
      img.src = src;
    });
    return load(url, proxy);
  }
  // Bucket the pixels (coarse RGB cube), keep the 6 most distinct big buckets, sort by lightness; fill gaps by blending.
  function makeRamp(px) {
    const bins = new Map();
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      const key = (px[i] >> 5) * 64 + (px[i + 1] >> 5) * 8 + (px[i + 2] >> 5);
      const b = bins.get(key) || [0, 0, 0, 0];
      b[0] += px[i]; b[1] += px[i + 1]; b[2] += px[i + 2]; b[3]++;
      bins.set(key, b);
    }
    const all = [...bins.values()].sort((a, b) => b[3] - a[3]).map((b) => [b[0] / b[3], b[1] / b[3], b[2] / b[3]]);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const picks = [];
    for (const c of all) { if (picks.every((p) => dist(p, c) > 48)) picks.push(c); if (picks.length === 6) break; }
    if (!picks.length) return null;
    picks.sort((a, b) => luma(a) - luma(b));
    while (picks.length < 6) { // split the widest gap
      let at = 0, gap = -1;
      for (let i = 0; i < picks.length - 1; i++) { const d = dist(picks[i], picks[i + 1]); if (d > gap) { gap = d; at = i; } }
      if (picks.length === 1) { picks.push(mix(picks[0], luma(picks[0]) > 128 ? [0, 0, 0] : [255, 255, 255], 0.5)); picks.sort((a, b) => luma(a) - luma(b)); continue; }
      picks.splice(at + 1, 0, mix(picks[at], picks[at + 1], 0.5));
    }
    return picks;
  }
  console.assert(makeRamp(new Uint8ClampedArray([10, 10, 10, 255, 250, 250, 250, 255])).length === 6, 'ramp fills to 6');

  let rampSeq = 0;
  async function updateRamp() {
    const t = cur(), url = t && cover(t), seq = ++rampSeq;
    if (!url) return;
    let rgb = rampCache.get(url);
    if (!rgb) { const px = await loadPixels(url); rgb = px && makeRamp(px); if (rgb) { rampCache.set(url, rgb); if (rampCache.size > 60) rampCache.delete(rampCache.keys().next().value); } }
    if (seq !== rampSeq || !rgb) return;
    rampRGB = rgb; ramp = rgb.map((c) => hex(...c)); makeSafe();
    ramp.forEach((c, i) => H.style.setProperty(`--vz-r${i + 1}`, c));
    paintPills();
    wipeBands();
    document.dispatchEvent(new CustomEvent('vz:ramp', { detail: [...ramp] }));
  }
  document.addEventListener('fx:palette', updateRamp);

  // ---------- ramp as soft bands behind the player; a liquid S-curve wipe brings the next album's colours in ----------
  const bands = document.createElement('div'); bands.className = 'vz-bands'; bands.setAttribute('aria-hidden', 'true');
  npBg.append(bands);
  const bandGrad = () => `linear-gradient(168deg, ${safe.map((c, i) => `${c} ${i * 16.6 + 3}% ${i * 16.6 + 13.6}%`).join(', ')})`;
  let wipe = null;
  function sCurve(k, dir, W, Hh) { // the new layer covers everything past an S-shaped edge that sweeps across
    const a = W * 0.22, X = W + 1.5 * a - k * (W + 3 * a), f = (x) => (dir > 0 ? x : W - x), e = dir > 0 ? W : 0;
    return `path("M${e} 0 L${f(X + a / 2)} 0 C${f(X - a)} ${Hh * 0.33} ${f(X + a)} ${Hh * 0.66} ${f(X - a / 2)} ${Hh} L${e} ${Hh} Z")`;
  }
  function wipeBands() {
    const layer = document.createElement('i');
    layer.style.background = bandGrad();
    bands.append(layer);
    const olds = [...bands.children].filter((c) => c !== layer), drop = () => olds.forEach((c) => c.remove());
    const d = window.MotionPlayer?.dir, dir = d && performance.now() - d.t < 2500 ? d.dir : 0;
    wipe?.stop(); wipe = null;
    if (!dir || np.hidden || document.hidden || H.dataset.motion === 'off') return drop();
    const W = bands.clientWidth, Hh = bands.clientHeight;
    layer.style.clipPath = sCurve(0, dir, W, Hh);
    wipe = SP.animate({ from: 0, to: 1, preset: 'smooth', onUpdate: (k) => (layer.style.clipPath = sCurve(k, dir, W, Hh)),
      onDone: () => { layer.style.clipPath = ''; wipe = null; drop(); } });
  }
  wipeBands();

  // ---------- top bar: tappable hex pills + the visualizer pick ----------
  const top = document.createElement('div'); top.className = 'vz-top';
  top.innerHTML = '<div class="vz-pills" role="group" aria-label="Album colours"></div><button class="vz-mode" type="button"></button>';
  np.append(top);
  const pills = $('.vz-pills', top), modeBtn = $('.vz-mode', top);
  function paintPills() {
    pills.innerHTML = ramp.map((c, i) => `<button type="button" style="--c:${c};--i:${i}" aria-label="Copy colour ${c}"><span>${c.toUpperCase()}</span></button>`).join('');
    pills.querySelectorAll('button').forEach((b, i) => b.style.color = luma(rampRGB[i]) > 140 ? '#111' : '#fff');
  }
  paintPills();
  pills.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!pills.classList.contains('open')) { pills.classList.add('open'); return; }
    if (!b) return pills.classList.remove('open');
    const c = b.querySelector('span').textContent;
    try { await navigator.clipboard.writeText(c); toast(`Copied ${c}`); } catch { toast(c); } // no clipboard: show it to copy by hand
    b.classList.remove('vz-copied'); void b.offsetWidth; b.classList.add('vz-copied');
  });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('.vz-pills')) pills.classList.remove('open'); }, true);

  const MODES = ['off', 'pills', 'bands', 'blob'], NAMES = { off: 'Visuals off', pills: 'Pills', bands: 'Bands', blob: 'Blob' };
  let mode = MODES.includes(store.get('ocm.viz')) ? store.get('ocm.viz') : 'pills';
  function paintMode() {
    modeBtn.textContent = NAMES[mode];
    modeBtn.dataset.mode = mode;
    modeBtn.setAttribute('aria-label', `Visualizer: ${NAMES[mode]}. Tap to change`);
    modeBtn.hidden = !full();
    np.dataset.vz = full() ? mode : 'off';
  }
  modeBtn.addEventListener('click', () => { mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; store.set('ocm.viz', mode); paintMode(); sync(); });
  paintMode();

  // ---------- audio tap: captureStream -> analyser (not connected to the speakers, so nothing is heard twice) ----------
  let ac = null, an = null, bins = null, stream = null, srcNode = null, srcTrack = null, tapFailed = false;
  function hook() {
    const t = stream?.getAudioTracks()[0];
    if (!t || t === srcTrack) return;
    try { srcNode?.disconnect(); srcNode = ac.createMediaStreamSource(new MediaStream([t])); srcNode.connect(an); srcTrack = t; }
    catch (err) { console.warn('visualizer: no audio tap', err); }
  }
  function tap() {
    if (an || tapFailed) return an;
    if (!audio.captureStream || !window.AudioContext) { tapFailed = true; return null; } // Safari, Firefox: breathe on our own
    try {
      ac = new AudioContext();
      an = ac.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.72;
      bins = new Uint8Array(an.frequencyBinCount);
      stream = audio.captureStream();
      stream.addEventListener('addtrack', hook);
      hook();
    } catch (err) { console.warn('visualizer: no audio tap', err); tapFailed = true; an = null; }
    return an;
  }
  audio.addEventListener('playing', () => { if (an) { hook(); if (running) ac.resume().catch(() => {}); } });
  // a context made before any tap starts suspended; the first tap while it is wanted wakes it
  document.addEventListener('pointerdown', () => { if (running && ac?.state === 'suspended') ac.resume().catch(() => {}); }, true);

  // 6 log-spaced bands (~90 Hz per bin at 48 kHz): bass first. Fast attack, slow release.
  const EDGES = [1, 3, 6, 11, 21, 42, 90];
  const energy = new Float32Array(6);
  let silentFor = 0;
  function listen(dt, t) {
    let sum = 0;
    if (an && ac.state === 'running') {
      an.getByteFrequencyData(bins);
      for (let i = 0; i < 6; i++) {
        let s = 0; for (let k = EDGES[i]; k < EDGES[i + 1]; k++) s += bins[k];
        const v = s / ((EDGES[i + 1] - EDGES[i]) * 255);
        sum += v;
        energy[i] = v > energy[i] ? v : energy[i] * Math.pow(0.05, dt);
      }
    }
    const playing = !audio.paused;
    silentFor = playing && sum < 0.01 ? silentFor + dt : 0;
    if (silentFor > 1.5 || (!an && playing)) // no data (no tap, or a tainted source): a soft made-up pulse
      for (let i = 0; i < 6; i++) energy[i] = 0.32 + 0.22 * Math.sin(t * (2.1 + i * 0.37) + i) * Math.max(0, Math.sin(t * 3.4));
    else if (!playing) for (let i = 0; i < 6; i++) energy[i] *= Math.pow(0.15, dt);
  }

  // ---------- canvas: drawn at half resolution behind the content; dimmed by #npBg::after for text contrast ----------
  const cv = document.createElement('canvas'); cv.className = 'vz-canvas'; cv.setAttribute('aria-hidden', 'true');
  npBg.append(cv);
  const g = cv.getContext('2d');
  const SCALE = 0.5;
  let W = 0, Hh = 0, art = { x: 0, y: 0, s: 0 }, running = false, raf = 0, last = 0;
  function measure() { // layout reads happen here, never inside the frame loop
    const r = np.getBoundingClientRect(), c = npCover.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * SCALE)); Hh = Math.max(1, Math.round(r.height * SCALE));
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    art = { x: (c.left - r.left + c.width / 2) * SCALE, y: (c.top - r.top + c.height / 2) * SCALE, s: Math.max(40, c.width * SCALE) };
  }
  new ResizeObserver(() => running && measure()).observe(np);

  function pillsMode(t) {
    // a stack from above the cover down to its bottom edge (never under the title), peeking out around it
    const n = 6, span = art.s * 1.1, ph = span / (1 + 0.74 * (n - 1)), step = ph * 0.74, y0 = art.y - art.s * 0.6 + ph / 2; // clear of the top buttons
    const breathe = 1 + energy[0] * 0.1;
    for (let i = n - 1; i >= 0; i--) { // treble on top, bass at the bottom; deep shades up top (under the white icons), light ones low
      const e = energy[n - 1 - i], w = Math.min(W * 0.98, Math.max(W * 0.62, art.s * 0.8) * (1 + e * 0.7) * breathe), h = ph;
      const x = art.x - w / 2, y = y0 + i * step - h / 2 + Math.sin(t * 1.3 + i) * 2;
      g.fillStyle = 'rgba(0,0,0,.28)'; pill(x + 2, y + 4, w, h);
      g.fillStyle = ramp[i]; pill(x, y, w, h);
    }
  }
  function pill(x, y, w, h) { const r = h / 2; g.beginPath(); g.moveTo(x + r, y); g.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2); g.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); g.fill(); }
  function bandsMode(t) {
    const n = 6, seg = 24;
    for (let i = 0; i < n; i++) {
      const base = Hh * (0.12 + i * 0.15), amp = Hh * (0.008 + energy[i] * 0.06);
      g.fillStyle = safe[i];
      g.beginPath(); g.moveTo(0, Hh);
      for (let s = 0; s <= seg; s++) {
        const x = (W * s) / seg;
        g.lineTo(x, base + amp * Math.sin(x / W * Math.PI * (2 + i * 0.5) + t * (1.2 + i * 0.3)) + amp * 0.5 * Math.sin(x / W * 9 - t * 2));
      }
      g.lineTo(W, Hh); g.closePath(); g.fill();
    }
  }
  function blobMode(t) {
    const bass = energy[0] * 0.7 + energy[1] * 0.3;
    // a big blob just past the cover's corners, and a smaller one orbiting it
    for (const [k, rr, spin, col, orbit] of [[0, 0.66, 0.25, [ramp[1], ramp[3]], 0], [1, 0.42, -0.4, [ramp[4], ramp[5]], 0.42]]) {
      const R = art.s * rr * (1 + bass * 0.25), pts = [];
      const cx = art.x + Math.cos(t * 0.5) * art.s * orbit, cy = art.y + Math.sin(t * 0.5) * art.s * orbit * 0.8;
      for (let j = 0; j < 10; j++) {
        const a = (j / 10) * Math.PI * 2 + t * spin, wob = 1 + energy[(j + k) % 6] * 0.22 * Math.sin(t * 2 + j * 1.7) + 0.06 * Math.sin(t + j);
        pts.push([cx + Math.cos(a) * R * wob, cy + Math.sin(a) * R * wob]);
      }
      const grd = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.2);
      grd.addColorStop(0, col[1]); grd.addColorStop(1, col[0]);
      g.fillStyle = grd; g.beginPath();
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(pts[9], pts[0]);
      g.moveTo(m0[0], m0[1]);
      for (let j = 0; j < 10; j++) { const p = pts[j], m = mid(p, pts[(j + 1) % 10]); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
      g.fill();
    }
  }
  const DRAW = { pills: pillsMode, bands: bandsMode, blob: blobMode };
  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016), t = now / 1000;
    last = now;
    listen(dt, t);
    g.clearRect(0, 0, W, Hh);
    DRAW[mode]?.(t);
    if (mode !== 'bands') { // full colour, but faded out before the title starts
      const cb = art.y + art.s / 2 + 4, fade = g.createLinearGradient(0, cb - art.s * 0.14, 0, cb);
      fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, '#000');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = fade; g.fillRect(0, cb - art.s * 0.14, W, Hh);
      g.globalCompositeOperation = 'source-over';
    }
    raf = requestAnimationFrame(frame);
  }

  // Runs only while it can be seen: player open, Motion Full, a mode picked, tab visible, and (on a phone) the Player tab.
  const wanted = () => full() && mode !== 'off' && !np.hidden && H.dataset.np === 'open' && !document.hidden && (desktop() || np.dataset.ptab === 'now');
  function sync() {
    paintMode();
    const on = wanted();
    if (on === running) return;
    running = on;
    np.classList.toggle('vz-on', on);
    if (on) {
      tap(); ac?.resume().catch(() => {});
      measure(); setTimeout(() => running && measure(), 500); // again once the open spring has settled
      last = performance.now(); raf = raf || requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf); raf = 0; g.clearRect(0, 0, W, Hh); energy.fill(0);
      ac?.suspend().catch(() => {}); // nothing to draw: let the audio thread sleep
    }
  }
  new MutationObserver(sync).observe(H, { attributes: true, attributeFilter: ['data-np', 'data-motion', 'data-layout'] });
  new MutationObserver(() => { makeSafe(); wipeBands(); }).observe(H, { attributes: true, attributeFilter: ['data-mode'] });
  new MutationObserver(() => { sync(); if (running) measure(); }).observe(np, { attributes: true, attributeFilter: ['hidden', 'data-ptab'] });
  document.addEventListener('visibilitychange', sync);
  sync();
  if (cur()) updateRamp();

  window.Visualizer = { get ramp() { return [...ramp]; }, get mode() { return mode; }, get energy() { return [...energy]; }, get tapped() { return !!srcTrack; } };
})();
