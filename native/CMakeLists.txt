cmake_minimum_required(VERSION 3.20)
project(hit_and_run_port LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(SHR_SOURCE "" CACHE PATH "Original Hit & Run source folder")
if(NOT EXISTS "${SHR_SOURCE}/game/libs/radmath/radmath/radmath.cpp")
  message(FATAL_ERROR "Set SHR_SOURCE to the original source folder")
endif()
set(RADMATH "${SHR_SOURCE}/game/libs/radmath")
# Keep original files intact. Overlay just the platform validation so portable
# C++ paths can compile without selecting Windows or console assembly.
file(READ "${RADMATH}/radmath/buildconfig.hpp" CONFIG)
string(REPLACE "&& !defined(RAD_WIN32)" "&& !defined(RAD_WIN32) && !defined(RAD_PORTABLE)" CONFIG "${CONFIG}")
file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/include/radmath")
file(WRITE "${CMAKE_BINARY_DIR}/include/radmath/buildconfig.hpp" "${CONFIG}")
file(READ "${RADMATH}/radmath/util.hpp" UTIL)
string(REPLACE "#include <math.h>" "#include <math.h>\n#include <cmath>" UTIL "${UTIL}")
string(REPLACE "_isnan(n)" "std::isnan(n)" UTIL "${UTIL}")
file(WRITE "${CMAKE_BINARY_DIR}/include/radmath/util.hpp" "${UTIL}")
set(MATH_SOURCES radmath matrix vector quaternion trig random plane triangle numerical spline)
list(TRANSFORM MATH_SOURCES PREPEND "${RADMATH}/radmath/")
list(TRANSFORM MATH_SOURCES APPEND ".cpp")
add_library(radmath STATIC ${MATH_SOURCES})
# Legacy source uses register; compile it in its compatible language mode.
set_target_properties(radmath PROPERTIES CXX_STANDARD 14)
target_include_directories(radmath PUBLIC "${CMAKE_BINARY_DIR}/include" "${RADMATH}")
target_compile_definitions(radmath PUBLIC RAD_PORTABLE RAD_PC RAD_DEBUG RADMATH_NOASM)
add_library(radmath_bridge STATIC math_bridge.cpp)
target_link_libraries(radmath_bridge PUBLIC radmath)
add_executable(math_smoke math_smoke.cpp)
target_link_libraries(math_smoke PRIVATE radmath_bridge)
enable_testing()
add_test(NAME original_radmath COMMAND math_smoke)

if(EMSCRIPTEN)
  add_executable(radmath_web math_bridge.cpp)
  target_link_libraries(radmath_web PRIVATE radmath)
  set_target_properties(radmath_web PROPERTIES
    OUTPUT_NAME radmath SUFFIX ".mjs"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../public/engine")
  target_link_options(radmath_web PRIVATE
    "--no-entry" "-sMODULARIZE=1" "-sEXPORT_ES6=1"
    "-sEXPORT_NAME=createRadMathModule" "-sALLOW_MEMORY_GROWTH=1"
    "-sENVIRONMENT=web,node"
    "-sEXPORTED_FUNCTIONS=[\"_hr_math_init\",\"_hr_math_normalize3\",\"_hr_math_transform3\",\"_malloc\",\"_free\"]")
endif()

# Our own source port. Uses the supplied original code, never upstream SRR2.js
# or SRR2.wasm. portable/include contains adapters written in this workspace.
set(PURE3D "${SHR_SOURCE}/game/libs/pure3d")
add_library(original_p3d_chunks STATIC "${PURE3D}/p3d/chunkfile.cpp")
target_include_directories(original_p3d_chunks PUBLIC
  "${CMAKE_CURRENT_SOURCE_DIR}/portable/include" "${PURE3D}")
add_library(source_core STATIC source_core.cpp)
target_link_libraries(source_core PUBLIC original_p3d_chunks radmath_bridge)
add_executable(source_smoke source_smoke.cpp)
target_link_libraries(source_smoke PRIVATE source_core)
add_test(NAME original_pure3d_chunks COMMAND source_smoke
  "${SHR_SOURCE}/game/cd/PC/art/cars/famil_v.p3d"
  "${SHR_SOURCE}/game/cd/PC/art/l1r1.p3d")
if(EMSCRIPTEN)
  add_executable(source_core_web source_core.cpp math_bridge.cpp)
  target_link_libraries(source_core_web PRIVATE original_p3d_chunks radmath)
  set_target_properties(source_core_web PROPERTIES OUTPUT_NAME "source-core" SUFFIX ".mjs"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../public/our-port")
  target_compile_options(original_p3d_chunks PRIVATE "-fexceptions")
  target_compile_options(source_core_web PRIVATE "-fexceptions")
  target_link_options(source_core_web PRIVATE "--no-entry" "-fexceptions"
    "-sMODULARIZE=1" "-sEXPORT_ES6=1" "-sALLOW_MEMORY_GROWTH=1"
    "-sENVIRONMENT=web,node" "-sEXPORTED_RUNTIME_METHODS=[\"UTF8ToString\",\"HEAPU8\"]"
    "-sEXPORTED_FUNCTIONS=[\"_hr_source_probe\",\"_hr_source_chunk_count\",\"_hr_source_mesh_count\",\"_hr_source_texture_count\",\"_hr_source_last_error\",\"_hr_math_init\",\"_hr_math_normalize3\",\"_hr_math_transform3\",\"_malloc\",\"_free\"]")
endif()
