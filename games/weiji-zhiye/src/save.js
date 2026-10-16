// 存档：成功放置、剧情推进、作出选择后立即写入
const P = require('./platform');
const KEY = 'weiji_night_bedroom_demo_v1';

function fresh() {
  return {
    v: 1,
    phase: 'new',        // new | intro | room | roomDone | outro | done
    introIdx: 0,
    outroIdx: 0,
    placed: [],          // 已放置贴纸 ID
    group: 0,            // 当前组 0..2
    choice: null,        // 'A' | 'B'
    read: { intro: false, outro: false },
    sound: true,
    feedback: null,
    stats: { groupSec: [0, 0, 0], misses: 0, hints: 0, revisits: 0, replays: 0 },
  };
}

const S = {
  d: fresh(),
  load() {
    const raw = P.storageGet(KEY);
    if (raw) {
      try {
        const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const f = fresh();
        this.d = Object.assign(f, o);
        this.d.read = Object.assign(f.read, o.read || {});
        this.d.stats = Object.assign(fresh().stats, o.stats || {});
      } catch (e) { this.d = fresh(); }
    }
    return this.d;
  },
  write() { P.storageSet(KEY, JSON.stringify(this.d)); },
  reset() { const snd = this.d.sound; this.d = fresh(); this.d.sound = snd; this.write(); },
};

module.exports = S;
