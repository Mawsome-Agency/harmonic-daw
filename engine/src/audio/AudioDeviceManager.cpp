#include "audio/AudioEngine.h"

// AudioDeviceManager helpers — device enumeration utilities.
// The core functionality lives in the JUCE AudioDeviceManager (owned by AudioEngine).
// This file provides platform-specific device type helpers.

namespace Harmonic {

juce::StringArray AudioEngine::getAvailableDeviceTypes() const {
    juce::StringArray types;
    for (auto* deviceType : deviceManager_.getAvailableDeviceTypes()) {
        types.add(deviceType->getTypeName());
    }
    return types;
}

} // namespace Harmonic
