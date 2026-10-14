(() => {
const $ = s => document.querySelector(s);
const PRICE = 2, DAY_LEN = 70, MAX_MECH = 5, PATROL = [0.45, 0.62];
const rent = d => 12 + 8 * (d - 1);
const MECH = {
  fist: { name: '弹簧拳头', price: 10, desc: '放在钉阵里，弹珠路过时一拳打飞。点一下已放好的拳头可以换朝向。每出一拳，嫌疑 +3。' },
  magnet: { name: '磁铁', price: 14, desc: '把附近的弹珠吸过去，放在「谢谢惠顾」上方最好用。吸住弹珠时嫌疑会持续上涨。' },
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- pixel sprites ----------
function paint(cv, map, pal) {
  const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  map.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) { c.fillStyle = pal[ch]; c.fillRect(x, y, 1, 1); } }));
}
const BOSS = ['...kkkkkk...', '..kkkkkkkk..', '.kkssssssskk', '.kssssssssk.', '.gggggggggg.', '.gwggsggwgg.', '.ssssnsssss.', '.ssmmmmmmss.', '..ssswwsss..', '...ssssss...', '.bbbyyyybbb.', 'bbbbbbbbbbbb'];
const BOSS_PAL = { k: '#2a1a14', s: '#e7a46b', g: '#141018', w: '#ffffff', n: '#c97f4b', m: '#7a2a1f', b: '#2f5f9e', y: '#f2c94c' };
const GIRL = ['kk.kkkk.kk', 'kkkkkkkkkk', '.kssssssk.', '.sgssssgs.', '.ssssssss.', '.spsmmsps.', '..ssssss..', '.rrrrrrrr.', 'rrrrrrrrrr', 'rrrrrrrrrr'];
const BOY = ['..kkkkkk..', '.kkkkkkkk.', '.kssssssk.', '.sgssssgs.', '.ssssssss.', '.sssmmsss.', '..ssssss..', '.bbbbbbbb.', 'bbbbbbbbbb', 'bbbbbbbbbb'];
const KID_PAL = { k: '#2a1a14', s: '#f0b989', g: '#141018', p: '#f08a9a', m: '#7a2a1f', r: '#d8566b', b: '#4f86c6' };
paint($('#avatar'), BOSS, BOSS_PAL);
function kidURL(map) { const c = document.createElement('canvas'); c.width = 10; c.height = 10; paint(c, map, KID_PAL); return c.toDataURL(); }
const KIDS = [kidURL(GIRL), kidURL(BOY)];

// ---------- state ----------
let S;
function bestDay() { try { return +localStorage.getItem('pachinko-best') || 0; } catch (e) { return 0; } }
function saveBest(d) { try { if (d > bestDay()) localStorage.setItem('pachinko-best', d); } catch (e) {} }
function newGame() {
  S = { money: 66, pop: 50, sus: 0, day: 1, t: 0, phase: 'start', speed: 1, paused: false, queue: [], arriveT: 0.6, launchCD: 0.5,
    slapCD: 0, placing: null, floats: [], shake: 0, shakeDur: 1, shakeAmp: 0, flash: 0, mechId: 1, world: createWorld((Date.now() % 99991) + 1), lastMag: 0, ghost: null, stats: null };
  resetStats(); renderQueue();
}
function resetStats() { S.stats = { income: 0, payout: 0, spend: 0, balls: 0, big: 0 }; }
const watchers = () => Math.max(1, Math.round(S.pop / 12));
const inPatrol = () => S.phase === 'open' && S.t / DAY_LEN >= PATROL[0] && S.t / DAY_LEN < PATROL[1];
function addSus(v) { const mult = (0.6 + watchers() * 0.12) * (inPatrol() ? 2 : 1); S.sus = Math.min(100, S.sus + v * mult); }
function float(x, y, text, color, size) { S.floats.push({ x, y, text, color, size: size || 13, life: 1.2 }); }
function shake(dur, amp) {
  S.shake = dur; S.shakeDur = dur; S.shakeAmp = reduceMotion ? Math.min(amp, 3) : amp; S.flash = Math.max(S.flash, amp >= 10 ? 0.16 : 0.06);
  if (amp >= 10 && !reduceMotion) { const a = $('#app'); a.classList.remove('jolt'); void a.offsetWidth; a.classList.add('jolt'); }
}
function haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

