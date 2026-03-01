#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <memory>
#include <string>
#include <vector>
#include <unordered_map>

namespace Harmonic {

struct TrackProcessorConfig {
    std::string trackId;
    std::string trackType;  // "audio" | "midi" | "bus" | "master"
    float gain = 1.f;
    float pan = 0.f;         // -1..1
    bool muted = false;
    bool soloed = false;
    int outputBusIndex = 0;  // index in graph
};

/**
 * ProcessingGraph — wraps juce::AudioProcessorGraph to manage the signal
 * routing between tracks, buses, and the master output.
 *
 * Graph topology:
 *   [AudioInput] → [TrackProcessors] → [BusProcessors] → [MasterProcessor] → [AudioOutput]
 *
 * Each TrackProcessor hosts an insert plugin chain via PluginHost.
 */
class ProcessingGraph {
public:
    ProcessingGraph();
    ~ProcessingGraph();

    void prepareToPlay(double sampleRate, int maxBlockSize);
    void releaseResources();

    // Process a block of audio. Called from audio thread.
    void processBlock(juce::AudioBuffer<float>& buffer,
                      juce::MidiBuffer& midiMessages);

    // ─── Track management (message thread) ────────────────────────────────
    bool addTrack(const TrackProcessorConfig& config);
    bool removeTrack(const std::string& trackId);
    bool updateTrack(const std::string& trackId, const TrackProcessorConfig& config);

    // ─── Plugin routing ────────────────────────────────────────────────────
    bool insertPlugin(const std::string& trackId,
                      std::unique_ptr<juce::AudioProcessor> plugin,
                      int position);
    bool removePlugin(const std::string& trackId, int position);

private:
    std::unique_ptr<juce::AudioProcessorGraph> graph_;

    juce::AudioProcessorGraph::Node::Ptr audioInputNode_;
    juce::AudioProcessorGraph::Node::Ptr audioOutputNode_;
    juce::AudioProcessorGraph::Node::Ptr midiInputNode_;

    std::unordered_map<std::string, juce::AudioProcessorGraph::Node::Ptr> trackNodes_;

    double sampleRate_ = 44100.0;
    int blockSize_ = 256;

    juce::CriticalSection graphLock_;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(ProcessingGraph)
};

} // namespace Harmonic
