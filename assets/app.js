(() => {
  'use strict';

  const DB_NAME = 'pannellum-tour-editor';
  const DB_VERSION = 1;
  const STORE_NAME = 'projects';
  const CURRENT_KEY = 'current';
  const PROJECT_VERSION = 1;

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
    sceneFadeEnabled: $('sceneFadeEnabled'),
    sceneFadeDuration: $('sceneFadeDuration'),
    autoRotateEnabled: $('autoRotateEnabled'),
    autoRotate: $('autoRotate'),
    multiresEnabled: $('multiresEnabled'),
    multiresOptions: $('multiresOptions'),
    multiresTileSize: $('multiresTileSize'),
    multiresQuality: $('multiresQuality'),
    multiresMaxCubeSize: $('multiresMaxCubeSize'),
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
    newSceneImage: $('newSceneImage'),
    newSceneFileName: $('newSceneFileName'),
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
    btnDeleteScene: $('btnDeleteScene'),
    hotspotDialog: $('hotspotDialog'),
    hotspotForm: $('hotspotForm'),
    hotspotDialogTitle: $('hotspotDialogTitle'),
    hotspotCoordsLabel: $('hotspotCoordsLabel'),
    hotspotEditId: $('hotspotEditId'),
    hotspotType: $('hotspotType'),
    hotspotTypeControl: $('hotspotTypeControl'),
    hotspotText: $('hotspotText'),
    hotspotTarget: $('hotspotTarget'),
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
    closePreview: $('closePreview'),
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
  let previewViewer = null;
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

  function createEmptyProject() {
    return {
      version: PROJECT_VERSION,
      title: 'Виртуальная экскурсия',
      firstScene: null,
      settings: {
        fadeEnabled: true,
        fadeDuration: 900,
        autoRotateEnabled: false,
        autoRotate: -2,
        multiresEnabled: false,
        multiresTileSize: 512,
        multiresQuality: 85,
        multiresMaxCubeSize: 4096
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
    setSaveState('dirty');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistProject, 350);

    renderSceneList();
    renderProjectSettings();
    renderSceneSettings();
    renderHotspotList();

    if (rerenderViewer) {
      renderViewer();
    }
  }

  function normalizeProject(input) {
    if (!input || typeof input !== 'object') throw new Error('Некорректный JSON проекта');

    const next = createEmptyProject();
    next.title = String(input.title || next.title);
    next.settings = { ...next.settings, ...(input.settings || {}) };
    next.scenes = Array.isArray(input.scenes) ? input.scenes.map((scene, index) => ({
      id: String(scene.id || uid('scene')),
      title: String(scene.title || 'Сцена ' + (index + 1)),
      filename: String(scene.filename || ('panorama-' + (index + 1) + '.jpg')),
      imageData: String(scene.imageData || scene.panorama || ''),
      pitch: Number.isFinite(Number(scene.pitch)) ? Number(scene.pitch) : 0,
      yaw: Number.isFinite(Number(scene.yaw)) ? Number(scene.yaw) : 0,
      hfov: Number.isFinite(Number(scene.hfov)) ? Number(scene.hfov) : 100,
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
        info: hotspot.info ? String(hotspot.info) : ''
      })) : []
    })) : [];

    next.firstScene = next.scenes.some((scene) => scene.id === input.firstScene)
      ? String(input.firstScene)
      : (next.scenes[0]?.id || null);

    return next;
  }

  function renderAll() {
    renderSceneList();
    renderProjectSettings();
    renderSceneSettings();
    renderHotspotList();
    updateToolbarState();
    renderViewer();
  }

  function renderSceneList() {
    if (!project.scenes.length) {
      els.sceneList.className = 'scene-list empty';
      els.sceneList.innerHTML = '<div class="empty-state">Добавьте первую панораму</div>';
      return;
    }

    els.sceneList.className = 'scene-list';
    els.sceneList.innerHTML = project.scenes.map((scene, index) => {
      const count = scene.hotspots?.length || 0;
      return `
        <article class="scene-card ${scene.id === currentSceneId ? 'active' : ''}" data-scene-id="${escapeHtml(scene.id)}">
          <div class="scene-card-main">
            <img class="scene-thumb" src="${escapeHtml(scene.imageData)}" alt="">
            <div class="scene-meta">
              <b>${escapeHtml(scene.title)}</b>
              <span>${count} ${count === 1 ? 'точка' : 'точек'}${project.firstScene === scene.id ? ' · старт' : ''}</span>
            </div>
            <span class="scene-index">${index + 1}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderProjectSettings() {
    els.projectTitle.value = project.title || '';
    els.sceneFadeEnabled.checked = Boolean(project.settings.fadeEnabled);
    els.sceneFadeDuration.value = Number(project.settings.fadeDuration ?? 900);
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
    els.scenePitch.value = formatNum(scene.pitch);
    els.sceneYaw.value = formatNum(scene.yaw);
    els.sceneHfov.value = Number(scene.hfov);
    els.sceneFilename.textContent = scene.filename || 'panorama.jpg';
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
      const target = hotspot.type === 'scene' ? getScene(hotspot.targetSceneId)?.title || 'Сцена не найдена'
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
    const hasScene = Boolean(getScene());
    els.btnAddHotspot.disabled = !hasScene;
    els.btnSetInitialView.disabled = !hasScene;
    els.btnPreview.disabled = !project.scenes.length;
    els.viewerPlaceholder.hidden = hasScene;
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
    if (!scene || !scene.imageData) throw new Error('Целевая сцена не найдена');
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
      updateAutoPreviewUi('Ракурс: ' + formatNum(targetScene.yaw) + '° / ' + formatNum(targetScene.pitch) + '°');
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

  function hotspotToPannellum(hotspot) {
    const base = {
      pitch: Number(hotspot.pitch) || 0,
      yaw: Number(hotspot.yaw) || 0,
      text: hotspot.text || ''
    };

    if (hotspot.type === 'scene') {
      return {
        ...base,
        type: 'scene',
        sceneId: hotspot.targetSceneId,
        cssClass: transitionIconClass(hotspot) + ' ' + hotspotStyleClass(hotspot)
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

  function buildPannellumConfig({ useEmbeddedImages = true, firstSceneId = null } = {}) {
    const scenes = {};

    project.scenes.forEach((scene) => {
      scenes[scene.id] = {
        type: 'equirectangular',
        panorama: useEmbeddedImages ? scene.imageData : scene.filename,
        title: scene.title || undefined,
        pitch: Number(scene.pitch) || 0,
        yaw: Number(scene.yaw) || 0,
        hfov: Number(scene.hfov) || 100,
        hotSpots: (scene.hotspots || [])
          .filter((hotspot) => hotspot.type !== 'scene' || project.scenes.some((s) => s.id === hotspot.targetSceneId))
          .map(hotspotToPannellum)
      };
    });

    const defaultConfig = {
      firstScene: firstSceneId || project.firstScene || project.scenes[0]?.id,
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
    if (!viewer) return;
    try { viewer.destroy(); } catch (error) { console.warn(error); }
    viewer = null;
  }

  function renderViewer() {
    updateToolbarState();
    const scene = getScene();

    if (!scene) {
      destroyViewer();
      els.panorama.innerHTML = '';
      return;
    }

    if (!window.pannellum) {
      showToast('Pannellum не загрузился. Проверьте подключение к интернету.');
      return;
    }

    destroyViewer();
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
    renderHotspotList();
    updateToolbarState();

    if (viewer) {
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
      filename: file.name || (id + '.jpg'),
      imageData,
      pitch: 0,
      yaw: 0,
      hfov: 100,
      hotspots: []
    };

    project.scenes.push(scene);
    if (!project.firstScene) project.firstScene = scene.id;
    currentSceneId = scene.id;
    markDirty();
    renderViewer();
    return scene;
  }

  function openSceneDialog() {
    els.sceneForm.reset();
    els.newSceneFileName.textContent = 'JPG, PNG или WEBP';
    els.sceneDialog.showModal();
    setTimeout(() => els.newSceneTitle.focus(), 50);
  }

  function populateHotspotTargets(selectedId = '') {
    const current = getScene();
    const candidates = project.scenes.filter((scene) => scene.id !== current?.id);
    els.hotspotTarget.innerHTML = candidates.length
      ? candidates.map((scene) => `<option value="${escapeHtml(scene.id)}">${escapeHtml(scene.title)}</option>`).join('')
      : '<option value="">Сначала добавьте вторую сцену</option>';
    els.hotspotTarget.disabled = !candidates.length;
    if (selectedId && candidates.some((scene) => scene.id === selectedId)) {
      els.hotspotTarget.value = selectedId;
    }
  }

  function setHotspotType(type) {
    if (!['scene', 'info', 'url'].includes(type)) type = 'scene';
    els.hotspotType.value = type;

    [...els.hotspotTypeControl.querySelectorAll('button')].forEach((button) => {
      button.classList.toggle('active', button.dataset.type === type);
    });

    document.querySelector('.hotspot-scene-field').hidden = type !== 'scene';
    document.querySelector('.hotspot-icon-field').hidden = type !== 'scene';
    document.querySelector('.hotspot-info-field').hidden = type !== 'info';
    document.querySelector('.hotspot-url-field').hidden = type !== 'url';
  }

  function openHotspotDialog(pitch, yaw, hotspotId = null) {
    const scene = getScene();
    if (!scene) return;

    els.hotspotForm.reset();
    els.hotspotEditId.value = hotspotId || '';
    let hotspot = hotspotId ? scene.hotspots.find((item) => item.id === hotspotId) : null;

    const p = hotspot ? hotspot.pitch : pitch;
    const y = hotspot ? hotspot.yaw : yaw;

    els.hotspotDialogTitle.textContent = hotspot ? 'Редактировать точку' : 'Новая точка';
    els.hotspotCoordsLabel.textContent = `pitch ${formatNum(p)}° · yaw ${formatNum(y)}°`;
    els.hotspotPitch.value = formatNum(p);
    els.hotspotYaw.value = formatNum(y);
    els.hotspotText.value = hotspot?.text || '';
    els.hotspotUrl.value = hotspot?.url || '';
    els.hotspotInfo.value = hotspot?.info || '';
    loadGlowControls(hotspot);
    els.btnDeleteHotspot.hidden = !hotspot;

    pendingHotspotIconData = hotspot?.iconData || '';
    pendingHotspotIconFilename = hotspot?.iconFilename || '';
    pendingHotspotPreviewTargetId = hotspot?.iconPreset === 'preview' ? (hotspot?.targetSceneId || '') : '';
    els.hotspotIconFile.value = '';

    populateHotspotTargets(hotspot?.targetSceneId || '');
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
      info: type === 'info' ? els.hotspotInfo.value.trim() : ''
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
    if (!scene || !viewer) return;
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
      '  float lon=atan(-d.x,-d.z);',
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
              root.file(
                'multires/' + sceneDir + '/' + level + '/' + face + y + '_' + x + '.jpg',
                blob
              );
            }
          }
        }

        fallbackCtx.clearRect(0, 0, fallbackSize, fallbackSize);
        fallbackCtx.drawImage(faceCanvas, 0, 0, fallbackSize, fallbackSize);
        const fallbackBlob = await canvasToBlob(fallbackCanvas, 'image/jpeg', spec.quality);
        root.file('multires/' + sceneDir + '/fallback/' + face + '.jpg', fallbackBlob);

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
      thumbnail: makeMultiresThumbnail(image)
    };
  }

  function buildPortableTourConfig(sceneFiles, multiresScenes = new Map()) {
    const config = buildPannellumConfig({ useEmbeddedImages: false, firstSceneId: project.firstScene });
    project.scenes.forEach((scene) => {
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
    return config;
  }

  function exportedViewerHtml() {
    const title = escapeHtml(project.title || 'Виртуальная экскурсия');
    return '<!doctype html>\n' +
      '<html lang="ru">\n<head>\n' +
      '  <meta charset="utf-8">\n' +
      '  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
      '  <meta name="theme-color" content="#05070c">\n' +
      '  <title>' + title + '</title>\n' +
      '  <link rel="stylesheet" href="vendor/pannellum/build/pannellum.css">\n' +
      '  <link rel="stylesheet" href="assets/tour.css">\n' +
      '</head>\n<body>\n' +
      '  <div id="panorama"></div>\n' +
      '  <noscript>Для просмотра виртуального тура необходимо включить JavaScript.</noscript>\n' +
      '  <script src="vendor/pannellum/build/pannellum.js"></script>\n' +
      '  <script src="assets/tour.js"></script>\n' +
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
      'noscript{position:fixed;inset:0;display:grid;place-items:center;padding:30px;text-align:center;color:#fff;background:#05070c}\n';

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
    const json = JSON.stringify(config, null, 2).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
    return "(() => {\n" +
      "  'use strict';\n" +
      "  const config = " + json + ";\n" +
      "  const start = () => {\n" +
      "    if (!window.pannellum) {\n" +
      "      document.body.innerHTML = '<div style=\\\"padding:30px;color:white;background:#05070c;font-family:system-ui\\\">Не удалось загрузить Pannellum.</div>';\n" +
      "      return;\n" +
      "    }\n" +
      "    window.tourViewer = pannellum.viewer('panorama', config);\n" +
      "  };\n" +
      "  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });\n" +
      "  else start();\n" +
      "})();\n";
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

      if (project.settings.multiresEnabled) {
        for (let index = 0; index < project.scenes.length; index++) {
          const scene = project.scenes[index];
          const multi = await generateSceneMultires(
            root,
            scene,
            index,
            project.scenes.length,
            button
          );
          multiresScenes.set(scene.id, multi);
        }
      } else {
        project.scenes.forEach((scene, index) => {
          const ext = extensionForScene(scene);
          const baseName = safeFilename(scene.title || scene.id, 'panorama-' + (index + 1));
          let filename = baseName + '.' + ext;
          let suffix = 2;
          while (usedNames.has(filename.toLowerCase())) filename = baseName + '-' + suffix++ + '.' + ext;
          usedNames.add(filename.toLowerCase());
          sceneFiles.set(scene.id, filename);

          const payload = dataUrlPayload(scene.imageData);
          if (payload.base64) root.file('images/' + filename, payload.data, { base64: true });
          else root.file('images/' + filename, decodeURIComponent(payload.data));
        });
      }

      const config = buildPortableTourConfig(sceneFiles, multiresScenes);
      const customIconFiles = await bundleTransitionIcons(root);
      root.file('index.html', exportedViewerHtml());
      root.file('assets/tour.css', exportedViewerCss(customIconFiles));
      root.file('assets/tour.js', exportedViewerJs(config));
      root.file('tour.json', JSON.stringify(config, null, 2));
      root.file('README.txt',
        'Готовый виртуальный тур: ' + (project.title || 'Виртуальная экскурсия') + '\n\n' +
        'Содержимое:\n' +
        '- index.html — страница просмотра\n' +
        '- assets/tour.js — конфигурация и запуск тура\n' +
        '- assets/tour.css — оформление страницы\n' +
        '- images/ — исходные панорамы при обычном экспорте\n' +
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
      if (imported.scenes.some((scene) => !scene.imageData)) {
        throw new Error('В импортируемом проекте отсутствуют встроенные изображения');
      }

      project = imported;
      currentSceneId = project.firstScene || project.scenes[0].id;
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

  function openPreview() {
    if (!project.scenes.length || !window.pannellum) return;
    els.previewDialog.showModal();

    requestAnimationFrame(() => {
      if (previewViewer) {
        try { previewViewer.destroy(); } catch (_) {}
      }
      els.previewPanorama.innerHTML = '';
      previewViewer = pannellum.viewer('previewPanorama', buildPannellumConfig({
        useEmbeddedImages: true,
        firstSceneId: project.firstScene
      }));
    });
  }

  function closePreview() {
    if (previewViewer) {
      try { previewViewer.destroy(); } catch (_) {}
      previewViewer = null;
    }
    els.previewPanorama.innerHTML = '';
    if (els.previewDialog.open) els.previewDialog.close();
  }

  function applyProjectSettingChange() {
    project.title = els.projectTitle.value.trim() || 'Виртуальная экскурсия';
    project.firstScene = els.firstScene.value || project.scenes[0]?.id || null;
    project.settings.fadeEnabled = els.sceneFadeEnabled.checked;
    project.settings.fadeDuration = Math.max(0, Number(els.sceneFadeDuration.value) || 0);
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
    scene.pitch = Number(els.scenePitch.value) || 0;
    scene.yaw = Number(els.sceneYaw.value) || 0;
    scene.hfov = Math.min(120, Math.max(30, Number(els.sceneHfov.value) || 100));
    markDirty({ rerenderViewer: rerender });
  }

  function setupEvents() {
    els.btnAddScene.addEventListener('click', openSceneDialog);
    els.btnAddSceneCenter.addEventListener('click', openSceneDialog);

    els.newSceneImage.addEventListener('change', () => {
      const file = els.newSceneImage.files?.[0];
      els.newSceneFileName.textContent = file ? file.name : 'JPG, PNG или WEBP';
      if (file && !els.newSceneTitle.value.trim()) {
        els.newSceneTitle.value = file.name.replace(/\.[^.]+$/, '');
      }
    });

    els.sceneForm.addEventListener('submit', async (event) => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();

      const file = els.newSceneImage.files?.[0];
      const title = els.newSceneTitle.value.trim();
      if (!file || !title) {
        showToast('Укажите название и выберите панораму');
        return;
      }

      const button = event.submitter;
      if (button) button.disabled = true;
      try {
        await createSceneFromFile(file, title);
        els.sceneDialog.close();
      } catch (error) {
        console.error(error);
        showToast('Не удалось добавить панораму');
      } finally {
        if (button) button.disabled = false;
      }
    });

    els.sceneList.addEventListener('click', (event) => {
      const card = event.target.closest('[data-scene-id]');
      if (card) selectScene(card.dataset.sceneId);
    });

    els.hotspotList.addEventListener('click', (event) => {
      const card = event.target.closest('[data-hotspot-id]');
      if (!card) return;
      const scene = getScene();
      const hotspot = scene?.hotspots.find((item) => item.id === card.dataset.hotspotId);
      if (hotspot) openHotspotDialog(hotspot.pitch, hotspot.yaw, hotspot.id);
    });

    els.btnAddHotspot.addEventListener('click', () => {
      if (!viewer) return;
      openHotspotDialog(viewer.getPitch(), viewer.getYaw());
    });

    els.panorama.addEventListener('dblclick', (event) => {
      if (!viewer || !getScene()) return;
      try {
        const [pitch, yaw] = viewer.mouseEventToCoords(event);
        openHotspotDialog(pitch, yaw);
      } catch (error) {
        console.warn(error);
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

    els.sceneTitle.addEventListener('input', () => applySceneFieldChanges());
    els.scenePitch.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.sceneYaw.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));
    els.sceneHfov.addEventListener('change', () => applySceneFieldChanges({ rerender: true }));

    els.sceneImageReplace.addEventListener('change', async () => {
      const scene = getScene();
      const file = els.sceneImageReplace.files?.[0];
      if (!scene || !file) return;
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
      const file = [...event.dataTransfer?.files || []].find((item) => item.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      try {
        await createSceneFromFile(file, file.name.replace(/\.[^.]+$/, ''));
        showToast('Панорама добавлена');
      } catch (error) {
        console.error(error);
        showToast('Не удалось добавить панораму');
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
      try { previewViewer?.resize(); } catch (_) {}
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
    renderAll();
    setSaveState('saved');
  }

  init();
})();