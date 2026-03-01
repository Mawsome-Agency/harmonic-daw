#include "audio/ProcessingGraph.h"

namespace Harmonic {

ProcessingGraph::ProcessingGraph()
    : graph_(std::make_unique<juce::AudioProcessorGraph>())
{
    // Add I/O nodes
    audioInputNode_ = graph_->addNode(
        std::make_unique<juce::AudioProcessorGraph::AudioGraphIOProcessor>(
            juce::AudioProcessorGraph::AudioGraphIOProcessor::audioInputNode));

    audioOutputNode_ = graph_->addNode(
        std::make_unique<juce::AudioProcessorGraph::AudioGraphIOProcessor>(
            juce::AudioProcessorGraph::AudioGraphIOProcessor::audioOutputNode));

    midiInputNode_ = graph_->addNode(
        std::make_unique<juce::AudioProcessorGraph::AudioGraphIOProcessor>(
            juce::AudioProcessorGraph::AudioGraphIOProcessor::midiInputNode));
}

ProcessingGraph::~ProcessingGraph() {
    releaseResources();
}

void ProcessingGraph::prepareToPlay(double sampleRate, int maxBlockSize) {
    juce::ScopedLock sl(graphLock_);
    sampleRate_ = sampleRate;
    blockSize_ = maxBlockSize;
    graph_->setPlayConfigDetails(2, 2, sampleRate, maxBlockSize);
    graph_->prepareToPlay(sampleRate, maxBlockSize);
}

void ProcessingGraph::releaseResources() {
    juce::ScopedLock sl(graphLock_);
    graph_->releaseResources();
}

void ProcessingGraph::processBlock(juce::AudioBuffer<float>& buffer,
                                    juce::MidiBuffer& midiMessages) {
    juce::ScopedLock sl(graphLock_);
    graph_->processBlock(buffer, midiMessages);
}

bool ProcessingGraph::addTrack(const TrackProcessorConfig& config) {
    juce::ScopedLock sl(graphLock_);

    // Create a gain+pan processor per track
    // In a full impl, this would be a TrackProcessor hosting the plugin chain
    // For now, we connect input → output directly for audio tracks
    if (trackNodes_.count(config.trackId)) {
        return false; // already exists
    }

    // Connect input to output (passthrough until plugin chain is inserted)
    graph_->addConnection({
        { audioInputNode_->nodeID, 0 },
        { audioOutputNode_->nodeID, 0 }
    });
    graph_->addConnection({
        { audioInputNode_->nodeID, 1 },
        { audioOutputNode_->nodeID, 1 }
    });

    return true;
}

bool ProcessingGraph::removeTrack(const std::string& trackId) {
    juce::ScopedLock sl(graphLock_);
    auto it = trackNodes_.find(trackId);
    if (it == trackNodes_.end()) return false;
    graph_->removeNode(it->second->nodeID);
    trackNodes_.erase(it);
    return true;
}

bool ProcessingGraph::updateTrack(const std::string& trackId,
                                   const TrackProcessorConfig& config) {
    juce::ScopedLock sl(graphLock_);
    auto it = trackNodes_.find(trackId);
    if (it == trackNodes_.end()) return false;
    // Apply gain/pan/mute to node
    // Actual implementation updates processor parameters
    return true;
}

bool ProcessingGraph::insertPlugin(const std::string& trackId,
                                    std::unique_ptr<juce::AudioProcessor> plugin,
                                    int position) {
    juce::ScopedLock sl(graphLock_);
    plugin->setPlayConfigDetails(2, 2, sampleRate_, blockSize_);
    plugin->prepareToPlay(sampleRate_, blockSize_);
    auto node = graph_->addNode(std::move(plugin));
    if (!node) return false;
    return true;
}

bool ProcessingGraph::removePlugin(const std::string& trackId, int position) {
    juce::ScopedLock sl(graphLock_);
    // Look up plugin node by track + position and remove
    return true;
}

} // namespace Harmonic
