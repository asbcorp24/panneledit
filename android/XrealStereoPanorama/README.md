# XREAL Stereo Panorama Capture

Нативное Android-приложение для XREAL Beam Pro. Оно ищет заднюю `LOGICAL_MULTI_CAMERA` Camera2-камеру с двумя физическими сенсорами, открывает оба physical camera output одновременно и для каждой позиции круговой панорамы сохраняет синхронную пару JPEG.

## Что делает версия 1.0

- автоматически ищет стереопару Beam Pro через Camera2;
- показывает preview;
- направляет пользователя по кругу 360°;
- варианты 12 / 18 / 24 / 36 позиций;
- проверяет азимут и наклон перед снимком;
- на каждой позиции делает `left_NNN.jpg` + `right_NNN.jpg`;
- записывает `session.json` с углами, временем, Camera ID и разрешением;
- экспортирует всю сессию ZIP в `Download/XREAL_StereoPanorama`;
- экран «Камеры» показывает Camera2 ID, physical IDs и sensor sync type.

## Ограничение первой версии

Публичная документация XREAL подтверждает две 50 МП 3D-камеры Beam Pro, но не документирует отдельный публичный API для штатного режима Spatial Camera. Поэтому приложение использует стандартный Android Camera2 logical/physical multi-camera API. Если прошивка Beam Pro не предоставляет стереопару сторонним APK, экран «Камеры» это сразу покажет.

## Результат

```
session.json
left_000.jpg
right_000.jpg
left_001.jpg
right_001.jpg
...
```

Это исходный стереонабор для независимой склейки левого и правого глаза в две equirectangular-панорамы.

## Windows

Запустите `BUILD-APK-WINDOWS.bat`. Готовый файл появится в `APK/XREAL-Stereo-Panorama-debug.apk`.
