# 3DPL Native Editor

Нативный Windows-редактор виртуальных туров на C++20 + Qt 6.

## Что уже перенесено

- нативное главное окно без WebView;
- загрузка старого JSON проекта с сохранением неизвестных полей;
- новый проект с файловой структурой assets/cache/multires;
- импорт 360-панорам без base64;
- нативный OpenGL 360 viewport;
- yaw/pitch/FOV;
- hotspot overlay;
- выбор hotspot кликом;
- создание hotspot двойным кликом;
- редактор параметров сцены и hotspot;
- создание заготовок Object360 / STL / XR;
- удаление сцен;
- Save / Save As;
- безопасная запись через QSaveFile;
- autosave каждые 30 секунд;
- тёмный desktop UI.

## Формат проекта

Новый редактор хранит тяжелые ресурсы файлами:

    project/
      project.json
      assets/
        panoramas/
        object360/
        stl/
        xr/
        audio/
      multires/
      thumbnails/
      cache/

Старые поля веб-редактора в JSON не удаляются при открытии/сохранении.

## Сборка Windows

Требуется Visual Studio 2022 C++ workload, CMake 3.24+ и Qt 6.8.x MSVC x64.

    cmake -S . -B build -G "Visual Studio 17 2022" -A x64
    cmake --build build --config Release

GitHub Actions автоматически делает portable ZIP с Qt runtime.