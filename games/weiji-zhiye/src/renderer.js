// 纯 WebGL 2D 批渲染器：一个着色器，按纹理/混合模式自动分批
const VS = 'attribute vec2 aPos;attribute vec2 aUV;attribute vec4 aCol;attribute float aMix;' +
  'uniform vec2 uView;varying vec2 vUV;varying vec4 vCol;varying float vMix;' +
  'void main(){vec2 p=aPos/uView*2.0-1.0;gl_Position=vec4(p.x,-p.y,0.0,1.0);vUV=aUV;vCol=aCol;vMix=aMix;}';
const FS = 'precision mediump float;varying vec2 vUV;varying vec4 vCol;varying float vMix;uniform sampler2D uTex;' +
  'void main(){vec4 t=texture2D(uTex,vUV);vec3 c=mix(t.rgb*vCol.rgb,vCol.rgb,vMix);gl_FragColor=vec4(c,t.a*vCol.a);}';

const FLOATS = 9;
const MAXQ = 2000;

class Renderer {
  constructor(canvas) {
    const opts = { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) throw new Error('WebGL 不可用');
    this.gl = gl;
    this.canvas = canvas;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this.prog = prog;
    this.uView = gl.getUniformLocation(prog, 'uView');

    this.data = new Float32Array(MAXQ * 4 * FLOATS);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const idx = new Uint16Array(MAXQ * 6);
    for (let i = 0; i < MAXQ; i++) {
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    const stride = FLOATS * 4;
    const attr = (name, size, off) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4);
    };
    attr('aPos', 2, 0); attr('aUV', 2, 2); attr('aCol', 4, 4); attr('aMix', 1, 8);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    this.n = 0;
    this.curTex = null;
    this.blend = 'alpha';
    this.tx = 0; this.ty = 0; this.ts = 1;
    this.white = this.texFromPixels(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.drawCalls = 0;
  }

  _newTex() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  texFromPixels(px, w, h) {
    const gl = this.gl;
    const t = this._newTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    this.curTex = null;
    return { tex: t, w, h };
  }
  texFromCanvas(c) {
    this.flush();
    const gl = this.gl;
    const t = this._newTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    this.curTex = null;
    return { tex: t, w: c.width, h: c.height };
  }
  deleteTex(t) {
    if (!t) return;
    this.flush();
    this.gl.deleteTexture(t.tex);
    this.curTex = null;
  }

  begin(viewW, viewH, pxW, pxH) {
    const gl = this.gl;
    this.viewW = viewW; this.viewH = viewH;
    gl.viewport(0, 0, pxW, pxH);
    gl.clearColor(0.06, 0.065, 0.09, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.uView, viewW, viewH);
    this.drawCalls = 0;
    this.resetTransform();
  }
  end() { this.flush(); }

  setTransform(s, tx, ty) { this.ts = s; this.tx = tx; this.ty = ty; }
  resetTransform() { this.ts = 1; this.tx = 0; this.ty = 0; }

  setBlend(mode) {
    if (mode === this.blend) return;
    this.flush();
    const gl = this.gl;
    if (mode === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.blend = mode;
  }

  flush() {
    if (!this.n) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.curTex.tex);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * 4 * FLOATS));
    gl.drawElements(gl.TRIANGLES, this.n * 6, gl.UNSIGNED_SHORT, 0);
    this.n = 0;
    this.drawCalls++;
  }

  // x,y 为左上角；o: alpha, color[r,g,b], mix, rot(绕中心), uv[u0,v0,u1,v1]
  draw(t, x, y, w, h, o) {
    if (!t) return;
    o = o || {};
    if (this.curTex !== t || this.n >= MAXQ) { this.flush(); this.curTex = t; }
    const s = this.ts, ox = this.tx, oy = this.ty;
    const col = o.color || [1, 1, 1];
    const a = o.alpha === undefined ? 1 : o.alpha;
    const m = o.mix || 0;
    const uv = o.uv || [0, 0, 1, 1];
    let px, py;
    if (o.rot) {
      const cx = x + w / 2, cy = y + h / 2, c = Math.cos(o.rot), sn = Math.sin(o.rot);
      const hw = w / 2, hh = h / 2;
      const pts = [-hw, -hh, hw, -hh, hw, hh, -hw, hh];
      px = []; py = [];
      for (let i = 0; i < 4; i++) {
        px.push(cx + pts[i * 2] * c - pts[i * 2 + 1] * sn);
        py.push(cy + pts[i * 2] * sn + pts[i * 2 + 1] * c);
      }
    } else {
      px = [x, x + w, x + w, x]; py = [y, y, y + h, y + h];
    }
    const us = [uv[0], uv[2], uv[2], uv[0]], vs = [uv[1], uv[1], uv[3], uv[3]];
    let k = this.n * 4 * FLOATS;
    const d = this.data;
    for (let i = 0; i < 4; i++) {
      d[k++] = px[i] * s + ox; d[k++] = py[i] * s + oy;
      d[k++] = us[i]; d[k++] = vs[i];
      d[k++] = col[0]; d[k++] = col[1]; d[k++] = col[2]; d[k++] = a;
      d[k++] = m;
    }
    this.n++;
  }

  rect(x, y, w, h, rgba) {
    this.draw(this.white, x, y, w, h, { color: rgba, alpha: rgba[3] === undefined ? 1 : rgba[3] });
  }
}

module.exports = Renderer;
