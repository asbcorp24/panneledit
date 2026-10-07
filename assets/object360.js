(() => {
  'use strict';

  class Object360Viewer {
    constructor(container, options = {}) {
      this.container = typeof container === 'string'
        ? document.getElementById(container)
        : container;
      if (!this.container) throw new Error('Object360Viewer: container not found');

      this.options = {
        sectors: Math.max(1, Number(options.sectors) || 36),
        rows: Math.max(1, Number(options.rows) || 1),
        frames: Array.isArray(options.frames) ? options.frames : [],
        startSector: Math.max(0, Number(options.startSector) || 0),
        startRow: Math.max(0, Number(options.startRow) || 0),
        dragPixelsPerFrame: Math.max(2, Number(options.dragPixelsPerFrame) || 9),
        rowDragPixels: Math.max(20, Number(options.rowDragPixels) || 70),
        autoplay: Boolean(options.autoplay),
        autoplayMs: Math.max(30, Number(options.autoplayMs) || 100),
        minZoom: Math.max(0.25, Number(options.minZoom) || 0.7),
        maxZoom: Math.max(1, Number(options.maxZoom) || 4),
        backgroundMode: ['hitech','black','light','transparent','color','image'].includes(String(options.backgroundMode))
          ? String(options.backgroundMode)
          : 'hitech',
        backgroundColor: /^#[0-9a-f]{6}$/i.test(String(options.backgroundColor || ''))
          ? String(options.backgroundColor)
          : '#ffffff',
        backgroundImage: String(options.backgroundImage || ''),
        onFrameChange: typeof options.onFrameChange === 'function' ? options.onFrameChange : null
      };

      this.sector = Math.min(this.options.sectors - 1, this.options.startSector);
      this.row = Math.min(this.options.rows - 1, this.options.startRow);
      this.zoom = 1;
      this.dragging = false;
      this.pointerId = null;
      this.startX = 0;
      this.startY = 0;
      this.startSector = this.sector;
      this.startRow = this.row;
      this.autoplayTimer = null;

      this.build();
      this.bind();
      this.preloadNeighbours();
      this.render();
      if (this.options.autoplay) this.startAutoplay();
    }

    build() {
      this.container.innerHTML = '';
      this.container.classList.add('object360-host');

      this.root = document.createElement('div');
      this.root.className = 'object360-viewer';
      this.root.tabIndex = 0;
      this.applyBackground();

      this.imageWrap = document.createElement('div');
      this.imageWrap.className = 'object360-image-wrap';

      this.image = document.createElement('img');
      this.image.className = 'object360-image';
      this.image.draggable = false;
      this.image.alt = 'Объект 360°';

      this.loading = document.createElement('div');
      this.loading.className = 'object360-loading';
      this.loading.textContent = 'Загрузка кадра…';

      this.hud = document.createElement('div');
      this.hud.className = 'object360-hud';

      this.counter = document.createElement('span');
      this.counter.className = 'object360-counter';

      this.rowLabel = document.createElement('span');
      this.rowLabel.className = 'object360-row-label';

      this.hint = document.createElement('span');
      this.hint.className = 'object360-hint';
      this.hint.textContent = 'Drag ← → вращение · ↑ ↓ уровень · колесо масштаб';

      this.autoplayButton = document.createElement('button');
      this.autoplayButton.type = 'button';
      this.autoplayButton.className = 'object360-autoplay';
      this.autoplayButton.textContent = '▶';

      this.resetButton = document.createElement('button');
      this.resetButton.type = 'button';
      this.resetButton.className = 'object360-reset';
      this.resetButton.textContent = '1:1';

      this.imageWrap.append(this.image, this.loading);
      this.hud.append(this.counter, this.rowLabel, this.hint, this.autoplayButton, this.resetButton);
      this.root.append(this.imageWrap, this.hud);
      this.container.append(this.root);

      this.image.addEventListener('load', () => {
        this.loading.hidden = true;
      });
      this.image.addEventListener('error', () => {
        this.loading.hidden = false;
        this.loading.textContent = 'Кадр отсутствует';
      });
    }

    applyBackground() {
      const mode = this.options.backgroundMode;
      this.root.style.backgroundImage = '';
      this.root.style.backgroundColor = '';
      this.root.style.backgroundSize = '';
      this.root.style.backgroundPosition = '';

      if (mode === 'black') {
        this.root.style.background = '#000000';
      } else if (mode === 'light') {
        this.root.style.background = '#f4f6fa';
      } else if (mode === 'transparent') {
        this.root.style.background = 'transparent';
      } else if (mode === 'color') {
        this.root.style.background = this.options.backgroundColor || '#ffffff';
      } else if (mode === 'image' && this.options.backgroundImage) {
        this.root.style.background =
          'center / cover no-repeat url("' + this.options.backgroundImage.replace(/"/g, '%22') + '")';
      }
    }

    bind() {
      this.onPointerDown = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        this.dragging = true;
        this.pointerId = event.pointerId;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.startSector = this.sector;
        this.startRow = this.row;
        this.root.classList.add('dragging');
        try { this.root.setPointerCapture(event.pointerId); } catch (_) {}
        this.stopAutoplay();
      };

      this.onPointerMove = (event) => {
        if (!this.dragging || (this.pointerId !== null && event.pointerId !== this.pointerId)) return;
        const dx = event.clientX - this.startX;
        const dy = event.clientY - this.startY;

        const sectorDelta = Math.round(dx / this.options.dragPixelsPerFrame);
        this.setSector(this.startSector - sectorDelta);

        if (this.options.rows > 1) {
          const rowDelta = Math.round(dy / this.options.rowDragPixels);
          this.setRow(this.startRow - rowDelta);
        }
      };

      this.onPointerUp = (event) => {
        if (!this.dragging) return;
        if (this.pointerId !== null && event.pointerId !== this.pointerId) return;
        this.dragging = false;
        this.pointerId = null;
        this.root.classList.remove('dragging');
      };

      this.onWheel = (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.1 : 0.9;
        this.setZoom(this.zoom * factor);
      };

      this.onKeyDown = (event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this.setSector(this.sector - 1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          this.setSector(this.sector + 1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.setRow(this.row + 1);
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          this.setRow(this.row - 1);
        } else if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          this.setZoom(this.zoom * 1.1);
        } else if (event.key === '-') {
          event.preventDefault();
          this.setZoom(this.zoom * 0.9);
        } else if (event.key === ' ') {
          event.preventDefault();
          this.toggleAutoplay();
        }
      };

      this.root.addEventListener('pointerdown', this.onPointerDown);
      this.root.addEventListener('pointermove', this.onPointerMove);
      this.root.addEventListener('pointerup', this.onPointerUp);
      this.root.addEventListener('pointercancel', this.onPointerUp);
      this.root.addEventListener('wheel', this.onWheel, { passive: false });
      this.root.addEventListener('keydown', this.onKeyDown);
      this.autoplayButton.addEventListener('click', () => this.toggleAutoplay());
      this.resetButton.addEventListener('click', () => this.setZoom(1));
    }

    normalizeSector(value) {
      const n = this.options.sectors;
      return ((Math.round(value) % n) + n) % n;
    }

    frameAt(row, sector) {
      const r = this.options.frames[row];
      if (!Array.isArray(r)) return '';
      return r[this.normalizeSector(sector)] || '';
    }

    nearestFrame(row, sector) {
      const direct = this.frameAt(row, sector);
      if (direct) return direct;
      for (let distance = 1; distance < this.options.sectors; distance++) {
        const before = this.frameAt(row, sector - distance);
        if (before) return before;
        const after = this.frameAt(row, sector + distance);
        if (after) return after;
      }
      return '';
    }

    render() {
      const src = this.nearestFrame(this.row, this.sector);
      if (src && this.image.src !== src) {
        this.loading.hidden = false;
        this.loading.textContent = 'Загрузка кадра…';
        this.image.src = src;
      }
      this.image.style.transform = 'scale(' + this.zoom.toFixed(3) + ')';
      this.counter.textContent = (this.sector + 1) + ' / ' + this.options.sectors;
      this.rowLabel.textContent = this.options.rows > 1
        ? 'Уровень ' + (this.row + 1) + ' / ' + this.options.rows
        : '360°';
      this.autoplayButton.textContent = this.autoplayTimer ? '❚❚' : '▶';
      this.autoplayButton.title = this.autoplayTimer ? 'Остановить автовращение' : 'Автовращение';
      if (this.options.onFrameChange) {
        this.options.onFrameChange({
          row: this.row,
          sector: this.sector,
          angle: 360 * this.sector / this.options.sectors,
          zoom: this.zoom
        });
      }
      this.preloadNeighbours();
    }

    preloadNeighbours() {
      [-2, -1, 1, 2].forEach((delta) => {
        const src = this.frameAt(this.row, this.sector + delta);
        if (src) {
          const img = new Image();
          img.src = src;
        }
      });
    }

    setSector(value) {
      const next = this.normalizeSector(value);
      if (next === this.sector) return;
      this.sector = next;
      this.render();
    }

    setRow(value) {
      const next = Math.max(0, Math.min(this.options.rows - 1, Math.round(value)));
      if (next === this.row) return;
      this.row = next;
      this.render();
    }

    setZoom(value) {
      const next = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, Number(value) || 1));
      if (Math.abs(next - this.zoom) < 0.001) return;
      this.zoom = next;
      this.render();
    }

    getState() {
      return {
        row: this.row,
        sector: this.sector,
        angle: 360 * this.sector / this.options.sectors,
        zoom: this.zoom
      };
    }

    startAutoplay() {
      if (this.autoplayTimer) return;
      this.autoplayTimer = setInterval(() => {
        this.sector = this.normalizeSector(this.sector + 1);
        this.render();
      }, this.options.autoplayMs);
      this.render();
    }

    stopAutoplay() {
      if (!this.autoplayTimer) return;
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
      this.render();
    }

    toggleAutoplay() {
      if (this.autoplayTimer) this.stopAutoplay();
      else this.startAutoplay();
    }

    resize() {
      this.render();
    }

    destroy() {
      this.stopAutoplay();
      this.root.removeEventListener('pointerdown', this.onPointerDown);
      this.root.removeEventListener('pointermove', this.onPointerMove);
      this.root.removeEventListener('pointerup', this.onPointerUp);
      this.root.removeEventListener('pointercancel', this.onPointerUp);
      this.root.removeEventListener('wheel', this.onWheel);
      this.root.removeEventListener('keydown', this.onKeyDown);
      this.container.classList.remove('object360-host');
      this.container.innerHTML = '';
    }
  }

  window.Object360Viewer = Object360Viewer;
})();
