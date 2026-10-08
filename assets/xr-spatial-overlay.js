(() => {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function visibleElement(element) {
    if (!element || !element.isConnected) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  }

  function safeText(element) {
    return String(element?.innerText || element?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function parsePx(value, fallback = 0) {
    const number = Number.parseFloat(String(value || ''));
    return Number.isFinite(number) ? number : fallback;
  }

  function extractCssImage(style) {
    const value = String(style?.backgroundImage || '');
    const match = value.match(/url\((?:"|')?(.+?)(?:"|')?\)/i);
    return match ? match[1] : '';
  }

  class XRSpatialOverlay {
    constructor(options = {}) {
      this.THREE = options.THREE;
      this.renderer = options.renderer;
      this.scene = options.scene;
      this.camera = options.camera;
      this.root = options.root || null;
      this.distance = clamp(options.distance || 1.55, 0.8, 3);
      this.worldWidth = clamp(options.worldWidth || 1.65, 0.8, 2.5);
      this.active = false;
      this.session = null;
      this.destroyed = false;
      this.rebuildTimer = 0;
      this.meshes = [];
      this.interactiveMeshes = [];
      this.controllers = [];
      this.controllerLines = [];
      this.textureDisposables = new Set();

      if (!this.THREE || !this.renderer || !this.scene || !this.camera || !this.root) return;

      this.group = new this.THREE.Group();
      this.group.name = 'xr-spatial-overlay-fallback';
      this.group.visible = false;
      this.group.renderOrder = 10000;
      this.scene.add(this.group);

      this.raycaster = new this.THREE.Raycaster();
      this.tempMatrix = new this.THREE.Matrix4();
      this.tempPosition = new this.THREE.Vector3();
      this.tempQuaternion = new this.THREE.Quaternion();
      this.tempForward = new this.THREE.Vector3();

      this.observeRoot();
    }

    observeRoot() {
      if (!this.root || typeof MutationObserver === 'undefined') return;
      this.mutationObserver = new MutationObserver(() => {
        if (this.active) this.scheduleRebuild();
      });
      this.mutationObserver.observe(this.root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'src', 'hidden']
      });

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          if (this.active) this.scheduleRebuild();
        });
        this.resizeObserver.observe(this.root);
      }
    }

    scheduleRebuild() {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = setTimeout(() => {
        this.rebuildTimer = 0;
        if (this.active) this.rebuild();
      }, 110);
    }

    supportsDomOverlay(session) {
      return Boolean(session?.domOverlayState);
    }

    attachSession(session) {
      this.session = session || null;
      this.active = Boolean(session) && !this.supportsDomOverlay(session);
      if (!this.group) return this.active;

      this.group.visible = this.active;
      this.root?.classList.toggle('xr-spatial-fallback-active', this.active);

      if (this.active) {
        this.bindControllers();
        this.rebuild();
        this.update();
      } else {
        this.unbindControllers();
        this.clearMeshes();
      }
      return this.active;
    }

    detachSession() {
      this.session = null;
      this.active = false;
      if (this.group) this.group.visible = false;
      this.root?.classList.remove('xr-spatial-fallback-active');
      this.unbindControllers();
      this.clearMeshes();
    }

    bindControllers() {
      if (this.controllers.length || !this.renderer?.xr) return;
      for (let index = 0; index < 2; index++) {
        const controller = this.renderer.xr.getController(index);
        if (!controller) continue;

        const geometry = new this.THREE.BufferGeometry().setFromPoints([
          new this.THREE.Vector3(0, 0, 0),
          new this.THREE.Vector3(0, 0, -3)
        ]);
        const material = new this.THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.7
        });
        const line = new this.THREE.Line(geometry, material);
        line.name = 'xr-spatial-overlay-ray';
        line.layers.enable(1);
        line.layers.enable(2);
        controller.add(line);

        const onSelect = () => this.activateFromController(controller);
        controller.addEventListener('select', onSelect);
        controller.userData.xrSpatialOverlaySelect = onSelect;
        this.scene.add(controller);
        this.controllers.push(controller);
        this.controllerLines.push(line);
      }
    }

    unbindControllers() {
      for (const controller of this.controllers) {
        const handler = controller.userData?.xrSpatialOverlaySelect;
        if (handler) controller.removeEventListener('select', handler);
        if (controller.userData) delete controller.userData.xrSpatialOverlaySelect;
        const line = controller.getObjectByName?.('xr-spatial-overlay-ray');
        if (line) {
          controller.remove(line);
          line.geometry?.dispose?.();
          line.material?.dispose?.();
        }
        this.scene?.remove(controller);
      }
      this.controllers = [];
      this.controllerLines = [];
    }

    activateFromController(controller) {
      if (!this.active || !controller || !this.interactiveMeshes.length) return;
      this.update();
      this.scene.updateMatrixWorld(true);

      this.tempMatrix.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix).normalize();

      const hit = this.raycaster.intersectObjects(this.interactiveMeshes, false)[0];
      if (!hit?.object) return;

      const source = hit.object.userData?.sourceElement;
      if (!source) return;
      const clickable = source.matches?.('button,a,input,[role="button"]')
        ? source
        : (source.querySelector?.('button,a,input,[role="button"]') || source);

      try {
        clickable.click?.();
      } catch (_) {
        clickable.dispatchEvent?.(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
      }

      const gamepad = controller.userData?.inputSource?.gamepad;
      try {
        gamepad?.hapticActuators?.[0]?.pulse?.(0.35, 45);
      } catch (_) {}
    }

    clearMeshes() {
      if (!this.group) return;
      for (const mesh of this.meshes) {
        this.group.remove(mesh);
        mesh.geometry?.dispose?.();
        mesh.material?.dispose?.();
      }
      for (const texture of this.textureDisposables) texture?.dispose?.();
      this.textureDisposables.clear();
      this.meshes = [];
      this.interactiveMeshes = [];
    }

    collectElements() {
      if (!this.root) return [];
      return [...this.root.querySelectorAll(
        '.scene-text-object,.scene-media-object,.screen-hotspot'
      )].filter(visibleElement);
    }

    rootMetrics() {
      const rect = this.root?.getBoundingClientRect?.();
      const width = Math.max(1, rect?.width || window.innerWidth || 1280);
      const height = Math.max(1, rect?.height || window.innerHeight || 720);
      const aspect = width / height;
      const worldHeight = clamp(this.worldWidth / Math.max(0.6, aspect), 0.75, 1.35);
      return { rect, width, height, worldHeight };
    }

    async rebuild() {
      if (!this.active || !this.group || this.destroyed) return;
      const token = Symbol('rebuild');
      this.rebuildToken = token;
      this.clearMeshes();

      const metrics = this.rootMetrics();
      const elements = this.collectElements();

      for (let index = 0; index < elements.length; index++) {
        if (!this.active || this.destroyed || this.rebuildToken !== token) return;
        const element = elements[index];
        const mesh = await this.createElementMesh(element, metrics, index);
        if (!mesh || this.rebuildToken !== token) {
          mesh?.geometry?.dispose?.();
          mesh?.material?.map?.dispose?.();
          mesh?.material?.dispose?.();
          continue;
        }
        this.group.add(mesh);
        this.meshes.push(mesh);
        if (mesh.userData.interactive) this.interactiveMeshes.push(mesh);
      }
      this.update();
    }

    elementWorldBox(element, metrics, index) {
      const rect = element.getBoundingClientRect();
      const rootRect = metrics.rect || { left: 0, top: 0 };
      const centerX = rect.left - rootRect.left + rect.width * 0.5;
      const centerY = rect.top - rootRect.top + rect.height * 0.5;
      const x = (centerX / metrics.width - 0.5) * this.worldWidth;
      const y = (0.5 - centerY / metrics.height) * metrics.worldHeight;
      const width = clamp(rect.width / metrics.width * this.worldWidth, 0.045, this.worldWidth * 0.92);
      const height = clamp(rect.height / metrics.height * metrics.worldHeight, 0.028, metrics.worldHeight * 0.88);
      const zIndex = Number.parseFloat(getComputedStyle(element).zIndex) || 0;
      const z = 0.002 * clamp(zIndex, -100, 100) + index * 0.00015;
      return { x, y, z, width, height };
    }

    createCanvasForElement(element) {
      const rect = element.getBoundingClientRect();
      const aspect = clamp(rect.width / Math.max(1, rect.height), 0.25, 8);
      const height = 384;
      const width = Math.round(clamp(height * aspect, 192, 1536));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
      const words = String(text || '').split(/\s+/).filter(Boolean);
      const lines = [];
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width <= maxWidth || !line) {
          line = test;
        } else {
          lines.push(line);
          line = word;
          if (lines.length >= maxLines) break;
        }
      }
      if (line && lines.length < maxLines) lines.push(line);
      if (words.length && lines.length === maxLines) {
        const last = lines.length - 1;
        while (ctx.measureText(lines[last] + '…').width > maxWidth && lines[last].length > 2) {
          lines[last] = lines[last].slice(0, -1);
        }
        lines[last] += '…';
      }
      lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight, maxWidth));
    }

    async createElementMesh(element, metrics, index) {
      const box = this.elementWorldBox(element, metrics, index);
      const canvas = this.createCanvasForElement(element);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const style = getComputedStyle(element);
      const scaleX = canvas.width / Math.max(1, element.getBoundingClientRect().width);
      const scaleY = canvas.height / Math.max(1, element.getBoundingClientRect().height);
      const radius = Math.max(8, parsePx(style.borderRadius, 12) * Math.min(scaleX, scaleY));
      const background = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? style.backgroundColor
        : (element.classList.contains('screen-hotspot') ? 'rgba(10,16,32,0.88)' : 'rgba(7,10,20,0.72)');

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      roundedRect(ctx, 2, 2, canvas.width - 4, canvas.height - 4, radius);
      ctx.fillStyle = background;
      ctx.fill();

      const borderWidth = Math.max(0, parsePx(style.borderWidth, 0));
      if (borderWidth > 0 || element.classList.contains('screen-hotspot')) {
        ctx.lineWidth = Math.max(2, borderWidth * Math.min(scaleX, scaleY));
        ctx.strokeStyle = style.borderColor || 'rgba(255,255,255,.45)';
        ctx.stroke();
      }

      const imageElement = element.matches('img') ? element : element.querySelector('img');
      const videoElement = element.matches('video') ? element : element.querySelector('video');
      const cssImage = extractCssImage(style);

      let imageDrawn = false;
      if (videoElement && videoElement.readyState >= 2) {
        try {
          ctx.drawImage(videoElement, 8, 8, canvas.width - 16, canvas.height - 16);
          imageDrawn = true;
        } catch (_) {}
      }

      const imageSource = imageElement?.currentSrc || imageElement?.src || cssImage;
      if (!imageDrawn && imageSource) {
        try {
          const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = imageSource;
          });
          const iw = image.naturalWidth || image.width || 1;
          const ih = image.naturalHeight || image.height || 1;
          const targetW = canvas.width - 16;
          const targetH = canvas.height - 16;
          const ratio = Math.min(targetW / iw, targetH / ih);
          const dw = iw * ratio;
          const dh = ih * ratio;
          ctx.drawImage(image, (canvas.width - dw) * 0.5, (canvas.height - dh) * 0.5, dw, dh);
          imageDrawn = true;
        } catch (_) {}
      }

      const text = safeText(element);
      const isHotspot = element.classList.contains('screen-hotspot');
      const isText = element.classList.contains('scene-text-object');
      const shouldDrawText = Boolean(text) && (isHotspot || isText || !imageDrawn);

      if (shouldDrawText) {
        const fontSizePx = parsePx(style.fontSize, isHotspot ? 15 : 20);
        const fontScale = canvas.height / Math.max(1, element.getBoundingClientRect().height);
        const fontSize = clamp(fontSizePx * fontScale, 24, isHotspot ? 58 : 82);
        const weight = style.fontWeight && style.fontWeight !== 'normal' ? style.fontWeight : (isHotspot ? '700' : '600');
        ctx.font = weight + ' ' + Math.round(fontSize) + 'px ' + (style.fontFamily || 'Arial, sans-serif');
        ctx.fillStyle = style.color || '#ffffff';
        ctx.textBaseline = 'top';
        ctx.textAlign = style.textAlign === 'center' ? 'center' : (style.textAlign === 'right' ? 'right' : 'left');
        const padding = clamp(canvas.width * 0.045, 18, 56);
        const x = ctx.textAlign === 'center' ? canvas.width * 0.5 : (ctx.textAlign === 'right' ? canvas.width - padding : padding);
        const maxWidth = canvas.width - padding * 2;
        const lineHeight = fontSize * 1.2;
        const maxLines = Math.max(1, Math.floor((canvas.height - padding * 2) / lineHeight));
        this.drawWrappedText(ctx, text, x, padding, maxWidth, lineHeight, maxLines);
      }

      const texture = new this.THREE.CanvasTexture(canvas);
      texture.colorSpace = this.THREE.SRGBColorSpace;
      texture.minFilter = this.THREE.LinearFilter;
      texture.magFilter = this.THREE.LinearFilter;
      texture.needsUpdate = true;
      this.textureDisposables.add(texture);

      const geometry = new this.THREE.PlaneGeometry(box.width, box.height);
      const material = new this.THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: this.THREE.DoubleSide,
        toneMapped: false
      });
      const mesh = new this.THREE.Mesh(geometry, material);
      mesh.position.set(box.x, box.y, box.z);
      mesh.renderOrder = 10000 + index;
      mesh.layers.enable(1);
      mesh.layers.enable(2);

      const interactive = element.matches('button,a,input,[role="button"],.screen-hotspot,.scene-media-object') ||
        Boolean(element.querySelector('button,a,input,[role="button"]'));
      mesh.userData.interactive = interactive;
      mesh.userData.sourceElement = element;
      return mesh;
    }

    update() {
      if (!this.active || !this.group || !this.renderer?.xr) return;
      const xrCamera = this.renderer.xr.getCamera(this.camera);
      if (!xrCamera) return;

      xrCamera.getWorldPosition(this.tempPosition);
      xrCamera.getWorldQuaternion(this.tempQuaternion);
      this.tempForward.set(0, 0, -1).applyQuaternion(this.tempQuaternion).normalize();

      this.group.position.copy(this.tempPosition).addScaledVector(this.tempForward, this.distance);
      this.group.quaternion.copy(this.tempQuaternion);
      this.group.visible = true;
    }

    refresh() {
      if (this.active) this.scheduleRebuild();
    }

    destroy() {
      this.destroyed = true;
      clearTimeout(this.rebuildTimer);
      this.detachSession();
      this.mutationObserver?.disconnect();
      this.resizeObserver?.disconnect();
      this.clearMeshes();
      if (this.group) {
        this.scene?.remove(this.group);
        this.group = null;
      }
      this.root = null;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
    }
  }

  window.XRSpatialOverlay = XRSpatialOverlay;
})();
