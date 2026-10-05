/* AI vocal separation: Meta's Demucs v4 ("htdemucs", 4 stems) running in the browser.
 *
 * The network is a 174 MB ONNX file, kept in dj/models/htdemucs as four parts (GitHub will not take a file
 * over 100 MB). This module downloads the parts once, keeps them in the Cache API so the next visit needs no
 * download, hands them to a Web Worker (vendor/separator/worker.js: onnxruntime-web, WebGPU first) and then
 * answers separate() calls by cutting a song into 7.8 s chunks in that worker.
 *
 *   Separator.supported()                  WebGPU (and Worker) present, or configure({allowWasm:true}) was called
 *   Separator.state()                      {phase: idle|downloading|loading|ready|unavailable, progress 0..1, reason, ep}
 *   Separator.onState(fn)                  fn(state) on every change; returns an unsubscribe function
 *   Separator.init()                       Promise<boolean>; starts the download + session; never rejects; idempotent
 *   Separator.separate(channels, sr, onProgress, signal)
 *                                          -> Promise<{vocals:[L,R], inst:[L,R], seconds}>, one song at a time
 *   Separator.cancelAll()                  rejects the running and all queued separations with an AbortError
 *   Separator.configure({allowWasm, forceWasm, workerUrl, modelBase, overlap})
 *   Separator.dispose()                    stop the worker and free its memory (init() starts a new one)
 *
 * It needs WebGPU: on the CPU (wasm) the network runs at a small fraction of real time. allowWasm exists for
 * tests and as a last resort; the worker then falls back to wasm if the WebGPU session cannot be made.
 * `inst` is drums + bass + other of the model, summed. Both stems are always stereo and as long as the input.
 *
 * Failure never throws out of init() or state(): the phase becomes "unavailable" and `reason` says why in words.
 */

