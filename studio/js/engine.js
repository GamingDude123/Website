/* The instrument: graph, transport, and the bounce.
 *
 * One builder puts the graph together and one function triggers a pad, and
 * both take the context as an argument. That is what lets the WAV export be a
 * real render rather than a recording of the speakers — the bounce runs the
 * same code against an OfflineAudioContext and comes out sample-identical to
 * what you were just listening to.
 */

var Engine = (function () {
  "use strict";

  const STEPS = 16;
  const LOOKAHEAD = 0.12;   // seconds of pattern scheduled in advance
  const TICK_MS = 25;

  const state = {
    bpm: 132,
    swing: 0.18,
    playing: false,
    step: 0,
    nextStepTime: 0,
    pads: [],
    rows: {},
    // Conservative master level on purpose: a kit is a stack of peak-normalised
    // one-shots, so leaving headroom is what keeps the limiter from squashing
    // the life out of the pattern.
    master: { volume: 0.9, reverb: 0.35, delay: 0.3, sidechain: 0.45, delayBeats: 0.75 },
  };

  let ctx = null;
  let live = null;
  let timer = null;
  let previewSource = null;
  const stepListeners = [];
  const scheduled = [];       // {step, time} waiting for the playhead to reach them
  const voices = {};          // padId -> active sources, for choking

  // ------------------------------------------------------------------ setup

  function context() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctor();
    }
    return ctx;
  }

  function resume() {
    const c = context();
    if (c.state === "suspended") return c.resume();
    return Promise.resolve();
  }

  /* A plate reverb built from filtered noise. Cheaper than shipping an impulse
   * response, and the shape is easy to tune: exponential decay, damped highs,
   * and a few milliseconds of pre-delay so the transient still cuts through. */
  function makeImpulse(c, seconds, decay) {
    const len = Math.max(1, Math.floor(c.sampleRate * seconds));
    const ir = c.createBuffer(2, len, c.sampleRate);
    const preDelay = Math.floor(c.sampleRate * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const data = new Float32Array(len);
      for (let i = preDelay; i < len; i++) {
        const t = (i - preDelay) / (len - preDelay);
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
      DSP.biquad(data, c.sampleRate, "lowpass", 7200, 0.7);
      DSP.biquad(data, c.sampleRate, "highpass", 240, 0.7);
      ir.copyToChannel(data, ch);
    }
    return ir;
  }

  function buildBus(c, master) {
    const out = c.createGain();
    out.gain.value = master.volume;

    // Glue, then a fast limiter, then a soft clipper.
    //
    // Every pad is peak-normalised, so eight of them landing on beat one add up
    // to well over full scale. A DynamicsCompressorNode cannot be trusted as
    // the last line of defence — it has no look-ahead, so the first
    // millisecond of a transient goes straight past it. The clipper is a fixed
    // curve rather than a moving target: y = 0.98·tanh(1.3x) can never leave
    // ±0.98 however hard it is driven, which is what makes the bounce safe.
    // Glue sits high with a gentle ratio: it is here to catch the moments when
    // several pads land together, not to level the whole bar. Set low enough to
    // be working all the time it flattens the pattern into a wall — the drums
    // stop moving and the crest factor collapses by several dB.
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -8;
    glue.knee.value = 8;
    glue.ratio.value = 1.8;
    glue.attack.value = 0.03;
    glue.release.value = 0.25;

    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -1.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.09;

    const clipper = c.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = 0.98 * Math.tanh(1.3 * x);
    }
    clipper.curve = curve;
    clipper.oversample = "2x";

    out.connect(glue);
    glue.connect(limiter);
    limiter.connect(clipper);
    clipper.connect(c.destination);

    // Everything except the kick runs through here so the kick can duck it.
    const ducked = c.createGain();
    ducked.gain.value = 1;
    ducked.connect(out);

    const dry = c.createGain();
    dry.connect(out);

    const reverbSend = c.createGain();
    reverbSend.gain.value = 1;
    const convolver = c.createConvolver();
    convolver.buffer = makeImpulse(c, 1.9, 2.6);
    const reverbReturn = c.createGain();
    reverbReturn.gain.value = master.reverb;
    reverbSend.connect(convolver);
    convolver.connect(reverbReturn);
    reverbReturn.connect(out);

    const delaySend = c.createGain();
    delaySend.gain.value = 1;
    const delay = c.createDelay(2);
    delay.delayTime.value = Math.min(1.99, (master.delayBeats * 60) / state.bpm);
    const damp = c.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3200;
    const feedback = c.createGain();
    feedback.gain.value = 0.38;
    const delayReturn = c.createGain();
    delayReturn.gain.value = master.delay;
    delaySend.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(delayReturn);
    delayReturn.connect(out);

    return {
      out: out,
      dry: dry,
      ducked: ducked,
      reverbSend: reverbSend,
      reverbReturn: reverbReturn,
      delaySend: delaySend,
      delay: delay,
      delayReturn: delayReturn,
      limiter: limiter,
      clipper: clipper,
    };
  }

  function liveBus() {
    if (!live) {
      const c = context();
      live = buildBus(c, state.master);
      live.analyser = c.createAnalyser();
      live.analyser.fftSize = 2048;
      live.clipper.connect(live.analyser);
    }
    return live;
  }

  // ------------------------------------------------------------------- pads

  /* AudioBuffers belong to the context that made them, so each pad keeps one
   * per context and rebuilds it when its samples change. */
  function bufferFor(c, pad) {
    if (!pad._cache) pad._cache = new Map();
    const hit = pad._cache.get(c);
    if (hit && hit.version === pad.version) return hit.buffer;

    let samples = pad.usePolished && pad.polished ? pad.polished : pad.raw;
    if (pad.reverse) samples = DSP.reverse(samples);
    const buffer = c.createBuffer(1, samples.length, pad.sampleRate || c.sampleRate);
    buffer.copyToChannel(Float32Array.from(samples), 0);
    pad._cache.set(c, { version: pad.version, buffer: buffer });
    return buffer;
  }

  function padById(id) {
    for (let i = 0; i < state.pads.length; i++) {
      if (state.pads[i].id === id) return state.pads[i];
    }
    return null;
  }

  /* Play one pad. `when` is on the context clock, so this works identically
   * for a finger on a pad and for a step being rendered offline. */
  function trigger(c, bus, pad, when, velocity, live) {
    if (pad.mute) return null;
    const buffer = bufferFor(c, pad);
    if (!buffer || !buffer.length) return null;

    const src = c.createBufferSource();
    src.buffer = buffer;
    // A sampler tuned by ear: the pitch knob is a playback-rate change, which
    // shortens the sound as it raises it, exactly like a hardware sampler.
    src.playbackRate.value = Math.pow(2, (pad.pitch || 0) / 12);

    const gain = c.createGain();
    gain.gain.value = Math.max(0, velocity * (pad.gain === undefined ? 1 : pad.gain));

    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) pan.pan.value = pad.pan || 0;

    src.connect(gain);
    const tail = pan ? (gain.connect(pan), pan) : gain;
    tail.connect(pad.duck >= 0.3 ? bus.ducked : bus.dry);
    if (pad.sends) {
      if (pad.sends.reverb > 0) {
        const send = c.createGain();
        send.gain.value = pad.sends.reverb;
        tail.connect(send);
        send.connect(bus.reverbSend);
      }
      if (pad.sends.delay > 0) {
        const send = c.createGain();
        send.gain.value = pad.sends.delay;
        tail.connect(send);
        send.connect(bus.delaySend);
      }
    }

    const full = buffer.duration / src.playbackRate.value;
    const gate = pad.length === undefined || pad.length >= 0.999 ? full : full * pad.length;

    if (live) {
      if (voices[pad.id] && pad.choke !== false) {
        const old = voices[pad.id];
        try {
          old.gain.gain.cancelScheduledValues(when);
          old.gain.gain.setTargetAtTime(0, when, 0.004);
          old.src.stop(when + 0.05);
        } catch (err) { /* already finished */ }
      }
      voices[pad.id] = { src: src, gain: gain };
    }

    src.start(when);
    if (gate < full) {
      gain.gain.setValueAtTime(gain.gain.value, when + gate * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0005, when + gate);
      src.stop(when + gate + 0.02);
    }

    // The kick pulls the rest of the mix down under it. This is the one thing
    // that makes a kit of separate recordings sound like a single record.
    if (pad.role === "kick" && state.master.sidechain > 0) {
      const g = bus.ducked.gain;
      const depth = 1 - state.master.sidechain;
      g.cancelScheduledValues(when);
      g.setValueAtTime(1, when);
      g.linearRampToValueAtTime(depth, when + 0.012);
      g.setTargetAtTime(1, when + 0.03, 0.06);
    }
    return src;
  }

  // -------------------------------------------------------------- transport

  function stepDuration() {
    return 60 / state.bpm / 4;
  }

  /* Swing pushes every second sixteenth later, up to half a step. */
  function swingOffset(index) {
    return index % 2 === 1 ? state.swing * stepDuration() * 0.5 : 0;
  }

  function scheduleStep(c, bus, index, bar, time, isLive) {
    for (let i = 0; i < state.pads.length; i++) {
      const pad = state.pads[i];
      const row = state.rows[pad.id];
      if (!row) continue;
      const velocity = row.steps[index];
      if (!velocity) continue;
      // A pad fitted to more than one bar is only retriggered when its own
      // cycle comes round again.
      if (row.loop) {
        const padBars = Math.max(1, Math.round((pad.beats || 4) / 4));
        if (index !== 0 || bar % padBars !== 0) continue;
      }
      trigger(c, bus, pad, time, velocity, isLive);
    }
  }

  function tick() {
    const c = context();
    const bus = liveBus();
    while (state.nextStepTime < c.currentTime + LOOKAHEAD) {
      const index = state.step % STEPS;
      const bar = Math.floor(state.step / STEPS);
      const time = state.nextStepTime + swingOffset(index);
      scheduleStep(c, bus, index, bar, time, true);
      scheduled.push({ step: index, time: time });
      state.nextStepTime += stepDuration();
      state.step++;
    }
  }

  function play() {
    if (state.playing) return Promise.resolve();
    return resume().then(function () {
      const c = context();
      liveBus();
      state.playing = true;
      state.step = 0;
      state.nextStepTime = c.currentTime + 0.08;
      tick();
      timer = setInterval(tick, TICK_MS);
    });
  }

  function stop() {
    state.playing = false;
    if (timer) clearInterval(timer);
    timer = null;
    scheduled.length = 0;
    if (ctx) {
      const now = ctx.currentTime;
      Object.keys(voices).forEach(function (id) {
        const v = voices[id];
        try {
          v.gain.gain.setTargetAtTime(0, now, 0.01);
          v.src.stop(now + 0.1);
        } catch (err) { /* already finished */ }
        delete voices[id];
      });
      if (live) {
        // Cancelling the sidechain automation is not enough: stopping in the
        // middle of a duck would leave the gain wherever the ramp had got to,
        // and the whole mix would come back quieter next time.
        live.ducked.gain.cancelScheduledValues(now);
        live.ducked.gain.setValueAtTime(1, now);
      }
    }
    notify(-1);
  }

  function notify(step) {
    for (let i = 0; i < stepListeners.length; i++) stepListeners[i](step);
  }

  /* Drives the playhead from the audio clock rather than from a timer, so the
   * highlight cannot drift away from what you are hearing. */
  function pump() {
    if (ctx) {
      while (scheduled.length && scheduled[0].time <= ctx.currentTime) {
        notify(scheduled.shift().step);
      }
    }
    requestAnimationFrame(pump);
  }

  /* Play a bare buffer of samples once, with none of the pad machinery. Used
   * by the instrument picker, which has to be audible before a pad exists. */
  function preview(samples, sampleRate) {
    return resume().then(function () {
      const c = context();
      const bus = liveBus();
      const buffer = c.createBuffer(1, samples.length, sampleRate || c.sampleRate);
      buffer.copyToChannel(Float32Array.from(samples), 0);
      if (previewSource) {
        try { previewSource.stop(); } catch (err) { /* already finished */ }
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const gain = c.createGain();
      gain.gain.value = 0.9;
      src.connect(gain);
      gain.connect(bus.dry);
      src.start(c.currentTime + 0.005);
      previewSource = src;
    });
  }

  function tap(padId, velocity) {
    return resume().then(function () {
      const c = context();
      const pad = padById(padId);
      if (!pad) return;
      trigger(c, liveBus(), pad, c.currentTime + 0.005, velocity === undefined ? 1 : velocity, true);
    });
  }

  // ---------------------------------------------------------------- bounce

  /* Render the pattern offline and hand back a stereo AudioBuffer. */
  function bounce(bars) {
    const c = context();
    const stepDur = stepDuration();
    const musicLength = bars * STEPS * stepDur;
    const tail = 2.5;                     // room for reverb and delay to finish
    const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new Ctor(2, Math.ceil((musicLength + tail) * c.sampleRate), c.sampleRate);
    const bus = buildBus(off, state.master);

    for (let s = 0; s < bars * STEPS; s++) {
      const index = s % STEPS;
      const bar = Math.floor(s / STEPS);
      scheduleStep(off, bus, index, bar, s * stepDur + swingOffset(index) + 0.02, false);
    }
    return off.startRendering();
  }

  // ------------------------------------------------------------------- api

  function setTempo(bpm) {
    state.bpm = Math.max(60, Math.min(200, bpm));
    if (live) {
      live.delay.delayTime.setTargetAtTime(
        Math.min(1.99, (state.master.delayBeats * 60) / state.bpm), ctx.currentTime, 0.05
      );
    }
  }

  function setMaster(key, value) {
    state.master[key] = value;
    if (!live) return;
    const now = ctx.currentTime;
    if (key === "volume") live.out.gain.setTargetAtTime(value, now, 0.02);
    if (key === "reverb") live.reverbReturn.gain.setTargetAtTime(value, now, 0.02);
    if (key === "delay") live.delayReturn.gain.setTargetAtTime(value, now, 0.02);
    if (key === "delayBeats") {
      live.delay.delayTime.setTargetAtTime(Math.min(1.99, (value * 60) / state.bpm), now, 0.05);
    }
  }

  if (typeof requestAnimationFrame === "function") pump();

  return {
    state: state,
    context: context,
    resume: resume,
    pads: function () { return state.pads; },
    padById: padById,
    addPad: function (pad) { state.pads.push(pad); return pad; },
    removePad: function (id) {
      state.pads = state.pads.filter(function (p) { return p.id !== id; });
      delete state.rows[id];
      delete voices[id];
    },
    setRow: function (id, steps, loop) {
      state.rows[id] = { steps: steps, loop: !!loop };
    },
    rows: function () { return state.rows; },
    clearRows: function () { state.rows = {}; },
    tap: tap,
    preview: preview,
    play: play,
    stop: stop,
    toggle: function () { return state.playing ? (stop(), Promise.resolve()) : play(); },
    isPlaying: function () { return state.playing; },
    setTempo: setTempo,
    setSwing: function (v) { state.swing = Math.max(0, Math.min(0.5, v)); },
    setMaster: setMaster,
    onStep: function (fn) { stepListeners.push(fn); },
    analyser: function () { return liveBus().analyser; },
    bus: liveBus,
    bounce: bounce,
    steps: STEPS,
  };
})();
