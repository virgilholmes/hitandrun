cmake_minimum_required(VERSION 3.20)
project(original_game_browser_port LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 14)
set(STAGED_SOURCE "" CACHE PATH "Source prepared by scripts/prepare-game-source.py")
if(NOT EXISTS "${STAGED_SOURCE}/code/main/game.cpp")
 message(FATAL_ERROR "Run scripts/prepare-game-source.py first and set STAGED_SOURCE")
endif()
set(LIBS "${STAGED_SOURCE}/libs")
# Real original gameplay translation units. This target is intentionally not
# linked until platform and engine library implementations are ported.
include("${STAGED_SOURCE}/../game_sources.cmake")
add_library(gameplay_objects OBJECT ${ORIGINAL_GAMEPLAY_SOURCES})
target_compile_definitions(gameplay_objects PRIVATE RAD_WEB RAD_LINUX LINUX RAD_PC RAD_DEBUG RADMATH_NOASM)
target_compile_options(gameplay_objects PRIVATE "-fexceptions" "-ferror-limit=8" "-include" "${STAGED_SOURCE}/code/main/pchsrr2.h")
target_include_directories(gameplay_objects PRIVATE
 "${CMAKE_CURRENT_SOURCE_DIR}/include"
 "${STAGED_SOURCE}/code" "${LIBS}/radcore/inc" "${LIBS}/radmovie/inc"
 "${LIBS}/radsound/inc" "${LIBS}/radscript/inc" "${LIBS}/radmusic/inc"
 "${LIBS}/pure3d" "${LIBS}/scrooby/inc" "${LIBS}/scrooby/src"
 "${LIBS}/radmath" "${LIBS}/sim" "${LIBS}/poser/inc" "${LIBS}/choreo/inc"
 "${LIBS}/radcontent/inc")

add_library(browser_foundation STATIC browser_clock.cpp browser_debug.cpp)
target_compile_definitions(browser_foundation PUBLIC RAD_WEB RAD_PC RAD_DEBUG)
target_include_directories(browser_foundation PUBLIC "${STAGED_SOURCE}/libs/radcore/inc")
add_executable(foundation_clock_smoke clock_smoke.cpp)
target_link_libraries(foundation_clock_smoke PRIVATE browser_foundation)
set_target_properties(foundation_clock_smoke PROPERTIES SUFFIX ".mjs")
target_link_options(foundation_clock_smoke PRIVATE "-sENVIRONMENT=node" "-sEXIT_RUNTIME=1")

# Build the original engine libraries as well as gameplay. Hardware backends
# remain explicit source-port work; no missing symbols are suppressed.
include("${STAGED_SOURCE}/../library_sources.cmake")
add_library(game_port_config INTERFACE)
target_compile_definitions(game_port_config INTERFACE RAD_WEB RAD_LINUX LINUX RAD_PC RAD_DEBUG RADMATH_NOASM)
target_compile_options(game_port_config INTERFACE "$<$<COMPILE_LANGUAGE:CXX>:-fexceptions>" "-ferror-limit=8")
target_include_directories(game_port_config INTERFACE
 "${CMAKE_CURRENT_SOURCE_DIR}/include" "${STAGED_SOURCE}/code"
 "${LIBS}/radcore/inc" "${LIBS}/radcontent/inc" "${LIBS}/radmath"
 "${LIBS}/pure3d" "${LIBS}/poser/inc" "${LIBS}/sim" "${LIBS}/choreo/inc"
 "${LIBS}/scrooby/inc" "${LIBS}/scrooby/src" "${LIBS}/radscript/inc"
 "${LIBS}/radsound/inc" "${LIBS}/radmusic/inc" "${LIBS}/radmovie/inc")
foreach(name radcore radcontent pure3d choreo poser sim radscript radmusic scrooby radsound radmovie png zlib)
 if(ORIGINAL_${name}_SOURCES)
  add_library(original_${name} STATIC ${ORIGINAL_${name}_SOURCES})
  target_link_libraries(original_${name} PRIVATE game_port_config)
  target_include_directories(original_${name} PRIVATE ${ORIGINAL_${name}_INCLUDES})
  if(NOT name STREQUAL "png" AND NOT name STREQUAL "zlib")
   target_compile_options(original_${name} PRIVATE "$<$<COMPILE_LANGUAGE:CXX>:-include>" "$<$<COMPILE_LANGUAGE:CXX>:${STAGED_SOURCE}/code/main/pchsrr2.h>")
  endif()
 endif()
endforeach()

# Pure3D uses the supplied libpng custom allocator ABI.
target_compile_definitions(original_png PRIVATE PNG_USER_MEM_SUPPORTED)
target_compile_definitions(original_pure3d PRIVATE PNG_USER_MEM_SUPPORTED)
target_include_directories(original_pure3d BEFORE PRIVATE "${LIBS}/pure3d/lib/libpng")
set(MATH_NAMES radmath matrix vector quaternion trig random plane triangle numerical spline)
list(TRANSFORM MATH_NAMES PREPEND "${LIBS}/radmath/radmath/")
list(TRANSFORM MATH_NAMES APPEND ".cpp")
add_library(original_radmath STATIC ${MATH_NAMES})
target_link_libraries(original_radmath PRIVATE game_port_config)

