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

  const db = function (x) { return Math.pow(10, x / 20); };

  function ramp(p, t0, t1, v0, v1) {
    p.setValueAtTime(v0, t0);
    p.linearRampToValueAtTime(v1, t1);
  }
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
      energy: a.energy, bars: a.bars, cues: a.cues, sections: a.sections,
    };
  }

  function replayGain(track) {
    return Math.max(0.3, Math.min(2.5, db(TARGET_DB - track.analysis.loudnessDb)));
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
    this.trim = ctx.createGain(); this.trim.gain.value = replayGain(track);
    this.low = ctx.createBiquadFilter(); this.low.type = "lowshelf"; this.low.frequency.value = 200;
    this.mid = ctx.createBiquadFilter(); this.mid.type = "peaking"; this.mid.frequency.value = 1000; this.mid.Q.value = 0.7;
    this.high = ctx.createBiquadFilter(); this.high.type = "highshelf"; this.high.frequency.value = 4000;
    this.hp = ctx.createBiquadFilter(); this.hp.type = "highpass"; this.hp.frequency.value = 10; this.hp.Q.value = 0.8;
    this.lp = ctx.createBiquadFilter(); this.lp.type = "lowpass"; this.lp.frequency.value = Math.min(20000, ctx.sampleRate * 0.45); this.lp.Q.value = 0.8;
    this.tap = ctx.createGain();
    this.fader = ctx.createGain();
    this.echoSend = ctx.createGain(); this.echoSend.gain.value = 0;
    this.revSend = ctx.createGain(); this.revSend.gain.value = 0;

    src.connect(this.env); this.env.connect(this.trim);
    this.trim.connect(this.low); this.low.connect(this.mid); this.mid.connect(this.high);
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
    [this.fader.gain, this.env.gain, this.low.gain, this.mid.gain, this.high.gain, this.hp.frequency,
      this.echoSend.gain, this.revSend.gain, this.src.playbackRate].forEach(function (p) { p.cancelScheduledValues(now); });
    const rate = this.tl.rateAt(now);
    this.src.playbackRate.setValueAtTime(rate, now);
    this.tl.nodes = this.tl.nodes.filter(function (n) { return n.t < now; });
    this.tl.nodes.push({ t: now, r: rate });
    this.env.gain.setValueAtTime(1, now);
    this.fader.gain.setValueAtTime(1, now);
    this.low.gain.setValueAtTime(0, now); this.mid.gain.setValueAtTime(0, now); this.high.gain.setValueAtTime(0, now);
    this.hp.frequency.setValueAtTime(10, now);
    this.echoSend.gain.setValueAtTime(0, now); this.revSend.gain.setValueAtTime(0, now);
    this.extra.forEach(function (n) { try { n.stop(); } catch (e) { /* not started */ } try { n.disconnect(); } catch (e) { /* ok */ } });
    this.extra = [];
    this.exit = null; this.transitionEnd = null;
    const fxn = this.mixer.fxNodes || [];
    fxn.forEach(function (f) { if (f.t >= now - 0.01) { try { f.src.stop(); } catch (e) { /* ok */ } } });
    this.mixer.fxNodes = fxn.filter(function (f) { return f.t < now - 0.01; });
    void self;
  };

  Voice.prototype.destroy = function () {
    try { this.src.stop(); } catch (e) { /* not started or already stopped */ }
    [this.src, this.env, this.trim, this.low, this.mid, this.high, this.hp, this.lp, this.tap, this.fader, this.echoSend, this.revSend]
      .concat(this.extra).forEach(function (n) { try { n.disconnect(); } catch (e) { /* ok */ } });
  };

  // ------------------------------------------------------------------ mixer

  function Mixer(ctx, opts) {
    opts = opts || {};
    this.ctx = ctx;
    this.offline = !!opts.offline;
    this.fxOn = opts.fx !== false;
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
    this.limiter.connect(this.volume); this.volume.connect(dest); this.volume.connect(this.analyser);

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
  }

  Mixer.prototype.fxBuffer = function (kind, seconds) {
    const sr = this.ctx.sampleRate;
    const key = kind + (seconds ? Math.round(seconds * 10) : "");
    if (!this.buffers[key]) {
      const data = kind === "riser" ? FX.riser(sr, seconds) : FX.impact(sr);
      const b = this.ctx.createBuffer(1, data.length, sr);
      b.copyToChannel(data, 0);
      this.buffers[key] = b;
    }
    return this.buffers[key];
  };

  Mixer.prototype.playFx = function (kind, t, seconds, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.fxBuffer(kind, seconds);
    const g = this.ctx.createGain(); g.gain.value = gain == null ? 1 : gain;
    src.connect(g); g.connect(this.fxGain);
    src.start(t);
    (this.fxNodes = this.fxNodes || []).push({ src: src, t: t });
    return src;
  };

  Mixer.prototype.firstVoice = function (track, t0, label) {
    const v = new Voice(this, track, t0, 0, 1, label || "A");
    v.entryBar = 0;
    v.fader.gain.setValueAtTime(0, t0);
    v.fader.gain.linearRampToValueAtTime(1, t0 + 0.02);
    return v;
  };

  // Roll the last bar of A: half-beat slices, then quarter, then eighth.
  Mixer.prototype.scheduleRoll = function (A, barIndex) {
    const ctx = this.ctx;
    const t0 = A.timeOfBar(barIndex);
    const rate = A.tl.rateAt(t0);
    const beat = A.beatSec(t0);
    const groups = [[0, 2, 0.5], [2, 1, 0.25], [3, 1, 0.125]];       // beat offset, beats long, slice in beats
    A.cutMain(t0);
    groups.forEach(function (g, gi) {
      const gStart = t0 + g[0] * beat;
      const srcPos = A.barTime(barIndex) + g[0] * beat * rate;
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

  // Carry out `plan` (from Brain.planTransition) from voice A into `track`.
  // Returns the incoming voice, with the times of interest on .entry.
  Mixer.prototype.scheduleTransition = function (A, track, plan, label) {
    const ctx = this.ctx;
    const gB = gridOf(track);
    const L = plan.blendBars;
    const tStart = A.timeOfBar(plan.startBar);
    const T0 = A.tempoAt(tStart);
    let rB0 = (type => type === "echoOut" ? 1 : Math.max(0.92, Math.min(1.08, T0 / gB.bpm)))(plan.type);
    const B = new Voice(this, track, tStart, gB.downbeat + plan.inStartBar * gB.barLen, rB0, label);
    B.entryBar = plan.inStartBar;

    let tSwap;
    if (plan.type === "bassSwap") {
      // Glide both decks to the incoming tempo over the second half of the
      // blend. With the same tempo curve on both, the bar lines stay locked;
      // the duration is chosen so A reaches the swap bar exactly as it ends.
      const n = L / 2;
      const tg0 = A.timeOfBar(plan.swapBar - n);
      const Ta = A.tempoAt(tg0), Tb = gB.bpm;
      const D = 480 * n / (Ta + Tb);
      A.rampRate(tg0, tg0 + D, Tb / A.grid.bpm);
      B.rampRate(tg0, tg0 + D, 1);
      tSwap = A.timeOfBar(plan.swapBar);
    } else {
      tSwap = A.timeOfBar(plan.swapBar);
      if (plan.type === "dropSwap") {
        // settle onto the new track's own tempo over its first 16 bars
        const Tb = gB.bpm, D = 480 * 16 / (T0 + Tb);
        B.rampRate(tSwap, tSwap + D, 1);
      }
    }
    // B started in the right place for a blend; for the others it must start
    // exactly on A's swap bar, which is what tStart already is (L = 0).

    const beat = A.beatSec(tSwap);
    const bar = beat * 4;
    this.delay.delayTime.setValueAtTime(0.75 * beat, Math.max(ctx.currentTime, tStart - 1));

    if (plan.type === "bassSwap") {
      // incoming: lows held back until the swap, volume and mids/highs coming up
      ramp(B.fader.gain, tStart, tSwap, 0.7, 1);
      B.low.gain.setValueAtTime(KILL, tStart);
      B.low.gain.setValueAtTime(KILL, tSwap - 0.012);
      B.low.gain.linearRampToValueAtTime(0, tSwap + 0.012);
      ramp(B.mid.gain, tStart, tSwap, -4, 0);
      ramp(B.high.gain, tStart, tSwap, -6, 0);
      // outgoing: gives up its bass on the same beat, then gets out of the way
      ramp(A.fader.gain, tStart, tSwap, 1, 0.85);
      A.low.gain.setValueAtTime(0, tSwap - 0.012);
      A.low.gain.linearRampToValueAtTime(KILL, tSwap + 0.012);
      ramp(A.mid.gain, tStart, tSwap, 0, -5);
      ramp(A.high.gain, tStart, tSwap, 0, -8);
      const tail = plan.tailBars * bar;
      if (tail > 0) {
        ramp(A.fader.gain, tSwap, tSwap + tail, 0.85, 0);
      } else {
        A.fader.gain.setValueAtTime(0.85, tSwap + bar * 2);
      }
      expRamp(A.hp.frequency, tSwap, tSwap + Math.max(tail, bar), 10, 900);
      A.echoSend.gain.setValueAtTime(0, tSwap);
      A.echoSend.gain.linearRampToValueAtTime(0.3, tSwap + 0.5 * bar);
      A.echoSend.gain.setValueAtTime(0.3, tSwap + Math.max(tail, bar));
      if (this.fxOn && plan.riser) {
        const rb = Math.min(4, Math.max(2, L / 4)) * bar;
        this.playFx("riser", tSwap - rb, rb, 0.8);
      }
      if (this.fxOn && plan.impact) this.playFx("impact", tSwap, 0, 0.7);
      A.transitionEnd = tSwap + Math.max(tail, bar) + 1;
      if (this.offline) A.stopAt(A.transitionEnd + 2);
    } else {
      const build = plan.buildBars;
      const tBuild = A.timeOfBar(plan.swapBar - build);
      const hpTarget = plan.type === "dropSwap" ? 2200 : 700;
      const hpEnd = plan.roll ? tSwap - bar : tSwap - 0.02;
      expRamp(A.hp.frequency, tBuild, hpEnd, 10, hpTarget);
      A.hp.frequency.setValueAtTime(hpTarget, tSwap + 0.02);
      // echo throw on the last beat, cut dry on the downbeat so the tail rings
      A.echoSend.gain.setValueAtTime(0, tSwap - beat);
      A.echoSend.gain.linearRampToValueAtTime(plan.type === "echoOut" ? 0.75 : 0.55, tSwap - 0.01);
      A.echoSend.gain.setValueAtTime(0, tSwap + 0.03);
      A.revSend.gain.setValueAtTime(0, tSwap - 2 * beat);
      A.revSend.gain.linearRampToValueAtTime(0.45, tSwap);
      A.revSend.gain.setValueAtTime(0, tSwap + 0.03);
      A.fader.gain.setValueAtTime(1, tSwap - 0.004);
      A.fader.gain.linearRampToValueAtTime(0, tSwap + 0.012);
      if (plan.roll) this.scheduleRoll(A, plan.swapBar - 1);
      B.fader.gain.setValueAtTime(1, tSwap);
      if (this.fxOn && plan.riser) {
        const rb = Math.min(4, build || 2) * bar;
        this.playFx("riser", tSwap - rb, rb, 0.8);
      }
      if (this.fxOn && plan.impact) this.playFx("impact", tSwap, 0, plan.type === "dropSwap" ? 0.8 : 0.5);
      A.transitionEnd = tSwap + 3;
      if (this.offline) A.stopAt(tSwap + 3);
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
        entryBar: A.entryBar, style: opts.style || "mixed", index: k,
      });
      const B = this.scheduleTransition(A, tracks[k], plan, k % 2 ? "B" : "A");
      voices.push(B); plans.push(plan);
      A = B;
    }
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
    const pm = new Mixer(probe, { offline: true, fx: opts.fx });
    const plan = pm.scheduleSet(tracks, opts);
    const length = Math.ceil((plan.end + 3) * sr);
    const ctx = new OfflineAudioContext(2, length, sr);
    const m = new Mixer(ctx, { offline: true, fx: opts.fx });
    const real = m.scheduleSet(tracks, opts);
    const buffer = await ctx.startRendering();
    return { buffer: buffer, plans: real.plans, voices: real.voices, end: real.end };
  }

  return {
    Mixer: Mixer, Voice: Voice, renderSet: renderSet,
    gridOf: gridOf, infoOf: infoOf, replayGain: replayGain,
    LOOKAHEAD: LOOKAHEAD, KILL: KILL,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Engine;
