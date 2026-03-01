#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <memory>
#include <string>
#include <vector>
#include <unordered_map>
#include <functional>

namespace Harmonic {

struct PluginInfo {
    std::string id;
    std::string name;
    std::string vendor;
    std::string version;
    std::string format;   // "VST3", "AU", etc.
    std::string category;
    bool isInstrument = false;
    int inputChannels = 2;
    int outputChannels = 2;
    int latencySamples = 0;
    std::string filePath;
};

struct PluginParam {
    std::string id;
    std::string name;
    float minValue = 0.f;
    float maxValue = 1.f;
    float defaultValue = 0.f;
    float currentValue = 0.f;
    bool isAutomatable = true;
    bool isBypass = false;
};

/**
 * PluginHost — manages VST3/AU plugin loading, scanning, and processing.
 *
 * Sandboxing strategy:
 *   - In-process: low latency, plugin crash kills engine
 *   - Out-of-process: isolated subprocess communicating via pipes (full impl)
 *   - For MVP: in-process with exception catching at process boundary
 */
class PluginHost {
public:
    PluginHost();
    ~PluginHost();

    // ─── Scanning ──────────────────────────────────────────────────────────
    struct ScanProgress {
        int current;
        int total;
        std::string currentFile;
    };

    using ScanProgressCallback = std::function<void(const ScanProgress&)>;
    using ScanCompleteCallback = std::function<void(const std::vector<PluginInfo>&,
                                                     const std::vector<std::pair<std::string, std::string>>&)>;

    void scanPlugins(const std::vector<std::string>& searchPaths,
                     ScanProgressCallback onProgress,
                     ScanCompleteCallback onComplete);

    const std::vector<PluginInfo>& getScannedPlugins() const { return scannedPlugins_; }

    // ─── Instance management ───────────────────────────────────────────────
    struct LoadResult {
        bool success = false;
        std::string instanceId;
        std::string error;
        std::vector<PluginParam> parameters;
    };

    LoadResult loadPlugin(const std::string& pluginId,
                          double sampleRate,
                          int blockSize);

    bool unloadPlugin(const std::string& instanceId);
    bool setParameter(const std::string& instanceId,
                      const std::string& paramId,
                      float value);

    // Get processor for integration into ProcessingGraph
    juce::AudioProcessor* getProcessor(const std::string& instanceId);

    // ─── Editor ────────────────────────────────────────────────────────────
    bool openEditor(const std::string& instanceId);
    void closeEditor(const std::string& instanceId);

    // ─── State ─────────────────────────────────────────────────────────────
    std::vector<uint8_t> getPluginState(const std::string& instanceId);
    bool setPluginState(const std::string& instanceId,
                        const std::vector<uint8_t>& state);

private:
    juce::AudioPluginFormatManager formatManager_;
    juce::KnownPluginList knownPlugins_;

    struct PluginInstance {
        std::string instanceId;
        std::string pluginId;
        std::unique_ptr<juce::AudioPluginInstance> processor;
        std::unique_ptr<juce::DocumentWindow> editorWindow;
    };

    std::vector<PluginInfo> scannedPlugins_;
    std::unordered_map<std::string, PluginInstance> instances_;

    static std::string generateInstanceId();
    PluginInfo descriptorFromPlugin(const juce::PluginDescription& desc) const;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(PluginHost)
};

} // namespace Harmonic
