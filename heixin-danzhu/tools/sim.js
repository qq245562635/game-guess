const fs = require('fs');
eval(fs.readFileSync(__dirname + '/../src/engine.js', 'utf8') + ';global.E={createWorld,launchBall,stepWorld,PRIZES,SLOT_N,B,SLOT_W};');
function run(label, mechs, n = 3000) {
  const w = E.createWorld(7);
  w.mechs = mechs.map((m, i) => ({ id: i + 1, cd: 0, anim: 0, dir: 1, ...m }));
  const counts = new Array(E.SLOT_N).fill(0); let reload = 0, stuck = 0, fist = 0, done = 0;
  while (done < n) {
    if (w.balls.length === 0) E.launchBall(w);
    E.stepWorld(w, 1 / 60);
    for (const ev of w.events) {
      if (ev.type === 'score') { counts[ev.slot]++; done++; }
      else if (ev.type === 'reload') reload++;
      else if (ev.type === 'stuck') { stuck++; done++; }
      else if (ev.type === 'fist') fist++;
    }
    w.events.length = 0;
  }
  const ev = counts.reduce((s, c, i) => s + c * E.PRIZES[i], 0) / n;
  console.log(label.padEnd(26), counts.map(c => (c / n * 100).toFixed(1).padStart(5)).join(' '),
    '| EV', ev.toFixed(2), '| reload', (reload / n).toFixed(2), 'stuck', stuck, 'fist/ball', (fist / n).toFixed(2), 'magnetT/ball', (w.magnetTime / n).toFixed(2));
}
const s = i => E.B.L + (i + 0.5) * E.SLOT_W;
run('natural', []);
run('magnet over slot2', [{ type: 'magnet', x: s(2), y: 425 }]);
run('magnets slot2+6', [{ type: 'magnet', x: s(2), y: 425 }, { type: 'magnet', x: s(6), y: 425 }]);
run('fist mid ->left', [{ type: 'fist', x: s(4), y: 300, dir: -1 }]);
run('fist mid ->right', [{ type: 'fist', x: s(4), y: 300, dir: 1 }]);
run('2 fists + 2 magnets', [{ type: 'fist', x: s(3), y: 330, dir: -1 }, { type: 'fist', x: s(5), y: 330, dir: 1 }, { type: 'magnet', x: s(2), y: 425 }, { type: 'magnet', x: s(6), y: 425 }]);
