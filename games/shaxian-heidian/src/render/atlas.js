// ============================================================
// 占位像素图集：程序绘制 16×16 精灵。
// 换成 GPT 生成的正式美术时：做一张同布局的 PNG 图集，
// 在 G.Atlas.build 里改为加载图片即可，名字表 SPR 不变。
// ============================================================
(function () {
  var S = 16, COLS = 16;
  var names = [];
  var SPR = {};

  function slot(name) {
    var i = names.length;
    names.push(name);
    SPR[name] = { x: (i % COLS) * S, y: Math.floor(i / COLS) * S, w: S, h: S };
    return SPR[name];
  }

  function painter(ctx, s) {
    return function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(s.x + x, s.y + y, w, h); };
  }

  function person(ctx, name, o) {
    for (var f = 0; f < 2; f++) {
      var p = painter(ctx, slot(name + '_' + f));
      var skin = o.skin || '#f1c9a0';
      p(4, 15, 8, 1, 'rgba(0,0,0,0.25)');
      // 腿
      if (f === 0) { p(5, 12, 2, 3, '#2c2c34'); p(9, 12, 2, 3, '#2c2c34'); }
      else { p(5, 12, 2, 2, '#2c2c34'); p(4, 14, 2, 1, '#2c2c34'); p(9, 12, 2, 3, '#2c2c34'); }
      // 身体与手臂
      p(4, 7, 8, 5, o.shirt);
      p(3, 8, 1, 3, o.shirt); p(12, 8, 1, 3, o.shirt);
      p(3, 11, 1, 1, skin); p(12, 11, 1, 1, skin);
      if (o.apron) { p(5, 8, 6, 4, '#e9e9e9'); p(5, 8, 6, 1, '#cfcfcf'); }
      // 头
      p(5, 2, 6, 5, skin);
      p(6, 4, 1, 1, '#222'); p(9, 4, 1, 1, '#222');
      if (o.hat) { p(5, 0, 6, 2, '#ffffff'); p(4, 1, 8, 1, '#ffffff'); p(5, 2, 6, 1, '#dcdcdc'); }
      else { p(5, 1, 6, 2, o.hair); p(4, 2, 1, 3, o.hair); p(11, 2, 1, 2, o.hair); }
      if (o.shades) p(5, 4, 6, 1, '#111');
      if (o.glasses) { p(6, 4, 1, 1, '#fff'); p(9, 4, 1, 1, '#fff'); p(7, 4, 2, 1, '#888'); }
      if (o.chain) p(7, 7, 2, 1, '#e8c35a');
      if (o.phone) p(12, 8, 2, 3, '#222');
    }
  }

  G.Atlas = {
    SPR: SPR,
    tex: null,
    build: function (platform, renderer) {
      var c = platform.createCanvas(256, 64);
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 256, 64);
      var p;

      p = painter(ctx, slot('white')); p(0, 0, 16, 16, '#ffffff');

      p = painter(ctx, slot('floor_hall'));
      p(0, 0, 16, 16, '#dcbf93'); p(0, 0, 8, 8, '#d3b386'); p(8, 8, 8, 8, '#d3b386');
      p(0, 15, 16, 1, '#bf9d70'); p(15, 0, 1, 16, '#bf9d70');

      p = painter(ctx, slot('floor_kitchen'));
      p(0, 0, 16, 16, '#cdd3d7'); p(0, 7, 16, 1, '#aeb5ba'); p(0, 15, 16, 1, '#aeb5ba');
      p(7, 0, 1, 8, '#aeb5ba'); p(15, 8, 1, 8, '#aeb5ba');

      p = painter(ctx, slot('door'));
      p(0, 0, 16, 16, '#dcbf93'); p(1, 2, 14, 12, '#8a5a32'); p(2, 3, 12, 10, '#a8703f');
      for (var i = 0; i < 4; i++) p(3, 4 + i * 2, 10, 1, '#8a5a32');

      p = painter(ctx, slot('street'));
      p(0, 0, 16, 16, '#4a4550'); p(3, 5, 1, 1, '#5a5560'); p(11, 2, 1, 1, '#5a5560'); p(8, 12, 1, 1, '#3d3843');

      p = painter(ctx, slot('wall'));
      p(0, 0, 16, 16, '#7a3b2e'); p(0, 13, 16, 3, '#5c2a20'); p(0, 4, 16, 1, '#8d4a3b');

      p = painter(ctx, slot('stove'));
      p(1, 5, 14, 11, '#5b5f66'); p(1, 3, 14, 3, '#2e3035'); p(1, 15, 14, 1, '#44474d');
      p(3, 3, 4, 2, '#1c1c1f'); p(9, 3, 4, 2, '#1c1c1f');
      p(4, 1, 2, 2, '#ff8a2a'); p(10, 1, 2, 2, '#ff8a2a'); p(4, 2, 1, 1, '#ffd23f'); p(11, 2, 1, 1, '#ffd23f');
      p(3, 8, 10, 1, '#777b82'); p(6, 11, 4, 2, '#3a3d42');

      p = painter(ctx, slot('steamer'));
      p(2, 13, 12, 3, '#5b5f66');
      p(3, 9, 10, 4, '#c8a060'); p(3, 10, 10, 1, '#a07c40');
      p(3, 5, 10, 4, '#d0a868'); p(3, 6, 10, 1, '#a07c40');
      p(4, 3, 8, 2, '#dcbc80'); p(7, 2, 2, 1, '#a07c40');
      p(5, 0, 1, 2, '#f4f4f4'); p(10, 0, 1, 1, '#f4f4f4');

      p = painter(ctx, slot('pot'));
      p(2, 11, 12, 5, '#5b5f66'); p(4, 12, 8, 2, '#ff8a2a');
      p(2, 4, 12, 1, '#8a9097'); p(3, 5, 10, 6, '#b0b6bd'); p(3, 5, 10, 1, '#e0a050');
      p(1, 6, 1, 2, '#8a9097'); p(14, 6, 1, 2, '#8a9097');
      p(6, 1, 1, 2, '#f4f4f4'); p(9, 0, 1, 2, '#f4f4f4');

      p = painter(ctx, slot('table'));
      p(1, 6, 14, 5, '#9c6a3a'); p(1, 6, 14, 1, '#b8854f'); p(1, 11, 14, 1, '#6e4520');
      p(2, 12, 1, 3, '#4a3015'); p(13, 12, 1, 3, '#4a3015');
      p(5, 13, 6, 2, '#d0402a'); p(5, 15, 1, 1, '#9a2a1a'); p(10, 15, 1, 1, '#9a2a1a');
      p(6, 7, 4, 2, '#f4f4f4'); p(6, 7, 4, 1, '#3a6fb0');

      p = painter(ctx, slot('plant'));
      p(5, 11, 6, 5, '#b85c38'); p(5, 11, 6, 1, '#d27a52');
      p(3, 3, 10, 8, '#2e8b57'); p(5, 1, 6, 3, '#2e8b57'); p(4, 4, 3, 2, '#3cb371'); p(9, 2, 2, 3, '#3cb371'); p(8, 7, 3, 2, '#3cb371');

      p = painter(ctx, slot('banner'));
      p(7, 0, 2, 1, '#e8c35a');
      p(3, 1, 10, 13, '#e8c35a'); p(4, 2, 8, 11, '#c0392b');
      p(5, 4, 6, 1, '#e8c35a'); p(5, 7, 6, 1, '#e8c35a'); p(5, 10, 6, 1, '#e8c35a');
      p(5, 14, 1, 2, '#e8c35a'); p(10, 14, 1, 2, '#e8c35a');

      p = painter(ctx, slot('camera'));
      p(7, 6, 2, 10, '#6a6a6a'); p(5, 14, 6, 2, '#4a4a4a');
      p(3, 2, 9, 4, '#dddddd'); p(3, 5, 9, 1, '#b0b0b0'); p(11, 3, 2, 2, '#222'); p(4, 3, 1, 1, '#ff3333');

      p = painter(ctx, slot('bowl'));
      p(4, 6, 8, 3, '#e8c35a'); p(5, 5, 6, 1, '#f0d27a');
      p(3, 8, 10, 3, '#ffffff'); p(4, 11, 8, 1, '#e6e6e6'); p(3, 8, 10, 1, '#3a6fb0');
      p(6, 2, 1, 2, '#f4f4f4'); p(9, 1, 1, 2, '#f4f4f4');

      person(ctx, 'chef', { shirt: '#f4f4f4', hat: true, apron: true });
      var C = G.CFG.CUST;
      person(ctx, 'worker', { shirt: C.worker.shirt, hair: C.worker.hair });
      person(ctx, 'neighbor', { shirt: C.neighbor.shirt, hair: C.neighbor.hair, skin: '#e8bf95' });
      person(ctx, 'influencer', { shirt: C.influencer.shirt, hair: C.influencer.hair, phone: true });
      person(ctx, 'foodie', { shirt: C.foodie.shirt, hair: C.foodie.hair, glasses: true });
      person(ctx, 'rich', { shirt: C.rich.shirt, hair: C.rich.hair, shades: true, chain: true });

      this.canvas = c;
      this.tex = renderer.createTexture(c, true);
    },
    draw: function (r, name, x, y, w, h, cr, cg, cb, ca) {
      var s = SPR[name];
      r.quad(this.tex, x, y, w, h, s.x, s.y, s.w, s.h, cr, cg, cb, ca);
    },
    rect: function (r, x, y, w, h, cr, cg, cb, ca) {
      r.quad(this.tex, x, y, w, h, SPR.white.x + 4, SPR.white.y + 4, 8, 8, cr, cg, cb, ca);
    }
  };
})();
