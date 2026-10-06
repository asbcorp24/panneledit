(() => {
  'use strict';

  const DEG = Math.PI / 180;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeHex(value) {
    const text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : '#7c8cff';
  }

  function hexRgb(hex) {
    const value = normalizeHex(hex).slice(1);
    return [
      parseInt(value.slice(0, 2), 16) / 255,
      parseInt(value.slice(2, 4), 16) / 255,
      parseInt(value.slice(4, 6), 16) / 255
    ];
  }

  function decodeDataUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) throw new Error('Некорректный STL Data URL');

    if (match[2]) {
      const binary = atob(match[3]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }

    const text = decodeURIComponent(match[3]);
    return new TextEncoder().encode(text).buffer;
  }

  async function sourceToArrayBuffer(source) {
    if (source instanceof ArrayBuffer) return source;
    if (ArrayBuffer.isView(source)) {
      return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    }
    if (source instanceof Blob) return await source.arrayBuffer();

    const text = String(source || '');
    if (text.startsWith('data:')) return decodeDataUrl(text);
    if (!text) throw new Error('STL источник не задан');

    const response = await fetch(text);
    if (!response.ok) throw new Error('Не удалось загрузить STL: HTTP ' + response.status);
    return await response.arrayBuffer();
  }

  function isBinaryStl(buffer) {
    if (buffer.byteLength < 84) return false;
    const view = new DataView(buffer);
    const triangles = view.getUint32(80, true);
    const expected = 84 + triangles * 50;
    if (expected === buffer.byteLength) return true;

    const headLength = Math.min(buffer.byteLength, 512);
    const head = new TextDecoder().decode(new Uint8Array(buffer, 0, headLength)).trimStart();
    return !/^solid\s/i.test(head);
  }

  function parseBinary(buffer) {
    const view = new DataView(buffer);
    const triangleCount = view.getUint32(80, true);
    if (!Number.isFinite(triangleCount) || triangleCount < 1 || 84 + triangleCount * 50 > buffer.byteLength) {
      throw new Error('Повреждённый binary STL');
    }

    const positions = new Float32Array(triangleCount * 9);
    const normals = new Float32Array(triangleCount * 9);
    let p = 0;
    let offset = 84;

    for (let i = 0; i < triangleCount; i++) {
      const nx = view.getFloat32(offset, true);
      const ny = view.getFloat32(offset + 4, true);
      const nz = view.getFloat32(offset + 8, true);
      offset += 12;

      for (let v = 0; v < 3; v++) {
        positions[p] = view.getFloat32(offset, true);
        positions[p + 1] = view.getFloat32(offset + 4, true);
        positions[p + 2] = view.getFloat32(offset + 8, true);
        normals[p] = nx;
        normals[p + 1] = ny;
        normals[p + 2] = nz;
        p += 3;
        offset += 12;
      }
      offset += 2;
    }

    return { positions, normals, triangleCount };
  }

  function computeNormal(ax, ay, az, bx, by, bz, cx, cy, cz) {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length; ny /= length; nz /= length;
    return [nx, ny, nz];
  }

  function parseAscii(buffer) {
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    const regex = /vertex\s+([+\-\d.eE]+)\s+([+\-\d.eE]+)\s+([+\-\d.eE]+)/g;
    const raw = [];
    let match;
    while ((match = regex.exec(text))) {
      raw.push(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    if (raw.length < 9 || raw.length % 9 !== 0) {
      throw new Error('Не удалось разобрать ASCII STL');
    }

    const positions = new Float32Array(raw);
    const normals = new Float32Array(raw.length);
    const triangleCount = raw.length / 9;

    for (let i = 0; i < raw.length; i += 9) {
      const n = computeNormal(
        raw[i], raw[i + 1], raw[i + 2],
        raw[i + 3], raw[i + 4], raw[i + 5],
        raw[i + 6], raw[i + 7], raw[i + 8]
      );
      for (let v = 0; v < 3; v++) {
        normals[i + v * 3] = n[0];
        normals[i + v * 3 + 1] = n[1];
        normals[i + v * 3 + 2] = n[2];
      }
    }

    return { positions, normals, triangleCount };
  }

  function normalizeGeometry(parsed) {
    const positions = parsed.positions;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const sx = maxX - minX;
    const sy = maxY - minY;
    const sz = maxZ - minZ;
    const maxSize = Math.max(sx, sy, sz) || 1;
    const scale = 2 / maxSize;

    const normalized = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      normalized[i] = (positions[i] - cx) * scale;
      normalized[i + 1] = (positions[i + 1] - cy) * scale;
      normalized[i + 2] = (positions[i + 2] - cz) * scale;
    }

    const lines = new Float32Array(parsed.triangleCount * 18);
    let lp = 0;
    for (let i = 0; i < normalized.length; i += 9) {
      const a = [normalized[i], normalized[i + 1], normalized[i + 2]];
      const b = [normalized[i + 3], normalized[i + 4], normalized[i + 5]];
      const c = [normalized[i + 6], normalized[i + 7], normalized[i + 8]];
      for (const edge of [[a, b], [b, c], [c, a]]) {
        lines.set(edge[0], lp); lp += 3;
        lines.set(edge[1], lp); lp += 3;
      }
    }

    return {
      positions: normalized,
      normals: parsed.normals,
      lines,
      triangleCount: parsed.triangleCount,
      originalSize: { x: sx, y: sy, z: sz }
    };
  }

  function parseStl(buffer) {
    const parsed = isBinaryStl(buffer) ? parseBinary(buffer) : parseAscii(buffer);
    return normalizeGeometry(parsed);
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Shader compile error';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'Program link error';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  function perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) / (near - far); out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = (2 * far * near) / (near - far); out[15] = 0;
    return out;
  }

  function identity(out) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  }

  function multiply(out, a, b) {
    const result = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        result[col * 4 + row] =
          a[0 * 4 + row] * b[col * 4 + 0] +
          a[1 * 4 + row] * b[col * 4 + 1] +
          a[2 * 4 + row] * b[col * 4 + 2] +
          a[3 * 4 + row] * b[col * 4 + 3];
      }
    }
    out.set(result);
    return out;
  }

  function rotationX(out, angle) {
    identity(out);
    const c = Math.cos(angle), s = Math.sin(angle);
    out[5] = c; out[6] = s;
    out[9] = -s; out[10] = c;
    return out;
  }

  function rotationY(out, angle) {
    identity(out);
    const c = Math.cos(angle), s = Math.sin(angle);
    out[0] = c; out[2] = -s;
    out[8] = s; out[10] = c;
    return out;
  }

  function translation(out, x, y, z) {
    identity(out);
    out[12] = x; out[13] = y; out[14] = z;
    return out;
  }

  function rotateXVec(v, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
  }

  function rotateYVec(v, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  }

  function normalizeVec(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function rayTriangle(origin, direction, a, b, c) {
    const eps = 1e-7;
    const e1 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const e2 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const p = [
      direction[1]*e2[2] - direction[2]*e2[1],
      direction[2]*e2[0] - direction[0]*e2[2],
      direction[0]*e2[1] - direction[1]*e2[0]
    ];
    const det = e1[0]*p[0] + e1[1]*p[1] + e1[2]*p[2];
    if (Math.abs(det) < eps) return null;
    const inv = 1 / det;
    const tvec = [origin[0]-a[0], origin[1]-a[1], origin[2]-a[2]];
    const u = (tvec[0]*p[0] + tvec[1]*p[1] + tvec[2]*p[2]) * inv;
    if (u < 0 || u > 1) return null;
    const q = [
      tvec[1]*e1[2] - tvec[2]*e1[1],
      tvec[2]*e1[0] - tvec[0]*e1[2],
      tvec[0]*e1[1] - tvec[1]*e1[0]
    ];
    const v = (direction[0]*q[0] + direction[1]*q[1] + direction[2]*q[2]) * inv;
    if (v < 0 || u + v > 1) return null;
    const t = (e2[0]*q[0] + e2[1]*q[1] + e2[2]*q[2]) * inv;
    return t > eps ? t : null;
  }

  class StlViewer {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) throw new Error('StlViewer: container not found');

      this.options = {
        source: options.source || '',
        yaw: Number(options.yaw) || 0,
        pitch: clamp(Number(options.pitch) || -15, -89, 89),
        zoom: clamp(Number(options.zoom) || 1, 0.35, 5),
        wireframe: Boolean(options.wireframe),
        autoRotate: Boolean(options.autoRotate),
        color: normalizeHex(options.color),
        backgroundMode: ['hitech','black','light','gradient','transparent','image','panorama'].includes(String(options.backgroundMode))
          ? String(options.backgroundMode)
          : 'hitech',
        backgroundImage: String(options.backgroundImage || ''),
        onChange: typeof options.onChange === 'function' ? options.onChange : null
      };

      this.yaw = this.options.yaw;
      this.pitch = this.options.pitch;
      this.zoom = this.options.zoom;
      this.wireframe = this.options.wireframe;
      this.autoRotate = this.options.autoRotate;
      this.color = this.options.color;
      this.backgroundMode = this.options.backgroundMode;
      this.backgroundImage = this.options.backgroundImage;
      this.destroyed = false;
      this.geometry = null;
      this.animationId = 0;
      this.lastTime = performance.now();

      this.build();
      this.initGl();
      this.bind();

      this.ready = this.load(this.options.source);
      this.animate();
    }

    build() {
      this.container.innerHTML = '';
      this.container.classList.add('stl-host');

      this.root = document.createElement('div');
      this.root.className = 'stl-viewer';
      this.root.tabIndex = 0;
      this.applyBackground();

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'stl-canvas';

      this.loading = document.createElement('div');
      this.loading.className = 'stl-loading';
      this.loading.textContent = 'Загрузка STL…';

      this.hud = document.createElement('div');
      this.hud.className = 'stl-hud';

      this.stats = document.createElement('span');
      this.stats.className = 'stl-stats';
      this.stats.textContent = 'STL';

      this.hint = document.createElement('span');
      this.hint.className = 'stl-hint';
      this.hint.textContent = 'Drag — вращение · колесо — масштаб';

      this.modeButton = document.createElement('button');
      this.modeButton.type = 'button';
      this.modeButton.className = 'stl-mode';
      this.modeButton.title = 'Solid / Wireframe';

      this.autoButton = document.createElement('button');
      this.autoButton.type = 'button';
      this.autoButton.className = 'stl-auto';
      this.autoButton.title = 'Автовращение';

      this.resetButton = document.createElement('button');
      this.resetButton.type = 'button';
      this.resetButton.className = 'stl-reset';
      this.resetButton.textContent = '⌂';
      this.resetButton.title = 'Сбросить вид';

      this.hud.append(this.stats, this.hint, this.modeButton, this.autoButton, this.resetButton);
      this.root.append(this.canvas, this.loading, this.hud);
      this.container.append(this.root);
      this.updateHud();
    }

    applyBackground() {
      if (!this.root) return;

      const mode = this.backgroundMode || 'hitech';
      const image = this.backgroundImage || '';

      this.root.dataset.backgroundMode = mode;
      this.root.style.background = '';
      this.root.style.backgroundColor = '';
      this.root.style.backgroundImage = '';
      this.root.style.backgroundSize = '';
      this.root.style.backgroundPosition = '';
      this.root.style.backgroundRepeat = '';
      this.root.style.backgroundBlendMode = '';

      if (mode === 'hitech') {
        return;
      }

      if (mode === 'black') {
        this.root.style.background = '#000000';
        return;
      }

      if (mode === 'light') {
        this.root.style.background =
          'radial-gradient(circle at 50% 42%, #ffffff 0%, #eef1f7 48%, #cfd5df 100%)';
        return;
      }

      if (mode === 'gradient') {
        this.root.style.background =
          'radial-gradient(circle at 50% 36%, rgba(104,84,255,.40), transparent 35%),' +
          'linear-gradient(145deg,#07111f 0%,#17254a 48%,#3a1f52 100%)';
        return;
      }

      if (mode === 'transparent') {
        this.root.style.background = 'transparent';
        return;
      }

      if ((mode === 'image' || mode === 'panorama') && image) {
        const safe = JSON.stringify(image);

        if (mode === 'panorama') {
          this.root.style.backgroundColor = '#040812';
          this.root.style.backgroundImage =
            'linear-gradient(rgba(4,8,18,.18),rgba(4,8,18,.18)),url(' + safe + ')';
          this.root.style.backgroundSize = '100% 100%, auto 100%';
          this.root.style.backgroundRepeat = 'no-repeat, repeat-x';
          this.updatePanoramaBackground();
        } else {
          this.root.style.backgroundColor = '#040812';
          this.root.style.backgroundImage =
            'linear-gradient(rgba(4,8,18,.12),rgba(4,8,18,.12)),url(' + safe + ')';
          this.root.style.backgroundSize = '100% 100%, cover';
          this.root.style.backgroundPosition = 'center, center';
          this.root.style.backgroundRepeat = 'no-repeat, no-repeat';
        }
        return;
      }

      // If an image / panorama was selected but later removed, fall back to Hi-Tech.
      this.root.dataset.backgroundMode = 'hitech';
    }

    updatePanoramaBackground() {
      if (!this.root || this.backgroundMode !== 'panorama' || !this.backgroundImage) return;
      const normalizedYaw = ((this.yaw % 360) + 360) % 360;
      const position = 50 - (normalizedYaw / 360) * 100;
      this.root.style.backgroundPosition = 'center, ' + position.toFixed(3) + '% center';
    }

    initGl() {
      const gl = this.canvas.getContext('webgl', { antialias: true, alpha: true });
      if (!gl) throw new Error('WebGL не поддерживается этим браузером');
      this.gl = gl;

      const vs = `
        attribute vec3 aPosition;
        attribute vec3 aNormal;
        uniform mat4 uProjection;
        uniform mat4 uModelView;
        varying vec3 vNormal;
        void main() {
          vNormal = mat3(uModelView) * aNormal;
          gl_Position = uProjection * uModelView * vec4(aPosition, 1.0);
        }
      `;

      const fs = `
        precision mediump float;
        varying vec3 vNormal;
        uniform vec3 uColor;
        void main() {
          vec3 n = normalize(vNormal);
          vec3 light = normalize(vec3(0.45, 0.75, 0.65));
          float diffuse = max(dot(n, light), 0.0);
          float rim = pow(1.0 - abs(n.z), 2.0) * 0.18;
          float shade = 0.30 + diffuse * 0.68 + rim;
          gl_FragColor = vec4(uColor * shade, 1.0);
        }
      `;

      const lineVs = `
        attribute vec3 aPosition;
        uniform mat4 uProjection;
        uniform mat4 uModelView;
        void main() {
          gl_Position = uProjection * uModelView * vec4(aPosition, 1.0);
        }
      `;

      const lineFs = `
        precision mediump float;
        uniform vec3 uColor;
        void main() {
          gl_FragColor = vec4(uColor, 1.0);
        }
      `;

      this.program = createProgram(gl, vs, fs);
      this.lineProgram = createProgram(gl, lineVs, lineFs);

      this.positionBuffer = gl.createBuffer();
      this.normalBuffer = gl.createBuffer();
      this.lineBuffer = gl.createBuffer();

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
      this.resize();
    }

    async load(source) {
      this.loading.hidden = false;
      this.loading.textContent = 'Загрузка STL…';
      try {
        const buffer = await sourceToArrayBuffer(source);
        if (this.destroyed) return;
        this.geometry = parseStl(buffer);
        this.uploadGeometry();
        this.stats.textContent =
          this.geometry.triangleCount.toLocaleString('ru-RU') + ' треуг.';
        this.loading.hidden = true;
        this.render();
      } catch (error) {
        this.loading.hidden = false;
        this.loading.textContent = 'Ошибка STL: ' + (error?.message || error);
        throw error;
      }
    }

    uploadGeometry() {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.geometry.positions, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.geometry.normals, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.geometry.lines, gl.STATIC_DRAW);
    }

    bind() {
      this.pointerId = null;
      this.dragging = false;

      this.onPointerDown = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        this.dragging = true;
        this.pointerId = event.pointerId;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.startYaw = this.yaw;
        this.startPitch = this.pitch;
        this.autoRotate = false;
        this.root.classList.add('dragging');
        try { this.root.setPointerCapture(event.pointerId); } catch (_) {}
        this.updateHud();
      };

      this.onPointerMove = (event) => {
        if (!this.dragging || event.pointerId !== this.pointerId) return;
        const dx = event.clientX - this.startX;
        const dy = event.clientY - this.startY;
        this.yaw = this.startYaw + dx * 0.45;
        this.pitch = clamp(this.startPitch + dy * 0.35, -89, 89);
        this.emitChange();
      };

      this.onPointerUp = (event) => {
        if (!this.dragging || event.pointerId !== this.pointerId) return;
        this.dragging = false;
        this.pointerId = null;
        this.root.classList.remove('dragging');
      };

      this.onWheel = (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.10 : 0.90;
        this.zoom = clamp(this.zoom * factor, 0.35, 5);
        this.emitChange();
      };

      this.onKeyDown = (event) => {
        let changed = true;
        if (event.key === 'ArrowLeft') this.yaw -= 5;
        else if (event.key === 'ArrowRight') this.yaw += 5;
        else if (event.key === 'ArrowUp') this.pitch = clamp(this.pitch - 5, -89, 89);
        else if (event.key === 'ArrowDown') this.pitch = clamp(this.pitch + 5, -89, 89);
        else if (event.key === '+' || event.key === '=') this.zoom = clamp(this.zoom * 1.1, 0.35, 5);
        else if (event.key === '-') this.zoom = clamp(this.zoom * 0.9, 0.35, 5);
        else if (event.key.toLowerCase() === 'w') this.wireframe = !this.wireframe;
        else if (event.key === ' ') this.autoRotate = !this.autoRotate;
        else changed = false;
        if (changed) {
          event.preventDefault();
          this.updateHud();
          this.emitChange();
        }
      };

      this.root.addEventListener('pointerdown', this.onPointerDown);
      this.root.addEventListener('pointermove', this.onPointerMove);
      this.root.addEventListener('pointerup', this.onPointerUp);
      this.root.addEventListener('pointercancel', this.onPointerUp);
      this.root.addEventListener('wheel', this.onWheel, { passive: false });
      this.root.addEventListener('keydown', this.onKeyDown);

      this.modeButton.addEventListener('click', () => {
        this.wireframe = !this.wireframe;
        this.updateHud();
        this.emitChange();
      });

      this.autoButton.addEventListener('click', () => {
        this.autoRotate = !this.autoRotate;
        this.updateHud();
        this.emitChange();
      });

      this.resetButton.addEventListener('click', () => {
        this.yaw = 0;
        this.pitch = -15;
        this.zoom = 1;
        this.autoRotate = false;
        this.updateHud();
        this.emitChange();
      });
    }

    updateHud() {
      this.modeButton.textContent = this.wireframe ? 'WIREFRAME' : 'SOLID';
      this.autoButton.textContent = this.autoRotate ? '❚❚' : '▶';
    }

    setColor(color) {
      this.color = normalizeHex(color);
      this.emitChange();
    }

    pick(clientX, clientY) {
      if (!this.geometry?.positions?.length) return null;
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;

      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
      const aspect = rect.width / rect.height;
      const tan = Math.tan((42 * DEG) / 2);
      let direction = normalizeVec([ndcX * aspect * tan, ndcY * tan, -1]);

      const distance = 4.2 / this.zoom;
      let origin = [0, 0, distance];

      // inverse of R = Rx(pitch) * Ry(yaw): R^-1 = Ry(-yaw) * Rx(-pitch)
      origin = rotateXVec(origin, -this.pitch * DEG);
      origin = rotateYVec(origin, -this.yaw * DEG);
      direction = rotateXVec(direction, -this.pitch * DEG);
      direction = rotateYVec(direction, -this.yaw * DEG);
      direction = normalizeVec(direction);

      const pos = this.geometry.positions;
      let bestT = Infinity;
      let best = null;
      for (let i = 0; i + 8 < pos.length; i += 9) {
        const a = [pos[i], pos[i+1], pos[i+2]];
        const b = [pos[i+3], pos[i+4], pos[i+5]];
        const cc = [pos[i+6], pos[i+7], pos[i+8]];
        const t = rayTriangle(origin, direction, a, b, cc);
        if (t !== null && t < bestT) {
          bestT = t;
          best = [
            origin[0] + direction[0] * t,
            origin[1] + direction[1] * t,
            origin[2] + direction[2] * t
          ];
        }
      }
      if (!best) return null;
      return { point: best, screen: this.projectPoint(best) };
    }

    projectPoint(point) {
      if (!point || point.length < 3) return null;
      let v = rotateYVec([Number(point[0])||0, Number(point[1])||0, Number(point[2])||0], this.yaw * DEG);
      v = rotateXVec(v, this.pitch * DEG);
      const distance = 4.2 / this.zoom;
      v[2] -= distance;
      if (v[2] >= -0.05) return { visible:false, x:-100, y:-100, depth:v[2] };

      const rect = this.canvas.getBoundingClientRect();
      const aspect = Math.max(0.001, rect.width / Math.max(1, rect.height));
      const f = 1 / Math.tan((42 * DEG) / 2);
      const ndcX = (v[0] * f / aspect) / (-v[2]);
      const ndcY = (v[1] * f) / (-v[2]);
      const x = (ndcX + 1) * 50;
      const y = (1 - ndcY) * 50;
      return {
        visible: x >= -12 && x <= 112 && y >= -12 && y <= 112,
        x, y, depth:-v[2]
      };
    }

    getState() {
      return {
        yaw: this.yaw,
        pitch: this.pitch,
        zoom: this.zoom,
        wireframe: this.wireframe,
        autoRotate: this.autoRotate,
        color: this.color
      };
    }

    emitChange() {
      if (this.options.onChange) this.options.onChange(this.getState());
    }

    resize() {
      const width = Math.max(1, this.container.clientWidth);
      const height = Math.max(1, this.container.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
        this.canvas.width = pixelWidth;
        this.canvas.height = pixelHeight;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
      }
      if (this.gl) this.gl.viewport(0, 0, pixelWidth, pixelHeight);
    }

    render() {
      if (!this.geometry || this.destroyed) return;

      this.updatePanoramaBackground();

      const gl = this.gl;
      this.resize();
      gl.enable(gl.DEPTH_TEST);
      // STL-файлы на практике нередко содержат смешанное направление граней.
      // Рисуем обе стороны, чтобы модель не получала случайные "дыры".
      gl.disable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const projection = new Float32Array(16);
      perspective(
        projection,
        42 * DEG,
        Math.max(1, this.canvas.width) / Math.max(1, this.canvas.height),
        0.1,
        100
      );

      const ry = new Float32Array(16);
      const rx = new Float32Array(16);
      const rotation = new Float32Array(16);
      const translate = new Float32Array(16);
      const modelView = new Float32Array(16);

      rotationY(ry, this.yaw * DEG);
      rotationX(rx, this.pitch * DEG);
      multiply(rotation, rx, ry);

      const distance = 4.2 / this.zoom;
      translation(translate, 0, 0, -distance);
      multiply(modelView, translate, rotation);

      const rgb = hexRgb(this.color);

      if (!this.wireframe) {
        gl.useProgram(this.program);

        const pLoc = gl.getAttribLocation(this.program, 'aPosition');
        const nLoc = gl.getAttribLocation(this.program, 'aNormal');

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(pLoc);
        gl.vertexAttribPointer(pLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.enableVertexAttribArray(nLoc);
        gl.vertexAttribPointer(nLoc, 3, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uProjection'), false, projection);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uModelView'), false, modelView);
        gl.uniform3fv(gl.getUniformLocation(this.program, 'uColor'), rgb);

        gl.drawArrays(gl.TRIANGLES, 0, this.geometry.positions.length / 3);
      } else {
        gl.disable(gl.CULL_FACE);
        gl.useProgram(this.lineProgram);

        const pLoc = gl.getAttribLocation(this.lineProgram, 'aPosition');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.enableVertexAttribArray(pLoc);
        gl.vertexAttribPointer(pLoc, 3, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.lineProgram, 'uProjection'), false, projection);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.lineProgram, 'uModelView'), false, modelView);
        gl.uniform3fv(gl.getUniformLocation(this.lineProgram, 'uColor'), rgb);

        gl.drawArrays(gl.LINES, 0, this.geometry.lines.length / 3);
      }
    }

    animate() {
      if (this.destroyed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;

      if (this.autoRotate && this.geometry) {
        this.yaw += dt * 28;
        this.emitChange();
      }

      this.render();
      this.animationId = requestAnimationFrame(() => this.animate());
    }

    destroy() {
      this.destroyed = true;
      cancelAnimationFrame(this.animationId);
      this.resizeObserver?.disconnect();

      this.root.removeEventListener('pointerdown', this.onPointerDown);
      this.root.removeEventListener('pointermove', this.onPointerMove);
      this.root.removeEventListener('pointerup', this.onPointerUp);
      this.root.removeEventListener('pointercancel', this.onPointerUp);
      this.root.removeEventListener('wheel', this.onWheel);
      this.root.removeEventListener('keydown', this.onKeyDown);

      const gl = this.gl;
      if (gl) {
        if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
        if (this.normalBuffer) gl.deleteBuffer(this.normalBuffer);
        if (this.lineBuffer) gl.deleteBuffer(this.lineBuffer);
        if (this.program) gl.deleteProgram(this.program);
        if (this.lineProgram) gl.deleteProgram(this.lineProgram);
      }

      this.container.classList.remove('stl-host');
      this.container.innerHTML = '';
    }
  }

  window.StlViewer = StlViewer;
  window.StlTools = {
    parseStl,
    sourceToArrayBuffer
  };
})();
