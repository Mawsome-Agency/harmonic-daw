#pragma once
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <functional>
#include <memory>
#include <vector>
#include <atomic>

namespace Harmonic {

struct MidiTimingInfo {
    double bpm;
    int timeSignatureNum;
    int timeSignatureDen;
    int64_t samplePosition;
    double sampleRate;
    bool isPlaying;
};

/**
 * MidiEngine — sample-accurate MIDI event scheduling and routing.
 *
 * Responsibilities:
 *   - Collect live MIDI input from physical devices
 *   - Schedule MIDI events from clips with sample-accurate timestamps
 *   - Generate clock signals (MIDI Clock, MTC)
 *   - Sync to external clock (MIDI Clock in, Ableton Link)
 */
class MidiEngine : public juce::MidiInputCallback {
public:
    explicit MidiEngine(double sampleRate = 44100.0);
    ~MidiEngine() override;

    // ─── Device management ─────────────────────────────────────────────────
    void refreshDevices();
    juce::StringArray getInputDeviceNames() const;
    juce::StringArray getOutputDeviceNames() const;

    bool openInputDevice(const juce::String& deviceId, int channelFilter = -1);
    bool openOutputDevice(const juce::String& deviceId);
    void closeInputDevice(const juce::String& deviceId);
    void closeOutputDevice(const juce::String& deviceId);

    // ─── Scheduling ────────────────────────────────────────────────────────

    /**
     * Schedule a MIDI event at a sample-accurate position.
     * Thread-safe — may be called from message thread.
     */
    void scheduleEvent(const juce::MidiMessage& message, int64_t samplePosition);

    /**
     * Called by AudioEngine during processBlock to collect events
     * for the current buffer window [windowStart, windowStart + numSamples).
     *
     * Returned buffer has sample-accurate timestamps relative to buffer start.
     */
    void collectEvents(int64_t windowStart, int numSamples,
                       juce::MidiBuffer& outputBuffer);

    // ─── Clock ─────────────────────────────────────────────────────────────
    void setTiming(const MidiTimingInfo& timing);
    void generateClockTick(int64_t samplePosition, juce::MidiBuffer& buffer);

    // ─── Live input callback ───────────────────────────────────────────────
    using LiveMidiCallback = std::function<void(const juce::MidiMessage&, int64_t samplePos)>;
    void setLiveMidiCallback(LiveMidiCallback cb) { liveCallback_ = std::move(cb); }

private:
    // MidiInputCallback
    void handleIncomingMidiMessage(juce::MidiInput* source,
                                    const juce::MidiMessage& message) override;

    struct ScheduledEvent {
        juce::MidiMessage message;
        int64_t samplePosition;
        bool operator<(const ScheduledEvent& other) const {
            return samplePosition < other.samplePosition;
        }
    };

    double sampleRate_;
    MidiTimingInfo timing_;

    juce::CriticalSection eventLock_;
    std::vector<ScheduledEvent> scheduledEvents_;

    std::vector<std::unique_ptr<juce::MidiInput>> openInputs_;
    std::vector<std::unique_ptr<juce::MidiOutput>> openOutputs_;

    LiveMidiCallback liveCallback_;

    // MIDI clock state
    double clockAccumulator_ = 0.0;  // fractional pulses
    static constexpr int MIDI_CLOCK_PPQN = 24;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MidiEngine)
};

} // namespace Harmonic
