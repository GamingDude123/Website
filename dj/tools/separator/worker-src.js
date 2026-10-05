/* Worker entry for the vocal separator. build.sh bundles this file, src/core.js and
 * onnxruntime-web into dj/vendor/separator/worker.js (a classic worker, no imports at runtime).
 *
 * Messages from the page (see js/separator.js, which is the only sender):
 *   {t:"model-begin", bytes, allowWasm, forceWasm}   allocate room for the model
 *   {t:"model-part", offset, buf}                    one part of the model, transferred; copied into place
 *   {t:"model-create"}                               build the onnxruntime session
 *   {t:"sep", id, channels, overlap}                 separate one song (channels are the worker's own copy)
 *   {t:"abort", id}                                  stop separating song `id` after the chunk in progress
 *   {t:"dispose"}                                    release the session
 * Messages to the page:
 *   {t:"loading", progress}   {t:"ready", ep}   {t:"fail", reason, detail}
 *   {t:"progress", id, f}   {t:"done", id, vocals, inst, seconds}   {t:"error", id, name, message}
 */

import * as ort from "onnxruntime-web";
const Core = require("./src/core.js");

let model = null, session = null, ep = "", cfg = { allowWasm: false, forceWasm: false };
const aborted = new Set();

function say(msg, transfer) { self.postMessage(msg, transfer || []); }

function explain(e) {
  const m = String((e && e.message) || e || "unknown error");
  if (/memory|alloc|OOM|out of/i.test(m)) return "Not enough memory to run the vocal separation model (" + m.slice(0, 120) + ")";
  return m.slice(0, 300);
}

// ort is told where its single wasm file is: next to this worker, whatever the base path of the site.
// The bundle carries its own copy of the wasm loader, so only the .wasm is fetched (no import() of an
// .mjs, which would not work everywhere from a classic worker). Without cross-origin isolation (GitHub Pages
// cannot send the headers) there are no SharedArrayBuffer threads: run on one.
function configureOrt() {
  ort.env.wasm.wasmPaths = { wasm: new URL("ort/ort-wasm-simd-threaded.jsep.wasm", self.location.href).href };
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.logLevel = "error";
  if (ort.env.webgpu) ort.env.webgpu.powerPreference = "high-performance";
}

async function checkWebGPU() {
  if (!self.navigator || !navigator.gpu) throw new Error("WebGPU is not available in this browser");
  let adapter = null;
  try { adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" }); } catch (e) { /* none */ }
  if (!adapter) throw new Error("No WebGPU adapter was found (the graphics card or its driver is not supported)");
  return adapter;
}

function silence() {      // one chunk of digital silence: the network normalises its input, so this is a valid input
  const feeds = {};
  feeds[session.inputNames[0]] = new ort.Tensor("float32", new Float32Array(2 * Core.SEGMENT), [1, 2, Core.SEGMENT]);
  feeds[session.inputNames[1]] = new ort.Tensor("float32", new Float32Array(4 * Core.FREQS * Core.FRAMES), [1, 4, Core.FREQS, Core.FRAMES]);
  return feeds;
}

async function createSession() {
  configureOrt();
  const bytes = model; model = null;
  const errors = [];
  let made = null, madeEp = "";
  if (!cfg.forceWasm) {
    try {
      await checkWebGPU();
      const s = await ort.InferenceSession.create(bytes, { executionProviders: ["webgpu"], graphOptimizationLevel: "all", enableMemPattern: false, enableCpuMemArena: false });
      say({ t: "loading", progress: 0.7 });
      // a first run compiles the shaders and shows that the GPU really can run this network
      session = s;
      const out = await s.run(silence());
      for (const k in out) { const d = out[k].data; if (!d || !isFinite(d[0])) throw new Error("the GPU returned invalid numbers"); }
      made = s; madeEp = "webgpu";
    } catch (e) {
      errors.push("WebGPU: " + explain(e));
      if (session) { try { await session.release(); } catch (e2) { /* ignore */ } session = null; }
    }
  }
  if (!made && (cfg.allowWasm || cfg.forceWasm)) {
    try {
      // "disabled": the same numbers (to 1e-7) and the same speed as "all" (measured: 25.0 s vs 24.4 s per chunk), but the
      // renderer peaked at 1.5 GB instead of 2.6 GB, because graph optimisation copies the weights (constant folding, fusion)
      made = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "disabled" });
      madeEp = "wasm";
    } catch (e) { errors.push("WASM: " + explain(e)); }
  }
  if (!made) throw new Error(errors.join("; ") || "no way to run the model");
  session = made; ep = madeEp;
  return errors;
}

async function onCreate() {
  try {
    say({ t: "loading", progress: 0.2 });
    await createSession();
    say({ t: "ready", ep: ep });
  } catch (e) {
    model = null;
    say({ t: "fail", reason: explain(e), detail: String((e && e.stack) || e).slice(0, 600) });
  }
}

async function onSeparate(m) {
  const t0 = performance.now();
  try {
    if (!session) throw new Error("the separator is not loaded");
    const r = await Core.separate(ort, session, m.channels, {
      overlap: m.overlap,
      onProgress: function (f) { say({ t: "progress", id: m.id, f: f }); },
      isAborted: function () { return aborted.has(m.id); }
    });
    const bufs = [r.vocals[0].buffer, r.vocals[1].buffer, r.inst[0].buffer, r.inst[1].buffer];
    say({ t: "done", id: m.id, vocals: r.vocals, inst: r.inst, seconds: (performance.now() - t0) / 1000 }, bufs);
  } catch (e) {
    say({ t: "error", id: m.id, name: (e && e.name) || "Error", message: explain(e) });
  } finally {
    aborted.delete(m.id);
  }
}

let modelFill = 0;
self.onmessage = function (ev) {
  const m = ev.data || {};
  try {
    switch (m.t) {
      case "model-begin":
        cfg = { allowWasm: !!m.allowWasm, forceWasm: !!m.forceWasm };
        model = new Uint8Array(m.bytes); modelFill = 0;
        break;
      case "model-part":
        model.set(new Uint8Array(m.buf), m.offset); modelFill += m.buf.byteLength;
        break;
      case "model-create":
        onCreate();
        break;
      case "sep":
        onSeparate(m);
        break;
      case "abort":
        aborted.add(m.id);
        break;
      case "dispose":
        model = null;
        if (session) { session.release().catch(function () {}); session = null; }
        break;
    }
  } catch (e) {
    say({ t: "fail", reason: explain(e), detail: String((e && e.stack) || e).slice(0, 600) });
  }
};
