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

## Getting Started

### Prerequisites

- Node.js 18+
- CMake 3.22+
- JUCE 7 (set `JUCE_DIR` env variable)
- Xcode (macOS) or Visual Studio 2022 (Windows)

### Build Engine

```bash
npm run engine:configure
npm run engine:build
```

### Run App

```bash
npm install
npm run dev
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
