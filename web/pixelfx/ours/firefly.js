// Our own effect (not from pixelfx), written against its core: a few fireflies drifting on slow loops,
// each glowing up and fading on its own beat. Every rate is a whole number of cycles per loop, so it tiles.
import { fit, rand, TAU } from "../core/index.js";

export const meta = {
  name: "Fireflies",
  desc: "A handful of fireflies drift on slow loops, each glowing up and fading on its own beat.",
  tags: ["critter", "firefly", "night", "loop"],
  size: [160, 96],
  origin: [80, 48],
  duration: 8,
  loop: true,
  fps: 30,
  options: { palette: ["#1a2408", "#3a5212", "#7aa81e", "#c8f040", "#f4ffb8", "#ffffff"], seed: 5, count: 7 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6), u = t / meta.duration;
  for (let i = 0; i < o.count; i++) {
    const R = (k) => rand(o.seed, i, k);
    const x = (R(1) - 0.5) * 110 + 22 * Math.sin(TAU * (u * (1 + Math.floor(R(2) * 2)) + R(3)));
    const y = (R(4) - 0.5) * 60 + 12 * Math.sin(TAU * (u * (2 + Math.floor(R(5) * 2)) + R(6)));
    // mostly lit, with a dark spell each cycle (over a busy UI a firefly that is mostly dark just disappears)
    const g = 0.5 + 0.5 * Math.sin(TAU * (u * (2 + Math.floor(R(7) * 3)) + R(8)));
    p.px(x, y, g > 0.25 ? C[4] : C[2]);
    if (g < 0.25) continue;
    p.glow(x, y, 9, C[3], 1.4 * g);
    if (g > 0.7) p.px(x, y, C[5]);
    if (g > 0.45) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx, y + dy, C[3]);
  }
}
