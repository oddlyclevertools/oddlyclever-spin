// Physics springs for every motion in the app (window.Spring). Classic script, loaded before fx.js and app.js.
// Springs are described like Apple's: response (seconds per oscillation) and damping ratio (1 = no bounce).
(() => {
  const PRESETS = {
    snappy: { response: 0.32, damping: 0.86 },  // buttons, small moves
    smooth: { response: 0.45, damping: 1 },     // page pushes, crossfades
    bouncy: { response: 0.5, damping: 0.72 },   // artwork, playful pops
    sheet: { response: 0.42, damping: 0.88 },   // full player, bottom sheets
    press: { response: 0.22, damping: 0.7 },    // press-down / release
  };
  const motion = () => document.documentElement.dataset.motion || 'full';
  const params = (name) => {
    const p = PRESETS[name] || PRESETS.smooth;
    return motion() === 'calm' ? { response: p.response, damping: 1 } : p;  // Calm: same speed, no bounce
  };

  // Remaining distance u(t) for a unit move (u(0) = 1), with v0 = starting speed toward the target in units/s.
  function curve({ response, damping }, v0 = 0) {
    const w0 = (2 * Math.PI) / response, z = Math.min(1, damping);
    if (z === 1) return (t) => Math.exp(-w0 * t) * (1 + (w0 - v0) * t);
    const wd = w0 * Math.sqrt(1 - z * z), b = (z * w0 - v0) / wd;
    return (t) => Math.exp(-z * w0 * t) * (Math.cos(wd * t) + b * Math.sin(wd * t));
  }
  function settleTime(u) {
    for (let t = 0.05; t < 3; t += 0.01) if (Math.abs(u(t)) < 0.001 && Math.abs(u(t + 0.01)) < 0.001) return t;
    return 3;
  }

  // CSS twin of a spring: a linear() easing plus its duration, for plain transitions and keyframes.
  function css(name) {
    const u = curve(params(name)), d = settleTime(u), n = 48;
    const pts = Array.from({ length: n + 1 }, (_, i) => +(1 - u((d * i) / n)).toFixed(4));
    return { easing: `linear(${pts.join(', ')})`, ms: Math.round(d * 1000) };
  }
  function writeTokens() {
    const root = document.documentElement.style;
    for (const name of Object.keys(PRESETS)) {
      const { easing, ms } = css(name);
      root.setProperty(`--spring-${name}`, easing);
      root.setProperty(`--spring-${name}-ms`, `${motion() === 'off' ? 0 : ms}ms`);
    }
  }

  // Animate a number from -> to, carrying the finger's velocity (units/s). Returns {stop, done}.
  function animate({ from, to, velocity = 0, preset = 'smooth', onUpdate, onDone }) {
    if (motion() === 'off' || from === to) { onUpdate?.(to); onDone?.(); return { stop() {}, done: Promise.resolve() }; }
    const span = to - from, u = curve(params(preset), velocity / span), end = settleTime(u);
    let raf = 0, stopped = false, resolve;
    const done = new Promise((r) => (resolve = r));
    const t0 = performance.now();
    const tick = (now) => {
      if (stopped) return;
      const t = (now - t0) / 1000;
      if (t >= end) { onUpdate?.(to); onDone?.(); resolve(); return; }
      onUpdate?.(to - span * u(t));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return { stop() { stopped = true; cancelAnimationFrame(raf); resolve(); }, done };
  }

  // Finger speed over the last 100 ms, in px/s.
  function tracker() {
    const pts = [];
    return {
      add(x, t = performance.now()) { pts.push([t, x]); while (pts.length > 2 && t - pts[0][0] > 100) pts.shift(); },
      velocity() {
        if (pts.length < 2) return 0;
        const [[ta, xa], [tb, xb]] = [pts[0], pts[pts.length - 1]];
        return tb > ta ? ((xb - xa) / (tb - ta)) * 1000 : 0;
      },
      reset() { pts.length = 0; },
    };
  }

  // iOS-style resistance past an edge: moves less and less the further you pull.
  const rubber = (offset, limit = 120) => Math.sign(offset) * limit * (1 - 1 / ((Math.abs(offset) * 0.55) / limit + 1));

  window.Spring = { PRESETS, curve, css, animate, tracker, rubber, writeTokens };
  writeTokens();
  // Re-write the tokens when the Motion setting changes (Full / Calm / Off).
  new MutationObserver(writeTokens).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
})();
