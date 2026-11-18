cmake_minimum_required(VERSION 3.20)

project(NetScopeBackend LANGUAGES CXX)

set(CMAKE_CXX STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(netscope_backend
src/main.cpp
src/metrics.cpp
 )
 target_include_directories(netscope_backend PRIVATE include)