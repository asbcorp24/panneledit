cmake_minimum_required(VERSION 3.24)
project(3DPLStudio VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS
    Core Gui Widgets OpenGL OpenGLWidgets
)

qt_add_executable(3DPLStudio WIN32
    src/main.cpp
    src/MainWindow.cpp
    src/MainWindow.h
    src/ProjectModel.cpp
    src/ProjectModel.h
    src/PanoramaView.cpp
    src/PanoramaView.h
    src/ZipWriter.cpp
    src/ZipWriter.h
)

target_link_libraries(3DPLStudio PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::OpenGL
    Qt6::OpenGLWidgets
)

if(MSVC)
    target_compile_options(3DPLStudio PRIVATE /W4 /permissive-)
else()
    target_compile_options(3DPLStudio PRIVATE -Wall -Wextra -Wpedantic)
endif()

install(TARGETS 3DPLStudio
    RUNTIME DESTINATION .
)

qt_generate_deploy_app_script(
    TARGET 3DPLStudio
    OUTPUT_SCRIPT deploy_script
    NO_UNSUPPORTED_PLATFORM_ERROR
)
install(SCRIPT ${deploy_script})
