@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title Object360Capture - APK Builder

echo ============================================================
echo   Object360Capture - сборка APK для Windows
echo ============================================================
echo.

rem ------------------------------------------------------------
rem 1. Java / JDK
rem ------------------------------------------------------------
set "JAVA_CMD="

if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" (
    set "JAVA_CMD=%JAVA_HOME%\bin\java.exe"
)

if not defined JAVA_CMD if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
    set "JAVA_CMD=%JAVA_HOME%\bin\java.exe"
)

if not defined JAVA_CMD (
    for /f "delims=" %%J in ('where java 2^>nul') do (
        if not defined JAVA_CMD set "JAVA_CMD=%%J"
    )
)

if not defined JAVA_CMD (
    echo [ОШИБКА] Java не найдена.
    echo.
    echo Установите Android Studio или JDK 17+.
    echo Рекомендуемый вариант:
    echo   https://developer.android.com/studio
    echo.
    pause
    exit /b 1
)

if not defined JAVA_HOME (
    for %%I in ("%JAVA_CMD%") do set "JAVA_BIN_DIR=%%~dpI"
    for %%I in ("!JAVA_BIN_DIR!..") do set "JAVA_HOME=%%~fI"
)

set "PATH=%JAVA_HOME%\bin;%PATH%"

echo [OK] Java:
"%JAVA_CMD%" -version
if errorlevel 1 (
    echo [ОШИБКА] Java найдена, но не запускается.
    pause
    exit /b 1
)
echo.

rem ------------------------------------------------------------
rem 2. Android SDK / local.properties
rem ------------------------------------------------------------
if not exist "local.properties" (
    set "SDK_DIR="

    if defined ANDROID_HOME if exist "%ANDROID_HOME%" set "SDK_DIR=%ANDROID_HOME%"
    if not defined SDK_DIR if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%" set "SDK_DIR=%ANDROID_SDK_ROOT%"
    if not defined SDK_DIR if exist "%LOCALAPPDATA%\Android\Sdk" set "SDK_DIR=%LOCALAPPDATA%\Android\Sdk"

    if not defined SDK_DIR (
        echo [ОШИБКА] Android SDK не найден.
        echo.
        echo Откройте Android Studio - SDK Manager и установите Android SDK.
        echo После этого снова запустите этот BAT-файл.
        echo.
        pause
        exit /b 1
    )

    set "SDK_PROP=!SDK_DIR:\=/!"
    >"local.properties" echo sdk.dir=!SDK_PROP!
    echo [OK] Создан local.properties:
    echo      !SDK_DIR!
) else (
    echo [OK] local.properties найден.
)
echo.

rem ------------------------------------------------------------
rem 3. Gradle
rem ------------------------------------------------------------
set "GRADLE_CMD="

if exist "gradle\wrapper\gradle-wrapper.jar" if exist "gradlew.bat" (
    set "GRADLE_CMD=%CD%\gradlew.bat"
)

if not defined GRADLE_CMD (
    where gradle >nul 2>nul
    if not errorlevel 1 set "GRADLE_CMD=gradle"
)

if not defined GRADLE_CMD (
    set "GRADLE_VERSION=9.6.0"
    set "GRADLE_ROOT=%CD%\.gradle-dist"
    set "GRADLE_HOME_LOCAL=!GRADLE_ROOT!\gradle-!GRADLE_VERSION!"
    set "GRADLE_ZIP=!GRADLE_ROOT!\gradle-!GRADLE_VERSION!-bin.zip"

    if not exist "!GRADLE_HOME_LOCAL!\bin\gradle.bat" (
        echo [INFO] Gradle !GRADLE_VERSION! не найден.
        echo [INFO] Скачиваю Gradle автоматически...

        if not exist "!GRADLE_ROOT!" mkdir "!GRADLE_ROOT!"

        powershell -NoProfile -ExecutionPolicy Bypass -Command ^
          "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://services.gradle.org/distributions/gradle-9.6.0-bin.zip' -OutFile '!GRADLE_ZIP!'"

        if errorlevel 1 (
            echo.
            echo [ОШИБКА] Не удалось скачать Gradle.
            echo Проверьте подключение к Интернету или установите Gradle вручную.
            pause
            exit /b 1
        )

        echo [INFO] Распаковываю Gradle...
        powershell -NoProfile -ExecutionPolicy Bypass -Command ^
          "$ErrorActionPreference='Stop'; Expand-Archive -Force '!GRADLE_ZIP!' '!GRADLE_ROOT!'"

        if errorlevel 1 (
            echo [ОШИБКА] Не удалось распаковать Gradle.
            pause
            exit /b 1
        )

        del /q "!GRADLE_ZIP!" >nul 2>nul
    )

    set "GRADLE_CMD=!GRADLE_HOME_LOCAL!\bin\gradle.bat"
)

echo [OK] Gradle:
call "%GRADLE_CMD%" --version
if errorlevel 1 (
    echo [ОШИБКА] Gradle не запускается.
    pause
    exit /b 1
)
echo.

rem ------------------------------------------------------------
rem 4. Build debug APK
rem ------------------------------------------------------------
echo ============================================================
echo   СБОРКА APK
echo ============================================================
echo.

call "%GRADLE_CMD%" clean assembleDebug --no-daemon

if errorlevel 1 (
    echo.
    echo ============================================================
    echo   СБОРКА ЗАВЕРШИЛАСЬ С ОШИБКОЙ
    echo ============================================================
    echo.
    echo Посмотрите сообщения выше.
    pause
    exit /b 1
)

rem ------------------------------------------------------------
rem 5. Copy result
rem ------------------------------------------------------------
set "SOURCE_APK=%CD%\app\build\outputs\apk\debug\app-debug.apk"
set "OUTPUT_DIR=%CD%\APK"
set "OUTPUT_APK=!OUTPUT_DIR!\Object360Capture-debug.apk"

if not exist "!SOURCE_APK!" (
    echo.
    echo [ОШИБКА] Gradle завершился успешно, но APK не найден:
    echo !SOURCE_APK!
    pause
    exit /b 1
)

if not exist "!OUTPUT_DIR!" mkdir "!OUTPUT_DIR!"
copy /Y "!SOURCE_APK!" "!OUTPUT_APK!" >nul

echo.
echo ============================================================
echo   ГОТОВО
echo ============================================================
echo.
echo APK:
echo   !OUTPUT_APK!
echo.
echo Это DEBUG APK - его можно сразу установить на Android.
echo Для установки разрешите установку приложений из неизвестных источников.
echo.

explorer.exe /select,"!OUTPUT_APK!" >nul 2>nul
pause
exit /b 0
