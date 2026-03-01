#include "plugins/PluginHost.h"

namespace Harmonic {

// PluginScanner — background thread for scanning VST3/AU plugin directories.
// Scans run off the message thread to avoid blocking the UI.
// Full scanning logic is in PluginHost::scanPlugins().
// This file would house the background scan thread wrapper.

} // namespace Harmonic
