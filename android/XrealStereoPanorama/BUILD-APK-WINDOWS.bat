@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title XREAL Stereo Panorama - APK Builder

echo ============================================================
echo   XREAL Stereo Panorama - сборка APK
echo ============================================================

echo [1/3] Проверка Android SDK...
if not defined ANDROID_HOME if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if not defined ANDROID_HOME (
  echo [ОШИБКА] Android SDK не найден. Установите Android Studio.
  pause & exit /b 1
)
>local.properties echo sdk.dir=%ANDROID_HOME:\=/%

echo [2/3] Поиск Gradle...
where gradle >nul 2>nul
if errorlevel 1 (
  set "GV=8.9"
  set "GD=%CD%\.gradle-dist"
  set "GH=!GD!\gradle-!GV!"
  if not exist "!GH!\bin\gradle.bat" (
    if not exist "!GD!" mkdir "!GD!"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest 'https://services.gradle.org/distributions/gradle-8.9-bin.zip' -OutFile '!GD!\g.zip'; Expand-Archive -Force '!GD!\g.zip' '!GD!'; Remove-Item '!GD!\g.zip'"
    if errorlevel 1 pause & exit /b 1
  )
  set "GRADLE=!GH!\bin\gradle.bat"
) else set "GRADLE=gradle"

echo [3/3] Сборка...
call "%GRADLE%" clean assembleDebug --no-daemon
if errorlevel 1 pause & exit /b 1
if not exist APK mkdir APK
copy /Y "app\build\outputs\apk\debug\app-debug.apk" "APK\XREAL-Stereo-Panorama-debug.apk" >nul
echo.
echo ГОТОВО: %CD%\APK\XREAL-Stereo-Panorama-debug.apk
explorer.exe /select,"%CD%\APK\XREAL-Stereo-Panorama-debug.apk"
pause
