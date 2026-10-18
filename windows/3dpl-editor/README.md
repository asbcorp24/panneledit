# 3DPL Editor

Нативный Windows-редактор виртуальных туров на C++20 + Qt 6.

## Цели

- без HTML/WebView/Electron;
- проект хранится в папке на диске;
- тяжёлые assets не кодируются в base64;
- нативный OpenGL viewport;
- единый формат для Web Player / Android TourPlayer / OpenXRPlayer;
- постепенный перенос всех функций из текущего веб-редактора.

## Сборка

Требуется Qt 6.5+ MSVC 2022.

```bat
cmake -S . -B build -G Ninja -DCMAKE_PREFIX_PATH=C:\Qt\6.8.3\msvc2022_64
cmake --build build --config Release
```

## Текущий формат проекта

```
MyTour.3dpl/
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
```
