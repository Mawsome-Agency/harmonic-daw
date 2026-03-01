#include "plugins/PluginHost.h"

namespace Harmonic {

/**
 * PluginSandbox — crash isolation for plugin instances.
 *
 * Strategy (MVP — in-process):
 *   - Wrap processBlock() calls in try/catch
 *   - On catch, mark plugin as crashed, silence output
 *   - Notify engine bridge to report crash event to renderer
 *
 * Full out-of-process sandboxing:
 *   - Fork a child process per plugin instance
 *   - Share audio buffers via shared memory (mmap on macOS/Linux, MapViewOfFile on Win)
 *   - Communicate via IPC pipes: processBlock() → IPC → child → IPC → result
 *   - If child dies, parent sees broken pipe, marks plugin crashed
 *   - User can unload and reload without engine restart
 *
 * For MVP, JUCE's built-in AudioPluginFormatManager provides
 * in-process hosting with exception isolation at the JUCE level.
 */

} // namespace Harmonic