var Separator = (function () {
  "use strict";

  const CACHE_NAME = "autopilot-dj-model-v1";    // bump together with the model files: the manifest is cached with the parts
  const SAMPLE_RATE = 44100;

  const cfg = { allowWasm: false, forceWasm: false, workerUrl: null, modelBase: null, overlap: 0.25 };
  let st = { phase: "idle", progress: 0, reason: undefined, ep: undefined };
  const subs = [];
  let worker = null, initP = null, permanent = false, loadWaiter = null, loadToken = 0, workerFail = null;
  let nextId = 1, active = null;
  const queue = [];

  // ---- state -------------------------------------------------------------------------------
  function copyState() { return { phase: st.phase, progress: st.progress, reason: st.reason, ep: st.ep }; }
  function state() { return copyState(); }
  function setState(phase, progress, reason, ep) {
    const next = { phase: phase, progress: Math.max(0, Math.min(1, progress || 0)), reason: reason, ep: phase === "ready" ? ep : undefined };
    const same = st.phase === next.phase && st.reason === next.reason && st.ep === next.ep;
    if (same && (st.progress === next.progress || (next.progress > 0 && next.progress < 1 && Math.abs(st.progress - next.progress) < 0.004))) return;
    st = next;
    subs.slice().forEach(function (fn) { try { fn(copyState()); } catch (e) { /* a listener's problem */ } });
  }
  function onState(fn) {
    if (typeof fn !== "function") throw new TypeError("Separator.onState needs a function");
    subs.push(fn);
    return function () { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
  }

  // ---- configuration -----------------------------------------------------------------------
  function configure(o) {
    o = o || {};
    if ("allowWasm" in o) cfg.allowWasm = !!o.allowWasm;
    if ("forceWasm" in o) cfg.forceWasm = !!o.forceWasm;
    if ("workerUrl" in o) cfg.workerUrl = o.workerUrl || null;
    if ("modelBase" in o) cfg.modelBase = o.modelBase || null;
    if ("overlap" in o && isFinite(o.overlap)) cfg.overlap = Math.min(0.9, Math.max(0, +o.overlap));
    return { allowWasm: cfg.allowWasm, forceWasm: cfg.forceWasm, workerUrl: cfg.workerUrl, modelBase: cfg.modelBase, overlap: cfg.overlap };
  }
  function pageBase() {
    if (typeof document !== "undefined" && document.baseURI) return document.baseURI;
    if (typeof location !== "undefined" && location.href) return location.href;
    return "http://localhost/";
  }
  function modelBase() {
    const b = cfg.modelBase ? new URL(cfg.modelBase, pageBase()).href : new URL("models/htdemucs/", pageBase()).href;
    return /\/$/.test(b) ? b : b + "/";
  }
  function workerUrl() { return new URL(cfg.workerUrl || "vendor/separator/worker.js", pageBase()).href; }

  function supported() {
    if (typeof Worker === "undefined") return false;
    if (cfg.allowWasm || cfg.forceWasm) return true;
    return !!(typeof navigator !== "undefined" && navigator.gpu);
  }

  function abortError() { const e = new Error("Separation was cancelled"); e.name = "AbortError"; return e; }

  // ---- getting the model -------------------------------------------------------------------
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join(""); }
  function openCache() {
    try { if (typeof caches !== "undefined") return caches.open(CACHE_NAME).catch(function () { return null; }); } catch (e) { /* none */ }
    return Promise.resolve(null);
  }
  function describeNet(url, e) {
    return "The vocal model could not be downloaded (" + (e && e.status ? "HTTP " + e.status : "network error") + ": " + url.replace(/^https?:\/\/[^/]+/, "") + ")";
  }

  async function getManifest(cache, base) {
    const url = base + "manifest.json";
    let resp = null;
    if (cache) { try { resp = await cache.match(url); } catch (e) { resp = null; } }
    let fromCache = !!resp;
    if (!resp) {
      let r;
      try { r = await fetch(url, { cache: "no-cache" }); } catch (e) { throw new Error(describeNet(url, e)); }
      if (!r.ok) throw new Error(describeNet(url, { status: r.status }));
      resp = r;
    }
    let man;
    const copy = resp.clone();
    try { man = await resp.json(); } catch (e) { throw new Error("The vocal model's manifest is not valid JSON (" + url + ")"); }
    const ok = man && Array.isArray(man.parts) && man.parts.length && man.parts.every(function (p) { return p && typeof p.file === "string" && p.bytes > 0; }) &&
      man.parts.reduce(function (s, p) { return s + p.bytes; }, 0) === man.bytes;
    if (!ok) { if (fromCache && cache) { try { await cache.delete(url); } catch (e) { /* ignore */ } } throw new Error("The vocal model's manifest is malformed (" + url + ")"); }
    if (!fromCache && cache) { try { await cache.put(url, copy); } catch (e) { /* storage full or refused: just not kept */ } }
    return man;
  }

  // one part: from the cache if it is there and the right size, else downloaded, checked and cached
  async function getPart(cache, base, part, onBytes) {
    const url = new URL(part.file, base).href;
    if (cache) {
      try {
        const hit = await cache.match(url);
        if (hit) {
          const ab = await hit.arrayBuffer();
          if (ab.byteLength === part.bytes) { onBytes(part.bytes); return ab; }
          await cache.delete(url);
        }
      } catch (e) { /* unreadable cache entry: download again */ }
    }
    let resp;
    try { resp = await fetch(url); } catch (e) { throw new Error(describeNet(url, e)); }
    if (!resp.ok) throw new Error(describeNet(url, { status: resp.status }));
    const buf = new Uint8Array(part.bytes);
    let got = 0;
    try {
      if (resp.body && resp.body.getReader) {
        const rd = resp.body.getReader();
        for (;;) {
          const r = await rd.read();
          if (r.done) break;
          if (got + r.value.length > part.bytes) throw new Error("size");
          buf.set(r.value, got); got += r.value.length; onBytes(r.value.length);
        }
      } else {
        const all = new Uint8Array(await resp.arrayBuffer());
        if (all.length > part.bytes) throw new Error("size");
        buf.set(all); got = all.length; onBytes(got);
      }
    } catch (e) {
      if (e && e.message === "size") throw new Error("A downloaded part of the vocal model is larger than expected (" + part.file + ")");
      throw new Error(describeNet(url, e));
    }
    if (got !== part.bytes) throw new Error("A downloaded part of the vocal model is damaged: " + got + " of " + part.bytes + " bytes (" + part.file + ")");
    if (part.sha256 && typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
      let h = null;
      try { h = hex(await crypto.subtle.digest("SHA-256", buf)); } catch (e) { /* not a secure context: skip the check */ }
      if (h && h !== part.sha256) throw new Error("A downloaded part of the vocal model is damaged (checksum differs: " + part.file + ")");
    }
    if (cache) {
      try { await cache.put(url, new Response(buf, { headers: { "Content-Type": "application/octet-stream", "Content-Length": String(part.bytes) } })); } catch (e) { /* storage full or refused: just not kept */ }
    }
    return buf.buffer;
  }

  // ---- the worker --------------------------------------------------------------------------
  function startWorker() {
    const url = workerUrl();
    const w = new Worker(url);
    w.heard = false;
    w.onmessage = function (ev) { w.heard = true; onWorkerMessage(ev); };
    w.onerror = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      crash(w.heard
        ? "The separation worker stopped" + (e && e.message ? " (" + e.message + ")" : "") + ". The page may be short of memory."
        : "The vocal separation worker could not be started (" + url.replace(/^https?:\/\/[^/]+/, "") + ")", w);
    };
    return w;
  }

  function crash(reason, w) {
    if (w && w !== worker) return;
    const waiter = loadWaiter; loadWaiter = null;
    loadToken++;                                          // a download still going on must not write over this
    if (worker) { try { worker.terminate(); } catch (e) { /* gone */ } worker = null; }
    const jobs = (active ? [active] : []).concat(queue.splice(0));
    active = null;
    jobs.forEach(function (j) { fail(j, new Error(reason)); });
    if (waiter) waiter.reject(new Error(reason));
    else if (st.phase === "ready" || st.phase === "loading" || st.phase === "downloading") { setState("unavailable", 0, reason); initP = Promise.resolve(false); }
  }

  function onWorkerMessage(ev) {
    const m = ev.data || {};
    switch (m.t) {
      case "loading":
        if (st.phase === "loading") setState("loading", m.progress);
        break;
      case "ready":
        if (loadWaiter) { const w = loadWaiter; loadWaiter = null; w.resolve(m.ep); }
        break;
      case "fail":
        if (loadWaiter) { const w = loadWaiter; loadWaiter = null; w.reject(new Error(m.reason || "The vocal separation model could not be started")); }
        else workerFail = m.reason || "The vocal separation model could not be started";          // still being sent the model: load() stops at its next step
        break;
      case "progress":
        if (active && active.id === m.id && !active.finished) active.onProgress(m.f);
        break;
      case "done":
      case "error": {
        const job = active && active.id === m.id ? active : null;
        if (!job) break;
        active = null;
        if (!job.finished) {
          if (m.t === "done") { job.onProgress(1); finish(job, { vocals: m.vocals, inst: m.inst, seconds: m.seconds }); }
          else { const e = new Error(m.message || "Separation failed"); e.name = m.name === "AbortError" ? "AbortError" : "Error"; fail(job, e); }
        }
        pump();
        break;
      }
    }
  }

  // ---- init --------------------------------------------------------------------------------
  function giveUp(reason, isPermanent) {
    if (worker) { try { worker.terminate(); } catch (e) { /* gone */ } worker = null; }
    loadWaiter = null;
    permanent = !!isPermanent;
    setState("unavailable", 0, reason);
    return false;
  }

  async function load() {
    if (!supported()) return giveUp(typeof Worker === "undefined" ? "This browser has no Web Workers" : "WebGPU is not available in this browser, so AI vocal separation cannot run here", true);
    // Is there a graphics card to run it on? Asked before anything is downloaded: a browser can have the
    // WebGPU API and no usable adapter, or only a software one, and 170 MB would then be fetched for nothing.
    let useWasm = !!cfg.forceWasm;
    if (!useWasm) {
      let ad = null;
      try { ad = await navigator.gpu.requestAdapter(); } catch (e) { ad = null; }
      const software = !!(ad && (ad.isFallbackAdapter || (ad.info && ad.info.isFallbackAdapter)));
      if (!ad || software) {
        if (!cfg.allowWasm) return giveUp(!ad ? "This browser has no graphics adapter it can use for WebGPU, so AI vocal separation cannot run here" : "This browser only has a software WebGPU adapter, which is far too slow for AI vocal separation", true);
        useWasm = true;
      }
    }
    setState("downloading", 0);
    const token = ++loadToken;
    workerFail = null;
    const cancelled = function () { const e = new Error("cancelled"); e.cancelled = true; return e; };
    try {
      const base = modelBase();
      const cache = await openCache();
      const man = await getManifest(cache, base);
      if (token !== loadToken) throw cancelled();
      worker = startWorker();
      const w = worker;
      w.postMessage({ t: "model-begin", bytes: man.bytes, allowWasm: cfg.allowWasm, forceWasm: useWasm });
      let done = 0, offset = 0;
      for (const part of man.parts) {
        const buf = await getPart(cache, base, part, function (n) { done += n; if (token === loadToken) setState("downloading", done / man.bytes * 0.999); });
        if (token !== loadToken || worker !== w) throw cancelled();
        if (workerFail) throw new Error(workerFail);
        w.postMessage({ t: "model-part", offset: offset, buf: buf }, [buf]);
        offset += part.bytes;
      }
      if (workerFail) throw new Error(workerFail);
      setState("downloading", 1);
      setState("loading", 0.05);
      const ep = await new Promise(function (resolve, reject) {
        loadWaiter = { resolve: resolve, reject: reject };
        w.postMessage({ t: "model-create" });
      });
      if (token !== loadToken) throw cancelled();
      setState("ready", 1, undefined, ep);
      return true;
    } catch (e) {
      if (e && e.cancelled) return false;                 // disposed, or the worker died and said why
      if (token !== loadToken) return false;
      return giveUp((e && e.message) || "The vocal separation model could not be loaded", false);
    }
  }

  function init(opts) {
    if (initP) {
      const retry = st.phase === "unavailable" && ((opts && opts.retry && !permanent) || (permanent && supported()));
      if (!retry) return initP;
    }
    initP = load().then(function (ok) { pump(); return ok; }, function (e) { giveUp((e && e.message) || "The vocal separation model could not be loaded", false); return false; });
    return initP;
  }

  // ---- separating --------------------------------------------------------------------------
  function finish(job, value) { if (job.finished) return; job.finished = true; cleanup(job); job.resolve(value); }
  function fail(job, err) { if (job.finished) return; job.finished = true; cleanup(job); job.reject(err); }
  function cleanup(job) { if (job.signal && job.onAbort) job.signal.removeEventListener("abort", job.onAbort); job.channels = null; }

  function abortJob(job) {
    if (job.finished) return;
    const wasActive = active === job;
    fail(job, abortError());
    const i = queue.indexOf(job);
    if (i >= 0) queue.splice(i, 1);
    if (wasActive && worker) worker.postMessage({ t: "abort", id: job.id });     // the worker answers when it has stopped; only then is the next song started
  }

  function pump() {
    if (active || !queue.length || st.phase !== "ready" || !worker) return;
    const job = queue.shift();
    if (job.finished) { pump(); return; }
    active = job;
    // The caller's arrays are the playing track's audio: send copies, handed over by transfer (one copy, not two)
    const copies = job.channels.map(function (c) { return c.slice(); });
    job.channels = null;
    job.onProgress(0);
    worker.postMessage({ t: "sep", id: job.id, channels: copies, overlap: cfg.overlap }, copies.map(function (c) { return c.buffer; }));
  }

  function separate(channels, sampleRate, onProgress, signal) {
    let list;
    try {
      if (sampleRate !== SAMPLE_RATE) throw new Error("Separator needs 44100 Hz audio, got " + sampleRate + " Hz: resample it first");
      list = channels && typeof channels.length === "number" ? Array.prototype.slice.call(channels) : null;
      if (!list || (list.length !== 1 && list.length !== 2)) throw new Error("Separator needs 1 or 2 channels of audio");
      if (!list.every(function (c) { return c instanceof Float32Array; })) throw new Error("Separator channels must be Float32Arrays");
      if (!list[0].length) throw new Error("Separator was given no audio");
      if (list.length === 2 && list[1].length !== list[0].length) throw new Error("Separator channels must be the same length");
    } catch (e) { return Promise.reject(e); }
    if (list.length === 2 && list[0] === list[1]) list = [list[0]];      // the same array twice is mono
    if (signal && signal.aborted) return Promise.reject(abortError());
    return new Promise(function (resolve, reject) {
      const job = {
        id: nextId++, channels: list, resolve: resolve, reject: reject, finished: false, signal: signal || null, onAbort: null,
        last: -1,
        onProgress: function (f) {
          f = Math.max(0, Math.min(1, f));
          if (f <= job.last) return;                      // monotonic, and 1 only once
          job.last = f;
          if (typeof onProgress === "function") { try { onProgress(f); } catch (e) { setTimeout(function () { throw e; }); } }      // the caller's bug is theirs to see, but must not stall the queue
        }
      };
      if (signal) { job.onAbort = function () { abortJob(job); }; signal.addEventListener("abort", job.onAbort); }
      queue.push(job);
      init().then(function (ok) {
        if (job.finished) return;
        if (!ok) { const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); fail(job, new Error("Vocal separation is unavailable: " + (st.reason || "the model could not be loaded"))); return; }
        pump();
      });
    });
  }

  function cancelAll() {
    const jobs = (active ? [active] : []).concat(queue.slice());
    jobs.forEach(abortJob);
  }

  function dispose() {
    cancelAll();
    if (worker) { try { worker.postMessage({ t: "dispose" }); worker.terminate(); } catch (e) { /* gone */ } worker = null; }
    const pending = loadWaiter;
    loadWaiter = null; initP = null; permanent = false; active = null; loadToken++;
    if (pending) { const e = new Error("cancelled"); e.cancelled = true; pending.reject(e); }       // so nobody waits on init() for ever
    setState("idle", 0);
  }

  return { supported: supported, state: state, onState: onState, init: init, separate: separate, cancelAll: cancelAll, configure: configure, dispose: dispose, SAMPLE_RATE: SAMPLE_RATE };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Separator;
