#include "midi/MidiEngine.h"
#include <algorithm>

namespace Harmonic {

MidiEngine::MidiEngine(double sampleRate)
    : sampleRate_(sampleRate)
{
    timing_ = { 120.0, 4, 4, 0, sampleRate, false };
}

MidiEngine::~MidiEngine() {
    for (auto& input : openInputs_) {
        input->stop();
    }
}

void MidiEngine::refreshDevices() {
    // Devices are enumerated on demand via JUCE's MidiInput/MidiOutput APIs
}

juce::StringArray MidiEngine::getInputDeviceNames() const {
    juce::StringArray names;
    for (const auto& device : juce::MidiInput::getAvailableDevices()) {
        names.add(device.name);
    }
    return names;
}

juce::StringArray MidiEngine::getOutputDeviceNames() const {
    juce::StringArray names;
    for (const auto& device : juce::MidiOutput::getAvailableDevices()) {
        names.add(device.name);
    }
    return names;
}

bool MidiEngine::openInputDevice(const juce::String& deviceId, int /*channelFilter*/) {
    auto input = juce::MidiInput::openDevice(deviceId, this);
    if (!input) return false;
    input->start();
    openInputs_.push_back(std::move(input));
    return true;
}

bool MidiEngine::openOutputDevice(const juce::String& deviceId) {
    auto output = juce::MidiOutput::openDevice(deviceId);
    if (!output) return false;
    openOutputs_.push_back(std::move(output));
    return true;
}

void MidiEngine::closeInputDevice(const juce::String& deviceId) {
    openInputs_.erase(
        std::remove_if(openInputs_.begin(), openInputs_.end(),
            [&](const auto& d) { return d->getIdentifier() == deviceId; }),
        openInputs_.end());
}

void MidiEngine::closeOutputDevice(const juce::String& deviceId) {
    openOutputs_.erase(
        std::remove_if(openOutputs_.begin(), openOutputs_.end(),
            [&](const auto& d) { return d->getIdentifier() == deviceId; }),
        openOutputs_.end());
}

void MidiEngine::scheduleEvent(const juce::MidiMessage& message, int64_t samplePosition) {
    juce::ScopedLock sl(eventLock_);
    scheduledEvents_.push_back({ message, samplePosition });
    std::sort(scheduledEvents_.begin(), scheduledEvents_.end());
}

void MidiEngine::collectEvents(int64_t windowStart, int numSamples,
                                juce::MidiBuffer& outputBuffer) {
    juce::ScopedLock sl(eventLock_);

    const int64_t windowEnd = windowStart + numSamples;

    auto it = scheduledEvents_.begin();
    while (it != scheduledEvents_.end() && it->samplePosition < windowEnd) {
        if (it->samplePosition >= windowStart) {
            const int sampleOffset = static_cast<int>(it->samplePosition - windowStart);
            outputBuffer.addEvent(it->message, sampleOffset);
            it = scheduledEvents_.erase(it);
        } else {
            ++it;
        }
    }
}

void MidiEngine::setTiming(const MidiTimingInfo& timing) {
    timing_ = timing;
    sampleRate_ = timing.sampleRate;
}

void MidiEngine::generateClockTick(int64_t samplePosition, juce::MidiBuffer& buffer) {
    if (!timing_.isPlaying) return;

    // MIDI clock: 24 pulses per quarter note
    const double samplesPerPulse = sampleRate_ * 60.0 / (timing_.bpm * MIDI_CLOCK_PPQN);

    // Determine how many clock ticks fall in this callback
    // (Clock accumulator tracks fractional position)
    clockAccumulator_ += 1.0 / samplesPerPulse;

    while (clockAccumulator_ >= 1.0) {
        buffer.addEvent(juce::MidiMessage::midiClock(), static_cast<int>(samplePosition));
        clockAccumulator_ -= 1.0;
    }
}

void MidiEngine::handleIncomingMidiMessage(juce::MidiInput* /*source*/,
                                            const juce::MidiMessage& message) {
    // Called on MIDI thread — forward to audio engine for sample-accurate scheduling
    if (liveCallback_) {
        liveCallback_(message, timing_.samplePosition);
    }
}

} // namespace Harmonic
