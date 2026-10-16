// 标题与宅邸入口：房间状态、回访、回顾、意愿反馈（策划案 §11）
const G = require('./main');
const D = require('./data');
const Art = require('./art');
const T = require('./text');
const A = require('./audio');
const { drawRoomWorld, drawRoomThumb, ALL, NONE } = require('./room');

function roomStatus() {
  const sv = G.save;
  switch (sv.phase) {
    case 'new': case 'intro': return { label: '待还原', gray: true, action: '进入卧室' };
    case 'room': return { label: sv.placed.length + '/24', gray: false, action: '继续还原 · ' + sv.placed.length + '/24' };
    case 'roomDone': case 'outro': return { label: '继续故事', gray: false, action: '继续故事' };
    default: return { label: '已记录 · 24/24', gray: false, action: null };
  }
}

function enterBedroom() {
  const sv = G.save;
  if (sv.phase === 'new') { sv.phase = 'intro'; sv.introIdx = 0; G.persist(); }
  if (sv.phase === 'intro') G.go(() => G.scenes.story('intro'));
  else if (sv.phase === 'room') G.go(() => G.scenes.room('play'));
  else if (sv.phase === 'roomDone') G.go(() => G.scenes.room('done'));
  else if (sv.phase === 'outro') G.go(() => G.scenes.story('outro'));
  else G.go(() => G.scenes.room('view'));
}

function soundButton(x, y) {
  G.button('snd', x, y, 130, 58, G.save.sound ? '声音 开' : '声音 关', {
    size: 24, r: 29,
    onClick: () => { const s = !G.save.sound; G.save.sound = s; A.setOn(s); G.persist(); },
  });
}

class TitleScene {
  constructor() { this.t = 0; }
  update(dt) { this.t += dt; }
  draw() {
    const R = G.R, v = G.view;
    const done = G.save.phase === 'done';
    const cv = Art.cover;
    if (cv) {
      // 封面图铺满屏幕（等比裁切），缓慢推近
      const k = Math.max(v.w / cv.w, v.h / cv.h) * (1.04 + 0.03 * Math.sin(this.t * 0.15));
      const w = cv.w * k, h = cv.h * k;
      R.draw(cv.t, (v.w - w) / 2, (v.h - h) / 2, w, h);
      R.rect(0, 0, v.w, v.h, [0.02, 0.02, 0.04, 0.38]);
    } else {
      const z = Math.max(v.w / D.ROOM_W, v.h * 0.6 / D.ROOM_H);
      drawRoomWorld({ x: D.ROOM_W / 2, y: D.ROOM_H / 2 + Math.sin(this.t * 0.2) * 10, z, cx: v.w / 2, cy: v.h / 2 }, done ? ALL : NONE, { t: G.t, light: done ? 1 : 0 });
      R.rect(0, 0, v.w, v.h, [0.02, 0.02, 0.04, 0.55]);
    }
    const a = Math.min(1, this.t * 1.2);
    const y = v.h * 0.3;
    T.draw('未寄之夜', 375, y, { size: 84, color: '#f1e2c6', weight: 'bold', anchor: 'center', alpha: a, shadow: true });
    T.draw('— 他的卧室，我的耳饰 —', 375, y + 92, { size: 32, color: '#cbb894', anchor: 'center', alpha: a });
    T.draw('卧室版 Demo', 375, y + 150, { size: 24, color: '#8d8476', anchor: 'center', alpha: a });
    const isNew = G.save.phase === 'new';
    G.button('start', 175, v.h * 0.66, 400, 96, isNew ? '开始 Demo' : '继续', {
      style: 'primary', size: 36, alpha: a,
      onClick: () => {
        if (isNew) { G.save.phase = 'intro'; G.save.introIdx = 0; G.persist(); G.go(() => G.scenes.story('intro')); }
        else G.go(() => G.scenes.world());
      },
    });
    T.draw('竖屏体验 · 建议开启声音', 375, v.h * 0.66 + 140, { size: 22, color: '#7d7468', anchor: 'center', alpha: a });
    soundButton(600, v.safeTop + 24);
  }
}

class WorldScene {
  constructor(opt) {
    this.opt = opt || {};
    this.t = 0;
    if (this.opt.justDone) setTimeout(() => G.toast('卧室已记录 · 24/24'), 400);
  }
  update(dt) { this.t += dt; }
  mapRect() {
    const v = G.view;
    return { x: 30, y: v.safeTop + 150, w: Art.MAP_W, h: Art.MAP_H };
  }
  bedRect() {
    const m = this.mapRect(), b = Art.MAP_BEDROOM;
    return { x: m.x + b.x, y: m.y + b.y, w: b.w, h: b.h };
  }
  onUp(p) {
    if (!p.tap) return;
    const r = this.bedRect();
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { A.play('tap'); enterBedroom(); }
  }

