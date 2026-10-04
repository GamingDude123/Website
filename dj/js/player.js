/* The live set: owns the AudioContext, the queue and the scheduler.
 *
 * The scheduler is deliberately dull. Every 200 ms it asks "is the next
 * transition close enough to schedule?" and if so hands the whole thing to the
 * mixer, which puts every event on the audio clock at once. Pause is just
 * ctx.suspend(), which freezes that clock and everything scheduled on it.
 */

var Player = (function () {
  "use strict";

  function Player(opts) {
    opts = opts || {};
    this.library = [];
    this.queue = [];
    this.history = [];
    this.voices = [];
    this.settings = Settings.make();
    this.volume = 0.9;
    this.log = [];
    this.onChange = opts.onChange || function () {};
    this.ctx = null;
    this.mixer = null;
    this.cur = null;
    this.timer = null;
    this.running = false;
    this.paused = false;
  }

  // style / arc / endless / fx live in the settings object; these keep the
  // older one-word accessors working.
  ["style", "arc", "endless", "fx"].forEach(function (k) {
    Object.defineProperty(Player.prototype, k, {
      get: function () { return this.settings[k]; },
      set: function (v) { this.settings[k] = v; this.applySettings(); },
    });
  });

  Player.prototype.applySettings = function () {
    this.settings = Settings.sanitize(this.settings);
    if (this.mixer) { this.mixer.settings = this.settings; this.mixer.fxOn = this.settings.fx; }
    this.onChange();
  };

  Player.prototype.setSettings = function (obj) {
    this.settings = Settings.sanitize(obj);
    this.applySettings();
  };

  Player.prototype.note = function (text) {
    this.log.unshift({ t: this.ctx ? this.ctx.currentTime : 0, text: text });
    if (this.log.length > 60) this.log.pop();
    this.onChange();
  };

  Player.prototype.add = function (track) {
    this.library.push(track);
    this.queue.push(track);
    this.onChange();
  };

  Player.prototype.remove = function (track) {
    this.library = this.library.filter(function (t) { return t !== track; });
    this.queue = this.queue.filter(function (t) { return t !== track; });
    this.onChange();
  };

  Player.prototype.autoOrder = function () {
    const tracks = this.queue.slice();
    if (tracks.length < 3) return;
    const order = Brain.orderSet(tracks.map(Engine.infoOf), { settings: this.settings });
    this.queue = order.map(function (i) { return tracks[i]; });
    this.onChange();
  };

  Player.prototype.start = async function () {
    if (this.running || !this.queue.length) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctor({ latencyHint: "playback" });
    await this.ctx.resume();
    this.mixer = new Engine.Mixer(this.ctx, { settings: this.settings, volume: this.volume });
    const first = this.queue.shift();
    this.history.push(first);
    this.cur = this.mixer.firstVoice(first, this.ctx.currentTime + 0.2, "A");
    this.voices = [this.cur];
    this.running = true;
    this.paused = false;
    this.note("Opening with " + first.title + " (" + first.analysis.bpm + " BPM, " + (first.keyOverride || first.analysis.key.camelot) + ")");
    const self = this;
    this.timer = setInterval(function () { self.tick(); }, 200);
    this.tick();
  };

  Player.prototype.stop = function () {
    clearInterval(this.timer);
    this.running = false;
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
    this.voices = []; this.cur = null; this.mixer = null;
    this.onChange();
  };

  Player.prototype.togglePause = async function () {
    if (!this.ctx) return;
    if (this.paused) { await this.ctx.resume(); this.paused = false; } else { await this.ctx.suspend(); this.paused = true; }
    this.onChange();
  };

  Player.prototype.setVolume = function (v) {
    this.volume = v;
    if (this.mixer) this.mixer.volume.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  };

  Player.prototype.setFx = function (on) { this.fx = on; };

  // pick what follows when the queue is empty and the set is endless
  Player.prototype.ensureNext = function () {
    if (this.queue.length || !this.endless || this.library.length < 2) return;
    const cur = Engine.infoOf(this.cur.track);
    const recent = this.history.slice(-Math.min(3, this.library.length - 1));
    const target = Brain.energyTarget(this.arc, this.history.length % 8, 8);
    let best = null, bestScore = -Infinity;
    this.library.forEach(function (t) {
      if (recent.indexOf(t) >= 0 || t === this.cur.track) return;
      const s = Brain.scoreNext(cur, Engine.infoOf(t), target, this.settings);
      if (s > bestScore) { bestScore = s; best = t; }
    }, this);
    if (best) this.queue.push(best);
  };

  Player.prototype.scheduleNext = function (now, quick) {
    const A = this.cur, ctx = this.ctx;
    const next = this.queue[0];
    if (!next) return false;
    const opts = { entryBar: A.entryBar, settings: this.settings, index: this.history.length };
    if (quick) {
      const curBar = A.barAt(now);
      opts.now = true; opts.minPlay = 0; opts.earliestSwap = Math.ceil(curBar) + 10;
    }
    const plan = Brain.planTransition(Engine.infoOf(A.track), Engine.infoOf(next), opts);
    const earliest = A.timeOfBar(plan.swapBar - Math.max(plan.buildBars, plan.blendBars, 1));
    if (!quick && earliest - now > Engine.LOOKAHEAD) return false;
    if (A.timeOfBar(plan.startBar) < now + 0.3) return false;      // too late for this plan
    this.queue.shift();
    this.history.push(next);
    const B = this.mixer.scheduleTransition(A, next, plan, A.label === "A" ? "B" : "A");
    B.entry.scheduled = true;
    this.cur = B;
    this.voices.push(B);
    this.note(Brain.label(plan) + " into " + next.title + " — " + plan.reasons.join("; "));
    return true;
  };

  Player.prototype.tick = function () {
    if (!this.running || this.paused) return;
    const now = this.ctx.currentTime;
    const self = this;
    this.voices = this.voices.filter(function (v) {
      if (v !== self.cur && v.transitionEnd && now > v.transitionEnd + 0.5) { v.destroy(); return false; }
      return true;
    });
    this.ensureNext();
    if (this.queue.length && !(this.cur.exit)) this.scheduleNext(now, false);
    const track = this.cur.track;
    if (!this.queue.length && !this.cur.exit && now > this.cur.tl.timeAtPos(track.buffer.duration) + 0.5) { this.note("End of set"); this.stop(); return; }
    this.onChange();
  };

  // Replace whatever is queued next with a transition that starts within a
  // few bars.
  Player.prototype.mixNow = function () {
    if (!this.running || this.paused) return;
    const now = this.ctx.currentTime;
    let A = this.cur;
    if (A.entry && A.entry.tStart > now + 1.5 && this.voices.length > 1) {
      // the scheduled transition has not started: take it back
      const B = A;
      A = this.voices[this.voices.length - 2];
      B.destroy();
      this.voices.pop();
      A.rollback(now);
      this.queue.unshift(this.history.pop());
      this.cur = A;
    } else if (A.entry && now < A.entry.tSwap + 4) {
      this.note("Already mixing — wait for the swap");
      return;
    }
    this.ensureNext();
    if (!this.queue.length) { this.note("Nothing queued to mix into"); return; }
    if (!this.scheduleNext(now, true)) this.note("Could not fit a transition here — try again in a moment");
  };

  // Performance effects, applied on the master bus so they never collide with
  // the automation already scheduled on the decks.
  Player.prototype.perform = function (name) {
    if (!this.mixer) return;
    const m = this.mixer, ctx = this.ctx, t = ctx.currentTime + 0.02;
    const v = this.cur;
    const beat = v.beatSec(t), bar = beat * 4;
    // snap to the next beat so it lands in time
    const into = ((v.barAt(t) * 4) % 1 + 1) % 1;
    const at = t + (into > 0.02 ? (1 - into) * beat : 0);
    if (name === "echo") {
      m.perfEcho.gain.setValueAtTime(0, at);
      m.perfEcho.gain.linearRampToValueAtTime(0.7, at + 0.01);
      m.perfEcho.gain.setValueAtTime(0.7, at + beat);
      m.perfEcho.gain.linearRampToValueAtTime(0, at + beat + 0.05);
      m.delay.delayTime.setValueAtTime(0.75 * beat, at - 0.01);
    } else if (name === "sweep") {
      m.perfHP.frequency.setValueAtTime(10, at);
      m.perfHP.frequency.exponentialRampToValueAtTime(1800, at + 2 * bar);
      m.perfHP.frequency.setValueAtTime(1800, at + 2 * bar);
      m.perfHP.frequency.exponentialRampToValueAtTime(10, at + 2 * bar + beat);
    } else if (name === "riser") {
      m.playFx("riser", at, 2 * bar, 0.9);
    } else if (name === "impact") {
      m.playFx("impact", at, 0, 0.8);
    } else if (name === "crash") {
      m.playFx("crash", at, 0, 0.5);
    } else if (name === "down") {
      m.playFx("downlifter", at, 2 * bar, 0.6);
    }
  };

  // What the UI needs to draw a frame.
  Player.prototype.snapshot = function () {
    if (!this.ctx) return null;
    const now = this.ctx.currentTime;
    const decks = this.voices.map(function (v) {
      const bar = v.barAt(now);
      return {
        voice: v, label: v.label, track: v.track, bar: bar, pos: v.tl.posAt(now),
        bpm: v.tempoAt(now), started: now >= v.t0,
        eq: { low: v.low.gain.value, mid: v.mid.gain.value, high: v.high.gain.value },
        level: v.fader.gain.value,
        audible: now >= v.t0 && v.fader.gain.value > 0.02,
      };
    });
    return { now: now, decks: decks, paused: this.paused };
  };

  return Player;
})();
