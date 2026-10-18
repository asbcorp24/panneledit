(() => {
'use strict';

const $ = (id) => document.getElementById(id);
const viewerHost = $('viewer');
const sceneObjects = $('sceneObjects');
const hotspotLayer = $('hotspots');
const loading = $('loading');
const message = $('message');
const sceneNav = $('sceneNav');
const vrButton = $('vrButton');
const gazeOverlay = $('gazeOverlay');
const gazeEls = [...document.querySelectorAll('.gaze')];

let manifest = null;
let currentSceneId = '';
let currentViewer = null;
let cardboard = false;
let history = [];
let gazeId = '';
let gazeSince = 0;
let gazeCooldown = 0;
let gazeTimer = 0;
let music = null;
let narration = null;
const DWELL = 1100;

const clamp = (v,a,b) => Math.min(b,Math.max(a,Number(v)||0));
const sceneById = (id) => manifest?.scenes?.find((s) => s.id === id) || null;
const projectionIsStereo = (p) => /_(LR|TB)$/i.test(String(p||''));

function showMessage(text, ms=2600) {
  message.textContent = text || '';
  message.hidden = !text;
  clearTimeout(showMessage.t);
  if (text && ms) showMessage.t = setTimeout(() => message.hidden = true, ms);
}

function destroyViewer() {
  try { currentViewer?.destroy?.(); } catch (_) {}
  currentViewer = null;
  viewerHost.innerHTML = '';
  hotspotLayer.innerHTML = '';
}

function stopAudio(node) {
  if (!node) return null;
  try { node.pause(); node.removeAttribute('src'); node.load(); } catch (_) {}
  return null;
}

function resolveAudioSlot(scene, key) {
  const local = scene?.audio?.[key];
  if (local?.src) return local;
  if (key === 'music') return manifest?.projectAudio?.music || null;
  return null;
}

function playSceneAudio(scene) {
  music = stopAudio(music);
  narration = stopAudio(narration);
  const m = resolveAudioSlot(scene,'music');
  if (m?.src) {
    music = new Audio(m.src);
    music.loop = m.loop !== false;
    music.volume = clamp((m.volume ?? 35)/100,0,1);
    music.play().catch(()=>{});
  }
}

function logicalPos(h, state) {
  if (!h) return null;
  if (currentViewer?.viewToScreen) {
    return currentViewer.viewToScreen(h.anchorYaw ?? h.yaw ?? 0, h.anchorPitch ?? h.pitch ?? 0);
  }
  if (h.modelPoint && currentViewer?.projectPoint) {
    return currentViewer.projectPoint(h.modelPoint);
  }
  if (state && Number.isFinite(state.sector) && Number.isFinite(state.row)) {
    if (Number(h.anchorSector||0) !== Number(state.sector) || Number(h.anchorRow||0) !== Number(state.row)) return null;
    return {x:Number(h.anchorX ?? 50), y:Number(h.anchorY ?? 50), visible:true};
  }
  return null;
}

function applyBox(el,obj) {
  el.style.left=clamp(obj.x ?? 0,0,100)+'%';
  el.style.top=clamp(obj.y ?? 0,0,100)+'%';
  el.style.width=clamp(obj.width ?? 30,2,100)+'%';
  if(obj.height != null) el.style.height=clamp(obj.height,2,100)+'%';
  el.style.zIndex=String(Number(obj.zIndex)||10);
}

function renderSceneObjects(scene) {
  sceneObjects.innerHTML='';
  if(!scene) return;

  for(const obj of scene.textObjects||[]) {
    if(obj.visible===false) continue;
    const el=document.createElement('div');
    el.className='scene-text';
    if(obj.background==='dark') el.classList.add('bg-dark');
    if(obj.background==='light') el.classList.add('bg-light');
    if(obj.align==='center') el.classList.add('align-center');
    if(obj.align==='right') el.classList.add('align-right');
    el.textContent=obj.text||'';
    el.style.fontSize=clamp(obj.fontSize ?? (obj.type==='title'?42:20),10,120)+'px';
    if(obj.color) el.style.color=obj.color;
    applyBox(el,obj);
    sceneObjects.appendChild(el);
  }

  for(const obj of scene.mediaObjects||[]) {
    if(obj.visible===false) continue;
    const wrap=document.createElement('div');
    wrap.className='scene-media'+(obj.fit==='cover'?' cover':'');
    applyBox(wrap,obj);

    const source=obj.data||'';
    if(obj.type==='image' || obj.type==='stereo-photo') {
      const img=document.createElement('img');
      img.src=source;
      img.alt=obj.title||'';
      wrap.appendChild(img);
    } else if(obj.type==='gallery') {
      const items=Array.isArray(obj.gallery)?obj.gallery.filter(x=>x?.data):[];
      if(items.length) {
        let index=0;
        const img=document.createElement('img');
        const set=()=>{img.src=items[index]?.data||'';img.alt=items[index]?.filename||obj.title||'';};
        set();
        wrap.addEventListener('click',()=>{index=(index+1)%items.length;set();});
        wrap.appendChild(img);
      }
    } else if(obj.type==='video') {
      const video=document.createElement('video');
      video.src=source;
      video.controls=true;
      video.playsInline=true;
      video.loop=!!obj.loop;
      video.muted=obj.muted!==false;
      video.volume=clamp((obj.volume??80)/100,0,1);
      if(obj.autoplay) video.autoplay=true;
      wrap.appendChild(video);
    } else if(obj.type==='audio') {
      const audio=document.createElement('audio');
      audio.src=source;
      audio.controls=obj.audioStyle!=='hidden';
      audio.loop=!!obj.loop;
      audio.volume=clamp((obj.volume??80)/100,0,1);
      if(obj.autoplay) audio.autoplay=true;
      wrap.appendChild(audio);
    } else if(obj.type==='pdf') {
      const iframe=document.createElement('iframe');
      iframe.src=source;
      iframe.title=obj.title||'PDF';
      wrap.appendChild(iframe);
    } else if(obj.type==='button') {
      const b=document.createElement('button');
      b.className='scene-media-button';
      b.textContent=obj.title||'Открыть';
      b.addEventListener('click',()=>{
        if(obj.targetSceneId) openScene(obj.targetSceneId,true);
        else if(obj.url) window.open(obj.url,'_blank','noopener');
      });
      wrap.appendChild(b);
    }

    sceneObjects.appendChild(wrap);
  }
}

function renderHotspots() {
  hotspotLayer.innerHTML = '';
  const scene = sceneById(currentSceneId);
  if (!scene || cardboard) return;
  const state = currentViewer?.getState?.() || {};
  for (const h of scene.hotspots || []) {
    const p = logicalPos(h,state);
    if (!p || p.visible === false || p.x < -10 || p.x > 110 || p.y < -10 || p.y > 110) continue;
    const b = document.createElement('button');
    b.className = 'tour-hotspot';
    b.style.left = p.x + '%';
    b.style.top = p.y + '%';
    b.textContent = h.text || (h.type === 'scene' ? 'Переход' : h.type === 'url' ? 'Ссылка' : 'Инфо');
    b.addEventListener('click',() => activateHotspot(h));
    hotspotLayer.appendChild(b);
  }
}

function activateHotspot(h) {
  if (!h) return;
  if (h.type === 'scene' && h.targetSceneId) {
    openScene(h.targetSceneId,true);
    return;
  }
  if (h.type === 'url' && h.url) {
    try { window.open(h.url,'_blank','noopener'); } catch (_) {}
    return;
  }
  if (h.type === 'info') {
    showMessage(h.info || h.text || 'Информация', 5000);
  }
}

function viewerState() {
  return currentViewer?.getState?.() || {};
}

function angularDistance(a,b) {
  let d=(Number(a)||0)-(Number(b)||0);
  d=((d+180)%360+360)%360-180;
  return Math.abs(d);
}

function gazeCandidate() {
  const scene=sceneById(currentSceneId);
  if (!scene) return null;
  const state=viewerState();
  let best=null,bestScore=1e9;

  for(const h of scene.hotspots||[]) {
    let score=1e9;
    const p=logicalPos(h,state);
    if(p && p.visible!==false) {
      const dx=(Number(p.x)||0)-50,dy=(Number(p.y)||0)-50;
      score=Math.hypot(dx,dy);
      if(score>13) continue;
    } else if(Number.isFinite(state.yaw) && Number.isFinite(state.pitch)) {
      score=Math.hypot(
        angularDistance(h.anchorYaw ?? h.yaw ?? 0,state.yaw),
        (Number(h.anchorPitch ?? h.pitch ?? 0)-Number(state.pitch))
      );
      if(score>8) continue;
    } else continue;

    if(score<bestScore){bestScore=score;best=h;}
  }
  return best;
}

function setGaze(h,progress) {
  const label=h?(h.text || (h.type==='scene'?'Переход':h.type==='url'?'Ссылка':'Инфо')):'';
  const deg=Math.round(clamp(progress,0,1)*360)+'deg';
  gazeEls.forEach(el=>{
    el.style.setProperty('--p',deg);
    el.classList.toggle('target',!!h);
    const span=el.querySelector('span');
    if(span) span.textContent=label;
  });
}

function updateGaze() {
  if(!cardboard) return;
  const now=performance.now();
  const h=gazeCandidate();
  if(!h){gazeId='';gazeSince=0;setGaze(null,0);return;}
  const id=String(h.id||'');
  if(id!==gazeId){gazeId=id;gazeSince=now;setGaze(h,0);return;}
  const progress=clamp((now-gazeSince)/DWELL,0,1);
  setGaze(h,progress);
  if(progress>=1 && now>=gazeCooldown){
    gazeCooldown=now+1400;
    gazeSince=now;
    activateHotspot(h);
  }
}

async function setCardboard(value) {
  cardboard=!!value;
  document.body.classList.toggle('cardboard',cardboard);
  gazeOverlay.hidden=!cardboard;
  vrButton.textContent=cardboard?'ВЫХОД VR':'VR';
  try { window.TourPlayerNative?.setCardboard?.(cardboard); } catch (_) {}
  try {
    if(currentViewer?.setCardboard) await currentViewer.setCardboard(cardboard,{fullscreen:false});
    else if(currentViewer?.toggleCardboard && Boolean(currentViewer.getState?.().cardboard)!==cardboard) await currentViewer.toggleCardboard();
  } catch (_) {}
  clearInterval(gazeTimer);
  if(cardboard) gazeTimer=setInterval(updateGaze,60);
  else {gazeId='';setGaze(null,0);}
  renderHotspots();
  if(cardboard && !document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(()=>{});
  } else if(!cardboard && document.fullscreenElement) {
    document.exitFullscreen?.().catch(()=>{});
  }
}

async function makeViewer(scene) {
  const common={threeModuleUrl:'assets/three.module.min.js',domOverlayRoot:document.body};
  if(scene.type==='object360') {
    return new window.Object360XRViewer(viewerHost,{
      ...common,sectors:scene.sectors,rows:scene.rows,frames:scene.frames,
      startSector:scene.startSector,startRow:scene.startRow,autoplay:!!scene.autoplay,
      backgroundMode:scene.backgroundMode||'hitech',
      backgroundColor:scene.backgroundColor||'#ffffff',
      backgroundImage:scene.backgroundImageSource||'',
      preloadNeighbours:false,
      onFrameChange:renderHotspots
    });
  }
  if(scene.type==='stl') {
    return new window.StlXRViewer(viewerHost,{
      ...common,source:scene.source,yaw:scene.yaw,pitch:scene.pitch,zoom:scene.zoom,
      wireframe:!!scene.wireframe,autoRotate:!!scene.autoplay,color:scene.color||'#7c8cff',
      backgroundMode:scene.backgroundMode||'hitech',
      backgroundImage:scene.backgroundImageSource||'',
      onChange:renderHotspots
    });
  }
  if(scene.type==='panorama' && scene.multires?.basePath) {
    return new window.MultiresPanoramaViewer(viewerHost,{
      ...common,
      basePath:scene.multires.basePath,
      tileResolution:scene.multires.tileResolution,
      maxLevel:scene.multires.maxLevel,
      cubeResolution:scene.multires.cubeResolution,
      yaw:scene.yaw,pitch:scene.pitch,fov:scene.fov,
      onChange:renderHotspots
    });
  }
  return new window.XRMediaViewer(viewerHost,{
    ...common,
    source:scene.source,
    kind:scene.type==='xr'?(scene.kind||'auto'):'image',
    projection:scene.type==='xr'?(scene.projection||'360'):'360',
    yaw:scene.yaw,pitch:scene.pitch,fov:scene.fov,
    autoplay:!!scene.autoplay,loop:!!scene.loop,muted:false,volume:scene.volume??80,
    onChange:renderHotspots
  });
}

async function openScene(id,pushHistory=false) {
  const scene=sceneById(id);
  if(!scene) return;
  if(pushHistory && currentSceneId && currentSceneId!==id) history.push(currentSceneId);
  currentSceneId=id;
  destroyViewer();
  loading.hidden=false;
  $('sceneTitle').textContent=scene.title||scene.id;
  renderNav();
  renderSceneObjects(scene);
  playSceneAudio(scene);
  try {
    currentViewer=await makeViewer(scene);
    await currentViewer.ready;
    if(cardboard) await currentViewer.setCardboard?.(true,{fullscreen:false});
    renderHotspots();
  } catch(error) {
    console.error(error);
    showMessage('Ошибка сцены: '+(error?.message||error),6000);
  } finally {
    loading.hidden=true;
  }
}

function renderNav() {
  sceneNav.innerHTML='';
  for(const scene of manifest.scenes||[]) {
    const b=document.createElement('button');
    b.textContent=scene.title||scene.id;
    b.classList.toggle('active',scene.id===currentSceneId);
    b.addEventListener('click',()=>openScene(scene.id,true));
    sceneNav.appendChild(b);
  }
}

async function init() {
  try {
    const response=await fetch('openxr-manifest.json',{cache:'no-store'});
    if(!response.ok) throw new Error('manifest HTTP '+response.status);
    manifest=await response.json();
    $('tourTitle').textContent=manifest.title||'3DPL';
    renderNav();
    const first=manifest.firstScene || manifest.sceneOrder?.[0] || manifest.scenes?.[0]?.id;
    if(!first) throw new Error('В туре нет сцен');
    await openScene(first,false);
  } catch(error) {
    loading.textContent='Ошибка загрузки тура';
    showMessage(error?.message||String(error),0);
  }
}

vrButton.addEventListener('click',()=>setCardboard(!cardboard));
$('fullscreenButton').addEventListener('click',()=>{
  if(document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
});
$('backButton').addEventListener('click',()=>{
  const id=history.pop();
  if(id) openScene(id,false);
});
document.addEventListener('pointerup',(event)=>{
  if(!cardboard) return;
  if(event.target.closest?.('#topbar,#sceneNav')) return;
  const h=gazeCandidate();
  if(h) activateHotspot(h);
});
window.addEventListener('resize',()=>renderHotspots());
setInterval(()=>{ if(!cardboard) renderHotspots(); },120);

init();
})();