// ---------- loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!S.paused && (S.phase === 'open' || S.phase === 'closing')) {
    acc += dt * S.speed;
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; }
  } else acc = 0;
  for (const f of S.floats) f.life -= dt; S.floats = S.floats.filter(f => f.life > 0);
  if (S.shake > 0) S.shake -= dt;
  if (S.flash > 0) S.flash -= dt;
  draw(); hud();
  requestAnimationFrame(frame);
}

function update(dt) {
  const w = S.world;
  if (S.phase === 'open') {
    S.t += dt;
    if (S.t >= DAY_LEN) { S.phase = 'closing'; if (S.queue.length) float(B.cx, 120, `${S.queue.length} 位顾客没轮上，走了`, '#f6e7c8', 12); S.queue = []; renderQueue(); }
    if (S.pop > 0) {
      S.arriveT -= dt;
      if (S.arriveT <= 0) {
        if (S.queue.length < 6) { S.queue.push(Math.random() < 0.5 ? 0 : 1); renderQueue(); }
        S.arriveT = Math.max(0.9, 3.0 - S.pop * 0.022) * (0.6 + Math.random() * 0.8);
      }
    }
    S.launchCD -= dt;
    if (S.queue.length && w.balls.length < 3 && S.launchCD <= 0) {
      S.queue.shift(); renderQueue();
      S.money += PRICE; S.stats.income += PRICE; S.stats.balls++;
      launchBall(w); float(B.laneX - 4, B.bottom - 30, '+¥2', '#9be36b', 12);
      S.launchCD = 1.0;
    }
  }
  stepWorld(w, dt);
  for (const ev of w.events) {
    if (ev.type === 'score') {
      if (ev.prize > 0) {
        S.money -= ev.prize; S.stats.payout += ev.prize;
        S.pop += ev.prize === 8 ? 6 : ev.prize === 3 ? 2 : 1;
        if (ev.prize === 8) { S.stats.big++; shake(0.25, 6); haptic(30); }
        float(ev.x, B.slotTop - 6, `赔 ¥${ev.prize}`, ev.prize === 8 ? '#ff6b5a' : '#f2c94c', ev.prize === 8 ? 16 : 13);
      } else { S.pop -= 1.5; float(ev.x, B.slotTop - 6, '嘿嘿', '#c9b49a', 12); }
    } else if (ev.type === 'fist') { addSus(3); float(ev.x, ev.y - 16, '嫌疑+', '#ff8a7a', 11); }
    else if (ev.type === 'reload') launchBall(w);
  }
  w.events.length = 0;
  const magDelta = w.magnetTime - S.lastMag; S.lastMag = w.magnetTime;
  if (magDelta > 0) addSus(magDelta * 4);
  S.sus = Math.max(0, S.sus - 2 * dt);
  S.pop = Math.max(0, Math.min(100, S.pop));
  if (S.slapCD > 0) S.slapCD -= dt;
  if (S.sus >= 100) return gameOver('caught');
  if (S.phase === 'closing' && w.balls.length === 0) endDay();
}

