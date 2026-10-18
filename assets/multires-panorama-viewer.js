(() => {
  'use strict';

  const DEG = Math.PI / 180;
  const DEFAULT_THREE_URL = 'assets/three.module.min.js';
  const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));

  async function loadThree(url) {
    if (window.__XR_MEDIA_THREE__) return window.__XR_MEDIA_THREE__;
    const moduleUrl = new URL(url || DEFAULT_THREE_URL, document.baseURI).href;
    const mod = await import(moduleUrl);
    window.__XR_MEDIA_THREE__ = mod;
    return mod;
  }

  class MultiresPanoramaViewer {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) throw new Error('MultiresPanoramaViewer: container not found');

      this.options = {
        basePath: String(options.basePath || ''),
        tileResolution: Math.max(64, Number(options.tileResolution) || 512),
        maxLevel: Math.max(1, Number(options.maxLevel) || 1),
        maxDetailLevel: Math.max(1, Number(options.maxDetailLevel) || Number(options.maxLevel) || 1),
        pixelRatioCap: Math.max(0.75, Number(options.pixelRatioCap) || 1.6),
        cubeResolution: Math.max(256, Number(options.cubeResolution) || 2048),
        yaw: Number(options.yaw) || 0,
        pitch: clamp(options.pitch, -89, 89),
        fov: clamp(options.fov || 100, 30, 110),
        autoRotate: Number(options.autoRotate) || 0,
        threeModuleUrl: options.threeModuleUrl || DEFAULT_THREE_URL,
        onChange: typeof options.onChange === 'function' ? options.onChange : null
      };

      this.yaw = this.options.yaw;
      this.pitch = this.options.pitch;
      this.fov = this.options.fov;
      this.destroyed = false;
      this.dragging = false;
      this.pointerId = null;
      this.currentLevel = 1;
      this.baseMeshes = [];
      this.detailMeshes = [];
      this.detailByKey = new Map();
      this.loadingKeys = new Set();
      this.textureCache = new Map();
      this.lastAutoTime = performance.now();
      this.lastVisibilityUpdate = 0;

      this.build();
      this.ready = this.init();
    }

    build() {
      this.container.innerHTML = '';
      this.container.classList.add('multires-panorama-host');

      this.root = document.createElement('div');
      this.root.className = 'multires-panorama-viewer';
      this.root.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;background:#03060d;touch-action:none';

      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'display:block;width:100%;height:100%';

      this.loading = document.createElement('div');
      this.loading.textContent = 'Загрузка Multires…';
      this.loading.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:9px 13px;border-radius:9px;background:rgba(0,0,0,.55);color:white;font:600 12px system-ui;pointer-events:none';

      this.badge = document.createElement('div');
      this.badge.style.cssText = 'position:absolute;right:12px;top:12px;padding:6px 9px;border-radius:8px;background:rgba(0,0,0,.46);color:#fff;font:700 10px system-ui;pointer-events:none';
      this.badge.textContent = 'MULTIRES';

      this.root.append(this.canvas, this.loading, this.badge);
      this.container.appendChild(this.root);
    }

    async init() {
      if (!this.options.basePath) throw new Error('Multires basePath не задан');
      this.THREE = await loadThree(this.options.threeModuleUrl);
      if (this.destroyed) return;

      const THREE = this.THREE;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(
        this.fov,
        Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight),
        0.01,
        400
      );
      this.camera.rotation.order = 'YXZ';

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.options.pixelRatioCap));
      this.renderer.setClearColor(0x03060d, 1);

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);

      this.bind();
      this.resize();
      await this.buildBaseLevel();
      this.loading.hidden = true;
      this.updateDetailLevel(true);

      this.renderer.setAnimationLoop(() => this.render());
      this.emitChange();
    }

    levelSize(level) {
      const divisor = Math.pow(2, this.options.maxLevel - level);
      return Math.max(1, Math.floor(this.options.cubeResolution / divisor));
    }

    tilePath(level, face, x, y) {
      return this.options.basePath.replace(/\/$/, '') + '/' + level + '/' + face + y + '_' + x + '.jpg';
    }

    facePoint(face, u, v, radius = 100) {
      const sx = u * 2 - 1;
      const sy = 1 - v * 2;
      let x = 0, y = 0, z = 0;
      if (face === 'f') { x = sx; y = sy; z = -1; }
      else if (face === 'b') { x = -sx; y = sy; z = 1; }
      else if (face === 'u') { x = sx; y = 1; z = sy; }
      else if (face === 'd') { x = sx; y = -1; z = -sy; }
      else if (face === 'l') { x = -1; y = sy; z = -sx; }
      else { x = 1; y = sy; z = sx; }
      return new this.THREE.Vector3(x * radius, y * radius, z * radius);
    }

    createTileGeometry(face, x, y, levelSize, tileSize) {
      const x0 = (x * this.options.tileResolution) / levelSize;
      const y0 = (y * this.options.tileResolution) / levelSize;
      const x1 = Math.min(1, (x * this.options.tileResolution + tileSize.width) / levelSize);
      const y1 = Math.min(1, (y * this.options.tileResolution + tileSize.height) / levelSize);

      const p00 = this.facePoint(face, x0, y0);
      const p10 = this.facePoint(face, x1, y0);
      const p11 = this.facePoint(face, x1, y1);
      const p01 = this.facePoint(face, x0, y1);

      const positions = new Float32Array([
        p00.x,p00.y,p00.z, p10.x,p10.y,p10.z, p11.x,p11.y,p11.z,
        p00.x,p00.y,p00.z, p11.x,p11.y,p11.z, p01.x,p01.y,p01.z
      ]);
      const uvs = new Float32Array([
        0,1, 1,1, 1,0,
        0,1, 1,0, 0,0
      ]);

      const g = new this.THREE.BufferGeometry();
      g.setAttribute('position', new this.THREE.BufferAttribute(positions, 3));
      g.setAttribute('uv', new this.THREE.BufferAttribute(uvs, 2));
      g.computeBoundingSphere();
      return g;
    }

    tileCenterDirection(face, x, y, levelSize, width, height) {
      const u = (x * this.options.tileResolution + width * 0.5) / levelSize;
      const v = (y * this.options.tileResolution + height * 0.5) / levelSize;
      return this.facePoint(face, u, v, 1).normalize();
    }

    async loadTexture(url) {
      if (this.textureCache.has(url)) return this.textureCache.get(url);
      const promise = new this.THREE.TextureLoader().loadAsync(url).then((texture) => {
        texture.colorSpace = this.THREE.SRGBColorSpace;
        texture.minFilter = this.THREE.LinearFilter;
        texture.magFilter = this.THREE.LinearFilter;
        texture.generateMipmaps = false;
        return texture;
      });
      this.textureCache.set(url, promise);
      try {
        return await promise;
      } catch (error) {
        this.textureCache.delete(url);
        throw error;
      }
    }

    async buildBaseLevel() {
      const level = 1;
      const size = this.levelSize(level);
      const tiles = Math.ceil(size / this.options.tileResolution);
      const faces = ['f','b','u','d','l','r'];
      const promises = [];

      for (const face of faces) {
        for (let y = 0; y < tiles; y++) {
          for (let x = 0; x < tiles; x++) {
            const width = Math.min(this.options.tileResolution, size - x * this.options.tileResolution);
            const height = Math.min(this.options.tileResolution, size - y * this.options.tileResolution);
            const url = this.tilePath(level, face, x, y);
            promises.push(this.loadTexture(url).then((texture) => {
              if (this.destroyed) return;
              const material = new this.THREE.MeshBasicMaterial({
                map: texture,
                side: this.THREE.DoubleSide,
                depthTest: false,
                depthWrite: false
              });
              const mesh = new this.THREE.Mesh(
                this.createTileGeometry(face, x, y, size, {width,height}),
                material
              );
              mesh.renderOrder = 1;
              this.scene.add(mesh);
              this.baseMeshes.push(mesh);
            }));
          }
        }
      }

      await Promise.all(promises);
    }

    desiredLevel() {
      if (this.options.maxLevel <= 1) return 1;
      const zoom = clamp((110 - this.fov) / 80, 0, 1);
      return clamp(
        1 + Math.round(zoom * (this.options.maxLevel - 1)),
        1,
        Math.min(this.options.maxLevel, this.options.maxDetailLevel)
      );
    }

    clearDetailMeshes() {
      for (const mesh of this.detailMeshes) {
        this.scene?.remove(mesh);
        mesh.geometry?.dispose?.();
        mesh.material?.dispose?.();
      }
      this.detailMeshes = [];
      this.detailByKey.clear();
      this.loadingKeys.clear();
    }

    updateDetailLevel(force = false) {
      if (!this.THREE || !this.camera || this.destroyed) return;
      const level = this.desiredLevel();
      if (level !== this.currentLevel || force) {
        this.currentLevel = level;
        this.clearDetailMeshes();
        this.badge.textContent = 'MULTIRES · L' + level + '/' + Math.min(this.options.maxLevel, this.options.maxDetailLevel);
      }
      if (level <= 1) return;
      this.loadVisibleDetailTiles(level);
    }

    cameraForward() {
      const v = new this.THREE.Vector3(0,0,-1);
      return v.applyQuaternion(this.camera.quaternion).normalize();
    }

    loadVisibleDetailTiles(level) {
      if (level <= 1 || this.destroyed) return;
      const size = this.levelSize(level);
      const tiles = Math.ceil(size / this.options.tileResolution);
      const faces = ['f','b','u','d','l','r'];
      const forward = this.cameraForward();

      // Wider than the visible cone to prefetch neighboring tiles before they enter view.
      const threshold = Math.cos(Math.min(88, this.fov * 0.72 + 25) * DEG);

      for (const face of faces) {
        for (let y = 0; y < tiles; y++) {
          for (let x = 0; x < tiles; x++) {
            const width = Math.min(this.options.tileResolution, size - x * this.options.tileResolution);
            const height = Math.min(this.options.tileResolution, size - y * this.options.tileResolution);
            const center = this.tileCenterDirection(face, x, y, size, width, height);
            if (forward.dot(center) < threshold) continue;

            const key = level + ':' + face + ':' + x + ':' + y;
            if (this.detailByKey.has(key) || this.loadingKeys.has(key)) continue;
            this.loadingKeys.add(key);

            const url = this.tilePath(level, face, x, y);
            this.loadTexture(url).then((texture) => {
              this.loadingKeys.delete(key);
              if (this.destroyed || this.currentLevel !== level) return;
              const material = new this.THREE.MeshBasicMaterial({
                map: texture,
                side: this.THREE.DoubleSide,
                depthTest: false,
                depthWrite: false
              });
              const mesh = new this.THREE.Mesh(
                this.createTileGeometry(face, x, y, size, {width,height}),
                material
              );
              mesh.renderOrder = 10 + level;
              this.scene.add(mesh);
              this.detailMeshes.push(mesh);
              this.detailByKey.set(key, mesh);
            }).catch(() => {
              this.loadingKeys.delete(key);
            });
          }
        }
      }
    }

    bind() {
      this.onPointerDown = (event) => {
        if (this.pointerId != null) return;
        this.pointerId = event.pointerId;
        this.dragging = true;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        this.root.setPointerCapture?.(event.pointerId);
      };

      this.onPointerMove = (event) => {
        if (!this.dragging || event.pointerId !== this.pointerId) return;
        const dx = event.clientX - this.lastX;
        const dy = event.clientY - this.lastY;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        const scale = this.fov / Math.max(320, this.container.clientWidth);
        this.yaw += dx * scale;
        this.pitch = clamp(this.pitch - dy * scale, -89, 89);
        this.updateCameraOrientation();
        this.updateDetailLevel();
        this.emitChange();
      };

      this.onPointerUp = (event) => {
        if (event.pointerId !== this.pointerId) return;
        this.dragging = false;
        this.pointerId = null;
        try { this.root.releasePointerCapture?.(event.pointerId); } catch (_) {}
      };

      this.onWheel = (event) => {
        event.preventDefault();
        this.fov = clamp(this.fov + Math.sign(event.deltaY) * 4, 30, 110);
        if (this.camera) {
          this.camera.fov = this.fov;
          this.camera.updateProjectionMatrix();
        }
        this.updateDetailLevel();
        this.emitChange();
      };

      this.root.addEventListener('pointerdown', this.onPointerDown);
      this.root.addEventListener('pointermove', this.onPointerMove);
      this.root.addEventListener('pointerup', this.onPointerUp);
      this.root.addEventListener('pointercancel', this.onPointerUp);
      this.root.addEventListener('wheel', this.onWheel, {passive:false});
    }

    updateCameraOrientation() {
      if (!this.camera) return;
      this.camera.rotation.set(this.pitch * DEG, -this.yaw * DEG, 0, 'YXZ');
      this.camera.updateMatrixWorld(true);
    }

    resize() {
      if (!this.camera || !this.renderer) return;
      const w = Math.max(1, this.container.clientWidth);
      const h = Math.max(1, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    }

    render() {
      if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;
      const now = performance.now();
      if (!this.dragging && this.options.autoRotate) {
        const dt = Math.min(0.05, Math.max(0, (now - this.lastAutoTime) / 1000));
        this.yaw += this.options.autoRotate * dt;
        this.updateCameraOrientation();
      }
      this.lastAutoTime = now;

      if (now - this.lastVisibilityUpdate > 180) {
        this.lastVisibilityUpdate = now;
        this.updateDetailLevel();
      }
      this.renderer.render(this.scene, this.camera);
    }

    getState() {
      return {
        yaw: this.yaw,
        pitch: this.pitch,
        fov: this.fov,
        aspect: Math.max(0.001, this.container.clientWidth / Math.max(1, this.container.clientHeight)),
        projection: '360',
        multiresLevel: this.currentLevel,
        multiresMaxLevel: this.options.maxLevel
      };
    }

    viewToScreen(yaw, pitch) {
      if (!this.THREE || !this.camera) return null;
      this.updateCameraOrientation();
      const yy = (Number(yaw) || 0) * DEG;
      const pp = clamp(pitch, -89, 89) * DEG;
      const direction = new this.THREE.Vector3(0,0,-1).applyEuler(
        new this.THREE.Euler(pp, -yy, 0, 'YXZ')
      );
      const point = direction.multiplyScalar(20).project(this.camera);
      const x = (point.x + 1) * 50;
      const y = (1 - point.y) * 50;
      return {
        x, y, depth: point.z,
        visible: point.z >= -1 && point.z <= 1 && x >= -12 && x <= 112 && y >= -12 && y <= 112
      };
    }

    emitChange() {
      this.options.onChange?.(this.getState());
    }

    destroy() {
      this.destroyed = true;
      this.renderer?.setAnimationLoop(null);
      this.resizeObserver?.disconnect();

      this.root?.removeEventListener('pointerdown', this.onPointerDown);
      this.root?.removeEventListener('pointermove', this.onPointerMove);
      this.root?.removeEventListener('pointerup', this.onPointerUp);
      this.root?.removeEventListener('pointercancel', this.onPointerUp);
      this.root?.removeEventListener('wheel', this.onWheel);

      this.clearDetailMeshes();
      for (const mesh of this.baseMeshes) {
        this.scene?.remove(mesh);
        mesh.geometry?.dispose?.();
        mesh.material?.dispose?.();
      }
      this.baseMeshes = [];

      for (const value of this.textureCache.values()) {
        Promise.resolve(value).then((texture) => texture?.dispose?.()).catch(() => {});
      }
      this.textureCache.clear();

      this.renderer?.dispose?.();
      this.renderer?.forceContextLoss?.();
      this.container?.classList.remove('multires-panorama-host');
      if (this.container) this.container.innerHTML = '';
    }
  }

  window.MultiresPanoramaViewer = MultiresPanoramaViewer;
})();