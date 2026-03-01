#include "plugins/PluginHost.h"
#include <juce_audio_processors/juce_audio_processors.h>
#include <random>
#include <sstream>
#include <iomanip>

namespace Harmonic {

PluginHost::PluginHost() {
    formatManager_.addDefaultFormats();
}

PluginHost::~PluginHost() {
    // Close all editors and unload all plugins
    for (auto& [id, instance] : instances_) {
        if (instance.editorWindow) {
            instance.editorWindow.reset();
        }
    }
    instances_.clear();
}

// ─── Scanning ─────────────────────────────────────────────────────────────────

void PluginHost::scanPlugins(const std::vector<std::string>& searchPaths,
                              ScanProgressCallback onProgress,
                              ScanCompleteCallback onComplete) {
    juce::StringArray pluginPaths;
    for (const auto& path : searchPaths) {
        pluginPaths.add(juce::String(path));
    }

    // Build file list to scan
    juce::StringArray filesToScan;
    for (auto& format : formatManager_.getFormats()) {
        format->searchPathsForPlugins(juce::FileSearchPath(pluginPaths.joinIntoString(";")),
                                       true, filesToScan);
    }

    const int total = filesToScan.size();
    std::vector<PluginInfo> found;
    std::vector<std::pair<std::string, std::string>> failed;

    for (int i = 0; i < total; ++i) {
        const auto& filePath = filesToScan[i];

        if (onProgress) {
            onProgress({ i, total, filePath.toStdString() });
        }

        juce::OwnedArray<juce::PluginDescription> descriptions;
        juce::String errorMessage;

        for (auto& format : formatManager_.getFormats()) {
            if (format->fileMightContainThisPluginType(filePath)) {
                format->findAllTypesForFile(descriptions, filePath);
            }
        }

        if (descriptions.isEmpty()) {
            failed.push_back({ filePath.toStdString(), "No valid plugins found in file" });
        } else {
            for (auto* desc : descriptions) {
                found.push_back(descriptorFromPlugin(*desc));
            }
        }
    }

    scannedPlugins_ = found;

    if (onComplete) {
        onComplete(found, failed);
    }
}

// ─── Instance management ──────────────────────────────────────────────────────

PluginHost::LoadResult PluginHost::loadPlugin(const std::string& pluginId,
                                               double sampleRate,
                                               int blockSize) {
    LoadResult result;

    // Find plugin in scanned list
    const PluginInfo* info = nullptr;
    for (const auto& p : scannedPlugins_) {
        if (p.id == pluginId) { info = &p; break; }
    }

    if (!info) {
        result.error = "Plugin not found: " + pluginId;
        return result;
    }

    // Find matching description from known list
    juce::PluginDescription desc;
    bool found = false;
    knownPlugins_.getTypes().forEach([&](const juce::PluginDescription& d) {
        if (!found && d.createIdentifierString().toStdString() == pluginId) {
            desc = d;
            found = true;
        }
    });

    if (!found) {
        result.error = "Plugin description not in KnownPluginList: " + pluginId;
        return result;
    }

    juce::String loadError;
    auto instance = formatManager_.createPluginInstance(desc, sampleRate, blockSize, loadError);

    if (!instance) {
        result.error = "Failed to instantiate plugin: " + loadError.toStdString();
        return result;
    }

    instance->prepareToPlay(sampleRate, blockSize);

    // Extract parameters
    for (auto* param : instance->getParameters()) {
        if (!param) continue;
        PluginParam p;
        p.id = param->getVersionedIdentifier().toString().toStdString();
        p.name = param->getName(64).toStdString();
        p.currentValue = param->getValue();
        p.isAutomatable = param->isAutomatable();
        p.isBypass = (dynamic_cast<juce::AudioProcessorParameter::Category*>(param) != nullptr);
        result.parameters.push_back(p);
    }

    result.instanceId = generateInstanceId();
    result.success = true;

    PluginInstance pi;
    pi.instanceId = result.instanceId;
    pi.pluginId = pluginId;
    pi.processor = std::move(instance);
    instances_[result.instanceId] = std::move(pi);

    return result;
}

bool PluginHost::unloadPlugin(const std::string& instanceId) {
    auto it = instances_.find(instanceId);
    if (it == instances_.end()) return false;

    if (it->second.editorWindow) {
        it->second.editorWindow.reset();
    }
    if (it->second.processor) {
        it->second.processor->releaseResources();
    }

    instances_.erase(it);
    return true;
}

bool PluginHost::setParameter(const std::string& instanceId,
                               const std::string& paramId,
                               float value) {
    auto it = instances_.find(instanceId);
    if (it == instances_.end()) return false;

    for (auto* param : it->second.processor->getParameters()) {
        if (param && param->getVersionedIdentifier().toString().toStdString() == paramId) {
            param->setValueNotifyingHost(value);
            return true;
        }
    }
    return false;
}

juce::AudioProcessor* PluginHost::getProcessor(const std::string& instanceId) {
    auto it = instances_.find(instanceId);
    if (it == instances_.end()) return nullptr;
    return it->second.processor.get();
}

bool PluginHost::openEditor(const std::string& instanceId) {
    auto it = instances_.find(instanceId);
    if (it == instances_.end() || !it->second.processor) return false;

    if (!it->second.processor->hasEditor()) return false;

    juce::MessageManager::callAsync([this, instanceId]() {
        auto it = instances_.find(instanceId);
        if (it == instances_.end()) return;

        auto* editor = it->second.processor->createEditorIfNeeded();
        if (!editor) return;

        auto window = std::make_unique<juce::DocumentWindow>(
            it->second.processor->getName(),
            juce::Colours::darkgrey,
            juce::DocumentWindow::closeButton);
        window->setContentOwned(editor, true);
        window->setResizable(true, false);
        window->setVisible(true);
        it->second.editorWindow = std::move(window);
    });

    return true;
}

void PluginHost::closeEditor(const std::string& instanceId) {
    auto it = instances_.find(instanceId);
    if (it == instances_.end()) return;
    juce::MessageManager::callAsync([this, instanceId]() {
        auto it = instances_.find(instanceId);
        if (it != instances_.end()) {
            it->second.editorWindow.reset();
        }
    });
}

std::vector<uint8_t> PluginHost::getPluginState(const std::string& instanceId) {
    auto it = instances_.find(instanceId);
    if (it == instances_.end()) return {};

    juce::MemoryBlock block;
    it->second.processor->getStateInformation(block);
    return std::vector<uint8_t>(
        static_cast<const uint8_t*>(block.getData()),
        static_cast<const uint8_t*>(block.getData()) + block.getSize());
}

bool PluginHost::setPluginState(const std::string& instanceId,
                                 const std::vector<uint8_t>& state) {
    auto it = instances_.find(instanceId);
    if (it == instances_.end()) return false;

    it->second.processor->setStateInformation(state.data(), static_cast<int>(state.size()));
    return true;
}

// ─── Private ──────────────────────────────────────────────────────────────────

std::string PluginHost::generateInstanceId() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<uint32_t> dis;
    std::ostringstream ss;
    ss << std::hex << std::setw(8) << std::setfill('0') << dis(gen)
       << "-" << std::setw(4) << dis(gen)
       << "-" << std::setw(4) << dis(gen)
       << "-" << std::setw(8) << dis(gen);
    return ss.str();
}

PluginInfo PluginHost::descriptorFromPlugin(const juce::PluginDescription& desc) const {
    PluginInfo info;
    info.id = desc.createIdentifierString().toStdString();
    info.name = desc.name.toStdString();
    info.vendor = desc.manufacturerName.toStdString();
    info.version = desc.version.toStdString();
    info.format = desc.pluginFormatName.toStdString();
    info.category = desc.category.toStdString();
    info.isInstrument = desc.isInstrument;
    info.inputChannels = desc.numInputChannels;
    info.outputChannels = desc.numOutputChannels;
    info.filePath = desc.fileOrIdentifier.toStdString();
    return info;
}

} // namespace Harmonic
