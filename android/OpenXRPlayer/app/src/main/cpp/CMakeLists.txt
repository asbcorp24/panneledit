cmake_minimum_required(VERSION 3.22.1)
project(openxrplayer LANGUAGES C CXX)

find_package(OpenXR REQUIRED CONFIG)

add_library(app_glue STATIC
    ${ANDROID_NDK}/sources/android/native_app_glue/android_native_app_glue.c
)
target_include_directories(app_glue PUBLIC
    ${ANDROID_NDK}/sources/android/native_app_glue
)

add_library(openxrplayer SHARED
    openxr_player.cpp
    video_player.cpp
)

target_compile_features(openxrplayer PRIVATE cxx_std_20)
target_compile_definitions(openxrplayer PRIVATE
    XR_USE_PLATFORM_ANDROID
    XR_USE_GRAPHICS_API_OPENGL_ES
)

find_library(log-lib log)
find_library(android-lib android)
find_library(egl-lib EGL)
find_library(gles-lib GLESv3)
find_library(jnigraphics-lib jnigraphics)

target_link_libraries(openxrplayer PRIVATE
    app_glue
    OpenXR::openxr_loader
    ${android-lib}
    ${log-lib}
    ${egl-lib}
    ${gles-lib}
    ${jnigraphics-lib}
)
