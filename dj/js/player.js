/* The live set: owns the AudioContext, the queue and the scheduler.
 *
 * The scheduler is deliberately dull. Every 200 ms it asks "is the next
 * transition close enough to schedule?" and if so hands the whole thing to the
 * mixer, which puts every event on the audio clock at once. Pause brakes the
 * decks like a DJ stopping the platters, then ctx.suspend() freezes the clock
 * and everything scheduled on it; resume spins them back up on the plan.
 *
 * The decks can also be touched: a scrub session (turntable.js) borrows the
 * playing deck, and any mix that was already planned is taken back first and
 * planned again when the hand lets go.
 */

var Player = (function () {
  "use strict";

  function Player(opts) {
    opts = opts || {};
    this.library = [];
    this.pinned = [];                      // tracks whose audio must stay while something (an export) is using it
    this.stemJob = null;                   // the track being separated into vocals and instrumental right now
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
    this.paused = false;            // true from the moment pause is pressed until resume is
    this.pausing = false;           // a brake or a spin-up is under way
    this.wantToggle = false;        // pause pressed again while one was
    this.brakeState = null;
    this.session = null;            // the scrub session, while a hand is on a deck
    this.gen = 0;                   // which set this is; a pause left over from an earlier set must not touch a later one
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
    const before = this.mixer && this.mixer.settings ? this.mixer.settings.autoFx : null;
    this.settings = Settings.sanitize(this.settings);
    if (this.mixer) {
      this.mixer.settings = this.settings; this.mixer.fxOn = this.settings.fx;
      // a change of automatic effects takes the ones already scheduled back; the next tick schedules the new kind
      if (before !== this.settings.autoFx || !this.settings.fx) this.dropAutoFx(this.ctx.currentTime);
    }
    this.onChange();
  };

  // forget the automatic effects scheduled from `from` on, and let every deck plan them afresh
  Player.prototype.dropAutoFx = function (from) {
    if (this.mixer) this.mixer.cancelAutoFx(from);
    this.voices.forEach(function (v) { v.fxBar = null; });
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
    if (this.stemJob && this.stemJob.track === track) this.stopStems();
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
    if (this.running || this.starting || !this.queue.length) return;
    this.starting = true;                                // (the set is only running once the audio is ready)
    this.onChange();
    const Ctor = window.AudioContext || window.webkitAudioContext;
    let first = null;
    try {
      this.ctx = new Ctor({ latencyHint: "playback" });
      await this.ctx.resume();
      this.mixer = new Engine.Mixer(this.ctx, { settings: this.settings, volume: this.volume });
      await this.mixer.init();
      this.aiNoted = false;
      if (this.aiWanted() && Separator.state().phase === "unavailable") Separator.init({ retry: true });       // a failure earlier may have been the network
      this.mixer.filterFallback = !this.aiActive();
      // the first track's audio is decoded now (only the ones playing or next up are kept decoded)
      while (this.queue.length && !first) {
        const cand = this.queue[0];
        try { await this.ensureLoaded(cand); first = this.queue.shift(); }
        catch (err) { this.loadFailed(cand); }
      }
    } finally { this.starting = false; }
    if (!first) { this.ctx.close(); this.ctx = null; this.mixer = null; this.onChange(); return; }
    this.history.push(first);
    this.cur = this.mixer.firstVoice(first, this.ctx.currentTime + 0.2, "A");
    this.voices = [this.cur];
    this.running = true;
    this.gen++;
    this.paused = false; this.pausing = false; this.wantToggle = false; this.session = null;
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
    this.gen++;
    this.stopStems();
    this.library.forEach(function (t) { t.stem = null; if (t.load) t.buffer = null; });
    this.session = null; this.paused = false; this.pausing = false; this.wantToggle = false; this.brakeState = null;
    this.onChange();
  };

  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms)); }); };

  // Pause like a DJ: the platters slow to a stop with the pitch falling away,
  // then the clock is frozen. Pressing it again during the brake or the spin-up
  // is remembered and acted on as soon as the deck is at rest or at speed.
  Player.prototype.togglePause = async function () {
    if (!this.ctx) return;
    if (this.pausing) { this.wantToggle = !this.wantToggle; return; }
    const gen = this.gen;
    this.pausing = true;
    try {
      if (this.paused) await this.resumeNow(); else await this.pauseNow();
    } catch (e) { /* the set was stopped while this was going on */ }
    if (gen !== this.gen) return;                             // that set is gone; the new one is not ours to touch
    this.pausing = false;
    this.onChange();
    if (this.wantToggle && this.ctx) { this.wantToggle = false; await this.togglePause(); }
    this.wantToggle = false;
  };

  Player.prototype.pauseNow = async function () {
    const ctx = this.ctx, gen = this.gen;
    if (this.session) this.letGo(true);                       // a hand on the platter lets go first
    this.paused = true;
    this.onChange();
    const t = ctx.currentTime + 0.02;
    this.brakeState = this.mixer.brake(this.voices, t, Engine.BRAKE);
    await sleep((t + Engine.BRAKE - ctx.currentTime) * 1000 + 40);
    if (gen !== this.gen || this.ctx !== ctx) return;
    await ctx.suspend();
  };

  // The deck is playing again as soon as the clock runs, but it is still
  // spinning up for half a second: pause, mix-now and hands stay out of the way
  // (`pausing` stays set) until it is at speed.
  Player.prototype.resumeNow = async function () {
    const ctx = this.ctx, gen = this.gen;
    if (this.brakeState) this.mixer.spinUp(this.brakeState, ctx.currentTime, Engine.SPINUP);   // the clock is frozen: this is "now"
    this.brakeState = null;
    await ctx.resume();
    this.paused = false;
    this.onChange();
    await sleep(Engine.SPINUP * 1000 + 60);
    if (gen !== this.gen) return;
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

  // ------------------------------------------------- decoded audio, only where it is needed
  //
  // Five minutes of stereo is about 100 MB once decoded, so a library of a hundred tracks could never
  // be held whole. A track with a `load` function keeps its audio only while a deck is playing it or it
  // is next in the queue (see releaseUnused); the analysis, peaks and length stay for good.

  Player.prototype.ensureLoaded = function (track) {
    if (track.buffer || !track.load) return Promise.resolve(track.buffer);
    if (!track.loading) {
      const self = this;
      track.loading = track.load().then(function (buf) {
        track.buffer = buf; track.loading = null; self.onChange(); return buf;
      }, function (err) { track.loading = null; throw err; });
    }
    return track.loading;
  };

  Player.prototype.loadFailed = function (track) {
    this.queue = this.queue.filter(function (t) { return t !== track; });
    this.note("Could not read " + track.title + " again, so it is left out of the queue (its file may have been moved or the saved copy removed)");
  };

  // drop the audio of every track that no deck is playing and that is not about to be
  Player.prototype.releaseUnused = function () {
    const keep = this.voices.map(function (v) { return v.track; }).concat(this.queue.slice(0, 2), this.pinned);
    const self = this;
    this.library.forEach(function (t) {
      if (t.load && t.buffer && keep.indexOf(t) < 0) {
        if (self.stemJob && self.stemJob.track === t) self.stopStems();
        t.buffer = null; t.stem = null;
      }
    });
  };

  // ------------------------------------------------------------- AI vocal separation
  //
  // The vocal tools work on a track that has been split into vocals and instrumental by the Separator (an
  // AI model in a worker; see separator.js). That takes a while, so it is done for the tracks that are
  // playing or next up, one at a time, the playing one first. When the stems arrive the track's audio is
  // replaced by the six-channel version (Engine.stemBuffer) and the deck playing it is handed over to it.
  // Where the model cannot run (no WebGPU, or switched off) the basic filter is what the buttons use.

  Player.prototype.aiWanted = function () {
    return !!this.settings.aiVocals && typeof Separator !== "undefined" && Separator.supported();
  };
  Player.prototype.aiActive = function () { return this.aiWanted() && Separator.state().phase !== "unavailable"; };

  // The deck a track is on, if any
  Player.prototype.voiceOf = function (t) { return this.voices.filter(function (v) { return v.track === t; }).pop(); };

  // could this track be split at all (not yet looking at whether its audio is in memory)? Not if it is a demo,
  // has been, failed, or is on a deck whose way out is already planned (the stems could not be used by it).
  Player.prototype.splittable = function (t) {
    const v = this.voiceOf(t);
    return !!t.load && !Engine.hasStems(t) && !(t.stem && t.stem.phase === "failed") && !(v && (v.exit || v.stemsLive));
  };
  // ... and can be now
  Player.prototype.stemsNeeded = function (t) {
    return this.splittable(t) && !!t.buffer && t.buffer.sampleRate === 44100 && !t.stem;
  };

  Player.prototype.stemTick = function (now) {
    this.mixer.filterFallback = !this.aiActive();
    const cand = [this.cur.track].concat(this.queue.slice(0, 2));
    // a job nobody can use any more (the track went, a way out was planned, the AI was switched off) stops
    if (this.stemJob && (!this.aiActive() || cand.indexOf(this.stemJob.track) < 0 || !this.splittable(this.stemJob.track))) this.stopStems();
    if (!this.aiActive()) {
      if (this.settings.aiVocals && !this.aiNoted && typeof Separator !== "undefined") {
        this.aiNoted = true;
        const st = Separator.state();
        this.note(Separator.supported() ? "The AI vocal model could not be used (" + (st.reason || "unknown reason") + "): the vocal buttons use the basic filter" :
          "AI vocal separation needs a browser with WebGPU (a recent Chrome, Edge or Safari): the vocal buttons use the basic filter here");
      }
      return;
    }
    // hand finished stems to the decks that are playing them (not while paused, or with a hand on the platter)
    if (!this.paused && !this.pausing && !this.session) {
      this.voices.forEach(function (v) { if (!v.exit && Engine.hasStems(v.track) && !v.stemsLive) v.useStems(now + 0.06); });
    }
    if (!cand.some(this.splittable, this)) return;          // nothing here to split: the model is not even fetched
    Separator.init();                                        // starts the model's download and set-up the first time
    if (this.stemJob || Separator.state().phase !== "ready") return;
    const next = cand.filter(this.stemsNeeded, this)[0];
    if (next) this.startStems(next);
  };

  Player.prototype.startStems = function (track) {
    const self = this, buf = track.buffer, ac = new AbortController(), job = { track: track, abort: ac };
    this.stemJob = job;
    track.stem = { phase: "working", progress: 0 };
    const chans = [];
    for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chans.push(buf.getChannelData(c));
    let shown = 0;
    Separator.separate(chans, buf.sampleRate, function (p) {
      if (track.stem) track.stem.progress = p;
      if (p - shown >= 0.01) { shown = p; self.onChange(); }
    }, ac.signal).then(function (res) {
      if (self.stemJob === job) self.stemJob = null;
      if (track.buffer !== buf || !self.ctx) { track.stem = null; return; }        // it was let go of, or the set stopped, meanwhile
      try {
        const six = Engine.stemBuffer(self.ctx, buf, { inst: res.inst, vocals: res.vocals });
        // where there is a voice, bar by bar, now from the stem rather than a guess from the stereo image
        const a = track.analysis;
        const lead = a && a.bars && a.barLen ? Analysis.vocalProfile(res.vocals, [buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)], buf.sampleRate, a.downbeat, a.barLen, a.bars) : null;
        track.buffer = six;
        if (lead) a.lead = lead;
        track.stem = { phase: "ready", progress: 1 };
        self.note("Vocals separated in " + track.title + " (" + Math.round(res.seconds) + " s)");
      } catch (err) {                                                                // (most likely: not enough memory for the six-channel copy)
        track.stem = { phase: "failed", progress: 0, error: err && err.message ? err.message : String(err) };
        self.note("Could not use the separated vocals of " + track.title + ": " + track.stem.error);
      }
    }, function (err) {
      if (self.stemJob === job) self.stemJob = null;
      if (err && err.name === "AbortError") { track.stem = null; return; }
      track.stem = { phase: "failed", progress: 0, error: err && err.message ? err.message : String(err) };
      self.note("Could not separate the vocals in " + track.title + ": " + track.stem.error);
    });
  };

  Player.prototype.stopStems = function () {
    if (this.stemJob) { try { this.stemJob.abort.abort(); } catch (e) { /* ok */ } this.stemJob = null; }
    if (typeof Separator !== "undefined" && Separator.cancelAll) Separator.cancelAll();
  };

  Player.prototype.scheduleNext = function (now, quick) {
    const A = this.cur, ctx = this.ctx;
    const next = this.queue[0];
    if (!next) return false;
    if (!next.buffer) {                                  // not decoded yet: it is on its way (see tick), and this is tried again
      const self = this;
      this.ensureLoaded(next).catch(function () { self.loadFailed(next); });
      return false;
    }
    if (Engine.hasStems(A.track) && !A.stemsLive && !this.paused && !this.session) A.useStems(now + 0.06);
    const base = { entryBar: A.entryBar, settings: this.settings, index: this.history.length, vox: Engine.voxPolicy(this.mixer, A.track, next) && (!Engine.hasStems(A.track) || A.stemsLive) };
    const plan_ = function (opts) { return Brain.planTransition(Engine.infoOf(A.track), Engine.infoOf(next), opts); };
    const late = function (p) { return A.timeOfBar(p.startBar) < now + 0.3; };
    let plan;
    if (quick) {
      const curBar = A.barAt(now);
      plan = plan_(Object.assign({}, base, { now: true, minPlay: 0, earliestSwap: Math.ceil(curBar) + 10 }));
    } else {
      plan = plan_(base);
      if (late(plan)) {
        // the playhead has been moved past where this mix had to start (a scrub or a
        // jump): a short one from here, rather than none at all
        const from = Math.ceil(A.barAt(now + 0.6)), left = A.track.analysis.bars;
        // eight bars of room let it blend; if the track has less than that left, a quick exit
        plan = plan_(Object.assign({}, base, { now: true, minPlay: 0, earliestSwap: from + 8, earliestStart: from }));
        if (plan.swapBar > left) plan = plan_(Object.assign({}, base, { now: true, minPlay: 0, earliestSwap: from + 1, earliestStart: from }));
      }
    }
    const earliest = A.timeOfBar(plan.swapBar - Math.max(plan.buildBars, plan.blendBars, 1));
    if (!quick && earliest - now > Engine.LOOKAHEAD) return false;
    if (late(plan)) return false;      // too late for this plan
    this.queue.shift();
    this.history.push(next);
    const B = this.mixer.scheduleTransition(A, next, plan, A.label === "A" ? "B" : "A");
    B.entry.scheduled = true;
    this.cur = B;
    this.voices.push(B);
    this.note(Brain.label(plan) + " into " + next.title + " — " + plan.reasons.join("; "));
    return true;
  };

  // The playing track has run out with nothing planned (the playhead was wound
  // past the last moment a mix could start): start the next one straight away.
  Player.prototype.hardCut = function (now) {
    const next = this.queue.shift(), old = this.cur;
    this.history.push(next);
    const v = this.mixer.firstVoice(next, now + 0.1, old.label === "A" ? "B" : "A");
    old.transitionEnd = now;
    this.cur = v;
    this.voices.push(v);
    this.note("The last track ran out before a mix could start — " + next.title + " starts straight away");
  };

  Player.prototype.tick = function () {
    if (!this.running || this.paused) return;
    const now = this.ctx.currentTime;
    const self = this;
    this.voices = this.voices.filter(function (v) {
      if (v !== self.cur && v.transitionEnd && now > v.transitionEnd + 0.5) { v.destroy(); return false; }
      return true;
    });
    if (this.session) {
      // a hand is on a deck, or has just let go: nothing is planned until it is back at speed
      if (this.session.endsAt <= now) { this.session.finish(); this.session = null; }
      else { this.onChange(); return; }
    }
    this.ensureNext();
    this.releaseUnused();
    this.stemTick(now);
    const up = this.queue[0];
    if (up && !up.buffer && up.load && !up.loading) { this.ensureLoaded(up).catch(function () { self.loadFailed(up); }); }
    if (this.queue.length && !(this.cur.exit)) this.scheduleNext(now, false);
    // automatic effects for the deck that is playing
    const playing = this.voices.filter(function (v) { return now >= v.t0; }).pop();
    if (playing) this.mixer.autoFxTick(playing, now);
    const dur = Engine.durationOf(this.cur.track);
    if (this.queue.length && !this.cur.exit && now > this.cur.tl.timeAtPos(dur) + 0.5) { if (this.queue[0].buffer) { this.hardCut(now); this.onChange(); } return; }     // (if the next one is still being decoded it starts as soon as it is)
    if (!this.queue.length && !this.cur.exit && now > this.cur.tl.timeAtPos(dur) + 0.5) { this.note("End of set"); this.stop(); return; }
    this.onChange();
  };

  // Take back a transition that was planned but has not begun: the incoming
  // deck is dropped, the playing one is cleaned of the moves scheduled on it, and
  // the track goes back to the front of the queue to be planned again.
  Player.prototype.unschedule = function (now) {
    const B = this.cur, A = this.voices[this.voices.length - 2];
    B.destroy();
    this.voices.pop();
    A.rollback(now);
    this.queue.unshift(this.history.pop());
    this.cur = A;
    return A;
  };

  // Replace whatever is queued next with a transition that starts within a
  // few bars.
  Player.prototype.mixNow = function () {
    if (!this.running || this.paused || this.pausing || this.session) return;
    const now = this.ctx.currentTime;
    let A = this.cur;
    if (A.entry && A.entry.tStart > now + 1.5 && this.voices.length > 1) {
      // the scheduled transition has not started: take it back
      A = this.unschedule(now);
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
    if (!this.mixer || this.paused) return;
    const m = this.mixer, ctx = this.ctx, t = ctx.currentTime + 0.02;
    // the deck that is playing (the incoming one, once it has started)
    const playing = this.voices.filter(function (x) { return t >= x.t0; }).pop() || this.cur;
    const v = playing;
    const beat = 60 / Math.max(60, Math.abs(v.tempoAt(t))), bar = beat * 4;     // a platter held still has no tempo
    // snap to the next beat so it lands in time
    const into = ((v.barAt(t) * 4) % 1 + 1) % 1;
    const at = t + (into > 0.02 ? (1 - into) * beat : 0);
    // roll, brake and spinback act on the decks themselves, so they wait while a hand is on one or a pause is under way
    if (name === "roll" || name === "brake" || name === "spin") {
      if (this.session || this.pausing || t < v.t0) return;
      if (name === "roll") m.rollNow(v, at);
      else if (name === "spin") m.spinbackNow(v, at);
      else this.brakeNow();
      return;
    }
    const lamp = { echo: "echo", sweep: "filter", riser: "riser", impact: "hit", crash: "crash", down: "down" }[name];
    const len = { echo: beat, sweep: 2 * bar + beat, riser: 2 * bar, impact: 0.8, crash: 1.6, down: 2 * bar }[name];
    if (lamp && name !== "riser" && name !== "impact" && name !== "crash" && name !== "down") m.noteFx(lamp, at, at + len);   // the rest note themselves in playFx
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
    } else if (name === "swell") {
      m.playFx("swell", at, Math.min(2.3, bar), 0.8);
    } else if (name === "snare") {
      m.playFx("snare", at, bar, 0.7);
    } else if (name === "zap") {
      m.playFx("zap", at, 0, 0.6);
    }
  };

  // A vinyl brake by hand: every deck that is playing winds down and spins back up, onto the
  // place it would have reached, so the mix carries on exactly on the beat. It is the pause
  // machinery without the pause: the clock runs throughout, and `pausing` keeps the decks,
  // pause and Mix now out of the way until it is done.
  Player.prototype.brakeNow = function () {
    if (!this.running || this.paused || this.pausing || this.session) return;
    const ctx = this.ctx, mixer = this.mixer, gen = this.gen, T = Engine.BRAKE, hold = 0.12, S = Engine.SPINUP;
    const t = ctx.currentTime + 0.02, self = this;
    this.pausing = true;
    this.onChange();
    const state = mixer.brake(this.voices, t, T, true);
    mixer.noteFx("brake", t, t + T + hold + S);
    function done() {
      if (gen !== self.gen) return;
      self.pausing = false;
      self.onChange();
      if (self.wantToggle) { self.wantToggle = false; self.togglePause(); }      // pause was pressed meanwhile
    }
    setTimeout(function () {
      if (gen !== self.gen || self.ctx !== ctx) return;
      mixer.spinUp(state, ctx.currentTime + 0.02, S);
      setTimeout(done, S * 1000 + 80);
    }, (T + hold) * 1000 + 30);
  };

  // The vocal remover for the deck labelled `label`: "off", "cut" (an instrumental) or "solo" (vocals only).
  Player.prototype.setVox = function (label, mode) {
    if (!this.ctx || this.paused) return false;
    const v = this.voices.filter(function (x) { return x.label === label; }).pop();
    if (!v || !v.setVox(this.ctx.currentTime + 0.02, mode, 0.3)) return false;
    this.onChange();
    return true;
  };

  // What the UI needs to draw a frame.
  Player.prototype.snapshot = function () {
    if (!this.ctx || !this.running) return null;
    const now = this.ctx.currentTime;
    const touch = this.touchable(now);
    const ai = this.aiActive();
    const decks = this.voices.map(function (v) {
      const bar = v.barAt(now);
      return {
        voice: v, label: v.label, track: v.track, bar: bar, pos: v.tl.posAt(now), rate: v.tl.rateAt(now),
        bpm: Math.abs(v.tempoAt(now)), started: now >= v.t0, touch: !!touch.voice && touch.voice === v,
        vox: { mode: v.voxModeAt(now), ok: v.voxAvailable(), mono: Engine.channelsOf(v.track) < 2 || (v.track.analysis && v.track.analysis.stereo === false), ai: ai, sep: !!v.track.load, stems: v.stemsLive, stem: v.track.stem || null, model: ai ? Separator.state() : null },
        eq: { low: v.low.gain.value, mid: v.mid.gain.value, high: v.high.gain.value },
        level: v.fader.gain.value,
        audible: now >= v.t0 && v.fader.gain.value > 0.02,
      };
    });
    return { now: now, decks: decks, paused: this.paused, pausing: this.pausing, hand: !!this.session, lock: touch.voice ? "" : touch.why, fx: this.mixer ? this.mixer.fxState(now) : {}, fxBusy: this.mixer ? this.mixer.fxBusy(now) : false };
  };

  // ------------------------------------------------------------- turntables

  // Which deck a hand may be put on right now: the one that is playing, unless
  // it is in the middle of a mix. A mix that is planned but has not begun is
  // fair game — it is taken back, and planned again afterwards.
  Player.prototype.touchable = function (now) {
    if (!this.running || !this.ctx || !this.cur) return { why: "Start the set to use the decks" };
    if (this.paused) return { why: "Paused" };
    if (this.pausing) return { why: "Spinning up" };
    if (this.session) return { voice: this.session.voice };
    const B = this.cur, vs = this.voices;
    if (B.entry && vs.length > 1 && now < B.entry.tBegin - 1.5) return { voice: vs[vs.length - 2], unschedule: true };
    if (B.entry && now < B.entry.tSwap + 1) return { why: "Locked while the mix is running" };
    if (now < B.t0) return { why: "Not playing yet" };
    return { voice: B };
  };

  // Put a hand on deck `label`. Returns true if the deck is now held.
  Player.prototype.grab = function (label) {
    if (!this.running) return false;
    const now = this.ctx.currentTime, hit = this.touchable(now);
    if (!hit.voice || hit.voice.label !== label) return false;
    if (this.session) { this.session.endsAt = Infinity; return true; }       // grabbed again while it was still letting go
    if (hit.unschedule) {
      const next = this.history[this.history.length - 1];
      this.unschedule(now);
      this.note("Took the planned mix into " + next.title + " back — a hand is on deck " + label + "; it is planned again when you let go");
    }
    this.session = new Turntable.Session(hit.voice, this.ctx.currentTime + 0.01);
    this.dropAutoFx(this.ctx.currentTime);                      // the effects were laid out for where the track was
    this.onChange();
    return true;
  };

  // Spin the held deck at `rate` x normal speed (negative = backwards).
  Player.prototype.scrub = function (rate, glide) {
    const s = this.session;
    if (!s) return;
    // going (or about to go) backwards needs the reversed copy: cut it before choosing the time
    if (rate < 0 || s.rate(this.ctx.currentTime) < 0) s.prepare(this.ctx.currentTime + 0.01);
    s.setRate(this.ctx.currentTime + 0.01, rate, glide);
  };

  // Let go: the deck glides back to playing normally from wherever it is.
  // `now` finishes the hand-over at once (used before a pause).
  Player.prototype.letGo = function (now) {
    const s = this.session;
    if (!s) return;
    s.end(this.ctx.currentTime + 0.01, now ? 0.02 : 0.2);
    if (now) { s.finish(); this.session = null; }
    this.onChange();
  };

  // Beat-jump the playing deck by whole bars (negative = back), staying on the beat.
  Player.prototype.jump = function (label, bars) {
    if (!this.running) return false;
    if (this.session && isFinite(this.session.endsAt)) { this.session.finish(); this.session = null; }   // let go a moment ago: it is back at speed
    if (this.session) return false;
    const now = this.ctx.currentTime, hit = this.touchable(now);
    if (!hit.voice || hit.voice.label !== label) return false;
    if (hit.unschedule) { this.unschedule(now); this.note("Took the planned mix back — deck " + label + " was moved"); }
    const v = hit.voice, t = this.ctx.currentTime + 0.02;
    const pos = v.tl.posAt(t), dur = Engine.durationOf(v.track);
    const target = Math.max(0, Math.min(dur - 0.5, pos + bars * v.grid.barLen));
    if (Math.abs(target - pos) < 0.05) return false;
    v.seek(t, target);
    this.dropAutoFx(t);
    this.onChange();
    return true;
  };

  return Player;
})();