// ---------- day flow ----------
function startDay() { S.phase = 'open'; S.t = 0; S.arriveT = 0.6; S.launchCD = 0.5; resetStats(); $('#ovDay').hidden = true; $('#ovStart').hidden = true; }
function endDay() {
  const r = rent(S.day); S.money -= r; S.phase = 'summary';
  const st = S.stats, net = st.income - st.payout - st.spend - r;
  $('#dayTitle').textContent = `第 ${S.day} 天 收摊`;
  const row = (k, v, cls) => `<span class="${cls || ''}">${k}</span><span class="v ${cls || ''}">${v}</span>`;
  $('#ledger').innerHTML =
    row(`弹珠收入（${st.balls} 颗）`, `+¥${st.income}`, 'plus') + row(`赔出去的奖（大奖 ${st.big} 次）`, `-¥${st.payout}`, 'minus') +
    row('买机关', `-¥${st.spend}`, 'minus') + row('摊位费', `-¥${r}`, 'minus') +
    row('今天净赚', `${net >= 0 ? '+' : '-'}¥${Math.abs(net)}`, 'total ' + (net >= 0 ? 'plus' : 'minus')) + row('手里还剩', `¥${S.money}`, 'total');
  if (S.money < 0) { gameOver('broke'); return; }
  saveBest(S.day);
  $('#dayNote').textContent = `明天摊位费 ¥${rent(S.day + 1)}。机关会留在台子上。人气 ${Math.round(S.pop)}，嫌疑过一夜清零。`;
  $('#ovDay').hidden = false; $('#nextBtn').focus();
}
function nextDay() { S.day++; S.sus = 0; S.lastMag = S.world.magnetTime; startDay(); }
function gameOver(kind) {
  S.phase = 'over'; saveBest(S.day - (kind === 'broke' ? 1 : 0));
  $('#ovDay').hidden = true;
  $('#overTitle').textContent = kind === 'caught' ? '摊子被掀了' : '交不起摊位费，破产了';
  $('#overText').textContent = kind === 'caught'
    ? `第 ${S.day} 天，围观的人看出了门道，一拥而上把你的弹珠台掀了。最后手里 ¥${S.money}。`
    : `第 ${S.day} 天收摊，摊位费交完还欠 ¥${-S.money}。少买点机关，或者多让顾客中几次奖留住人气。`;
  $('#ovOver').hidden = false; $('#againBtn').focus();
}

// ---------- controls ----------
function slap() {
  if (S.phase !== 'open' && S.phase !== 'closing') return;
  if (S.slapCD > 0) return;
  shake(0.45, 14); haptic([40, 30, 70]);
  if (!S.world.balls.some(b => !b.inLane)) { float(B.cx, 250, '台上没珠子，白拍了', '#f6e7c8', 14); return; }
  slapTable(S.world); addSus(14); S.pop = Math.max(0, S.pop - 2); S.slapCD = 5;
  float(B.cx, 250, '啪！', '#ffffff', 28);
}
$('#slap').addEventListener('click', slap);
$('#speed').addEventListener('click', () => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; $('#speed').textContent = `${S.speed} 倍速`; });
$('#pause').addEventListener('click', togglePause);
function togglePause() { S.paused = !S.paused; $('#pause').textContent = S.paused ? '▶' : '❚❚'; $('#pause').setAttribute('aria-label', S.paused ? '继续' : '暂停'); }
document.addEventListener('keydown', e => { if (e.code === 'Space' && S.phase !== 'start') { e.preventDefault(); togglePause(); } if (e.key === 'Escape') setPlacing(null); });
$('#startBtn').addEventListener('click', startDay);
$('#nextBtn').addEventListener('click', nextDay);
$('#againBtn').addEventListener('click', () => { $('#ovOver').hidden = true; newGame(); startDay(); });

function setPlacing(type) {
  S.placing = type;
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('on', c.dataset.type === type));
  $('#hint').textContent = type ? `点钉阵放下${MECH[type].name}（¥${MECH[type].price}）· 再点一次卡片取消` : '点机关再点钉阵放置 · 长按机关看说明';
}
document.querySelectorAll('.card').forEach(card => {
  const type = card.dataset.type; let timer = null, long = false;
  drawMechIcon(card.querySelector('canvas'), type);
  card.addEventListener('pointerdown', () => { long = false; timer = setTimeout(() => { long = true; showTip(type); }, 450); });
  const end = () => { clearTimeout(timer); if (long) setTimeout(() => $('#tip').hidden = true, 1800); };
  card.addEventListener('pointerup', end); card.addEventListener('pointerleave', () => clearTimeout(timer));
  card.addEventListener('contextmenu', e => e.preventDefault());
  card.addEventListener('click', e => { if (long) { long = false; return; } setPlacing(S.placing === type ? null : type); });
});
function showTip(type) { const t = $('#tip'); t.innerHTML = `<b>${MECH[type].name} · ¥${MECH[type].price}</b>${MECH[type].desc}`; t.hidden = false; }

