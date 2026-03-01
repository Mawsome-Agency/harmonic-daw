#include <juce_core/juce_core.h>

namespace Harmonic {

/**
 * IpcBridge — forwards engine events to the Node.js/Electron layer
 * using NAPI threadsafe functions.
 *
 * Engine → JS event flow:
 *   1. Audio thread fires event (xrun, level meter update, etc.)
 *   2. Event is posted to a lock-free queue
 *   3. A napi_threadsafe_function drains the queue on the JS thread
 *   4. JS callbacks invoke ipcRenderer.send() → renderer
 *
 * This ensures audio thread is never blocked by JS garbage collection.
 *
 * For MVP: events are pulled via getState() polling from the renderer.
 * Full impl uses napi_call_threadsafe_function for push delivery.
 */

} // namespace Harmonic
