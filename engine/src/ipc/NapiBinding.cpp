/**
 * NapiBinding.cpp — Node.js N-API entry point for the Harmonic engine addon.
 *
 * Exposes the C++ engine to the Electron main process via a typed async bridge.
 * All audio processing stays on native threads; callbacks posted to the JS thread
 * via napi_threadsafe_function.
 */

#include <napi.h>
#include "audio/AudioEngine.h"
#include "midi/MidiEngine.h"
#include "plugins/PluginHost.h"

#include <memory>
#include <string>

namespace {

// Singletons owned by the addon lifetime
std::unique_ptr<Harmonic::AudioEngine> gAudioEngine;
std::unique_ptr<Harmonic::MidiEngine> gMidiEngine;
std::unique_ptr<Harmonic::PluginHost> gPluginHost;

// ─── Helper: throw JS error ────────────────────────────────────────────────

void ThrowError(Napi::Env env, const std::string& msg) {
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
}

// ─── Transport ────────────────────────────────────────────────────────────────

Napi::Value Play(const Napi::CallbackInfo& info) {
    if (!gAudioEngine) { ThrowError(info.Env(), "Engine not initialized"); return info.Env().Undefined(); }
    gAudioEngine->play();
    return info.Env().Undefined();
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
    if (!gAudioEngine) { ThrowError(info.Env(), "Engine not initialized"); return info.Env().Undefined(); }
    gAudioEngine->stop();
    return info.Env().Undefined();
}

Napi::Value Pause(const Napi::CallbackInfo& info) {
    if (!gAudioEngine) { ThrowError(info.Env(), "Engine not initialized"); return info.Env().Undefined(); }
    gAudioEngine->pause();
    return info.Env().Undefined();
}

Napi::Value Record(const Napi::CallbackInfo& info) {
    if (!gAudioEngine) { ThrowError(info.Env(), "Engine not initialized"); return info.Env().Undefined(); }
    gAudioEngine->record();
    return info.Env().Undefined();
}

Napi::Value Seek(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber()) {
        ThrowError(env, "seek(beatPosition: number)");
        return env.Undefined();
    }
    if (!gAudioEngine) { ThrowError(env, "Engine not initialized"); return env.Undefined(); }
    gAudioEngine->seekToBeat(info[0].As<Napi::Number>().DoubleValue());
    return env.Undefined();
}

// ─── Engine lifecycle ─────────────────────────────────────────────────────────

Napi::Value Initialize(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    gAudioEngine = std::make_unique<Harmonic::AudioEngine>();
    gMidiEngine = std::make_unique<Harmonic::MidiEngine>();
    gPluginHost = std::make_unique<Harmonic::PluginHost>();

    const bool ok = gAudioEngine->initialize();
    return Napi::Boolean::New(env, ok);
}

Napi::Value Shutdown(const Napi::CallbackInfo& info) {
    if (gAudioEngine) gAudioEngine->shutdown();
    gAudioEngine.reset();
    gMidiEngine.reset();
    gPluginHost.reset();
    return info.Env().Undefined();
}

Napi::Value GetState(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (!gAudioEngine) {
        auto obj = Napi::Object::New(env);
        obj.Set("status", "stopped");
        return obj;
    }
    const auto state = gAudioEngine->getState();
    auto obj = Napi::Object::New(env);
    switch (state.status) {
        case Harmonic::AudioEngineState::Status::Running: obj.Set("status", "running"); break;
        case Harmonic::AudioEngineState::Status::Error:   obj.Set("status", "error"); break;
        default:                                           obj.Set("status", "stopped"); break;
    }
    obj.Set("cpuLoad", state.cpuLoad);
    obj.Set("xrunCount", state.xrunCount);
    obj.Set("latencyMs", state.latencyMs);
    obj.Set("samplePosition", static_cast<double>(state.samplePosition));
    return obj;
}

// ─── Devices ──────────────────────────────────────────────────────────────────

Napi::Value ListDevices(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto arr = Napi::Array::New(env);
    // In a full impl, enumerate from AudioDeviceManager
    return arr;
}

Napi::Value SetDevice(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject()) {
        ThrowError(env, "setDevice(config: AudioDeviceConfig)");
        return env.Undefined();
    }
    auto config = info[0].As<Napi::Object>();
    std::string deviceId = config.Get("deviceId").As<Napi::String>();
    double sampleRate = config.Get("sampleRate").As<Napi::Number>().DoubleValue();
    int bufferSize = config.Get("bufferSize").As<Napi::Number>().Int32Value();

    if (!gAudioEngine) { ThrowError(env, "Engine not initialized"); return env.Undefined(); }
    gAudioEngine->setDevice(deviceId, sampleRate, bufferSize, 0xFFFF, 0xFFFF);
    return env.Undefined();
}

