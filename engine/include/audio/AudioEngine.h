#pragma once
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <functional>
#include <atomic>
#include <memory>

namespace Harmonic {

struct AudioEngineState {
    enum class Status { Stopped, Running, Error };
    Status status = Status::Stopped;
    float cpuLoad = 0.f;
    int xrunCount = 0;
    double latencyMs = 0.0;
    int64_t samplePosition = 0;
    std::string errorMessage;
};

struct LevelMeter {
    std::string trackId;
    float leftRms = -100.f;
    float rightRms = -100.f;
    float leftPeak = -100.f;
    float rightPeak = -100.f;
    bool clipLeft = false;
    bool clipRight = false;
};

/**
 * AudioEngine — wraps JUCE audio device management and hosts the processing graph.
 *
 * Thread safety:
 *   - All public methods are safe to call from the message thread.
 *   - processBlock() runs on the audio thread; never call from message thread.
 *   - State is exposed via atomic reads.
 */
class AudioEngine : public juce::AudioIODeviceCallback,
                    public juce::ChangeListener {
public:
    AudioEngine();
    ~AudioEngine() override;

    // ─── Device management ─────────────────────────────────────────────────
    bool initialize(const std::string& deviceTypeName = "");
    void shutdown();

    juce::StringArray getAvailableDeviceTypes() const;
    juce::OwnedArray<juce::AudioIODevice>& getAvailableDevices();
    bool setDevice(const std::string& deviceId,
                   double sampleRate,
                   int bufferSize,
                   int inputChannelMask,
                   int outputChannelMask);

    // ─── Transport ──────────────────────────────────────────────────────────
    void play();
    void stop();
    void pause();
    void record();
    void seekToSample(int64_t samplePos);
    void seekToBeat(double beat);

    // ─── State ──────────────────────────────────────────────────────────────
    AudioEngineState getState() const;
    int64_t getCurrentSamplePosition() const { return samplePosition_.load(); }
    double getSampleRate() const { return currentSampleRate_; }
    int getBufferSize() const { return currentBufferSize_; }

    // ─── Level metering ────────────────────────────────────────────────────
    std::vector<LevelMeter> getLevels() const;

    // ─── Callbacks ─────────────────────────────────────────────────────────
    using XrunCallback = std::function<void(int count)>;
    using LevelCallback = std::function<void(const std::vector<LevelMeter>&)>;
    using StateCallback = std::function<void(const AudioEngineState&)>;

    void setXrunCallback(XrunCallback cb) { xrunCallback_ = std::move(cb); }
    void setLevelCallback(LevelCallback cb) { levelCallback_ = std::move(cb); }
    void setStateCallback(StateCallback cb) { stateCallback_ = std::move(cb); }

private:
    // AudioIODeviceCallback
    void audioDeviceIOCallbackWithContext(const float* const* inputChannelData,
                                          int numInputChannels,
                                          float* const* outputChannelData,
                                          int numOutputChannels,
                                          int numSamples,
                                          const juce::AudioIODeviceCallbackContext& context) override;
    void audioDeviceAboutToStart(juce::AudioIODevice* device) override;
    void audioDeviceStopped() override;
    void audioDeviceError(const juce::String& errorMessage) override;

    // ChangeListener
    void changeListenerCallback(juce::ChangeBroadcaster* source) override;

    void updateCpuLoad(double processingTimeUs, double bufferDurationUs);
    void updateLevelMeters(const juce::AudioBuffer<float>& buffer);

    juce::AudioDeviceManager deviceManager_;

    std::atomic<int64_t> samplePosition_{ 0 };
    std::atomic<bool> isPlaying_{ false };
    std::atomic<bool> isRecording_{ false };
    std::atomic<float> cpuLoad_{ 0.f };
    std::atomic<int> xrunCount_{ 0 };

    double currentSampleRate_ = 44100.0;
    int currentBufferSize_ = 256;
    double currentBpm_ = 120.0;

    // Level metering
    mutable juce::SpinLock levelLock_;
    std::vector<LevelMeter> currentLevels_;

    // Callbacks
    XrunCallback xrunCallback_;
    LevelCallback levelCallback_;
    StateCallback stateCallback_;

    juce::AudioBuffer<float> processingBuffer_;
    juce::int64 lastCallbackTime_ = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AudioEngine)
};

} // namespace Harmonic
