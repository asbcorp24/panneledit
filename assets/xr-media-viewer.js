(() => {
  'use strict';

  const DEFAULT_THREE_URL = 'assets/three.module.min.js';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const DEG = Math.PI / 180;

  async function loadThree(url) {
    if (window.__XR_MEDIA_THREE__) return window.__XR_MEDIA_THREE__;
    const moduleUrl = new URL(url || DEFAULT_THREE_URL, document.baseURI).href;
    const mod = await import(moduleUrl);
    window.__XR_MEDIA_THREE__ = mod;
    return mod;
  }

  function isVideoSource(kind, source) {
    if (kind === 'video') return true;
    if (kind === 'image') return false;
    return /^data:video\//i.test(String(source || '')) || /\.(mp4|webm|mov)(?:$|[?#])/i.test(String(source || ''));
  }

  class XRMediaViewer {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) throw new Error('XRMediaViewer: container not found');

      this.options = {
        source: String(options.source || ''),
        kind: options.kind === 'image' ? 'image' : (options.kind === 'video' ? 'video' : 'auto'),
        projection: String(options.projection || '360').toUpperCase(),
        yaw: Number(options.yaw) || 0,
        pitch: clamp(options.pitch, -89, 89),
        fov: clamp(options.fov || 80, 35, 110),
        autoplay: Boolean(options.autoplay),
        loop: Boolean(options.loop),
        muted: options.muted !== false,
        volume: clamp(options.volume ?? 80, 0, 100),
        controls: options.controls !== false,
        motionControls: options.motionControls !== false,
        autoRotate: Number(options.autoRotate) || 0,
        yawDirection: options.yawDirection === 'right-positive' ? 'right-positive' : 'native',
        threeModuleUrl: options.threeModuleUrl || DEFAULT_THREE_URL,
        domOverlayRoot: options.domOverlayRoot && options.domOverlayRoot.nodeType === 1 ? options.domOverlayRoot : null,
        onChange: typeof options.onChange === 'function' ? options.onChange : null,
        onReady: typeof options.onReady === 'function' ? options.onReady : null
      };

      this.yaw = this.options.yaw;
      this.pitch = this.options.pitch;
      this.fov = this.options.fov;
      this.cardboard = false;
      this.destroyed = false;
      this.dragging = false;
      this.pointerId = null;
      this.xrSession = null;
      this.deviceQuaternion = null;
      this.screenOrientation = 0;
      this.lastRenderTime = performance.now();
      this.mediaKind = isVideoSource(this.options.kind, this.options.source) ? 'video' : 'image';
      this.stereo = /_(LR|TB)$/.test(this.options.projection);
      this.is180 = this.options.projection.startsWith('180');
      this.flat = this.options.projection.startsWith('FLAT_');

      this.build();
      this.ready = this.init();
    }

    build() {
      this.container.innerHTML = '';
      this.container.classList.add('xr-media-host');

      this.root = document.createElement('div');
      this.root.className = 'xr-media-viewer';
      this.root.tabIndex = 0;

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'xr-media-canvas';

      this.loading = document.createElement('div');
      this.loading.className = 'xr-media-loading';
      this.loading.textContent = 'Загрузка XR…';

      this.hud = document.createElement('div');
      this.hud.className = 'xr-media-hud';

      this.projectionLabel = document.createElement('span');
      this.projectionLabel.className = 'xr-media-projection';
      this.projectionLabel.textContent = this.options.projection;

      this.hint = document.createElement('span');
      this.hint.className = 'xr-media-hint';
      this.hint.textContent = 'Drag — обзор · колесо — FOV';

      this.playButton = document.createElement('button');
      this.playButton.type = 'button';
      this.playButton.className = 'xr-media-btn';
      this.playButton.title = 'Воспроизведение';
      this.playButton.textContent = '▶';

      this.resetButton = document.createElement('button');
      this.resetButton.type = 'button';
      this.resetButton.className = 'xr-media-btn';
      this.resetButton.title = 'Сбросить направление';
      this.resetButton.textContent = '⌂';

      this.cardboardButton = document.createElement('button');
      this.cardboardButton.type = 'button';
      this.cardboardButton.className = 'xr-media-btn xr-cardboard-btn';
      this.cardboardButton.textContent = 'CARDBOARD';

      this.xrButton = document.createElement('button');
      this.xrButton.type = 'button';
      this.xrButton.className = 'xr-media-btn xr-enter-btn';
      this.xrButton.textContent = 'XR';
      this.xrButton.disabled = true;

      this.hud.append(
        this.projectionLabel,
        this.hint,
        this.playButton,
        this.resetButton,
        this.cardboardButton,
        this.xrButton
      );

      this.root.append(this.canvas, this.loading, this.hud);
      this.container.appendChild(this.root);
    }

    async init() {
      if (!this.options.source) throw new Error('XR источник не задан');
      this.THREE = await loadThree(this.options.threeModuleUrl);
      if (this.destroyed) return;

      const THREE = this.THREE;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(
        this.fov,
        Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight),
        0.01,
        300
      );
      this.camera.rotation.order = 'YXZ';

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.xr.enabled = true;
      this.renderer.setClearColor(0x03060d, 1);

      this.spatialOverlay = window.XRSpatialOverlay && this.options.domOverlayRoot
        ? new XRSpatialOverlay({
            THREE,
            renderer: this.renderer,
            scene: this.scene,
            camera: this.camera,
            root: this.options.domOverlayRoot
          })
        : null;

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);

      await this.createTexture();
      this.buildProjection();
      this.bind();
      this.resize();
      await this.updateXrAvailability();

      this.loading.hidden = true;
      if (this.options.onReady) this.options.onReady(this.getState());
      this.renderer.setAnimationLoop(() => this.render());

      if (this.mediaKind === 'video' && this.options.autoplay) {
        this.video.play().catch(() => {});
      }
    }

    async createTexture() {
      const THREE = this.THREE;

      if (this.mediaKind === 'video') {
        this.video = document.createElement('video');
        this.video.src = this.options.source;
        this.video.crossOrigin = 'anonymous';
        this.video.loop = this.options.loop;
        this.video.muted = this.options.muted;
        this.video.volume = this.options.volume / 100;
        this.video.playsInline = true;
        this.video.preload = 'metadata';

        await new Promise((resolve, reject) => {
          const ok = () => { cleanup(); resolve(); };
          const bad = () => { cleanup(); reject(new Error('Не удалось загрузить XR-видео')); };
          const cleanup = () => {
            this.video.removeEventListener('loadeddata', ok);
            this.video.removeEventListener('error', bad);
          };
          this.video.addEventListener('loadeddata', ok, { once: true });
          this.video.addEventListener('error', bad, { once: true });
          this.video.load();
        });

        this.texture = new THREE.VideoTexture(this.video);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = false;
        return;
      }

      this.texture = await new THREE.TextureLoader().loadAsync(this.options.source);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.generateMipmaps = false;
    }

    makeMaterial(eye = 'left') {
      const THREE = this.THREE;
      const projection = this.options.projection;
      const isLR = /_LR$/.test(projection);
      const isTB = /_TB$/.test(projection);

      const scaleX = isLR ? 0.5 : 1;
      const scaleY = isTB ? 0.5 : 1;
      const offsetX = isLR && eye === 'right' ? 0.5 : 0;
      const offsetY = isTB && eye === 'left' ? 0.5 : 0;

      return new THREE.ShaderMaterial({
        // Spherical geometry is mirrored in createGeometry(), so the
        // front faces point inward and can use normal FrontSide rendering.
        side: THREE.FrontSide,
        uniforms: {
          map: { value: this.texture },
          uvScale: { value: new THREE.Vector2(scaleX, scaleY) },
          uvOffset: { value: new THREE.Vector2(offsetX, offsetY) }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          uniform vec2 uvScale;
          uniform vec2 uvOffset;
          varying vec2 vUv;
          void main() {
            vec2 uv = vUv * uvScale + uvOffset;
            gl_FragColor = texture2D(map, uv);
          }
        `
      });
    }

    createGeometry() {
      const THREE = this.THREE;
      if (this.flat) {
        const aspect = this.getEyeAspect();
        const height = 2.4;
        return new THREE.PlaneGeometry(height * aspect, height);
      }
      if (this.is180) {
        const geometry = new THREE.SphereGeometry(
          100, 64, 40,
          Math.PI, Math.PI,
          0, Math.PI
        );
        geometry.scale(-1, 1, 1);
        return geometry;
      }

      const geometry = new THREE.SphereGeometry(100, 64, 40);
      geometry.scale(-1, 1, 1);
      return geometry;
    }

    getEyeAspect() {
      let width = 16;
      let height = 9;
      if (this.mediaKind === 'video' && this.video?.videoWidth && this.video?.videoHeight) {
        width = this.video.videoWidth;
        height = this.video.videoHeight;
      } else if (this.texture?.image?.naturalWidth && this.texture?.image?.naturalHeight) {
        width = this.texture.image.naturalWidth;
        height = this.texture.image.naturalHeight;
      } else if (this.texture?.image?.width && this.texture?.image?.height) {
        width = this.texture.image.width;
        height = this.texture.image.height;
      }
      if (/_LR$/.test(this.options.projection)) width /= 2;
      if (/_TB$/.test(this.options.projection)) height /= 2;
      return Math.max(0.2, width / Math.max(1, height));
    }

    buildProjection() {
      const THREE = this.THREE;
      this.disposeMeshes();

      const leftGeometry = this.createGeometry();
      const leftMaterial = this.makeMaterial('left');
      this.leftMesh = new THREE.Mesh(leftGeometry, leftMaterial);
      if (this.flat) {
        this.leftMesh.position.set(0, 0, -3.2);
      } else if (!this.is180) {
        // Three SphereGeometry puts the center of an equirectangular
        // texture 90 degrees away from the default -Z view.
        this.leftMesh.rotation.y = -Math.PI / 2;
      }
      this.leftMesh.layers.enable(0);
      this.leftMesh.layers.enable(1);
      this.scene.add(this.leftMesh);

      if (this.stereo) {
        const rightGeometry = this.createGeometry();
        const rightMaterial = this.makeMaterial('right');
        this.rightMesh = new THREE.Mesh(rightGeometry, rightMaterial);
        if (this.flat) {
          this.rightMesh.position.set(0, 0, -3.2);
        } else if (!this.is180) {
          this.rightMesh.rotation.y = -Math.PI / 2;
        }
        this.rightMesh.layers.set(2);
        this.scene.add(this.rightMesh);
      } else {
        this.leftMesh.layers.enable(2);
      }

      this.projectionLabel.textContent = this.options.projection;
    }

    disposeMeshes() {
      for (const mesh of [this.leftMesh, this.rightMesh]) {
        if (!mesh) continue;
        this.scene?.remove(mesh);
        mesh.geometry?.dispose?.();
        mesh.material?.dispose?.();
      }
      this.leftMesh = null;
      this.rightMesh = null;
    }

    bind() {
      this.onPointerDown = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        this.dragging = true;
        this.pointerId = event.pointerId;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.startYaw = this.yaw;
        this.startPitch = this.pitch;
        this.root.classList.add('dragging');
        try { this.root.setPointerCapture(event.pointerId); } catch (_) {}
      };

      this.onPointerMove = (event) => {
        if (!this.dragging || event.pointerId !== this.pointerId || this.cardboard || this.xrSession) return;
        const dx = event.clientX - this.startX;
        const dy = event.clientY - this.startY;
        const yawDelta = dx * 0.18;
        this.yaw = this.startYaw + (this.options.yawDirection === 'right-positive' ? yawDelta : -yawDelta);
        this.pitch = clamp(this.startPitch - dy * 0.16, -89, 89);
        this.emitChange();
      };

      this.onPointerUp = (event) => {
        if (!this.dragging || event.pointerId !== this.pointerId) return;
        this.dragging = false;
        this.pointerId = null;
        this.root.classList.remove('dragging');
      };

      this.onWheel = (event) => {
        if (this.cardboard || this.xrSession) return;
        event.preventDefault();
        this.fov = clamp(this.fov + Math.sign(event.deltaY) * 3, 35, 110);
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();
        this.emitChange();
      };

      this.onOrientation = (event) => {
        if (!this.THREE || event.alpha == null || event.beta == null || event.gamma == null) return;
        const THREE = this.THREE;
        const zee = new THREE.Vector3(0, 0, 1);
        const euler = new THREE.Euler();
        const q0 = new THREE.Quaternion();
        const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
        const alpha = event.alpha * DEG;
        const beta = event.beta * DEG;
        const gamma = event.gamma * DEG;
        const orient = (screen.orientation?.angle || window.orientation || 0) * DEG;
        euler.set(beta, alpha, -gamma, 'YXZ');
        const q = new THREE.Quaternion().setFromEuler(euler);
        q.multiply(q1);
        q.multiply(q0.setFromAxisAngle(zee, -orient));
        this.deviceQuaternion = q;
      };

      this.root.addEventListener('pointerdown', this.onPointerDown);
      this.root.addEventListener('pointermove', this.onPointerMove);
      this.root.addEventListener('pointerup', this.onPointerUp);
      this.root.addEventListener('pointercancel', this.onPointerUp);
      this.root.addEventListener('wheel', this.onWheel, { passive: false });

      this.playButton.addEventListener('click', () => this.togglePlay());
      this.resetButton.addEventListener('click', () => this.resetView());
      this.cardboardButton.addEventListener('click', () => this.toggleCardboard());
      this.xrButton.addEventListener('click', () => this.toggleXR());

      if (this.mediaKind !== 'video') this.playButton.hidden = true;
    }

    async requestMotionPermission() {
      if (!this.options.motionControls) return false;
      const DOE = window.DeviceOrientationEvent;
      if (!DOE) return false;
      if (typeof DOE.requestPermission === 'function') {
        try {
          const result = await DOE.requestPermission();
          if (result !== 'granted') return false;
        } catch (_) {
          return false;
        }
      }
      window.addEventListener('deviceorientation', this.onOrientation, true);
      return true;
    }

    async toggleCardboard() {
      if (this.xrSession) return;
      this.cardboard = !this.cardboard;
      this.root.classList.toggle('cardboard-active', this.cardboard);
      this.cardboardButton.classList.toggle('active', this.cardboard);
      this.cardboardButton.textContent = this.cardboard ? 'ВЫХОД' : 'CARDBOARD';

      if (this.cardboard) {
        await this.requestMotionPermission();
        try {
          if (this.root.requestFullscreen && !document.fullscreenElement) {
            await this.root.requestFullscreen();
          }
        } catch (_) {}
      } else {
        this.deviceQuaternion = null;
        try {
          if (document.fullscreenElement === this.root) await document.exitFullscreen();
        } catch (_) {}
      }
    }

    async updateXrAvailability() {
      if (!navigator.xr || !window.isSecureContext) {
        this.xrButton.disabled = true;
        this.xrButton.title = 'WebXR требует HTTPS и совместимый браузер';
        return;
      }
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        this.xrButton.disabled = !supported;
        this.xrButton.title = supported ? 'Открыть immersive WebXR' : 'immersive-vr недоступен';
      } catch (_) {
        this.xrButton.disabled = true;
      }
    }

    async toggleXR() {
      if (!navigator.xr || !this.renderer) return;
      if (this.xrSession) {
        await this.xrSession.end().catch(() => {});
        return;
      }

      if (this.cardboard) {
        this.cardboard = false;
        this.cardboardButton.classList.remove('active');
        this.cardboardButton.textContent = 'CARDBOARD';
      }

      try {
        const sessionInit = {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
        };
        if (this.options.domOverlayRoot) {
          sessionInit.optionalFeatures.push('dom-overlay');
          sessionInit.domOverlay = { root: this.options.domOverlayRoot };
        }
        const session = await navigator.xr.requestSession('immersive-vr', sessionInit);

        // Three.js adds eye layers 1 / 2 to the layer mask inherited from
        // the user camera. Remove the ordinary layer 0 while presenting,
        // otherwise a stereo left-eye mesh placed on 0+1 would also be
        // visible to the right-eye XR camera through layer 0.
        this.camera.layers.disableAll();

        this.xrSession = session;
        this.options.domOverlayRoot?.classList.add('xr-dom-overlay-active');
        this.xrButton.classList.add('active');
        this.xrButton.textContent = 'ВЫХОД XR';
        await this.renderer.xr.setSession(session);
        this.spatialOverlay?.attachSession(session);
        session.addEventListener('end', () => {
          this.xrSession = null;
          this.spatialOverlay?.detachSession();
          this.options.domOverlayRoot?.classList.remove('xr-dom-overlay-active');
          this.camera?.layers.set(0);
          this.xrButton.classList.remove('active');
          this.xrButton.textContent = 'XR';
        }, { once: true });
      } catch (error) {
        this.spatialOverlay?.detachSession();
        this.options.domOverlayRoot?.classList.remove('xr-dom-overlay-active');
        this.camera?.layers.set(0);
        console.warn('WebXR:', error);
      }
    }

    togglePlay() {
      if (!this.video) return;
      if (this.video.paused) this.video.play().catch(() => {});
      else this.video.pause();
      this.updatePlayButton();
    }

    updatePlayButton() {
      if (!this.video) return;
      this.playButton.textContent = this.video.paused ? '▶' : '❚❚';
    }

    resetView() {
      this.yaw = this.options.yaw || 0;
      this.pitch = this.options.pitch || 0;
      this.fov = this.options.fov || 80;
      if (this.camera) {
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();
      }
      this.emitChange();
    }

    logicalYawToCameraYaw(yaw = this.yaw) {
      return this.options.yawDirection === 'right-positive' ? -Number(yaw || 0) : Number(yaw || 0);
    }

    cameraYawToLogicalYaw(cameraYaw = 0) {
      return this.options.yawDirection === 'right-positive' ? -Number(cameraYaw || 0) : Number(cameraYaw || 0);
    }

    updateCameraOrientation() {
      if (!this.camera || this.xrSession) return;
      const THREE = this.THREE;
      const cameraYaw = this.logicalYawToCameraYaw(this.yaw);
      if (this.cardboard && this.deviceQuaternion) {
        const offset = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          this.pitch * DEG,
          cameraYaw * DEG,
          0,
          'YXZ'
        ));
        this.camera.quaternion.copy(this.deviceQuaternion).premultiply(offset);
        return;
      }
      this.camera.rotation.set(this.pitch * DEG, cameraYaw * DEG, 0, 'YXZ');
    }

    render() {
      if (this.destroyed || !this.renderer || !this.scene || !this.camera) return;

      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0, (now - this.lastRenderTime) / 1000));
      this.lastRenderTime = now;
      if (this.options.autoRotate && !this.dragging && !this.cardboard && !this.xrSession) {
        this.yaw += this.options.autoRotate * dt;
        this.emitChange();
      }

      this.resize();
      this.updateCameraOrientation();
      if (this.video) this.updatePlayButton();

      if (this.xrSession || this.renderer.xr.isPresenting) {
        this.spatialOverlay?.update();
        this.renderer.setScissorTest(false);
        // WebXR owns the eye viewport. Do not override it with drawing-buffer
        // dimensions because WebGLRenderer applies devicePixelRatio internally.
        this.renderer.render(this.scene, this.camera);
        return;
      }

      if (!this.cardboard) {
        this.camera.layers.set(0);
        this.renderer.setScissorTest(false);
        // renderer.setSize() already restored the full viewport in CSS pixels.
        // Passing canvas.width/canvas.height here would apply DPR twice.
        this.renderer.render(this.scene, this.camera);
        return;
      }

      const width = Math.max(1, this.container.clientWidth);
      const height = Math.max(1, this.container.clientHeight);
      const half = Math.floor(width / 2);
      const aspect = half / Math.max(1, height);

      this.renderer.setScissorTest(true);

      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.camera.layers.set(1);
      this.renderer.setViewport(0, 0, half, height);
      this.renderer.setScissor(0, 0, half, height);
      this.renderer.render(this.scene, this.camera);

      this.camera.layers.set(this.stereo ? 2 : 1);
      this.renderer.setViewport(half, 0, width - half, height);
      this.renderer.setScissor(half, 0, width - half, height);
      this.renderer.render(this.scene, this.camera);

      this.renderer.setScissorTest(false);
    }

    resize() {
      if (!this.renderer || !this.camera) return;
      const width = Math.max(1, this.container.clientWidth);
      const height = Math.max(1, this.container.clientHeight);
      this.renderer.setSize(width, height, false);
      if (!this.cardboard && !this.xrSession) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
      }
    }

    getState() {
      return {
        yaw: this.yaw,
        pitch: this.pitch,
        fov: this.fov,
        aspect: Math.max(0.001, this.container.clientWidth / Math.max(1, this.container.clientHeight)),
        projection: this.options.projection,
        cardboard: this.cardboard,
        xr: Boolean(this.xrSession)
      };
    }

    screenToView(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || !this.THREE || !this.camera) {
        return { yaw: this.yaw, pitch: this.pitch };
      }

      this.updateCameraOrientation();
      this.camera.updateMatrixWorld(true);

      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const point = new this.THREE.Vector3(nx, ny, 0.5).unproject(this.camera);
      const direction = point.sub(this.camera.position).normalize();

      const bearingRightPositive = Math.atan2(direction.x, -direction.z) / DEG;
      const cameraYaw = -bearingRightPositive;
      const logicalYaw = this.cameraYawToLogicalYaw(cameraYaw);
      const pitch = Math.asin(clamp(direction.y, -1, 1)) / DEG;

      return {
        yaw: ((logicalYaw + 540) % 360) - 180,
        pitch: clamp(pitch, -89, 89)
      };
    }

    viewToScreen(yaw, pitch) {
      if (!this.THREE || !this.camera || !this.canvas) return null;
      this.updateCameraOrientation();
      this.camera.updateMatrixWorld(true);

      const logicalYaw = Number(yaw) || 0;
      const cameraYaw = this.logicalYawToCameraYaw(logicalYaw) * DEG;
      const pointPitch = clamp(pitch, -89, 89) * DEG;
      const direction = new this.THREE.Vector3(0, 0, -1).applyEuler(
        new this.THREE.Euler(pointPitch, cameraYaw, 0, 'YXZ')
      );
      const point = direction.multiplyScalar(20).project(this.camera);
      const x = (point.x + 1) * 50;
      const y = (1 - point.y) * 50;

      return {
        x,
        y,
        depth: point.z,
        visible: point.z >= -1 && point.z <= 1 && x >= -12 && x <= 112 && y >= -12 && y <= 112
      };
    }

    emitChange() {
      if (this.options.onChange) this.options.onChange(this.getState());
    }

    async setProjection(projection) {
      const value = String(projection || '360').toUpperCase();
      this.options.projection = value;
      this.stereo = /_(LR|TB)$/.test(value);
      this.is180 = value.startsWith('180');
      this.flat = value.startsWith('FLAT_');
      if (this.THREE) this.buildProjection();
      this.emitChange();
    }

    destroy() {
      this.destroyed = true;
      try { this.xrSession?.end(); } catch (_) {}
      this.xrSession = null;
      this.renderer?.setAnimationLoop(null);
      this.resizeObserver?.disconnect();

      window.removeEventListener('deviceorientation', this.onOrientation, true);
      this.root?.removeEventListener('pointerdown', this.onPointerDown);
      this.root?.removeEventListener('pointermove', this.onPointerMove);
      this.root?.removeEventListener('pointerup', this.onPointerUp);
      this.root?.removeEventListener('pointercancel', this.onPointerUp);
      this.root?.removeEventListener('wheel', this.onWheel);

      if (this.video) {
        try { this.video.pause(); } catch (_) {}
        this.video.removeAttribute('src');
        this.video.load();
      }

      this.spatialOverlay?.destroy();
      this.spatialOverlay = null;
      this.disposeMeshes();
      this.texture?.dispose?.();
      this.renderer?.dispose?.();
      this.container?.classList.remove('xr-media-host');
      if (this.container) this.container.innerHTML = '';
    }
  }

  window.XRMediaViewer = XRMediaViewer;
})();
