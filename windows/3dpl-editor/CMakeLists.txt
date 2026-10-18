cmake_minimum_required(VERSION 3.24)
project(ThreeDplEditor VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS
    Core Gui Widgets OpenGL OpenGLWidgets Multimedia Concurrent
)

qt_standard_project_setup()

qt_add_executable(3dpl-editor WIN32
    src/main.cpp
    src/MainWindow.cpp
    src/MainWindow.h
    src/model/Project.cpp
    src/model/Project.h
    src/model/Scene.cpp
    src/model/Scene.h
    src/model/Hotspot.cpp
    src/model/Hotspot.h
    src/io/ProjectStorage.cpp
    src/io/ProjectStorage.h
    src/render/PanoramaViewport.cpp
    src/render/PanoramaViewport.h
)

target_include_directories(3dpl-editor PRIVATE src)

target_link_libraries(3dpl-editor PRIVATE
    Qt6::Core Qt6::Gui Qt6::Widgets
    Qt6::OpenGL Qt6::OpenGLWidgets
    Qt6::Multimedia Qt6::Concurrent
)

if(MSVC)
    target_compile_options(3dpl-editor PRIVATE /W4 /permissive- /utf-8)
else()
    target_compile_options(3dpl-editor PRIVATE -Wall -Wextra -Wpedantic)
endif()

install(TARGETS 3dpl-editor
    RUNTIME DESTINATION .
)

qt_generate_deploy_app_script(
    TARGET 3dpl-editor
    OUTPUT_SCRIPT deploy_script
    NO_UNSUPPORTED_PLATFORM_ERROR
)
install(SCRIPT ${deploy_script})
