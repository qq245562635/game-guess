// ============================================================
// UI 层：在离屏 2D 画布上即时绘制（文字、面板、按钮），
// 每帧作为一张纹理盖在 WebGL 画面最上层。微信小游戏没有 DOM，这是通用做法。
// ============================================================
(function () {
  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC","WenQuanYi Micro Hei",sans-serif';

  function UI(platform, renderer, W, H) {
    this.p = platform; this.r = renderer; this.W = W; this.H = H;
    this.canvas = platform.createCanvas(W, H);
    this.ctx = this.canvas.getContext('2d');
    this.tex = renderer.createTexture(this.canvas, false);
    this.scale = 1;
    this.buttons = [];
    this.modal = false;
  }
  G.UI = UI;

  UI.prototype.setScale = function (s) {
    s = Math.max(1, Math.min(s, 2.5));
    if (Math.abs(s - this.scale) < 0.01) return;
    this.scale = s;
    this.canvas.width = Math.round(this.W * s);
    this.canvas.height = Math.round(this.H * s);
  };

  UI.prototype.begin = function () {
    var c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.textBaseline = 'middle';
    this.buttons = [];
    this.modal = false;
  };

  UI.prototype.end = function () {
    this.r.updateTexture(this.tex, this.canvas);
    this.r.quad(this.tex, 0, 0, this.W, this.H, 0, 0, this.canvas.width, this.canvas.height);
  };

  UI.prototype.font = function (size, bold) { this.ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; };

  UI.prototype.rect = function (x, y, w, h, fill) { this.ctx.fillStyle = fill; this.ctx.fillRect(x, y, w, h); };

  UI.prototype.round = function (x, y, w, h, rad, fill, stroke, lw) {
    var c = this.ctx;
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
  };

  UI.prototype.text = function (s, x, y, o) {
    o = o || {};
    var c = this.ctx;
    this.font(o.size || 13, o.bold);
    c.textAlign = o.align || 'left';
    if (o.shadow) { c.fillStyle = o.shadow; c.fillText(s, x + 1, y + 1); }
    c.fillStyle = o.color || '#fff';
    c.fillText(s, x, y);
  };

  // 像素图标；img 为空时什么也不画，布局不变
  UI.prototype.icon = function (img, x, y, size) {
    if (!img) return;
    var c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(img, x, y, size, size);
  };

  UI.prototype.measure = function (s, size, bold) { this.font(size, bold); return this.ctx.measureText(s).width; };

  // 按字切行（中文没有空格）
  UI.prototype.wrap = function (s, maxW, size) {
    this.font(size);
    var lines = [], cur = '';
    for (var i = 0; i < s.length; i++) {
      var t = cur + s[i];
      if (this.ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = s[i]; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  UI.prototype.beginModal = function () { this.modal = true; };

  UI.prototype.hit = function (x, y, w, h, onTap, opts) {
    this.buttons.push({ x: x, y: y, w: w, h: h, onTap: onTap, modal: this.modal, disabled: opts && opts.disabled });
  };

  // 通用按钮
  UI.prototype.button = function (x, y, w, h, label, o, onTap) {
    o = o || {};
    var fill = o.disabled ? '#5a5260' : (o.active ? (o.activeFill || '#e8c35a') : (o.fill || '#3b3145'));
    var color = o.disabled ? '#9a92a0' : (o.active ? '#2a1d16' : (o.color || '#fff'));
    this.round(x, y, w, h, o.radius || 8, fill, o.stroke, o.lw);
    if (o.sub) {
      if (o.icon) {
        var is2 = o.iconSize || 18, lw2 = this.measure(label, o.size || 13, o.bold), sx2 = x + (w - is2 - 5 - lw2) / 2;
        this.icon(o.icon, sx2, y + h / 2 - 7 - is2 / 2, is2);
        this.text(label, sx2 + is2 + 5, y + h / 2 - 7, { size: o.size || 13, bold: o.bold, color: color });
      } else
      this.text(label, x + w / 2, y + h / 2 - 7, { size: o.size || 13, bold: o.bold, color: color, align: 'center' });
      this.text(o.sub, x + w / 2, y + h / 2 + 9, { size: 10.5, color: color, align: 'center' });
    } else if (o.icon) {
      var is = o.iconSize || 18, lw = this.measure(label, o.size || 13, o.bold), tw = is + 5 + lw;
      var sx = x + (w - tw) / 2;
      this.icon(o.icon, sx, y + (h - is) / 2, is);
      this.text(label, sx + is + 5, y + h / 2 + 1, { size: o.size || 13, bold: o.bold, color: color });
    } else {
      this.text(label, x + w / 2, y + h / 2 + 1, { size: o.size || 13, bold: o.bold, color: color, align: 'center' });
    }
    this.hit(x, y, w, h, onTap, o);
  };

  UI.prototype.bar = function (x, y, w, h, v, fill, bg) {
    this.round(x, y, w, h, h / 2, bg || 'rgba(255,255,255,0.15)');
    if (v > 0) this.round(x, y, Math.max(h, w * Math.min(1, v)), h, h / 2, fill);
  };

  // 返回 true 表示点击被 UI 吃掉
  UI.prototype.tap = function (x, y) {
    var hasModal = this.buttons.some(function (b) { return b.modal; });
    for (var i = this.buttons.length - 1; i >= 0; i--) {
      var b = this.buttons[i];
      if (hasModal && !b.modal) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (!b.disabled && b.onTap) b.onTap();
        return true;
      }
    }
    return hasModal;
  };
})();
