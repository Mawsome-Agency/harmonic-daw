#include "midi/MidiEngine.h"

namespace Harmonic {

// MidiInputCollector — pools MIDI messages from all open input devices
// into a single sorted queue that can be drained per audio buffer.
// Implemented via MidiEngine::handleIncomingMidiMessage() callback and
// the scheduled events queue. See MidiEngine.cpp for full implementation.

} // namespace Harmonic
