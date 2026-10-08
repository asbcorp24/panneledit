(() => {
  'use strict';

  const DB_NAME = 'pannellum-tour-editor';
  const DB_VERSION = 1;
  const STORE_NAME = 'projects';
  const CURRENT_KEY = 'current';
  const PROJECT_VERSION = 8;

  const $ = (id) => document.getElementById(id);

  const els = {
    sceneList: $('sceneList'),
    hotspotList: $('hotspotList'),
    hotspotCount: $('hotspotCount'),
    viewerPlaceholder: $('viewerPlaceholder'),
    panorama: $('panorama'),
    coords: $('coords'),
    saveState: $('saveState'),
    projectTitle: $('projectTitle'),
    firstScene: $('firstScene'),
    projectMusicName: $('projectMusicName'),
    projectMusicFile: $('projectMusicFile'),
    projectMusicVolume: $('projectMusicVolume'),
    projectMusicVolumeValue: $('projectMusicVolumeValue'),
    projectMusicLoop: $('projectMusicLoop'),
    btnRemoveProjectMusic: $('btnRemoveProjectMusic'),
    sceneFadeEnabled: $('sceneFadeEnabled'),
    sceneFadeDuration: $('sceneFadeDuration'),
    defaultTransition: $('defaultTransition'),
    autoRotateEnabled: $('autoRotateEnabled'),
    autoRotate: $('autoRotate'),
    multiresEnabled: $('multiresEnabled'),
    multiresOptions: $('multiresOptions'),
    multiresTileSize: $('multiresTileSize'),
    multiresQuality: $('multiresQuality'),
    multiresMaxCubeSize: $('multiresMaxCubeSize'),
    btnUndo: $('btnUndo'),
    btnRedo: $('btnRedo'),
    btnSceneGraph: $('btnSceneGraph'),
    btnGuideEditor: $('btnGuideEditor'),
    btnAdvancedSettings: $('btnAdvancedSettings'),
    btnNew: $('btnNew'),
    btnAddScene: $('btnAddScene'),
    btnAddSceneCenter: $('btnAddSceneCenter'),
    btnAddHotspot: $('btnAddHotspot'),
    btnSetInitialView: $('btnSetInitialView'),
    btnPreview: $('btnPreview'),
    btnExportProject: $('btnExportProject'),
    btnExportTour: $('btnExportTour'),
    projectImport: $('projectImport'),
    sceneDialog: $('sceneDialog'),
    sceneForm: $('sceneForm'),
    newSceneTitle: $('newSceneTitle'),
    sceneTypeControl: $('sceneTypeControl'),
    newSceneType: $('newSceneType'),
    panoramaUploadBox: $('panoramaUploadBox'),
    object360UploadBox: $('object360UploadBox'),
    object360ImportNote: $('object360ImportNote'),
    stlUploadBox: $('stlUploadBox'),
    stlImportNote: $('stlImportNote'),
    xrUploadBox: $('xrUploadBox'),
    xrCreateOptions: $('xrCreateOptions'),
    newSceneImage: $('newSceneImage'),
    newSceneFileName: $('newSceneFileName'),
    newObject360Zip: $('newObject360Zip'),
    newObject360FileName: $('newObject360FileName'),
    newStlFile: $('newStlFile'),
    newStlFileName: $('newStlFileName'),
    newXrMediaFile: $('newXrMediaFile'),
    newXrMediaFileName: $('newXrMediaFileName'),
    newXrProjection: $('newXrProjection'),
    sceneSettings: $('sceneSettings'),
    noSceneSettings: $('noSceneSettings'),
    sceneSettingsSubtitle: $('sceneSettingsSubtitle'),
    sceneTitle: $('sceneTitle'),
    sceneId: $('sceneId'),
    scenePitch: $('scenePitch'),
    sceneYaw: $('sceneYaw'),
    sceneHfov: $('sceneHfov'),
    sceneFilename: $('sceneFilename'),
    sceneImageReplace: $('sceneImageReplace'),
    panoramaSceneSettings: $('panoramaSceneSettings'),
    object360SceneSettings: $('object360SceneSettings'),
    object360SceneStats: $('object360SceneStats'),
    object360SceneFile: $('object360SceneFile'),
    object360StartSector: $('object360StartSector'),
    object360StartRow: $('object360StartRow'),
    object360Autoplay: $('object360Autoplay'),
    object360BackgroundMode: $('object360BackgroundMode'),
    object360BackgroundColorRow: $('object360BackgroundColorRow'),
    object360BackgroundColor: $('object360BackgroundColor'),
    object360BackgroundImageRow: $('object360BackgroundImageRow'),
    object360BackgroundImage: $('object360BackgroundImage'),
    object360BackgroundImageName: $('object360BackgroundImageName'),
    object360Filename: $('object360Filename'),
    object360ZipReplace: $('object360ZipReplace'),
    stlSceneSettings: $('stlSceneSettings'),
    stlSceneStats: $('stlSceneStats'),
    stlSceneFile: $('stlSceneFile'),
    stlYaw: $('stlYaw'),
    stlPitch: $('stlPitch'),
    stlZoom: $('stlZoom'),
    stlColor: $('stlColor'),
    stlBackgroundMode: $('stlBackgroundMode'),
    stlBackgroundImageRow: $('stlBackgroundImageRow'),
    stlBackgroundImage: $('stlBackgroundImage'),
    stlBackgroundImageName: $('stlBackgroundImageName'),
    stlBackgroundSceneRow: $('stlBackgroundSceneRow'),
    stlBackgroundScene: $('stlBackgroundScene'),
    stlWireframe: $('stlWireframe'),
    stlAutoplay: $('stlAutoplay'),
    stlFilename: $('stlFilename'),
    stlFileReplace: $('stlFileReplace'),
    xrSceneSettings: $('xrSceneSettings'),
    xrSceneStats: $('xrSceneStats'),
    xrSceneFile: $('xrSceneFile'),
    xrProjection: $('xrProjection'),
    xrYaw: $('xrYaw'),
    xrPitch: $('xrPitch'),
    xrFov: $('xrFov'),
    xrAutoplayRow: $('xrAutoplayRow'),
    xrLoopRow: $('xrLoopRow'),
    xrVolumeRow: $('xrVolumeRow'),
    xrAutoplay: $('xrAutoplay'),
    xrLoop: $('xrLoop'),
    xrVolume: $('xrVolume'),
    xrVolumeValue: $('xrVolumeValue'),
    xrFilename: $('xrFilename'),
    xrFileReplace: $('xrFileReplace'),
    sceneMusicName: $('sceneMusicName'),
    sceneMusicFile: $('sceneMusicFile'),
    sceneMusicVolume: $('sceneMusicVolume'),
    sceneMusicVolumeValue: $('sceneMusicVolumeValue'),
    sceneMusicLoop: $('sceneMusicLoop'),
    btnRemoveSceneMusic: $('btnRemoveSceneMusic'),
    sceneNarrationName: $('sceneNarrationName'),
    sceneNarrationFile: $('sceneNarrationFile'),
    sceneNarrationVolume: $('sceneNarrationVolume'),
    sceneNarrationVolumeValue: $('sceneNarrationVolumeValue'),
    btnRemoveSceneNarration: $('btnRemoveSceneNarration'),
    btnDeleteScene: $('btnDeleteScene'),
    sceneOverlay: $('sceneOverlay'),
    textObjectList: $('textObjectList'),
    btnAddTextObject: $('btnAddTextObject'),
    textObjectDialog: $('textObjectDialog'),
    textObjectForm: $('textObjectForm'),
    textObjectDialogTitle: $('textObjectDialogTitle'),
    textObjectEditId: $('textObjectEditId'),
    textObjectType: $('textObjectType'),
    textObjectText: $('textObjectText'),
    textObjectX: $('textObjectX'),
    textObjectY: $('textObjectY'),
    textObjectWidth: $('textObjectWidth'),
    textObjectFontSize: $('textObjectFontSize'),
    textObjectColor: $('textObjectColor'),
    textObjectAlign: $('textObjectAlign'),
    textObjectBackground: $('textObjectBackground'),
    textObjectAnimation: $('textObjectAnimation'),
    btnDeleteTextObject: $('btnDeleteTextObject'),
    mediaObjectList: $('mediaObjectList'),
    btnAddMediaObject: $('btnAddMediaObject'),
    layerList: $('layerList'),
    layerCount: $('layerCount'),
    mediaObjectDialog: $('mediaObjectDialog'),
    mediaObjectForm: $('mediaObjectForm'),
    mediaObjectEditId: $('mediaObjectEditId'),
    mediaObjectDialogTitle: $('mediaObjectDialogTitle'),
    mediaObjectType: $('mediaObjectType'),
    mediaObjectTitle: $('mediaObjectTitle'),
    mediaUploadBox: $('mediaUploadBox'),
    mediaObjectFile: $('mediaObjectFile'),
    mediaObjectFilename: $('mediaObjectFilename'),
    mediaGalleryUploadBox: $('mediaGalleryUploadBox'),
    mediaGalleryFiles: $('mediaGalleryFiles'),
    mediaGalleryCount: $('mediaGalleryCount'),
    mediaUrlRow: $('mediaUrlRow'),
    mediaTargetRow: $('mediaTargetRow'),
    mediaObjectUrl: $('mediaObjectUrl'),
    mediaObjectTargetScene: $('mediaObjectTargetScene'),
    mediaObjectX: $('mediaObjectX'),
    mediaObjectY: $('mediaObjectY'),
    mediaObjectWidth: $('mediaObjectWidth'),
    mediaObjectHeight: $('mediaObjectHeight'),
    mediaObjectFit: $('mediaObjectFit'),
    mediaObjectAnimation: $('mediaObjectAnimation'),
    mediaStereoProjectionRow: $('mediaStereoProjectionRow'),
    mediaStereoProjection: $('mediaStereoProjection'),
    mediaAudioStyleRow: $('mediaAudioStyleRow'),
    mediaObjectAudioStyle: $('mediaObjectAudioStyle'),
    mediaVolumeRow: $('mediaVolumeRow'),
    mediaObjectVolume: $('mediaObjectVolume'),
    mediaObjectVolumeValue: $('mediaObjectVolumeValue'),
    mediaAutoplayRow: $('mediaAutoplayRow'),
    mediaLoopRow: $('mediaLoopRow'),
    mediaObjectAutoplay: $('mediaObjectAutoplay'),
    mediaObjectLoop: $('mediaObjectLoop'),
    btnDeleteMediaObject: $('btnDeleteMediaObject'),
    hotspotDialog: $('hotspotDialog'),
    hotspotForm: $('hotspotForm'),
    hotspotDialogTitle: $('hotspotDialogTitle'),
    hotspotCoordsLabel: $('hotspotCoordsLabel'),
    hotspotEditId: $('hotspotEditId'),
    hotspotType: $('hotspotType'),
    hotspotTypeControl: $('hotspotTypeControl'),
    hotspotText: $('hotspotText'),
    hotspotTransition: $('hotspotTransition'),
    hotspotAnchorInfo: $('hotspotAnchorInfo'),
    hotspotTarget: $('hotspotTarget'),
    hotspotTargetTypeHint: $('hotspotTargetTypeHint'),
    hotspotIconPicker: $('hotspotIconPicker'),
    hotspotIconPreset: $('hotspotIconPreset'),
    customIconUpload: $('customIconUpload'),
    hotspotIconFile: $('hotspotIconFile'),
    hotspotIconPreview: $('hotspotIconPreview'),
    hotspotIconFilename: $('hotspotIconFilename'),
    autoPreviewBox: $('autoPreviewBox'),
    hotspotAutoPreviewImage: $('hotspotAutoPreviewImage'),
    hotspotAutoPreviewStatus: $('hotspotAutoPreviewStatus'),
    btnRefreshHotspotPreview: $('btnRefreshHotspotPreview'),
    hotspotUrl: $('hotspotUrl'),
    hotspotInfo: $('hotspotInfo'),
    hotspotGlowEnabled: $('hotspotGlowEnabled'),
    hotspotGlowControls: $('hotspotGlowControls'),
    hotspotGlowColor: $('hotspotGlowColor'),
    hotspotGlowDemo: $('hotspotGlowDemo'),
    hotspotGlowBlur: $('hotspotGlowBlur'),
    hotspotGlowBlurValue: $('hotspotGlowBlurValue'),
    hotspotGlowStrength: $('hotspotGlowStrength'),
    hotspotGlowStrengthValue: $('hotspotGlowStrengthValue'),
    hotspotGlowPulse: $('hotspotGlowPulse'),
    hotspotGlowPulseSpeedRow: $('hotspotGlowPulseSpeedRow'),
    hotspotGlowPulseSpeed: $('hotspotGlowPulseSpeed'),
    hotspotGlowPulseSpeedValue: $('hotspotGlowPulseSpeedValue'),
    hotspotPitch: $('hotspotPitch'),
    hotspotYaw: $('hotspotYaw'),
    btnDeleteHotspot: $('btnDeleteHotspot'),
    previewDialog: $('previewDialog'),
    previewPanorama: $('previewPanorama'),
    previewSceneOverlay: $('previewSceneOverlay'),
    previewAudioControls: $('previewAudioControls'),
    previewMusicButton: $('previewMusicButton'),
    previewNarrationButton: $('previewNarrationButton'),
    closePreview: $('closePreview'),
    sceneGraphDialog: $('sceneGraphDialog'),
    closeSceneGraph: $('closeSceneGraph'),
    sceneGraph: $('sceneGraph'),
    graphSummary: $('graphSummary'),
    btnGraphAutoLayout: $('btnGraphAutoLayout'),
    guideDialog: $('guideDialog'),
    closeGuideDialog: $('closeGuideDialog'),
    guideEnabled: $('guideEnabled'),
    guideStepList: $('guideStepList'),
    btnAddGuideStep: $('btnAddGuideStep'),
    advancedSettingsDialog: $('advancedSettingsDialog'),
    closeAdvancedSettings: $('closeAdvancedSettings'),
    startScreenEnabled: $('startScreenEnabled'),
    startScreenTitle: $('startScreenTitle'),
    startScreenSubtitle: $('startScreenSubtitle'),
    startScreenCoverName: $('startScreenCoverName'),
    startScreenCoverFile: $('startScreenCoverFile'),
    startScreenAllowSilent: $('startScreenAllowSilent'),
    optimizeEnabled: $('optimizeEnabled'),
    optimizeQuality: $('optimizeQuality'),
    optimizeMaxImageWidth: $('optimizeMaxImageWidth'),
    optimizeObjectFrameWidth: $('optimizeObjectFrameWidth'),
    btnAnalyzeProject: $('btnAnalyzeProject'),
    projectSizeReport: $('projectSizeReport'),
    pwaEnabled: $('pwaEnabled'),
    kioskMode: $('kioskMode'),
    publicTourUrl: $('publicTourUrl'),
    qrPreview: $('qrPreview'),
    btnDownloadQr: $('btnDownloadQr'),
    downloadDialog: $('downloadDialog'),
    downloadReadyInfo: $('downloadReadyInfo'),
    downloadZipFilename: $('downloadZipFilename'),
    downloadZipSize: $('downloadZipSize'),
    downloadZipLink: $('downloadZipLink'),
    closeDownloadDialog: $('closeDownloadDialog'),
    dropOverlay: $('dropOverlay'),
    toast: $('toast')
  };

  let project = createEmptyProject();
  let currentSceneId = null;
  let viewer = null;
  let objectViewer = null;
  let stlViewer = null;
  let xrViewer = null;
  let previewViewer = null;
  let previewObjectViewer = null;
  let previewStlViewer = null;
  let previewXrViewer = null;
  let previewSceneId = null;
  let previewMusicAudio = null;
  let previewNarrationAudio = null;
  let dbPromise = null;
  let saveTimer = null;
  let toastTimer = null;
  let isRenderingViewer = false;
  let pendingHotspotIconData = '';
  let pendingHotspotIconFilename = '';
  let pendingHotspotPreviewTargetId = '';
  let autoPreviewGenerationToken = 0;
  let pendingZipDownloadUrl = '';
  let pendingZipBlob = null;
  let pendingZipFilename = '';
  let pendingMediaData = '';
  let pendingMediaFilename = '';
  let pendingMediaGallery = [];
  let pendingHotspotAnchor = null;
  let undoStack = [];
  let redoStack = [];
  let historySnapshot = '';
  let applyingHistory = false;
  const HISTORY_LIMIT = 60;

  function createEmptyProject() {
    return {
      version: PROJECT_VERSION,
      title: 'Виртуальная экскурсия',
      firstScene: null,
      audio: {
        music: { data: '', filename: '', volume: 35, loop: true }
      },
      startScreen: {
        enabled: true,
        title: 'Виртуальная экскурсия',
        subtitle: '',
        coverData: '',
        coverFilename: '',
        allowSilent: true
      },
      guide: {
        enabled: false,
        steps: []
      },
      exportSettings: {
        optimizeEnabled: true,
        jpegQuality: 84,
        maxImageWidth: 8192,
        objectFrameWidth: 1280,
        pwaEnabled: true,
        kioskMode: false,
        publicUrl: ''
      },
      settings: {
        fadeEnabled: true,
        fadeDuration: 900,
        autoRotateEnabled: false,
        autoRotate: -2,
        multiresEnabled: false,
        multiresTileSize: 512,
        multiresQuality: 85,
        multiresMaxCubeSize: 4096,
        defaultTransition: 'fade'
      },
      scenes: []
    };
  }

  function uid(prefix = 'id') {
    if (crypto && typeof crypto.randomUUID === 'function') {
      return prefix + '-' + crypto.randomUUID().slice(0, 8);
    }
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function slugify(value) {
    const translit = {
      а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',
      к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
      х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
    };
    return String(value || '')
      .toLowerCase()
      .split('')
      .map((ch) => translit[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42) || 'scene';
  }

  function cloneProjectForExport() {
    return JSON.parse(JSON.stringify(project));
  }

  function getScene(id = currentSceneId) {
    return project.scenes.find((scene) => scene.id === id) || null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  }

  function normalizeObject360Data(input = {}) {
    const sectors = Math.max(1, Math.min(720, Number(input.sectors) || 36));
    const rows = Math.max(1, Math.min(20, Number(input.rows) || 1));
    const sourceFrames = Array.isArray(input.frames) ? input.frames : [];
    const frames = Array.from({ length: rows }, (_, row) => {
      const sourceRow = Array.isArray(sourceFrames[row]) ? sourceFrames[row] : [];
      return Array.from({ length: sectors }, (_, sector) => String(sourceRow[sector] || ''));
    });
    const coverData = String(input.coverData || frames.flat().find(Boolean) || '');
    return {
      sectors,
      rows,
      frames,
      coverData,
      frameCount: Number(input.frameCount) || frames.flat().filter(Boolean).length,
      startSector: Math.max(0, Math.min(sectors - 1, Number(input.startSector) || 0)),
      startRow: Math.max(0, Math.min(rows - 1, Number(input.startRow) || (rows === 3 ? 1 : 0))),
      autoplay: Boolean(input.autoplay),
      backgroundMode: ['hitech','black','light','transparent','color','image'].includes(String(input.backgroundMode))
        ? String(input.backgroundMode)
        : 'hitech',
      backgroundColor: /^#[0-9a-f]{6}$/i.test(String(input.backgroundColor || ''))
        ? String(input.backgroundColor).toLowerCase()
        : '#ffffff',
      backgroundImageData: String(input.backgroundImageData || ''),
      backgroundImageName: String(input.backgroundImageName || ''),
      captureMode: String(input.captureMode || ''),
      baseRadiusMeters: Number(input.baseRadiusMeters) || 0,
      rowSpacingMeters: Number(input.rowSpacingMeters) || 0,
      objectDepthMeters: Number(input.objectDepthMeters) || 0
    };
  }

  function updateObject360BackgroundControls() {
    const mode = els.object360BackgroundMode.value || 'hitech';
    els.object360BackgroundColorRow.hidden = mode !== 'color';
    els.object360BackgroundImageRow.hidden = mode !== 'image';
  }

  function countObjectFrames(data) {
    return Array.isArray(data?.frames)
      ? data.frames.reduce((sum, row) => sum + (Array.isArray(row) ? row.filter(Boolean).length : 0), 0)
      : 0;
  }

  function objectFrameAngle(data, sector) {
    const sectors = Math.max(1, Number(data?.sectors) || 1);
    return 360 * ((Number(sector) || 0) % sectors) / sectors;
  }

  function sceneTypeMeta(scene) {
    if (scene?.sceneType === 'object360') {
      return { icon: '◉', label: 'Object360', detail: 'вращаемый объект из фотографий' };
    }
    if (scene?.sceneType === 'stl') {
      return { icon: '◆', label: 'STL 3D', detail: 'интерактивная 3D-модель' };
    }
    if (scene?.sceneType === 'xr') {
      return { icon: '◈', label: 'XR Media', detail: 'Three.js 180/360 · XR · Cardboard' };
    }
    return { icon: '◌', label: 'Панорама 360°', detail: 'Pannellum-панорама' };
  }

  function normalizeXrData(input = {}) {
    const projection = ['360','180','360_LR','180_LR','360_TB','180_TB'].includes(String(input.projection || '').toUpperCase())
      ? String(input.projection).toUpperCase()
      : '360';
    const kind = input.kind === 'image' ? 'image' : 'video';
    return {
      data: String(input.data || ''),
      filename: String(input.filename || ''),
      kind,
      projection,
      yaw: Number(input.yaw) || 0,
      pitch: clampNumber(input.pitch, -89, 89, 0),
      fov: clampNumber(input.fov, 35, 110, 80),
      autoplay: kind === 'video' && Boolean(input.autoplay),
      loop: kind === 'video' && Boolean(input.loop),
      muted: input.muted !== false,
      volume: clampNumber(input.volume, 0, 100, 80)
    };
  }

  function xrPlaceholderDataUrl(projection = '360') {
    const label = String(projection || '360').replace('_', ' ');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">' +
      '<defs><radialGradient id="g"><stop stop-color="#311b46"/><stop offset="1" stop-color="#07101b"/></radialGradient></defs>' +
      '<rect width="320" height="240" fill="url(#g)"/>' +
      '<circle cx="160" cy="112" r="62" fill="none" stroke="#ff8dcc" stroke-width="3"/>' +
      '<path d="M88 112h144M160 50c-22 18-34 39-34 62s12 44 34 62M160 50c22 18 34 39 34 62s-12 44-34 62" fill="none" stroke="#ffb8df" stroke-width="2" opacity=".85"/>' +
      '<text x="160" y="211" text-anchor="middle" fill="#ffb8df" font-family="Arial" font-size="18" font-weight="700">XR ' + label + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function normalizeStlData(input = {}) {
    return {
      data: String(input.data || ''),
      filename: String(input.filename || 'model.stl'),
      triangleCount: Math.max(0, Number(input.triangleCount) || 0),
      yaw: Number(input.yaw) || 0,
      pitch: clampNumber(input.pitch, -89, 89, -15),
      zoom: clampNumber(input.zoom, 0.35, 5, 1),
      wireframe: Boolean(input.wireframe),
      autoplay: Boolean(input.autoplay),
      color: /^#[0-9a-f]{6}$/i.test(String(input.color || '')) ? String(input.color).toLowerCase() : '#7c8cff',
      backgroundMode: ['hitech','black','light','gradient','transparent','image','panorama'].includes(String(input.backgroundMode))
        ? String(input.backgroundMode)
        : 'hitech',
      backgroundImageData: String(input.backgroundImageData || ''),
      backgroundImageName: String(input.backgroundImageName || ''),
      backgroundSceneId: String(input.backgroundSceneId || ''),
      size: {
        x: Math.max(0, Number(input.size?.x) || 0),
        y: Math.max(0, Number(input.size?.y) || 0),
        z: Math.max(0, Number(input.size?.z) || 0)
      }
    };
  }

  function stlBackgroundImageForData(data) {
    if (!data) return '';
    if (data.backgroundMode === 'image') {
      return data.backgroundImageData || '';
    }
    if (data.backgroundMode === 'panorama') {
      const target = getScene(data.backgroundSceneId);
      return target?.sceneType === 'panorama' ? (target.imageData || '') : '';
    }
    return '';
  }

  function populateStlBackgroundScenes(selectedId = '') {
    const panoramas = project.scenes.filter((scene) => scene.sceneType === 'panorama');
    els.stlBackgroundScene.innerHTML = panoramas.length
      ? panoramas.map((scene) => `<option value="${escapeHtml(scene.id)}">${escapeHtml(scene.title)}</option>`).join('')
      : '<option value="">Нет панорам в проекте</option>';
    els.stlBackgroundScene.disabled = !panoramas.length;
    if (selectedId && panoramas.some((scene) => scene.id === selectedId)) {
      els.stlBackgroundScene.value = selectedId;
    }
  }

  function updateStlBackgroundControls() {
    const mode = els.stlBackgroundMode.value || 'hitech';
    els.stlBackgroundImageRow.hidden = mode !== 'image';
    els.stlBackgroundSceneRow.hidden = mode !== 'panorama';
    if (mode === 'panorama') {
      populateStlBackgroundScenes(els.stlBackgroundScene.value);
    }
  }

  function stlPlaceholderDataUrl() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">' +
      '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#101a33"/><stop offset="1" stop-color="#07101b"/></linearGradient></defs>' +
      '<rect width="320" height="240" fill="url(#g)"/>' +
      '<g fill="none" stroke="#7c8cff" stroke-width="3" opacity=".9">' +
      '<path d="M160 48 236 92 236 164 160 208 84 164 84 92Z"/>' +
      '<path d="M160 48 160 124 236 164M160 124 84 164M84 92 160 124 236 92"/>' +
      '</g><text x="160" y="224" text-anchor="middle" fill="#b9c2ff" font-family="Arial" font-size="18" font-weight="700">STL 3D</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function showToast(message, timeout = 2400) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), timeout);
  }

  function setSaveState(state) {
    if (state === 'dirty') {
      els.saveState.textContent = 'Сохранение…';
      els.saveState.classList.add('dirty');
    } else if (state === 'error') {
      els.saveState.textContent = 'Ошибка сохранения';
      els.saveState.classList.add('dirty');
    } else {
      els.saveState.textContent = 'Сохранено';
      els.saveState.classList.remove('dirty');
    }
  }

  function openDB() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function persistProject() {
    try {
      const db = await openDB();
      if (!db) {
        localStorage.setItem(DB_NAME, JSON.stringify(project));
        setSaveState('saved');
        return;
      }

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(project, CURRENT_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      });
      setSaveState('saved');
    } catch (error) {
      console.error(error);
      setSaveState('error');
    }
  }

  async function loadPersistedProject() {
    try {
      const db = await openDB();
      if (!db) {
        const raw = localStorage.getItem(DB_NAME);
        return raw ? JSON.parse(raw) : null;
      }

      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(CURRENT_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Не удалось загрузить сохранённый проект', error);
      return null;
    }
  }

  async function clearPersistedProject() {
    const db = await openDB();
    if (!db) {
      localStorage.removeItem(DB_NAME);
      return;
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(CURRENT_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function markDirty({ rerenderViewer = false } = {}) {
    rememberHistory();
    setSaveState('dirty');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistProject, 350);

    renderSceneList();
    renderProjectSettings();
    renderSceneSettings();
    renderTextObjectList();
    renderMediaObjectList();
    renderLayerList();
    renderHotspotList();

    if (rerenderViewer) {
      renderViewer();
    }
  }

  function normalizeAudioSlot(input = {}, defaults = {}) {
    return {
      data: String(input.data || ''),
      filename: String(input.filename || ''),
      volume: clampNumber(input.volume, 0, 100, defaults.volume ?? 50),
      loop: input.loop === undefined ? Boolean(defaults.loop) : Boolean(input.loop)
    };
  }

  function normalizeSceneAudio(input = {}) {
    return {
      music: normalizeAudioSlot(input.music || {}, { volume: 45, loop: true }),
      narration: normalizeAudioSlot(input.narration || {}, { volume: 80, loop: false })
    };
  }

  function normalizeTextObject(input = {}) {
    const type = ['title','description'].includes(input.type) ? input.type : 'description';
    return {
      id: String(input.id || uid('text')),
      type,
      text: String(input.text || ''),
      x: clampNumber(input.x, 0, 100, 5),
      y: clampNumber(input.y, 0, 100, type === 'title' ? 8 : 70),
      width: clampNumber(input.width, 10, 90, type === 'title' ? 55 : 42),
      fontSize: clampNumber(input.fontSize, 12, 96, type === 'title' ? 42 : 20),
      color: /^#[0-9a-f]{6}$/i.test(String(input.color || '')) ? String(input.color).toLowerCase() : '#ffffff',
      align: ['left','center','right'].includes(input.align) ? input.align : 'left',
      background: ['none','dark','light'].includes(input.background) ? input.background : (type === 'description' ? 'dark' : 'none'),
      animation: ['none','fade','slide'].includes(input.animation) ? input.animation : 'fade',
      visible: input.visible !== false,
      locked: Boolean(input.locked),
      zIndex: Number.isFinite(Number(input.zIndex)) ? Number(input.zIndex) : 10
    };
  }

  function normalizeLayerFlags(input = {}) {
    return {
      visible: input.visible !== false,
      locked: Boolean(input.locked)
    };
  }

  function normalizeMediaObject(input = {}) {
    const type = ['image','stereo-photo','gallery','video','audio','pdf','button'].includes(input.type) ? input.type : 'image';
    const flags = normalizeLayerFlags(input);
    return {
      id: String(input.id || uid('media')),
      type,
      title: String(input.title || ''),
      data: String(input.data || ''),
      filename: String(input.filename || ''),
      gallery: Array.isArray(input.gallery) ? input.gallery.map((item) => ({
        data: String(item?.data || ''),
        filename: String(item?.filename || '')
      })).filter((item) => item.data) : [],
      url: String(input.url || ''),
      targetSceneId: String(input.targetSceneId || ''),
      x: clampNumber(input.x, 0, 100, 10),
      y: clampNumber(input.y, 0, 100, 20),
      width: clampNumber(input.width, 8, 95, type === 'button' ? 22 : 36),
      height: clampNumber(input.height, 6, 90, type === 'button' ? 10 : 32),
      fit: ['contain','cover'].includes(input.fit) ? input.fit : 'contain',
      autoplay: Boolean(input.autoplay),
      loop: Boolean(input.loop),
      volume: clampNumber(input.volume, 0, 100, 80),
      audioStyle: ['compact','large','hidden'].includes(input.audioStyle) ? input.audioStyle : 'compact',
      stereoProjection: ['FLAT_LR','FLAT_TB'].includes(String(input.stereoProjection || '').toUpperCase())
        ? String(input.stereoProjection).toUpperCase()
        : 'FLAT_LR',
      muted: input.muted !== false,
      background: ['none','dark','light'].includes(input.background) ? input.background : 'dark',
      animation: ['none','fade','slide','zoom'].includes(input.animation) ? input.animation : 'fade',
      visible: flags.visible,
      locked: flags.locked,
      zIndex: Number.isFinite(Number(input.zIndex)) ? Number(input.zIndex) : 20
    };
  }

  function normalizeGuide(input = {}, scenes = []) {
    const ids = new Set(scenes.map((scene) => scene.id));
    const steps = Array.isArray(input.steps) ? input.steps.map((step) => ({
      id: String(step.id || uid('guide')),
      sceneId: String(step.sceneId || ''),
      duration: clampNumber(step.duration, 2, 600, 12),
      narrationAuto: Boolean(step.narrationAuto),
      highlightHotspotId: String(step.highlightHotspotId || '')
    })).filter((step) => ids.has(step.sceneId)) : [];
    return { enabled: Boolean(input.enabled), steps };
  }

  function normalizeStartScreen(input = {}, title = '') {
    return {
      enabled: input.enabled !== false,
      title: String(input.title || title || 'Виртуальная экскурсия'),
      subtitle: String(input.subtitle || ''),
      coverData: String(input.coverData || ''),
      coverFilename: String(input.coverFilename || ''),
      allowSilent: input.allowSilent !== false
    };
  }

  function normalizeExportSettings(input = {}) {
    return {
      optimizeEnabled: input.optimizeEnabled !== false,
      jpegQuality: clampNumber(input.jpegQuality, 45, 100, 84),
      maxImageWidth: clampNumber(input.maxImageWidth, 1024, 16384, 8192),
      objectFrameWidth: clampNumber(input.objectFrameWidth, 480, 4096, 1280),
      pwaEnabled: input.pwaEnabled !== false,
      kioskMode: Boolean(input.kioskMode),
      publicUrl: String(input.publicUrl || '')
    };
  }

  function snapshotProject() {
    try { return JSON.stringify(project); } catch (_) { return ''; }
  }

  function resetHistory() {
    undoStack = [];
    redoStack = [];
    historySnapshot = snapshotProject();
  }

  function rememberHistory() {
    if (applyingHistory) return;
    const next = snapshotProject();
    if (!next || next === historySnapshot) return;
    if (historySnapshot) {
      undoStack.push(historySnapshot);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    }
    historySnapshot = next;
    redoStack = [];
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    if (els.btnUndo) els.btnUndo.disabled = undoStack.length === 0;
    if (els.btnRedo) els.btnRedo.disabled = redoStack.length === 0;
  }

  async function applyHistorySnapshot(snapshot, targetStack) {
    if (!snapshot) return;
    const current = snapshotProject();
    applyingHistory = true;
    try {
      if (current) targetStack.push(current);
      project = normalizeProject(JSON.parse(snapshot));
      currentSceneId = project.scenes.some((scene) => scene.id === currentSceneId)
        ? currentSceneId
        : (project.firstScene || project.scenes[0]?.id || null);
      historySnapshot = snapshotProject();
      await persistProject();
      renderAll();
    } finally {
      applyingHistory = false;
      updateHistoryButtons();
    }
  }

  async function undoProject() {
    const snapshot = undoStack.pop();
    await applyHistorySnapshot(snapshot, redoStack);
  }

  async function redoProject() {
    const snapshot = redoStack.pop();
    await applyHistorySnapshot(snapshot, undoStack);
  }

  function normalizeProject(input) {
    if (!input || typeof input !== 'object') throw new Error('Некорректный JSON проекта');

    const next = createEmptyProject();
    next.title = String(input.title || next.title);
    next.audio = {
      music: normalizeAudioSlot(input.audio?.music || {}, { volume: 35, loop: true })
    };
    next.startScreen = normalizeStartScreen(input.startScreen || {}, next.title);
    next.exportSettings = normalizeExportSettings(input.exportSettings || {});
    next.settings = { ...next.settings, ...(input.settings || {}) };
    next.settings.defaultTransition = ['fade','zoom','blur','portal','glitch','black'].includes(next.settings.defaultTransition)
      ? next.settings.defaultTransition
      : 'fade';
    next.scenes = Array.isArray(input.scenes) ? input.scenes.map((scene, index) => ({
      id: String(scene.id || uid('scene')),
      title: String(scene.title || 'Сцена ' + (index + 1)),
      sceneType: (scene.sceneType === 'xr' || scene.xr)
        ? 'xr'
        : ((scene.sceneType === 'stl' || scene.stl)
          ? 'stl'
          : ((scene.sceneType === 'object360' || scene.object360) ? 'object360' : 'panorama')),
      filename: String(scene.filename || (
        scene.sceneType === 'xr' || scene.xr
          ? ('xr-' + (index + 1) + (scene.xr?.kind === 'image' ? '.jpg' : '.mp4'))
          : (scene.sceneType === 'stl' || scene.stl
            ? ('model-' + (index + 1) + '.stl')
            : ('panorama-' + (index + 1) + '.jpg'))
      )),
      imageData: String(
        scene.imageData ||
        scene.panorama ||
        scene.object360?.coverData ||
        ((scene.sceneType === 'xr' || scene.xr) ? xrPlaceholderDataUrl(scene.xr?.projection) :
          ((scene.sceneType === 'stl' || scene.stl) ? stlPlaceholderDataUrl() : ''))
      ),
      object360: scene.sceneType === 'object360' || scene.object360 ? normalizeObject360Data(scene.object360 || {}) : null,
      stl: scene.sceneType === 'stl' || scene.stl ? normalizeStlData(scene.stl || {}) : null,
      xr: scene.sceneType === 'xr' || scene.xr ? normalizeXrData(scene.xr || {}) : null,
      pitch: Number.isFinite(Number(scene.pitch)) ? Number(scene.pitch) : 0,
      yaw: Number.isFinite(Number(scene.yaw)) ? Number(scene.yaw) : 0,
      hfov: Number.isFinite(Number(scene.hfov)) ? Number(scene.hfov) : 100,
      audio: normalizeSceneAudio(scene.audio || {}),
      textObjects: Array.isArray(scene.textObjects) ? scene.textObjects.map(normalizeTextObject) : [],
      mediaObjects: Array.isArray(scene.mediaObjects) ? scene.mediaObjects.map(normalizeMediaObject) : [],
      hotspots: Array.isArray(scene.hotspots) ? scene.hotspots.map((hotspot) => ({
        id: String(hotspot.id || uid('hotspot')),
        type: ['scene', 'info', 'url'].includes(hotspot.type) ? hotspot.type : 'info',
        text: String(hotspot.text || ''),
        pitch: Number.isFinite(Number(hotspot.pitch)) ? Number(hotspot.pitch) : 0,
        yaw: Number.isFinite(Number(hotspot.yaw)) ? Number(hotspot.yaw) : 0,
        targetSceneId: hotspot.targetSceneId ? String(hotspot.targetSceneId) : '',
        iconPreset: ['arrow', 'forward', 'door', 'stairs', 'preview', 'custom'].includes(hotspot.iconPreset) ? hotspot.iconPreset : 'arrow',
        iconData: hotspot.iconData ? String(hotspot.iconData) : '',
        iconFilename: hotspot.iconFilename ? String(hotspot.iconFilename) : '',
        glowEnabled: Boolean(hotspot.glowEnabled),
        glowColor: normalizeGlowColor(hotspot.glowColor),
        glowBlur: clampNumber(hotspot.glowBlur, 0, 50, 18),
        glowStrength: clampNumber(hotspot.glowStrength, 0, 100, 75),
        glowPulse: Boolean(hotspot.glowPulse),
        glowPulseSpeed: clampNumber(hotspot.glowPulseSpeed, 0.5, 4, 1.6),
        url: hotspot.url ? String(hotspot.url) : '',
        info: hotspot.info ? String(hotspot.info) : '',
        transition: ['fade','zoom','blur','portal','glitch','black'].includes(hotspot.transition) ? hotspot.transition : 'fade',
        anchorMode: ['panorama','object360','stl-screen','stl-3d','xr-screen'].includes(hotspot.anchorMode)
          ? hotspot.anchorMode
          : ((scene.sceneType === 'object360' || scene.object360)
            ? 'object360'
            : ((scene.sceneType === 'stl' || scene.stl)
              ? 'stl-screen'
              : ((scene.sceneType === 'xr' || scene.xr) ? 'xr-screen' : 'panorama'))),
        anchorX: clampNumber(hotspot.anchorX, 0, 100, 50),
        anchorY: clampNumber(hotspot.anchorY, 0, 100, 50),
        anchorSector: Math.max(0, Number(hotspot.anchorSector) || 0),
        anchorRow: Math.max(0, Number(hotspot.anchorRow) || 0),
        anchorYaw: Number(hotspot.anchorYaw) || 0,
        anchorPitch: Number(hotspot.anchorPitch) || 0,
        modelPoint: Array.isArray(hotspot.modelPoint) && hotspot.modelPoint.length >= 3
          ? hotspot.modelPoint.slice(0,3).map((v)=>Number(v)||0)
          : null,
        visible: hotspot.visible !== false,
        locked: Boolean(hotspot.locked),
        zIndex: Number.isFinite(Number(hotspot.zIndex)) ? Number(hotspot.zIndex) : 30
      })) : []
    })) : [];

    next.firstScene = next.scenes.some((scene) => scene.id === input.firstScene)
      ? String(input.firstScene)
      : (next.scenes[0]?.id || null);
    next.guide = normalizeGuide(input.guide || {}, next.scenes);

    return next;
  }

  function renderAll() {
    renderSceneList();
    renderProjectSettings();
    renderSceneSettings();
    renderTextObjectList();
    renderMediaObjectList();
    renderLayerList();
    renderHotspotList();
    updateToolbarState();
    renderViewer();
    updateHistoryButtons();
  }

  function renderSceneList() {
    if (!project.scenes.length) {
      els.sceneList.className = 'scene-list empty';
      els.sceneList.innerHTML = '<div class="empty-state">Добавьте первую сцену</div>';
      return;
    }

    els.sceneList.className = 'scene-list';
    els.sceneList.innerHTML = project.scenes.map((scene, index) => {
      const count = scene.hotspots?.length || 0;
      const isObject = scene.sceneType === 'object360';
      const isStl = scene.sceneType === 'stl';
      const isXr = scene.sceneType === 'xr';
      const thumb = scene.imageData || scene.object360?.coverData || (isXr ? xrPlaceholderDataUrl(scene.xr?.projection) : (isStl ? stlPlaceholderDataUrl() : ''));
      const kind = isObject
        ? '<span class="scene-kind">ОБЪЕКТ 360</span>'
        : (isStl
          ? '<span class="scene-kind stl-kind">STL 3D</span>'
          : (isXr ? '<span class="scene-kind xr-kind">XR</span>' : ''));
      const info = isObject
        ? ((scene.object360?.sectors || 0) + ' кадров × ' + (scene.object360?.rows || 1) + ' ряд.')
        : (isStl
          ? ((scene.stl?.triangleCount || 0).toLocaleString('ru-RU') + ' треуг.')
          : (isXr
            ? ((scene.xr?.kind === 'image' ? 'Фото' : 'Видео') + ' · ' + (scene.xr?.projection || '360'))
            : (count + ' ' + (count === 1 ? 'точка' : 'точек'))));

      return `
        <article class="scene-card ${isObject ? 'object360' : ''} ${isStl ? 'stl-scene' : ''} ${isXr ? 'xr-scene' : ''} ${scene.id === currentSceneId ? 'active' : ''}" data-scene-id="${escapeHtml(scene.id)}">
          <div class="scene-card-main">
            <img class="scene-thumb" src="${escapeHtml(thumb)}" alt="">
            <div class="scene-meta">
              <b>${escapeHtml(scene.title)}${kind}</b>
              <span>${info}${project.firstScene === scene.id ? ' · старт' : ''}</span>
            </div>
            <span class="scene-index">${index + 1}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderProjectSettings() {
    els.projectTitle.value = project.title || '';
    const projectMusic = normalizeAudioSlot(project.audio?.music || {}, { volume: 35, loop: true });
    project.audio = { music: projectMusic };
    els.projectMusicName.textContent = projectMusic.filename || 'Не выбрана';
    els.projectMusicVolume.value = String(projectMusic.volume);
    els.projectMusicVolumeValue.textContent = projectMusic.volume + '%';
    els.projectMusicLoop.checked = Boolean(projectMusic.loop);
    els.sceneFadeEnabled.checked = Boolean(project.settings.fadeEnabled);
    els.sceneFadeDuration.value = Number(project.settings.fadeDuration ?? 900);
    els.defaultTransition.value = ['fade','zoom','blur','portal','glitch','black'].includes(project.settings.defaultTransition)
      ? project.settings.defaultTransition : 'fade';
    els.autoRotateEnabled.checked = Boolean(project.settings.autoRotateEnabled);
    els.autoRotate.value = Number(project.settings.autoRotate ?? -2);
    els.multiresEnabled.checked = Boolean(project.settings.multiresEnabled);
    els.multiresTileSize.value = String([512, 1024].includes(Number(project.settings.multiresTileSize))
      ? Number(project.settings.multiresTileSize) : 512);
    els.multiresQuality.value = String(clampNumber(project.settings.multiresQuality, 50, 100, 85));
    els.multiresMaxCubeSize.value = String([2048, 4096, 8192].includes(Number(project.settings.multiresMaxCubeSize))
      ? Number(project.settings.multiresMaxCubeSize) : 4096);
    els.multiresOptions.hidden = !els.multiresEnabled.checked;

    const options = project.scenes.map((scene) =>
      `<option value="${escapeHtml(scene.id)}">${escapeHtml(scene.title)}</option>`
    ).join('');

    els.firstScene.innerHTML = options || '<option value="">Нет сцен</option>';
    els.firstScene.disabled = !project.scenes.length;
    if (project.firstScene) els.firstScene.value = project.firstScene;
  }

  function renderSceneSettings() {
    const scene = getScene();
    const active = Boolean(scene);
    els.sceneSettings.hidden = !active;
    els.noSceneSettings.hidden = active;

    if (!scene) {
      els.sceneSettingsSubtitle.textContent = 'Не выбрана';
      return;
    }

    els.sceneSettingsSubtitle.textContent = scene.title;
    els.sceneTitle.value = scene.title;
    els.sceneId.value = scene.id;

    const isObject = scene.sceneType === 'object360';
    const isStl = scene.sceneType === 'stl';
    const isXr = scene.sceneType === 'xr';
    els.panoramaSceneSettings.hidden = isObject || isStl || isXr;
    els.object360SceneSettings.hidden = !isObject;
    els.stlSceneSettings.hidden = !isStl;
    els.xrSceneSettings.hidden = !isXr;

    if (isObject) {
      const data = scene.object360 || normalizeObject360Data({});
      els.object360SceneStats.textContent = (data.sectors || 0) + ' секторов × ' + (data.rows || 1) + ' ряд.';
      els.object360SceneFile.textContent = (data.frameCount || countObjectFrames(data)) + ' кадров';
      els.object360StartSector.max = String(Math.max(0, (data.sectors || 1) - 1));
      els.object360StartSector.value = String(Math.min(Math.max(0, Number(data.startSector) || 0), Math.max(0, (data.sectors || 1) - 1)));
      els.object360StartRow.max = String(Math.max(0, (data.rows || 1) - 1));
      els.object360StartRow.value = String(Math.min(Math.max(0, Number(data.startRow) || 0), Math.max(0, (data.rows || 1) - 1)));
      els.object360Autoplay.checked = Boolean(data.autoplay);
      els.object360BackgroundMode.value = data.backgroundMode || 'hitech';
      els.object360BackgroundColor.value = data.backgroundColor || '#ffffff';
      els.object360BackgroundImageName.textContent = data.backgroundImageName || 'Файл не выбран';
      updateObject360BackgroundControls();
      els.object360Filename.textContent = scene.filename || 'object360.zip';
    } else if (isXr) {
      const data = normalizeXrData(scene.xr || {});
      scene.xr = data;
      els.xrSceneStats.textContent =
        (data.kind === 'image' ? 'XR фото' : 'XR видео') + ' · ' + data.projection;
      els.xrSceneFile.textContent = data.kind === 'image'
        ? 'Изображение для Three.js / Cardboard / XR'
        : 'Видео для Three.js / Cardboard / WebXR';
      els.xrProjection.value = data.projection;
      els.xrYaw.value = String(data.yaw);
      els.xrPitch.value = String(data.pitch);
      els.xrFov.value = String(data.fov);
      els.xrAutoplay.checked = Boolean(data.autoplay);
      els.xrLoop.checked = Boolean(data.loop);
      els.xrVolume.value = String(data.volume);
      els.xrVolumeValue.textContent = data.volume + '%';
      els.xrAutoplayRow.hidden = data.kind !== 'video';
      els.xrLoopRow.hidden = data.kind !== 'video';
      els.xrVolumeRow.hidden = data.kind !== 'video';
      els.xrFilename.textContent = scene.filename || data.filename || (data.kind === 'image' ? 'xr.jpg' : 'xr.mp4');
    } else if (isStl) {
      const data = normalizeStlData(scene.stl || {});
      const sx = data.size.x ? data.size.x.toFixed(1) : '—';
      const sy = data.size.y ? data.size.y.toFixed(1) : '—';
      const sz = data.size.z ? data.size.z.toFixed(1) : '—';
      els.stlSceneStats.textContent = data.triangleCount.toLocaleString('ru-RU') + ' треугольников';
      els.stlSceneFile.textContent = 'Размер STL: ' + sx + ' × ' + sy + ' × ' + sz;
      els.stlYaw.value = String(data.yaw);
      els.stlPitch.value = String(data.pitch);
      els.stlZoom.value = String(data.zoom);
      els.stlColor.value = data.color;
      els.stlBackgroundMode.value = data.backgroundMode;
      els.stlBackgroundImageName.textContent = data.backgroundImageName || 'Файл не выбран';
      populateStlBackgroundScenes(data.backgroundSceneId);
      if (data.backgroundSceneId && !els.stlBackgroundScene.disabled) {
        els.stlBackgroundScene.value = data.backgroundSceneId;
      }
      updateStlBackgroundControls();
      els.stlWireframe.checked = Boolean(data.wireframe);
      els.stlAutoplay.checked = Boolean(data.autoplay);
      els.stlFilename.textContent = scene.filename || data.filename || 'model.stl';
    } else {
      els.scenePitch.value = formatNum(scene.pitch);
      els.sceneYaw.value = formatNum(scene.yaw);
      els.sceneHfov.value = Number(scene.hfov);
      els.sceneFilename.textContent = scene.filename || 'panorama.jpg';
    }

    scene.audio = normalizeSceneAudio(scene.audio || {});
    els.sceneMusicName.textContent = scene.audio.music.filename || 'Не выбрана';
    els.sceneMusicVolume.value = String(scene.audio.music.volume);
    els.sceneMusicVolumeValue.textContent = scene.audio.music.volume + '%';
    els.sceneMusicLoop.checked = Boolean(scene.audio.music.loop);
    els.sceneNarrationName.textContent = scene.audio.narration.filename || 'Не выбрана';
    els.sceneNarrationVolume.value = String(scene.audio.narration.volume);
    els.sceneNarrationVolumeValue.textContent = scene.audio.narration.volume + '%';

    renderTextObjectList();
  }

  function textObjectMarkup(item, { editor = false } = {}) {
    const classes = [
      'scene-text-object',
      'scene-text-' + item.type,
      'scene-text-bg-' + item.background,
      'scene-text-anim-' + item.animation,
      editor ? 'is-editor' : ''
    ].filter(Boolean).join(' ');

    const style = [
      'left:' + item.x + '%',
      'top:' + item.y + '%',
      'width:' + item.width + '%',
      'font-size:' + item.fontSize + 'px',
      'color:' + item.color,
      'text-align:' + item.align,
      'z-index:' + (Number(item.zIndex) || 10)
    ].join(';');

    return '<div class="' + classes + '" data-text-object-id="' + escapeHtml(item.id) + '" style="' + style + '">' +
      '<div class="scene-text-inner">' + escapeHtml(item.text).replace(/\n/g, '<br>') + '</div>' +
      (editor ? '<span class="scene-text-drag-hint">перетащить</span>' : '') +
      '</div>';
  }

  function renderSceneTextOverlay(scene = getScene(), target = els.sceneOverlay, { editor = true, append = false } = {}) {
    if (!target) return;
    const items = Array.isArray(scene?.textObjects) ? scene.textObjects.map(normalizeTextObject) : [];
    if (scene) scene.textObjects = items;
    const markup = items.filter((item) => item.visible !== false).map((item) => {
      const html = textObjectMarkup(item, { editor: editor && !item.locked });
      return item.locked && editor ? html.replace('scene-text-object ', 'scene-text-object is-locked ') : html;
    }).join('');
    if (append) target.insertAdjacentHTML('beforeend', markup);
    else target.innerHTML = markup;
  }

  function renderTextObjectList() {
    const scene = getScene();
    const items = scene?.textObjects || [];
    if (!items.length) {
      els.textObjectList.className = 'text-object-list empty';
      els.textObjectList.innerHTML = '<div class="empty-state">Нет текста</div>';
      return;
    }

    els.textObjectList.className = 'text-object-list';
    els.textObjectList.innerHTML = items.map((item) => {
      const label = item.type === 'title' ? 'Заголовок' : 'Описание';
      return '<article class="text-object-card" data-text-object-id="' + escapeHtml(item.id) + '">' +
        '<span class="text-object-kind">' + (item.type === 'title' ? 'H' : 'T') + '</span>' +
        '<div><b>' + escapeHtml(label) + '</b><span>' + escapeHtml(item.text || 'Без текста') + '</span></div>' +
        '<em>' + Math.round(item.x) + '% / ' + Math.round(item.y) + '%</em>' +
        '</article>';
    }).join('');
  }

  function mediaObjectMarkup(item, { editor = false } = {}) {
    if (item.visible === false) return '';
    let cls = [
      'scene-media-object',
      'scene-media-' + item.type,
      'scene-media-anim-' + item.animation,
      editor && !item.locked ? 'is-editor' : '',
      editor && item.locked ? 'is-locked' : ''
    ].filter(Boolean).join(' ');
    const style = [
      'left:' + item.x + '%',
      'top:' + item.y + '%',
      'width:' + item.width + '%',
      'height:' + item.height + '%',
      'z-index:' + (Number(item.zIndex) || 20)
    ].join(';');

    let body = '';
    if (item.type === 'image' && item.data) {
      body = '<img src="' + escapeHtml(item.data) + '" alt="' + escapeHtml(item.title || '') + '" style="object-fit:' + item.fit + '">';
    } else if (item.type === 'gallery') {
      const first = item.gallery?.[0]?.data || '';
      body = first
        ? '<div class="scene-gallery-frame"><img src="' + escapeHtml(first) + '" alt=""><span>1 / ' + item.gallery.length + '</span></div>'
        : '<div class="scene-media-placeholder">Галерея</div>';
    } else if (item.type === 'video' && item.data) {
      body = '<video src="' + escapeHtml(item.data) + '" controls playsinline ' +
        (item.autoplay ? 'autoplay muted ' : '') + (item.loop ? 'loop ' : '') + '></video>';
    } else if (item.type === 'audio' && item.data) {
      const audioStyle = ['compact','large','hidden'].includes(item.audioStyle) ? item.audioStyle : 'compact';
      const audio = '<audio class="scene-audio-element" data-media-volume="' + item.volume +
        '" data-media-autoplay="' + (item.autoplay ? '1' : '0') + '" src="' + escapeHtml(item.data) +
        '" preload="metadata" ' + (audioStyle === 'hidden' ? '' : 'controls ') + (item.loop ? 'loop ' : '') + '></audio>';
      if (audioStyle === 'hidden') {
        body = (editor
          ? '<div class="scene-audio-hidden-editor"><b>♪</b><span>' + escapeHtml(item.title || item.filename || 'Скрытое аудио') + '</span></div>'
          : '') + audio;
      } else {
        body = '<div class="scene-audio-player ' + audioStyle + '">' +
          '<div class="scene-audio-header"><span class="scene-audio-icon">♪</span><span class="scene-audio-title">' +
          escapeHtml(item.title || item.filename || 'Аудио') + '</span></div>' + audio + '</div>';
      }
    } else if (item.type === 'pdf') {
      body = '<div class="scene-document-card"><b>PDF</b><span>' + escapeHtml(item.title || item.filename || 'Документ') + '</span></div>';
    } else if (item.type === 'button') {
      body = '<button type="button" class="scene-action-button">' + escapeHtml(item.title || 'Подробнее') + '</button>';
    } else {
      body = '<div class="scene-media-placeholder">' + escapeHtml(item.title || item.type) + '</div>';
    }

    if (item.type === 'audio' && item.audioStyle === 'hidden') cls += ' scene-media-audio-hidden';

    return '<div class="' + cls + '" data-media-object-id="' + escapeHtml(item.id) + '" style="' + style + '">' +
      body + (editor && !item.locked ? '<span class="scene-media-drag-hint">перетащить</span>' : '') + '</div>';
  }

  function renderSceneMediaOverlay(scene = getScene(), target = els.sceneOverlay, { editor = true, append = true } = {}) {
    if (!target) return;
    const items = Array.isArray(scene?.mediaObjects) ? scene.mediaObjects.map(normalizeMediaObject) : [];
    if (scene) scene.mediaObjects = items;
    const markup = items.map((item) => mediaObjectMarkup(item, { editor })).join('');
    if (append) target.insertAdjacentHTML('beforeend', markup);
    else target.innerHTML = markup;
    target.querySelectorAll('audio.scene-audio-element').forEach((audio) => {
      audio.volume = clampNumber(Number(audio.dataset.mediaVolume) / 100, 0, 1, 0.8);
      if (!editor && audio.dataset.mediaAutoplay === '1') {
        audio.play().catch(() => {});
      }
    });
  }

  function screenHotspotVisible(hotspot, scene, state = null, projector = null) {
    if (hotspot.visible === false) return false;
    if (scene.sceneType === 'object360') {
      if (!state) return true;
      const sectors = Math.max(1, Number(scene.object360?.sectors) || 1);
      const a = ((Number(state.sector) || 0) - hotspot.anchorSector + sectors) % sectors;
      const distance = Math.min(a, sectors - a);
      return distance <= Math.max(1, Math.round(sectors / 18)) &&
        Number(state.row || 0) === Number(hotspot.anchorRow || 0);
    }
    if (scene.sceneType === 'stl') {
      if (hotspot.anchorMode === 'stl-3d' && hotspot.modelPoint && projector?.projectPoint) {
        return Boolean(projector.projectPoint(hotspot.modelPoint)?.visible);
      }
      if (!state) return true;
      const dy = Math.abs((((Number(state.yaw) || 0) - hotspot.anchorYaw + 540) % 360) - 180);
      const dp = Math.abs((Number(state.pitch) || 0) - hotspot.anchorPitch);
      return dy <= 65 && dp <= 55;
    }
    if (scene.sceneType === 'xr') {
      if (!state) return true;
      const dy = Math.abs((((Number(state.yaw) || 0) - hotspot.anchorYaw + 540) % 360) - 180);
      const dp = Math.abs((Number(state.pitch) || 0) - hotspot.anchorPitch);
      return dy <= 72 && dp <= 58;
    }
    return false;
  }

  function screenHotspotPosition(hotspot, scene, state = null, projector = null) {
    let x = hotspot.anchorX;
    let y = hotspot.anchorY;
    if (scene.sceneType === 'stl' && hotspot.anchorMode === 'stl-3d' && hotspot.modelPoint && projector?.projectPoint) {
      const projected = projector.projectPoint(hotspot.modelPoint);
      if (projected) return { x:projected.x, y:projected.y };
    }
    if ((scene.sceneType === 'stl' || scene.sceneType === 'xr') && state) {
      const dy = ((((Number(state.yaw) || 0) - hotspot.anchorYaw + 540) % 360) - 180);
      const dp = (Number(state.pitch) || 0) - hotspot.anchorPitch;
      x = hotspot.anchorX - dy * 0.55;
      y = hotspot.anchorY - dp * 0.65;
    }
    return { x: clampNumber(x, -20, 120, hotspot.anchorX), y: clampNumber(y, -20, 120, hotspot.anchorY) };
  }

  function screenHotspotMarkup(hotspot, scene, state = null, { editor = false, projector = null } = {}) {
    if (!screenHotspotVisible(hotspot, scene, state, projector)) return '';
    const pos = screenHotspotPosition(hotspot, scene, state, projector);
    const label = hotspot.text || (hotspot.type === 'scene' ? 'Переход' : hotspot.type === 'url' ? 'Ссылка' : 'Инфо');
    return '<button type="button" class="screen-hotspot ' + (editor ? 'is-editor' : '') +
      ' hotspot-' + escapeHtml(hotspot.type) + '" data-screen-hotspot-id="' + escapeHtml(hotspot.id) +
      '" style="left:' + pos.x + '%;top:' + pos.y + '%;z-index:' + (Number(hotspot.zIndex) || 30) + '" title="' + escapeHtml(label) + '">' +
      (hotspot.type === 'scene' ? '→' : hotspot.type === 'url' ? '↗' : 'i') +
      '<span>' + escapeHtml(label) + '</span></button>';
  }

  function renderScreenHotspots(scene = getScene(), target = els.sceneOverlay, state = null, { editor = true, append = true, projector = null } = {}) {
    if (!target || !scene || scene.sceneType === 'panorama') return;
    const hotspots = Array.isArray(scene.hotspots) ? scene.hotspots : [];
    const markup = hotspots.map((hotspot) => screenHotspotMarkup(hotspot, scene, state, { editor, projector })).join('');
    if (append) target.insertAdjacentHTML('beforeend', markup);
    else target.innerHTML = markup;
  }

  function renderCompositeOverlay(scene = getScene(), target = els.sceneOverlay, state = null, { editor = true, projector = null } = {}) {
    if (!target) return;
    target.innerHTML = '';
    if (!scene) {
      target.hidden = true;
      return;
    }
    renderSceneTextOverlay(scene, target, { editor, append: true });
    renderSceneMediaOverlay(scene, target, { editor, append: true });
    renderScreenHotspots(scene, target, state, { editor, append: true, projector });
    target.hidden = !target.children.length;
  }

  function renderDynamicScreenHotspots(scene = getScene(), target = els.sceneOverlay, state = null, { editor = true, projector = null } = {}) {
    if (!target || !scene) return;
    target.querySelectorAll('.screen-hotspot').forEach((element) => element.remove());
    renderScreenHotspots(scene, target, state, { editor, append: true, projector });
    target.hidden = !target.children.length;
  }

  function renderMediaObjectList() {
    const scene = getScene();
    const items = scene?.mediaObjects || [];
    if (!items.length) {
      els.mediaObjectList.className = 'media-object-list empty';
      els.mediaObjectList.innerHTML = '<div class="empty-state">Нет медиа</div>';
      return;
    }
    const labels = { image:'Фото', gallery:'Галерея', video:'Видео', audio:'Аудио', pdf:'PDF', button:'Кнопка' };
    els.mediaObjectList.className = 'media-object-list';
    els.mediaObjectList.innerHTML = items.map((item) =>
      '<article class="media-object-card" data-media-object-id="' + escapeHtml(item.id) + '">' +
      '<span class="media-object-kind">' + ({image:'▧',gallery:'▦',video:'▶',audio:'♪',pdf:'PDF',button:'↗'}[item.type] || '◈') + '</span>' +
      '<div><b>' + escapeHtml(labels[item.type] || item.type) + '</b><span>' + escapeHtml(item.title || item.filename || 'Без названия') + '</span></div>' +
      '<em>' + (item.visible === false ? 'скрыт' : (item.locked ? '🔒' : '')) + '</em></article>'
    ).join('');
  }

  function renderLayerList() {
    const scene = getScene();
    const layers = [];
    if (scene) {
      (scene.textObjects || []).forEach((item) => layers.push({ kind:'text', id:item.id, label:item.text || 'Текст', item }));
      (scene.mediaObjects || []).forEach((item) => layers.push({ kind:'media', id:item.id, label:item.title || item.filename || item.type, item }));
      (scene.hotspots || []).forEach((item) => layers.push({ kind:'hotspot', id:item.id, label:item.text || 'Hotspot', item }));
    }
    els.layerCount.textContent = String(layers.length);
    if (!layers.length) {
      els.layerList.className = 'layer-list empty';
      els.layerList.innerHTML = '<div class="empty-state">Нет слоёв</div>';
      return;
    }
    layers.sort((a,b) => (Number(b.item.zIndex)||0) - (Number(a.item.zIndex)||0));
    els.layerList.className = 'layer-list';
    els.layerList.innerHTML = layers.map((layer) =>
      '<article class="layer-card" data-layer-kind="' + layer.kind + '" data-layer-id="' + escapeHtml(layer.id) + '">' +
      '<button type="button" data-layer-action="visible" title="Показать / скрыть">' + (layer.item.visible === false ? '○' : '👁') + '</button>' +
      '<button type="button" data-layer-action="locked" title="Заблокировать">' + (layer.item.locked ? '🔒' : '🔓') + '</button>' +
      '<button type="button" data-layer-action="up" title="Выше">↑</button>' +
      '<button type="button" data-layer-action="down" title="Ниже">↓</button>' +
      '<div><b>' + escapeHtml(layer.kind === 'text' ? 'Текст' : layer.kind === 'media' ? 'Медиа' : 'Hotspot') + '</b><span>' + escapeHtml(layer.label) + '</span></div>' +
      '</article>'
    ).join('');
  }

  function renderHotspotList() {
    const scene = getScene();
    const hotspots = scene?.hotspots || [];
    els.hotspotCount.textContent = String(hotspots.length);

    if (!hotspots.length) {
      els.hotspotList.className = 'hotspot-list empty';
      els.hotspotList.innerHTML = '<div class="empty-state">Нет точек</div>';
      return;
    }

    els.hotspotList.className = 'hotspot-list';
    els.hotspotList.innerHTML = hotspots.map((hotspot) => {
      const targetScene = hotspot.type === 'scene' ? getScene(hotspot.targetSceneId) : null;
      const target = hotspot.type === 'scene'
        ? (targetScene
          ? (sceneTypeMeta(targetScene).icon + ' ' + targetScene.title + ' · ' + sceneTypeMeta(targetScene).label)
          : 'Сцена не найдена')
        : hotspot.type === 'url' ? hotspot.url || 'Ссылка'
        : hotspot.info || 'Информация';
      const icon = hotspot.type === 'scene' ? '→' : hotspot.type === 'url' ? '↗' : 'i';
      const iconMarkup = hotspot.type === 'scene' && hotspot.iconPreset === 'preview' && hotspot.iconData
        ? '<span class="hotspot-icon scene has-image"><img src="' + escapeHtml(hotspot.iconData) + '" alt=""></span>'
        : '<span class="hotspot-icon ' + escapeHtml(hotspot.type) + '">' + icon + '</span>';
      return `
        <article class="hotspot-card" data-hotspot-id="${escapeHtml(hotspot.id)}">
          ${iconMarkup}
          <div>
            <b>${escapeHtml(hotspot.text || target)}</b>
            <span>${escapeHtml(target)}</span>
          </div>
          <em>${formatNum(hotspot.yaw)}°</em>
        </article>
      `;
    }).join('');
  }

  function updateToolbarState() {
    const scene = getScene();
    const hasScene = Boolean(scene);
    const isObject = scene?.sceneType === 'object360';
    const isStl = scene?.sceneType === 'stl';
    els.btnAddHotspot.disabled = !hasScene;
    els.btnSetInitialView.disabled = !hasScene;
    els.btnSetInitialView.textContent = isObject
      ? 'Сохранить текущий кадр'
      : (isStl ? 'Сохранить ракурс модели' : 'Сохранить текущий вид');
    els.btnPreview.disabled = !project.scenes.length;
    els.btnAddTextObject.disabled = !hasScene;
    els.btnAddMediaObject.disabled = !hasScene;
    els.viewerPlaceholder.hidden = hasScene;
    renderCompositeOverlay(scene, els.sceneOverlay, null, { editor: true });
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeGlowColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#6c7cff';
  }

  function hexToRgb(hex) {
    const value = normalizeGlowColor(hex).slice(1);
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function hotspotStyleClass(hotspot) {
    return 'hotspot-style-' + hotspotCssToken(hotspot.id);
  }

  function normalizedGlow(hotspot) {
    return {
      enabled: Boolean(hotspot.glowEnabled),
      color: normalizeGlowColor(hotspot.glowColor),
      blur: clampNumber(hotspot.glowBlur, 0, 50, 18),
      strength: clampNumber(hotspot.glowStrength, 0, 100, 75),
      pulse: Boolean(hotspot.glowPulse),
      pulseSpeed: clampNumber(hotspot.glowPulseSpeed, 0.5, 4, 1.6)
    };
  }

  function glowFilterString(glow, multiplier = 1) {
    const rgb = hexToRgb(glow.color);
    const alpha = Math.min(1, Math.max(0, glow.strength / 100 * multiplier));
    const outerAlpha = Math.min(1, alpha * 0.58);
    const innerBlur = Math.max(1, Math.round(glow.blur * 0.45));
    const outerBlur = Math.max(1, Math.round(glow.blur));
    return 'drop-shadow(0 0 ' + innerBlur + 'px rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha.toFixed(3) + ')) ' +
      'drop-shadow(0 0 ' + outerBlur + 'px rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + outerAlpha.toFixed(3) + '))';
  }

  function buildHotspotGlowCss(hotspot) {
    const glow = normalizedGlow(hotspot);
    if (!glow.enabled) return '';

    const token = hotspotCssToken(hotspot.id);
    const selector = '.pnlm-hotspot-base.' + hotspotStyleClass(hotspot);

    if (!glow.pulse) {
      const filter = glowFilterString(glow, 1);
      return selector + ',' + selector + ':hover{filter:' + filter + '!important;}';
    }

    const animationName = 'hotspotGlowPulse-' + token;
    const low = glowFilterString(glow, 0.48);
    const high = glowFilterString(glow, 1.12);
    return '@keyframes ' + animationName + '{0%{filter:' + low + '}100%{filter:' + high + '}}\n' +
      selector + '{animation:' + animationName + ' ' + glow.pulseSpeed.toFixed(1) + 's ease-in-out infinite alternate;}';
  }

  function hotspotCssToken(id) {
    return String(id || 'hotspot').replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function transitionIconClass(hotspot) {
    const preset = ['arrow', 'forward', 'door', 'stairs', 'preview', 'custom'].includes(hotspot.iconPreset)
      ? hotspot.iconPreset
      : 'arrow';
    if ((preset === 'custom' || preset === 'preview') && hotspot.iconData) {
      return 'scene-image-hotspot ' +
        (preset === 'preview' ? 'scene-preview-hotspot ' : '') +
        'hotspot-custom-' + hotspotCssToken(hotspot.id);
    }
    return 'scene-image-hotspot scene-icon-' + ((preset === 'custom' || preset === 'preview') ? 'arrow' : preset);
  }

  function refreshCustomHotspotStyles() {
    let style = document.getElementById('customHotspotIconStyles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'customHotspotIconStyles';
      document.head.appendChild(style);
    }

    const rules = [];
    project.scenes.forEach((scene) => {
      (scene.hotspots || []).forEach((hotspot) => {
        if (hotspot.type === 'scene' && ['custom', 'preview'].includes(hotspot.iconPreset) && hotspot.iconData) {
          const safeData = String(hotspot.iconData).replace(/["\\\n\r]/g, (ch) => {
            if (ch === '"') return '%22';
            if (ch === '\\') return '%5C';
            return '';
          });
          rules.push('.hotspot-custom-' + hotspotCssToken(hotspot.id) +
            '{background-image:url("' + safeData + '")!important}');
        }

        const glowCss = buildHotspotGlowCss(hotspot);
        if (glowCss) rules.push(glowCss);
      });
    });
    style.textContent = rules.join('\n');
  }

  function updateAutoPreviewUi(message = '') {
    const isPreview = els.hotspotIconPreset.value === 'preview';
    els.autoPreviewBox.hidden = !isPreview;
    if (!isPreview) return;

    const ready = Boolean(pendingHotspotIconData);
    els.autoPreviewBox.classList.toggle('ready', ready);
    els.hotspotAutoPreviewImage.src = ready ? pendingHotspotIconData : '';
    els.hotspotAutoPreviewImage.style.visibility = ready ? 'visible' : 'hidden';
    els.hotspotAutoPreviewStatus.textContent = message || (ready
      ? 'Авто-превью целевой сцены'
      : 'Превью ещё не создано');
  }

  function setHotspotIconPreset(preset) {
    if (!['arrow', 'forward', 'door', 'stairs', 'preview', 'custom'].includes(preset)) preset = 'arrow';
    els.hotspotIconPreset.value = preset;
    [...els.hotspotIconPicker.querySelectorAll('[data-icon]')].forEach((button) => {
      button.classList.toggle('active', button.dataset.icon === preset);
    });

    els.customIconUpload.hidden = preset !== 'custom';
    els.autoPreviewBox.hidden = preset !== 'preview';

    if (preset === 'custom') {
      els.hotspotIconPreview.src = pendingHotspotIconData || '';
      els.hotspotIconPreview.style.visibility = pendingHotspotIconData ? 'visible' : 'hidden';
      els.hotspotIconFilename.textContent = pendingHotspotIconFilename || 'Файл не выбран';
    }

    if (preset === 'preview') updateAutoPreviewUi();
  }

  function updateGlowControlsUi() {
    const enabled = els.hotspotGlowEnabled.checked;
    const pulse = els.hotspotGlowPulse.checked;

    els.hotspotGlowControls.hidden = !enabled;
    els.hotspotGlowPulseSpeedRow.hidden = !pulse;

    const blur = clampNumber(els.hotspotGlowBlur.value, 0, 50, 18);
    const strength = clampNumber(els.hotspotGlowStrength.value, 0, 100, 75);
    const speed = clampNumber(els.hotspotGlowPulseSpeed.value, 0.5, 4, 1.6);
    const color = normalizeGlowColor(els.hotspotGlowColor.value);

    els.hotspotGlowBlurValue.textContent = Math.round(blur) + ' px';
    els.hotspotGlowStrengthValue.textContent = Math.round(strength) + '%';
    els.hotspotGlowPulseSpeedValue.textContent = speed.toFixed(1) + ' с';

    if (!enabled) {
      els.hotspotGlowDemo.style.setProperty('--demo-glow', 'none');
      return;
    }

    const previewGlow = {
      color,
      blur,
      strength,
      pulse: false,
      pulseSpeed: speed
    };
    els.hotspotGlowDemo.style.setProperty('--demo-glow', glowFilterString(previewGlow, 1));
  }

  function loadGlowControls(hotspot) {
    const glow = hotspot ? normalizedGlow(hotspot) : {
      enabled: false,
      color: '#6c7cff',
      blur: 18,
      strength: 75,
      pulse: false,
      pulseSpeed: 1.6
    };

    els.hotspotGlowEnabled.checked = glow.enabled;
    els.hotspotGlowColor.value = glow.color;
    els.hotspotGlowBlur.value = String(glow.blur);
    els.hotspotGlowStrength.value = String(glow.strength);
    els.hotspotGlowPulse.checked = glow.pulse;
    els.hotspotGlowPulseSpeed.value = String(glow.pulseSpeed);
    updateGlowControlsUi();
  }

  function radians(degrees) {
    return Number(degrees || 0) * Math.PI / 180;
  }

  async function generateScenePreview(sceneId, width = 384, height = 240) {
    const scene = getScene(sceneId);
    if (!scene) throw new Error('Целевая сцена не найдена');

    if (scene.sceneType === 'object360') {
      const data = normalizeObject360Data(scene.object360 || {});
      const imageData = data.coverData || data.frames.flat().find(Boolean) || scene.imageData || '';
      if (!imageData) throw new Error('У Object360 нет кадра для превью');
      return imageData;
    }

    if (scene.sceneType === 'stl') {
      if (!window.StlViewer) throw new Error('STL Viewer не загружен');
      const data = normalizeStlData(scene.stl || {});
      if (!data.data) throw new Error('STL данные отсутствуют');

      const host = document.createElement('div');
      host.style.cssText =
        'position:fixed;left:-10000px;top:-10000px;width:' + width + 'px;height:' + height +
        'px;overflow:hidden;pointer-events:none;opacity:0;';
      document.body.appendChild(host);

      let tempStl = null;
      try {
        tempStl = new StlViewer(host, {
          source: data.data,
          yaw: data.yaw,
          pitch: data.pitch,
          zoom: data.zoom,
          wireframe: data.wireframe,
          autoRotate: false,
          color: data.color,
          backgroundMode: data.backgroundMode,
          backgroundImage: stlBackgroundImageForData(data)
        });
        await tempStl.ready;
        tempStl.render();
        const imageData = tempStl.canvas?.toDataURL?.('image/png') || '';
        if (!imageData) throw new Error('STL Viewer не вернул превью');
        return imageData;
      } finally {
        try { tempStl?.destroy(); } catch (_) {}
        host.remove();
      }
    }

    if (!scene.imageData) throw new Error('У панорамы нет изображения');
    if (!window.pannellum) throw new Error('Pannellum не загружен');

    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;left:-10000px;top:-10000px;width:' + width + 'px;height:' + height +
      'px;overflow:hidden;pointer-events:none;opacity:0;';
    document.body.appendChild(host);

    let tempViewer = null;
    let timeoutId = null;

    try {
      return await new Promise((resolve, reject) => {
        let finished = false;

        const cleanupAndReject = (error) => {
          if (finished) return;
          finished = true;
          reject(error instanceof Error ? error : new Error(String(error || 'Ошибка создания превью')));
        };

        timeoutId = setTimeout(() => cleanupAndReject(new Error('Таймаут генерации превью')), 15000);

        try {
          tempViewer = pannellum.viewer(host, {
            type: 'equirectangular',
            panorama: scene.imageData,
            autoLoad: true,
            showControls: false,
            keyboardZoom: false,
            mouseZoom: false,
            draggable: false,
            pitch: Number(scene.pitch) || 0,
            yaw: Number(scene.yaw) || 0,
            hfov: Number(scene.hfov) || 100
          });

          tempViewer.on('load', () => {
            if (finished) return;
            try {
              const renderer = tempViewer.getRenderer();
              const rendered = renderer.render(
                radians(scene.pitch),
                radians(scene.yaw),
                radians(scene.hfov || 100),
                { returnImage: true }
              );

              let imageData = typeof rendered === 'string' ? rendered : '';
              if (!imageData) {
                const canvas = renderer.getCanvas();
                if (canvas && typeof canvas.toDataURL === 'function') {
                  imageData = canvas.toDataURL('image/png');
                }
              }

              if (!imageData) throw new Error('Pannellum не вернул изображение');

              finished = true;
              clearTimeout(timeoutId);
              resolve(imageData);
            } catch (error) {
              cleanupAndReject(error);
            }
          });

          tempViewer.on('error', (message) => cleanupAndReject(new Error(String(message))));
        } catch (error) {
          cleanupAndReject(error);
        }
      });
    } finally {
      clearTimeout(timeoutId);
      try { tempViewer?.destroy(); } catch (_) {}
      host.remove();
    }
  }

  async function generatePendingAutoPreview({ silent = false } = {}) {
    const targetId = els.hotspotTarget.value;
    if (!targetId) {
      pendingHotspotIconData = '';
      pendingHotspotIconFilename = '';
      pendingHotspotPreviewTargetId = '';
      updateAutoPreviewUi('Сначала выберите целевую сцену');
      return '';
    }

    const targetScene = getScene(targetId);
    if (!targetScene) throw new Error('Целевая сцена не найдена');

    const token = ++autoPreviewGenerationToken;
    els.autoPreviewBox.classList.add('generating');
    els.btnRefreshHotspotPreview.disabled = true;
    updateAutoPreviewUi('Создаю превью…');

    try {
      const imageData = await generateScenePreview(targetId);
      if (token !== autoPreviewGenerationToken) return '';

      pendingHotspotIconData = imageData;
      pendingHotspotIconFilename = 'preview-' + safeFilename(targetScene.title || targetScene.id) + '.png';
      pendingHotspotPreviewTargetId = targetId;
      const meta = sceneTypeMeta(targetScene);
      if (targetScene.sceneType === 'panorama') {
        updateAutoPreviewUi(meta.icon + ' ' + meta.label + ' · ракурс ' +
          formatNum(targetScene.yaw) + '° / ' + formatNum(targetScene.pitch) + '°');
      } else {
        updateAutoPreviewUi(meta.icon + ' ' + meta.label + ' · превью готово');
      }
      if (!silent) showToast('Превью перехода обновлено');
      return imageData;
    } catch (error) {
      if (token === autoPreviewGenerationToken) {
        pendingHotspotIconData = '';
        pendingHotspotIconFilename = '';
        pendingHotspotPreviewTargetId = '';
        updateAutoPreviewUi('Не удалось создать превью');
      }
      throw error;
    } finally {
      if (token === autoPreviewGenerationToken) {
        els.autoPreviewBox.classList.remove('generating');
        els.btnRefreshHotspotPreview.disabled = false;
      }
    }
  }

  async function regenerateIncomingPreviews(targetSceneId) {
    const targetScene = getScene(targetSceneId);
    if (!targetScene) return 0;

    const affected = [];
    project.scenes.forEach((scene) => {
      (scene.hotspots || []).forEach((hotspot) => {
        if (hotspot.type === 'scene' &&
            hotspot.targetSceneId === targetSceneId &&
            hotspot.iconPreset === 'preview') {
          affected.push(hotspot);
        }
      });
    });

    if (!affected.length) return 0;

    const imageData = await generateScenePreview(targetSceneId);
    const filename = 'preview-' + safeFilename(targetScene.title || targetScene.id) + '.png';

    affected.forEach((hotspot) => {
      hotspot.iconData = imageData;
      hotspot.iconFilename = filename;
    });

    return affected.length;
  }

  function hotspotToPannellum(hotspot, universalSceneHandler = null) {
    const base = {
      pitch: Number(hotspot.pitch) || 0,
      yaw: Number(hotspot.yaw) || 0,
      text: hotspot.text || ''
    };

    if (hotspot.type === 'scene') {
      const targetScene = getScene(hotspot.targetSceneId);
      const cssClass = transitionIconClass(hotspot) + ' ' + hotspotStyleClass(hotspot);

      if (targetScene?.sceneType === 'panorama') {
        return {
          ...base,
          type: 'scene',
          sceneId: hotspot.targetSceneId,
          tourTargetSceneId: hotspot.targetSceneId,
          tourTransition: hotspot.transition || project.settings.defaultTransition || 'fade',
          cssClass: cssClass + ' tour-hotspot-' + hotspotCssToken(hotspot.id)
        };
      }

      return {
        ...base,
        type: 'info',
        cssClass: cssClass + ' tour-hotspot-' + hotspotCssToken(hotspot.id),
        tourTargetSceneId: hotspot.targetSceneId,
        tourTransition: hotspot.transition || project.settings.defaultTransition || 'fade',
        clickHandlerFunc: () => {
          if (typeof universalSceneHandler === 'function') {
            universalSceneHandler(hotspot.targetSceneId);
          } else {
            selectScene(hotspot.targetSceneId);
          }
        }
      };
    }

    if (hotspot.type === 'url') {
      return {
        ...base,
        type: 'info',
        URL: hotspot.url || '#',
        attributes: { target: '_blank', rel: 'noopener noreferrer' },
        cssClass: 'editor-url-hotspot ' + hotspotStyleClass(hotspot)
      };
    }

    return {
      ...base,
      type: 'info',
      text: hotspot.info ? ((hotspot.text ? hotspot.text + ': ' : '') + hotspot.info) : hotspot.text,
      cssClass: 'pnlm-info ' + hotspotStyleClass(hotspot)
    };
  }

  function buildPannellumConfig({
    useEmbeddedImages = true,
    firstSceneId = null,
    universalSceneHandler = null
  } = {}) {
    const scenes = {};

    project.scenes.filter((scene) => scene.sceneType === 'panorama').forEach((scene) => {
      scenes[scene.id] = {
        type: 'equirectangular',
        panorama: useEmbeddedImages ? scene.imageData : scene.filename,
        title: scene.title || undefined,
        pitch: Number(scene.pitch) || 0,
        yaw: Number(scene.yaw) || 0,
        hfov: Number(scene.hfov) || 100,
        hotSpots: (scene.hotspots || [])
          .filter((hotspot) => hotspot.visible !== false)
          .filter((hotspot) => hotspot.type !== 'scene' || project.scenes.some((s) => s.id === hotspot.targetSceneId))
          .map((hotspot) => hotspotToPannellum(hotspot, universalSceneHandler))
      };
    });

    const defaultConfig = {
      firstScene: (() => {
        const requested = firstSceneId || project.firstScene;
        if (requested && scenes[requested]) return requested;
        return Object.keys(scenes)[0] || null;
      })(),
      sceneFadeDuration: project.settings.fadeEnabled ? Number(project.settings.fadeDuration || 0) : 0,
      autoLoad: true,
      showControls: true,
      compass: false
    };

    if (project.settings.autoRotateEnabled) {
      defaultConfig.autoRotate = Number(project.settings.autoRotate || -2);
      defaultConfig.autoRotateInactivityDelay = 3000;
      defaultConfig.autoRotateStopDelay = -1;
    }

    return { default: defaultConfig, scenes };
  }

  function destroyViewer() {
    if (viewer) {
      try { viewer.destroy(); } catch (error) { console.warn(error); }
      viewer = null;
    }
    if (objectViewer) {
      try { objectViewer.destroy(); } catch (error) { console.warn(error); }
      objectViewer = null;
    }
    if (stlViewer) {
      try { stlViewer.destroy(); } catch (error) { console.warn(error); }
      stlViewer = null;
    }
    if (xrViewer) {
      try { xrViewer.destroy(); } catch (error) { console.warn(error); }
      xrViewer = null;
    }
  }

  function renderViewer() {
    updateToolbarState();
    const scene = getScene();

    destroyViewer();
    els.panorama.innerHTML = '';

    if (!scene) return;

    if (scene.sceneType === 'object360') {
      if (!window.Object360Viewer) {
        showToast('Object360Viewer не загрузился');
        return;
      }
      const data = normalizeObject360Data(scene.object360 || {});
      scene.object360 = data;
      try {
        objectViewer = new Object360Viewer(els.panorama, {
          sectors: data.sectors,
          rows: data.rows,
          frames: data.frames,
          startSector: data.startSector,
          startRow: data.startRow,
          autoplay: data.autoplay,
          backgroundMode: data.backgroundMode,
          backgroundColor: data.backgroundColor,
          backgroundImage: data.backgroundImageData,
          onFrameChange: (state) => {
            els.coords.textContent =
              'угол ' + formatNum(state.angle) + '° · кадр ' + (state.sector + 1) +
              '/' + data.sectors + (data.rows > 1 ? ' · ряд ' + (state.row + 1) + '/' + data.rows : '');
            renderDynamicScreenHotspots(scene, els.sceneOverlay, state, { editor:true });
          }
        });
        renderDynamicScreenHotspots(scene, els.sceneOverlay, objectViewer.getState(), { editor:true });
        els.coords.textContent =
          'угол ' + formatNum(objectFrameAngle(data, data.startSector)) + '° · кадр ' +
          (data.startSector + 1) + '/' + data.sectors;
      } catch (error) {
        console.error(error);
        showToast('Ошибка запуска Object 360°');
      }
      return;
    }

    if (scene.sceneType === 'stl') {
      if (!window.StlViewer) {
        showToast('STL Viewer не загрузился');
        return;
      }
      const data = normalizeStlData(scene.stl || {});
      scene.stl = data;
      try {
        stlViewer = new StlViewer(els.panorama, {
          source: data.data,
          yaw: data.yaw,
          pitch: data.pitch,
          zoom: data.zoom,
          wireframe: data.wireframe,
          autoRotate: data.autoplay,
          color: data.color,
          backgroundMode: data.backgroundMode,
          backgroundImage: stlBackgroundImageForData(data),
          onChange: (state) => {
            els.coords.textContent =
              'yaw ' + formatNum(state.yaw) + '° · pitch ' + formatNum(state.pitch) +
              '° · zoom ' + Number(state.zoom).toFixed(2);
            renderDynamicScreenHotspots(scene, els.sceneOverlay, state, { editor:true, projector:stlViewer });
          }
        });
        renderDynamicScreenHotspots(scene, els.sceneOverlay, stlViewer.getState(), { editor:true, projector:stlViewer });
        stlViewer.ready.catch((error) => {
          console.error(error);
          showToast('Не удалось открыть STL: ' + (error?.message || 'ошибка'));
        });
        els.coords.textContent =
          'yaw ' + formatNum(data.yaw) + '° · pitch ' + formatNum(data.pitch) +
          '° · zoom ' + Number(data.zoom).toFixed(2);
      } catch (error) {
        console.error(error);
        showToast('Ошибка запуска STL Viewer');
      }
      return;
    }

    if (scene.sceneType === 'xr') {
      if (!window.XRMediaViewer) {
        showToast('XRMediaViewer не загрузился');
        return;
      }
      const data = normalizeXrData(scene.xr || {});
      scene.xr = data;
      try {
        xrViewer = new XRMediaViewer(els.panorama, {
          source: data.data,
          kind: data.kind,
          projection: data.projection,
          yaw: data.yaw,
          pitch: data.pitch,
          fov: data.fov,
          autoplay: data.autoplay,
          loop: data.loop,
          muted: false,
          volume: data.volume,
          onChange: (state) => {
            els.coords.textContent =
              'XR ' + data.projection + ' · yaw ' + formatNum(state.yaw) +
              '° · pitch ' + formatNum(state.pitch) + '° · FOV ' + Math.round(state.fov) + '°';
            renderDynamicScreenHotspots(scene, els.sceneOverlay, state, { editor:true });
          }
        });
        xrViewer.ready.catch((error) => {
          console.error(error);
          showToast('Не удалось открыть XR Media: ' + (error?.message || 'ошибка'));
        });
        els.coords.textContent =
          'XR ' + data.projection + ' · yaw ' + formatNum(data.yaw) +
          '° · pitch ' + formatNum(data.pitch) + '° · FOV ' + Math.round(data.fov) + '°';
        renderDynamicScreenHotspots(scene, els.sceneOverlay, xrViewer.getState(), { editor:true });
      } catch (error) {
        console.error(error);
        showToast('Ошибка запуска XR Media Viewer');
      }
      return;
    }

    if (!window.pannellum) {
      showToast('Pannellum не загрузился. Проверьте подключение к интернету.');
      return;
    }

    refreshCustomHotspotStyles();
    isRenderingViewer = true;

    try {
      viewer = pannellum.viewer('panorama', buildPannellumConfig({ firstSceneId: scene.id }));

      viewer.on('load', () => {
        isRenderingViewer = false;
        updateCoordsFromViewer();
      });

      viewer.on('scenechange', (sceneId) => {
        if (!sceneId || isRenderingViewer) return;
        currentSceneId = sceneId;
        renderSceneList();
        renderSceneSettings();
        renderHotspotList();
        updateToolbarState();
      });

      viewer.on('error', (message) => {
        console.error('Pannellum:', message);
        showToast('Не удалось загрузить панораму');
      });
    } catch (error) {
      isRenderingViewer = false;
      console.error(error);
      showToast('Ошибка запуска просмотрщика');
    }
  }

  function updateCoordsFromViewer() {
    if (!viewer) return;
    try {
      els.coords.textContent = `pitch ${formatNum(viewer.getPitch())}° · yaw ${formatNum(viewer.getYaw())}°`;
    } catch (_) {}
  }

  function selectScene(sceneId) {
    if (!project.scenes.some((scene) => scene.id === sceneId)) return;
    currentSceneId = sceneId;
    renderSceneList();
    renderSceneSettings();
    renderTextObjectList();
    renderMediaObjectList();
    renderLayerList();
    renderHotspotList();
    updateToolbarState();

    const target = getScene(sceneId);
    if (viewer && target?.sceneType === 'panorama') {
      try {
        viewer.loadScene(sceneId);
        return;
      } catch (_) {}
    }
    renderViewer();
  }

  async function fileToDataURL(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
      reader.readAsDataURL(file);
    });
  }

  async function getImageDimensions(dataUrl) {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async function createSceneFromFile(file, title) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Выберите JPG, PNG или WEBP');
      return null;
    }

    const imageData = await fileToDataURL(file);
    const dimensions = await getImageDimensions(imageData);
    if (dimensions) {
      const ratio = dimensions.width / dimensions.height;
      if (ratio < 1.8 || ratio > 2.2) {
        showToast(`Внимание: изображение ${dimensions.width}×${dimensions.height}; для 360° лучше соотношение 2:1`, 4200);
      }
    }

    const baseId = slugify(title || file.name.replace(/\.[^.]+$/, ''));
    let id = baseId;
    let n = 2;
    while (project.scenes.some((scene) => scene.id === id)) id = baseId + '-' + n++;

    const scene = {
      id,
      title: String(title || file.name.replace(/\.[^.]+$/, '') || 'Новая сцена'),
      sceneType: 'panorama',
      filename: file.name || (id + '.jpg'),
      imageData,
      object360: null,
      pitch: 0,
      yaw: 0,
      hfov: 100,
      audio: normalizeSceneAudio({}),
      textObjects: [],
      mediaObjects: [],
      hotspots: []
    };

    project.scenes.push(scene);
    if (!project.firstScene) project.firstScene = scene.id;
    currentSceneId = scene.id;
    markDirty();
    renderViewer();
    return scene;
  }

  async function createStlSceneFromFile(file, title) {
    if (!file || !/\.stl$/i.test(file.name || '')) {
      throw new Error('Выберите STL-файл');
    }
    if (!window.StlTools) throw new Error('STL parser не загрузился');

    const buffer = await file.arrayBuffer();
    const parsed = StlTools.parseStl(buffer);
    const stlDataUrl = await fileToDataURL(file);

    const baseId = slugify(title || file.name.replace(/\.stl$/i, ''));
    let id = baseId;
    let n = 2;
    while (project.scenes.some((scene) => scene.id === id)) id = baseId + '-' + n++;

    const stl = normalizeStlData({
      data: stlDataUrl,
      filename: file.name,
      triangleCount: parsed.triangleCount,
      size: parsed.originalSize,
      yaw: 0,
      pitch: -15,
      zoom: 1,
      wireframe: false,
      autoplay: false,
      color: '#7c8cff',
      backgroundMode: 'hitech',
      backgroundImageData: '',
      backgroundImageName: '',
      backgroundSceneId: ''
    });

    const scene = {
      id,
      title: String(title || file.name.replace(/\.stl$/i, '') || 'STL модель'),
      sceneType: 'stl',
      filename: file.name || (id + '.stl'),
      imageData: stlPlaceholderDataUrl(),
      object360: null,
      stl,
      pitch: 0,
      yaw: 0,
      hfov: 100,
      audio: normalizeSceneAudio({}),
      textObjects: [],
      mediaObjects: [],
      hotspots: []
    };

    project.scenes.push(scene);
    if (!project.firstScene) project.firstScene = scene.id;
    currentSceneId = scene.id;
    markDirty();
    renderViewer();
    return scene;
  }

  async function createXrSceneFromFile(file, title, projection = '360') {
    if (!file) throw new Error('Выберите XR медиафайл');
    const isImage = /^image\//i.test(file.type || '') || /\.(jpe?g|png|webp)$/i.test(file.name || '');
    const isVideo = /^video\//i.test(file.type || '') || /\.(mp4|webm)$/i.test(file.name || '');
    if (!isImage && !isVideo) throw new Error('XR поддерживает MP4, WEBM, JPG, PNG и WEBP');

    const data = await fileToDataURL(file);
    const xr = normalizeXrData({
      data,
      filename: file.name,
      kind: isImage ? 'image' : 'video',
      projection,
      yaw: 0,
      pitch: 0,
      fov: 80,
      autoplay: false,
      loop: false,
      muted: false,
      volume: 80
    });

    const baseId = slugify(title || file.name.replace(/\.[^.]+$/, ''));
    let id = baseId;
    let n = 2;
    while (project.scenes.some((scene) => scene.id === id)) id = baseId + '-' + n++;

    const scene = {
      id,
      title: String(title || file.name.replace(/\.[^.]+$/, '') || 'XR Media'),
      sceneType: 'xr',
      filename: file.name || (id + (isImage ? '.jpg' : '.mp4')),
      imageData: isImage ? data : xrPlaceholderDataUrl(xr.projection),
      object360: null,
      stl: null,
      xr,
      pitch: 0,
      yaw: 0,
      hfov: 100,
      audio: normalizeSceneAudio({}),
      textObjects: [],
      mediaObjects: [],
      hotspots: []
    };

    project.scenes.push(scene);
    if (!project.firstScene) project.firstScene = scene.id;
    currentSceneId = scene.id;
    markDirty();
    renderViewer();
    return scene;
  }

  function setNewSceneType(type) {
    const next = type === 'object360'
      ? 'object360'
      : (type === 'stl' ? 'stl' : (type === 'xr' ? 'xr' : 'panorama'));
    els.newSceneType.value = next;
    [...els.sceneTypeControl.querySelectorAll('[data-scene-type]')].forEach((button) => {
      button.classList.toggle('active', button.dataset.sceneType === next);
    });
    const objectMode = next === 'object360';
    const stlMode = next === 'stl';
    const xrMode = next === 'xr';
    els.panoramaUploadBox.hidden = objectMode || stlMode || xrMode;
    els.object360UploadBox.hidden = !objectMode;
    els.object360ImportNote.hidden = !objectMode;
    els.stlUploadBox.hidden = !stlMode;
    els.stlImportNote.hidden = !stlMode;
    els.xrUploadBox.hidden = !xrMode;
    els.xrCreateOptions.hidden = !xrMode;
  }

  function openSceneDialog() {
    els.sceneForm.reset();
    els.newSceneFileName.textContent = 'JPG, PNG или WEBP';
    els.newObject360FileName.textContent = 'ZIP из Android-приложения Object360Capture';
    els.newStlFileName.textContent = 'Binary или ASCII STL';
    els.newXrMediaFileName.textContent = 'MP4 / WEBM / JPG / PNG / WEBP';
    els.newXrProjection.value = '360';
    setNewSceneType('panorama');
    els.sceneDialog.showModal();
    setTimeout(() => els.newSceneTitle.focus(), 50);
  }

  function dataUrlForBase64(mime, base64) {
    return 'data:' + mime + ';base64,' + base64;
  }

  async function createObject360SceneFromZip(file, title) {
    if (!file || !/\.zip$/i.test(file.name || '')) {
      throw new Error('Выберите ZIP-архив Object360');
    }
    if (!window.JSZip) throw new Error('JSZip не загрузился');

    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files);
    const configName = names.find((name) => /(^|\/)config\.json$/i.test(name));
    let config = {};
    if (configName) {
      try { config = JSON.parse(await zip.file(configName).async('text')); }
      catch (_) { config = {}; }
    }

    const frameEntries = [];
    names.forEach((name) => {
      const match = String(name).replace(/\\/g, '/').match(/(?:^|\/)row_(\d+)\/frame_(\d+)\.(jpe?g|png|webp)$/i);
      if (!match || zip.files[name].dir) return;
      frameEntries.push({
        name,
        row: Math.max(0, Number(match[1]) - 1),
        sector: Math.max(0, Number(match[2])),
        ext: match[3].toLowerCase()
      });
    });

    if (!frameEntries.length) {
      throw new Error('В ZIP не найдены row_N/frame_XXX.jpg');
    }

    const inferredRows = Math.max(...frameEntries.map((item) => item.row)) + 1;
    const inferredSectors = Math.max(...frameEntries.map((item) => item.sector)) + 1;
    const rows = Math.max(inferredRows, Number(config.rows) || 1);
    const sectors = Math.max(inferredSectors, Number(config.sectors) || 1);
    const frames = Array.from({ length: rows }, () => Array(sectors).fill(''));

    for (let i = 0; i < frameEntries.length; i++) {
      const entry = frameEntries[i];
      const base64 = await zip.file(entry.name).async('base64');
      const mime = entry.ext === 'png' ? 'image/png' : entry.ext === 'webp' ? 'image/webp' : 'image/jpeg';
      frames[entry.row][entry.sector] = dataUrlForBase64(mime, base64);
    }

    const coverData = frames.flat().find(Boolean) || '';
    const baseId = slugify(title || file.name.replace(/\.object360\.zip$|\.zip$/i, ''));
    let id = baseId;
    let n = 2;
    while (project.scenes.some((scene) => scene.id === id)) id = baseId + '-' + n++;

    const object360 = normalizeObject360Data({
      sectors,
      rows,
      frames,
      coverData,
      frameCount: frameEntries.length,
      startSector: 0,
      startRow: rows === 3 ? 1 : 0,
      autoplay: false,
      captureMode: config.captureMode || '',
      baseRadiusMeters: config.baseRadiusMeters,
      rowSpacingMeters: config.rowSpacingMeters,
      objectDepthMeters: config.objectDepthMeters
    });

    const scene = {
      id,
      title: String(title || file.name.replace(/\.object360\.zip$|\.zip$/i, '') || 'Объект 360°'),
      sceneType: 'object360',
      filename: file.name || (id + '.object360.zip'),
      imageData: coverData,
      object360,
      pitch: 0,
      yaw: 0,
      hfov: 100,
      audio: normalizeSceneAudio({}),
      textObjects: [],
      mediaObjects: [],
      hotspots: []
    };

    project.scenes.push(scene);
    if (!project.firstScene) project.firstScene = scene.id;
    currentSceneId = scene.id;
    markDirty();
    renderViewer();
    return scene;
  }

  function updateHotspotTargetHint() {
    const target = getScene(els.hotspotTarget.value);
    if (!target) {
      els.hotspotTargetTypeHint.textContent = 'Выберите целевую сцену';
      els.hotspotTargetTypeHint.dataset.sceneType = '';
      return;
    }
    const meta = sceneTypeMeta(target);
    els.hotspotTargetTypeHint.textContent =
      meta.icon + ' ' + meta.label + ' — ' + meta.detail;
    els.hotspotTargetTypeHint.dataset.sceneType = target.sceneType || 'panorama';
  }

  function openTextObjectDialog(textObjectId = '') {
    const scene = getScene();
    if (!scene) return;

    scene.textObjects = Array.isArray(scene.textObjects) ? scene.textObjects.map(normalizeTextObject) : [];
    const existing = textObjectId
      ? scene.textObjects.find((item) => item.id === textObjectId)
      : null;
    const item = normalizeTextObject(existing || {
      type: 'title',
      text: scene.title || 'Заголовок',
      x: 5,
      y: 8,
      width: 55,
      fontSize: 42,
      color: '#ffffff',
      align: 'left',
      background: 'none',
      animation: 'fade'
    });

    els.textObjectForm.reset();
    els.textObjectEditId.value = existing?.id || '';
    els.textObjectDialogTitle.textContent = existing ? 'Редактировать текст' : 'Новый текстовый объект';
    els.textObjectType.value = item.type;
    els.textObjectText.value = item.text;
    els.textObjectX.value = String(item.x);
    els.textObjectY.value = String(item.y);
    els.textObjectWidth.value = String(item.width);
    els.textObjectFontSize.value = String(item.fontSize);
    els.textObjectColor.value = item.color;
    els.textObjectAlign.value = item.align;
    els.textObjectBackground.value = item.background;
    els.textObjectAnimation.value = item.animation;
    els.btnDeleteTextObject.hidden = !existing;
    els.textObjectDialog.showModal();
  }

  function saveTextObjectFromDialog() {
    const scene = getScene();
    if (!scene) return;

    const text = els.textObjectText.value.trim();
    if (!text) {
      showToast('Введите текст');
      return;
    }

    scene.textObjects = Array.isArray(scene.textObjects) ? scene.textObjects.map(normalizeTextObject) : [];
    const existingId = els.textObjectEditId.value;
    let item = existingId ? scene.textObjects.find((entry) => entry.id === existingId) : null;
    if (!item) {
      item = { id: uid('text') };
      scene.textObjects.push(item);
    }

    const normalized = normalizeTextObject({
      id: item.id,
      type: els.textObjectType.value,
      text,
      x: els.textObjectX.value,
      y: els.textObjectY.value,
      width: els.textObjectWidth.value,
      fontSize: els.textObjectFontSize.value,
      color: els.textObjectColor.value,
      align: els.textObjectAlign.value,
      background: els.textObjectBackground.value,
      animation: els.textObjectAnimation.value
    });

    Object.assign(item, normalized);
    els.textObjectDialog.close();
    markDirty();
    renderTextObjectList();
    renderSceneTextOverlay(scene, els.sceneOverlay, { editor: true });
  }

  function deleteTextObject(textObjectId) {
    const scene = getScene();
    if (!scene) return;
    scene.textObjects = (scene.textObjects || []).filter((item) => item.id !== textObjectId);
    if (els.textObjectDialog.open) els.textObjectDialog.close();
    markDirty();
    renderTextObjectList();
    renderSceneTextOverlay(scene, els.sceneOverlay, { editor: true });
  }

  function updateDraggedTextObject(element, clientX, clientY) {
    const scene = getScene();
    if (!scene || !element) return;
    const item = (scene.textObjects || []).find((entry) => entry.id === element.dataset.textObjectId);
    if (!item) return;

    const rect = els.sceneOverlay.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = clampNumber(((clientX - rect.left) / rect.width) * 100, 0, 100, item.x);
    const y = clampNumber(((clientY - rect.top) / rect.height) * 100, 0, 100, item.y);
    item.x = Number(x.toFixed(2));
    item.y = Number(y.toFixed(2));
    element.style.left = item.x + '%';
    element.style.top = item.y + '%';
  }

  function audioExtension(slot) {
    const name = String(slot?.filename || '').toLowerCase();
    const ext = name.match(/\.([a-z0-9]{2,5})$/)?.[1];
    if (['mp3','ogg','wav'].includes(ext)) return ext;
    const mime = String(slot?.data || '').match(/^data:audio\/([^;,]+)/i)?.[1]?.toLowerCase() || '';
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('wav')) return 'wav';
    return 'mp3';
  }

  function stopPreviewAudio() {
    for (const audio of [previewMusicAudio, previewNarrationAudio]) {
      if (!audio) continue;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {}
    }
    previewMusicAudio = null;
    previewNarrationAudio = null;
    els.previewMusicButton?.classList.remove('active');
    els.previewNarrationButton?.classList.remove('active');
  }

  function configurePreviewAudio(scene) {
    stopPreviewAudio();
    if (!scene) return;

    scene.audio = normalizeSceneAudio(scene.audio || {});
    const projectMusic = normalizeAudioSlot(project.audio?.music || {}, { volume: 35, loop: true });
    const music = scene.audio.music.data ? scene.audio.music : projectMusic;

    if (music.data) {
      previewMusicAudio = new Audio(music.data);
      previewMusicAudio.volume = music.volume / 100;
      previewMusicAudio.loop = Boolean(music.loop);
      els.previewMusicButton.hidden = false;
    } else {
      els.previewMusicButton.hidden = true;
    }

    if (scene.audio.narration.data) {
      previewNarrationAudio = new Audio(scene.audio.narration.data);
      previewNarrationAudio.volume = scene.audio.narration.volume / 100;
      els.previewNarrationButton.hidden = false;
    } else {
      els.previewNarrationButton.hidden = true;
    }
  }

  function updateMediaDialogUi() {
    const type = els.mediaObjectType.value;
    const timedMedia = type === 'video' || type === 'audio';
    els.mediaUploadBox.hidden = type === 'gallery' || type === 'button';
    els.mediaGalleryUploadBox.hidden = type !== 'gallery';
    els.mediaUrlRow.hidden = type !== 'button';
    els.mediaTargetRow.hidden = type !== 'button';
    els.mediaAudioStyleRow.hidden = type !== 'audio';
    els.mediaVolumeRow.hidden = type !== 'audio';
    els.mediaAutoplayRow.hidden = !timedMedia;
    els.mediaLoopRow.hidden = !timedMedia;
    if (!pendingMediaData) {
      els.mediaObjectFilename.textContent = type === 'audio'
        ? 'MP3, OGG или WAV'
        : (type === 'video' ? 'MP4 или WEBM' : (type === 'pdf' ? 'PDF' : 'Файл не выбран'));
    }
    if (type === 'button') {
      populateSceneSelect(els.mediaObjectTargetScene, getScene()?.id || '');
    }
  }

  function populateSceneSelect(select, excludeId = '') {
    const scenes = project.scenes.filter((scene) => scene.id !== excludeId);
    select.innerHTML = '<option value="">— не выбрано —</option>' +
      scenes.map((scene) => '<option value="' + escapeHtml(scene.id) + '">' +
        sceneTypeMeta(scene).icon + ' ' + escapeHtml(scene.title) + '</option>').join('');
  }

  function openMediaObjectDialog(mediaObjectId = '') {
    const scene = getScene();
    if (!scene) return;
    scene.mediaObjects = Array.isArray(scene.mediaObjects) ? scene.mediaObjects.map(normalizeMediaObject) : [];
    const existing = mediaObjectId ? scene.mediaObjects.find((item) => item.id === mediaObjectId) : null;
    const item = normalizeMediaObject(existing || { type:'image', x:10, y:20, width:36, height:32 });

    pendingMediaData = item.data || '';
    pendingMediaFilename = item.filename || '';
    pendingMediaGallery = Array.isArray(item.gallery) ? item.gallery.map((entry) => ({...entry})) : [];

    els.mediaObjectForm.reset();
    els.mediaObjectEditId.value = existing?.id || '';
    els.mediaObjectDialogTitle.textContent = existing ? 'Редактировать медиа' : 'Новый медиа-объект';
    els.mediaObjectType.value = item.type;
    els.mediaObjectTitle.value = item.title;
    els.mediaObjectFilename.textContent = item.filename || 'Файл не выбран';
    els.mediaGalleryCount.textContent = pendingMediaGallery.length ? (pendingMediaGallery.length + ' изображений') : 'Файлы не выбраны';
    els.mediaObjectUrl.value = item.url;
    populateSceneSelect(els.mediaObjectTargetScene, scene.id);
    els.mediaObjectTargetScene.value = item.targetSceneId || '';
    els.mediaObjectX.value = String(item.x);
    els.mediaObjectY.value = String(item.y);
    els.mediaObjectWidth.value = String(item.width);
    els.mediaObjectHeight.value = String(item.height);
    els.mediaObjectFit.value = item.fit;
    els.mediaObjectAnimation.value = item.animation;
    els.mediaObjectAudioStyle.value = item.audioStyle;
    els.mediaObjectVolume.value = String(item.volume);
    els.mediaObjectVolumeValue.textContent = item.volume + '%';
    els.mediaObjectAutoplay.checked = Boolean(item.autoplay);
    els.mediaObjectLoop.checked = Boolean(item.loop);
    els.btnDeleteMediaObject.hidden = !existing;
    updateMediaDialogUi();
    els.mediaObjectDialog.showModal();
  }

  async function saveMediaObjectFromDialog() {
    const scene = getScene();
    if (!scene) return;
    const type = els.mediaObjectType.value;

    if (type === 'gallery' && !pendingMediaGallery.length) {
      showToast('Добавьте изображения галереи');
      return;
    }
    if (['image','video','audio','pdf'].includes(type) && !pendingMediaData) {
      showToast('Выберите файл');
      return;
    }
    if (type === 'button' && !els.mediaObjectUrl.value.trim() && !els.mediaObjectTargetScene.value) {
      showToast('Для кнопки укажите URL или сцену');
      return;
    }

    scene.mediaObjects = Array.isArray(scene.mediaObjects) ? scene.mediaObjects.map(normalizeMediaObject) : [];
    const existingId = els.mediaObjectEditId.value;
    let item = existingId ? scene.mediaObjects.find((entry) => entry.id === existingId) : null;
    if (!item) {
      item = { id: uid('media') };
      scene.mediaObjects.push(item);
    }

    const normalized = normalizeMediaObject({
      ...item,
      id: item.id,
      type,
      title: els.mediaObjectTitle.value.trim(),
      data: type === 'gallery' || type === 'button' ? '' : pendingMediaData,
      filename: type === 'gallery' || type === 'button' ? '' : pendingMediaFilename,
      gallery: type === 'gallery' ? pendingMediaGallery : [],
      url: type === 'button' ? els.mediaObjectUrl.value.trim() : '',
      targetSceneId: type === 'button' ? els.mediaObjectTargetScene.value : '',
      x: els.mediaObjectX.value,
      y: els.mediaObjectY.value,
      width: els.mediaObjectWidth.value,
      height: els.mediaObjectHeight.value,
      fit: els.mediaObjectFit.value,
      animation: els.mediaObjectAnimation.value,
      autoplay: (type === 'video' || type === 'audio') && els.mediaObjectAutoplay.checked,
      loop: (type === 'video' || type === 'audio') && els.mediaObjectLoop.checked,
      volume: type === 'audio' ? els.mediaObjectVolume.value : item.volume,
      audioStyle: type === 'audio' ? els.mediaObjectAudioStyle.value : item.audioStyle
    });
    Object.assign(item, normalized);
    els.mediaObjectDialog.close();
    markDirty();
    renderCompositeOverlay(scene, els.sceneOverlay, null, { editor:true });
  }

  function deleteMediaObject(id) {
    const scene = getScene();
    if (!scene) return;
    scene.mediaObjects = (scene.mediaObjects || []).filter((item) => item.id !== id);
    if (els.mediaObjectDialog.open) els.mediaObjectDialog.close();
    markDirty();
    renderCompositeOverlay(scene, els.sceneOverlay, null, { editor:true });
  }

  function findLayerItem(kind, id) {
    const scene = getScene();
    if (!scene) return null;
    if (kind === 'text') return (scene.textObjects || []).find((item) => item.id === id) || null;
    if (kind === 'media') return (scene.mediaObjects || []).find((item) => item.id === id) || null;
    if (kind === 'hotspot') return (scene.hotspots || []).find((item) => item.id === id) || null;
    return null;
  }

  function populateHotspotTargets(selectedId = '') {
    const current = getScene();
    const candidates = project.scenes.filter((scene) => scene.id !== current?.id);
    els.hotspotTarget.innerHTML = candidates.length
      ? candidates.map((scene) => {
          const meta = sceneTypeMeta(scene);
          return `<option value="${escapeHtml(scene.id)}">${meta.icon} ${escapeHtml(scene.title)} — ${meta.label}</option>`;
        }).join('')
      : '<option value="">Сначала добавьте вторую сцену</option>';
    els.hotspotTarget.disabled = !candidates.length;
    if (selectedId && candidates.some((scene) => scene.id === selectedId)) {
      els.hotspotTarget.value = selectedId;
    }
    updateHotspotTargetHint();
  }

  function setHotspotType(type) {
    if (!['scene', 'info', 'url'].includes(type)) type = 'scene';
    els.hotspotType.value = type;

    [...els.hotspotTypeControl.querySelectorAll('button')].forEach((button) => {
      button.classList.toggle('active', button.dataset.type === type);
    });

    document.querySelector('.hotspot-scene-field').hidden = type !== 'scene';
    document.querySelector('.hotspot-icon-field').hidden = type !== 'scene';
    document.querySelector('.hotspot-transition-field').hidden = type !== 'scene';
    document.querySelector('.hotspot-info-field').hidden = type !== 'info';
    document.querySelector('.hotspot-url-field').hidden = type !== 'url';
  }

  function openHotspotDialog(pitch, yaw, hotspotId = null, anchor = null) {
    const scene = getScene();
    if (!scene) return;

    els.hotspotForm.reset();
    els.hotspotEditId.value = hotspotId || '';
    let hotspot = hotspotId ? scene.hotspots.find((item) => item.id === hotspotId) : null;

    pendingHotspotAnchor = hotspot
      ? {
          anchorMode: hotspot.anchorMode,
          anchorX: hotspot.anchorX,
          anchorY: hotspot.anchorY,
          anchorSector: hotspot.anchorSector,
          anchorRow: hotspot.anchorRow,
          anchorYaw: hotspot.anchorYaw,
          anchorPitch: hotspot.anchorPitch,
          modelPoint: Array.isArray(hotspot.modelPoint) ? hotspot.modelPoint.slice(0,3) : null
        }
      : (anchor || (scene.sceneType === 'object360'
        ? { anchorMode:'object360', anchorX:50, anchorY:50, anchorSector:0, anchorRow:0, anchorYaw:0, anchorPitch:0 }
        : scene.sceneType === 'stl'
          ? { anchorMode:'stl-screen', anchorX:50, anchorY:50, anchorSector:0, anchorRow:0, anchorYaw:0, anchorPitch:0 }
          : scene.sceneType === 'xr'
            ? { anchorMode:'xr-screen', anchorX:50, anchorY:50, anchorSector:0, anchorRow:0, anchorYaw:0, anchorPitch:0 }
            : { anchorMode:'panorama', anchorX:50, anchorY:50, anchorSector:0, anchorRow:0, anchorYaw:Number(yaw)||0, anchorPitch:Number(pitch)||0 }));

    const p = hotspot ? hotspot.pitch : pitch;
    const y = hotspot ? hotspot.yaw : yaw;

    els.hotspotDialogTitle.textContent = hotspot ? 'Редактировать точку' : 'Новая точка';
    els.hotspotCoordsLabel.textContent = `pitch ${formatNum(p)}° · yaw ${formatNum(y)}°`;
    els.hotspotPitch.value = formatNum(p);
    els.hotspotYaw.value = formatNum(y);
    els.hotspotText.value = hotspot?.text || '';
    els.hotspotTransition.value = hotspot?.transition || project.settings.defaultTransition || 'fade';
    els.hotspotUrl.value = hotspot?.url || '';
    els.hotspotInfo.value = hotspot?.info || '';
    loadGlowControls(hotspot);
    els.btnDeleteHotspot.hidden = !hotspot;

    pendingHotspotIconData = hotspot?.iconData || '';
    pendingHotspotIconFilename = hotspot?.iconFilename || '';
    pendingHotspotPreviewTargetId = hotspot?.iconPreset === 'preview' ? (hotspot?.targetSceneId || '') : '';
    els.hotspotIconFile.value = '';

    populateHotspotTargets(hotspot?.targetSceneId || '');
    if (pendingHotspotAnchor?.anchorMode === 'object360') {
      els.hotspotAnchorInfo.hidden = false;
      els.hotspotAnchorInfo.textContent =
        'Object360: кадр ' + ((pendingHotspotAnchor.anchorSector || 0) + 1) +
        ', ряд ' + ((pendingHotspotAnchor.anchorRow || 0) + 1) +
        ', позиция ' + Math.round(pendingHotspotAnchor.anchorX || 50) + '% / ' +
        Math.round(pendingHotspotAnchor.anchorY || 50) + '%';
    } else if (pendingHotspotAnchor?.anchorMode === 'stl-3d') {
      els.hotspotAnchorInfo.hidden = false;
      els.hotspotAnchorInfo.textContent =
        'STL: точка закреплена на поверхности модели · ' +
        (pendingHotspotAnchor.modelPoint || []).map((v)=>Number(v).toFixed(3)).join(' / ');
    } else if (pendingHotspotAnchor?.anchorMode === 'stl-screen') {
      els.hotspotAnchorInfo.hidden = false;
      els.hotspotAnchorInfo.textContent =
        'STL: привязка к ракурсу yaw ' + formatNum(pendingHotspotAnchor.anchorYaw) +
        '° / pitch ' + formatNum(pendingHotspotAnchor.anchorPitch) +
        '°, позиция ' + Math.round(pendingHotspotAnchor.anchorX || 50) + '% / ' +
        Math.round(pendingHotspotAnchor.anchorY || 50) + '%';
    } else if (pendingHotspotAnchor?.anchorMode === 'xr-screen') {
      els.hotspotAnchorInfo.hidden = false;
      els.hotspotAnchorInfo.textContent =
        'XR: привязка к ракурсу yaw ' + formatNum(pendingHotspotAnchor.anchorYaw) +
        '° / pitch ' + formatNum(pendingHotspotAnchor.anchorPitch) +
        '°, позиция ' + Math.round(pendingHotspotAnchor.anchorX || 50) + '% / ' +
        Math.round(pendingHotspotAnchor.anchorY || 50) + '%';
    } else {
      els.hotspotAnchorInfo.hidden = true;
      els.hotspotAnchorInfo.textContent = '';
    }
    const activeType = hotspot?.type || (project.scenes.length > 1 ? 'scene' : 'info');
    setHotspotType(activeType);
    setHotspotIconPreset(hotspot?.iconPreset || (activeType === 'scene' ? 'preview' : 'arrow'));
    els.hotspotDialog.showModal();

    if (!hotspot && activeType === 'scene' && els.hotspotTarget.value) {
      setTimeout(() => {
        generatePendingAutoPreview({ silent: true }).catch((error) => {
          console.error(error);
          showToast('Не удалось создать превью сцены');
        });
      }, 0);
    }
  }

  async function saveHotspotFromDialog() {
    const scene = getScene();
    if (!scene) return;

    const type = els.hotspotType.value;
    const pitch = Number(els.hotspotPitch.value);
    const yaw = Number(els.hotspotYaw.value);

    if (!Number.isFinite(pitch) || !Number.isFinite(yaw)) {
      showToast('Укажите корректные координаты точки');
      return;
    }
    if (type === 'scene' && !els.hotspotTarget.value) {
      showToast('Для перехода нужна целевая сцена');
      return;
    }
    if (type === 'url' && !els.hotspotUrl.value.trim()) {
      showToast('Укажите URL');
      return;
    }
    if (type === 'scene' && els.hotspotIconPreset.value === 'custom' && !pendingHotspotIconData) {
      showToast('Выберите свою картинку для точки');
      return;
    }

    if (type === 'scene' && els.hotspotIconPreset.value === 'preview' &&
        (!pendingHotspotIconData || pendingHotspotPreviewTargetId !== els.hotspotTarget.value)) {
      try {
        await generatePendingAutoPreview({ silent: true });
      } catch (error) {
        console.error(error);
        showToast('Не удалось создать превью целевой сцены');
        return;
      }
    }

    const existingId = els.hotspotEditId.value;
    let hotspot = existingId ? scene.hotspots.find((item) => item.id === existingId) : null;
    if (!hotspot) {
      hotspot = { id: uid('hotspot') };
      scene.hotspots.push(hotspot);
    }

    Object.assign(hotspot, {
      type,
      text: els.hotspotText.value.trim(),
      pitch,
      yaw,
      targetSceneId: type === 'scene' ? els.hotspotTarget.value : '',
      iconPreset: type === 'scene' ? els.hotspotIconPreset.value : 'arrow',
      iconData: type === 'scene' && ['custom', 'preview'].includes(els.hotspotIconPreset.value) ? pendingHotspotIconData : '',
      iconFilename: type === 'scene' && ['custom', 'preview'].includes(els.hotspotIconPreset.value) ? pendingHotspotIconFilename : '',
      glowEnabled: els.hotspotGlowEnabled.checked,
      glowColor: normalizeGlowColor(els.hotspotGlowColor.value),
      glowBlur: clampNumber(els.hotspotGlowBlur.value, 0, 50, 18),
      glowStrength: clampNumber(els.hotspotGlowStrength.value, 0, 100, 75),
      glowPulse: els.hotspotGlowPulse.checked,
      glowPulseSpeed: clampNumber(els.hotspotGlowPulseSpeed.value, 0.5, 4, 1.6),
      url: type === 'url' ? els.hotspotUrl.value.trim() : '',
      info: type === 'info' ? els.hotspotInfo.value.trim() : '',
      transition: els.hotspotTransition.value || project.settings.defaultTransition || 'fade',
      anchorMode: pendingHotspotAnchor?.anchorMode || (
        scene.sceneType === 'panorama' ? 'panorama' :
        scene.sceneType === 'object360' ? 'object360' :
        scene.sceneType === 'xr' ? 'xr-screen' : 'stl-screen'
      ),
      anchorX: pendingHotspotAnchor?.anchorX ?? 50,
      anchorY: pendingHotspotAnchor?.anchorY ?? 50,
      anchorSector: pendingHotspotAnchor?.anchorSector ?? 0,
      anchorRow: pendingHotspotAnchor?.anchorRow ?? 0,
      anchorYaw: pendingHotspotAnchor?.anchorYaw ?? (Number(yaw) || 0),
      anchorPitch: pendingHotspotAnchor?.anchorPitch ?? (Number(pitch) || 0),
      modelPoint: Array.isArray(pendingHotspotAnchor?.modelPoint) ? pendingHotspotAnchor.modelPoint.slice(0,3) : null,
      visible: hotspot.visible !== false,
      locked: Boolean(hotspot.locked),
      zIndex: Number.isFinite(Number(hotspot.zIndex)) ? Number(hotspot.zIndex) : 30
    });

    els.hotspotDialog.close();
    markDirty({ rerenderViewer: true });
  }

  function deleteHotspot(hotspotId) {
    const scene = getScene();
    if (!scene) return;
    scene.hotspots = scene.hotspots.filter((item) => item.id !== hotspotId);
    if (els.hotspotDialog.open) els.hotspotDialog.close();
    markDirty({ rerenderViewer: true });
  }

  function deleteCurrentScene() {
    const scene = getScene();
    if (!scene) return;
    if (!confirm(`Удалить сцену «${scene.title}» и все её точки?`)) return;

    project.scenes = project.scenes.filter((item) => item.id !== scene.id);
    project.scenes.forEach((item) => {
      item.hotspots = (item.hotspots || []).filter((hotspot) => hotspot.targetSceneId !== scene.id);
      if (item.sceneType === 'stl' && item.stl?.backgroundSceneId === scene.id) {
        item.stl = normalizeStlData({
          ...item.stl,
          backgroundMode: 'hitech',
          backgroundSceneId: ''
        });
      }
    });

    if (project.firstScene === scene.id) {
      project.firstScene = project.scenes[0]?.id || null;
    }

    currentSceneId = project.scenes[0]?.id || null;
    markDirty();
    renderViewer();
    showToast('Сцена удалена');
  }

  async function saveCurrentView() {
    const scene = getScene();
    if (!scene) return;

    if (scene.sceneType === 'object360') {
      if (!objectViewer) return;
      const state = objectViewer.getState();
      scene.object360 = normalizeObject360Data({
        ...scene.object360,
        startSector: state.sector,
        startRow: state.row
      });
      markDirty();
      renderSceneSettings();
      showToast('Стартовый кадр объекта сохранён');
      return;
    }

    if (scene.sceneType === 'stl') {
      if (!stlViewer) return;
      const state = stlViewer.getState();
      scene.stl = normalizeStlData({
        ...scene.stl,
        yaw: Number(state.yaw.toFixed(2)),
        pitch: Number(state.pitch.toFixed(2)),
        zoom: Number(state.zoom.toFixed(3)),
        wireframe: state.wireframe,
        autoplay: state.autoRotate,
        color: state.color
      });
      markDirty();
      renderSceneSettings();
      showToast('Ракурс STL-модели сохранён');
      return;
    }

    if (!viewer) return;
    scene.pitch = Number(viewer.getPitch().toFixed(2));
    scene.yaw = Number(viewer.getYaw().toFixed(2));
    scene.hfov = Number(viewer.getHfov().toFixed(1));
    markDirty();

    let updated = 0;
    try {
      updated = await regenerateIncomingPreviews(scene.id);
      if (updated) markDirty({ rerenderViewer: true });
    } catch (error) {
      console.error(error);
      showToast('Ракурс сохранён, но превью переходов обновить не удалось');
      return;
    }

    showToast(updated
      ? 'Стартовый ракурс сохранён · обновлено превью: ' + updated
      : 'Стартовый ракурс сохранён');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function formatFileSize(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return value + ' Б';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' КБ';
    if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' МБ';
    return (value / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
  }

  function clearPendingZipDownload() {
    if (pendingZipDownloadUrl) {
      URL.revokeObjectURL(pendingZipDownloadUrl);
      pendingZipDownloadUrl = '';
    }
    pendingZipBlob = null;
    pendingZipFilename = '';
  }

  function closeZipDownloadDialog() {
    if (els.downloadDialog.open) els.downloadDialog.close();
    clearPendingZipDownload();
  }

  function showZipDownloadDialog(blob, filename) {
    clearPendingZipDownload();

    pendingZipBlob = blob;
    pendingZipFilename = filename;
    pendingZipDownloadUrl = URL.createObjectURL(blob);

    els.downloadZipFilename.textContent = filename;
    els.downloadZipSize.textContent = formatFileSize(blob.size);
    els.downloadReadyInfo.textContent =
      'ZIP-архив собран. Нажмите «Скачать ZIP», чтобы выбрать папку и сохранить его на компьютер.';

    if (!els.downloadDialog.open) els.downloadDialog.showModal();
    els.downloadZipLink.focus();
  }

  async function savePendingZip() {
    if (!pendingZipBlob || !pendingZipFilename) {
      showToast('ZIP уже недоступен. Соберите архив ещё раз.');
      return;
    }

    els.downloadZipLink.disabled = true;
    const oldText = els.downloadZipLink.textContent;
    els.downloadZipLink.textContent = 'Сохранение…';

    try {
      if (typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({
          suggestedName: pendingZipFilename,
          types: [{
            description: 'ZIP-архив',
            accept: { 'application/zip': ['.zip'] }
          }]
        });

        const writable = await handle.createWritable();
        await writable.write(pendingZipBlob);
        await writable.close();

        els.downloadReadyInfo.textContent =
          'ZIP сохранён на компьютер: ' + pendingZipFilename;
        showToast('ZIP успешно сохранён');
        return;
      }

      const a = document.createElement('a');
      a.href = pendingZipDownloadUrl || URL.createObjectURL(pendingZipBlob);
      a.download = pendingZipFilename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();

      els.downloadReadyInfo.textContent =
        'Скачивание запущено. Проверьте папку «Загрузки» браузера.';
      showToast('Скачивание ZIP запущено');
    } catch (error) {
      if (error?.name === 'AbortError') {
        els.downloadReadyInfo.textContent =
          'Сохранение отменено. ZIP остаётся готовым — можно нажать кнопку ещё раз.';
        return;
      }

      console.error(error);

      try {
        const fallbackUrl = pendingZipDownloadUrl || URL.createObjectURL(pendingZipBlob);
        const a = document.createElement('a');
        a.href = fallbackUrl;
        a.download = pendingZipFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();

        els.downloadReadyInfo.textContent =
          'Системное сохранение не сработало. Запущено обычное скачивание браузера.';
        showToast('Запущено резервное скачивание ZIP');
      } catch (fallbackError) {
        console.error(fallbackError);
        els.downloadReadyInfo.textContent =
          'Не удалось сохранить ZIP. Откройте консоль браузера для просмотра ошибки.';
        showToast('Ошибка сохранения ZIP: ' + (error?.message || 'неизвестная ошибка'), 5200);
      }
    } finally {
      els.downloadZipLink.disabled = false;
      els.downloadZipLink.textContent = oldText;
    }
  }

  function safeFilename(value, fallback = 'tour') {
    const normalized = slugify(value);
    return normalized || fallback;
  }

  function exportProject() {
    if (!project.scenes.length) {
      showToast('Сначала добавьте хотя бы одну сцену');
      return;
    }
    const payload = cloneProjectForExport();
    payload.exportedAt = new Date().toISOString();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, safeFilename(project.title) + '.pannellum-project.json');
    showToast('Проект экспортирован');
  }


  function extensionForScene(scene) {
    const filenameMatch = String(scene.filename || '').toLowerCase().match(/\.([a-z0-9]{2,5})$/);
    if (filenameMatch && ['jpg', 'jpeg', 'png', 'webp'].includes(filenameMatch[1])) {
      return filenameMatch[1] === 'jpeg' ? 'jpg' : filenameMatch[1];
    }
    const dataMatch = String(scene.imageData || '').match(/^data:image\/([a-zA-Z0-9.+-]+);/);
    if (!dataMatch) return 'jpg';
    const subtype = dataMatch[1].toLowerCase();
    return subtype === 'jpeg' ? 'jpg' : (['jpg', 'png', 'webp'].includes(subtype) ? subtype : 'jpg');
  }

  function dataUrlPayload(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) throw new Error('Некорректные данные изображения');
    return { mime: match[1] || 'application/octet-stream', base64: Boolean(match[2]), data: match[3] };
  }

  function normalizeZipPath(path) {
    const parts = [];
    String(path).replace(/\\/g, '/').split('/').forEach((part) => {
      if (!part || part === '.') return;
      if (part === '..') { parts.pop(); return; }
      parts.push(part);
    });
    return parts.join('/');
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Не удалось загрузить панораму для Multires'));
      image.src = src;
    });
  }

  function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.85) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Не удалось закодировать тайл Multires'));
      }, type, quality);
    });
  }

  function yieldToBrowser() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function getMultiresWebGLLimits() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false }) ||
      canvas.getContext('experimental-webgl', { alpha: false, antialias: false });
    if (!gl) throw new Error('Для Multires требуется WebGL');

    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const result = {
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096,
      maxRenderSize: Math.min(
        Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || 4096,
        Number(viewport?.[0]) || 4096,
        Number(viewport?.[1]) || 4096
      )
    };

    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    return result;
  }

  function calculateMultiresSpec(image, limits) {
    const requestedTile = [512, 1024].includes(Number(project.settings.multiresTileSize))
      ? Number(project.settings.multiresTileSize) : 512;
    const requestedMax = [2048, 4096, 8192].includes(Number(project.settings.multiresMaxCubeSize))
      ? Number(project.settings.multiresMaxCubeSize) : 4096;

    let cubeResolution = 8 * Math.floor((image.naturalWidth / Math.PI) / 8);
    cubeResolution = Math.max(256, cubeResolution);
    cubeResolution = Math.min(cubeResolution, requestedMax, limits.maxRenderSize);

    const tileResolution = Math.min(requestedTile, cubeResolution);
    let maxLevel = Math.ceil(Math.log2(cubeResolution / tileResolution)) + 1;
    if (maxLevel > 1 &&
        Math.floor(cubeResolution / Math.pow(2, maxLevel - 2)) === tileResolution) {
      maxLevel -= 1;
    }

    return {
      cubeResolution,
      tileResolution,
      maxLevel: Math.max(1, maxLevel),
      quality: clampNumber(project.settings.multiresQuality, 50, 100, 85) / 100
    };
  }

  function prepareMultiresSource(image, maxTextureSize) {
    if (image.naturalWidth <= maxTextureSize && image.naturalHeight <= maxTextureSize) {
      return image;
    }

    const scale = Math.min(
      maxTextureSize / image.naturalWidth,
      maxTextureSize / image.naturalHeight
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.floor(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function createCubemapProjector(source, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true
    }) || canvas.getContext('experimental-webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true
    });

    if (!gl) throw new Error('WebGL недоступен для генерации Multires');

    const vertexSource = [
      'attribute vec2 a_pos;',
      'varying vec2 v_uv;',
      'void main(){',
      '  gl_Position=vec4(a_pos,0.0,1.0);',
      '  v_uv=vec2((a_pos.x+1.0)*0.5,(1.0-a_pos.y)*0.5);',
      '}'
    ].join('\n');

    const fragmentSource = [
      'precision highp float;',
      'varying vec2 v_uv;',
      'uniform sampler2D u_image;',
      'uniform int u_face;',
      'const float PI=3.14159265358979323846264;',
      'void main(){',
      '  float sx=v_uv.x*2.0-1.0;',
      '  float sy=1.0-v_uv.y*2.0;',
      '  vec3 d;',
      '  if(u_face==0) d=vec3(sx,sy,-1.0);',
      '  else if(u_face==1) d=vec3(-sx,sy,1.0);',
      '  else if(u_face==2) d=vec3(sx,1.0,sy);',
      '  else if(u_face==3) d=vec3(sx,-1.0,-sy);',
      '  else if(u_face==4) d=vec3(-1.0,sy,-sx);',
      '  else d=vec3(1.0,sy,sx);',
      '  d=normalize(d);',
      '  float lon=atan(d.x,-d.z);',
      '  float lat=asin(clamp(d.y,-1.0,1.0));',
      '  vec2 uv=vec2(lon/(2.0*PI)+0.5,0.5-lat/PI);',
      '  gl_FragColor=texture2D(u_image,uv);',
      '}'
    ].join('\n');

    const compile = (type, sourceCode) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, sourceCode);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) || 'shader error';
        gl.deleteShader(shader);
        throw new Error('Multires shader: ' + log);
      }
      return shader;
    };

    const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Multires WebGL: ' + (gl.getProgramInfoLog(program) || 'link error'));
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1, 1,-1, -1,1,
      -1,1, 1,-1, 1,1
    ]), gl.STATIC_DRAW);

    gl.useProgram(program);
    const pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
    const faceLocation = gl.getUniformLocation(program, 'u_face');
    gl.viewport(0, 0, size, size);

    return {
      canvas,
      renderFace(faceIndex) {
        gl.useProgram(program);
        gl.uniform1i(faceLocation, faceIndex);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.finish();
      },
      destroy() {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
    };
  }

  function makeMultiresThumbnail(image) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  async function generateSceneMultires(root, scene, sceneIndex, sceneCount, button) {
    const image = await loadImageElement(scene.imageData);
    const limits = getMultiresWebGLLimits();
    const spec = calculateMultiresSpec(image, limits);
    const source = prepareMultiresSource(image, limits.maxTextureSize);
    const projector = createCubemapProjector(source, spec.cubeResolution);
    const faceLetters = ['f', 'b', 'u', 'd', 'l', 'r'];
    const sceneDir = safeFilename(scene.id, 'scene-' + (sceneIndex + 1));
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = spec.cubeResolution;
    faceCanvas.height = spec.cubeResolution;
    const faceCtx = faceCanvas.getContext('2d', { alpha: false });
    const levelCanvas = document.createElement('canvas');
    const tileCanvas = document.createElement('canvas');
    const fallbackCanvas = document.createElement('canvas');
    const fallbackSize = Math.min(1024, spec.cubeResolution);
    const generatedFiles = [];
    fallbackCanvas.width = fallbackSize;
    fallbackCanvas.height = fallbackSize;
    const fallbackCtx = fallbackCanvas.getContext('2d', { alpha: false });

    try {
      for (let faceIndex = 0; faceIndex < faceLetters.length; faceIndex++) {
        const face = faceLetters[faceIndex];
        button.textContent = 'Multires ' + (sceneIndex + 1) + '/' + sceneCount +
          ' · ' + face.toUpperCase();

        projector.renderFace(faceIndex);
        faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
        faceCtx.drawImage(projector.canvas, 0, 0);

        for (let level = spec.maxLevel; level >= 1; level--) {
          const divisor = Math.pow(2, spec.maxLevel - level);
          const levelSize = Math.max(1, Math.floor(spec.cubeResolution / divisor));
          levelCanvas.width = levelSize;
          levelCanvas.height = levelSize;
          const levelCtx = levelCanvas.getContext('2d', { alpha: false });
          levelCtx.drawImage(faceCanvas, 0, 0, levelSize, levelSize);

          const tiles = Math.ceil(levelSize / spec.tileResolution);
          for (let y = 0; y < tiles; y++) {
            for (let x = 0; x < tiles; x++) {
              const sx = x * spec.tileResolution;
              const sy = y * spec.tileResolution;
              const width = Math.min(spec.tileResolution, levelSize - sx);
              const height = Math.min(spec.tileResolution, levelSize - sy);

              tileCanvas.width = width;
              tileCanvas.height = height;
              const tileCtx = tileCanvas.getContext('2d', { alpha: false });
              tileCtx.drawImage(levelCanvas, sx, sy, width, height, 0, 0, width, height);

              const blob = await canvasToBlob(tileCanvas, 'image/jpeg', spec.quality);
              const tilePath = 'multires/' + sceneDir + '/' + level + '/' + face + y + '_' + x + '.jpg';
              root.file(tilePath, blob);
              generatedFiles.push(tilePath);
            }
          }
        }

        fallbackCtx.clearRect(0, 0, fallbackSize, fallbackSize);
        fallbackCtx.drawImage(faceCanvas, 0, 0, fallbackSize, fallbackSize);
        const fallbackBlob = await canvasToBlob(fallbackCanvas, 'image/jpeg', spec.quality);
        const fallbackPath = 'multires/' + sceneDir + '/fallback/' + face + '.jpg';
        root.file(fallbackPath, fallbackBlob);
        generatedFiles.push(fallbackPath);

        await yieldToBrowser();
      }
    } finally {
      projector.destroy();
    }

    return {
      sceneDir,
      tileResolution: spec.tileResolution,
      maxLevel: spec.maxLevel,
      cubeResolution: spec.cubeResolution,
      thumbnail: makeMultiresThumbnail(image),
      files: generatedFiles
    };
  }

  function buildPortableTourConfig(
    sceneFiles,
    multiresScenes = new Map(),
    objectSceneFiles = new Map(),
    stlSceneFiles = new Map(),
    audioConfig = { projectMusic: null, scenes: {} },
    mediaConfig = {}
  ) {
    const firstPanorama = project.scenes.find((scene) => scene.sceneType === 'panorama')?.id || null;
    const config = buildPannellumConfig({ useEmbeddedImages: false, firstSceneId: firstPanorama });

    project.scenes.filter((scene) => scene.sceneType === 'panorama').forEach((scene) => {
      const sceneConfig = config.scenes[scene.id];
      if (!sceneConfig) return;

      const multi = multiresScenes.get(scene.id);
      if (multi) {
        delete sceneConfig.panorama;
        sceneConfig.type = 'multires';
        sceneConfig.multiRes = {
          basePath: 'multires/' + multi.sceneDir + '/',
          path: '%l/%s%y_%x',
          fallbackPath: 'fallback/%s',
          extension: 'jpg',
          tileResolution: multi.tileResolution,
          maxLevel: multi.maxLevel,
          cubeResolution: multi.cubeResolution,
          equirectangularThumbnail: multi.thumbnail
        };
      } else {
        sceneConfig.type = 'equirectangular';
        sceneConfig.panorama = 'images/' + sceneFiles.get(scene.id);
      }
    });

    config.tourFirstScene = project.firstScene || project.scenes[0]?.id || null;
    config.sceneOrder = project.scenes.map((scene) => scene.id);
    config.sceneMeta = Object.fromEntries(project.scenes.map((scene) => [
      scene.id,
      {
        title: scene.title,
        sceneType: ['object360', 'stl'].includes(scene.sceneType) ? scene.sceneType : 'panorama',
        textObjects: Array.isArray(scene.textObjects) ? scene.textObjects.map(normalizeTextObject) : [],
        mediaObjects: mediaConfig[scene.id] || [],
        screenHotspots: scene.sceneType === 'panorama' ? [] : (scene.hotspots || []).filter((hotspot) => hotspot.visible !== false),
        audio: audioConfig.scenes?.[scene.id] || { music: null, narration: null }
      }
    ]));
    config.object360Scenes = Object.fromEntries(objectSceneFiles);
    config.stlScenes = Object.fromEntries(stlSceneFiles);
    config.projectAudio = { music: audioConfig.projectMusic || null };
    config.startScreen = normalizeStartScreen(project.startScreen || {}, project.title);
    if (config.startScreen.coverData) {
      config.startScreen.coverData = 'images/start-cover' +
        (project.startScreen?.__exportCoverExt || extensionForDataUrl(config.startScreen.coverData, '.jpg'));
    }
    config.guide = normalizeGuide(project.guide || {}, project.scenes);
    config.exportSettings = normalizeExportSettings(project.exportSettings || {});
    config.defaultTransition = project.settings.defaultTransition || 'fade';
    config.offlineAssets = [...multiresScenes.values()].flatMap((item) => item.files || []);
    return config;
  }

  function extensionForDataUrl(data, fallback = '.bin') {
    const mime = String(data || '').match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || '';
    if (mime.includes('jpeg')) return '.jpg';
    if (mime.includes('png')) return '.png';
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('mp4')) return '.mp4';
    if (mime.includes('webm')) return '.webm';
    if (mime.includes('pdf')) return '.pdf';
    if (mime.includes('mpeg')) return '.mp3';
    if (mime.includes('ogg')) return '.ogg';
    if (mime.includes('wav')) return '.wav';
    return fallback;
  }

  function bundleDataUrlFile(root, data, path) {
    if (!data) return '';
    const payload = dataUrlPayload(data);
    if (payload.base64) root.file(path, payload.data, { base64:true });
    else root.file(path, decodeURIComponent(payload.data));
    return path;
  }

  async function bundleMediaObjects(root) {
    const output = {};
    for (const scene of project.scenes) {
      const dir = 'media/' + safeFilename(scene.id || scene.title, 'scene');
      const sourceItems = (scene.mediaObjects || []).filter((item) => item.visible !== false);
      output[scene.id] = [];
      for (let index = 0; index < sourceItems.length; index++) {
        const item = normalizeMediaObject(sourceItems[index]);
        const base = safeFilename(item.title || item.id || ('media-' + (index + 1)), 'media-' + (index + 1));
        const exported = { ...item, data:'', gallery:[] };
        const settings = normalizeExportSettings(project.exportSettings || {});

        if (item.data && ['image','video','audio','pdf'].includes(item.type)) {
          let fileData = item.data;
          if (item.type === 'image' && settings.optimizeEnabled) {
            fileData = await optimizeImageDataUrl(
              item.data,
              Math.min(settings.maxImageWidth, 2560),
              settings.jpegQuality,
              /^data:image\/(png|webp)/i.test(item.data)
            );
          }
          const ext = extensionForDataUrl(fileData, item.type === 'pdf' ? '.pdf' : item.type === 'video' ? '.mp4' : item.type === 'audio' ? '.mp3' : '.jpg');
          exported.src = bundleDataUrlFile(root, fileData, dir + '/' + base + ext);
        }
        if (item.type === 'gallery') {
          for (let galleryIndex = 0; galleryIndex < (item.gallery || []).length; galleryIndex++) {
            const entry = item.gallery[galleryIndex];
            let fileData = entry.data;
            if (settings.optimizeEnabled) {
              fileData = await optimizeImageDataUrl(
                entry.data,
                Math.min(settings.maxImageWidth, 2560),
                settings.jpegQuality,
                /^data:image\/(png|webp)/i.test(entry.data)
              );
            }
            const ext = extensionForDataUrl(fileData, '.jpg');
            const path = dir + '/' + base + '-' + String(galleryIndex + 1).padStart(2, '0') + ext;
            bundleDataUrlFile(root, fileData, path);
            exported.gallery.push({ src:path, filename:entry.filename || '' });
          }
        }
        output[scene.id].push(exported);
      }
    }
    return output;
  }

  function bundleAudioSlot(root, slot, baseName) {
    const data = normalizeAudioSlot(slot || {}, { volume: 50, loop: false });
    if (!data.data) return null;

    const ext = audioExtension(data);
    const filename = safeFilename(baseName, 'audio') + '.' + ext;
    const path = 'audio/' + filename;
    const payload = dataUrlPayload(data.data);
    if (payload.base64) root.file(path, payload.data, { base64: true });
    else root.file(path, decodeURIComponent(payload.data));

    return {
      src: path,
      volume: data.volume,
      loop: Boolean(data.loop),
      filename: data.filename || filename
    };
  }

  function exportedViewerHtml() {
    const title = escapeHtml(project.title || 'Виртуальная экскурсия');
    const pwa = normalizeExportSettings(project.exportSettings || {}).pwaEnabled;
    return '<!doctype html>\n' +
      '<html lang="ru">\n<head>\n' +
      '  <meta charset="utf-8">\n' +
      '  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
      '  <meta name="theme-color" content="#05070c">\n' +
      '  <meta name="mobile-web-app-capable" content="yes">\n' +
      '  <meta name="apple-mobile-web-app-capable" content="yes">\n' +
      '  <title>' + title + '</title>\n' +
      (pwa ? '  <link rel="manifest" href="manifest.webmanifest">\n' : '') +
      '  <link rel="stylesheet" href="vendor/pannellum/build/pannellum.css">\n' +
      '  <link rel="stylesheet" href="assets/tour.css">\n' +
      '</head>\n<body>\n' +
      '  <div id="tourNavBar">\n' +
      '    <button id="tourBackButton" type="button" hidden>← Назад</button>\n' +
      '    <select id="sceneMenuExport" aria-label="Сцены тура"></select>\n' +
      '  </div>\n' +
      '  <div id="panorama"></div>\n' +
      '  <div id="sceneTextOverlay" class="scene-text-overlay"></div>\n' +
      '  <div id="tourTransitionLayer" class="tour-transition-layer"></div>\n' +
      '  <div id="tourInfoPanel" class="tour-info-panel" hidden><button id="tourInfoClose" type="button">×</button><div id="tourInfoContent"></div></div>\n' +
      '  <div id="tourBottomDock" class="tour-bottom-dock">\n' +
      '    <button id="tourGuideButton" type="button" title="Экскурсия с гидом" hidden>▶ Гид</button>\n' +
      '    <button id="tourFullscreenButton" type="button" title="На весь экран">⛶</button>\n' +
      '    <button id="tourMusicButton" type="button" title="Музыка">♪</button>\n' +
      '    <button id="tourNarrationButton" type="button" title="Озвучка" hidden>🔊</button>\n' +
      '  </div>\n' +
      '  <div id="tourStartScreen" class="tour-start-screen" hidden>\n' +
      '    <div class="tour-start-shade"></div>\n' +
      '    <div class="tour-start-card">\n' +
      '      <span class="tour-start-kicker">360° · OBJECT · 3D</span>\n' +
      '      <h1 id="tourStartTitle"></h1>\n' +
      '      <p id="tourStartSubtitle"></p>\n' +
      '      <div class="tour-start-actions">\n' +
      '        <button id="tourStartSound" type="button">Начать со звуком</button>\n' +
      '        <button id="tourStartSilent" type="button">Без звука</button>\n' +
      '      </div>\n' +
      '    </div>\n' +
      '  </div>\n' +
      '  <noscript>Для просмотра виртуального тура необходимо включить JavaScript.</noscript>\n' +
      '  <script src="vendor/pannellum/build/pannellum.js"></script>\n' +
      '  <script src="assets/object360.js"></script>\n' +
      '  <script src="assets/stl-viewer.js"></script>\n' +
      '  <script src="assets/tour.js"></script>\n' +
      (pwa ? '  <script>if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));}</script>\n' : '') +
      '</body>\n</html>\n';
  }

  function iconExtension(hotspot) {
    const match = String(hotspot.iconFilename || '').toLowerCase().match(/\.([a-z0-9]{2,5})$/);
    if (match && ['png', 'webp', 'svg'].includes(match[1])) return match[1];
    const dataMatch = String(hotspot.iconData || '').match(/^data:image\/([a-zA-Z0-9.+-]+);/);
    if (!dataMatch) return 'png';
    const subtype = dataMatch[1].toLowerCase();
    if (subtype === 'svg+xml') return 'svg';
    return ['png', 'webp'].includes(subtype) ? subtype : 'png';
  }

  async function bundleTransitionIcons(root) {
    const builtin = ['arrow', 'forward', 'door', 'stairs'];
    await Promise.all(builtin.map(async (name) => {
      const response = await fetchRequiredAsset('assets/icons/' + name + '.svg');
      root.file('images/icons/' + name + '.svg', await response.arrayBuffer());
    }));

    const customFiles = new Map();
    const used = new Set();

    project.scenes.forEach((scene) => {
      (scene.hotspots || []).forEach((hotspot) => {
        if (hotspot.type !== 'scene' || !['custom', 'preview'].includes(hotspot.iconPreset) || !hotspot.iconData) return;

        const ext = iconExtension(hotspot);
        const base = (hotspot.iconPreset === 'preview' ? 'preview-' : 'custom-') + hotspotCssToken(hotspot.id);
        let filename = base + '.' + ext;
        let n = 2;
        while (used.has(filename.toLowerCase())) filename = base + '-' + n++ + '.' + ext;
        used.add(filename.toLowerCase());

        const payload = dataUrlPayload(hotspot.iconData);
        if (payload.base64) root.file('images/icons/' + filename, payload.data, { base64: true });
        else root.file('images/icons/' + filename, decodeURIComponent(payload.data));
        customFiles.set(hotspot.id, filename);
      });
    });

    return customFiles;
  }

  function exportedViewerCss(customIconFiles = new Map()) {
    let css = ':root{color-scheme:dark}\n' +
      '*{box-sizing:border-box}\n' +
      'html,body,#panorama{width:100%;height:100%;margin:0}\n' +
      'html,body{overflow:hidden;background:#05070c}\n' +
      'body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}\n' +
      '.pnlm-container{background:#05070c}\n' +
      '.pnlm-title-box,.pnlm-author-box{background:rgba(5,7,12,.72)!important;backdrop-filter:blur(12px)}\n' +
      '.pnlm-scene:not(.scene-image-hotspot){border-radius:50%;box-shadow:0 0 0 4px rgba(89,111,255,.22)}\n' +
      '.scene-image-hotspot{width:52px!important;height:52px!important;margin-left:-26px!important;margin-top:-26px!important;background-color:transparent!important;background-repeat:no-repeat!important;background-position:center!important;background-size:contain!important;border-radius:0!important;box-shadow:none!important;filter:drop-shadow(0 8px 12px rgba(0,0,0,.35));transition:filter .16s ease}\n' +
      '.scene-image-hotspot:hover{filter:drop-shadow(0 8px 14px rgba(0,0,0,.42)) brightness(1.08)}\n' +
      '.scene-preview-hotspot{width:96px!important;height:62px!important;margin-left:-48px!important;margin-top:-31px!important;background-size:cover!important;border-radius:12px!important;border:3px solid rgba(255,255,255,.94)!important;box-shadow:0 8px 24px rgba(0,0,0,.35)!important;overflow:hidden}\n' +
      '.scene-preview-hotspot:after{content:"→";position:absolute;right:5px;bottom:5px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(6,10,18,.78);color:#fff;font-size:14px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,.35)}\n' +
      '.scene-icon-arrow{background-image:url("../images/icons/arrow.svg")!important}\n' +
      '.scene-icon-forward{background-image:url("../images/icons/forward.svg")!important}\n' +
      '.scene-icon-door{background-image:url("../images/icons/door.svg")!important}\n' +
      '.scene-icon-stairs{background-image:url("../images/icons/stairs.svg")!important}\n' +
      '.pnlm-info{border-radius:50%;box-shadow:0 0 0 4px rgba(31,214,187,.2)}\n' +
      '.editor-url-hotspot{width:24px!important;height:24px!important;border-radius:50%;background:#ffb74d!important;box-shadow:0 0 0 4px rgba(255,183,77,.18);cursor:pointer}\n' +
      '.editor-url-hotspot:before{content:"↗";display:grid;place-items:center;width:100%;height:100%;color:#171008;font-weight:900;font-size:13px}\n' +
      'noscript{position:fixed;inset:0;display:grid;place-items:center;padding:30px;text-align:center;color:#fff;background:#05070c}\n' +
      '#tourNavBar{position:fixed;z-index:50;left:12px;top:12px;display:flex;align-items:center;gap:8px;max-width:min(520px,calc(100vw - 24px))}\n' +
      '#tourBackButton,#sceneMenuExport{border:1px solid rgba(255,255,255,.15);border-radius:10px;background:rgba(6,10,18,.78);color:#fff;padding:8px 10px;backdrop-filter:blur(12px);font:600 12px system-ui}\n' +
      '#tourBackButton{cursor:pointer;white-space:nowrap}#tourBackButton:hover{background:rgba(20,28,46,.92)}#tourBackButton[hidden]{display:none}\n' +
      '#sceneMenuExport{min-width:190px;max-width:min(320px,calc(100vw - 110px))}\n' +
      '.object360-host{position:relative;overflow:hidden}.object360-viewer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(108,124,255,.12),transparent 38%),#040812;outline:0;user-select:none;touch-action:none;cursor:grab}.object360-viewer.dragging{cursor:grabbing}.object360-image-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden}.object360-image{max-width:92%;max-height:88%;width:auto;height:auto;object-fit:contain;transform-origin:center center;transition:transform .08s linear;filter:drop-shadow(0 28px 55px rgba(0,0,0,.38));pointer-events:none}.object360-loading{position:absolute;left:50%;top:50%;translate:-50% -50%;padding:8px 11px;border-radius:9px;background:rgba(5,9,18,.78);color:#a9b4ca;font-size:10px}.object360-hud{position:absolute;left:12px;right:12px;bottom:12px;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(8,13,24,.78);backdrop-filter:blur(12px)}.object360-counter,.object360-row-label{flex:none;padding:4px 7px;border-radius:7px;background:rgba(255,255,255,.055);font-size:9px}.object360-row-label{color:#75e7d6}.object360-hint{flex:1;color:#9ba7bd;font-size:9px;text-align:center}.object360-autoplay,.object360-reset{flex:none;width:34px;height:28px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#121b2e;color:#fff;cursor:pointer}\n' +
      '.stl-host{position:relative;overflow:hidden}.stl-viewer{position:absolute;inset:0;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(124,140,255,.16),transparent 42%),linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px),#040812;background-size:auto,40px 40px,40px 40px;outline:0;touch-action:none;cursor:grab}.stl-viewer.dragging{cursor:grabbing}.stl-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.stl-loading{position:absolute;left:50%;top:50%;translate:-50% -50%;padding:8px 11px;border-radius:9px;background:rgba(5,9,18,.82);color:#a9b4ca;font-size:10px}.stl-hud{position:absolute;left:12px;right:12px;bottom:12px;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(8,13,24,.8);backdrop-filter:blur(12px)}.stl-stats{flex:none;padding:4px 7px;border-radius:7px;background:rgba(124,140,255,.12);color:#c8ceff;font-size:9px}.stl-hint{flex:1;color:#9ba7bd;font-size:9px;text-align:center}.stl-mode,.stl-auto,.stl-reset{flex:none;min-width:34px;height:28px;padding:0 8px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#121b2e;color:#fff;cursor:pointer;font-size:9px;font-weight:800}.viewer-error{padding:30px;color:#fff;font:14px system-ui}\n';

    css +=
      '.scene-text-overlay{position:fixed;inset:0;z-index:35;pointer-events:none;overflow:hidden}\n' +
      '.scene-text-object{position:absolute;pointer-events:none;max-width:90%;line-height:1.15;text-shadow:0 2px 14px rgba(0,0,0,.5);overflow-wrap:anywhere;animation-duration:.48s;animation-fill-mode:both}\n' +
      '.scene-text-title{font-weight:900;letter-spacing:-.03em}.scene-text-description{font-weight:500;line-height:1.45}\n' +      '.scene-text-inner{white-space:pre-line}\n' +

      '.scene-text-bg-dark .scene-text-inner{display:block;padding:.7em .9em;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(5,9,18,.64);backdrop-filter:blur(12px)}\n' +
      '.scene-text-bg-light .scene-text-inner{display:block;padding:.7em .9em;border:1px solid rgba(255,255,255,.35);border-radius:14px;background:rgba(255,255,255,.78);color:#101827;text-shadow:none;backdrop-filter:blur(12px)}\n' +
      '.scene-text-anim-fade{animation-name:sceneTextFade}.scene-text-anim-slide{animation-name:sceneTextSlide}.scene-text-anim-none{animation:none}\n' +
      '@keyframes sceneTextFade{from{opacity:0}to{opacity:1}}@keyframes sceneTextSlide{from{opacity:0;translate:0 18px}to{opacity:1;translate:0 0}}\n' +
      '.tour-audio-controls{position:fixed;right:12px;bottom:12px;z-index:60;display:flex;gap:7px}.tour-audio-controls button{width:40px;height:40px;border:1px solid rgba(255,255,255,.15);border-radius:50%;background:rgba(6,10,18,.78);color:#fff;backdrop-filter:blur(12px);cursor:pointer;font-size:16px;font-weight:900}.tour-audio-controls button.active{border-color:rgba(31,214,187,.65);box-shadow:0 0 0 3px rgba(31,214,187,.12);color:#75e7d6}.tour-audio-controls button[hidden]{display:none}\n' +
      '@media(max-width:640px){#tourNavBar{right:12px;max-width:none}#sceneMenuExport{min-width:0;flex:1}.scene-text-object{max-width:92%!important}.tour-audio-controls{bottom:10px;right:10px}}\n';

    css +=
      '.scene-text-overlay{position:fixed;inset:0;z-index:35;pointer-events:none;overflow:hidden}\n' +
      '.scene-media-object{position:absolute;pointer-events:auto;border-radius:14px;overflow:hidden;animation-duration:.48s;animation-fill-mode:both}.scene-media-object img,.scene-media-object video{width:100%;height:100%;display:block}.scene-media-object img{object-position:center}.scene-media-video video{background:#000}.scene-media-audio{height:auto!important;min-height:58px;overflow:visible;box-shadow:none}.scene-audio-player{width:100%;min-height:58px;padding:9px;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:rgba(6,10,18,.84);backdrop-filter:blur(12px);box-shadow:0 12px 36px rgba(0,0,0,.28)}.scene-audio-player.large{padding:13px}.scene-audio-header{display:flex;align-items:center;gap:8px;margin-bottom:7px;min-width:0}.scene-audio-icon{flex:none;width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:rgba(31,214,187,.12);color:#75e7d6;font-size:14px;font-weight:900}.scene-audio-title{min-width:0;color:#eef3ff;font-size:10px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.scene-audio-player.large .scene-audio-icon{width:38px;height:38px;font-size:18px}.scene-audio-player.large .scene-audio-title{font-size:12px}.scene-audio-player audio{display:block;width:100%;height:36px}.scene-media-audio-hidden{width:0!important;height:0!important;min-height:0!important;overflow:hidden!important;pointer-events:none!important}.scene-media-pdf,.scene-media-button{height:auto!important}.scene-document-card,.scene-action-button{width:100%;height:100%;min-height:48px;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:rgba(6,10,18,.78);color:#fff;backdrop-filter:blur(12px)}.scene-document-card{display:flex;align-items:center;gap:10px;padding:12px}.scene-document-card b{display:grid;place-items:center;width:44px;height:44px;border-radius:10px;background:#d94b4b}.scene-action-button{padding:12px 18px;font-weight:800;cursor:pointer}.scene-gallery-frame{position:relative;width:100%;height:100%}.scene-gallery-frame span{position:absolute;right:8px;bottom:8px;padding:4px 7px;border-radius:8px;background:rgba(0,0,0,.65);font-size:10px}.scene-gallery-nav{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;pointer-events:none}.scene-gallery-nav button{pointer-events:auto;margin:6px;width:34px;height:34px;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;cursor:pointer}.scene-media-anim-fade{animation-name:sceneTextFade}.scene-media-anim-slide{animation-name:sceneTextSlide}.scene-media-anim-zoom{animation-name:sceneMediaZoom}.scene-media-anim-none{animation:none}@keyframes sceneMediaZoom{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}\n' +
      '.screen-hotspot{position:absolute;transform:translate(-50%,-50%);z-index:45;display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.25);border-radius:999px;background:rgba(5,9,18,.82);color:#fff;padding:8px 10px;pointer-events:auto;cursor:pointer;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,.35)}.screen-hotspot>span{font:700 10px system-ui;white-space:nowrap}.screen-hotspot:hover{border-color:#7c8cff;transform:translate(-50%,-50%) scale(1.04)}\n' +      '.guide-highlight{animation:guidePulse .8s ease-in-out infinite alternate!important;box-shadow:0 0 0 6px rgba(117,231,214,.25),0 0 30px rgba(117,231,214,.8)!important}@keyframes guidePulse{from{filter:brightness(1)}to{filter:brightness(1.8)}}\n' +

      '.tour-bottom-dock{position:fixed;z-index:65;right:12px;bottom:12px;display:flex;gap:7px}.tour-bottom-dock button{min-width:40px;height:40px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(6,10,18,.78);color:#fff;padding:0 12px;backdrop-filter:blur(12px);cursor:pointer;font:800 12px system-ui}.tour-bottom-dock button.active{border-color:rgba(31,214,187,.65);color:#75e7d6}.tour-bottom-dock button[hidden]{display:none}\n' +
      '.tour-transition-layer{position:fixed;inset:0;z-index:90;pointer-events:none;opacity:0;background:#05070c}.tour-transition-layer.active{animation-duration:.62s;animation-fill-mode:both}.tour-transition-layer.t-fade.active{animation-name:tFade}.tour-transition-layer.t-black.active{animation-name:tBlack}.tour-transition-layer.t-blur.active{animation-name:tBlur;background:rgba(5,7,12,.88);backdrop-filter:blur(20px)}.tour-transition-layer.t-zoom.active{animation-name:tZoom;background:radial-gradient(circle,rgba(124,140,255,.14),#05070c)}.tour-transition-layer.t-portal.active{animation-name:tPortal;background:radial-gradient(circle at center,transparent 0 12%,#7c8cff 13%,#05070c 58%)}.tour-transition-layer.t-glitch.active{animation-name:tGlitch;background:repeating-linear-gradient(0deg,rgba(124,140,255,.16) 0 2px,#05070c 3px 7px)}@keyframes tFade{0%,100%{opacity:0}45%,60%{opacity:1}}@keyframes tBlack{0%,100%{opacity:0}35%,65%{opacity:1}}@keyframes tBlur{0%,100%{opacity:0}45%,60%{opacity:1}}@keyframes tZoom{0%,100%{opacity:0;transform:scale(1.25)}48%,58%{opacity:1;transform:scale(1)}}@keyframes tPortal{0%,100%{opacity:0;transform:scale(2)}48%,58%{opacity:1;transform:scale(.8)}}@keyframes tGlitch{0%,100%{opacity:0;transform:none}42%{opacity:1;transform:translateX(-8px)}48%{transform:translateX(10px)}55%{transform:translateX(-4px)}62%{opacity:1;transform:none}}\n' +
      '.tour-start-screen{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background-position:center;background-size:cover}.tour-start-screen[hidden]{display:none}.tour-start-shade{position:absolute;inset:0;background:linear-gradient(135deg,rgba(2,5,12,.9),rgba(7,11,24,.55),rgba(2,5,12,.88))}.tour-start-card{position:relative;z-index:1;width:min(720px,calc(100vw - 36px));padding:44px;border:1px solid rgba(255,255,255,.14);border-radius:28px;background:rgba(5,9,18,.62);backdrop-filter:blur(22px);color:#fff;box-shadow:0 30px 100px rgba(0,0,0,.42)}.tour-start-kicker{font:800 11px system-ui;letter-spacing:.16em;color:#75e7d6}.tour-start-card h1{margin:14px 0 10px;font:900 clamp(34px,6vw,76px)/.96 system-ui;letter-spacing:-.05em}.tour-start-card p{max-width:620px;margin:0 0 28px;color:#c0cadc;font:500 clamp(14px,2vw,20px)/1.5 system-ui}.tour-start-actions{display:flex;gap:10px;flex-wrap:wrap}.tour-start-actions button{border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:13px 18px;background:#7c8cff;color:#fff;font-weight:900;cursor:pointer}.tour-start-actions button+button{background:rgba(255,255,255,.08)}\n' +
      '.tour-info-panel{position:fixed;z-index:80;right:16px;top:70px;width:min(380px,calc(100vw - 32px));padding:18px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(5,9,18,.9);color:#fff;backdrop-filter:blur(18px);box-shadow:0 20px 70px rgba(0,0,0,.38)}.tour-info-panel[hidden]{display:none}.tour-info-panel>button{position:absolute;right:8px;top:8px;width:30px;height:30px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;cursor:pointer}.tour-info-panel #tourInfoContent{padding-right:25px;white-space:pre-line;line-height:1.5}\n' +
      'body.kiosk #tourNavBar{display:none}body.kiosk .pnlm-controls{opacity:.35}body.kiosk .tour-bottom-dock{left:50%;right:auto;transform:translateX(-50%)}\n' +
      '@media(max-width:640px){#tourNavBar{left:8px;right:8px;top:8px;max-width:none}.tour-bottom-dock{left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));justify-content:center}.tour-bottom-dock button{flex:1;max-width:110px;padding:0 8px}.tour-start-card{padding:28px 22px;border-radius:22px}.scene-text-object{max-width:92%!important}.scene-media-object{max-width:94%}.screen-hotspot>span{display:none}}\n';

    customIconFiles.forEach((filename, hotspotId) => {
      css += '.hotspot-custom-' + hotspotCssToken(hotspotId) +
        '{background-image:url("../images/icons/' + filename.replace(/"/g, '%22') + '")!important}\n';
    });

    project.scenes.forEach((scene) => {
      (scene.hotspots || []).forEach((hotspot) => {
        const glowCss = buildHotspotGlowCss(hotspot);
        if (glowCss) css += glowCss + '\n';
      });
    });

    return css;
  }

  function exportedViewerJs(config) {
    const json = JSON.stringify(config, null, 2)
      .replace(/<\/script/gi, '<\\/script')
      .replace(/<!--/g, '<\\!--');

    return `(() => {
  'use strict';

  const config = ${json};

  let panoViewer = null;
  let objectViewer = null;
  let stlViewer = null;
  let currentSceneId = '';
  let musicAudio = null;
  let musicKey = '';
  let narrationAudio = null;
  let musicEnabled = true;
  let userInteracted = false;
  let guideTimer = 0;
  let guideIndex = -1;
  let guideRunning = false;
  const historyStack = [];
  const galleryIndexes = new Map();

  const host = document.getElementById('panorama');
  const menu = document.getElementById('sceneMenuExport');
  const backButton = document.getElementById('tourBackButton');
  const overlay = document.getElementById('sceneTextOverlay');
  const transitionLayer = document.getElementById('tourTransitionLayer');
  const infoPanel = document.getElementById('tourInfoPanel');
  const infoContent = document.getElementById('tourInfoContent');
  const infoClose = document.getElementById('tourInfoClose');
  const musicButton = document.getElementById('tourMusicButton');
  const narrationButton = document.getElementById('tourNarrationButton');
  const fullscreenButton = document.getElementById('tourFullscreenButton');
  const guideButton = document.getElementById('tourGuideButton');
  const startScreen = document.getElementById('tourStartScreen');
  const startTitle = document.getElementById('tourStartTitle');
  const startSubtitle = document.getElementById('tourStartSubtitle');
  const startSound = document.getElementById('tourStartSound');
  const startSilent = document.getElementById('tourStartSilent');

  const clamp = (v,min,max) => Math.min(max,Math.max(min,Number(v)||0));
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const destroyViewer = () => {
    if (panoViewer) { try { panoViewer.destroy(); } catch (_) {} panoViewer = null; }
    if (objectViewer) { try { objectViewer.destroy(); } catch (_) {} objectViewer = null; }
    if (stlViewer) { try { stlViewer.destroy(); } catch (_) {} stlViewer = null; }
    host.innerHTML = '';
  };

  const updateMenu = (id) => { if (menu) menu.value = id || ''; };

  const updateBackButton = () => {
    if (!backButton) return;
    backButton.hidden = historyStack.length === 0;
    if (!historyStack.length) return;
    const previousId = historyStack[historyStack.length - 1];
    const previous = config.sceneMeta?.[previousId];
    backButton.textContent = previous?.title ? '← ' + previous.title : '← Назад';
  };

  const showInfo = (text) => {
    if (!infoPanel || !infoContent) return;
    infoContent.textContent = text || '';
    infoPanel.hidden = !text;
  };

  const screenHotspotVisible = (hotspot, meta, state, projector = null) => {
    if (hotspot.visible === false) return false;
    if (meta.sceneType === 'object360') {
      if (!state) return true;
      const sectors = Math.max(1, Number(config.object360Scenes?.[currentSceneId]?.sectors) || 1);
      const d = ((Number(state.sector)||0) - (Number(hotspot.anchorSector)||0) + sectors) % sectors;
      const distance = Math.min(d, sectors - d);
      return distance <= Math.max(1, Math.round(sectors / 18)) &&
        Number(state.row||0) === Number(hotspot.anchorRow||0);
    }
    if (meta.sceneType === 'stl') {
      if (hotspot.anchorMode === 'stl-3d' && hotspot.modelPoint && projector?.projectPoint) {
        return Boolean(projector.projectPoint(hotspot.modelPoint)?.visible);
      }
      if (!state) return true;
      const dy = Math.abs((((Number(state.yaw)||0) - (Number(hotspot.anchorYaw)||0) + 540) % 360) - 180);
      const dp = Math.abs((Number(state.pitch)||0) - (Number(hotspot.anchorPitch)||0));
      return dy <= 65 && dp <= 55;
    }
    return false;
  };

  const screenHotspotPosition = (hotspot, meta, state, projector = null) => {
    let x = Number(hotspot.anchorX)||50;
    let y = Number(hotspot.anchorY)||50;
    if (meta.sceneType === 'stl' && hotspot.anchorMode === 'stl-3d' && hotspot.modelPoint && projector?.projectPoint) {
      const projected = projector.projectPoint(hotspot.modelPoint);
      if (projected) return {x:projected.x,y:projected.y};
    }
    if (meta.sceneType === 'stl' && state) {
      const dy = (((Number(state.yaw)||0) - (Number(hotspot.anchorYaw)||0) + 540) % 360) - 180;
      const dp = (Number(state.pitch)||0) - (Number(hotspot.anchorPitch)||0);
      x -= dy * .55;
      y -= dp * .65;
    }
    return {x:clamp(x,-20,120), y:clamp(y,-20,120)};
  };

  const runHotspotAction = (hotspot) => {
    if (!hotspot) return;
    if (hotspot.type === 'scene' && hotspot.targetSceneId) {
      showScene(hotspot.targetSceneId, true, hotspot.transition || config.defaultTransition || 'fade');
      return;
    }
    if (hotspot.type === 'url' && hotspot.url) {
      window.open(hotspot.url, '_blank', 'noopener');
      return;
    }
    if (hotspot.type === 'info') {
      showInfo((hotspot.text ? hotspot.text + '\\n\\n' : '') + (hotspot.info || ''));
    }
  };

  const renderOverlay = (id, state = null, projector = null) => {
    if (!overlay) return;
    overlay.innerHTML = '';
    const meta = config.sceneMeta?.[id] || {};

    (meta.textObjects || []).filter((item) => item.visible !== false).forEach((item) => {
      const el = document.createElement('div');
      el.className = [
        'scene-text-object',
        'scene-text-' + (item.type || 'description'),
        'scene-text-bg-' + (item.background || 'none'),
        'scene-text-anim-' + (item.animation || 'fade')
      ].join(' ');
      el.style.left = Number(item.x || 0) + '%';
      el.style.top = Number(item.y || 0) + '%';
      el.style.width = Number(item.width || 40) + '%';
      el.style.fontSize = Number(item.fontSize || 20) + 'px';
      el.style.color = item.color || '#fff';
      el.style.textAlign = item.align || 'left';
      el.style.zIndex = String(Number(item.zIndex) || 10);
      const inner = document.createElement('div');
      inner.className = 'scene-text-inner';
      inner.textContent = item.text || '';
      el.appendChild(inner);
      overlay.appendChild(el);
    });

    (meta.mediaObjects || []).filter((item) => item.visible !== false).forEach((item) => {
      const el = document.createElement('div');
      el.className = 'scene-media-object scene-media-' + item.type + ' scene-media-anim-' + (item.animation || 'fade');
      el.dataset.mediaId = item.id || '';
      el.style.left = Number(item.x || 0) + '%';
      el.style.top = Number(item.y || 0) + '%';
      el.style.width = Number(item.width || 36) + '%';
      el.style.height = Number(item.height || 32) + '%';
      el.style.zIndex = String(Number(item.zIndex) || 20);

      if (item.type === 'image' && item.src) {
        const img = document.createElement('img');
        img.src = item.src; img.alt = item.title || ''; img.style.objectFit = item.fit || 'contain';
        el.appendChild(img);
      } else if (item.type === 'video' && item.src) {
        const video = document.createElement('video');
        video.src = item.src; video.controls = true; video.playsInline = true;
        video.autoplay = Boolean(item.autoplay); video.muted = true; video.loop = Boolean(item.loop);
        el.appendChild(video);
      } else if (item.type === 'audio' && item.src) {
        const style = ['compact','large','hidden'].includes(item.audioStyle) ? item.audioStyle : 'compact';
        const audio = document.createElement('audio');
        audio.src = item.src;
        audio.preload = 'metadata';
        audio.loop = Boolean(item.loop);
        audio.volume = clamp((item.volume ?? 80) / 100, 0, 1);
        audio.dataset.mediaAutoplay = item.autoplay ? '1' : '0';
        if (style === 'hidden') {
          el.classList.add('scene-media-audio-hidden');
        } else {
          const player = document.createElement('div');
          player.className = 'scene-audio-player ' + style;
          const header = document.createElement('div');
          header.className = 'scene-audio-header';
          const icon = document.createElement('span');
          icon.className = 'scene-audio-icon'; icon.textContent = '♪';
          const title = document.createElement('span');
          title.className = 'scene-audio-title'; title.textContent = item.title || item.filename || 'Аудио';
          header.append(icon,title);
          audio.controls = true;
          player.append(header,audio);
          el.appendChild(player);
        }
        if (style === 'hidden') el.appendChild(audio);
        if (item.autoplay && userInteracted && musicEnabled) audio.play().catch(()=>{});
      } else if (item.type === 'pdf' && item.src) {
        const card = document.createElement('button');
        card.type = 'button'; card.className = 'scene-document-card';
        card.innerHTML = '<b>PDF</b><span></span>';
        card.querySelector('span').textContent = item.title || item.filename || 'Документ';
        card.addEventListener('click', () => window.open(item.src, '_blank', 'noopener'));
        el.appendChild(card);
      } else if (item.type === 'button') {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'scene-action-button'; btn.textContent = item.title || 'Подробнее';
        btn.addEventListener('click', () => {
          if (item.targetSceneId) showScene(item.targetSceneId, true, config.defaultTransition || 'fade');
          else if (item.url) window.open(item.url, '_blank', 'noopener');
        });
        el.appendChild(btn);
      } else if (item.type === 'gallery' && item.gallery?.length) {
        const index = galleryIndexes.get(item.id) || 0;
        const frame = document.createElement('div');
        frame.className = 'scene-gallery-frame';
        const img = document.createElement('img');
        img.src = item.gallery[index % item.gallery.length].src;
        img.style.objectFit = item.fit || 'contain';
        const count = document.createElement('span');
        count.textContent = (index + 1) + ' / ' + item.gallery.length;
        frame.append(img, count);
        const nav = document.createElement('div');
        nav.className = 'scene-gallery-nav';
        const prev = document.createElement('button'); prev.type='button'; prev.textContent='‹';
        const next = document.createElement('button'); next.type='button'; next.textContent='›';
        prev.addEventListener('click', () => { galleryIndexes.set(item.id,(index - 1 + item.gallery.length)%item.gallery.length); renderOverlay(id,state,projector); });
        next.addEventListener('click', () => { galleryIndexes.set(item.id,(index + 1)%item.gallery.length); renderOverlay(id,state,projector); });
        nav.append(prev,next);
        el.append(frame,nav);
      }
      overlay.appendChild(el);
    });

    (meta.screenHotspots || []).forEach((hotspot) => {
      if (!screenHotspotVisible(hotspot, meta, state, projector)) return;
      const pos = screenHotspotPosition(hotspot, meta, state, projector);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'screen-hotspot hotspot-' + (hotspot.type || 'info');
      btn.dataset.screenHotspotId = hotspot.id || '';
      btn.style.left = pos.x + '%';
      btn.style.top = pos.y + '%';
      btn.style.zIndex = String(Number(hotspot.zIndex) || 30);
      btn.innerHTML = (hotspot.type === 'scene' ? '→' : hotspot.type === 'url' ? '↗' : 'i') + '<span></span>';
      btn.querySelector('span').textContent = hotspot.text || (hotspot.type === 'scene' ? 'Переход' : 'Подробнее');
      btn.addEventListener('click', () => runHotspotAction(hotspot));
      overlay.appendChild(btn);
    });
  };

  const renderDynamicHotspots = (id, state = null, projector = null) => {
    if (!overlay) return;
    const meta = config.sceneMeta?.[id] || {};
    overlay.querySelectorAll('.screen-hotspot').forEach((element) => element.remove());
    (meta.screenHotspots || []).forEach((hotspot) => {
      if (!screenHotspotVisible(hotspot, meta, state, projector)) return;
      const pos = screenHotspotPosition(hotspot, meta, state, projector);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'screen-hotspot hotspot-' + (hotspot.type || 'info');
      btn.dataset.screenHotspotId = hotspot.id || '';
      btn.style.left = pos.x + '%';
      btn.style.top = pos.y + '%';
      btn.style.zIndex = String(Number(hotspot.zIndex) || 30);
      btn.innerHTML = (hotspot.type === 'scene' ? '→' : hotspot.type === 'url' ? '↗' : 'i') + '<span></span>';
      btn.querySelector('span').textContent = hotspot.text || (hotspot.type === 'scene' ? 'Переход' : 'Подробнее');
      btn.addEventListener('click', () => runHotspotAction(hotspot));
      overlay.appendChild(btn);
    });
  };

  const playAutoplayMedia = () => {
    if (!overlay || !userInteracted || !musicEnabled) return;
    overlay.querySelectorAll('audio[data-media-autoplay="1"]').forEach((audio) => {
      audio.play().catch(()=>{});
    });
  };

  const desiredMusic = (id) => {
    const sceneMusic = config.sceneMeta?.[id]?.audio?.music;
    return sceneMusic?.src ? sceneMusic : config.projectAudio?.music;
  };

  const stopNarration = () => {
    if (narrationAudio) {
      try { narrationAudio.pause(); narrationAudio.currentTime = 0; } catch (_) {}
    }
    narrationAudio = null;
    narrationButton?.classList.remove('active');
    if (musicAudio) {
      const desired = desiredMusic(currentSceneId);
      musicAudio.volume = clamp((desired?.volume ?? 50) / 100,0,1);
    }
  };

  const tryPlayMusic = async () => {
    if (!musicAudio || !musicEnabled || !userInteracted) return;
    try { await musicAudio.play(); musicButton?.classList.add('active'); } catch (_) {}
  };

  const configureAudio = (id) => {
    stopNarration();
    const music = desiredMusic(id);
    if (musicButton) musicButton.hidden = !music?.src;
    const nextKey = music?.src || '';
    if (nextKey !== musicKey) {
      if (musicAudio) { try { musicAudio.pause(); } catch (_) {} }
      musicAudio = null; musicKey = nextKey;
      if (music?.src) {
        musicAudio = new Audio(music.src);
        musicAudio.loop = Boolean(music.loop);
        musicAudio.preload = 'auto';
      }
    }
    if (musicAudio && music) {
      musicAudio.volume = clamp((music.volume ?? 50) / 100,0,1);
      tryPlayMusic();
    }
    const narration = config.sceneMeta?.[id]?.audio?.narration;
    if (narrationButton) narrationButton.hidden = !narration?.src;
  };

  const playNarration = async () => {
    const narration = config.sceneMeta?.[currentSceneId]?.audio?.narration;
    if (!narration?.src) return;
    if (narrationAudio && !narrationAudio.paused) { stopNarration(); return; }
    stopNarration();
    narrationAudio = new Audio(narration.src);
    narrationAudio.volume = clamp((narration.volume ?? 80) / 100,0,1);
    if (musicAudio && !musicAudio.paused) musicAudio.volume *= .28;
    narrationAudio.addEventListener('ended', stopNarration, {once:true});
    try { await narrationAudio.play(); narrationButton?.classList.add('active'); } catch (_) { stopNarration(); }
  };

  const applyTransition = async (name, switchFn) => {
    const transition = ['fade','zoom','blur','portal','glitch','black'].includes(name) ? name : 'fade';
    if (!transitionLayer || !currentSceneId) { switchFn(); return; }
    transitionLayer.className = 'tour-transition-layer t-' + transition + ' active';
    await delay(250);
    switchFn();
    await delay(390);
    transitionLayer.className = 'tour-transition-layer';
  };

  const decorateUniversalHotspots = (panoConfig) => {
    Object.values(panoConfig.scenes || {}).forEach((scene) => {
      (scene.hotSpots || []).forEach((hotspot) => {
        const target = hotspot.tourTargetSceneId;
        if (!target) return;
        hotspot.type = 'info';
        delete hotspot.sceneId;
        hotspot.clickHandlerFunc = () => showScene(target, true, hotspot.tourTransition || config.defaultTransition || 'fade');
      });
    });
  };

  const preloadScene = (id) => {
    const meta = config.sceneMeta?.[id];
    if (!meta) return;
    if (meta.sceneType === 'panorama') {
      const p = config.scenes?.[id]?.panorama || config.scenes?.[id]?.multiRes?.equirectangularThumbnail;
      if (p) { const img = new Image(); img.src = p; }
    } else if (meta.sceneType === 'object360') {
      const frames = config.object360Scenes?.[id]?.frames || [];
      (frames[0] || []).slice(0,4).forEach((src) => { if (src) { const img=new Image(); img.src=src; } });
    } else if (meta.sceneType === 'stl') {
      const src = config.stlScenes?.[id]?.source;
      if (src) fetch(src).catch(()=>{});
    }
    (meta.mediaObjects || []).forEach((item) => {
      if (item.type === 'image' && item.src) { const img = new Image(); img.src = item.src; }
      if (item.type === 'gallery') (item.gallery || []).slice(0,2).forEach((entry)=>{ const img=new Image(); img.src=entry.src; });
      if (item.type === 'audio' && item.src) { const a = new Audio(); a.preload='metadata'; a.src=item.src; }
    });
    [meta.audio?.music?.src,meta.audio?.narration?.src].filter(Boolean).forEach((src)=>{ const a=new Audio(); a.preload='metadata'; a.src=src; });
  };

  const preloadNeighbors = (id) => {
    const targets = new Set();
    (config.scenes?.[id]?.hotSpots || []).forEach((h)=>{ if(h.tourTargetSceneId) targets.add(h.tourTargetSceneId); });
    (config.sceneMeta?.[id]?.screenHotspots || []).forEach((h)=>{ if(h.targetSceneId) targets.add(h.targetSceneId); });
    const gi = config.guide?.steps?.findIndex((step)=>step.sceneId===id);
    if (gi >= 0 && config.guide.steps[gi+1]) targets.add(config.guide.steps[gi+1].sceneId);
    [...targets].slice(0,4).forEach(preloadScene);
  };

  const showScene = async (id, pushHistory = true, transition = null) => {
    const meta = config.sceneMeta?.[id];
    if (!meta) return;
    if (id === currentSceneId && (panoViewer || objectViewer || stlViewer)) {
      updateMenu(id); updateBackButton(); renderOverlay(id); configureAudio(id); playAutoplayMedia(); return;
    }
    const previous = currentSceneId;
    if (pushHistory && previous && previous !== id) historyStack.push(previous);

    const switchScene = () => {
      currentSceneId = id;
      destroyViewer();
      updateMenu(id);
      updateBackButton();
      renderOverlay(id);
      configureAudio(id);
      playAutoplayMedia();

      if (meta.sceneType === 'object360') {
        const data = config.object360Scenes?.[id];
        if (!data || !window.Object360Viewer) { host.innerHTML='<div class="viewer-error">Object360 сцена недоступна</div>'; return; }
        objectViewer = new Object360Viewer(host,{...data,onFrameChange:(state)=>renderDynamicHotspots(id,state)});
        renderDynamicHotspots(id,objectViewer.getState());
        return;
      }
      if (meta.sceneType === 'stl') {
        const data = config.stlScenes?.[id];
        if (!data || !window.StlViewer) { host.innerHTML='<div class="viewer-error">STL сцена недоступна</div>'; return; }
        stlViewer = new StlViewer(host,{
          source:data.source,yaw:data.yaw,pitch:data.pitch,zoom:data.zoom,wireframe:data.wireframe,
          autoRotate:data.autoplay,color:data.color,backgroundMode:data.backgroundMode,backgroundImage:data.backgroundImage||'',
          onChange:(state)=>renderDynamicHotspots(id,state,stlViewer)
        });
        renderDynamicHotspots(id,stlViewer.getState(),stlViewer);
        stlViewer.ready.catch(()=>{host.innerHTML='<div class="viewer-error">Ошибка загрузки STL</div>';});
        return;
      }
      if (!window.pannellum) { host.innerHTML='<div class="viewer-error">Pannellum не загрузился</div>'; return; }
      const panoConfig = {...config,default:{...(config.default||{}),firstScene:id}};
      ['object360Scenes','stlScenes','sceneMeta','sceneOrder','tourFirstScene','projectAudio','startScreen','guide','exportSettings','defaultTransition','offlineAssets'].forEach((key)=>delete panoConfig[key]);
      decorateUniversalHotspots(panoConfig);
      panoViewer = pannellum.viewer('panorama',panoConfig);
      panoViewer.on('scenechange',(sceneId)=>{
        if (!sceneId || sceneId===currentSceneId) return;
        if (currentSceneId) historyStack.push(currentSceneId);
        currentSceneId = sceneId;
        updateMenu(sceneId); updateBackButton(); renderOverlay(sceneId); configureAudio(sceneId); playAutoplayMedia(); preloadNeighbors(sceneId);
      });
    };

    await applyTransition(transition || config.defaultTransition || 'fade', switchScene);
    preloadNeighbors(id);
  };

  const goBack = () => {
    const previous = historyStack.pop();
    updateBackButton();
    if (previous) showScene(previous,false,'fade');
  };

  const highlightGuideHotspot = (hotspotId) => {
    document.querySelectorAll('.guide-highlight').forEach((el)=>el.classList.remove('guide-highlight'));
    if (!hotspotId) return;
    const token = String(hotspotId).replace(/[^a-zA-Z0-9_-]/g,'');
    const el = document.querySelector('.tour-hotspot-' + token) ||
      document.querySelector('[data-screen-hotspot-id="' + CSS.escape(String(hotspotId)) + '"]');
    if (el) el.classList.add('guide-highlight');
  };

  const stopGuide = () => {
    clearTimeout(guideTimer);
    guideTimer = 0; guideRunning = false; guideIndex = -1;
    guideButton?.classList.remove('active');
    if (guideButton) guideButton.textContent = '▶ Гид';
  };

  const runGuideStep = async (index) => {
    const steps = config.guide?.steps || [];
    if (!guideRunning || !steps[index]) { stopGuide(); return; }
    guideIndex = index;
    const step = steps[index];
    await showScene(step.sceneId,false,index===0?'fade':config.defaultTransition||'fade');
    if (!guideRunning) return;
    await delay(180);
    highlightGuideHotspot(step.highlightHotspotId);
    if (step.narrationAuto && config.sceneMeta?.[step.sceneId]?.audio?.narration?.src) {
      await playNarration();
    }
    guideTimer = setTimeout(()=>runGuideStep(index+1),Math.max(2,Number(step.duration)||12)*1000);
  };

  const toggleGuide = () => {
    userInteracted = true;
    if (guideRunning) { stopGuide(); return; }
    if (!config.guide?.enabled || !config.guide?.steps?.length) return;
    guideRunning = true;
    guideButton?.classList.add('active');
    if (guideButton) guideButton.textContent = '■ Стоп';
    runGuideStep(0);
  };

  const enterTour = async (withSound) => {
    userInteracted = true;
    musicEnabled = Boolean(withSound);
    startScreen.hidden = true;
    if (config.exportSettings?.kioskMode) {
      try { await document.documentElement.requestFullscreen?.(); } catch (_) {}
    }
    if (withSound) {
      await tryPlayMusic();
      playAutoplayMedia();
    }
  };

  const setupStartScreen = () => {
    const s = config.startScreen || {};
    if (!s.enabled) { startScreen.hidden = true; return; }
    startTitle.textContent = s.title || config.sceneMeta?.[config.tourFirstScene]?.title || 'Виртуальная экскурсия';
    startSubtitle.textContent = s.subtitle || '';
    startSubtitle.hidden = !s.subtitle;
    if (s.coverData) startScreen.style.backgroundImage = 'url("' + String(s.coverData).replace(/"/g,'%22') + '")';
    startSilent.hidden = s.allowSilent === false;
    startScreen.hidden = false;
  };

  const start = () => {
    const order = config.sceneOrder || Object.keys(config.sceneMeta || {});
    if (config.exportSettings?.kioskMode) {
      document.body.classList.add('kiosk');
      try {
        history.pushState({kiosk:true},'',location.href);
        window.addEventListener('popstate',()=>history.go(1));
      } catch (_) {}
      document.addEventListener('contextmenu',(event)=>event.preventDefault());
    }

    if (menu) {
      menu.innerHTML = '';
      order.forEach((id)=>{
        const meta=config.sceneMeta?.[id]||{};
        const option=document.createElement('option');
        option.value=id;
        option.textContent=(meta.sceneType==='object360'?'◉ ':meta.sceneType==='stl'?'◆ ':'◌ ')+(meta.title||id);
        menu.appendChild(option);
      });
      menu.addEventListener('change',()=>showScene(menu.value,true,config.defaultTransition||'fade'));
    }

    backButton?.addEventListener('click',goBack);
    infoClose?.addEventListener('click',()=>{infoPanel.hidden=true;});
    fullscreenButton?.addEventListener('click',async()=>{
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (_) {}
    });
    musicButton?.addEventListener('click',async()=>{
      userInteracted=true; musicEnabled=!musicEnabled;
      if (!musicEnabled) { musicAudio?.pause(); musicButton.classList.remove('active'); }
      else await tryPlayMusic();
    });
    narrationButton?.addEventListener('click',async()=>{userInteracted=true;await playNarration();});
    guideButton.hidden = !(config.guide?.enabled && config.guide?.steps?.length);
    guideButton?.addEventListener('click',toggleGuide);
    startSound?.addEventListener('click',()=>enterTour(true));
    startSilent?.addEventListener('click',()=>enterTour(false));

    const unlockAudio=()=>{userInteracted=true;if(startScreen.hidden){tryPlayMusic();playAutoplayMedia();}};
    document.addEventListener('pointerdown',unlockAudio,{once:true,capture:true});
    document.addEventListener('keydown',unlockAudio,{once:true,capture:true});

    showScene(config.tourFirstScene||order[0],false,'fade');
    setupStartScreen();
    preloadNeighbors(config.tourFirstScene||order[0]);
  };

  window.showTourScene=(id)=>showScene(id,true,config.defaultTransition||'fade');
  window.tourBack=goBack;

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
`;
  }

  async function fetchRequiredAsset(url) {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status + ' для ' + url);
    return response;
  }

  function bundleWindowsLauncher(root) {
    const serverPs1 = [
      "param(",
      "    [int]$Port = 8080,",
      "    [switch]$NoBrowser",
      ")",
      "",
      "$ErrorActionPreference = 'Stop'",
      "",
      "$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))",
      "$Sep = [System.IO.Path]::DirectorySeparatorChar.ToString()",
      "$RootPrefix = $Root",
      "if (-not $RootPrefix.EndsWith($Sep)) {",
      "    $RootPrefix += $Sep",
      "}",
      "",
      "function Get-MimeType {",
      "    param([string]$Path)",
      "",
      "    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {",
      "        '.html' { return 'text/html; charset=utf-8' }",
      "        '.htm'  { return 'text/html; charset=utf-8' }",
      "        '.css'  { return 'text/css; charset=utf-8' }",
      "        '.js'   { return 'application/javascript; charset=utf-8' }",
      "        '.mjs'  { return 'application/javascript; charset=utf-8' }",
      "        '.json' { return 'application/json; charset=utf-8' }",
      "        '.txt'  { return 'text/plain; charset=utf-8' }",
      "        '.svg'  { return 'image/svg+xml' }",
      "        '.png'  { return 'image/png' }",
      "        '.jpg'  { return 'image/jpeg' }",
      "        '.jpeg' { return 'image/jpeg' }",
      "        '.webp' { return 'image/webp' }",
      "        '.gif'  { return 'image/gif' }",
      "        '.ico'  { return 'image/x-icon' }",
      "        '.woff' { return 'font/woff' }",
      "        '.woff2' { return 'font/woff2' }",
      "        '.ttf'  { return 'font/ttf' }",
      "        '.wasm' { return 'application/wasm' }",
      "        '.zip'  { return 'application/zip' }",
      "        '.stl'  { return 'model/stl' }",
      "        '.mp4'  { return 'video/mp4' }",
      "        '.webm' { return 'video/webm' }",
      "        '.pdf'  { return 'application/pdf' }",
      "        '.webmanifest' { return 'application/manifest+json; charset=utf-8' }",
      "        '.mp3'  { return 'audio/mpeg' }",
      "        '.ogg'  { return 'audio/ogg' }",
      "        '.wav'  { return 'audio/wav' }",
      "        default { return 'application/octet-stream' }",
      "    }",
      "}",
      "",
      "function Send-Headers {",
      "    param(",
      "        [System.IO.Stream]$Stream,",
      "        [string]$Status,",
      "        [hashtable]$Headers",
      "    )",
      "",
      "    $builder = New-Object System.Text.StringBuilder",
      "    [void]$builder.Append(\"HTTP/1.1 $Status\" + [char]13 + [char]10)",
      "",
      "    foreach ($key in $Headers.Keys) {",
      "        [void]$builder.Append($key + ': ' + $Headers[$key] + [char]13 + [char]10)",
      "    }",
      "",
      "    [void]$builder.Append([char]13 + [char]10)",
      "",
      "    $bytes = [System.Text.Encoding]::ASCII.GetBytes($builder.ToString())",
      "    $Stream.Write($bytes, 0, $bytes.Length)",
      "}",
      "",
      "function Send-TextResponse {",
      "    param(",
      "        [System.IO.Stream]$Stream,",
      "        [int]$Code,",
      "        [string]$Reason,",
      "        [string]$Text",
      "    )",
      "",
      "    $body = [System.Text.Encoding]::UTF8.GetBytes($Text)",
      "",
      "    Send-Headers -Stream $Stream -Status \"$Code $Reason\" -Headers @{",
      "        'Content-Type'   = 'text/html; charset=utf-8'",
      "        'Content-Length' = $body.Length",
      "        'Cache-Control'  = 'no-cache'",
      "        'Connection'     = 'close'",
      "    }",
      "",
      "    $Stream.Write($body, 0, $body.Length)",
      "}",
      "",
      "function Resolve-RequestPath {",
      "    param([string]$Target)",
      "",
      "    $pathOnly = ($Target -split '\\?', 2)[0]",
      "    $decoded = [System.Uri]::UnescapeDataString($pathOnly)",
      "    $relative = $decoded.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)",
      "",
      "    if ([string]::IsNullOrWhiteSpace($relative)) {",
      "        $relative = 'index.html'",
      "    }",
      "",
      "    $candidate = [System.IO.Path]::GetFullPath(",
      "        [System.IO.Path]::Combine($Root, $relative)",
      "    )",
      "",
      "    $insideRoot = (",
      "        $candidate.Equals($Root, [System.StringComparison]::OrdinalIgnoreCase) -or",
      "        $candidate.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase)",
      "    )",
      "",
      "    if (-not $insideRoot) {",
      "        return $null",
      "    }",
      "",
      "    if ([System.IO.Directory]::Exists($candidate)) {",
      "        $candidate = [System.IO.Path]::Combine($candidate, 'index.html')",
      "    }",
      "",
      "    return $candidate",
      "}",
      "",
      "$listener = $null",
      "$actualPort = $Port",
      "",
      "for ($tryPort = $Port; $tryPort -le ($Port + 20); $tryPort++) {",
      "    $candidateListener = $null",
      "",
      "    try {",
      "        $candidateListener = [System.Net.Sockets.TcpListener]::new(",
      "            [System.Net.IPAddress]::Loopback,",
      "            $tryPort",
      "        )",
      "        $candidateListener.Start()",
      "",
      "        $listener = $candidateListener",
      "        $actualPort = $tryPort",
      "        break",
      "    }",
      "    catch {",
      "        if ($candidateListener) {",
      "            try { $candidateListener.Stop() } catch {}",
      "        }",
      "    }",
      "}",
      "",
      "if (-not $listener) {",
      "    Write-Host ''",
      "    Write-Host \"Unable to open ports $Port-$($Port + 20).\" -ForegroundColor Red",
      "    Write-Host 'Close another local server or run:' -ForegroundColor Yellow",
      "    Write-Host '.\\server.ps1 -Port 9000'",
      "    exit 1",
      "}",
      "",
      "$url = \"http://127.0.0.1:$actualPort/\"",
      "",
      "Write-Host ''",
      "Write-Host '=============================================' -ForegroundColor DarkCyan",
      "Write-Host '  Pannellum Tour - Local Windows Server' -ForegroundColor Cyan",
      "Write-Host '=============================================' -ForegroundColor DarkCyan",
      "Write-Host ''",
      "Write-Host \"Folder: $Root\"",
      "Write-Host \"URL:    $url\" -ForegroundColor Green",
      "",
      "if ($actualPort -ne $Port) {",
      "    Write-Host \"Port $Port is busy. Using port $actualPort.\" -ForegroundColor Yellow",
      "}",
      "",
      "Write-Host ''",
      "Write-Host 'Press Ctrl+C to stop the server.' -ForegroundColor DarkGray",
      "Write-Host ''",
      "",
      "if (-not $NoBrowser) {",
      "    try {",
      "        Start-Process $url",
      "    }",
      "    catch {",
      "        Write-Host \"Open this URL manually: $url\" -ForegroundColor Yellow",
      "    }",
      "}",
      "",
      "try {",
      "    while ($true) {",
      "        $client = $listener.AcceptTcpClient()",
      "        $client.NoDelay = $true",
      "",
      "        $stream = $null",
      "        $reader = $null",
      "        $fileStream = $null",
      "",
      "        try {",
      "            $stream = $client.GetStream()",
      "",
      "            $reader = [System.IO.StreamReader]::new(",
      "                $stream,",
      "                [System.Text.Encoding]::ASCII,",
      "                $false,",
      "                8192,",
      "                $true",
      "            )",
      "",
      "            $requestLine = $reader.ReadLine()",
      "",
      "            if ([string]::IsNullOrWhiteSpace($requestLine)) {",
      "                continue",
      "            }",
      "",
      "            $parts = $requestLine.Split(' ')",
      "",
      "            if ($parts.Length -lt 2) {",
      "                Send-TextResponse -Stream $stream -Code 400 -Reason 'Bad Request' -Text '<h1>400 Bad Request</h1>'",
      "                continue",
      "            }",
      "",
      "            $method = $parts[0].ToUpperInvariant()",
      "            $target = $parts[1]",
      "",
      "            $headers = @{}",
      "",
      "            while ($true) {",
      "                $line = $reader.ReadLine()",
      "",
      "                if ([string]::IsNullOrEmpty($line)) {",
      "                    break",
      "                }",
      "",
      "                $separator = $line.IndexOf(':')",
      "",
      "                if ($separator -gt 0) {",
      "                    $name = $line.Substring(0, $separator).Trim().ToLowerInvariant()",
      "                    $value = $line.Substring($separator + 1).Trim()",
      "                    $headers[$name] = $value",
      "                }",
      "            }",
      "",
      "            if ($method -ne 'GET' -and $method -ne 'HEAD') {",
      "                Send-Headers -Stream $stream -Status '405 Method Not Allowed' -Headers @{",
      "                    'Allow'          = 'GET, HEAD'",
      "                    'Content-Length' = 0",
      "                    'Connection'     = 'close'",
      "                }",
      "                continue",
      "            }",
      "",
      "            try {",
      "                $filePath = Resolve-RequestPath -Target $target",
      "            }",
      "            catch {",
      "                $filePath = $null",
      "            }",
      "",
      "            if (-not $filePath) {",
      "                Send-TextResponse -Stream $stream -Code 403 -Reason 'Forbidden' -Text '<h1>403 Forbidden</h1>'",
      "                continue",
      "            }",
      "",
      "            if (-not [System.IO.File]::Exists($filePath)) {",
      "                Send-TextResponse -Stream $stream -Code 404 -Reason 'Not Found' -Text '<h1>404 Not Found</h1>'",
      "                continue",
      "            }",
      "",
      "            $fileInfo = [System.IO.FileInfo]::new($filePath)",
      "            $totalLength = [int64]$fileInfo.Length",
      "            $start = [int64]0",
      "            $end = [int64]($totalLength - 1)",
      "            $status = '200 OK'",
      "            $contentLength = $totalLength",
      "",
      "            $responseHeaders = @{",
      "                'Content-Type'  = Get-MimeType -Path $filePath",
      "                'Accept-Ranges' = 'bytes'",
      "                'Cache-Control' = 'no-cache'",
      "                'Connection'    = 'close'",
      "            }",
      "",
      "            if (",
      "                $headers.ContainsKey('range') -and",
      "                $headers['range'] -match '^bytes=(\\d*)-(\\d*)$'",
      "            ) {",
      "                $startText = $Matches[1]",
      "                $endText = $Matches[2]",
      "",
      "                if ($startText -ne '') {",
      "                    $start = [int64]$startText",
      "                }",
      "                elseif ($endText -ne '') {",
      "                    $suffixLength = [int64]$endText",
      "                    $start = [Math]::Max([int64]0, $totalLength - $suffixLength)",
      "                }",
      "",
      "                if ($endText -ne '' -and $startText -ne '') {",
      "                    $end = [Math]::Min([int64]$endText, $totalLength - 1)",
      "                }",
      "",
      "                if ($start -ge $totalLength -or $start -gt $end) {",
      "                    Send-Headers -Stream $stream -Status '416 Range Not Satisfiable' -Headers @{",
      "                        'Content-Range'  = \"bytes */$totalLength\"",
      "                        'Content-Length' = 0",
      "                        'Connection'     = 'close'",
      "                    }",
      "                    continue",
      "                }",
      "",
      "                $contentLength = $end - $start + 1",
      "                $status = '206 Partial Content'",
      "                $responseHeaders['Content-Range'] = \"bytes $start-$end/$totalLength\"",
      "            }",
      "",
      "            $responseHeaders['Content-Length'] = $contentLength",
      "            Send-Headers -Stream $stream -Status $status -Headers $responseHeaders",
      "",
      "            if ($method -eq 'HEAD' -or $contentLength -le 0) {",
      "                continue",
      "            }",
      "",
      "            $fileStream = [System.IO.File]::Open(",
      "                $filePath,",
      "                [System.IO.FileMode]::Open,",
      "                [System.IO.FileAccess]::Read,",
      "                [System.IO.FileShare]::ReadWrite",
      "            )",
      "",
      "            if ($start -gt 0) {",
      "                [void]$fileStream.Seek($start, [System.IO.SeekOrigin]::Begin)",
      "            }",
      "",
      "            $buffer = New-Object byte[] 65536",
      "            $remaining = [int64]$contentLength",
      "",
      "            while ($remaining -gt 0) {",
      "                $toRead = [int][Math]::Min([int64]$buffer.Length, $remaining)",
      "                $read = $fileStream.Read($buffer, 0, $toRead)",
      "",
      "                if ($read -le 0) {",
      "                    break",
      "                }",
      "",
      "                $stream.Write($buffer, 0, $read)",
      "                $remaining -= $read",
      "            }",
      "        }",
      "        catch {",
      "            Write-Host (\"Request error: \" + $_.Exception.Message) -ForegroundColor DarkYellow",
      "        }",
      "        finally {",
      "            if ($fileStream) { $fileStream.Dispose() }",
      "            if ($reader) { $reader.Dispose() }",
      "            if ($stream) { $stream.Dispose() }",
      "            if ($client) { $client.Close() }",
      "        }",
      "    }",
      "}",
      "finally {",
      "    if ($listener) {",
      "        $listener.Stop()",
      "    }",
      "}",
      ""
    ].join('\r\n');
    const startBat = [
      "@echo off",
      "setlocal",
      "chcp 65001 >nul",
      "title Pannellum Tour Editor - Local Server",
      "",
      "set \"PORT=8080\"",
      "if not \"%~1\"==\"\" set \"PORT=%~1\"",
      "",
      "cd /d \"%~dp0\"",
      "",
      "echo.",
      "echo Starting Pannellum Tour Editor...",
      "echo.",
      "",
      "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File \"%~dp0server.ps1\" -Port %PORT%",
      "",
      "echo.",
      "echo Server stopped.",
      "pause",
      ""
    ].join('\r\n');

    root.file('server.ps1', serverPs1);
    root.file('start-server.bat', startBat);
  }
  async function bundlePannellum(zip) {
    const base = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.7/';
    const cssUrl = base + 'build/pannellum.css';
    const jsUrl = base + 'build/pannellum.js';
    const responses = await Promise.all([fetchRequiredAsset(cssUrl), fetchRequiredAsset(jsUrl)]);
    const cssText = await responses[0].text();
    const jsBuffer = await responses[1].arrayBuffer();

    zip.file('vendor/pannellum/build/pannellum.css', cssText);
    zip.file('vendor/pannellum/build/pannellum.js', jsBuffer);

    const refs = [...cssText.matchAll(/url\((['"]?)(?!data:|https?:|#)([^'")]+)\1\)/g)]
      .map((match) => match[2].trim())
      .filter(Boolean);
    const uniqueRefs = [...new Set(refs)];

    await Promise.all(uniqueRefs.map(async (relativeRef) => {
      const sourceUrl = new URL(relativeRef, cssUrl).href;
      const targetPath = normalizeZipPath('vendor/pannellum/build/' + relativeRef);
      const response = await fetchRequiredAsset(sourceUrl);
      zip.file(targetPath, await response.arrayBuffer());
    }));
  }

  async function optimizeImageDataUrl(dataUrl, maxWidth, quality = 84, preserveAlpha = false) {
    if (!dataUrl || !/^data:image\//i.test(dataUrl)) return dataUrl;
    if (!normalizeExportSettings(project.exportSettings || {}).optimizeEnabled) return dataUrl;

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось прочитать изображение для оптимизации'));
      img.src = dataUrl;
    });

    const targetWidth = Math.min(image.naturalWidth || image.width, Math.max(320, Number(maxWidth) || 8192));
    const ratio = targetWidth / Math.max(1, image.naturalWidth || image.width);
    const targetHeight = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
    if (ratio >= 0.999 && /image\/jpe?g/i.test(dataUrl) && quality >= 92) return dataUrl;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha:preserveAlpha });
    if (!preserveAlpha) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0,targetWidth,targetHeight);
    }
    ctx.drawImage(image,0,0,targetWidth,targetHeight);
    return canvas.toDataURL(
      preserveAlpha ? 'image/webp' : 'image/jpeg',
      clampNumber(quality,45,100,84) / 100
    );
  }

  function exportedManifest() {
    const title = project.title || 'Виртуальная экскурсия';
    return JSON.stringify({
      name:title,
      short_name:title.slice(0,32),
      start_url:'./',
      display:'standalone',
      background_color:'#05070c',
      theme_color:'#05070c',
      orientation:'any',
      icons:[
        {src:'icons/app-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}
      ]
    },null,2);
  }

  function exportedAppIconSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7c8cff"/><stop offset="1" stop-color="#20d6bb"/></linearGradient></defs>' +
      '<rect width="512" height="512" rx="110" fill="#05070c"/><circle cx="256" cy="256" r="166" fill="none" stroke="url(#g)" stroke-width="28"/>' +
      '<path d="M145 256h222M256 145c68 58 68 164 0 222M256 145c-68 58-68 164 0 222" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>' +
      '</svg>';
  }

  function exportedServiceWorker(config) {
    const assets = new Set([
      './','index.html','assets/tour.css','assets/tour.js','assets/object360.js','assets/stl-viewer.js',
      'vendor/pannellum/build/pannellum.js','vendor/pannellum/build/pannellum.css','manifest.webmanifest','icons/app-icon.svg'
    ]);

    Object.values(config.scenes || {}).forEach((scene) => {
      if (scene.panorama) assets.add(scene.panorama);
      if (scene.multiRes?.equirectangularThumbnail) assets.add(scene.multiRes.equirectangularThumbnail);
    });
    Object.values(config.object360Scenes || {}).forEach((scene) => {
      (scene.frames || []).forEach((row) => (row || []).forEach((src) => { if (src) assets.add(src); }));
    });
    Object.values(config.stlScenes || {}).forEach((scene) => {
      if (scene.source) assets.add(scene.source);
      if (scene.backgroundImage) assets.add(scene.backgroundImage);
    });
    Object.values(config.sceneMeta || {}).forEach((meta) => {
      (meta.mediaObjects || []).forEach((item) => {
        if (item.src) assets.add(item.src);
        (item.gallery || []).forEach((entry) => { if (entry.src) assets.add(entry.src); });
      });
      if (meta.audio?.music?.src) assets.add(meta.audio.music.src);
      if (meta.audio?.narration?.src) assets.add(meta.audio.narration.src);
    });
    if (config.projectAudio?.music?.src) assets.add(config.projectAudio.music.src);
    if (config.startScreen?.coverData) assets.add(config.startScreen.coverData);
    (config.offlineAssets || []).forEach((src) => { if (src) assets.add(src); });

    const list = JSON.stringify([...assets]);
    return "const CACHE='pannellum-tour-v7';\n" +
      "const CORE=" + list + ";\n" +
      "self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(async c=>{for(const u of CORE){try{await c.add(u)}catch(_){}}}).then(()=>self.skipWaiting())));\n" +
      "self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\n" +
      "self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>new Response('Offline',{status:503}))));});\n";
  }

  function qrDataUrlForUrl(url) {
    if (!url || !window.QRCode) return '';
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:256px;height:256px';
    document.body.appendChild(host);
    try {
      new QRCode(host,{text:url,width:256,height:256,colorDark:'#06101f',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
      return host.querySelector('canvas')?.toDataURL?.('image/png') || host.querySelector('img')?.src || '';
    } finally {
      host.remove();
    }
  }

  async function exportTourPackage() {
    if (!project.scenes.length) {
      showToast('Сначала добавьте хотя бы одну сцену');
      return;
    }
    if (!window.JSZip) {
      showToast('JSZip не загрузился. Проверьте подключение к интернету.');
      return;
    }

    const button = els.btnExportTour;
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Упаковка…';

    try {
      const zip = new JSZip();
      const rootName = safeFilename(project.title, 'tour');
      const root = zip.folder(rootName);
      const sceneFiles = new Map();
      const usedNames = new Set();

      const multiresScenes = new Map();
      const objectSceneFiles = new Map();
      const stlSceneFiles = new Map();
      const panoramaScenes = project.scenes.filter((scene) => scene.sceneType === 'panorama');
      const objectScenes = project.scenes.filter((scene) => scene.sceneType === 'object360');
      const stlScenes = project.scenes.filter((scene) => scene.sceneType === 'stl');

      if (project.settings.multiresEnabled) {
        for (let index = 0; index < panoramaScenes.length; index++) {
          const scene = panoramaScenes[index];
          const multi = await generateSceneMultires(
            root,
            scene,
            index,
            panoramaScenes.length,
            button
          );
          multiresScenes.set(scene.id, multi);
        }
      } else {
        for (let index = 0; index < panoramaScenes.length; index++) {
          const scene = panoramaScenes[index];
          const settings = normalizeExportSettings(project.exportSettings || {});
          const optimized = await optimizeImageDataUrl(scene.imageData, settings.maxImageWidth, settings.jpegQuality);
          const ext = settings.optimizeEnabled ? 'jpg' : extensionForScene(scene);
          const baseName = safeFilename(scene.title || scene.id, 'panorama-' + (index + 1));
          let filename = baseName + '.' + ext;
          let suffix = 2;
          while (usedNames.has(filename.toLowerCase())) filename = baseName + '-' + suffix++ + '.' + ext;
          usedNames.add(filename.toLowerCase());
          sceneFiles.set(scene.id, filename);

          const payload = dataUrlPayload(optimized);
          if (payload.base64) root.file('images/' + filename, payload.data, { base64: true });
          else root.file('images/' + filename, decodeURIComponent(payload.data));
        }
      }

      for (let sceneIndex = 0; sceneIndex < objectScenes.length; sceneIndex++) {
        const scene = objectScenes[sceneIndex];
        const data = normalizeObject360Data(scene.object360 || {});
        const sceneDir = safeFilename(scene.id || scene.title, 'object-' + (sceneIndex + 1));
        const paths = Array.from({ length: data.rows }, () => Array(data.sectors).fill(''));

        for (let row = 0; row < data.rows; row++) {
          for (let sector = 0; sector < data.sectors; sector++) {
            const frame = data.frames[row]?.[sector] || '';
            if (!frame) continue;
            const settings = normalizeExportSettings(project.exportSettings || {});
            const optimizedFrame = await optimizeImageDataUrl(frame, settings.objectFrameWidth, settings.jpegQuality);
            const payload = dataUrlPayload(optimizedFrame);
            const mime = String(payload.mime || '').toLowerCase();
            const ext = settings.optimizeEnabled ? 'jpg' : (mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg');
            const filename = 'frame_' + String(sector).padStart(3, '0') + '.' + ext;
            const path = 'object360/' + sceneDir + '/row_' + (row + 1) + '/' + filename;
            if (payload.base64) root.file(path, payload.data, { base64: true });
            else root.file(path, decodeURIComponent(payload.data));
            paths[row][sector] = path;
          }
        }

        objectSceneFiles.set(scene.id, {
          sectors: data.sectors,
          rows: data.rows,
          frames: paths,
          startSector: data.startSector,
          startRow: data.startRow,
          autoplay: data.autoplay,
          captureMode: data.captureMode
        });
      }

      for (let sceneIndex = 0; sceneIndex < stlScenes.length; sceneIndex++) {
        const scene = stlScenes[sceneIndex];
        const data = normalizeStlData(scene.stl || {});
        if (!data.data) throw new Error('STL данные отсутствуют: ' + scene.title);

        const payload = dataUrlPayload(data.data);
        const baseName = safeFilename(scene.title || scene.id, 'model-' + (sceneIndex + 1));
        let filename = baseName + '.stl';
        let suffix = 2;
        while (usedNames.has(filename.toLowerCase())) {
          filename = baseName + '-' + suffix++ + '.stl';
        }
        usedNames.add(filename.toLowerCase());

        const modelPath = 'models/' + filename;
        if (payload.base64) root.file(modelPath, payload.data, { base64: true });
        else root.file(modelPath, decodeURIComponent(payload.data));

        let backgroundImage = '';
        let backgroundMode = data.backgroundMode || 'hitech';

        if (backgroundMode === 'image' && data.backgroundImageData) {
          const settings = normalizeExportSettings(project.exportSettings || {});
          const bgData = settings.optimizeEnabled
            ? await optimizeImageDataUrl(
                data.backgroundImageData,
                Math.min(settings.maxImageWidth, 4096),
                settings.jpegQuality,
                /^data:image\/(png|webp)/i.test(data.backgroundImageData)
              )
            : data.backgroundImageData;
          const bgPayload = dataUrlPayload(bgData);
          const bgMime = String(bgPayload.mime || '').toLowerCase();
          const bgExt = bgMime.includes('png') ? 'png' : bgMime.includes('webp') ? 'webp' : 'jpg';
          const bgName = 'stl-bg-' + safeFilename(scene.id || scene.title, 'scene-' + (sceneIndex + 1)) + '.' + bgExt;
          backgroundImage = 'backgrounds/' + bgName;
          if (bgPayload.base64) root.file(backgroundImage, bgPayload.data, { base64: true });
          else root.file(backgroundImage, decodeURIComponent(bgPayload.data));
        } else if (backgroundMode === 'panorama' && data.backgroundSceneId) {
          const bgScene = getScene(data.backgroundSceneId);
          if (bgScene?.sceneType === 'panorama' && bgScene.imageData) {
            const settings = normalizeExportSettings(project.exportSettings || {});
            const bgData = settings.optimizeEnabled
              ? await optimizeImageDataUrl(bgScene.imageData, settings.maxImageWidth, settings.jpegQuality, false)
              : bgScene.imageData;
            const bgPayload = dataUrlPayload(bgData);
            const bgMime = String(bgPayload.mime || '').toLowerCase();
            const bgExt = bgMime.includes('png') ? 'png' : bgMime.includes('webp') ? 'webp' : 'jpg';
            const bgName = 'stl-panorama-' + safeFilename(scene.id || scene.title, 'scene-' + (sceneIndex + 1)) + '.' + bgExt;
            backgroundImage = 'backgrounds/' + bgName;
            if (bgPayload.base64) root.file(backgroundImage, bgPayload.data, { base64: true });
            else root.file(backgroundImage, decodeURIComponent(bgPayload.data));
          } else {
            backgroundMode = 'hitech';
          }
        }

        stlSceneFiles.set(scene.id, {
          source: modelPath,
          yaw: data.yaw,
          pitch: data.pitch,
          zoom: data.zoom,
          wireframe: data.wireframe,
          autoplay: data.autoplay,
          color: data.color,
          triangleCount: data.triangleCount,
          backgroundMode,
          backgroundImage
        });
      }

      const audioConfig = {
        projectMusic: bundleAudioSlot(
          root,
          project.audio?.music,
          'project-music'
        ),
        scenes: {}
      };

      project.scenes.forEach((scene, index) => {
        const audio = normalizeSceneAudio(scene.audio || {});
        audioConfig.scenes[scene.id] = {
          music: bundleAudioSlot(root, audio.music, 'scene-' + safeFilename(scene.id || String(index + 1), 'scene') + '-music'),
          narration: bundleAudioSlot(root, audio.narration, 'scene-' + safeFilename(scene.id || String(index + 1), 'scene') + '-narration')
        };
      });

      const mediaConfig = await bundleMediaObjects(root);

      if (project.startScreen?.coverData) {
        const settings = normalizeExportSettings(project.exportSettings || {});
        const coverData = settings.optimizeEnabled
          ? await optimizeImageDataUrl(project.startScreen.coverData, Math.min(settings.maxImageWidth, 2560), settings.jpegQuality, false)
          : project.startScreen.coverData;
        const coverExt = extensionForDataUrl(coverData, '.jpg');
        bundleDataUrlFile(root, coverData, 'images/start-cover' + coverExt);
        project.startScreen.__exportCoverExt = coverExt;
      }

      const config = buildPortableTourConfig(
        sceneFiles,
        multiresScenes,
        objectSceneFiles,
        stlSceneFiles,
        audioConfig,
        mediaConfig
      );
      if (project.startScreen && '__exportCoverExt' in project.startScreen) delete project.startScreen.__exportCoverExt;
      const customIconFiles = await bundleTransitionIcons(root);
      root.file('index.html', exportedViewerHtml());
      root.file('assets/tour.css', exportedViewerCss(customIconFiles));
      root.file('assets/tour.js', exportedViewerJs(config));
      const objectViewerAsset = await fetchRequiredAsset('assets/object360.js');
      root.file('assets/object360.js', await objectViewerAsset.text());
      const stlViewerAsset = await fetchRequiredAsset('assets/stl-viewer.js');
      root.file('assets/stl-viewer.js', await stlViewerAsset.text());
      root.file('tour.json', JSON.stringify(config, null, 2));
      if (config.exportSettings?.pwaEnabled) {
        root.file('manifest.webmanifest', exportedManifest());
        root.file('sw.js', exportedServiceWorker(config));
        root.file('icons/app-icon.svg', exportedAppIconSvg());
      }
      if (config.exportSettings?.publicUrl) {
        const qrData = qrDataUrlForUrl(config.exportSettings.publicUrl);
        if (qrData) {
          const qrPayload = dataUrlPayload(qrData);
          root.file('qr-tour.png', qrPayload.data, { base64:true });
        }
      }
      root.file('README.txt',
        'Готовый виртуальный тур: ' + (project.title || 'Виртуальная экскурсия') + '\n\n' +
        'Содержимое:\n' +
        '- index.html — страница просмотра\n' +
        '- assets/tour.js — конфигурация и запуск тура\n' +
        '- assets/tour.css — оформление страницы\n' +
        '- images/ — исходные панорамы при обычном экспорте\n' +
        '- object360/ — кадры сцен «Объект 360°»\n' +
        '- models/ — STL-модели 3D-сцен\n' +
        '- backgrounds/ — картинки и панорамы фона STL-сцен\n' +
        '- audio/ — музыка тура, музыка сцен и озвучка\n' +
        '- media/ — фото, видео, PDF и галереи\n' +
        '- manifest.webmanifest / sw.js — PWA (если включено)\n' +
        '- qr-tour.png — QR публичной ссылки (если указан URL)\n' +
        '- multires/ — тайлы панорам при включённом Multiresolution ZIP\n' +
        '- images/icons/ — иконки и авто-превью переходов\n' +
        '- vendor/pannellum/ — локальная копия Pannellum\n' +
        '- start-server.bat — запуск тура в Windows двойным кликом\n' +
        '- server.ps1 — встроенный локальный HTTP-сервер\n' +
        '- tour.json — конфигурация тура\n\n' +
        'Windows:\n1. Распакуйте папку целиком.\n2. Дважды щёлкните start-server.bat.\n3. Тур автоматически откроется в браузере.\n\n' +
        'Для сайта:\n1. Распакуйте папку целиком.\n2. Загрузите её на HTTP/HTTPS-сервер.\n3. Откройте index.html.\n\n' +
        'Интернет для просмотра экспортированного тура не требуется.\n'
      );

      button.textContent = 'Windows-сервер…';
      await bundleWindowsLauncher(root);

      button.textContent = 'Pannellum…';
      await bundlePannellum(root);

      button.textContent = 'Создание ZIP…';
      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => { button.textContent = 'ZIP ' + Math.round(meta.percent) + '%'; }
      );
      showZipDownloadDialog(blob, rootName + '.zip');
      showToast('ZIP готов — нажмите «Скачать ZIP»', 3600);
    } catch (error) {
      console.error(error);
      showToast('Не удалось собрать ZIP: ' + error.message, 5200);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  async function importProjectFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = normalizeProject(parsed);
      if (!imported.scenes.length) {
        throw new Error('В проекте нет сцен');
      }
      if (imported.scenes.some((scene) => {
        if (scene.sceneType === 'object360') return !countObjectFrames(scene.object360);
        if (scene.sceneType === 'stl') return !scene.stl?.data;
        return !scene.imageData;
      })) {
        throw new Error('В импортируемом проекте отсутствуют встроенные изображения / Object360 кадры / STL данные');
      }

      project = imported;
      currentSceneId = project.firstScene || project.scenes[0].id;
      resetHistory();
      await persistProject();
      renderAll();
      showToast('Проект импортирован');
    } catch (error) {
      console.error(error);
      showToast('Не удалось импортировать проект: ' + error.message, 4200);
    } finally {
      els.projectImport.value = '';
    }
  }

  function destroyPreviewViewers() {
    stopPreviewAudio();
    if (els.previewSceneOverlay) {
      els.previewSceneOverlay.innerHTML = '';
      els.previewSceneOverlay.hidden = true;
    }
    if (previewViewer) {
      try { previewViewer.destroy(); } catch (_) {}
      previewViewer = null;
    }
    if (previewObjectViewer) {
      try { previewObjectViewer.destroy(); } catch (_) {}
      previewObjectViewer = null;
    }
    if (previewStlViewer) {
      try { previewStlViewer.destroy(); } catch (_) {}
      previewStlViewer = null;
    }
    if (previewXrViewer) {
      try { previewXrViewer.destroy(); } catch (_) {}
      previewXrViewer = null;
    }
    els.previewPanorama.innerHTML = '';
    previewSceneId = null;
  }

  function renderPreviewScene(sceneId) {
    const scene = getScene(sceneId);
    if (!scene) return;
    previewSceneId = scene.id;

    destroyPreviewViewers();
    previewSceneId = scene.id;
    renderCompositeOverlay(scene, els.previewSceneOverlay, null, { editor: false });
    configurePreviewAudio(scene);

    if (scene.sceneType === 'object360') {
      if (!window.Object360Viewer) return;
      const data = normalizeObject360Data(scene.object360 || {});
      previewObjectViewer = new Object360Viewer(els.previewPanorama, {
        sectors: data.sectors,
        rows: data.rows,
        frames: data.frames,
        startSector: data.startSector,
        startRow: data.startRow,
        autoplay: data.autoplay,
        backgroundMode: data.backgroundMode,
        backgroundColor: data.backgroundColor,
        backgroundImage: data.backgroundImageData,
        onFrameChange: (state) => renderDynamicScreenHotspots(scene, els.previewSceneOverlay, state, { editor:false })
      });
      renderDynamicScreenHotspots(scene, els.previewSceneOverlay, previewObjectViewer.getState(), { editor:false });
      return;
    }

    if (scene.sceneType === 'stl') {
      if (!window.StlViewer) return;
      const data = normalizeStlData(scene.stl || {});
      previewStlViewer = new StlViewer(els.previewPanorama, {
        source: data.data,
        yaw: data.yaw,
        pitch: data.pitch,
        zoom: data.zoom,
        wireframe: data.wireframe,
        autoRotate: data.autoplay,
        color: data.color,
        backgroundMode: data.backgroundMode,
        backgroundImage: stlBackgroundImageForData(data),
        onChange: (state) => renderDynamicScreenHotspots(scene, els.previewSceneOverlay, state, { editor:false, projector:previewStlViewer })
      });
      renderDynamicScreenHotspots(scene, els.previewSceneOverlay, previewStlViewer.getState(), { editor:false, projector:previewStlViewer });
      previewStlViewer.ready.catch(console.error);
      return;
    }

    if (scene.sceneType === 'xr') {
      if (!window.XRMediaViewer) return;
      const data = normalizeXrData(scene.xr || {});
      previewXrViewer = new XRMediaViewer(els.previewPanorama, {
        source: data.data,
        kind: data.kind,
        projection: data.projection,
        yaw: data.yaw,
        pitch: data.pitch,
        fov: data.fov,
        autoplay: data.autoplay,
        loop: data.loop,
        muted: false,
        volume: data.volume,
        onChange: (state) => renderDynamicScreenHotspots(scene, els.previewSceneOverlay, state, { editor:false })
      });
      previewXrViewer.ready.catch(console.error);
      renderDynamicScreenHotspots(scene, els.previewSceneOverlay, previewXrViewer.getState(), { editor:false });
      return;
    }

    if (!window.pannellum) return;
    previewViewer = pannellum.viewer('previewPanorama', buildPannellumConfig({
      useEmbeddedImages: true,
      firstSceneId: scene.id,
      universalSceneHandler: renderPreviewScene
    }));
    previewViewer.on('scenechange', (nextSceneId) => {
      const nextScene = getScene(nextSceneId);
      if (!nextScene) return;
      previewSceneId = nextScene.id;
      renderCompositeOverlay(nextScene, els.previewSceneOverlay, null, { editor: false });
      configurePreviewAudio(nextScene);
    });
  }

  function renderSceneGraph() {
    const scenes = project.scenes;
    if (!scenes.length) {
      els.sceneGraph.innerHTML = '<div class="empty-state tall">Нет сцен</div>';
      els.graphSummary.textContent = '0 сцен';
      return;
    }

    const width = Math.max(900, scenes.length * 190);
    const columns = Math.max(2, Math.ceil(Math.sqrt(scenes.length)));
    const nodeW = 150;
    const nodeH = 74;
    const gapX = 185;
    const gapY = 135;
    const positions = new Map();
    scenes.forEach((scene, index) => {
      positions.set(scene.id, {
        x: 45 + (index % columns) * gapX,
        y: 45 + Math.floor(index / columns) * gapY
      });
    });
    const height = 110 + Math.ceil(scenes.length / columns) * gapY;

    const edges = [];
    let missing = 0;
    scenes.forEach((scene) => {
      (scene.hotspots || []).forEach((hotspot) => {
        if (hotspot.type !== 'scene') return;
        if (!positions.has(hotspot.targetSceneId)) {
          missing++;
          return;
        }
        edges.push({ from: scene.id, to: hotspot.targetSceneId });
      });
      (scene.mediaObjects || []).forEach((item) => {
        if (item.type === 'button' && item.targetSceneId && positions.has(item.targetSceneId)) {
          edges.push({ from: scene.id, to: item.targetSceneId });
        }
      });
    });

    const svgLines = edges.map((edge) => {
      const a = positions.get(edge.from);
      const b = positions.get(edge.to);
      return '<path d="M ' + (a.x + nodeW) + ' ' + (a.y + nodeH/2) +
        ' C ' + (a.x + nodeW + 45) + ' ' + (a.y + nodeH/2) + ', ' +
        (b.x - 45) + ' ' + (b.y + nodeH/2) + ', ' +
        b.x + ' ' + (b.y + nodeH/2) + '" marker-end="url(#graphArrow)"/>';
    }).join('');

    const nodes = scenes.map((scene) => {
      const p = positions.get(scene.id);
      const meta = sceneTypeMeta(scene);
      const outgoing = (scene.hotspots || []).filter((h) => h.type === 'scene').length;
      return '<button class="graph-node ' + (scene.id === project.firstScene ? 'is-start' : '') +
        '" data-graph-scene="' + escapeHtml(scene.id) + '" style="left:' + p.x + 'px;top:' + p.y + 'px">' +
        '<span>' + meta.icon + ' ' + escapeHtml(meta.label) + '</span>' +
        '<b>' + escapeHtml(scene.title) + '</b>' +
        '<small>' + outgoing + ' переходов' + (scene.id === project.firstScene ? ' · старт' : '') + '</small>' +
        '</button>';
    }).join('');

    els.sceneGraph.innerHTML =
      '<div class="graph-canvas" style="width:' + width + 'px;height:' + height + 'px">' +
      '<svg class="graph-links" width="' + width + '" height="' + height + '">' +
      '<defs><marker id="graphArrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z"/></marker></defs>' +
      svgLines + '</svg>' + nodes + '</div>';

    const incoming = new Set(edges.map((edge) => edge.to));
    const unreachable = scenes.filter((scene) => scene.id !== project.firstScene && !incoming.has(scene.id)).length;
    els.graphSummary.textContent = scenes.length + ' сцен · ' + edges.length + ' связей · ' +
      unreachable + ' без входящих переходов' + (missing ? ' · ' + missing + ' битых ссылок' : '');
  }

  function openSceneGraph() {
    renderSceneGraph();
    els.sceneGraphDialog.showModal();
  }

  function renderGuideEditor() {
    project.guide = normalizeGuide(project.guide || {}, project.scenes);
    els.guideEnabled.checked = project.guide.enabled;

    if (!project.guide.steps.length) {
      els.guideStepList.innerHTML = '<div class="empty-state">Добавьте первый шаг маршрута</div>';
      return;
    }

    els.guideStepList.innerHTML = project.guide.steps.map((step, index) => {
      const options = project.scenes.map((scene) =>
        '<option value="' + escapeHtml(scene.id) + '"' + (scene.id === step.sceneId ? ' selected' : '') + '>' +
        sceneTypeMeta(scene).icon + ' ' + escapeHtml(scene.title) + '</option>'
      ).join('');
      const guideScene = getScene(step.sceneId);
      const hotspotOptions = '<option value="">— без подсветки —</option>' +
        (guideScene?.hotspots || []).map((hotspot) =>
          '<option value="' + escapeHtml(hotspot.id) + '"' + (hotspot.id === step.highlightHotspotId ? ' selected' : '') + '>' +
          escapeHtml(hotspot.text || hotspot.type || 'Hotspot') + '</option>'
        ).join('');
      return '<article class="guide-step" data-guide-step-id="' + escapeHtml(step.id) + '">' +
        '<span class="guide-step-index">' + (index + 1) + '</span>' +
        '<select data-guide-field="sceneId">' + options + '</select>' +
        '<label><span>сек</span><input data-guide-field="duration" type="number" min="2" max="600" value="' + step.duration + '"></label>' +
        '<label class="guide-check"><input data-guide-field="narrationAuto" type="checkbox"' + (step.narrationAuto ? ' checked' : '') + '> 🔊 авто</label>' +
        '<select class="guide-highlight-select" data-guide-field="highlightHotspotId">' + hotspotOptions + '</select>' +
        '<div class="guide-step-actions">' +
        '<button type="button" data-guide-action="up">↑</button><button type="button" data-guide-action="down">↓</button><button type="button" data-guide-action="remove">×</button>' +
        '</div></article>';
    }).join('');
  }

  function openGuideEditor() {
    renderGuideEditor();
    els.guideDialog.showModal();
  }

  function syncAdvancedSettingsUi() {
    project.startScreen = normalizeStartScreen(project.startScreen || {}, project.title);
    project.exportSettings = normalizeExportSettings(project.exportSettings || {});
    const s = project.startScreen;
    const e = project.exportSettings;
    els.startScreenEnabled.checked = s.enabled;
    els.startScreenTitle.value = s.title;
    els.startScreenSubtitle.value = s.subtitle;
    els.startScreenCoverName.textContent = s.coverFilename || 'Без обложки';
    els.startScreenAllowSilent.checked = s.allowSilent;
    els.optimizeEnabled.checked = e.optimizeEnabled;
    els.optimizeQuality.value = String(e.jpegQuality);
    els.optimizeMaxImageWidth.value = String(e.maxImageWidth);
    els.optimizeObjectFrameWidth.value = String(e.objectFrameWidth);
    els.pwaEnabled.checked = e.pwaEnabled;
    els.kioskMode.checked = e.kioskMode;
    els.publicTourUrl.value = e.publicUrl;
    renderQrPreview();
  }

  function applyAdvancedSettings() {
    project.startScreen = normalizeStartScreen({
      ...project.startScreen,
      enabled: els.startScreenEnabled.checked,
      title: els.startScreenTitle.value.trim() || project.title,
      subtitle: els.startScreenSubtitle.value,
      allowSilent: els.startScreenAllowSilent.checked
    }, project.title);
    project.exportSettings = normalizeExportSettings({
      ...project.exportSettings,
      optimizeEnabled: els.optimizeEnabled.checked,
      jpegQuality: els.optimizeQuality.value,
      maxImageWidth: els.optimizeMaxImageWidth.value,
      objectFrameWidth: els.optimizeObjectFrameWidth.value,
      pwaEnabled: els.pwaEnabled.checked,
      kioskMode: els.kioskMode.checked,
      publicUrl: els.publicTourUrl.value.trim()
    });
    markDirty();
    renderQrPreview();
  }

  function openAdvancedSettings() {
    syncAdvancedSettingsUi();
    els.advancedSettingsDialog.showModal();
  }

  function dataUrlByteSize(value) {
    const text = String(value || '');
    if (!text) return 0;
    const comma = text.indexOf(',');
    if (comma < 0) return text.length;
    const header = text.slice(0, comma);
    const payload = text.slice(comma + 1);
    return /;base64/i.test(header) ? Math.floor(payload.length * 0.75) : decodeURIComponent(payload).length;
  }

  function analyzeProjectSize() {
    const totals = { panoramas:0, object360:0, stl:0, audio:0, media:0, backgrounds:0 };
    project.scenes.forEach((scene) => {
      if (scene.sceneType === 'panorama') totals.panoramas += dataUrlByteSize(scene.imageData);
      if (scene.sceneType === 'object360') {
        (scene.object360?.frames || []).forEach((row) => (row || []).forEach((frame) => {
          totals.object360 += dataUrlByteSize(frame);
        }));
      }
      if (scene.sceneType === 'stl') {
        totals.stl += dataUrlByteSize(scene.stl?.data);
        totals.backgrounds += dataUrlByteSize(scene.stl?.backgroundImageData);
      }
      totals.audio += dataUrlByteSize(scene.audio?.music?.data) + dataUrlByteSize(scene.audio?.narration?.data);
      (scene.mediaObjects || []).forEach((item) => {
        totals.media += dataUrlByteSize(item.data);
        (item.gallery || []).forEach((entry) => { totals.media += dataUrlByteSize(entry.data); });
      });
    });
    totals.audio += dataUrlByteSize(project.audio?.music?.data);
    totals.media += dataUrlByteSize(project.startScreen?.coverData);
    const total = Object.values(totals).reduce((a,b) => a+b, 0);
    const fmt = (bytes) => formatFileSize(bytes);
    els.projectSizeReport.innerHTML =
      '<b>Итого: ' + fmt(total) + '</b>' +
      '<span>Панорамы: ' + fmt(totals.panoramas) + '</span>' +
      '<span>Object360: ' + fmt(totals.object360) + '</span>' +
      '<span>STL: ' + fmt(totals.stl) + '</span>' +
      '<span>Аудио: ' + fmt(totals.audio) + '</span>' +
      '<span>Медиа: ' + fmt(totals.media) + '</span>' +
      '<span>Фоны: ' + fmt(totals.backgrounds) + '</span>';
  }

  function renderQrPreview() {
    if (!els.qrPreview) return;
    const url = String(els.publicTourUrl?.value || project.exportSettings?.publicUrl || '').trim();
    els.qrPreview.innerHTML = '';
    if (!url) {
      els.qrPreview.innerHTML = '<span>Укажите URL</span>';
      els.btnDownloadQr.disabled = true;
      return;
    }
    if (!window.QRCode) {
      els.qrPreview.innerHTML = '<span>QR-библиотека не загружена</span>';
      els.btnDownloadQr.disabled = true;
      return;
    }
    els.btnDownloadQr.disabled = false;
    new QRCode(els.qrPreview, {
      text:url,
      width:180,
      height:180,
      colorDark:'#06101f',
      colorLight:'#ffffff',
      correctLevel:QRCode.CorrectLevel.M
    });
  }

  function downloadQrPng() {
    const canvas = els.qrPreview.querySelector('canvas');
    const img = els.qrPreview.querySelector('img');
    const data = canvas?.toDataURL?.('image/png') || img?.src || '';
    if (!data) {
      showToast('QR ещё не создан');
      return;
    }
    const a = document.createElement('a');
    a.href = data;
    a.download = safeFilename(project.title || 'tour', 'tour') + '-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openPreview() {
    if (!project.scenes.length) return;
    const scene = getScene(project.firstScene) || project.scenes[0];
    els.previewDialog.showModal();
    requestAnimationFrame(() => renderPreviewScene(scene.id));
  }

  function closePreview() {
    destroyPreviewViewers();
    if (els.previewDialog.open) els.previewDialog.close();
  }

  function applyProjectSettingChange() {
    project.title = els.projectTitle.value.trim() || 'Виртуальная экскурсия';
    project.firstScene = els.firstScene.value || project.scenes[0]?.id || null;
    project.audio = {
      music: normalizeAudioSlot({
        ...(project.audio?.music || {}),
        volume: els.projectMusicVolume.value,
        loop: els.projectMusicLoop.checked
      }, { volume: 35, loop: true })
    };
    els.projectMusicVolumeValue.textContent = project.audio.music.volume + '%';
    project.settings.fadeEnabled = els.sceneFadeEnabled.checked;
    project.settings.fadeDuration = Math.max(0, Number(els.sceneFadeDuration.value) || 0);
    project.settings.defaultTransition = ['fade','zoom','blur','portal','glitch','black'].includes(els.defaultTransition.value)
      ? els.defaultTransition.value : 'fade';
    project.settings.autoRotateEnabled = els.autoRotateEnabled.checked;
    project.settings.autoRotate = Number(els.autoRotate.value) || -2;
    project.settings.multiresEnabled = els.multiresEnabled.checked;
    project.settings.multiresTileSize = [512, 1024].includes(Number(els.multiresTileSize.value))
      ? Number(els.multiresTileSize.value) : 512;
    project.settings.multiresQuality = clampNumber(els.multiresQuality.value, 50, 100, 85);
    project.settings.multiresMaxCubeSize = [2048, 4096, 8192].includes(Number(els.multiresMaxCubeSize.value))
      ? Number(els.multiresMaxCubeSize.value) : 4096;
    els.multiresOptions.hidden = !project.settings.multiresEnabled;
    markDirty();
  }

  function applySceneFieldChanges({ rerender = false } = {}) {
    const scene = getScene();
    if (!scene) return;

    scene.title = els.sceneTitle.value.trim() || scene.title;
    scene.audio = normalizeSceneAudio(scene.audio || {});
    scene.audio.music.volume = clampNumber(els.sceneMusicVolume.value, 0, 100, 45);
    scene.audio.music.loop = els.sceneMusicLoop.checked;
    scene.audio.narration.volume = clampNumber(els.sceneNarrationVolume.value, 0, 100, 80);
    els.sceneMusicVolumeValue.textContent = scene.audio.music.volume + '%';
    els.sceneNarrationVolumeValue.textContent = scene.audio.narration.volume + '%';

    if (scene.sceneType === 'object360') {
      const data = normalizeObject360Data(scene.object360 || {});
      data.startSector = Math.max(0, Math.min(data.sectors - 1, Number(els.object360StartSector.value) || 0));
      data.startRow = Math.max(0, Math.min(data.rows - 1, Number(els.object360StartRow.value) || 0));
      data.autoplay = els.object360Autoplay.checked;
      data.backgroundMode = els.object360BackgroundMode.value || 'hitech';
      data.backgroundColor = /^#[0-9a-f]{6}$/i.test(els.object360BackgroundColor.value)
        ? els.object360BackgroundColor.value.toLowerCase()
        : '#ffffff';
      scene.object360 = data;
    } else if (scene.sceneType === 'stl') {
      const data = normalizeStlData(scene.stl || {});
      data.yaw = Number(els.stlYaw.value) || 0;
      data.pitch = clampNumber(els.stlPitch.value, -89, 89, -15);
      data.zoom = clampNumber(els.stlZoom.value, 0.35, 5, 1);
      data.color = /^#[0-9a-f]{6}$/i.test(els.stlColor.value) ? els.stlColor.value.toLowerCase() : '#7c8cff';
      data.backgroundMode = els.stlBackgroundMode.value || 'hitech';
      data.backgroundSceneId = data.backgroundMode === 'panorama' ? (els.stlBackgroundScene.value || '') : data.backgroundSceneId;
      data.wireframe = els.stlWireframe.checked;
      data.autoplay = els.stlAutoplay.checked;
      scene.stl = data;
    } else if (scene.sceneType === 'xr') {
      const data = normalizeXrData(scene.xr || {});
      data.projection = ['360','180','360_LR','180_LR','360_TB','180_TB'].includes(els.xrProjection.value)
        ? els.xrProjection.value
        : '360';
      data.yaw = Number(els.xrYaw.value) || 0;
      data.pitch = clampNumber(els.xrPitch.value, -89, 89, 0);
      data.fov = clampNumber(els.xrFov.value, 35, 110, 80);
      data.autoplay = data.kind === 'video' && els.xrAutoplay.checked;
      data.loop = data.kind === 'video' && els.xrLoop.checked;
      data.volume = clampNumber(els.xrVolume.value, 0, 100, 80);
      scene.xr = data;
      els.xrVolumeValue.textContent = data.volume + '%';
    } else {
      scene.pitch = Number(els.scenePitch.value) || 0;
      scene.yaw = Number(els.sceneYaw.value) || 0;
      scene.hfov = Math.min(120, Math.max(30, Number(els.sceneHfov.value) || 100));
    }

    markDirty({ rerenderViewer: rerender });
  }

  function setupEvents() {
    els.btnUndo.addEventListener('click', undoProject);
    els.btnSceneGraph.addEventListener('click', openSceneGraph);
    els.closeSceneGraph.addEventListener('click', () => els.sceneGraphDialog.close());
    els.sceneGraphDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      els.sceneGraphDialog.close();
    });
    els.btnGraphAutoLayout.addEventListener('click', renderSceneGraph);
    els.sceneGraph.addEventListener('click', (event) => {
      const node = event.target.closest('[data-graph-scene]');
      if (!node) return;
      selectScene(node.dataset.graphScene);
      els.sceneGraphDialog.close();
    });

    els.btnGuideEditor.addEventListener('click', openGuideEditor);
    els.closeGuideDialog.addEventListener('click', () => els.guideDialog.close());
    els.guideDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      els.guideDialog.close();
    });
    els.guideEnabled.addEventListener('change', () => {
      project.guide = normalizeGuide(project.guide || {}, project.scenes);
      project.guide.enabled = els.guideEnabled.checked;
      markDirty();
    });
    els.btnAddGuideStep.addEventListener('click', () => {
      if (!project.scenes.length) return;
      project.guide = normalizeGuide(project.guide || {}, project.scenes);
      project.guide.steps.push({
        id:uid('guide'),
        sceneId:project.scenes[Math.min(project.guide.steps.length, project.scenes.length - 1)].id,
        duration:12,
        narrationAuto:false,
        highlightHotspotId:''
      });
      markDirty();
      renderGuideEditor();
    });
    els.guideStepList.addEventListener('change', (event) => {
      const row = event.target.closest('[data-guide-step-id]');
      if (!row) return;
      const step = project.guide?.steps?.find((entry) => entry.id === row.dataset.guideStepId);
      if (!step) return;
      const field = event.target.dataset.guideField;
      if (field === 'sceneId') step.sceneId = event.target.value;
      if (field === 'duration') step.duration = clampNumber(event.target.value, 2, 600, 12);
      if (field === 'narrationAuto') step.narrationAuto = event.target.checked;
      if (field === 'highlightHotspotId') step.highlightHotspotId = event.target.value;
      if (field === 'sceneId') step.highlightHotspotId = '';
      markDirty();
      if (field === 'sceneId') renderGuideEditor();
    });
    els.guideStepList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-guide-action]');
      const row = event.target.closest('[data-guide-step-id]');
      if (!button || !row) return;
      const steps = project.guide?.steps || [];
      const index = steps.findIndex((entry) => entry.id === row.dataset.guideStepId);
      if (index < 0) return;
      if (button.dataset.guideAction === 'remove') steps.splice(index, 1);
      if (button.dataset.guideAction === 'up' && index > 0) [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
      if (button.dataset.guideAction === 'down' && index < steps.length - 1) [steps[index + 1], steps[index]] = [steps[index], steps[index + 1]];
      markDirty();
      renderGuideEditor();
    });

    els.btnAdvancedSettings.addEventListener('click', openAdvancedSettings);
    els.closeAdvancedSettings.addEventListener('click', () => els.advancedSettingsDialog.close());
    els.advancedSettingsDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      els.advancedSettingsDialog.close();
    });
    [
      els.startScreenEnabled, els.startScreenTitle, els.startScreenSubtitle, els.startScreenAllowSilent,
      els.optimizeEnabled, els.optimizeQuality, els.optimizeMaxImageWidth, els.optimizeObjectFrameWidth,
      els.pwaEnabled, els.kioskMode, els.publicTourUrl
    ].forEach((control) => {
      const eventName = control?.type === 'checkbox' || control?.tagName === 'SELECT' ? 'change' : 'input';
      control?.addEventListener(eventName, applyAdvancedSettings);
    });
    els.startScreenCoverFile.addEventListener('change', async () => {
      const file = els.startScreenCoverFile.files?.[0];
      if (!file) return;
      try {
        project.startScreen = normalizeStartScreen({
          ...project.startScreen,
          coverData:await fileToDataURL(file),
          coverFilename:file.name
        }, project.title);
        els.startScreenCoverName.textContent = file.name;
        markDirty();
      } catch (error) {
        console.error(error);
        showToast('Не удалось загрузить обложку');
      } finally {
        els.startScreenCoverFile.value = '';
      }
    });
    els.btnAnalyzeProject.addEventListener('click', analyzeProjectSize);
    els.publicTourUrl.addEventListener('change', renderQrPreview);
    els.btnDownloadQr.addEventListener('click', downloadQrPng);
    els.btnRedo.addEventListener('click', redoProject);
    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoProject();
      } else if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redoProject();
      }
    });

    els.btnAddScene.addEventListener('click', openSceneDialog);
    els.btnAddSceneCenter.addEventListener('click', openSceneDialog);

    els.sceneTypeControl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-scene-type]');
      if (button) setNewSceneType(button.dataset.sceneType);
    });

    els.newSceneImage.addEventListener('change', () => {
      const file = els.newSceneImage.files?.[0];
      els.newSceneFileName.textContent = file ? file.name : 'JPG, PNG или WEBP';
      if (file && !els.newSceneTitle.value.trim()) {
        els.newSceneTitle.value = file.name.replace(/\.[^.]+$/, '');
      }
    });

    els.newObject360Zip.addEventListener('change', () => {
      const file = els.newObject360Zip.files?.[0];
      els.newObject360FileName.textContent = file ? file.name : 'ZIP из Android-приложения Object360Capture';
      if (file && !els.newSceneTitle.value.trim()) {
        els.newSceneTitle.value = file.name.replace(/\.object360\.zip$|\.zip$/i, '');
      }
    });

    els.newStlFile.addEventListener('change', () => {
      const file = els.newStlFile.files?.[0];
      els.newStlFileName.textContent = file ? file.name : 'Binary или ASCII STL';
      if (file && !els.newSceneTitle.value.trim()) {
        els.newSceneTitle.value = file.name.replace(/\.stl$/i, '');
      }
    });

    els.newXrMediaFile.addEventListener('change', () => {
      const file = els.newXrMediaFile.files?.[0];
      els.newXrMediaFileName.textContent = file ? file.name : 'MP4 / WEBM / JPG / PNG / WEBP';
      if (file && !els.newSceneTitle.value.trim()) {
        els.newSceneTitle.value = file.name.replace(/\.[^.]+$/, '');
      }
    });

    els.sceneForm.addEventListener('submit', async (event) => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();

      const sceneType = els.newSceneType.value;
      const title = els.newSceneTitle.value.trim();
      const file = sceneType === 'object360'
        ? els.newObject360Zip.files?.[0]
        : (sceneType === 'stl'
          ? els.newStlFile.files?.[0]
          : (sceneType === 'xr' ? els.newXrMediaFile.files?.[0] : els.newSceneImage.files?.[0]));

      if (!file || !title) {
        const message = sceneType === 'object360'
          ? 'Укажите название и выберите Object360 ZIP'
          : (sceneType === 'stl'
            ? 'Укажите название и выберите STL-файл'
            : (sceneType === 'xr'
              ? 'Укажите название и выберите XR медиафайл'
              : 'Укажите название и выберите панораму'));
        showToast(message);
        return;
      }

      const button = event.submitter;
      if (button) button.disabled = true;
      try {
        if (sceneType === 'object360') await createObject360SceneFromZip(file, title);
        else if (sceneType === 'stl') await createStlSceneFromFile(file, title);
        else if (sceneType === 'xr') await createXrSceneFromFile(file, title, els.newXrProjection.value);
        else await createSceneFromFile(file, title);
        els.sceneDialog.close();
      } catch (error) {
        console.error(error);
        showToast('Не удалось добавить сцену: ' + (error?.message || 'ошибка'));
      } finally {
        if (button) button.disabled = false;
      }
    });

    els.sceneList.addEventListener('click', (event) => {
      const card = event.target.closest('[data-scene-id]');
      if (card) selectScene(card.dataset.sceneId);
    });

    els.btnAddTextObject.addEventListener('click', () => openTextObjectDialog());

    els.textObjectList.addEventListener('click', (event) => {
      const card = event.target.closest('[data-text-object-id]');
      if (card) openTextObjectDialog(card.dataset.textObjectId);
    });

    els.btnAddMediaObject.addEventListener('click', () => openMediaObjectDialog());
    els.mediaObjectList.addEventListener('click', (event) => {
      const card = event.target.closest('[data-media-object-id]');
      if (card) openMediaObjectDialog(card.dataset.mediaObjectId);
    });
    els.mediaObjectType.addEventListener('change', updateMediaDialogUi);
    els.mediaObjectVolume.addEventListener('input', () => {
      els.mediaObjectVolumeValue.textContent = els.mediaObjectVolume.value + '%';
    });
    els.mediaObjectFile.addEventListener('change', async () => {
      const file = els.mediaObjectFile.files?.[0];
      if (!file) return;
      try {
        pendingMediaData = await fileToDataURL(file);
        pendingMediaFilename = file.name;
        els.mediaObjectFilename.textContent = file.name;
      } catch (error) {
        console.error(error);
        showToast('Не удалось прочитать медиафайл');
      }
    });
    els.mediaGalleryFiles.addEventListener('change', async () => {
      const files = [...els.mediaGalleryFiles.files || []];
      if (!files.length) return;
      try {
        pendingMediaGallery = [];
        for (const file of files.slice(0, 30)) {
          pendingMediaGallery.push({ data: await fileToDataURL(file), filename:file.name });
        }
        els.mediaGalleryCount.textContent = pendingMediaGallery.length + ' изображений';
      } catch (error) {
        console.error(error);
        showToast('Не удалось прочитать галерею');
      }
    });
    els.mediaObjectForm.addEventListener('submit', async (event) => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      await saveMediaObjectFromDialog();
    });
    els.btnDeleteMediaObject.addEventListener('click', () => {
      const id = els.mediaObjectEditId.value;
      if (id && confirm('Удалить этот медиа-объект?')) deleteMediaObject(id);
    });

    els.layerList.addEventListener('click', (event) => {
      const action = event.target.closest('[data-layer-action]');
      const card = event.target.closest('[data-layer-kind]');
      if (!action || !card) return;
      const item = findLayerItem(card.dataset.layerKind, card.dataset.layerId);
      if (!item) return;
      if (action.dataset.layerAction === 'visible') item.visible = item.visible === false;
      if (action.dataset.layerAction === 'locked') item.locked = !item.locked;
      if (action.dataset.layerAction === 'up') item.zIndex = (Number(item.zIndex) || 0) + 1;
      if (action.dataset.layerAction === 'down') item.zIndex = (Number(item.zIndex) || 0) - 1;
      markDirty({ rerenderViewer: card.dataset.layerKind === 'hotspot' && getScene()?.sceneType === 'panorama' });
      renderCompositeOverlay(getScene(), els.sceneOverlay, null, { editor:true });
    });

    els.textObjectForm.addEventListener('submit', (event) => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      saveTextObjectFromDialog();
    });

    els.btnDeleteTextObject.addEventListener('click', () => {
      const id = els.textObjectEditId.value;
      if (id && confirm('Удалить этот текстовый объект?')) deleteTextObject(id);
    });

    let draggedTextElement = null;
    let textDragOffsetX = 0;
    let textDragOffsetY = 0;
    els.sceneOverlay.addEventListener('pointerdown', (event) => {
      const element = event.target.closest('[data-text-object-id]');
      if (!element) return;
      event.preventDefault();
      draggedTextElement = element;
      const elementRect = element.getBoundingClientRect();
      textDragOffsetX = event.clientX - elementRect.left;
      textDragOffsetY = event.clientY - elementRect.top;
      element.classList.add('dragging');
      try { element.setPointerCapture(event.pointerId); } catch (_) {}
    });
    els.sceneOverlay.addEventListener('pointermove', (event) => {
      if (!draggedTextElement) return;
      updateDraggedTextObject(
        draggedTextElement,
        event.clientX - textDragOffsetX,
        event.clientY - textDragOffsetY
      );
    });
    const finishTextDrag = () => {
      if (!draggedTextElement) return;
      draggedTextElement.classList.remove('dragging');
      draggedTextElement = null;
      markDirty();
      renderTextObjectList();
    };
    els.sceneOverlay.addEventListener('pointerup', finishTextDrag);
    els.sceneOverlay.addEventListener('pointercancel', finishTextDrag);
    els.sceneOverlay.addEventListener('dblclick', (event) => {
      const element = event.target.closest('[data-text-object-id]');
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      openTextObjectDialog(element.dataset.textObjectId);
    });

    els.sceneOverlay.addEventListener('click', (event) => {
      const hotspot = event.target.closest('[data-screen-hotspot-id]');
      if (!hotspot) return;
      event.preventDefault();
      event.stopPropagation();
      const scene = getScene();
      const item = scene?.hotspots?.find((entry) => entry.id === hotspot.dataset.screenHotspotId);
      if (item) openHotspotDialog(item.pitch || 0, item.yaw || 0, item.id);
    });

    let draggedMediaElement = null;
    let mediaDragOffsetX = 0;
    let mediaDragOffsetY = 0;
    els.sceneOverlay.addEventListener('pointerdown', (event) => {
      const element = event.target.closest('[data-media-object-id]');
      if (!element || element.classList.contains('is-locked')) return;
      const scene = getScene();
      const item = scene?.mediaObjects?.find((entry) => entry.id === element.dataset.mediaObjectId);
      if (!item || item.locked) return;
      event.preventDefault();
      event.stopPropagation();
      draggedMediaElement = element;
      const box = element.getBoundingClientRect();
      mediaDragOffsetX = event.clientX - box.left;
      mediaDragOffsetY = event.clientY - box.top;
      try { element.setPointerCapture(event.pointerId); } catch (_) {}
    });
    els.sceneOverlay.addEventListener('pointermove', (event) => {
      if (!draggedMediaElement) return;
      const scene = getScene();
      const item = scene?.mediaObjects?.find((entry) => entry.id === draggedMediaElement.dataset.mediaObjectId);
      if (!item) return;
      const rect = els.sceneOverlay.getBoundingClientRect();
      item.x = Number(clampNumber(((event.clientX - mediaDragOffsetX - rect.left) / Math.max(1, rect.width)) * 100, 0, 100, item.x).toFixed(2));
      item.y = Number(clampNumber(((event.clientY - mediaDragOffsetY - rect.top) / Math.max(1, rect.height)) * 100, 0, 100, item.y).toFixed(2));
      draggedMediaElement.style.left = item.x + '%';
      draggedMediaElement.style.top = item.y + '%';
    });
    const finishMediaDrag = () => {
      if (!draggedMediaElement) return;
      draggedMediaElement = null;
      markDirty();
    };
    els.sceneOverlay.addEventListener('pointerup', finishMediaDrag);
    els.sceneOverlay.addEventListener('pointercancel', finishMediaDrag);
    els.sceneOverlay.addEventListener('dblclick', (event) => {
      const element = event.target.closest('[data-media-object-id]');
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      openMediaObjectDialog(element.dataset.mediaObjectId);
    });

    els.hotspotList.addEventListener('click', (event) => {
      const card = event.target.closest('[data-hotspot-id]');
      if (!card) return;
      const scene = getScene();
      const hotspot = scene?.hotspots.find((item) => item.id === card.dataset.hotspotId);
      if (hotspot) openHotspotDialog(hotspot.pitch, hotspot.yaw, hotspot.id);
    });

    els.btnAddHotspot.addEventListener('click', () => {
      const scene = getScene();
      if (!scene) return;
      if (viewer) {
        openHotspotDialog(viewer.getPitch(), viewer.getYaw());
        return;
      }
      if (objectViewer) {
        const state = objectViewer.getState();
        openHotspotDialog(0, 0, null, {
          anchorMode:'object360', anchorX:50, anchorY:50,
          anchorSector:state.sector, anchorRow:state.row, anchorYaw:0, anchorPitch:0
        });
        return;
      }
      if (stlViewer) {
        const state = stlViewer.getState();
        openHotspotDialog(0, 0, null, {
          anchorMode:'stl-screen', anchorX:50, anchorY:50,
          anchorSector:0, anchorRow:0, anchorYaw:state.yaw, anchorPitch:state.pitch
        });
      }
    });

    els.panorama.addEventListener('dblclick', (event) => {
      const scene = getScene();
      if (!scene) return;
      if (viewer) {
        try {
          const [pitch, yaw] = viewer.mouseEventToCoords(event);
          openHotspotDialog(pitch, yaw);
        } catch (error) {
          console.warn(error);
        }
        return;
      }
      const rect = els.panorama.getBoundingClientRect();
      const x = clampNumber(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100, 0, 100, 50);
      const y = clampNumber(((event.clientY - rect.top) / Math.max(1, rect.height)) * 100, 0, 100, 50);
      if (objectViewer) {
        const state = objectViewer.getState();
        openHotspotDialog(0, 0, null, {
          anchorMode:'object360', anchorX:x, anchorY:y,
          anchorSector:state.sector, anchorRow:state.row, anchorYaw:0, anchorPitch:0
        });
      } else if (stlViewer) {
        const state = stlViewer.getState();
        let hit = null;
        try { hit = stlViewer.pick(event.clientX, event.clientY); } catch (error) { console.warn(error); }
        if (hit?.point) {
          openHotspotDialog(0, 0, null, {
            anchorMode:'stl-3d',
            anchorX:hit.screen?.x ?? x,
            anchorY:hit.screen?.y ?? y,
            anchorSector:0,
            anchorRow:0,
            anchorYaw:state.yaw,
            anchorPitch:state.pitch,
            modelPoint:hit.point
          });
        } else {
          openHotspotDialog(0, 0, null, {
            anchorMode:'stl-screen', anchorX:x, anchorY:y,
            anchorSector:0, anchorRow:0, anchorYaw:state.yaw, anchorPitch:state.pitch, modelPoint:null
          });
        }
      }
    });

    els.panorama.addEventListener('mousemove', (event) => {
      if (!viewer || !getScene()) return;
      try {
        const [pitch, yaw] = viewer.mouseEventToCoords(event);
        els.coords.textContent = `pitch ${formatNum(pitch)}° · yaw ${formatNum(yaw)}°`;
      } catch (_) {
        updateCoordsFromViewer();
      }
    });

    els.panorama.addEventListener('mouseleave', updateCoordsFromViewer);

    els.hotspotTypeControl.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-type]');
      if (button) setHotspotType(button.dataset.type);
    });

    els.hotspotIconPicker.addEventListener('click', (event) => {
      const button = event.target.closest('[data-icon]');
      if (!button) return;
      setHotspotIconPreset(button.dataset.icon);
      if (button.dataset.icon === 'preview') {
        generatePendingAutoPreview({ silent: true }).catch((error) => {
          console.error(error);
          showToast('Не удалось создать превью целевой сцены');
        });
      }
    });

    els.hotspotTarget.addEventListener('change', () => {
      updateHotspotTargetHint();
      if (els.hotspotIconPreset.value !== 'preview') return;
      pendingHotspotIconData = '';
      pendingHotspotIconFilename = '';
      pendingHotspotPreviewTargetId = '';
      generatePendingAutoPreview({ silent: true }).catch((error) => {
        console.error(error);
        showToast('Не удалось создать превью целевой сцены');
      });
    });

    els.btnRefreshHotspotPreview.addEventListener('click', () => {
      generatePendingAutoPreview().catch((error) => {
        console.error(error);
        showToast('Не удалось обновить превью');
      });
    });

    els.hotspotIconFile.addEventListener('change', async () => {
      const file = els.hotspotIconFile.files?.[0];
      if (!file) return;
      if (!['image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
        showToast('Для иконки используйте PNG, WEBP или SVG');
        els.hotspotIconFile.value = '';
        return;
      }
      try {
        pendingHotspotIconData = await fileToDataURL(file);
        pendingHotspotIconFilename = file.name;
        pendingHotspotPreviewTargetId = '';
        setHotspotIconPreset('custom');
      } catch (error) {
        console.error(error);
        showToast('Не удалось прочитать иконку');
      }
    });

    els.hotspotGlowEnabled.addEventListener('change', updateGlowControlsUi);
    els.hotspotGlowColor.addEventListener('input', updateGlowControlsUi);
    els.hotspotGlowBlur.addEventListener('input', updateGlowControlsUi);
    els.hotspotGlowStrength.addEventListener('input', updateGlowControlsUi);
    els.hotspotGlowPulse.addEventListener('change', updateGlowControlsUi);
    els.hotspotGlowPulseSpeed.addEventListener('input', updateGlowControlsUi);

    els.hotspotForm.addEventListener('submit', async (event) => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const button = event.submitter;
      if (button) button.disabled = true;
      try {
        await saveHotspotFromDialog();
      } finally {
        if (button) button.disabled = false;
      }
    });

    els.btnDeleteHotspot.addEventListener('click', () => {
      const id = els.hotspotEditId.value;
      if (id && confirm('Удалить эту точку?')) deleteHotspot(id);
    });

    els.btnSetInitialView.addEventListener('click', saveCurrentView);
    els.btnDeleteScene.addEventListener('click', deleteCurrentScene);

    els.projectTitle.addEventListener('input', applyProjectSettingChange);
    els.firstScene.addEventListener('change', () => {
      applyProjectSettingChange();
      renderViewer();
    });
    els.sceneFadeEnabled.addEventListener('change', () => {
      applyProjectSettingChange();
      renderViewer();
    });
    els.sceneFadeDuration.addEventListener('change', () => {
      applyProjectSettingChange();
      renderViewer();
    });
    els.defaultTransition.addEventListener('change', applyProjectSettingChange);
    els.autoRotateEnabled.addEventListener('change', () => {
      applyProjectSettingChange();
      renderViewer();
    });
    els.autoRotate.addEventListener('change', () => {
      applyProjectSettingChange();
      renderViewer();
    });
    els.multiresEnabled.addEventListener('change', applyProjectSettingChange);
    els.multiresTileSize.addEventListener('change', applyProjectSettingChange);
    els.multiresQuality.addEventListener('change', applyProjectSettingChange);
    els.multiresMaxCubeSize.addEventListener('change', applyProjectSettingChange);

    els.projectMusicFile.addEventListener('change', async () => {
      const file = els.projectMusicFile.files?.[0];
      if (!file) return;
      try {
        const current = normalizeAudioSlot(project.audio?.music || {}, { volume: 35, loop: true });
        project.audio = {
          music: normalizeAudioSlot({
            ...current,
            data: await fileToDataURL(file),
            filename: file.name
          }, { volume: 35, loop: true })
        };
        els.projectMusicName.textContent = file.name;
        markDirty();
      } catch (error) {
        console.error(error);
        showToast('Не удалось загрузить музыку тура');
      } finally {
        els.projectMusicFile.value = '';
      }
    });
    els.projectMusicVolume.addEventListener('input', applyProjectSettingChange);
    els.projectMusicLoop.addEventListener('change', applyProjectSettingChange);
    els.btnRemoveProjectMusic.addEventListener('click', () => {
      project.audio = {
        music: normalizeAudioSlot({
          volume: els.projectMusicVolume.value,
          loop: els.projectMusicLoop.checked
        }, { volume: 35, loop: true })
      };
      els.projectMusicName.textContent = 'Не выбрана';
      markDirty();
    });

    els.sceneTitle.addEventListener('input', () => applySceneFieldChanges());
    els.scenePitch.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.sceneYaw.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.sceneHfov.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.object360StartSector.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.object360StartRow.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.object360Autoplay.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.object360BackgroundMode.addEventListener('change', () => {
      updateObject360BackgroundControls();
      applySceneFieldChanges({ rerender: true });
    });
    els.object360BackgroundColor.addEventListener('input', () => applySceneFieldChanges({ rerender: true }));
    els.object360BackgroundImage.addEventListener('change', async () => {
      const scene = getScene();
      const file = els.object360BackgroundImage.files?.[0];
      if (!scene || scene.sceneType !== 'object360' || !file) return;
      try {
        scene.object360 = normalizeObject360Data({
          ...scene.object360,
          backgroundMode: 'image',
          backgroundImageData: await fileToDataURL(file),
          backgroundImageName: file.name
        });
        els.object360BackgroundMode.value = 'image';
        els.object360BackgroundImageName.textContent = file.name;
        updateObject360BackgroundControls();
        markDirty();
        renderViewer();
      } catch (error) {
        console.error(error);
        showToast('Не удалось загрузить фон Object360');
      } finally {
        els.object360BackgroundImage.value = '';
      }
    });
    els.stlYaw.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.stlPitch.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.stlZoom.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.stlColor.addEventListener('input', () => applySceneFieldChanges({ rerender: true }));
    els.stlBackgroundMode.addEventListener('change', () => {
      updateStlBackgroundControls();
      applySceneFieldChanges({ rerender: true });
    });
    els.stlBackgroundScene.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.stlBackgroundImage.addEventListener('change', async () => {
      const scene = getScene();
      const file = els.stlBackgroundImage.files?.[0];
      if (!scene || scene.sceneType !== 'stl' || !file) return;
      try {
        scene.stl = normalizeStlData({
          ...scene.stl,
          backgroundMode: 'image',
          backgroundImageData: await fileToDataURL(file),
          backgroundImageName: file.name
        });
        els.stlBackgroundMode.value = 'image';
        els.stlBackgroundImageName.textContent = file.name;
        updateStlBackgroundControls();
        markDirty();
        renderViewer();
      } catch (error) {
        console.error(error);
        showToast('Не удалось загрузить фоновую картинку');
      } finally {
        els.stlBackgroundImage.value = '';
      }
    });
    els.stlWireframe.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.stlAutoplay.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));

    els.sceneMusicFile.addEventListener('change', async () => {
      const scene = getScene();
      const file = els.sceneMusicFile.files?.[0];
      if (!scene || !file) return;
      try {
        scene.audio = normalizeSceneAudio(scene.audio || {});
        scene.audio.music = normalizeAudioSlot({
          ...scene.audio.music,
          data: await fileToDataURL(file),
          filename: file.name
        }, { volume: 45, loop: true });
        els.sceneMusicName.textContent = file.name;
        markDirty();
      } catch (error) {
        console.error(error);
        showToast('Не удалось загрузить музыку сцены');
      } finally {
        els.sceneMusicFile.value = '';
      }
    });
    els.sceneMusicVolume.addEventListener('input', () => applySceneFieldChanges());
    els.sceneMusicLoop.addEventListener('change', () => applySceneFieldChanges());
    els.btnRemoveSceneMusic.addEventListener('click', () => {
      const scene = getScene();
      if (!scene) return;
      scene.audio = normalizeSceneAudio(scene.audio || {});
      scene.audio.music = normalizeAudioSlot({
        volume: els.sceneMusicVolume.value,
        loop: els.sceneMusicLoop.checked
      }, { volume: 45, loop: true });
      els.sceneMusicName.textContent = 'Не выбрана';
      markDirty();
    });

    els.sceneNarrationFile.addEventListener('change', async () => {
      const scene = getScene();
      const file = els.sceneNarrationFile.files?.[0];
      if (!scene || !file) return;
      try {
        scene.audio = normalizeSceneAudio(scene.audio || {});
        scene.audio.narration = normalizeAudioSlot({
          ...scene.audio.narration,
          data: await fileToDataURL(file),
          filename: file.name
        }, { volume: 80, loop: false });
        els.sceneNarrationName.textContent = file.name;
        markDirty();
      } catch (error) {
        console.error(error);
        showToast('Не удалось загрузить озвучку');
      } finally {
        els.sceneNarrationFile.value = '';
      }
    });
    els.sceneNarrationVolume.addEventListener('input', () => applySceneFieldChanges());
    els.btnRemoveSceneNarration.addEventListener('click', () => {
      const scene = getScene();
      if (!scene) return;
      scene.audio = normalizeSceneAudio(scene.audio || {});
      scene.audio.narration = normalizeAudioSlot({
        volume: els.sceneNarrationVolume.value,
        loop: false
      }, { volume: 80, loop: false });
      els.sceneNarrationName.textContent = 'Не выбрана';
      markDirty();
    });

    els.sceneImageReplace.addEventListener('change', async () => {
      const scene = getScene();
      const file = els.sceneImageReplace.files?.[0];
      if (!scene || scene.sceneType !== 'panorama' || !file) return;
      try {
        scene.imageData = await fileToDataURL(file);
        scene.filename = file.name;
        let updated = 0;
        try {
          updated = await regenerateIncomingPreviews(scene.id);
        } catch (previewError) {
          console.error(previewError);
        }
        markDirty();
        renderViewer();
        showToast(updated ? 'Панорама заменена · обновлено превью: ' + updated : 'Панорама заменена');
      } catch (error) {
        console.error(error);
        showToast('Не удалось заменить панораму');
      } finally {
        els.sceneImageReplace.value = '';
      }
    });

    els.object360ZipReplace.addEventListener('change', async () => {
      const scene = getScene();
      const file = els.object360ZipReplace.files?.[0];
      if (!scene || scene.sceneType !== 'object360' || !file) return;

      const oldId = scene.id;
      const oldTitle = scene.title;
      try {
        const zip = await JSZip.loadAsync(file);
        const names = Object.keys(zip.files);
        const configName = names.find((name) => /(^|\/)config\.json$/i.test(name));
        let config = {};
        if (configName) {
          try { config = JSON.parse(await zip.file(configName).async('text')); } catch (_) {}
        }

        const entries = [];
        names.forEach((name) => {
          const match = String(name).replace(/\\/g, '/').match(/(?:^|\/)row_(\d+)\/frame_(\d+)\.(jpe?g|png|webp)$/i);
          if (match && !zip.files[name].dir) entries.push({
            name,
            row: Number(match[1]) - 1,
            sector: Number(match[2]),
            ext: match[3].toLowerCase()
          });
        });
        if (!entries.length) throw new Error('В ZIP нет кадров');

        const rows = Math.max(Number(config.rows) || 1, Math.max(...entries.map((item) => item.row)) + 1);
        const sectors = Math.max(Number(config.sectors) || 1, Math.max(...entries.map((item) => item.sector)) + 1);
        const frames = Array.from({ length: rows }, () => Array(sectors).fill(''));

        for (const entry of entries) {
          const base64 = await zip.file(entry.name).async('base64');
          const mime = entry.ext === 'png' ? 'image/png' : entry.ext === 'webp' ? 'image/webp' : 'image/jpeg';
          frames[entry.row][entry.sector] = dataUrlForBase64(mime, base64);
        }

        scene.id = oldId;
        scene.title = oldTitle;
        scene.filename = file.name;
        scene.imageData = frames.flat().find(Boolean) || '';
        scene.object360 = normalizeObject360Data({
          ...config,
          sectors,
          rows,
          frames,
          coverData: scene.imageData,
          frameCount: entries.length,
          startSector: 0,
          startRow: rows === 3 ? 1 : 0,
          autoplay: scene.object360?.autoplay
        });

        markDirty();
        renderViewer();
        showToast('Object360 ZIP заменён');
      } catch (error) {
        console.error(error);
        showToast('Не удалось заменить Object360 ZIP: ' + (error?.message || 'ошибка'));
      } finally {
        els.object360ZipReplace.value = '';
      }
    });

    els.stlFileReplace.addEventListener('change', async () => {
      const scene = getScene();
      const file = els.stlFileReplace.files?.[0];
      if (!scene || scene.sceneType !== 'stl' || !file) return;

      try {
        if (!/\.stl$/i.test(file.name || '')) throw new Error('Нужен STL-файл');
        if (!window.StlTools) throw new Error('STL parser не загрузился');

        const buffer = await file.arrayBuffer();
        const parsed = StlTools.parseStl(buffer);
        const data = await fileToDataURL(file);
        scene.filename = file.name;
        scene.stl = normalizeStlData({
          ...scene.stl,
          data,
          filename: file.name,
          triangleCount: parsed.triangleCount,
          size: parsed.originalSize
        });
        scene.imageData = stlPlaceholderDataUrl();

        markDirty();
        renderViewer();
        showToast('STL-модель заменена');
      } catch (error) {
        console.error(error);
        showToast('Не удалось заменить STL: ' + (error?.message || 'ошибка'));
      } finally {
        els.stlFileReplace.value = '';
      }
    });

    els.btnExportProject.addEventListener('click', exportProject);
    els.btnExportTour.addEventListener('click', exportTourPackage);
    els.projectImport.addEventListener('change', () => importProjectFile(els.projectImport.files?.[0]));

    els.closeDownloadDialog.addEventListener('click', closeZipDownloadDialog);
    els.downloadDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeZipDownloadDialog();
    });
    els.downloadZipLink.addEventListener('click', savePendingZip);

    els.btnPreview.addEventListener('click', openPreview);
    els.previewMusicButton.addEventListener('click', async () => {
      if (!previewMusicAudio) return;
      try {
        if (previewMusicAudio.paused) {
          await previewMusicAudio.play();
          els.previewMusicButton.classList.add('active');
        } else {
          previewMusicAudio.pause();
          els.previewMusicButton.classList.remove('active');
        }
      } catch (error) {
        console.warn(error);
      }
    });
    els.previewSceneOverlay.addEventListener('click', (event) => {
      const scene = getScene(previewSceneId);
      const hotspotEl = event.target.closest('[data-screen-hotspot-id]');
      if (hotspotEl && scene) {
        const hotspot = (scene.hotspots || []).find((item) => item.id === hotspotEl.dataset.screenHotspotId);
        if (hotspot?.type === 'scene' && hotspot.targetSceneId) renderPreviewScene(hotspot.targetSceneId);
        else if (hotspot?.type === 'url' && hotspot.url) window.open(hotspot.url, '_blank', 'noopener');
        else if (hotspot?.type === 'info') showToast(hotspot.info || hotspot.text || 'Информация', 4200);
        return;
      }
      const mediaEl = event.target.closest('[data-media-object-id]');
      if (!mediaEl || !scene) return;
      const item = (scene.mediaObjects || []).find((entry) => entry.id === mediaEl.dataset.mediaObjectId);
      if (!item) return;
      if (item.type === 'button' && item.targetSceneId) renderPreviewScene(item.targetSceneId);
      else if (item.type === 'button' && item.url) window.open(item.url, '_blank', 'noopener');
      else if (item.type === 'pdf' && item.data) window.open(item.data, '_blank', 'noopener');
    });

    els.previewNarrationButton.addEventListener('click', async () => {
      if (!previewNarrationAudio) return;
      try {
        if (previewNarrationAudio.paused) {
          previewNarrationAudio.currentTime = 0;
          await previewNarrationAudio.play();
          els.previewNarrationButton.classList.add('active');
        } else {
          previewNarrationAudio.pause();
          els.previewNarrationButton.classList.remove('active');
        }
      } catch (error) {
        console.warn(error);
      }
    });
    els.closePreview.addEventListener('click', closePreview);
    els.previewDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closePreview();
    });

    els.btnNew.addEventListener('click', async () => {
      if (project.scenes.length && !confirm('Создать новый проект? Текущий проект останется только в ранее сделанном экспорте.')) return;
      destroyViewer();
      project = createEmptyProject();
      currentSceneId = null;
      resetHistory();
      await clearPersistedProject();
      await persistProject();
      renderAll();
      showToast('Создан новый проект');
    });

    let dragDepth = 0;
    window.addEventListener('dragenter', (event) => {
      if (![...event.dataTransfer?.types || []].includes('Files')) return;
      dragDepth++;
      els.dropOverlay.classList.add('visible');
    });

    window.addEventListener('dragleave', () => {
      dragDepth--;
      if (dragDepth <= 0) {
        dragDepth = 0;
        els.dropOverlay.classList.remove('visible');
      }
    });

    window.addEventListener('dragover', (event) => {
      if ([...event.dataTransfer?.types || []].includes('Files')) event.preventDefault();
    });

    window.addEventListener('drop', async (event) => {
      dragDepth = 0;
      els.dropOverlay.classList.remove('visible');
      const files = [...event.dataTransfer?.files || []];
      const file = files.find((item) => item.type.startsWith('image/')) ||
        files.find((item) => /\.zip$/i.test(item.name || '')) ||
        files.find((item) => /\.stl$/i.test(item.name || ''));
      if (!file) return;
      event.preventDefault();
      try {
        if (/\.zip$/i.test(file.name || '')) {
          await createObject360SceneFromZip(file, file.name.replace(/\.object360\.zip$|\.zip$/i, ''));
          showToast('Объект 360° добавлен');
        } else if (/\.stl$/i.test(file.name || '')) {
          await createStlSceneFromFile(file, file.name.replace(/\.stl$/i, ''));
          showToast('STL-модель добавлена');
        } else {
          await createSceneFromFile(file, file.name.replace(/\.[^.]+$/, ''));
          showToast('Панорама добавлена');
        }
      } catch (error) {
        console.error(error);
        showToast('Не удалось добавить сцену: ' + (error?.message || 'ошибка'));
      }
    });

    window.addEventListener('beforeunload', () => {
      clearPendingZipDownload();
      if (saveTimer) {
        clearTimeout(saveTimer);
        persistProject();
      }
    });

    window.addEventListener('resize', () => {
      try { viewer?.resize(); } catch (_) {}
      try { objectViewer?.resize(); } catch (_) {}
      try { stlViewer?.resize(); } catch (_) {}
      try { previewViewer?.resize(); } catch (_) {}
      try { previewObjectViewer?.resize(); } catch (_) {}
      try { previewStlViewer?.resize(); } catch (_) {}
    });
  }

  async function init() {
    setupEvents();

    const saved = await loadPersistedProject();
    if (saved) {
      try {
        project = normalizeProject(saved);
      } catch (error) {
        console.warn('Сохранённый проект повреждён, создан новый', error);
        project = createEmptyProject();
      }
    }

    currentSceneId = project.firstScene || project.scenes[0]?.id || null;
    resetHistory();
    renderAll();
    setSaveState('saved');
  }

  init();
})();