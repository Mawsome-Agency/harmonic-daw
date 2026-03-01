#include "audio/AudioEngine.h"
#include <juce_audio_basics/juce_audio_basics.h>
#include <chrono>

namespace Harmonic {

AudioEngine::AudioEngine() {
    deviceManager_.addChangeListener(this);
}

AudioEngine::~AudioEngine() {
    shutdown();
}

bool AudioEngine::initialize(const std::string& deviceTypeName) {
    juce::String err;

    if (!deviceTypeName.empty()) {
        err = deviceManager_.initialise(2, 2, nullptr, true,
                                         juce::String(deviceTypeName));
    } else {
        err = deviceManager_.initialise(2, 2, nullptr, true);
    }

    if (err.isNotEmpty()) {
        juce::Logger::writeToLog("AudioEngine init error: " + err);
        return false;
    }

    deviceManager_.addAudioCallback(this);
    return true;
}

void AudioEngine::shutdown() {
    deviceManager_.removeAudioCallback(this);
    deviceManager_.closeAudioDevice();
    isPlaying_ = false;
    isRecording_ = false;
}

bool AudioEngine::setDevice(const std::string& deviceId,
                             double sampleRate,
                             int bufferSize,
                             int inputChannelMask,
                             int outputChannelMask) {
    auto setup = deviceManager_.getAudioDeviceSetup();
    setup.inputDeviceName = juce::String(deviceId);
    setup.outputDeviceName = juce::String(deviceId);
    setup.sampleRate = sampleRate;
    setup.bufferSize = bufferSize;
    setup.inputChannels = inputChannelMask;
    setup.outputChannels = outputChannelMask;

    juce::String err = deviceManager_.setAudioDeviceSetup(setup, true);
    if (err.isNotEmpty()) {
        juce::Logger::writeToLog("setDevice error: " + err);
        return false;
    }

    currentSampleRate_ = sampleRate;
    currentBufferSize_ = bufferSize;
    return true;
}

// ─── Transport ────────────────────────────────────────────────────────────────

void AudioEngine::play() {
    isPlaying_ = true;
    isRecording_ = false;
    if (stateCallback_) stateCallback_(getState());
}

void AudioEngine::stop() {
    isPlaying_ = false;
    isRecording_ = false;
    samplePosition_ = 0;
    if (stateCallback_) stateCallback_(getState());
}

void AudioEngine::pause() {
    isPlaying_ = false;
    if (stateCallback_) stateCallback_(getState());
}

void AudioEngine::record() {
    isPlaying_ = true;
    isRecording_ = true;
    if (stateCallback_) stateCallback_(getState());
}

void AudioEngine::seekToSample(int64_t samplePos) {
    samplePosition_ = samplePos;
}

void AudioEngine::seekToBeat(double beat) {
    const double samplesPerBeat = currentSampleRate_ * 60.0 / currentBpm_;
    seekToSample(static_cast<int64_t>(beat * samplesPerBeat));
}

AudioEngineState AudioEngine::getState() const {
    AudioEngineState state;
    auto* device = deviceManager_.getCurrentAudioDevice();
    state.status = device ? AudioEngineState::Status::Running : AudioEngineState::Status::Stopped;
    state.cpuLoad = cpuLoad_.load();
    state.xrunCount = xrunCount_.load();
    state.samplePosition = samplePosition_.load();
    if (device) {
        const double bufferSecs = currentBufferSize_ / currentSampleRate_;
        state.latencyMs = (device->getInputLatencyInSamples() +
                           device->getOutputLatencyInSamples() +
                           currentBufferSize_) / currentSampleRate_ * 1000.0;
    }
    return state;
}

std::vector<LevelMeter> AudioEngine::getLevels() const {
    juce::SpinLock::ScopedLockType lock(levelLock_);
    return currentLevels_;
}

// ─── Audio callback ───────────────────────────────────────────────────────────

void AudioEngine::audioDeviceIOCallbackWithContext(
    const float* const* inputChannelData,
    int numInputChannels,
    float* const* outputChannelData,
    int numOutputChannels,
    int numSamples,
    const juce::AudioIODeviceCallbackContext& /*context*/)
{
    auto startTime = std::chrono::high_resolution_clock::now();

    // Zero output before processing
    for (int ch = 0; ch < numOutputChannels; ++ch) {
        juce::FloatVectorOperations::clear(outputChannelData[ch], numSamples);
    }

    if (!isPlaying_.load()) {
        return;
    }

    // Advance sample position
    samplePosition_ += numSamples;

    // In a full implementation, here we'd:
    //   1. Pull MIDI events from the MIDI engine for this buffer window
    //   2. Process each track's plugin chain
    //   3. Mix down to output
    //   4. Write to any armed record buffers
    // For now, wrap the processing graph call pattern.

    // Update level meters (silence for now, will be driven by graph)
    {
        juce::SpinLock::ScopedLockType lock(levelLock_);
        // Meters updated per-track by ProcessingGraph
    }

    // CPU load measurement
    auto endTime = std::chrono::high_resolution_clock::now();
    const double processingUs = std::chrono::duration<double, std::micro>(endTime - startTime).count();
    const double bufferDurationUs = (numSamples / currentSampleRate_) * 1e6;
    updateCpuLoad(processingUs, bufferDurationUs);
}

void AudioEngine::audioDeviceAboutToStart(juce::AudioIODevice* device) {
    currentSampleRate_ = device->getCurrentSampleRate();
    currentBufferSize_ = device->getCurrentBufferSizeSamples();
    processingBuffer_.setSize(2, currentBufferSize_);
    if (stateCallback_) stateCallback_(getState());
}

void AudioEngine::audioDeviceStopped() {
    if (stateCallback_) stateCallback_(getState());
}

void AudioEngine::audioDeviceError(const juce::String& errorMessage) {
    xrunCount_++;
    juce::Logger::writeToLog("Audio device error: " + errorMessage);
    if (xrunCallback_) xrunCallback_(xrunCount_.load());
}

void AudioEngine::changeListenerCallback(juce::ChangeBroadcaster* /*source*/) {
    if (stateCallback_) stateCallback_(getState());
}

void AudioEngine::updateCpuLoad(double processingTimeUs, double bufferDurationUs) {
    const float load = static_cast<float>(processingTimeUs / bufferDurationUs);
    // Exponential moving average
    cpuLoad_ = cpuLoad_.load() * 0.9f + load * 0.1f;
}

} // namespace Harmonic
