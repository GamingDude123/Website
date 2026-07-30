/* Getting sound in: the microphone, and dropped files.
 *
 * The mic is asked for with every browser "helper" switched off. Echo
 * cancellation, noise suppression and auto gain are tuned for phone calls and
 * they wreck a sample — they duck the tail of a hit and pump the room tone up
 * between sounds. The polish pass does that job properly afterwards, with the
 * whole recording to look at rather than a 20 ms window.
 */

var Recorder = (function () {
  "use strict";

  const MAX_SECONDS = 10;
  const WARMUP = 0.06;    // discarded: the first blocks after opening a mic are junk

  let stream = null;
  let source = null;
  let node = null;
  let sink = null;
  let chunks = [];
  let frames = 0;
  let recording = false;
  let startedAt = 0;
  let level = 0;
  let workletLoaded = false;

  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function collect(block) {
    if (!recording) return;
    chunks.push(block);
    frames += block.length;
    let p = 0;
    for (let i = 0; i < block.length; i++) {
      const v = block[i] < 0 ? -block[i] : block[i];
      if (v > p) p = v;
    }
    // Fast attack, slow release, so the meter reads like a meter.
    level = p > level ? p : level * 0.86 + p * 0.14;
  }

  function buildNode(ctx) {
    if (ctx.audioWorklet && typeof AudioWorkletNode === "function") {
      const load = workletLoaded
        ? Promise.resolve()
        : ctx.audioWorklet.addModule("js/recorder-worklet.js").then(function () { workletLoaded = true; });
      return load.then(function () {
        const worklet = new AudioWorkletNode(ctx, "studio-recorder", { numberOfOutputs: 1 });
        worklet.port.onmessage = function (event) { collect(event.data); };
        return worklet;
      }).catch(function () {
        return scriptNode(ctx);
      });
    }
    return Promise.resolve(scriptNode(ctx));
  }

  /* Fallback for browsers without AudioWorklet. Deprecated, but it is the only
   * other way to see raw samples, and a sampler that cannot record is useless. */
  function scriptNode(ctx) {
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = function (event) {
      collect(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    return processor;
  }

  function start(ctx) {
    if (recording) return Promise.reject(new Error("already recording"));
    if (!supported()) return Promise.reject(new Error("no microphone support"));

    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    }).then(function (granted) {
      stream = granted;
      source = ctx.createMediaStreamSource(stream);
      return buildNode(ctx);
    }).then(function (built) {
      node = built;
      // Nothing is monitored back to the speakers — that is a feedback loop on
      // a phone — but the graph still needs a path to the destination or the
      // browser will not pull audio through the node.
      sink = ctx.createGain();
      sink.gain.value = 0;
      source.connect(node);
      node.connect(sink);
      sink.connect(ctx.destination);

      chunks = [];
      frames = 0;
      level = 0;
      recording = true;
      startedAt = ctx.currentTime;
      return true;
    });
  }

  function teardown() {
    recording = false;
    try { if (source) source.disconnect(); } catch (err) { /* gone */ }
    try { if (node) node.disconnect(); } catch (err) { /* gone */ }
    try { if (sink) sink.disconnect(); } catch (err) { /* gone */ }
    if (node && node.port) node.port.onmessage = null;
    if (node && node.onaudioprocess) node.onaudioprocess = null;
    // Release the mic so the browser's recording indicator goes out.
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    stream = null;
    source = null;
    node = null;
    sink = null;
  }

  /* Returns the take as one mono Float32Array. */
  function stop(ctx) {
    if (!recording) return null;
    const collected = chunks;
    const total = frames;
    teardown();

    const skip = Math.floor(WARMUP * ctx.sampleRate);
    if (total <= skip) return null;
    const out = new Float32Array(total - skip);
    let written = 0;
    let dropped = 0;
    for (let i = 0; i < collected.length; i++) {
      const block = collected[i];
      let from = 0;
      if (dropped < skip) {
        from = Math.min(block.length, skip - dropped);
        dropped += from;
      }
      if (from >= block.length) continue;
      out.set(block.subarray(from), written);
      written += block.length - from;
    }
    chunks = [];
    return out.subarray(0, written);
  }

  function elapsed(ctx) {
    return recording ? ctx.currentTime - startedAt : 0;
  }

  /* Decode a dropped or picked file down to mono at the context rate. */
  function fromFile(ctx, file) {
    return file.arrayBuffer().then(function (data) {
      return new Promise(function (resolve, reject) {
        // The callback form, because Safari still returns undefined from the
        // promise version.
        ctx.decodeAudioData(data, resolve, reject);
      });
    }).then(function (buffer) {
      const out = new Float32Array(buffer.length);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) out[i] += data[i];
      }
      if (buffer.numberOfChannels > 1) {
        for (let i = 0; i < out.length; i++) out[i] /= buffer.numberOfChannels;
      }
      return out;
    });
  }

  return {
    supported: supported,
    start: start,
    stop: stop,
    cancel: teardown,
    isRecording: function () { return recording; },
    level: function () { return level; },
    elapsed: elapsed,
    fromFile: fromFile,
    maxSeconds: MAX_SECONDS,
  };
})();
