# Harmonic DAW

**AI-native digital audio workstation** — built to dethrone legacy DAWs.

## Architecture

```
harmonic-daw/
├── engine/          # C++ JUCE audio engine (native addon)
│   ├── src/
│   │   ├── audio/   # Real-time audio pipeline, CoreAudio/ASIO abstraction
│   │   ├── midi/    # Sample-accurate MIDI engine + clock sync
│   │   └── plugins/ # VST3/AU plugin hosting with sandboxing
│   └── CMakeLists.txt
├── app/             # Electron shell + React UI
│   ├── src/
│   │   ├── main/    # Electron main process
│   │   ├── renderer/# React UI (arrangement, mixer, piano roll, etc.)
│   │   └── preload/ # Context bridge
│   └── package.json
└── shared/          # TypeScript types shared between app + engine IPC
    └── src/types/
```

## Features

- **Real-time audio processing** — configurable buffer sizes, CoreAudio/ASIO device abstraction
- **MIDI engine** — sample-accurate timing, clock sync (MTC, MIDI Clock, Link)
- **VST3/AU plugin hosting** — sandboxed plugin instances, crash isolation
- **Arrangement view** — timeline with audio/MIDI/bus/master tracks
- **Mixer panel** — per-track fader, pan, mute/solo, sends, inserts
- **Piano roll** — note editor with velocity, quantize, humanize
- **Project system** — save/load/autosave, unlimited undo/redo

## Quick Start (Working Audio — No C++ Required)

The renderer uses the **Web Audio API** for fully working audio playback without building the native C++ engine. You can run it as a standard Electron app or open the renderer directly in a browser.

### Prerequisites

- Node.js 18+

### Run (Electron)

```bash
# Install dependencies
npm install --include=dev

# Build shared types
npm run build --workspace=shared

# Build main process
npm run build:main --workspace=app

# Build renderer
npm run build:renderer --workspace=app

# Launch
npm run electron --workspace=app
```

### Dev Mode (hot reload)

```bash
npm install --include=dev
npm run build --workspace=shared
npm run dev  # starts Vite dev server + Electron
```

### What Works Right Now

| Feature | Status |
|---------|--------|
| Play / Pause / Stop transport | ✅ Working |
| Playhead moves with position | ✅ Working |
| BPM control (drag or double-click) | ✅ Working |
| Add audio/MIDI tracks | ✅ Working |
| Track volume fader (affects audio) | ✅ Working |
| Track mute / solo (affects audio) | ✅ Working |
| Drag WAV/MP3 onto audio track | ✅ Working |
| Click empty track to browse files | ✅ Working |
| Test tone button per track (440 Hz sine) | ✅ Working |
| Spacebar to play/stop | ✅ Working |
| Timeline ruler with bar numbers | ✅ Working |
| Undo/Redo (Ctrl+Z/Y) | ✅ Working |

### Optional: Build Native C++ Engine

The native engine (PortAudio-based) provides lower latency, VST3 plugin support, and MIDI I/O. It's not required for basic audio playback.

```bash
# Prerequisites: CMake 3.22+, JUCE 7, Xcode/MSVC
npm run engine:configure
npm run engine:build
```

### Build for Distribution

```bash
npm run build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Audio Engine | C++17 + JUCE 7 |
| Plugin Bridge | Node-API (napi) |
| Shell | Electron 29 |
| UI | React 18 + TypeScript |
| State | Zustand + Immer |
| Styling | CSS Modules + CSS variables |
| Build | Vite + CMake |

## License

MIT © Harmonic
