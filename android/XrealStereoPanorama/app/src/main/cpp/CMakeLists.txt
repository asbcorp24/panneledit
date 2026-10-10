cmake_minimum_required(VERSION 3.22.1)
project(xrealstereo)

add_library(xrealstereo SHARED
    native-lib.cpp
    v4l2_probe.cpp
)

find_library(log-lib log)
find_library(dl-lib dl)

target_include_directories(xrealstereo PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(xrealstereo ${log-lib} ${dl-lib})