// ---------- board canvas ----------
const cv = $('#board'), ctx = cv.getContext('2d');
let view = { s: 1, ox: 0, oy: 0, dpr: 1 }, staticLayer = null;
function resize() {
  const r = $('#stage').getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const s = Math.min(r.width / (W + 8), r.height / (H + 8));
  view = { s, dpr, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2 + 2 };
  buildStatic();
}
new ResizeObserver(resize).observe($('#stage'));
function toWorld(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s }; }
function canPlace(p) {
  if (p.x < B.L + 10 || p.x > B.laneX - 10 || p.y < 186 || p.y > B.slotTop - 6) return '只能放在钉阵里';
  if (S.world.mechs.some(m => Math.hypot(m.x - p.x, m.y - p.y) < 26)) return '离别的机关太近了';
  if (S.world.mechs.length >= MAX_MECH) return `台子上最多放 ${MAX_MECH} 个机关`;
  if (S.money < MECH[S.placing].price) return '钱不够';
  return null;
}
cv.addEventListener('pointermove', e => { S.ghost = S.placing ? toWorld(e) : null; });
cv.addEventListener('pointerleave', () => { S.ghost = null; });
cv.addEventListener('pointerdown', e => {
  const p = toWorld(e);
  if (S.placing) {
    const err = canPlace(p);
    if (err) { float(p.x, p.y, err, '#ff8a7a', 12); return; }
    const price = MECH[S.placing].price;
    S.world.mechs.push({ id: S.mechId++, type: S.placing, x: p.x, y: p.y, dir: p.x > B.cx ? -1 : 1, cd: 0, anim: 0 });
    S.money -= price; S.stats.spend += price; float(p.x, p.y - 18, `-¥${price}`, '#ff8a7a', 12);
    setPlacing(null);
    return;
  }
  const m = S.world.mechs.find(m => m.type === 'fist' && Math.hypot(m.x - p.x, m.y - p.y) < 18);
  if (m) { m.dir *= -1; float(m.x, m.y - 18, m.dir > 0 ? '朝右' : '朝左', '#f6e7c8', 11); }
});

