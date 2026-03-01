#include <juce_audio_processors/juce_audio_processors.h>

namespace Harmonic {

/**
 * TrackProcessor — per-track audio processor that:
 *   1. Applies gain and pan
 *   2. Runs the insert plugin chain in series
 *   3. Writes output to the bus routing matrix
 *
 * In the full implementation, this is a juce::AudioProcessor subclass
 * registered as a node in ProcessingGraph. Each track node is connected
 * by ProcessingGraph according to the routing rules in the project.
 */
class TrackProcessor : public juce::AudioProcessor {
public:
    explicit TrackProcessor(const std::string& trackId)
        : trackId_(trackId) {}

    const juce::String getName() const override { return "TrackProcessor"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock&) override {}
    void setStateInformation(const void*, int) override {}
    bool hasEditor() const override { return false; }
    juce::AudioProcessorEditor* createEditor() override { return nullptr; }

    void prepareToPlay(double sampleRate, int maximumExpectedSamplesPerBlock) override {
        sampleRate_ = sampleRate;
        blockSize_ = maximumExpectedSamplesPerBlock;
    }

    void releaseResources() override {}

    void processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) override {
        // Apply gain
        for (int ch = 0; ch < buffer.getNumChannels(); ++ch) {
            buffer.applyGain(ch, 0, buffer.getNumSamples(), gain_);
        }

        // Apply pan (stereo only)
        if (buffer.getNumChannels() == 2) {
            const float leftGain  = (pan_ <= 0) ? 1.f : (1.f - pan_);
            const float rightGain = (pan_ >= 0) ? 1.f : (1.f + pan_);
            buffer.applyGain(0, 0, buffer.getNumSamples(), leftGain);
            buffer.applyGain(1, 0, buffer.getNumSamples(), rightGain);
        }

        // If muted, zero the buffer
        if (muted_) {
            buffer.clear();
        }

        // Plugin chain — each plugin processes the buffer in series
        for (auto& plugin : pluginChain_) {
            if (plugin && !plugin->isSuspended()) {
                plugin->processBlock(buffer, midiMessages);
            }
        }
    }

    void setGain(float gain) { gain_ = gain; }
    void setPan(float pan) { pan_ = juce::jlimit(-1.f, 1.f, pan); }
    void setMuted(bool muted) { muted_ = muted; }

    void insertPlugin(std::unique_ptr<juce::AudioProcessor> plugin, int position) {
        if (position < 0 || position > static_cast<int>(pluginChain_.size())) {
            pluginChain_.push_back(std::move(plugin));
        } else {
            pluginChain_.insert(pluginChain_.begin() + position, std::move(plugin));
        }
    }

    void removePlugin(int position) {
        if (position >= 0 && position < static_cast<int>(pluginChain_.size())) {
            pluginChain_.erase(pluginChain_.begin() + position);
        }
    }

private:
    std::string trackId_;
    float gain_ = 1.f;
    float pan_ = 0.f;
    bool muted_ = false;
    double sampleRate_ = 44100.0;
    int blockSize_ = 256;
    std::vector<std::unique_ptr<juce::AudioProcessor>> pluginChain_;
};

} // namespace Harmonic
