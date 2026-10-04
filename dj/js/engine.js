/* The mixer: two-deck-style Web Audio graph plus the scheduling that carries
 * out a plan from brain.js.
 *
 * Every voice (one per track play) is
 *   source → env → trim → low/mid/high EQ → highpass → lowpass → tap
 *   tap → fader → master            (dry)
 *   tap → echo send, reverb send    (tails that outlive the fader)
 * and the master is a glue compressor, a limiter and the volume.
 *
 * All automation is placed on the audio clock, in one go, ahead of time — the
 * main thread only decides *what* to schedule, never *when* a note lands, so a
 * busy page cannot make a bass swap late. The same code drives an
 * OfflineAudioContext, which is how a set is exported and how it is tested.
 */

var Engine = (function () {
  "use strict";

  const KILL = -40;               // dB — an EQ "kill"
  const TARGET_DB = -12;          // loudness every track is levelled to
  const LOOKAHEAD = 24;           // seconds before a transition that it is scheduled
  const BRAKE = 0.9;              // seconds a pause takes to bring the platters to rest
  const SPINUP = 0.55;            // ... and a resume to bring them back to speed
  const VOX_N = 512;              // the vocal worklet's latency in samples (vocal-worklet.js)
  const SCRIPT_BASE = typeof document !== "undefined" && document.currentScript ? document.currentScript.src.replace(/[^/]*$/, "") : "";

  // The vocal remover is an AudioWorklet next to this file. Resolves true when it is loaded
  // (once per context), false where worklets are not available.
  function loadVox(ctx) {
    if (!ctx.audioWorklet || typeof AudioWorkletNode === "undefined") return Promise.resolve(false);
    if (!ctx.__voxLoad) ctx.__voxLoad = ctx.audioWorklet.addModule(SCRIPT_BASE + "vocal-worklet.js").then(function () { return true; }, function () { return false; });
    return ctx.__voxLoad;
  }

  const db = function (x) { return Math.pow(10, x / 20); };

  function ramp(p, t0, t1, v0, v1) {
    p.setValueAtTime(v0, t0);
    p.linearRampToValueAtTime(v1, t1);
  }
  // An eased S-curve from v0 to v1 (raised cosine). A straight-line fade has a
  // corner at each end that the ear picks up as a lurch; this does not. Values
  // are interpolated in the parameter's own units, so for EQ gains that means
  // dB, which is the perceptually even way.
  function curve(p, t0, t1, v0, v1) {
    const n = 96, arr = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1); arr[i] = v0 + (v1 - v0) * (0.5 - 0.5 * Math.cos(Math.PI * x)); }
    p.setValueCurveAtTime(arr, t0, Math.max(0.01, t1 - t0));
  }
  // The same, for any shape: fn(x) gives the value at 0..1 along the way.
  function curveFn(p, t0, t1, fn) {
    const n = 96, arr = new Float32Array(n);
    for (let i = 0; i < n; i++) arr[i] = fn(i / (n - 1));
    p.setValueCurveAtTime(arr, t0, Math.max(0.01, t1 - t0));
  }
  // Equal-power crossfade of two basslines, as EQ gain in dB: one rises as
  // sin, the other falls as cos, so each is 3 dB down at the midpoint and the
  // low end stays level. (Fading them straight in dB puts both at -20 dB in the
  // middle and the bass falls into a hole.)
  const dbOf = function (lin) { return Math.max(KILL, 20 * Math.log10(Math.max(1e-6, lin))); };
  const bassIn = function (x) { return dbOf(Math.sin(Math.PI / 2 * x)); };
  const bassOut = function (x) { return dbOf(Math.cos(Math.PI / 2 * x)); };
  const EPS = 1e-3;                 // events may not start inside a curve; begin the next just after it
  // How loud the incoming deck is, 0..1, as a blend goes from its first beat to
  // the swap. It starts silent and stays quiet while the crossfader is still on
  // the outgoing side, so what you hear follows what the knob shows.
  const fadeIn = function (x) { x = Math.max(0, Math.min(1, x)); return Math.pow(Math.sin(Math.PI / 2 * x), 1.5); };

  function expRamp(p, t0, t1, v0, v1) {
    p.setValueAtTime(v0, t0);
    p.exponentialRampToValueAtTime(v1, t1);
  }

  // ----------------------------------------------------------------- tracks

  function gridOf(track) {
    const a = track.analysis;
    return {
      bpm: a.bpm, beatLen: a.beatLen, barLen: a.barLen,
      downbeat: a.downbeat + (track.shiftBeats || 0) * a.beatLen,
    };
  }

  function infoOf(track) {
    const a = track.analysis;
    return {
      title0: track.title, bpm: a.bpm, key: track.keyOverride || a.key.camelot,
      energy: a.energy, bars: a.bars, cues: a.cues, sections: a.sections, lead: a.lead, stereo: a.stereo,
    };
  }

  function replayGain(track, settings) {
    if (settings && settings.levelMatch === false) return 1;
    return Math.max(0.3, Math.min(2.5, db(TARGET_DB - track.analysis.loudnessDb)));
  }

  // A copy of seconds [from, to] of a buffer, back to front, with where it sits in
  // the original: playing it forwards from `end - pos` is the track going
  // backwards from `pos`.
  function reversedWindow(ctx, buffer, from, to) {
    const sr = buffer.sampleRate;
    const a = Math.max(0, Math.floor(from * sr)), b = Math.min(buffer.length, Math.ceil(to * sr)), n = Math.max(1, b - a);
    const out = ctx.createBuffer(buffer.numberOfChannels, n, sr);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c), dst = out.getChannelData(c);
      for (let i = 0; i < n; i++) dst[i] = src[b - 1 - i];
    }
    return { buffer: out, start: a / sr, end: b / sr, sr: sr };
  }

  // ------------------------------------------------------------------ voice

  function Voice(mixer, track, t0, offset, rate, label) {
    const ctx = mixer.ctx;
    this.mixer = mixer; this.track = track; this.label = label;
    this.grid = gridOf(track);
    this.tl = new Timeline(t0, offset, rate);
    this.t0 = t0;
    this.extra = [];                       // roll slices and the like
    this.endTime = Infinity;

    const src = this.src = ctx.createBufferSource();
    src.buffer = track.buffer;
    src.playbackRate.setValueAtTime(rate, t0);
    this.env = ctx.createGain();
    this.trim = ctx.createGain(); this.trim.gain.value = replayGain(track, mixer.settings);
    this.low = ctx.createBiquadFilter(); this.low.type = "lowshelf"; this.low.frequency.value = 200;
    this.mid = ctx.createBiquadFilter(); this.mid.type = "peaking"; this.mid.frequency.value = 1000; this.mid.Q.value = 0.7;
    this.high = ctx.createBiquadFilter(); this.high.type = "highshelf"; this.high.frequency.value = 4000;
    this.hp = ctx.createBiquadFilter(); this.hp.type = "highpass"; this.hp.frequency.value = 10; this.hp.Q.value = 0.8;
    this.lp = ctx.createBiquadFilter(); this.lp.type = "lowpass"; this.lp.frequency.value = Math.min(20000, ctx.sampleRate * 0.45); this.lp.Q.value = 0.8;
    this.tap = ctx.createGain();
    this.fader = ctx.createGain();
    this.echoSend = ctx.createGain(); this.echoSend.gain.value = 0;
    this.revSend = ctx.createGain(); this.revSend.gain.value = 0;

    // every source reaches the deck through its own gate, so a jump or a scrub
    // can swap one for another without a click
    this.sg = ctx.createGain();
    src.connect(this.sg); this.sg.connect(this.env); this.env.connect(this.trim);
    if (mixer.voxOk) {
      // The vocal stage: every deck goes through the same delay, so the decks stay in time
      // with each other (and with the effects, which are delayed to match) whether or not
      // the vocal remover is switched on. The worklet itself is only made when first needed.
      this.voxIn = ctx.createGain();
      this.voxDry = ctx.createDelay(0.2); this.voxDry.delayTime.value = mixer.voxLat;
      this.voxDryGain = ctx.createGain();
      this.voxOut = ctx.createGain();
      this.trim.connect(this.voxIn); this.voxIn.connect(this.voxDry); this.voxDry.connect(this.voxDryGain);
      this.voxDryGain.connect(this.voxOut); this.voxOut.connect(this.low);
    } else this.trim.connect(this.low);
    this.voxMode = "off";
    this.low.connect(this.mid); this.mid.connect(this.high);
    this.high.connect(this.hp); this.hp.connect(this.lp); this.lp.connect(this.tap);
    this.tap.connect(this.fader); this.fader.connect(mixer.masterIn);
    this.tap.connect(this.echoSend); this.echoSend.connect(mixer.echoIn);
    this.tap.connect(this.revSend); this.revSend.connect(mixer.revIn);
    src.start(t0, Math.max(0, offset));
  }

  Voice.prototype.barTime = function (bar) { return this.grid.downbeat + bar * this.grid.barLen; };
  Voice.prototype.timeOfBar = function (bar) { return this.tl.timeAtPos(this.barTime(bar)); };
  Voice.prototype.barAt = function (t) { return (this.tl.posAt(t) - this.grid.downbeat) / this.grid.barLen; };
  Voice.prototype.tempoAt = function (t) { return this.grid.bpm * this.tl.rateAt(t); };
  Voice.prototype.beatSec = function (t) { return 60 / this.tempoAt(t); };

  // Freeze the tempo from time t: a glide still under way is cut off there
  // (the ramp is re-aimed at the value it has reached by t), so a later glide on
  // this deck starts from a state the timeline knows about.
  Voice.prototype.holdRate = function (t) {
    const rate = this.tl.rateAt(t), p = this.src.playbackRate;
    p.cancelScheduledValues(t);
    p.linearRampToValueAtTime(rate, t);
    this.tl.nodes = this.tl.nodes.filter(function (n) { return n.t < t; });
    this.tl.nodes.push({ t: t, r: rate });
  };

  Voice.prototype.rampRate = function (t0, t1, rate) {
    const cur = this.tl.rateAt(t0);
    this.src.playbackRate.setValueAtTime(cur, t0);
    this.src.playbackRate.linearRampToValueAtTime(rate, t1);
    this.tl.ramp(t0, t1, rate);
  };

  // Silence the main source from t (3 ms fade) — roll slices take over.
  Voice.prototype.cutMain = function (t) {
    this.env.gain.setValueAtTime(1, t);
    this.env.gain.linearRampToValueAtTime(0, t + 0.003);
  };

  Voice.prototype.stopAt = function (t) {
    try { this.src.stop(t); } catch (e) { /* already stopped */ }
    this.extra.forEach(function (n) { try { n.stop(t); } catch (e) { /* ditto */ } });
    this.endTime = t;
  };

  // Undo everything scheduled from `now` on — used when "mix now" replaces a
  // transition that has been scheduled but has not started yet.
  Voice.prototype.rollback = function (now) {
    const self = this;
    [this.fader.gain, this.env.gain, this.low.gain, this.mid.gain, this.high.gain, this.hp.frequency, this.lp.frequency,
      this.echoSend.gain, this.revSend.gain].forEach(function (p) { p.cancelScheduledValues(now); });
    this.holdRate(now);
    this.env.gain.setValueAtTime(1, now);
    this.fader.gain.setValueAtTime(1, now);
    this.low.gain.setValueAtTime(0, now); this.mid.gain.setValueAtTime(0, now); this.high.gain.setValueAtTime(0, now);
    this.hp.frequency.setValueAtTime(10, now);
    this.lp.frequency.setValueAtTime(Math.min(20000, this.mixer.ctx.sampleRate * 0.45), now);
    this.echoSend.gain.setValueAtTime(0, now); this.revSend.gain.setValueAtTime(0, now);
    this.extra.forEach(function (n) { try { n.stop(); } catch (e) { /* not started */ } try { n.disconnect(); } catch (e) { /* ok */ } });
    this.extra = [];
    this.exit = null; this.transitionEnd = null;
    const fxn = this.mixer.fxNodes || [];
    fxn.forEach(function (f) { if (f.t >= now - 0.01) { try { f.src.stop(); } catch (e) { /* ok */ } } });
    this.mixer.fxNodes = fxn.filter(function (f) { return f.t < now - 0.01; });
    this.mixer.fxEvents = (this.mixer.fxEvents || []).filter(function (e) { return e.t0 < now - 0.01; });
    void self;
  };

  // A source of this deck's track, started at t from `pos` seconds in, whose
  // speed follows `nodes` ([{t, r}, ...] from t on, linear between them), faded
  // in over `fade` — or along `gates` ([{t, g}, ...]) if given. `buffer` is the
  // track or a reversed copy of part of it.
  Voice.prototype.makeSource = function (buffer, t, pos, nodes, fade, gates) {
    const ctx = this.mixer.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const p = src.playbackRate;
    p.setValueAtTime(nodes[0].r, nodes[0].t);
    for (let i = 1; i < nodes.length; i++) p.linearRampToValueAtTime(nodes[i].r, nodes[i].t);
    const gate = ctx.createGain();
    gate.gain.value = gates ? gates[0].g : 0;            // closed from the very first sample (an event at the start time can land a frame late)
    if (gates) {
      gate.gain.setValueAtTime(gates[0].g, gates[0].t);
      for (let i = 1; i < gates.length; i++) gate.gain.linearRampToValueAtTime(gates[i].g, gates[i].t);
    } else {
      gate.gain.setValueAtTime(0, t);
      gate.gain.linearRampToValueAtTime(1, t + fade);
    }
    src.connect(gate); gate.connect(this.env);
    src.start(t, Math.max(0, pos));
    return { src: src, gate: gate };
  };

  // Let a source go: fade it out from t (from `level`, 1 unless it was already
  // part-way down), stop it, and tidy the graph later.
  Voice.prototype.retire = function (src, gate, t, fade, level) {
    gate.gain.cancelScheduledValues(t);
    gate.gain.setValueAtTime(level == null ? 1 : level, t);
    gate.gain.linearRampToValueAtTime(0, t + fade);
    try { src.stop(t + fade + 0.02); } catch (e) { /* never started */ }
    const mixer = this.mixer;
    if (!mixer.offline && typeof setTimeout === "function") {
      setTimeout(function () { try { src.disconnect(); gate.disconnect(); } catch (e) { /* ok */ } },
        Math.max(0, (t + fade + 0.2 - mixer.ctx.currentTime) * 1000) + 100);
    }
  };

  // Stop a source that has already faded itself out (its gate was ramped to
  // zero by whoever owns it) and clear it from the graph — without touching the gate.
  Voice.prototype.dispose = function (src, gate, t) {
    try { src.stop(t + 0.03); } catch (e) { /* never started */ }
    const mixer = this.mixer;
    if (!mixer.offline && typeof setTimeout === "function") {
      setTimeout(function () { try { src.disconnect(); gate.disconnect(); } catch (e) { /* ok */ } },
        Math.max(0, (t + 0.3 - mixer.ctx.currentTime) * 1000) + 100);
    }
  };

  // Put this deck on a fresh source at `pos`, from time t, and rebuild its
  // timeline to match. This is how a deck jumps, and how it comes back from a
  // pause: an AudioBufferSourceNode cannot seek, so the old one is faded out.
  Voice.prototype.replaceSource = function (t, pos, nodes, fade) {
    const f = fade == null ? 0.006 : fade;
    this.retire(this.src, this.sg, t, f);
    const n = this.makeSource(this.track.buffer, t, pos, nodes, f);
    this.src = n.src; this.sg = n.gate;
    const tl = new Timeline(nodes[0].t, pos, nodes[0].r);
    for (let i = 1; i < nodes.length; i++) tl.nodes.push({ t: nodes[i].t, r: nodes[i].r });
    this.tl = tl;
    if (isFinite(this.endTime)) { try { n.src.stop(this.endTime); } catch (e) { /* ok */ } }
  };

  // Beat-jump: carry on from `pos` at the speed the deck is already running.
  Voice.prototype.seek = function (t, pos, fade) {
    const nodes = [{ t: t, r: this.tl.rateAt(t) }];
    this.tl.nodes.forEach(function (n) { if (n.t > t) nodes.push({ t: n.t, r: n.r }); });      // a tempo glide under way carries on
    this.replaceSource(t, pos, nodes, fade == null ? 0.012 : fade);
  };

  // Is the vocal remover available for this deck (a stereo track, in a browser with worklets)?
  Voice.prototype.voxAvailable = function () {
    const a = this.track.analysis;
    return !!this.mixer.voxOk && this.track.buffer.numberOfChannels >= 2 && !(a && a.stereo === false);
  };

  // The worklet for this deck, made the first time it is needed.
  Voice.prototype.voxNode = function () {
    if (!this.vox) {
      const ctx = this.mixer.ctx;
      this.vox = new AudioWorkletNode(ctx, "vox-processor", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      this.voxWet = ctx.createGain(); this.voxWet.gain.value = 0;
      this.voxIn.connect(this.vox); this.vox.connect(this.voxWet); this.voxWet.connect(this.voxOut);
    }
    return this.vox;
  };

  // "off" (the deck as it is), "cut" (the centred vocals taken out: an instrumental) or "solo"
  // (only the centred vocals: the instrument taken out), from time t, glided over `glide` s.
  Voice.prototype.setVox = function (t, mode, glide) {
    if (!this.voxAvailable()) return false;
    const g = Math.max(0.02, glide == null ? 0.3 : glide), node = this.voxNode(), on = mode === "cut" || mode === "solo";
    const set = function (p, v) { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + g); };
    set(node.parameters.get("cut"), mode === "cut" ? 1 : 0);
    set(node.parameters.get("solo"), mode === "solo" ? 1 : 0);
    set(this.voxWet.gain, on ? 1 : 0);
    set(this.voxDryGain.gain, on ? 0 : 1);
    this.voxMode = on ? mode : "off";
    return true;
  };

  Voice.prototype.destroy = function () {
    try { this.src.stop(); } catch (e) { /* not started or already stopped */ }
    [this.src, this.sg, this.env, this.trim, this.low, this.mid, this.high, this.hp, this.lp, this.tap, this.fader, this.echoSend, this.revSend]
      .concat(this.voxIn ? [this.voxIn, this.voxDry, this.voxDryGain, this.voxOut] : []).concat(this.vox ? [this.vox, this.voxWet] : [])
      .concat(this.extra).forEach(function (n) { try { n.disconnect(); } catch (e) { /* ok */ } });
  };

  // ------------------------------------------------------------------ mixer

  function Mixer(ctx, opts) {
    opts = opts || {};
    this.ctx = ctx;
    this.offline = !!opts.offline;
    this.settings = Settings.sanitize(opts.settings);
    this.fxOn = opts.fx !== undefined ? opts.fx !== false : this.settings.fx;
    const dest = opts.destination || ctx.destination;

    this.masterIn = ctx.createGain();
    this.perfHP = ctx.createBiquadFilter(); this.perfHP.type = "highpass"; this.perfHP.frequency.value = 10; this.perfHP.Q.value = 0.9;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 2.5; this.comp.attack.value = 0.02; this.comp.release.value = 0.2; this.comp.knee.value = 6;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2; this.limiter.ratio.value = 20; this.limiter.attack.value = 0.001; this.limiter.release.value = 0.08; this.limiter.knee.value = 0;
    this.volume = ctx.createGain(); this.volume.gain.value = opts.volume == null ? 0.9 : opts.volume;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024;
    this.masterIn.connect(this.perfHP); this.perfHP.connect(this.comp); this.comp.connect(this.limiter);
    // the DJ pause fades the whole output through this, apart from the user's volume
    this.pauseGain = ctx.createGain();
    this.limiter.connect(this.pauseGain); this.pauseGain.connect(this.volume);
    this.volume.connect(dest); this.volume.connect(this.analyser);

    // tempo-synced echo
    this.echoIn = ctx.createGain();
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0.375;
    const fb = ctx.createGain(); fb.gain.value = 0.5;
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 3200;
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.8;
    this.echoIn.connect(this.delay); this.delay.connect(tone); tone.connect(fb); fb.connect(this.delay);
    tone.connect(echoOut); echoOut.connect(this.masterIn);
    this.perfEcho = ctx.createGain(); this.perfEcho.gain.value = 0;     // manual echo throw
    this.masterIn.connect(this.perfEcho); this.perfEcho.connect(this.echoIn);

    // reverb
    this.revIn = ctx.createGain();
    const conv = ctx.createConvolver();
    const ir = FX.reverbImpulse(ctx.sampleRate, 2.2);
    const irBuf = ctx.createBuffer(2, ir[0].length, ctx.sampleRate);
    irBuf.copyToChannel(ir[0], 0); irBuf.copyToChannel(ir[1], 1);
    conv.buffer = irBuf;
    const revOut = ctx.createGain(); revOut.gain.value = 0.7;
    this.revIn.connect(conv); conv.connect(revOut); revOut.connect(this.masterIn);

    // one-shot effect sounds
    this.fxGain = ctx.createGain(); this.fxGain.gain.value = 0.55;
    this.fxGain.connect(this.masterIn);
    this.buffers = {};
    this.fxEvents = [];                 // what the mix will do and when, for the display: {kind, t0, t1}
  }

  // Remember an effect that is scheduled (or being played by hand) so the page
  // can show it coming and show it happening.
  Mixer.prototype.noteFx = function (kind, t0, t1, auto) {
    this.fxEvents.push({ kind: kind, t0: t0, t1: Math.max(t1, t0 + 0.15), auto: !!auto });
    if (this.fxEvents.length > 80) this.fxEvents.splice(0, 20);
  };

  // Load what needs loading (the vocal worklet) before any voice is made. Safe to skip:
  // without it there is no vocal remover and nothing else changes.
  Mixer.prototype.init = async function () {
    this.voxOk = await loadVox(this.ctx);
    this.voxLat = 0;
    if (this.voxOk) {
      // the decks run VOX_N samples late; so do the effects, or a hit would land before the beat it is for
      this.voxLat = VOX_N / this.ctx.sampleRate;
      this.fxGain.disconnect();
      this.fxDelay = this.ctx.createDelay(0.2); this.fxDelay.delayTime.value = this.voxLat;
      this.fxGain.connect(this.fxDelay); this.fxDelay.connect(this.masterIn);
    }
    return this;
  };

  // kind -> "on" while it sounds, "plan" while it is still to come
  Mixer.prototype.fxState = function (now) {
    const out = {};
    this.fxEvents.forEach(function (e) {
      if (now >= e.t0 && now <= e.t1) out[e.kind] = "on";
      else if (e.t0 > now && !out[e.kind]) out[e.kind] = "plan";
    });
    return out;
  };

  Mixer.prototype.fxBuffer = function (kind, seconds) {
    const sr = this.ctx.sampleRate;
    // keyed on the exact length: a riser has to end on the swap, so one built
    // for a slightly different tempo cannot stand in for it
    const key = kind + (seconds ? Math.round(seconds * sr) : "");
    if (!this.buffers[key]) {
      const keys = Object.keys(this.buffers);
      if (keys.length > 10) delete this.buffers[keys[0]];
      const chans = kind === "riser" ? FX.riser(sr, seconds) : kind === "downlifter" ? FX.downlifter(sr, seconds) : kind === "crash" ? FX.crash(sr) :
        kind === "swell" ? FX.swell(sr, seconds) : kind === "snare" ? FX.snareRoll(sr, seconds) : kind === "zap" ? FX.zap(sr) : kind === "siren" ? FX.siren(sr, seconds) : FX.impact(sr);
      const b = this.ctx.createBuffer(chans.length, chans[0].length, sr);
      chans.forEach(function (c, i) { b.copyToChannel(c, i); });
      this.buffers[key] = b;
    }
    return this.buffers[key];
  };

  const LAMP = { riser: "riser", downlifter: "down", crash: "crash", impact: "hit", swell: "swell", snare: "snare", zap: "zap", siren: "siren" };
  const FX_LENGTH = { crash: 1.6, zap: 0.45, impact: 0.8 };
  Mixer.prototype.playFx = function (kind, t, seconds, gain, auto) {
    this.noteFx(LAMP[kind], t, t + (seconds || FX_LENGTH[kind] || 0.8), auto);
    const src = this.ctx.createBufferSource();
    src.buffer = this.fxBuffer(kind, seconds);
    const g = this.ctx.createGain(); g.gain.value = gain == null ? 1 : gain;
    src.connect(g); g.connect(this.fxGain);
    src.start(t);
    (this.fxNodes = this.fxNodes || []).push({ src: src, t: t, auto: !!auto });
    return src;
  };

  // DJ-style stop. The decks slow to a halt over `T` seconds — the pitch falls
  // with them and the output fades out at the end — instead of the sound just
  // being cut. Each deck keeps its planned timeline aside as `orig`; the clock
  // is frozen while paused, so every fade and EQ move scheduled ahead of this
  // stays valid, and spinUp() puts the decks back where that plan expects them.
  Mixer.prototype.brake = function (voices, t, T, soft) {
    T = T == null ? BRAKE : T;
    const held = [];
    voices.forEach(function (v) {
      const ts = Math.max(t, v.t0);                      // a deck that starts inside the brake is slowed from its first sample
      if (ts >= t + T || t >= v.endTime) return;          // not playing until after the stop: nothing to slow
      const r = v.tl.rateAt(ts), p = v.src.playbackRate;
      p.cancelScheduledValues(ts);
      if (t < v.t0) p.setValueAtTime(r, ts);              // (that cleared its own opening value)
      else p.linearRampToValueAtTime(r, ts);              // a tempo glide under way is cut off at the speed it reached
      p.linearRampToValueAtTime(0, t + T);
      const real = new Timeline(ts, v.tl.posAt(ts), r);   // what the deck really does now, for the display
      real.ramp(ts, t + T, 0);
      held.push({ voice: v, orig: v.tl });
      v.tl = real;
      if (soft) {                                       // a brake by hand: fade the decks themselves, not the whole output
        v.env.gain.setValueAtTime(1, t + 0.45 * T);
        v.env.gain.linearRampToValueAtTime(0, t + T);
      }
    });
    if (!soft) {
      const g = this.pauseGain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(1, t);
      g.setValueAtTime(1, t + 0.45 * T);
      g.linearRampToValueAtTime(0, t + T);
    }
    return { t: t, T: T, held: held, soft: !!soft };
  };

  // Spin the decks back up from rest over `S` seconds. A real platter restarts
  // where it stopped, but then the music would be late for everything already
  // scheduled, so each deck instead starts a little ahead — exactly far enough
  // that it arrives at full speed on the position the plan expects.
  Mixer.prototype.spinUp = function (state, t, S) {
    S = S == null ? SPINUP : S;
    const tEnd = t + S;
    state.held.forEach(function (h) {
      const o = h.orig, rho = o.rateAt(tEnd);
      const nodes = [{ t: t, r: 0 }, { t: tEnd, r: rho }];
      o.nodes.forEach(function (n) { if (n.t > tEnd) nodes.push({ t: n.t, r: n.r }); });
      h.voice.replaceSource(t, Math.max(0, o.posAt(tEnd) - rho * S / 2), nodes, 0.004);
      if (state.soft) {
        h.voice.env.gain.setValueAtTime(0, t);
        h.voice.env.gain.linearRampToValueAtTime(1, t + 0.4 * S);
      }
    });
    if (!state.soft) {
      const g = this.pauseGain.gain;                 // (still at 0 from the brake; nothing to cancel)
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(1, t + 0.4 * S);
    }
  };

  // ----------------------------------------------------------- automatic effects
  //
  // Brain.planFx says which effects a track invites (a riser into each of its own drops, hits on
  // phrase lines, ...); these put the ones in a window of bars on the audio clock, on the master
  // bus like the pads, and keep clear of the transitions: the way out of a track and the first
  // bars after the way in belong to the transition.

  // the bars of voice v in which automatic effects may sound: [min, max]
  Mixer.prototype.autoFxRange = function (v) {
    const info = infoOf(v.track);
    let min = 4, max = (info.cues && info.cues.outroStart != null ? info.cues.outroStart : info.bars) - 2;
    if (v.entry) min = Math.max(min, Math.ceil(v.barAt(v.entry.tSwap) + 4));
    if (v.exit) max = Math.min(max, Math.floor(v.barAt(v.exit.tBegin)) - 1);
    return { min: min, max: max };
  };

  // schedule the effects whose start bar is in [fromBar, toBar)
  Mixer.prototype.scheduleAutoFx = function (v, fromBar, toBar) {
    const s = this.settings, ctx = this.ctx;
    if (!this.fxOn || s.autoFx === "off") return 0;
    let n = 0;
    const self = this;
    Brain.planFx(infoOf(v.track), s.autoFx).forEach(function (e) {
      if (e.bar < fromBar || e.bar >= toBar) return;
      if (e.kind === "riser" && !s.risers) return;
      if (e.kind === "impact" && !s.impacts) return;
      if (e.kind === "crash" && !s.sweeps) return;
      const t = v.timeOfBar(e.bar);
      if (!(t > ctx.currentTime + 0.05) || t >= v.endTime) return;               // already gone by, or after this deck has ended
      const len = e.bars * v.beatSec(t) * 4;
      if (e.kind === "riser") self.playFx("riser", t, len, e.gain, true);
      else if (e.kind === "swell") { const d = Math.min(2.3, len); self.playFx("swell", t + len - d, d, e.gain, true); }   // ends on the hit that follows
      else if (e.kind === "snare") self.playFx("snare", t, len, e.gain, true);
      else if (e.kind === "siren") self.playFx("siren", t, Math.min(2, len), e.gain, true);
      else self.playFx(e.kind === "crash" ? "crash" : e.kind === "zap" ? "zap" : "impact", t, 0, e.gain, true);
      n++;
    });
    return n;
  };

  // live: keep the next ~14 seconds of the deck that is playing scheduled
  Mixer.prototype.autoFxTick = function (v, now) {
    if (!this.fxOn || this.settings.autoFx === "off" || now < v.t0) return;
    const r = this.autoFxRange(v);
    const from = Math.max(r.min, v.fxBar == null ? -Infinity : v.fxBar, Math.ceil(v.barAt(now) + 0.5)), to = Math.min(r.max + 1, v.barAt(now + 14));
    if (to <= from) return;
    this.scheduleAutoFx(v, from, to);
    v.fxBar = to;
  };

  // take back what was scheduled from `from` on (a transition is taking that stretch, or the deck was moved)
  Mixer.prototype.cancelAutoFx = function (from) {
    const gone = function (f) { return f.auto && f.t >= from - 0.01; };
    (this.fxNodes || []).forEach(function (f) { if (gone(f)) { try { f.src.stop(); } catch (e) { /* not started */ } } });
    this.fxNodes = (this.fxNodes || []).filter(function (f) { return !gone(f); });
    this.fxEvents = this.fxEvents.filter(function (e) { return !(e.auto && e.t0 >= from - 0.01); });
  };

  Mixer.prototype.firstVoice = function (track, t0, label) {
    const v = new Voice(this, track, t0, 0, 1, label || "A");
    v.entryBar = 0;
    v.fader.gain.setValueAtTime(0, t0);
    v.fader.gain.linearRampToValueAtTime(1, t0 + 0.02);
    return v;
  };

  // Roll the last bar of A: half-beat slices, then quarter, then eighth.
  // Repeats of a stretch of the deck's track: `groups` are [beat offset, beats long, slice in beats],
  // each slice replaying the audio that begins at the start of the group.
  Mixer.prototype.rollSlices = function (A, t0, srcPos0, rate, beat, groups) {
    const ctx = this.ctx;
    groups.forEach(function (g, gi) {
      const gStart = t0 + g[0] * beat;
      const srcPos = srcPos0 + g[0] * beat * rate;
      const sliceLen = g[2] * beat;
      const count = Math.round(g[1] / g[2]);
      for (let i = 0; i < count; i++) {
        const s = ctx.createBufferSource();
        s.buffer = A.track.buffer;
        s.playbackRate.value = rate;
        const e = ctx.createGain();
        const ts = gStart + i * sliceLen;
        e.gain.setValueAtTime(0, ts);
        e.gain.linearRampToValueAtTime(1 + 0.12 * gi, ts + 0.002);
        e.gain.setValueAtTime(1 + 0.12 * gi, ts + sliceLen - 0.004);
        e.gain.linearRampToValueAtTime(0, ts + sliceLen - 0.001);
        s.connect(e); e.connect(A.trim);
        s.start(ts, srcPos);
        s.stop(ts + sliceLen);
        A.extra.push(s, e);
      }
    });
  };

  // Roll the last bar of A: half-beat slices, then quarter, then eighth.
  Mixer.prototype.scheduleRoll = function (A, barIndex) {
    const t0 = A.timeOfBar(barIndex);
    A.cutMain(t0);
    this.rollSlices(A, t0, A.barTime(barIndex), A.tl.rateAt(t0), A.beatSec(t0), [[0, 2, 0.5], [2, 1, 0.25], [3, 1, 0.125]]);
  };

  // A loop roll by hand: from `at`, a beat of half-beat slices then a beat of quarters, and
  // the track comes back in on the beat it would have been on (the main source keeps
  // running, muted, so nothing slips). Returns when it ends.
  Mixer.prototype.rollNow = function (A, at) {
    const beat = A.beatSec(at), tEnd = at + 2 * beat;
    A.cutMain(at);
    this.rollSlices(A, at, A.tl.posAt(at), A.tl.rateAt(at), beat, [[0, 1, 0.5], [1, 1, 0.25]]);
    A.env.gain.setValueAtTime(0, tEnd - 0.004);
    A.env.gain.linearRampToValueAtTime(1, tEnd);
    this.noteFx("roll", at, tEnd);
    return tEnd;
  };

  // The deck wound backwards: the track played in reverse from `at`, fast, slowing as it goes.
  // The forward track is muted for the duration; `slip` brings it back on the beat afterwards
  // (a manual spinback); a transition handles the fade itself.
  Mixer.prototype.spinbackFx = function (A, at, slip) {
    const ctx = this.ctx, spin = 1.1, r0 = 3.2, r1 = 0.12, p = A.tl.posAt(at);
    const win = reversedWindow(ctx, A.track.buffer, p - ((r0 + r1) / 2 * spin + 0.4), p + 0.05);
    const rs = ctx.createBufferSource(), rg = ctx.createGain();
    rs.buffer = win.buffer;
    rs.playbackRate.setValueAtTime(r0, at);
    rs.playbackRate.linearRampToValueAtTime(r1, at + spin);
    rg.gain.setValueAtTime(0.9, at);
    rg.gain.linearRampToValueAtTime(0, at + spin);
    rs.connect(rg); rg.connect(A.trim);
    rs.start(at, Math.max(0, win.end - p - 1 / win.sr));
    A.extra.push(rs, rg);
    A.cutMain(at);                                          // the forward track gives way to the spin
    if (slip) {
      A.env.gain.setValueAtTime(0, at + spin - 0.004);
      A.env.gain.linearRampToValueAtTime(1, at + spin + 0.01);
    }
    this.noteFx("spin", at, at + spin);
    return spin;
  };

  Mixer.prototype.spinbackNow = function (A, at) { return at + this.spinbackFx(A, at, true); };

  // Carry out `plan` (from Brain.planTransition) from voice A into `track`.
  // Returns the incoming voice, with the times of interest on .entry.
  Mixer.prototype.scheduleTransition = function (A, track, plan, label) {
    const ctx = this.ctx;
    const gB = gridOf(track);
    const L = plan.blendBars;
    const tStart = A.timeOfBar(plan.startBar);
    const T0 = A.tempoAt(tStart);
    // a clean exit has no overlap to keep in time, so the incoming track just starts at its own tempo
    let rB0 = plan.freshTempo || plan.type === "echoOut" || plan.type === "brake" || plan.type === "spinback" || plan.type === "stutter" ? 1 : Math.max(0.88, Math.min(1.12, T0 / gB.bpm));
    const B = new Voice(this, track, tStart, gB.downbeat + plan.inStartBar * gB.barLen, rB0, label);
    B.entryBar = plan.inStartBar;

    let tSwap;
    if (plan.type === "bassSwap") {
      // Glide both decks to the incoming tempo over the second half of the
      // blend. With the same tempo curve on both, the bar lines stay locked;
      // the duration is chosen so A reaches the swap bar exactly as it ends.
      const n = L / 2;
      // B starts at A's tempo and holds it until the glide, so A must hold too —
      // it may still be settling from its own entry
      A.holdRate(tStart);
      const tg0 = A.timeOfBar(plan.swapBar - n);
      const Ta = A.tempoAt(tg0), Tb = gB.bpm;
      const D = 480 * n / (Ta + Tb);
      A.rampRate(tg0, tg0 + D, Tb / A.grid.bpm);
      B.rampRate(tg0, tg0 + D, 1);
      tSwap = A.timeOfBar(plan.swapBar);
    } else {
      tSwap = A.timeOfBar(plan.swapBar);
      if (plan.type === "dropSwap" && !plan.freshTempo) {
        // settle onto the new track's own tempo over its first 16 bars
        const Tb = gB.bpm, D = 480 * 16 / (T0 + Tb);
        B.rampRate(tSwap, tSwap + D, 1);
      }
    }
    // B started in the right place for a blend; for the others it must start
    // exactly on A's swap bar, which is what tStart already is (L = 0).

    const beat = A.beatSec(tSwap);
    const bar = beat * 4;
    // the transition takes this stretch of A: no automatic effects from just before it begins
    this.cancelAutoFx((plan.type === "bassSwap" ? tStart : A.timeOfBar(plan.swapBar - plan.buildBars)) - 0.5 * bar);
    A.fxBar = Infinity;
    // the plan carries the vibe: how much echo and reverb, how showy
    const amounts = plan.amounts || { echo: 55, reverb: 45 };
    const echoF = Math.min(1.8, amounts.echo / 55), revF = Math.min(1.8, amounts.reverb / 45);
    const intensity = plan.intensity == null ? 0.6 : plan.intensity;
    const riserGain = 0.4 + 0.6 * intensity, impactGain = 0.4 + 0.6 * intensity;
    this.delay.delayTime.setValueAtTime(0.75 * beat, Math.max(ctx.currentTime, tStart - 1));

    if (plan.type === "bassSwap") {
      // incoming: lows held back until the swap, volume and mids/highs easing up
      B.fader.gain.value = 0;
      curveFn(B.fader.gain, tStart, tSwap, fadeIn);
      // the bass trade: instant on the one, or a two-beat crossfade of the lows
      // (equal-power, so the low end stays level while the basslines trade)
      const soft = plan.bassSwapMode === "smooth", half = soft ? beat : 0.012;
      B.low.gain.setValueAtTime(KILL, tStart);
      B.low.gain.setValueAtTime(KILL, tSwap - half);
      if (soft) curveFn(B.low.gain, tSwap - half, tSwap + half, bassIn); else B.low.gain.linearRampToValueAtTime(0, tSwap + half);
      curve(B.mid.gain, tStart, tSwap, -12, 0);
      curve(B.high.gain, tStart, tSwap, -14, 0);
      // outgoing: gives up its bass on the same beat, then gets out of the way
      curve(A.fader.gain, tStart, tSwap, 1, 0.88);
      A.low.gain.setValueAtTime(0, tSwap - half);
      if (soft) curveFn(A.low.gain, tSwap - half, tSwap + half, bassOut); else A.low.gain.linearRampToValueAtTime(KILL, tSwap + half);
      if (plan.vox && plan.vox.out === "cut") A.setVox(tStart, "cut", Math.min(1.2, 2 * beat));      // the outgoing vocal steps aside for the incoming intro
      if (plan.vox && plan.vox.inn === "solo") {                                                       // a mashup: only the incoming vocal over A's instrumental end ...
        B.setVox(tStart, "solo", 0.05);
        B.setVox(tSwap - 2 * beat, "off", 2 * beat);                                                   // ... and its instruments join over the last two beats, so the full track is there on the one
      }
      if (plan.filter) {
        // a filter swap: A closes down (and washes into reverb) as B opens up from a high-pass
        const open = Math.min(20000, ctx.sampleRate * 0.45), tf = tStart + 0.15 * (tSwap - tStart);
        expRamp(A.lp.frequency, tf, tSwap - 0.01, open, 450);
        A.revSend.gain.setValueAtTime(0, tf);
        A.revSend.gain.linearRampToValueAtTime(0.4 * revF, tSwap);
        A.revSend.gain.setValueAtTime(0, tSwap + Math.max(plan.tailBars * bar, bar));
        expRamp(B.hp.frequency, tStart, tSwap - 0.01, 5000, 10);
        B.hp.frequency.setValueAtTime(10, tSwap);
        this.noteFx("filter", tStart, tSwap);
      }
      curve(A.mid.gain, tStart, tSwap, 0, -5);
      curve(A.high.gain, tStart, tSwap, 0, -9);
      const tail = plan.tailBars * bar;
      if (tail > 0) curve(A.fader.gain, tSwap + EPS, tSwap + tail, 0.88, 0);
      expRamp(A.hp.frequency, tSwap + EPS, tSwap + Math.max(tail, bar), 10, 900);
      A.echoSend.gain.setValueAtTime(0, tSwap);
      A.echoSend.gain.linearRampToValueAtTime(0.3 * echoF, tSwap + 0.5 * bar);
      A.echoSend.gain.setValueAtTime(0.3 * echoF, tSwap + Math.max(tail, bar));
      this.noteFx("filter", tSwap, tSwap + Math.max(tail, bar));
      this.noteFx("echo", tSwap, tSwap + Math.max(tail, bar));
      if (this.fxOn && plan.riser) {
        const rb = Math.min(4, Math.max(2, L / 4)) * bar;
        this.playFx("riser", tSwap - rb, rb, riserGain);
      }
      if (this.fxOn && plan.impact) this.playFx("impact", tSwap, 0, (plan.rise >= 1 ? 0.35 + 0.5 * impactGain : 0.2 + 0.35 * impactGain));
      if (this.fxOn && plan.downlifter) this.playFx("downlifter", tSwap, 2 * bar, 0.2 + 0.25 * intensity);
      A.transitionEnd = tSwap + Math.max(tail, bar) + 1;
      if (this.offline) A.stopAt(A.transitionEnd + 2);
    } else if (plan.type === "stutter") {
      // a gate chops the last two beats, getting faster (eighths, sixteenths, thirty-seconds), and the next track lands on the one
      const t0 = tSwap - 2 * beat, g = A.fader.gain;
      const slices = [[0.5, 2], [0.25, 2], [0.125, 4]];                     // slice length in beats, how many
      let ts = t0;
      g.setValueAtTime(1, t0);
      slices.forEach(function (sl, si) {
        const d = sl[0] * beat;
        for (let i = 0; i < sl[1]; i++) {
          const last = si === slices.length - 1 && i === sl[1] - 1;
          g.setValueAtTime(1, ts + 0.6 * d - 0.002);
          g.linearRampToValueAtTime(0, ts + 0.6 * d);
          if (!last) { g.setValueAtTime(0, ts + d - 0.002); g.linearRampToValueAtTime(1, ts + d); }
          ts += d;
        }
      });
      if (plan.echoThrow !== false && this.fxOn) {
        A.echoSend.gain.setValueAtTime(0, t0);
        A.echoSend.gain.linearRampToValueAtTime(0.5 * echoF, tSwap);
        A.echoSend.gain.setValueAtTime(0, tSwap + 0.5);
      }
      this.noteFx("roll", t0, tSwap);
      B.fader.gain.setValueAtTime(0, tSwap - 0.001);
      B.fader.gain.linearRampToValueAtTime(1, tSwap + 0.004);
      if (this.fxOn && plan.impact) this.playFx("impact", tSwap, 0, 0.2 + 0.5 * impactGain);
      A.transitionEnd = tSwap + 3;
      if (this.offline) A.stopAt(tSwap + 3);
    } else if (plan.type === "brake" || plan.type === "spinback") {
      // the outgoing deck is stopped by hand, and the next track lands on the one
      A.revSend.gain.setValueAtTime(0, tSwap - 2 * beat);
      A.revSend.gain.linearRampToValueAtTime(0.4 * revF, tSwap + 0.15);
      if (plan.type === "brake") {
        // the platter slows to a crawl over the last two beats, pitch falling with it
        const tb = tSwap - 2 * beat;
        this.noteFx("brake", tb, tSwap);
        A.holdRate(tb);
        A.rampRate(tb, tSwap, 0.03);
        A.revSend.gain.setValueAtTime(0, tSwap + 0.2);
        A.fader.gain.setValueAtTime(1, tSwap - 0.004);
        A.fader.gain.linearRampToValueAtTime(0, tSwap + 0.012);
      } else {
        // the last beat is wound back: the track played in reverse from the swap, fast, slowing as it goes
        const spin = this.spinbackFx(A, tSwap, false);
        A.revSend.gain.linearRampToValueAtTime(0, tSwap + spin);
        A.fader.gain.setValueAtTime(1, tSwap + spin);
        A.fader.gain.linearRampToValueAtTime(0, tSwap + spin + 0.05);
      }
      B.fader.gain.setValueAtTime(0, tSwap - 0.001);
      B.fader.gain.linearRampToValueAtTime(1, tSwap + 0.004);
      if (this.fxOn && plan.impact) this.playFx("impact", tSwap, 0, 0.2 + 0.5 * impactGain);
      A.transitionEnd = tSwap + 3;
      if (this.offline) A.stopAt(tSwap + 3);
    } else {
      const build = plan.buildBars;
      const tBuild = A.timeOfBar(plan.swapBar - build);
      const hpTarget = plan.type === "dropSwap" ? 2200 : 700;
      const hpEnd = plan.roll && this.fxOn ? tSwap - bar : tSwap - 0.02;
      expRamp(A.hp.frequency, tBuild, hpEnd, 10, hpTarget);
      this.noteFx("filter", tBuild, tSwap);
      A.hp.frequency.setValueAtTime(hpTarget, tSwap + 0.02);
      // echo throw on the last beat, cut dry on the downbeat so the tail rings
      if (plan.echoThrow !== false && this.fxOn) {
        A.echoSend.gain.setValueAtTime(0, tSwap - beat);
        A.echoSend.gain.linearRampToValueAtTime((plan.type === "echoOut" ? 0.75 : 0.55) * echoF, tSwap - 0.01);
        A.echoSend.gain.setValueAtTime(0, tSwap + 0.03);
        this.noteFx("echo", tSwap - beat, tSwap + 0.6);
      }
      A.revSend.gain.setValueAtTime(0, tSwap - 2 * beat);
      A.revSend.gain.linearRampToValueAtTime(0.45 * revF, tSwap);
      A.revSend.gain.setValueAtTime(0, tSwap + 0.03);
      A.fader.gain.setValueAtTime(1, tSwap - 0.004);
      A.fader.gain.linearRampToValueAtTime(0, tSwap + 0.012);
      if (plan.roll && this.fxOn) { this.scheduleRoll(A, plan.swapBar - 1); this.noteFx("roll", A.timeOfBar(plan.swapBar - 1), tSwap); }
      B.fader.gain.setValueAtTime(0, tSwap - 0.001);
      B.fader.gain.linearRampToValueAtTime(1, tSwap + 0.004);
      if (this.fxOn && plan.riser) {
        const rb = Math.min(4, build || 2) * bar;
        this.playFx("riser", tSwap - rb, rb, riserGain);
      }
      if (this.fxOn && plan.impact) this.playFx("impact", tSwap, 0, (plan.type === "dropSwap" ? 0.35 : 0.2) + 0.5 * impactGain);
      if (this.fxOn && plan.crash) this.playFx("crash", tSwap, 0, 0.18 + 0.3 * intensity);
      if (this.fxOn && plan.downlifter) this.playFx("downlifter", tSwap, 2 * bar, 0.3 + 0.25 * intensity);
      A.transitionEnd = tSwap + 3;
      if (this.offline) A.stopAt(tSwap + 3);
    }
    // sound effects dropped around the swap by the level of automatic effects
    if (this.fxOn && plan.extras) {
      plan.extras.forEach(function (e) {
        if (e.kind === "swell") { const d = Math.min(2.3, bar); this.playFx("swell", tSwap - d, d, 0.6); }
        else if (e.kind === "snare") this.playFx("snare", tSwap - bar, bar, 0.55);
        else if (e.kind === "zap") this.playFx("zap", tSwap, 0, 0.5);
        else if (e.kind === "siren") this.playFx("siren", tSwap - 2, 2, 0.4);
      }, this);
    }
    B.entry = { plan: plan, tStart: tStart, tSwap: tSwap, tBegin: plan.type === "bassSwap" ? tStart : A.timeOfBar(plan.swapBar - plan.buildBars) };
    A.exit = B.entry;
    return B;
  };

  // Plan and schedule a whole set in one go. Used for export and tests.
  Mixer.prototype.scheduleSet = function (tracks, opts) {
    opts = opts || {};
    const t0 = opts.t0 == null ? 0.2 : opts.t0;
    let A = this.firstVoice(tracks[0], t0, "A");
    const voices = [A], plans = [];
    for (let k = 1; k < tracks.length; k++) {
      const plan = Brain.planTransition(infoOf(tracks[k - 1]), infoOf(tracks[k]), {
        entryBar: A.entryBar, style: opts.style, settings: opts.settings || this.settings, index: k + (opts.index0 || 0),
      });
      const B = this.scheduleTransition(A, tracks[k], plan, k % 2 ? "B" : "A");
      voices.push(B); plans.push(plan);
      A = B;
    }
    voices.forEach(function (v) { const r = this.autoFxRange(v); this.scheduleAutoFx(v, r.min, r.max + 1); }, this);
    const last = voices[voices.length - 1];
    const end = last.tl.timeAtPos(Math.min(last.track.buffer.duration, last.barTime(last.track.analysis.bars)));
    return { voices: voices, plans: plans, end: end };
  };

  // Render a set to an AudioBuffer, faster than real time.
  async function renderSet(tracks, opts) {
    opts = opts || {};
    const sr = opts.sampleRate || 44100;
    // pass one finds how long the set is; the context length must be known up front
    const probe = new OfflineAudioContext(2, sr, sr);
    const pm = new Mixer(probe, { offline: true, fx: opts.fx, settings: opts.settings });
    await pm.init();
    const plan = pm.scheduleSet(tracks, opts);
    const length = Math.ceil((plan.end + 3) * sr);
    const ctx = new OfflineAudioContext(2, length, sr);
    const m = new Mixer(ctx, { offline: true, fx: opts.fx, settings: opts.settings });
    await m.init();
    const real = m.scheduleSet(tracks, opts);
    const buffer = await ctx.startRendering();
    return { buffer: buffer, plans: real.plans, voices: real.voices, end: real.end };
  }

  return {
    Mixer: Mixer, Voice: Voice, renderSet: renderSet, reversedWindow: reversedWindow, loadVox: loadVox, VOX_N: VOX_N,
    gridOf: gridOf, infoOf: infoOf, replayGain: replayGain, fadeIn: fadeIn,
    LOOKAHEAD: LOOKAHEAD, KILL: KILL, BRAKE: BRAKE, SPINUP: SPINUP,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Engine;
