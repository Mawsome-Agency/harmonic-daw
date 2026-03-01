cmake_minimum_required(VERSION 3.22)
project(HarmonicEngine VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ─── JUCE ─────────────────────────────────────────────────────────────────────
# Set JUCE_DIR via env or cmake variable: -DJUCE_DIR=/path/to/JUCE
if(DEFINED ENV{JUCE_DIR})
  set(JUCE_DIR "$ENV{JUCE_DIR}")
endif()

if(NOT DEFINED JUCE_DIR)
  message(STATUS "JUCE_DIR not set — looking in system paths")
  find_path(JUCE_DIR "modules/juce_core/juce_core.h"
    PATHS
      "${CMAKE_SOURCE_DIR}/../JUCE"
      "${CMAKE_SOURCE_DIR}/../../JUCE"
      "$ENV{HOME}/JUCE"
      "/opt/JUCE"
  )
endif()

if(NOT EXISTS "${JUCE_DIR}/CMakeLists.txt")
  message(FATAL_ERROR
    "JUCE not found at '${JUCE_DIR}'.\n"
    "Install JUCE 7 and set -DJUCE_DIR=/path/to/JUCE\n"
    "or set the JUCE_DIR environment variable.")
endif()

add_subdirectory("${JUCE_DIR}" "${CMAKE_BINARY_DIR}/JUCE")

# ─── Node.js N-API bindings ────────────────────────────────────────────────────
find_package(Python3 COMPONENTS Interpreter)
execute_process(
  COMMAND node -e "process.stdout.write(require('node-addon-api').include)"
  WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
  OUTPUT_VARIABLE NODE_ADDON_API_DIR
  RESULT_VARIABLE NODE_ADDON_API_RESULT
)
execute_process(
  COMMAND node -e "process.stdout.write(process.execPath)"
  OUTPUT_VARIABLE NODE_EXECUTABLE
)
execute_process(
  COMMAND node -e "process.stdout.write(require('node-gyp-build/package.json').version)"
  WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
  OUTPUT_VARIABLE NODE_GYP_VERSION
)
execute_process(
  COMMAND node -p "require('node-addon-api').targets"
  WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
  OUTPUT_VARIABLE NAPI_VERSION
)

# Get Node.js include paths
execute_process(
  COMMAND node -e "process.stdout.write(process.version)"
  OUTPUT_VARIABLE NODE_VERSION
)
message(STATUS "Building against Node.js ${NODE_VERSION}")

# ─── Engine library ───────────────────────────────────────────────────────────
juce_add_plugin(HarmonicEnginePlugin
  COMPANY_NAME "Harmonic"
  PLUGIN_MANUFACTURER_CODE "HRMC"
  PLUGIN_CODE "HDAW"
  FORMATS Standalone  # standalone for testing; actual hosting via NAPI
  PRODUCT_NAME "HarmonicEngine"
  IS_SYNTH FALSE
  NEEDS_MIDI_INPUT TRUE
  NEEDS_MIDI_OUTPUT TRUE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
)

# ─── NAPI shared library (loaded by Electron) ─────────────────────────────────
add_library(harmonic_engine SHARED
  src/audio/AudioEngine.cpp
  src/audio/AudioDeviceManager.cpp
  src/audio/ProcessingGraph.cpp
  src/audio/TrackProcessor.cpp
  src/midi/MidiEngine.cpp
  src/midi/MidiClock.cpp
  src/midi/MidiInputCollector.cpp
  src/plugins/PluginHost.cpp
  src/plugins/PluginScanner.cpp
  src/plugins/PluginSandbox.cpp
  src/ipc/NapiBinding.cpp
  src/ipc/IpcBridge.cpp
)

set_target_properties(harmonic_engine PROPERTIES
  PREFIX ""
  SUFFIX ".node"
  CXX_STANDARD 17
)

target_compile_definitions(harmonic_engine PRIVATE
  JUCE_USE_CURL=0
  JUCE_WEB_BROWSER=0
  JUCE_MODAL_LOOPS_PERMITTED=0
  NAPI_VERSION=8
)

target_include_directories(harmonic_engine PRIVATE
  include/
  ${NODE_ADDON_API_DIR}
)

target_link_libraries(harmonic_engine PRIVATE
  juce::juce_audio_basics
  juce::juce_audio_devices
  juce::juce_audio_formats
  juce::juce_audio_processors
  juce::juce_audio_utils
  juce::juce_core
  juce::juce_data_structures
  juce::juce_events
  juce::juce_graphics
  juce::juce_gui_basics
)

# Platform-specific flags
if(APPLE)
  target_link_libraries(harmonic_engine PRIVATE
    "-framework CoreAudio"
    "-framework AudioUnit"
    "-framework AudioToolbox"
    "-framework CoreMIDI"
    "-framework Accelerate"
  )
  set_target_properties(harmonic_engine PROPERTIES
    MACOSX_BUNDLE FALSE
    LINK_FLAGS "-undefined dynamic_lookup"
  )
elseif(WIN32)
  target_compile_definitions(harmonic_engine PRIVATE
    _WIN32_WINNT=0x0A00
    WINVER=0x0A00
  )
  target_link_libraries(harmonic_engine PRIVATE
    winmm ole32 uuid
  )
endif()

# ─── Test executable ──────────────────────────────────────────────────────────
add_executable(engine_tests
  src/audio/AudioEngine.cpp
  src/audio/AudioDeviceManager.cpp
  src/audio/ProcessingGraph.cpp
  src/audio/TrackProcessor.cpp
  src/midi/MidiEngine.cpp
  src/midi/MidiClock.cpp
  src/midi/MidiInputCollector.cpp
  src/plugins/PluginHost.cpp
  src/plugins/PluginScanner.cpp
  src/plugins/PluginSandbox.cpp
  tests/AudioEngineTest.cpp
  tests/MidiEngineTest.cpp
  tests/PluginHostTest.cpp
)

target_compile_definitions(engine_tests PRIVATE
  JUCE_USE_CURL=0
  JUCE_WEB_BROWSER=0
  JUCE_STANDALONE_APPLICATION=1
)

target_include_directories(engine_tests PRIVATE include/)
target_link_libraries(engine_tests PRIVATE
  juce::juce_audio_basics
  juce::juce_audio_devices
  juce::juce_audio_formats
  juce::juce_audio_processors
  juce::juce_core
)
