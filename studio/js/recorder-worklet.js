/* Hands raw microphone blocks to the main thread.
 *
 * A worklet runs on the audio thread, so the capture keeps up even while the
 * main thread is busy drawing waveforms or polishing the last take.
 */

class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      // The block is reused by the browser after this call, so post a copy.
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}

registerProcessor("studio-recorder", RecorderProcessor);