  draw() {
    const R = G.R, v = G.view, sv = G.save;
    R.rect(0, 0, v.w, v.h, [0.07, 0.075, 0.1, 1]);
    T.draw('陆宅', 40, v.safeTop + 40, { size: 44, color: '#f1e2c6', weight: 'bold' });
    T.draw('《未寄之夜》 卧室版 Demo', 40, v.safeTop + 100, { size: 22, color: '#8d8476' });
    soundButton(600, v.safeTop + 34);

    const m = this.mapRect();
    R.draw(Art.map, m.x, m.y, m.w, m.h);
    const st = roomStatus();
    const b = this.bedRect();
    const placed = sv.phase === 'done' ? ALL : new Set(sv.placed);
    drawRoomThumb(b.x + 6, b.y + 6, b.w - 12, b.h - 64, placed, { gray: st.gray, light: sv.phase === 'done' ? 1 : 0, t: G.t });
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    const done = sv.phase === 'done';
    Art.drawPanel(b.x, b.y, b.w, b.h, 8, null, done ? '#e6c48e' : (st.gray ? 'rgba(160,170,190,0.5)' : '#c9a27a'), done ? 3 : 2, done ? 0.7 + 0.3 * pulse : 1);
    if (this.opt.justDone && this.t < 3) {
      R.setBlend('add');
      R.draw(Art.glow, b.x - 80, b.y - 80, b.w + 160, b.h + 160, { color: [1, 0.78, 0.45], alpha: 0.35 * (1 - this.t / 3) });
      R.setBlend('alpha');
    }
    R.rect(b.x + 2, b.y + b.h - 58, b.w - 4, 56, [0.06, 0.06, 0.08, 0.9]);
    T.draw('卧室', b.x + 20, b.y + b.h - 44, { size: 26, color: '#f1e2c6', weight: 'bold' });
    T.draw(st.label, b.x + b.w - 18, b.y + b.h - 42, { size: 22, color: done ? '#e6c48e' : (st.gray ? '#8e94a2' : '#d8b98c'), anchor: 'right' });
    if (!done) T.draw('轻触进入', b.x + b.w / 2, b.y + (b.h - 60) / 2, { size: 26, color: '#ffffff', anchor: 'center', alpha: 0.5 + 0.4 * pulse, shadow: true });

    let y = m.y + m.h + 34;
    if (!done) {
      G.button('enter', 135, y, 480, 96, st.action, { style: 'primary', size: 34, onClick: enterBedroom });
      y += 130;
    } else {
      G.button('view', 40, y, 325, 86, '欣赏房间', { style: 'primary', size: 30, onClick: () => G.go(() => G.scenes.room('view')) });
      G.button('rv1', 385, y, 325, 86, '回顾开场', { size: 30, onClick: () => G.go(() => G.scenes.story('intro', true)) });
      G.button('rv2', 40, y + 106, 325, 86, '回顾后续', { size: 30, onClick: () => G.go(() => G.scenes.story('outro', true)) });
      G.button('fb', 385, y + 106, 325, 86, '后续内容意愿反馈', { size: 26, onClick: () => this.feedback() });
      y += 230;
    }
    const by = Math.min(v.h - v.safeBottom - 90, Math.max(y, v.h - v.safeBottom - 90));
    G.button('stats', 40, by, 200, 60, '试玩记录', { style: 'text', size: 24, onClick: () => this.stats() });
    G.button('reset', 510, by, 200, 60, '重新开始', { style: 'text', size: 24, color: '#a07a6a', onClick: () => this.reset() });
  }

  feedback() {
    const sv = G.save;
    const pick = (k) => () => { sv.feedback = k; G.persist(); G.toast('已记录，谢谢你的反馈'); };
    G.openModal('后续内容意愿反馈',
      '下一段将围绕「叫走他的那条消息」与「你当时害怕的人」展开。后续房间尚未制作。' + (sv.feedback ? '\n当前选择：' + sv.feedback : ''),
      [
        { label: '很想继续看', style: 'primary', fn: pick('很想继续看') },
        { label: '有点兴趣', fn: pick('有点兴趣') },
        { label: '暂时不想', fn: pick('暂时不想') },
        { label: '关闭', style: 'text' },
      ]);
  }

  stats() {
    const s = G.save.stats, f = (x) => Math.round(x) + ' 秒';
    const body = [
      '贴纸用时：第一组 ' + f(s.groupSec[0]) + '，第二组 ' + f(s.groupSec[1]) + '，第三组 ' + f(s.groupSec[2]),
      '合计：' + f(s.groupSec[0] + s.groupSec[1] + s.groupSec[2]),
      '放错次数：' + s.misses + '　提示次数：' + s.hints,
      '回访房间：' + s.revisits + '　回顾剧情：' + s.replays,
      '选择：' + (G.save.choice ? G.save.choice + ' ' + (G.choiceText(G.save.choice) || '') : '—'),
      '意愿：' + (G.save.feedback || '—'),
    ].join('\n');
    G.openModal('试玩记录', body, [{ label: '关闭' }]);
  }

  reset() {
    G.openModal('重新开始？', '重开 Demo 会清除全部进度：已贴贴纸、剧情位置、选择与试玩记录。', [
      { label: '确定清除并重开', style: 'primary', fn: () => { G.S.reset(); A.setOn(G.save.sound); A.setRain(0.5); G.go(() => G.scenes.title()); } },
      { label: '取消' },
    ]);
  }
}

G.scenes.title = () => new TitleScene();
G.scenes.world = (opt) => new WorldScene(opt);
module.exports = { TitleScene, WorldScene };
