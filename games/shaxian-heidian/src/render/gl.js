// ============================================================
// WebGL 2D 精灵批处理：一个着色器、按纹理分批、四边形带颜色乘算。
// 坐标为逻辑像素（设计分辨率），由 setView 映射到屏幕。
// ============================================================
(function () {
  var MAX_QUADS = 4096, FLOATS_PER_VERT = 8;

  var VS = [
    'attribute vec2 a_pos; attribute vec2 a_uv; attribute vec4 a_col;',
    'uniform vec4 u_view; varying vec2 v_uv; varying vec4 v_col;',
    'void main(){ v_uv=a_uv; v_col=a_col;',
    ' gl_Position=vec4(a_pos.x*u_view.x+u_view.z, a_pos.y*u_view.y+u_view.w, 0.0, 1.0); }'
  ].join('\n');
  var FS = [
    'precision mediump float; uniform sampler2D u_tex; varying vec2 v_uv; varying vec4 v_col;',
    'void main(){ gl_FragColor = texture2D(u_tex, v_uv) * v_col; }'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function Renderer(canvas) {
    var gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 不可用');
    this.gl = gl; this.canvas = canvas;
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.uView = gl.getUniformLocation(p, 'u_view');
    gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);

    this.data = new Float32Array(MAX_QUADS * 4 * FLOATS_PER_VERT);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    var idx = new Uint16Array(MAX_QUADS * 6);
    for (var i = 0, v = 0; i < idx.length; i += 6, v += 4) {
      idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3;
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    var stride = FLOATS_PER_VERT * 4;
    var aPos = gl.getAttribLocation(p, 'a_pos'), aUv = gl.getAttribLocation(p, 'a_uv'), aCol = gl.getAttribLocation(p, 'a_col');
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(aCol); gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, stride, 16);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    this.count = 0;
    this.tex = null;
  }
  G.Renderer = Renderer;

  Renderer.prototype.createTexture = function (source, nearest) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    var f = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    t.w = source.width; t.h = source.height;
    this.tex = null;
    return t;
  };
  Renderer.prototype.updateTexture = function (t, source) {
    var gl = this.gl;
    this.flush();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    t.w = source.width; t.h = source.height;
    this.tex = t;
  };

  // 画布物理尺寸 bw×bh，逻辑坐标 (x,y) → 物理 (ox + x*s, oy + y*s)
  Renderer.prototype.setView = function (bw, bh, ox, oy, s) {
    var gl = this.gl;
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    gl.viewport(0, 0, bw, bh);
    gl.uniform4f(this.uView, 2 * s / bw, -2 * s / bh, 2 * ox / bw - 1, 1 - 2 * oy / bh);
  };

  Renderer.prototype.clear = function (r, g, b) {
    var gl = this.gl;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  Renderer.prototype.bind = function (t) {
    if (this.tex === t) return;
    this.flush();
    this.gl.bindTexture(this.gl.TEXTURE_2D, t);
    this.tex = t;
  };

  // 画一个四边形；u/v 为纹理像素坐标
  Renderer.prototype.quad = function (t, x, y, w, h, u, v, uw, vh, r, g, b, a) {
    this.bind(t);
    if (this.count >= MAX_QUADS) this.flush();
    var d = this.data, o = this.count * 4 * FLOATS_PER_VERT;
    var u0 = u / t.w, v0 = v / t.h, u1 = (u + uw) / t.w, v1 = (v + vh) / t.h;
    if (r === undefined) { r = 1; g = 1; b = 1; a = 1; }
    d[o] = x;     d[o + 1] = y;     d[o + 2] = u0; d[o + 3] = v0; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a; o += 8;
    d[o] = x + w; d[o + 1] = y;     d[o + 2] = u1; d[o + 3] = v0; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a; o += 8;
    d[o] = x + w; d[o + 1] = y + h; d[o + 2] = u1; d[o + 3] = v1; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a; o += 8;
    d[o] = x;     d[o + 1] = y + h; d[o + 2] = u0; d[o + 3] = v1; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a;
    this.count++;
  };

  Renderer.prototype.flush = function () {
    if (!this.count) return;
    var gl = this.gl;
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * 4 * FLOATS_PER_VERT));
    gl.drawElements(gl.TRIANGLES, this.count * 6, gl.UNSIGNED_SHORT, 0);
    this.count = 0;
  };
})();