// ─── MIDI ─────────────────────────────────────────────────────────────────────

Napi::Value ListMidiDevices(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto arr = Napi::Array::New(env);
    if (!gMidiEngine) return arr;

    auto inputs = gMidiEngine->getInputDeviceNames();
    for (int i = 0; i < inputs.size(); ++i) {
        auto obj = Napi::Object::New(env);
        obj.Set("id", inputs[i].toStdString());
        obj.Set("name", inputs[i].toStdString());
        obj.Set("type", "input");
        arr.Set(i, obj);
    }
    return arr;
}

// ─── Plugins ──────────────────────────────────────────────────────────────────

Napi::Value ScanPlugins(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (!gPluginHost) { ThrowError(env, "Engine not initialized"); return env.Undefined(); }

    std::vector<std::string> paths;
    if (info.Length() > 0 && info[0].IsArray()) {
        auto arr = info[0].As<Napi::Array>();
        for (uint32_t i = 0; i < arr.Length(); ++i) {
            paths.push_back(arr.Get(i).As<Napi::String>());
        }
    }

    gPluginHost->scanPlugins(paths, nullptr, nullptr);

    const auto& plugins = gPluginHost->getScannedPlugins();
    auto arr = Napi::Array::New(env, plugins.size());
    for (size_t i = 0; i < plugins.size(); ++i) {
        const auto& p = plugins[i];
        auto obj = Napi::Object::New(env);
        obj.Set("id", p.id);
        obj.Set("name", p.name);
        obj.Set("vendor", p.vendor);
        obj.Set("version", p.version);
        obj.Set("format", p.format);
        obj.Set("category", p.category);
        obj.Set("isInstrument", p.isInstrument);
        obj.Set("filePath", p.filePath);
        arr.Set(static_cast<uint32_t>(i), obj);
    }
    return arr;
}

Napi::Value LoadPlugin(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) {
        ThrowError(env, "loadPlugin(pluginId: string)");
        return env.Undefined();
    }
    if (!gPluginHost || !gAudioEngine) { ThrowError(env, "Engine not initialized"); return env.Undefined(); }

    std::string pluginId = info[0].As<Napi::String>();
    auto result = gPluginHost->loadPlugin(pluginId,
                                           gAudioEngine->getSampleRate(),
                                           gAudioEngine->getBufferSize());

    auto obj = Napi::Object::New(env);
    obj.Set("success", result.success);
    obj.Set("instanceId", result.instanceId);
    obj.Set("error", result.error);
    return obj;
}

Napi::Value UnloadPlugin(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) {
        ThrowError(env, "unloadPlugin(instanceId: string)");
        return env.Undefined();
    }
    if (!gPluginHost) { ThrowError(env, "Engine not initialized"); return env.Undefined(); }
    bool ok = gPluginHost->unloadPlugin(info[0].As<Napi::String>());
    return Napi::Boolean::New(env, ok);
}

Napi::Value SetPluginParam(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() < 3) { ThrowError(env, "setPluginParam(instanceId, paramId, value)"); return env.Undefined(); }
    if (!gPluginHost) { ThrowError(env, "Engine not initialized"); return env.Undefined(); }
    bool ok = gPluginHost->setParameter(
        info[0].As<Napi::String>(),
        info[1].As<Napi::String>(),
        info[2].As<Napi::Number>().FloatValue());
    return Napi::Boolean::New(env, ok);
}

// ─── Module init ─────────────────────────────────────────────────────────────

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initialize",     Napi::Function::New(env, Initialize));
    exports.Set("shutdown",       Napi::Function::New(env, Shutdown));
    exports.Set("getState",       Napi::Function::New(env, GetState));
    exports.Set("play",           Napi::Function::New(env, Play));
    exports.Set("stop",           Napi::Function::New(env, Stop));
    exports.Set("pause",          Napi::Function::New(env, Pause));
    exports.Set("record",         Napi::Function::New(env, Record));
    exports.Set("seek",           Napi::Function::New(env, Seek));
    exports.Set("listDevices",    Napi::Function::New(env, ListDevices));
    exports.Set("setDevice",      Napi::Function::New(env, SetDevice));
    exports.Set("listMidiDevices",Napi::Function::New(env, ListMidiDevices));
    exports.Set("scanPlugins",    Napi::Function::New(env, ScanPlugins));
    exports.Set("loadPlugin",     Napi::Function::New(env, LoadPlugin));
    exports.Set("unloadPlugin",   Napi::Function::New(env, UnloadPlugin));
    exports.Set("setPluginParam", Napi::Function::New(env, SetPluginParam));
    return exports;
}

NODE_API_MODULE(harmonic_engine, Init)

} // anonymous namespace