function boardPath(c, grow) {
  c.beginPath(); c.moveTo(B.L - grow, B.bottom + grow); c.lineTo(B.L - grow, B.cy);
  c.arc(B.cx, B.cy, B.dr + grow, Math.PI, 2 * Math.PI); c.lineTo(B.R + grow, B.bottom + grow); c.closePath();
}
function buildStatic() {
  const { s, dpr } = view; staticLayer = document.createElement('canvas');
  staticLayer.width = Math.ceil((W + 8) * s * dpr); staticLayer.height = Math.ceil((H + 8) * s * dpr);
  const c = staticLayer.getContext('2d'); c.scale(s * dpr, s * dpr);
  // rim
  boardPath(c, 9); c.fillStyle = '#7d1418'; c.fill();
  boardPath(c, 7); c.fillStyle = '#b8262b'; c.fill();
  boardPath(c, 2); c.fillStyle = '#e0b04f'; c.fill();
  // wood
  c.save(); boardPath(c, 0); c.clip();
  c.fillStyle = '#c98b52'; c.fillRect(0, 0, W, H);
  const rnd = makeRng(99);
  for (let y = 10; y < H; y += 24) {
    c.fillStyle = 'rgba(120,70,30,.35)'; c.fillRect(0, y, W, 1.2);
    for (let i = 0; i < 4; i++) { const x = rnd() * W; c.fillRect(x, y, 1.2, 24); }
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = 'rgba(150,90,45,.35)'; c.lineWidth = 0.8; c.beginPath();
      c.ellipse(rnd() * W, y + 12, 8 + rnd() * 14, 3 + rnd() * 3, 0, 0, Math.PI * 2); c.stroke();
    }
  }
  c.strokeStyle = 'rgba(190,225,255,.45)'; c.lineWidth = 1.5; c.beginPath(); c.arc(B.cx, B.cy, B.dr - 6, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
  c.restore();
  // rivets
  c.fillStyle = '#e0b04f';
  for (let a = Math.PI; a <= 2 * Math.PI + 0.01; a += Math.PI / 18) c.fillRect(B.cx + Math.cos(a) * (B.dr + 5) - 1.5, B.cy + Math.sin(a) * (B.dr + 5) - 1.5, 3, 3);
  for (let y = B.cy + 18; y < B.bottom; y += 34) { c.fillRect(B.L - 6.5, y, 3, 3); c.fillRect(B.R + 3.5, y, 3, 3); }
  // slots
  const labels = { 0: ['谢谢', '惠顾'], 1: ['1元'], 3: ['3元'], 8: ['8元'] };
  for (let i = 0; i < SLOT_N; i++) {
    const p = PRIZES[i], x = B.L + i * SLOT_W + 1.5, y = B.slotTop + 6, w = SLOT_W - 3, h = B.bottom - y;
    c.fillStyle = p === 0 ? '#4a2f22' : p === 8 ? '#c8262b' : '#e2b23e'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, y + h - 4, w, 4);
    c.fillStyle = p === 0 ? '#e8d5b5' : p === 8 ? '#fff3c4' : '#5a3a14';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const L = labels[p];
    if (L.length === 2) { c.font = '700 10px ' + getComputedStyle(document.body).fontFamily; c.fillText(L[0], x + w / 2, y + h / 2 - 7); c.fillText(L[1], x + w / 2, y + h / 2 + 7); }
    else { c.font = `${p === 8 ? 17 : 14}px "ZCOOL QingKe HuangYou", sans-serif`; c.fillText(L[0], x + w / 2, y + h / 2 + 1); }
    if (p === 8) {
      c.fillStyle = '#c8262b'; c.fillRect(x + 3, y - 13, w - 6, 12); c.strokeStyle = '#000'; c.lineWidth = 1; c.strokeRect(x + 3, y - 13, w - 6, 12);
      c.fillStyle = '#f2c94c'; c.font = '13px "ZCOOL QingKe HuangYou", sans-serif'; c.fillText('大奖', x + w / 2, y - 6.5);
    }
  }
  // dividers
  for (const sg of buildSegs()) {
    const lane = sg.x1 === B.laneX;
    c.fillStyle = lane ? '#7a4a26' : '#b9873a'; c.fillRect(sg.x1 - (lane ? 2 : 1.2), sg.y1, lane ? 4 : 2.4, sg.y2 - sg.y1);
    c.fillStyle = '#e0b04f'; c.beginPath(); c.arc(sg.x1, sg.y1, lane ? 3.5 : 2.6, 0, Math.PI * 2); c.fill();
  }
  // plunger
  c.fillStyle = '#7a4a26'; c.fillRect(B.laneX + 5, B.bottom - 6, 12, 6); c.fillRect(B.laneX + 9, B.bottom - 14, 4, 8);
  // pegs
  for (const p of buildPegs()) {
    c.fillStyle = '#5a3a14'; c.beginPath(); c.arc(p.x + 0.6, p.y + 0.8, PEG_R, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e0b04f'; c.beginPath(); c.arc(p.x, p.y, PEG_R, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff1c2'; c.fillRect(p.x - 1.5, p.y - 1.5, 1.2, 1.2);
  }
}

