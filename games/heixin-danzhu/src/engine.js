// ===== Pachinko physics engine (pure, no DOM) =====
const W = 360, H = 520;
const G = 620;
const BR = 6;
const B = { L: 12, R: 348, cx: 180, cy: 172, dr: 168, laneX: 326, laneTop: 150, bottom: 504, slotTop: 440 };
const SLOT_N = 9;
const SLOT_W = (B.laneX - B.L) / SLOT_N;
const PRIZES = [0, 1, 0, 3, 8, 3, 0, 1, 0];
const PEG_R = 3;

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function buildPegs() {
  const pegs = [];
  for (let r = 0; r < 8; r++) {
    const y = 196 + r * 31;
    if (r % 2 === 0) {
      for (let i = 0; i <= 9; i++) {
        let x = B.L + i * SLOT_W;
        if (i === 0) x = B.L + 4; if (i === 9) x = B.laneX - 4;
        pegs.push({ x, y });
      }
    } else {
      for (let i = 0; i < 9; i++) pegs.push({ x: B.L + (i + 0.5) * SLOT_W, y });
    }
  }
  return pegs;
}
function buildSegs() {
  const s = [{ x1: B.laneX, y1: B.laneTop, x2: B.laneX, y2: B.bottom }];
  for (let i = 1; i < SLOT_N; i++) { const x = B.L + i * SLOT_W; s.push({ x1: x, y1: B.slotTop, x2: x, y2: B.bottom }); }
  return s;
}

function createWorld(seed) {
  return {
    rng: makeRng(seed || 12345), pegs: buildPegs(), segs: buildSegs(),
    balls: [], mechs: [], events: [], nextId: 1, magnetTime: 0, t: 0,
  };
}

function launchBall(w, power) {
  const p = power != null ? power : 690 + w.rng() * 230;
  const b = { id: w.nextId++, x: (B.laneX + B.R) / 2, y: B.bottom - BR - 12, vx: (w.rng() - 0.5) * 6, vy: -p, mt: {}, trail: [], age: 0, inLane: true };
  w.balls.push(b);
  return b;
}

function collideCircle(b, px, py, pr, e, w) {
  const dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy, m = BR + pr;
  if (d2 >= m * m || d2 === 0) return 0;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = px + nx * m; b.y = py + ny * m;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    const j = (w.rng() - 0.5) * 36; b.vx += -ny * j; b.vy += nx * j;
    return -vn;
  }
  return 0;
}

function collideSeg(b, s, e, w) {
  const ex = s.x2 - s.x1, ey = s.y2 - s.y1;
  let t = ((b.x - s.x1) * ex + (b.y - s.y1) * ey) / (ex * ex + ey * ey);
  t = Math.max(0, Math.min(1, t));
  return collideCircle(b, s.x1 + ex * t, s.y1 + ey * t, 1.5, e, w);
}

function stepWorld(w, dt) {
  const sub = 4, h = dt / sub;
  for (let k = 0; k < sub; k++) substep(w, h);
  for (const m of w.mechs) { if (m.cd > 0) m.cd -= dt; if (m.anim > 0) m.anim -= dt; }
  w.t += dt;
}

function substep(w, h) {
  const balls = w.balls;
  for (const b of balls) {
    let ax = 0, ay = G;
    for (const m of w.mechs) {
      if (m.type !== 'magnet') continue;
      const dx = m.x - b.x, dy = m.y - b.y, d = Math.hypot(dx, dy);
      const used = b.mt[m.id] || 0;
      if (d < 66 && used < 1.1 && b.y > B.laneTop - 10 && b.x < B.laneX) {
        const f = 1500 * (1 - d / 66) + 260;
        ax += dx / (d + 0.01) * f; ay += dy / (d + 0.01) * f;
        b.mt[m.id] = used + h; w.magnetTime += h; m.usedT = (m.usedT || 0) + h;
        b.vx *= 0.995; b.vy *= 0.995;
      }
    }
    b.vx += ax * h; b.vy += ay * h;
    const sp = Math.hypot(b.vx, b.vy); if (sp > 1100) { b.vx *= 1100 / sp; b.vy *= 1100 / sp; }
    b.x += b.vx * h; b.y += b.vy * h; b.age += h;
  }
  for (const b of balls) {
    // dome
    if (b.y < B.cy) {
      const dx = b.x - B.cx, dy = b.y - B.cy, d = Math.hypot(dx, dy), lim = B.dr - BR;
      if (d > lim) {
        const nx = dx / d, ny = dy / d; b.x = B.cx + nx * lim; b.y = B.cy + ny * lim;
        const vn = b.vx * nx + b.vy * ny; if (vn > 0) { b.vx -= 1.25 * vn * nx; b.vy -= 1.25 * vn * ny; }
      }
    }
    if (b.x < B.L + BR) { b.x = B.L + BR; if (b.vx < 0) b.vx = -b.vx * 0.4; }
    if (b.x > B.R - BR) { b.x = B.R - BR; if (b.vx > 0) b.vx = -b.vx * 0.4; }
    if (b.inLane && b.y < B.laneTop - BR) b.inLane = false;
    if (b.y > 170 && b.y < B.slotTop + 10) for (const p of w.pegs) {
      const v = collideCircle(b, p.x, p.y, PEG_R, 0.5, w);
      if (v > 70) w.events.push({ type: 'hit', v });
    }
    for (const s of w.segs) if (b.y > s.y1 - 10) collideSeg(b, s, 0.3, w);
    // fists
    for (const m of w.mechs) {
      if (m.type !== 'fist' || m.cd > 0) continue;
      if (Math.hypot(b.x - m.x, b.y - m.y) < 20) {
        b.vx = m.dir * 380; b.vy = Math.min(b.vy, -40) - 90;
        m.cd = 0.8; m.anim = 0.25; w.events.push({ type: 'fist', mech: m, x: m.x, y: m.y });
      }
    }
  }
  // ball-ball
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], c = balls[j]; const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy;
    if (d2 < 4 * BR * BR && d2 > 0) {
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, o = (2 * BR - d) / 2;
      a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rv < 0) { const j2 = -0.9 * rv; a.vx -= j2 * nx; a.vy -= j2 * ny; c.vx += j2 * nx; c.vy += j2 * ny; }
    }
  }
  // scoring / reload
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.y >= B.bottom - BR - 0.5) {
      if (b.x < B.laneX) {
        const slot = Math.max(0, Math.min(SLOT_N - 1, Math.floor((b.x - B.L) / SLOT_W)));
        balls.splice(i, 1); w.events.push({ type: 'score', slot, prize: PRIZES[slot], x: B.L + (slot + 0.5) * SLOT_W, ball: b });
      } else if (b.vy > 0) {
        balls.splice(i, 1); w.events.push({ type: 'reload', ball: b });
      }
    } else if (b.age > 25) { balls.splice(i, 1); w.events.push({ type: 'stuck', ball: b }); }
  }
}

function slapTable(w) {
  for (const b of w.balls) { if (b.inLane) continue; b.vy = -(260 + w.rng() * 220); b.vx += (w.rng() - 0.5) * 320; }
}
// ===== end engine =====
