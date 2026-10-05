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
    hotspotUrl: $('hotspotUrl'),
    hotspotInfo: $('hotspotInfo'),
    hotspotPitch: $('hotspotPitch'),
    hotspotYaw: $('hotspotYaw'),
    btnDeleteHotspot: $('btnDeleteHotspot'),
    previewDialog: $('previewDialog'),
    previewPanorama: $('previewPanorama'),
    closePreview: $('closePreview'),
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

  function createEmptyProject() {
    return {
      version: PROJECT_VERSION,
      title: 'Виртуальная экскурсия',
      firstScene: null,
      settings: {
        fadeEnabled: true,
        fadeDuration: 900,
        autoRotateEnabled: false,
        autoRotate: -2
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
      return `
        <article class="hotspot-card" data-hotspot-id="${escapeHtml(hotspot.id)}">
          <span class="hotspot-icon ${escapeHtml(hotspot.type)}">${icon}</span>
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
        sceneId: hotspot.targetSceneId
      };
    }

    if (hotspot.type === 'url') {
      return {
        ...base,
        type: 'info',
        URL: hotspot.url || '#',
        attributes: { target: '_blank', rel: 'noopener noreferrer' },
        cssClass: 'editor-url-hotspot'
      };
    }

    return {
      ...base,
      type: 'info',
      text: hotspot.info ? ((hotspot.text ? hotspot.text + ': ' : '') + hotspot.info) : hotspot.text
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
    els.btnDeleteHotspot.hidden = !hotspot;

    populateHotspotTargets(hotspot?.targetSceneId || '');
    setHotspotType(hotspot?.type || (project.scenes.length > 1 ? 'scene' : 'info'));
    els.hotspotDialog.showModal();
  }

  function saveHotspotFromDialog() {
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

  function saveCurrentView() {
    const scene = getScene();
    if (!scene || !viewer) return;
    scene.pitch = Number(viewer.getPitch().toFixed(2));
    scene.yaw = Number(viewer.getYaw().toFixed(2));
    scene.hfov = Number(viewer.getHfov().toFixed(1));
    markDirty();
    showToast('Стартовый ракурс сохранён');
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

  function exportTourConfig() {
    if (!project.scenes.length) {
      showToast('Сначала добавьте хотя бы одну сцену');
      return;
    }

    const config = buildPannellumConfig({ useEmbeddedImages: false, firstSceneId: project.firstScene });
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, safeFilename(project.title) + '.pannellum.json');
    showToast('Конфигурация Pannellum экспортирована');
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

    els.hotspotForm.addEventListener('submit', (event) => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      saveHotspotFromDialog();
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
        markDirty();
        renderViewer();
        showToast('Панорама заменена');
      } catch (error) {
        console.error(error);
        showToast('Не удалось заменить панораму');
      } finally {
        els.sceneImageReplace.value = '';
      }
    });

    els.btnExportProject.addEventListener('click', exportProject);
    els.btnExportTour.addEventListener('click', exportTourConfig);
    els.projectImport.addEventListener('change', () => importProjectFile(els.projectImport.files?.[0]));

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