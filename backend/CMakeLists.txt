cmake_minimum_required(VERSION 3.20)

project(NetScopeBackend LANGUAGES CXX)

set(CMAKE_CXX STANDARD_17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
																	
include (FetchContent)

FetchContent_Declare (
	httplib
	GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
	GIT_TAG v0.18.3
)

FetchContent_MakeAvailable(httplib)

add_executable(netscope_backend
src/main.cpp
src/metrics.cpp
 )
 target_include_directories(netscope_backend PRIVATE include)

 target_link_libraries(netscope_backend PRIVATE httplib::httplib)