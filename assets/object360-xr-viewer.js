(() => {
  'use strict';

  const DEFAULT_THREE_URL = 'assets/three.module.min.js';
  const DEG = Math.PI / 180;
  const clamp = (v,min,max) => Math.min(max,Math.max(min,Number(v)||0));

  async function loadThree(url) {
    if (window.__XR_MEDIA_THREE__) return window.__XR_MEDIA_THREE__;
    const mod = await import(new URL(url || DEFAULT_THREE_URL, document.baseURI).href);
    window.__XR_MEDIA_THREE__ = mod;
    return mod;
  }

  class Object360XRViewer {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) throw new Error('Object360XRViewer: container not found');

      this.options = {
        sectors: Math.max(1, Number(options.sectors) || 36),
        rows: Math.max(1, Number(options.rows) || 1),
        frames: Array.isArray(options.frames) ? options.frames : [[]],
        frameProvider: typeof options.frameProvider === 'function' ? options.frameProvider : null,
        releaseFrameSource: typeof options.releaseFrameSource === 'function' ? options.releaseFrameSource : null,
        startSector: Math.max(0, Number(options.startSector) || 0),
        startRow: Math.max(0, Number(options.startRow) || 0),
        dragPixelsPerFrame: Math.max(4, Number(options.dragPixelsPerFrame) || 14),
        rowDragPixels: Math.max(20, Number(options.rowDragPixels) || 70),
        autoplay: Boolean(options.autoplay),
        autoplayMs: Math.max(30, Number(options.autoplayMs) || 100),
        minZoom: Math.max(.25, Number(options.minZoom) || .7),
        maxZoom: Math.max(1, Number(options.maxZoom) || 4),
        backgroundMode: ['hitech','black','light','transparent','color','image'].includes(String(options.backgroundMode))
          ? String(options.backgroundMode) : 'hitech',
        backgroundColor: /^#[0-9a-f]{6}$/i.test(String(options.backgroundColor || ''))
          ? String(options.backgroundColor) : '#ffffff',
        backgroundImage: String(options.backgroundImage || ''),
        threeModuleUrl: options.threeModuleUrl || DEFAULT_THREE_URL,
        domOverlayRoot: options.domOverlayRoot && options.domOverlayRoot.nodeType === 1 ? options.domOverlayRoot : null,
        onFrameChange: typeof options.onFrameChange === 'function' ? options.onFrameChange : null
      };

      this.sector = Math.min(this.options.sectors - 1, this.options.startSector);
      this.row = Math.min(this.options.rows - 1, this.options.startRow);
      this.zoom = 1;
      this.dragging = false;
      this.pointerId = null;
      this.autoplayTimer = null;
      this.cardboard = false;
      this.xrSession = null;
      this.deviceQuaternion = null;
      this.destroyed = false;
      this.textureToken = 0;

      this.build();
      this.ready = this.init();
    }

    build() {
      this.container.innerHTML = '';
      this.container.classList.add('object360-host');

      this.root = document.createElement('div');
      this.root.className = 'object360-viewer object360-three-viewer';
      this.root.tabIndex = 0;
      this.applyBackground();

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'object360-three-canvas';

      this.loading = document.createElement('div');
      this.loading.className = 'object360-loading';
      this.loading.textContent = 'Загрузка Object360…';

      this.hud = document.createElement('div');
      this.hud.className = 'object360-hud';

      this.counter = document.createElement('span');
      this.counter.className = 'object360-counter';

      this.rowLabel = document.createElement('span');
      this.rowLabel.className = 'object360-row-label';

      this.hint = document.createElement('span');
      this.hint.className = 'object360-hint';
      this.hint.textContent = 'Drag ← → кадры · ↑ ↓ уровень · колесо масштаб';

      this.autoplayButton = document.createElement('button');
      this.autoplayButton.type = 'button';
      this.autoplayButton.className = 'object360-autoplay';
      this.autoplayButton.textContent = '▶';

      this.resetButton = document.createElement('button');
      this.resetButton.type = 'button';
      this.resetButton.className = 'object360-reset';
      this.resetButton.textContent = '1:1';

      this.cardboardButton = document.createElement('button');
      this.cardboardButton.type = 'button';
      this.cardboardButton.className = 'object360-xr-button';
      this.cardboardButton.textContent = 'CARDBOARD';

      this.xrButton = document.createElement('button');
      this.xrButton.type = 'button';
      this.xrButton.className = 'object360-xr-button';
      this.xrButton.textContent = 'XR';
      this.xrButton.disabled = true;

      this.hud.append(
        this.counter, this.rowLabel, this.hint,
        this.autoplayButton, this.resetButton,
        this.cardboardButton, this.xrButton
      );
      this.root.append(this.canvas, this.loading, this.hud);
      this.container.append(this.root);
    }

    applyBackground() {
      const mode = this.options.backgroundMode;
      this.root.style.background = '';
      if (mode === 'black') this.root.style.background = '#000';
      else if (mode === 'light') this.root.style.background = '#f4f6fa';
      else if (mode === 'transparent') this.root.style.background = 'transparent';
      else if (mode === 'color') this.root.style.background = this.options.backgroundColor;
      else if (mode === 'image' && this.options.backgroundImage) {
        this.root.style.background = 'center / cover no-repeat url("' +
          this.options.backgroundImage.replace(/"/g,'%22') + '")';
      }
    }

    async init() {
      this.THREE = await loadThree(this.options.threeModuleUrl);
      if (this.destroyed) return;

      const THREE = this.THREE;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(48, 1, .01, 100);
      this.renderer = new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true});
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.xr.enabled = true;
      this.renderer.setClearColor(0x03060d, this.options.backgroundMode === 'transparent' ? 0 : 1);

      this.spatialOverlay = window.XRSpatialOverlay && this.options.domOverlayRoot
        ? new XRSpatialOverlay({THREE,renderer:this.renderer,scene:this.scene,camera:this.camera,root:this.options.domOverlayRoot})
        : null;

      this.planeGroup = new THREE.Group();
      this.planeGroup.position.set(0,0,-3.0);
      this.scene.add(this.planeGroup);

      const geometry = new THREE.PlaneGeometry(2.7, 2.0);
      this.material = new THREE.MeshBasicMaterial({
        color:0xffffff,
        transparent:true,
        side:THREE.DoubleSide
      });
      this.plane = new THREE.Mesh(geometry,this.material);
      this.planeGroup.add(this.plane);

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
      this.bind();
      this.resize();
      await this.updateXrAvailability();
      await this.updateTexture();
      this.loading.hidden = true;
      this.renderer.setAnimationLoop(() => this.renderFrame());

      if (this.options.autoplay) this.startAutoplay();
      this.emitChange();
    }

    normalizeSector(value) {
      const n=this.options.sectors;
      return ((Math.round(value)%n)+n)%n;
    }

    frameAt(row,sector) {
      const r=this.options.frames[row];
      if(!Array.isArray(r)) return '';
      return r[this.normalizeSector(sector)] || '';
    }

    async resolveFrame(row,sector) {
      const normalized=this.normalizeSector(sector);
      if(this.options.frameProvider){
        try{
          const provided=await this.options.frameProvider(row,normalized);
          if(provided) return provided;
        }catch(error){
          console.warn('Object360 frame provider:',error);
        }
      }
      return this.frameAt(row,normalized);
    }

    async nearestFrame(row,sector) {
      const direct=await this.resolveFrame(row,sector);
      if(direct) return direct;
      for(let d=1;d<this.options.sectors;d++){
        const before=await this.resolveFrame(row,sector-d); if(before) return before;
        const after=await this.resolveFrame(row,sector+d); if(after) return after;
      }
      return '';
    }

    releaseSource(src) {
      if(!src || !this.options.releaseFrameSource) return;
      try{this.options.releaseFrameSource(src);}catch(_){}
    }

    async updateTexture() {
      if(!this.THREE || !this.material) return;
      const token=++this.textureToken;
      this.loading.hidden=false;
      this.loading.textContent='Загрузка кадра…';

      let src='';
      try {
        src=await this.nearestFrame(this.row,this.sector);
        if(!src) {
          if(token===this.textureToken){
            this.loading.hidden=false;
            this.loading.textContent='Кадр отсутствует';
          }
          return;
        }
        const texture=await new this.THREE.TextureLoader().loadAsync(src);
        this.releaseSource(src);
        src='';
        if(this.destroyed || token!==this.textureToken) {
          texture.dispose();
          return;
        }
        texture.colorSpace=this.THREE.SRGBColorSpace;
        texture.minFilter=this.THREE.LinearFilter;
        texture.magFilter=this.THREE.LinearFilter;

        const img=texture.image;
        const w=img?.naturalWidth || img?.width || 4;
        const h=img?.naturalHeight || img?.height || 3;
        const aspect=Math.max(.1,w/Math.max(1,h));
        const height=2.0;
        const width=Math.min(3.5,height*aspect);
        this.plane.geometry.dispose();
        this.plane.geometry=new this.THREE.PlaneGeometry(width,height);

        this.material.map?.dispose?.();
        this.material.map=texture;
        this.material.needsUpdate=true;
        this.loading.hidden=true;
      } catch(error) {
        if(src) this.releaseSource(src);
        if(token!==this.textureToken) return;
        this.loading.hidden=false;
        this.loading.textContent='Ошибка кадра';
        console.warn(error);
      }
    }

    bind() {
      this.onPointerDown=(event)=>{
        if(this.cardboard || this.xrSession) return;
        if(event.button!==undefined && event.button!==0) return;
        this.dragging=true;
        this.pointerId=event.pointerId;
        this.startX=event.clientX;
        this.startY=event.clientY;
        this.startSector=this.sector;
        this.startRow=this.row;
        this.root.classList.add('dragging');
        try{this.root.setPointerCapture(event.pointerId);}catch(_){}
        this.stopAutoplay();
      };
      this.onPointerMove=(event)=>{
        if(!this.dragging || event.pointerId!==this.pointerId) return;
        const dx=event.clientX-this.startX;
        const dy=event.clientY-this.startY;
        this.setSector(this.startSector-Math.round(dx/this.options.dragPixelsPerFrame));
        if(this.options.rows>1) this.setRow(this.startRow-Math.round(dy/this.options.rowDragPixels));
      };
      this.onPointerUp=(event)=>{
        if(!this.dragging || event.pointerId!==this.pointerId) return;
        this.dragging=false;
        this.pointerId=null;
        this.root.classList.remove('dragging');
      };
      this.onWheel=(event)=>{
        if(this.cardboard || this.xrSession) return;
        event.preventDefault();
        this.setZoom(this.zoom*(event.deltaY<0?1.1:.9));
      };
      this.onOrientation=(event)=>{
        if(!this.THREE || event.alpha==null || event.beta==null || event.gamma==null) return;
        const THREE=this.THREE;
        const zee=new THREE.Vector3(0,0,1);
        const euler=new THREE.Euler();
        const q0=new THREE.Quaternion();
        const q1=new THREE.Quaternion(-Math.sqrt(.5),0,0,Math.sqrt(.5));
        const alpha=event.alpha*DEG,beta=event.beta*DEG,gamma=event.gamma*DEG;
        const orient=(screen.orientation?.angle || window.orientation || 0)*DEG;
        euler.set(beta,alpha,-gamma,'YXZ');
        const q=new THREE.Quaternion().setFromEuler(euler);
        q.multiply(q1);
        q.multiply(q0.setFromAxisAngle(zee,-orient));
        this.deviceQuaternion=q;
      };

      this.root.addEventListener('pointerdown',this.onPointerDown);
      this.root.addEventListener('pointermove',this.onPointerMove);
      this.root.addEventListener('pointerup',this.onPointerUp);
      this.root.addEventListener('pointercancel',this.onPointerUp);
      this.root.addEventListener('wheel',this.onWheel,{passive:false});

      this.autoplayButton.addEventListener('click',()=>this.toggleAutoplay());
      this.resetButton.addEventListener('click',()=>this.setZoom(1));
      this.cardboardButton.addEventListener('click',()=>this.toggleCardboard());
      this.xrButton.addEventListener('click',()=>this.toggleXR());
    }

    async requestMotionPermission() {
      const DOE=window.DeviceOrientationEvent;
      if(!DOE) return false;
      if(typeof DOE.requestPermission==='function'){
        try{
          const result=await DOE.requestPermission();
          if(result!=='granted') return false;
        }catch(_){return false;}
      }
      window.addEventListener('deviceorientation',this.onOrientation,true);
      return true;
    }

    async toggleCardboard() {
      if(this.xrSession) return;
      this.cardboard=!this.cardboard;
      this.root.classList.toggle('cardboard-active',this.cardboard);
      this.cardboardButton.classList.toggle('active',this.cardboard);
      this.cardboardButton.textContent=this.cardboard?'ВЫХОД':'CARDBOARD';
      if(this.cardboard){
        await this.requestMotionPermission();
        try{if(this.root.requestFullscreen && !document.fullscreenElement) await this.root.requestFullscreen();}catch(_){}
      }else{
        this.deviceQuaternion=null;
        try{if(document.fullscreenElement===this.root) await document.exitFullscreen();}catch(_){}
      }
    }

    async updateXrAvailability() {
      if(!navigator.xr || !window.isSecureContext){
        this.xrButton.disabled=true;
        this.xrButton.title='WebXR требует HTTPS';
        return;
      }
      try{
        const ok=await navigator.xr.isSessionSupported('immersive-vr');
        this.xrButton.disabled=!ok;
      }catch(_){this.xrButton.disabled=true;}
    }

    async toggleXR() {
      if(!navigator.xr || !this.renderer) return;
      if(this.xrSession){
        await this.xrSession.end().catch(()=>{});
        return;
      }
      if(this.cardboard){
        this.cardboard=false;
        this.cardboardButton.classList.remove('active');
        this.cardboardButton.textContent='CARDBOARD';
      }
      try{
        const sessionInit={optionalFeatures:['local-floor','bounded-floor','hand-tracking']};
        if(this.options.domOverlayRoot){
          sessionInit.optionalFeatures.push('dom-overlay');
          sessionInit.domOverlay={root:this.options.domOverlayRoot};
        }
        const session=await navigator.xr.requestSession('immersive-vr',sessionInit);
        this.xrSession=session;
        this.options.domOverlayRoot?.classList.add('xr-dom-overlay-active');
        this.xrButton.classList.add('active');
        this.xrButton.textContent='ВЫХОД XR';
        await this.renderer.xr.setSession(session);
        this.spatialOverlay?.attachSession(session);
        session.addEventListener('end',()=>{
          this.xrSession=null;
          this.spatialOverlay?.detachSession();
          this.options.domOverlayRoot?.classList.remove('xr-dom-overlay-active');
          this.xrButton.classList.remove('active');
          this.xrButton.textContent='XR';
        },{once:true});
      }catch(error){this.spatialOverlay?.detachSession();this.options.domOverlayRoot?.classList.remove('xr-dom-overlay-active');console.warn('Object360 WebXR:',error);}
    }

    setSector(value) {
      const next=this.normalizeSector(value);
      if(next===this.sector) return;
      this.sector=next;
      this.updateTexture();
      this.emitChange();
      this.preloadNeighbours();
    }

    setRow(value) {
      const next=Math.max(0,Math.min(this.options.rows-1,Math.round(value)));
      if(next===this.row) return;
      this.row=next;
      this.updateTexture();
      this.emitChange();
      this.preloadNeighbours();
    }

    setZoom(value) {
      const next=clamp(value,this.options.minZoom,this.options.maxZoom);
      if(Math.abs(next-this.zoom)<.001) return;
      this.zoom=next;
      this.emitChange();
    }

    preloadNeighbours() {
      [-2,-1,1,2].forEach(async delta=>{
        let src='';
        try{
          src=await this.resolveFrame(this.row,this.sector+delta);
          if(!src) return;
          await new Promise((resolve)=>{
            const img=new Image();
            const done=()=>{img.onload=null;img.onerror=null;resolve();};
            img.onload=done;
            img.onerror=done;
            img.src=src;
          });
        }finally{
          if(src) this.releaseSource(src);
        }
      });
    }

    startAutoplay() {
      if(this.autoplayTimer) return;
      this.autoplayTimer=setInterval(()=>{
        this.sector=this.normalizeSector(this.sector+1);
        this.updateTexture();
        this.emitChange();
      },this.options.autoplayMs);
      this.updateHud();
    }

    stopAutoplay() {
      if(!this.autoplayTimer) return;
      clearInterval(this.autoplayTimer);
      this.autoplayTimer=null;
      this.updateHud();
    }

    toggleAutoplay() {
      if(this.autoplayTimer) this.stopAutoplay();
      else this.startAutoplay();
    }

    updateHud() {
      this.counter.textContent=(this.sector+1)+' / '+this.options.sectors;
      this.rowLabel.textContent=this.options.rows>1
        ? 'Уровень '+(this.row+1)+' / '+this.options.rows
        : '360°';
      this.autoplayButton.textContent=this.autoplayTimer?'❚❚':'▶';
    }

    getState() {
      return {
        row:this.row,
        sector:this.sector,
        angle:360*this.sector/this.options.sectors,
        zoom:this.zoom,
        cardboard:this.cardboard,
        xr:Boolean(this.xrSession)
      };
    }

    emitChange() {
      this.updateHud();
      if(this.options.onFrameChange) this.options.onFrameChange(this.getState());
    }

    resize() {
      if(!this.renderer || !this.camera) return;
      const width=Math.max(1,this.container.clientWidth);
      const height=Math.max(1,this.container.clientHeight);
      this.renderer.setSize(width,height,false);
      this.camera.aspect=width/height;
      this.camera.updateProjectionMatrix();
    }

    renderFrame() {
      if(this.destroyed || !this.renderer || !this.camera || !this.scene) return;
      this.resize();
      this.planeGroup.scale.setScalar(this.zoom);

      if(this.xrSession || this.renderer.xr.isPresenting){
        this.spatialOverlay?.update();
        this.renderer.setScissorTest(false);
        this.renderer.render(this.scene,this.camera);
        return;
      }

      if(this.cardboard){
        if(this.deviceQuaternion) this.camera.quaternion.copy(this.deviceQuaternion);
        const width=Math.max(1,this.container.clientWidth),height=Math.max(1,this.container.clientHeight),half=Math.floor(width/2);
        const basePos=this.camera.position.clone();
        const right=new this.THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion);
        this.renderer.setScissorTest(true);

        this.camera.position.copy(basePos).addScaledVector(right,-.032);
        this.camera.aspect=half/Math.max(1,height);
        this.camera.updateProjectionMatrix();
        this.renderer.setViewport(0,0,half,height);
        this.renderer.setScissor(0,0,half,height);
        this.renderer.render(this.scene,this.camera);

        this.camera.position.copy(basePos).addScaledVector(right,.032);
        this.renderer.setViewport(half,0,width-half,height);
        this.renderer.setScissor(half,0,width-half,height);
        this.renderer.render(this.scene,this.camera);

        this.camera.position.copy(basePos);
        this.renderer.setScissorTest(false);
        return;
      }

      this.camera.quaternion.identity();
      this.camera.position.set(0,0,0);
      this.renderer.setScissorTest(false);
      this.renderer.render(this.scene,this.camera);
    }

    destroy() {
      this.destroyed=true;
      this.stopAutoplay();
      try{this.xrSession?.end();}catch(_){}
      this.xrSession=null;
      this.renderer?.setAnimationLoop(null);
      this.resizeObserver?.disconnect();
      window.removeEventListener('deviceorientation',this.onOrientation,true);
      this.root?.removeEventListener('pointerdown',this.onPointerDown);
      this.root?.removeEventListener('pointermove',this.onPointerMove);
      this.root?.removeEventListener('pointerup',this.onPointerUp);
      this.root?.removeEventListener('pointercancel',this.onPointerUp);
      this.root?.removeEventListener('wheel',this.onWheel);
      this.spatialOverlay?.destroy();
      this.spatialOverlay=null;
      this.material?.map?.dispose?.();
      this.material?.dispose?.();
      this.plane?.geometry?.dispose?.();
      this.renderer?.dispose?.();
      this.container.classList.remove('object360-host');
      this.container.innerHTML='';
    }
  }

  window.Object360XRViewer=Object360XRViewer;
})();
