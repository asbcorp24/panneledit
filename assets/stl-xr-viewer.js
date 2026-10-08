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

  async function sourceToArrayBuffer(source) {
    if (window.StlTools?.sourceToArrayBuffer) {
      return await window.StlTools.sourceToArrayBuffer(source);
    }
    if (source instanceof ArrayBuffer) return source;
    if (source instanceof Blob) return await source.arrayBuffer();
    const text = String(source || '');
    if (/^data:/i.test(text)) {
      const response = await fetch(text);
      return await response.arrayBuffer();
    }
    const response = await fetch(text);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.arrayBuffer();
  }

  class StlXRViewer {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) throw new Error('StlXRViewer: container not found');

      this.options = {
        source: options.source || '',
        yaw: Number(options.yaw) || 0,
        pitch: clamp(Number(options.pitch) || -15, -89, 89),
        zoom: clamp(Number(options.zoom) || 1, .35, 5),
        wireframe: Boolean(options.wireframe),
        autoRotate: Boolean(options.autoRotate),
        color: /^#[0-9a-f]{6}$/i.test(String(options.color || '')) ? String(options.color) : '#7c8cff',
        backgroundMode: ['hitech','black','light','gradient','transparent','image','panorama'].includes(String(options.backgroundMode))
          ? String(options.backgroundMode) : 'hitech',
        backgroundImage: String(options.backgroundImage || ''),
        threeModuleUrl: options.threeModuleUrl || DEFAULT_THREE_URL,
        domOverlayRoot: options.domOverlayRoot && options.domOverlayRoot.nodeType === 1 ? options.domOverlayRoot : null,
        onChange: typeof options.onChange === 'function' ? options.onChange : null
      };

      this.yaw = this.options.yaw;
      this.pitch = this.options.pitch;
      this.zoom = this.options.zoom;
      this.wireframe = this.options.wireframe;
      this.autoRotate = this.options.autoRotate;
      this.color = this.options.color;
      this.cardboard = false;
      this.xrSession = null;
      this.deviceQuaternion = null;
      this.destroyed = false;
      this.lastTime = performance.now();
      this.dragging = false;
      this.pointerId = null;

      this.build();
      this.ready = this.init();
    }

    build() {
      this.container.innerHTML = '';
      this.container.classList.add('stl-host');

      this.root = document.createElement('div');
      this.root.className = 'stl-viewer stl-three-viewer';
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
      this.modeButton.textContent = this.wireframe ? 'WIREFRAME' : 'SOLID';

      this.autoButton = document.createElement('button');
      this.autoButton.type = 'button';
      this.autoButton.className = 'stl-auto';
      this.autoButton.textContent = this.autoRotate ? '❚❚' : '▶';

      this.resetButton = document.createElement('button');
      this.resetButton.type = 'button';
      this.resetButton.className = 'stl-reset';
      this.resetButton.textContent = '⌂';

      this.cardboardButton = document.createElement('button');
      this.cardboardButton.type = 'button';
      this.cardboardButton.className = 'stl-xr-button';
      this.cardboardButton.textContent = 'CARDBOARD';

      this.xrButton = document.createElement('button');
      this.xrButton.type = 'button';
      this.xrButton.className = 'stl-xr-button';
      this.xrButton.textContent = 'XR';
      this.xrButton.disabled = true;

      this.hud.append(
        this.stats, this.hint, this.modeButton, this.autoButton, this.resetButton,
        this.cardboardButton, this.xrButton
      );
      this.root.append(this.canvas, this.loading, this.hud);
      this.container.append(this.root);
    }

    applyBackground() {
      const mode = this.options.backgroundMode;
      const image = this.options.backgroundImage;
      this.root.style.background = '';
      if (mode === 'black') this.root.style.background = '#000';
      else if (mode === 'light') {
        this.root.style.background = 'radial-gradient(circle at 50% 42%,#fff 0%,#eef1f7 48%,#cfd5df 100%)';
      } else if (mode === 'gradient') {
        this.root.style.background = 'radial-gradient(circle at 50% 36%,rgba(104,84,255,.4),transparent 35%),linear-gradient(145deg,#07111f,#17254a 48%,#3a1f52)';
      } else if (mode === 'transparent') this.root.style.background = 'transparent';
      else if ((mode === 'image' || mode === 'panorama') && image) {
        this.root.style.background = 'center / cover no-repeat url("' + image.replace(/"/g,'%22') + '")';
      }
    }

    async init() {
      if (!window.StlTools?.parseStl) throw new Error('StlTools parser не загружен');

      this.THREE = await loadThree(this.options.threeModuleUrl);
      if (this.destroyed) return;
      const THREE = this.THREE;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(44,1,.01,100);
      this.renderer = new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true});
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
      this.renderer.xr.enabled = true;
      this.renderer.setClearColor(0x03060d, this.options.backgroundMode === 'transparent' ? 0 : 1);

      this.world = new THREE.Group();
      this.world.position.set(0,0,-3.2);
      this.scene.add(this.world);

      const hemi = new THREE.HemisphereLight(0xffffff,0x182033,1.25);
      const key = new THREE.DirectionalLight(0xffffff,1.7);
      key.position.set(2.5,3.5,4);
      const rim = new THREE.DirectionalLight(0x7c8cff,.9);
      rim.position.set(-3,1,-2);
      this.scene.add(hemi,key,rim);

      const grid = new THREE.GridHelper(4,24,0x44506d,0x222a3a);
      grid.position.set(0,-1.15,-3.2);
      grid.material.opacity=.25;
      grid.material.transparent=true;
      this.scene.add(grid);
      this.grid=grid;

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
      this.bind();
      this.resize();

      const buffer = await sourceToArrayBuffer(this.options.source);
      if (this.destroyed) return;
      const parsed = window.StlTools.parseStl(buffer);
      this.geometryData = parsed;
      this.createMesh(parsed);

      this.stats.textContent = (parsed.triangleCount || 0).toLocaleString('ru-RU') + ' треуг.';
      this.loading.hidden = true;
      await this.updateXrAvailability();
      this.renderer.setAnimationLoop(() => this.renderFrame());
      this.emitChange();
    }

    createMesh(parsed) {
      const THREE = this.THREE;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(parsed.positions,3));
      if (parsed.normals?.length === parsed.positions.length) {
        geometry.setAttribute('normal',new THREE.BufferAttribute(parsed.normals,3));
      } else {
        geometry.computeVertexNormals();
      }
      geometry.computeBoundingSphere();

      const material = new THREE.MeshStandardMaterial({
        color:new THREE.Color(this.color),
        roughness:.58,
        metalness:.12,
        side:THREE.DoubleSide,
        wireframe:this.wireframe
      });

      this.mesh = new THREE.Mesh(geometry,material);
      this.world.add(this.mesh);
      this.geometry=geometry;
      this.material=material;
      this.applyTransform();
    }

    applyTransform() {
      if(!this.world) return;
      this.world.rotation.order='YXZ';
      this.world.rotation.y=this.yaw*DEG;
      this.world.rotation.x=this.pitch*DEG;
      this.world.scale.setScalar(this.zoom);
    }

    bind() {
      this.onPointerDown=(event)=>{
        if(this.cardboard || this.xrSession) return;
        if(event.button!==undefined && event.button!==0) return;
        this.dragging=true;
        this.pointerId=event.pointerId;
        this.startX=event.clientX;
        this.startY=event.clientY;
        this.startYaw=this.yaw;
        this.startPitch=this.pitch;
        this.autoRotate=false;
        this.root.classList.add('dragging');
        try{this.root.setPointerCapture(event.pointerId);}catch(_){}
        this.updateHud();
      };
      this.onPointerMove=(event)=>{
        if(!this.dragging || event.pointerId!==this.pointerId) return;
        const dx=event.clientX-this.startX;
        const dy=event.clientY-this.startY;
        this.yaw=this.startYaw+dx*.45;
        this.pitch=clamp(this.startPitch+dy*.35,-89,89);
        this.applyTransform();
        this.emitChange();
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
        this.zoom=clamp(this.zoom*(event.deltaY<0?1.1:.9),.35,5);
        this.applyTransform();
        this.emitChange();
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

      this.modeButton.addEventListener('click',()=>{
        this.wireframe=!this.wireframe;
        if(this.material) this.material.wireframe=this.wireframe;
        this.updateHud();
        this.emitChange();
      });
      this.autoButton.addEventListener('click',()=>{
        this.autoRotate=!this.autoRotate;
        this.updateHud();
        this.emitChange();
      });
      this.resetButton.addEventListener('click',()=>{
        this.yaw=0;this.pitch=-15;this.zoom=1;this.autoRotate=false;
        this.applyTransform();this.updateHud();this.emitChange();
      });
      this.cardboardButton.addEventListener('click',()=>this.toggleCardboard());
      this.xrButton.addEventListener('click',()=>this.toggleXR());
    }

    updateHud() {
      this.modeButton.textContent=this.wireframe?'WIREFRAME':'SOLID';
      this.autoButton.textContent=this.autoRotate?'❚❚':'▶';
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
        session.addEventListener('end',()=>{
          this.xrSession=null;
          this.options.domOverlayRoot?.classList.remove('xr-dom-overlay-active');
          this.xrButton.classList.remove('active');
          this.xrButton.textContent='XR';
        },{once:true});
      }catch(error){this.options.domOverlayRoot?.classList.remove('xr-dom-overlay-active');console.warn('STL WebXR:',error);}
    }

    setColor(color) {
      if(!/^#[0-9a-f]{6}$/i.test(String(color||''))) return;
      this.color=String(color);
      if(this.material) this.material.color.set(this.color);
      this.emitChange();
    }

    pick(clientX,clientY) {
      if(!this.mesh || !this.THREE) return null;
      const rect=this.canvas.getBoundingClientRect();
      if(!rect.width || !rect.height) return null;
      const ndc=new this.THREE.Vector2(
        ((clientX-rect.left)/rect.width)*2-1,
        -((clientY-rect.top)/rect.height)*2+1
      );
      this.scene.updateMatrixWorld(true);
      const raycaster=new this.THREE.Raycaster();
      raycaster.setFromCamera(ndc,this.camera);
      const hit=raycaster.intersectObject(this.mesh,false)[0];
      if(!hit) return null;
      const local=this.mesh.worldToLocal(hit.point.clone());
      return {point:[local.x,local.y,local.z],screen:this.projectPoint([local.x,local.y,local.z])};
    }

    projectPoint(point) {
      if(!this.mesh || !this.THREE || !point || point.length<3) return null;
      this.scene.updateMatrixWorld(true);
      const v=new this.THREE.Vector3(Number(point[0])||0,Number(point[1])||0,Number(point[2])||0);
      this.mesh.localToWorld(v);
      v.project(this.camera);
      const x=(v.x+1)*50;
      const y=(1-v.y)*50;
      return {visible:v.z>=-1&&v.z<=1&&x>=-12&&x<=112&&y>=-12&&y<=112,x,y,depth:v.z};
    }

    getState() {
      return {
        yaw:this.yaw,
        pitch:this.pitch,
        zoom:this.zoom,
        wireframe:this.wireframe,
        autoRotate:this.autoRotate,
        color:this.color,
        cardboard:this.cardboard,
        xr:Boolean(this.xrSession)
      };
    }

    emitChange() {
      if(this.options.onChange) this.options.onChange(this.getState());
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
      if(this.destroyed || !this.renderer || !this.scene || !this.camera) return;

      const now=performance.now();
      const dt=Math.min(.1,Math.max(0,(now-this.lastTime)/1000));
      this.lastTime=now;
      if(this.autoRotate && this.mesh && !this.cardboard && !this.xrSession){
        this.yaw+=dt*28;
        this.applyTransform();
        this.emitChange();
      }

      this.resize();

      if(this.xrSession || this.renderer.xr.isPresenting){
        this.renderer.setScissorTest(false);
        this.renderer.render(this.scene,this.camera);
        return;
      }

      if(this.cardboard){
        if(this.deviceQuaternion) this.camera.quaternion.copy(this.deviceQuaternion);
        const width=this.canvas.width,height=this.canvas.height,half=Math.floor(width/2);
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

      this.camera.position.set(0,0,0);
      this.camera.quaternion.identity();
      this.renderer.setScissorTest(false);
      this.renderer.render(this.scene,this.camera);
    }

    render() {
      this.renderFrame();
    }

    destroy() {
      this.destroyed=true;
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
      this.geometry?.dispose?.();
      this.material?.dispose?.();
      this.renderer?.dispose?.();
      this.container.classList.remove('stl-host');
      this.container.innerHTML='';
    }
  }

  window.StlXRViewer=StlXRViewer;
})();
