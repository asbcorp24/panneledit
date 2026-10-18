cmake_minimum_required(VERSION 3.24)
project(ThreeDPL_Editor VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS
    Core Gui Widgets OpenGL OpenGLWidgets
)

qt_standard_project_setup()

qt_add_executable(3DPLEditor WIN32
    src/main.cpp
    src/MainWindow.h
    src/MainWindow.cpp
    src/ProjectDocument.h
    src/ProjectDocument.cpp
    src/PanoramaViewport.h
    src/PanoramaViewport.cpp
    src/SceneInspector.h
    src/SceneInspector.cpp
)

target_link_libraries(3DPLEditor PRIVATE
    Qt6::Core Qt6::Gui Qt6::Widgets Qt6::OpenGL Qt6::OpenGLWidgets
)

target_compile_definitions(3DPLEditor PRIVATE
    QT_NO_KEYWORDS
    THREE_DPL_EDITOR_VERSION="${PROJECT_VERSION}"
)

if(MSVC)
    target_compile_options(3DPLEditor PRIVATE /W4 /permissive-)
else()
    target_compile_options(3DPLEditor PRIVATE -Wall -Wextra -Wpedantic)
endif()

install(TARGETS 3DPLEditor
    RUNTIME DESTINATION .
)