add_executable(physics_smoke physics_smoke.cpp)
target_link_libraries(physics_smoke PRIVATE game_port_config original_sim original_radmath browser_foundation)
set_target_properties(physics_smoke PROPERTIES SUFFIX ".mjs")
target_link_options(physics_smoke PRIVATE "-sENVIRONMENT=node" "-sEXIT_RUNTIME=1")

add_library(original_pddi_gl STATIC browser_display.cpp
 "${LIBS}/pure3d/pddi/gl/gldev.cpp"
 "${LIBS}/pure3d/pddi/gl/glcon.cpp"
 "${LIBS}/pure3d/pddi/gl/glmat.cpp"
 "${LIBS}/pure3d/pddi/gl/gltex.cpp"
 "${LIBS}/pure3d/pddi/base/basecontext.cpp"
 "${LIBS}/pure3d/pddi/base/baseshader.cpp"
 "${LIBS}/pure3d/pddi/base/pddiobj.cpp"
 "${LIBS}/pure3d/pddi/base/font.cpp")
target_link_libraries(original_pddi_gl PRIVATE game_port_config)

target_compile_options(original_pddi_gl PRIVATE "-include" "cstdlib")

add_executable(renderer_smoke EXCLUDE_FROM_ALL renderer_smoke.cpp)
target_link_libraries(renderer_smoke PRIVATE game_port_config original_pddi_gl original_radmath browser_foundation)
set_target_properties(renderer_smoke PROPERTIES SUFFIX ".html")
target_link_options(renderer_smoke PRIVATE "-sLEGACY_GL_EMULATION=1" "-sALLOW_MEMORY_GROWTH=1" "-sENVIRONMENT=web" "-sASSERTIONS=2")

add_library(browser_vcall STATIC browser_vcall.cpp)
target_link_libraries(browser_vcall PRIVATE game_port_config)
target_sources(original_radscript PRIVATE browser_vcall.cpp)
add_executable(vcall_smoke vcall_smoke.cpp)
target_link_libraries(vcall_smoke PRIVATE game_port_config browser_vcall)
set_target_properties(vcall_smoke PROPERTIES SUFFIX ".mjs")
target_link_options(vcall_smoke PRIVATE "-sENVIRONMENT=node" "-sEXIT_RUNTIME=1" "-fexceptions")

find_package(Python3 REQUIRED COMPONENTS Interpreter)
set(ADAPTED_GL "${CMAKE_CURRENT_BINARY_DIR}/browser-glemu.js")
execute_process(COMMAND "${Python3_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/prepare_gl.py"
 "${EMSCRIPTEN_ROOT_PATH}/src/lib/libglemu.js" "${ADAPTED_GL}"
 COMMAND_ERROR_IS_FATAL ANY)
target_link_options(renderer_smoke PRIVATE "--js-library=${ADAPTED_GL}")
set_property(TARGET renderer_smoke APPEND PROPERTY LINK_DEPENDS "${ADAPTED_GL}")
target_link_options(renderer_smoke PRIVATE "-sSINGLE_FILE=1" "-sEXIT_RUNTIME=1"
 "--shell-file=${CMAKE_CURRENT_SOURCE_DIR}/renderer-shell.html")
set_property(TARGET renderer_smoke APPEND PROPERTY LINK_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/renderer-shell.html")

add_library(browser_fibers STATIC browser_fibers.cpp)
target_link_libraries(browser_fibers PRIVATE game_port_config)
add_executable(fibers_smoke fibers_smoke.cpp)
target_link_libraries(fibers_smoke PRIVATE game_port_config browser_fibers)
set_target_properties(fibers_smoke PROPERTIES SUFFIX ".mjs")
target_link_options(fibers_smoke PRIVATE "-sENVIRONMENT=node" "-sEXIT_RUNTIME=1" "-sASYNCIFY=1" "-fexceptions")

add_executable(gl_state_smoke gl_state_smoke.cpp)
set_target_properties(gl_state_smoke PROPERTIES SUFFIX ".mjs")
target_link_options(gl_state_smoke PRIVATE "-sLEGACY_GL_EMULATION=1" "-sENVIRONMENT=node" "-sEXIT_RUNTIME=1" "--js-library=${ADAPTED_GL}")
set_property(TARGET gl_state_smoke APPEND PROPERTY LINK_DEPENDS "${ADAPTED_GL}")

target_link_options(renderer_smoke PRIVATE "-sGL_UNSAFE_OPTS=0")
target_link_options(gl_state_smoke PRIVATE "-sGL_UNSAFE_OPTS=0")
