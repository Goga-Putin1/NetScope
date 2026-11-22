cmake_minimum_required(VERSION 3.20)

project(NetScopeBackend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.18.3
)

FetchContent_MakeAvailable(httplib)

# Main server: hosts the dashboard and receives agent metrics.
add_executable(netscope_backend
    src/main.cpp
    src/metrics.cpp
)
target_include_directories(netscope_backend PRIVATE include)
target_link_libraries(netscope_backend PRIVATE httplib::httplib iphlpapi ws2_32)

# Agent: collects metrics locally and sends them to the main server.
add_executable(netscope_agent
    src/agent.cpp
    src/metrics.cpp
)
target_include_directories(netscope_agent PRIVATE include)
target_link_libraries(netscope_agent PRIVATE httplib::httplib)