function drawFist(c, m, ghost) {
  const ext = m.anim > 0 ? 15 : 3, d = m.dir;
  c.save(); c.translate(m.x, m.y); if (ghost) c.globalAlpha = 0.55;
  c.fillStyle = '#7a4a26'; c.fillRect(-d * 6 - 2, -9, 4, 18);
  c.strokeStyle = '#cfd6dc'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-d * 4, 0);
  const n = 5; for (let i = 1; i <= n; i++) c.lineTo(-d * 4 + d * (ext + 4) * i / n, i % 2 ? -3 : 3); c.stroke();
  const gx = d * ext + d * 2;
  c.fillStyle = '#8f1a1f'; c.beginPath(); c.arc(gx + 0.8, 0.8, 6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d8333a'; c.beginPath(); c.arc(gx, 0, 6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ff8a8a'; c.fillRect(gx - 2, -4, 2, 2);
  c.restore();
}
function drawMagnet(c, m, ghost, active) {
  c.save(); c.translate(m.x, m.y); if (ghost) c.globalAlpha = 0.55;
  if (active || ghost) { c.strokeStyle = 'rgba(120,190,255,.45)'; c.setLineDash([3, 3]); c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 66, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
  c.lineWidth = 6; c.strokeStyle = '#8f1a1f'; c.beginPath(); c.arc(0.8, 1.8, 6, Math.PI, 0, true); c.stroke();
  c.strokeStyle = '#d8333a'; c.beginPath(); c.arc(0, 1, 6, Math.PI, 0, true); c.stroke();
  c.fillStyle = '#d8333a'; c.fillRect(-9, -5, 6, 6); c.fillRect(3, -5, 6, 6);
  c.fillStyle = '#dfe6ea'; c.fillRect(-9, -8, 6, 3); c.fillRect(3, -8, 6, 3);
  c.restore();
}
function drawMechIcon(canvas, type) {
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.save(); c.translate(10, 10); c.scale(0.9, 0.9);
  if (type === 'fist') drawFist(c, { x: 0, y: 0, dir: 1, anim: 0 }); else drawMagnet(c, { x: 0, y: 2 }, false, false);
  c.restore();
}
function drawBall(c, b) {
  for (let i = 0; i < b.trail.length; i++) { const t = b.trail[i]; c.fillStyle = `rgba(190,225,255,${0.06 * (i + 1)})`; c.beginPath(); c.arc(t.x, t.y, BR * (0.4 + i * 0.08), 0, Math.PI * 2); c.fill(); }
  const g = c.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BR);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#cfe7f7'); g.addColorStop(1, '#6f9fc4');
  c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, BR, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1f3c5a'; c.lineWidth = 0.8; c.stroke();
  const a = b.x * 0.2;
  c.strokeStyle = '#e0383e'; c.lineWidth = 1.6; c.beginPath(); c.arc(b.x, b.y, BR * 0.55, a, a + 1.6); c.stroke();
  c.strokeStyle = '#2f6fd0'; c.beginPath(); c.arc(b.x, b.y, BR * 0.55, a + Math.PI, a + Math.PI + 1.6); c.stroke();
}
function draw() {
  const { s, dpr, ox, oy } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, cv.height); bg.addColorStop(0, '#2a1d33'); bg.addColorStop(1, '#1b1217');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);
  let sx = 0, sy = 0; if (S.shake > 0) { const k = S.shake / S.shakeDur, a = S.shakeAmp * k * k; sx = (Math.random() - 0.5) * 2 * a; sy = (Math.random() - 0.5) * 2 * a; }
  ctx.setTransform(dpr, 0, 0, dpr, (ox + sx) * dpr, (oy + sy) * dpr);
  if (staticLayer) ctx.drawImage(staticLayer, 0, 0, staticLayer.width / dpr, staticLayer.height / dpr);
  ctx.scale(s, s);
  if (inPatrol()) { ctx.save(); boardPath(ctx, 0); ctx.clip(); ctx.fillStyle = 'rgba(80,140,255,.07)'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  const w = S.world;
  for (const m of w.mechs) {
    if (m.type === 'fist') drawFist(ctx, m);
    else drawMagnet(ctx, m, false, w.balls.some(b => Math.hypot(b.x - m.x, b.y - m.y) < 66 && (b.mt[m.id] || 0) < 1.1));
  }
  if (S.placing && S.ghost) {
    const ok = !canPlace(S.ghost);
    if (S.placing === 'fist') drawFist(ctx, { ...S.ghost, dir: S.ghost.x > B.cx ? -1 : 1, anim: 0 }, true); else drawMagnet(ctx, S.ghost, true);
    if (!ok) { ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(S.ghost.x, S.ghost.y, 12, 0, Math.PI * 2); ctx.stroke(); }
  }
  for (const b of w.balls) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 6) b.trail.shift(); drawBall(ctx, b); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of S.floats) {
    const k = 1 - f.life / 1.2; ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.font = `${f.size}px "ZCOOL QingKe HuangYou", sans-serif`;
    ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y - k * 22 + 1);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - k * 22);
  }
  ctx.globalAlpha = 1;
  if (S.flash > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,245,220,${Math.min(0.35, S.flash * 2)})`; ctx.fillRect(0, 0, cv.width, cv.height); }
}

// ---------- HUD ----------
const cache = {};
function set(id, prop, v) { const k = id + prop; if (cache[k] === v) return; cache[k] = v; const el = document.getElementById(id); if (prop === 'text') el.textContent = v; else if (prop === 'w') el.style.width = v; else if (prop === 'hidden') el.hidden = v; else el.className = v; }
function hud() {
  set('money', 'text', `${S.money < 0 ? '-' : ''}¥${Math.abs(S.money)}`); set('money', 'class', 'money' + (S.money < 0 ? ' neg' : ''));
  set('dayLabel', 'text', `第 ${S.day} 天 ${S.day === 1 ? '开张大吉' : S.phase === 'closing' ? '准备收摊' : '照常营业'}`);
  const pop = Math.round(S.pop), sus = Math.round(S.sus);
  set('popNum', 'text', String(pop)); set('popBar', 'w', pop + '%');
  set('susNum', 'text', String(sus)); set('susBar', 'w', sus + '%'); set('susWrap', 'class', 'bar' + (sus >= 75 ? ' danger' : ''));
  set('watch', 'text', `围观 ${watchers()} 人`);
  set('dayFill', 'w', Math.min(100, S.t / DAY_LEN * 100).toFixed(1) + '%');
  const patrol = inPatrol();
  let banner = '';
  if (S.sus >= 75) banner = '有人起疑了，收着点！'; else if (patrol) banner = '城管巡逻中 · 嫌疑翻倍';
  else if (S.phase === 'closing') banner = '收摊中，等最后几颗落地'; else if (S.paused) banner = '已暂停';
  set('banner', 'hidden', !banner); set('banner', 'text', banner); set('banner', 'class', 'banner' + (S.sus >= 75 ? ' alert' : ''));
  const live = S.phase === 'open' || S.phase === 'closing';
  const slapReady = live && S.slapCD <= 0;
  $('#slap').disabled = !slapReady;
  set('slapCd', 'w', '100%'); $('#slapCd').style.height = (S.slapCD > 0 ? S.slapCD / 5 * 100 : 0) + '%';
  for (const t of ['fist', 'magnet']) set('card-' + t, 'class', 'card' + (S.placing === t ? ' on' : '') + (S.money < MECH[t].price ? ' poor' : ''));
}
function renderQueue() {
  const q = $('#queue'); q.innerHTML = '';
  for (const k of S.queue) { const im = new Image(); im.src = KIDS[k]; im.className = 'px'; im.alt = ''; q.appendChild(im); }
}
{ const z = $('#zone'); z.style.left = PATROL[0] * 100 + '%'; z.style.width = (PATROL[1] - PATROL[0]) * 100 + '%'; $('#patrolFlag').style.left = `calc(${PATROL[0] * 100}% - ${PATROL[0] * 6}px)`; }

newGame();
const b = bestDay(); if (b) $('#best').textContent = `最好成绩：撑过 ${b} 天`;
resize();
if (document.fonts) document.fonts.ready.then(buildStatic);
requestAnimationFrame(frame);
})();
