/* Hands on a deck: scrub, rewind, fast-forward.
 *
 * A Web Audio source can only run forwards, and it cannot be told to jump. So a
 * "scrub session" borrows a deck from the mixer and plays it with two kinds of
 * source:
 *   forward – the track itself, started wherever the platter is;
 *   reverse – a reversed copy of the 30 seconds around the platter, played
 *             forwards, which is the track going backwards.
 * Speed is the same piecewise-linear rate the rest of the engine uses, signed
 * (negative = backwards), so the deck's Timeline stays exact and the display, the
 * bar lines and the next planned mix all agree with what you hear. Turning round
 * is a hand-over at the instant the platter is at rest: the new direction starts
 * a fresh source from rest, so there is no click and no stale read position.
 *
 * Positions and times are explicit arguments, so a scripted scrub can be laid
 * out on an OfflineAudioContext and measured.
 */

var Turntable = (function () {
  "use strict";

  const DEG_PER_SEC = 200;      // a 33⅓ rpm platter turns 200° each second
  const MAX_RATE = 10;          // fastest the platter is allowed to spin, either way
  const WINDOW = 30;            // seconds of the track kept as a reversed copy
  const MARGIN = 3;             // a fresh copy is cut when the playhead is this close to the start of the old one
  const GATE_AT = 0.05;         // under this speed the sound is faded out instead of left to crawl
  const END_PAD = 0.05;         // the platter stops this short of the end of the track

  const clamp = function (x, lo, hi) { return Math.max(lo, Math.min(hi, x)); };
  const gateLevel = function (v) { return Math.min(1, Math.abs(v) / GATE_AT); };

  // Each source's gate keeps the list of levels it has been told to follow, so a
  // new command can start from where the gate really is mid-fade, not from where
  // the speed alone says it should be.
  function gateAt(run, t) {
    const n = run.gnodes;
    if (!n || !n.length) return null;
    if (t <= n[0].t) return n[0].g;
    for (let i = 1; i < n.length; i++) {
      if (t <= n[i].t) { const a = n[i - 1], b = n[i]; return b.t === a.t ? b.g : a.g + (b.g - a.g) * (t - a.t) / (b.t - a.t); }
    }
    return n[n.length - 1].g;
  }
  function anchorGate(run, t, level) {
    run.gate.gain.cancelScheduledValues(t);
    run.gate.gain.linearRampToValueAtTime(level, t);
    run.gnodes = [{ t: t, g: level }];
  }
  function rampGate(run, t, level) {
    run.gate.gain.linearRampToValueAtTime(level, t);
    run.gnodes.push({ t: t, g: level });
  }

  // where a mark on the platter is, 0..360°, for a track position in seconds
  function angleOf(pos) { return (((pos * DEG_PER_SEC) % 360) + 360) % 360; }

  // turning the platter (or dragging the waveform) by `seconds` of track in `dt`
  // seconds of real time is a speed
  function rateFromDrag(seconds, dt) { return clamp(seconds / Math.max(0.004, dt), -MAX_RATE, MAX_RATE); }

  // holding rewind / fast-forward: a brisk search that builds up the longer it is held
  function searchRate(held) { return Math.min(9, 3 + 6 * Math.max(0, held)); }

  const reversedWindow = function (ctx, buffer, from, to) { return Engine.reversedWindow(ctx, buffer, from, to); };

  // ---------------------------------------------------------------- session

  function Session(voice, t) {
    this.voice = voice;
    this.dur = voice.track.buffer.duration;
    const nodes = voice.tl.nodes;
    // the tempo to come back to: where the deck's own plan was taking it
    this.rate0 = Math.max(0.5, nodes[nodes.length - 1].r);
    const v1 = voice.tl.rateAt(t);
    this.tl = new Timeline(t, voice.tl.posAt(t), v1);
    voice.tl = this.tl;
    this.run = { dir: 1, src: voice.src, gate: voice.sg, win: null, gnodes: [{ t: t, g: 1 }] };
    this.win = null;
    this.flip = null;
    this.endsAt = Infinity;
    this.done = false;
  }

  Session.prototype.pos = function (t) { return clamp(this.tl.posAt(t), 0, this.dur); };
  Session.prototype.rate = function (t) { return this.tl.rateAt(t); };

  // the reversed copy that covers position p, cut fresh if the old one does not
  Session.prototype.windowFor = function (p) {
    const w = this.win;
    if (w && p <= w.end - 0.1 && (w.start <= 0 || p - w.start >= MARGIN + 0.5)) return w;
    const to = Math.min(this.dur, p + 4), from = Math.max(0, to - WINDOW);
    return (this.win = reversedWindow(this.voice.mixer.ctx, this.voice.track.buffer, from, to));
  };

  // Cut the reversed copy now if the platter is about to need it. The cut takes
  // 10-20 ms, so it is done before the time of the next command is chosen,
  // not in the middle of scheduling it.
  Session.prototype.prepare = function (t) {
    const p = this.pos(t);
    if (p > 0) this.windowFor(p);
  };

  Session.prototype.startRun = function (dir, win, t, pos, nodes, gates) {
    const voice = this.voice;
    const offset = dir > 0 ? clamp(pos, 0, this.dur) : Math.max(0, win.end - pos - 1 / win.sr);
    const n = voice.makeSource(dir > 0 ? voice.track.buffer : win.buffer, t, offset, nodes, 0, gates);
    voice.src = n.src; voice.sg = n.gate;
    return { dir: dir, src: n.src, gate: n.gate, win: win, gnodes: gates.slice() };
  };

  // A turn-round that was queued for a moment still ahead is called off (the
  // hand changed its mind before the platter reached rest); one that has
  // happened is tidied away.
  Session.prototype.cancelFlip = function (t) {
    const f = this.flip;
    if (!f || t >= f.tz) return;
    this.flip = null;
    try { f.run.src.stop(); } catch (e) { /* never started */ }
    try { f.run.gate.disconnect(); } catch (e) { /* ok */ }
    this.run = f.old;
    this.voice.src = f.old.src; this.voice.sg = f.old.gate;
  };
  Session.prototype.settleFlip = function (t) {
    const f = this.flip;
    if (!f || t < f.tz) return;
    this.flip = null;
    this.voice.dispose(f.old.src, f.old.gate, f.tz);
  };

  // Set the platter's speed from time t, gliding there over `glide` seconds.
  // Call it as often as you like (every pointer move); each call picks up
  // exactly where the last one had got to. `final` is the release: it may run
  // on into the last fraction of the track instead of stopping short.
  Session.prototype.setRate = function (t, v, glide, final) {
    const voice = this.voice, dur = this.dur, hi = dur - END_PAD;
    v = clamp(v, -MAX_RATE, MAX_RATE);
    this.settleFlip(t);
    this.cancelFlip(t);
    const g = Math.max(0.005, glide == null ? 0.03 : glide), t2 = t + g;

    let v1 = this.tl.rateAt(t), p1 = this.tl.posAt(t);
    if (p1 <= 0) { p1 = 0; if (v1 < 0) v1 = 0; if (v < 0) v = 0; }          // the start of the track stops the platter
    if (p1 > hi) { p1 = hi; if (v1 > 0) v1 = 0; }
    if (p1 >= hi && !final && v > 0) v = 0;                                  // so does the end
    this.tl = new Timeline(t, p1, v1);
    voice.tl = this.tl;

    const run0 = this.run;
    const phys = function (run, x) { return run.dir > 0 ? Math.max(x, 0) : Math.max(-x, 0); };
    // hold what the source is doing at t, cutting off whatever was queued after it
    // (the gate from where it really is, which mid-fade is not where the speed says)
    run0.src.playbackRate.cancelScheduledValues(t);
    run0.src.playbackRate.linearRampToValueAtTime(phys(run0, v1), t);
    const g0 = gateAt(run0, t);
    anchorGate(run0, t, g0 == null ? gateLevel(v1) : g0);

    const crosses = (run0.dir > 0 && v < 0) || (run0.dir < 0 && v > 0);
    if (!crosses) {
      if (run0.dir < 0 && (v1 < 0 || v < 0) && run0.win.start > 0 && p1 - run0.win.start < MARGIN) {
        // running backwards out of the copy: hand over to a fresh one centred further back
        const win = this.windowFor(p1);
        const lvl = gateAt(run0, t);
        const run = this.startRun(-1, win, t, p1,
          [{ t: t, r: Math.abs(v1) }, { t: t2, r: Math.abs(v) }],
          [{ t: t, g: 0 }, { t: t + 0.008, g: lvl }, { t: t2, g: gateLevel(v) }]);
        voice.retire(run0.src, run0.gate, t, 0.008, lvl);
        this.run = run;
      } else {
        run0.src.playbackRate.linearRampToValueAtTime(phys(run0, v), t2);
        rampGate(run0, t2, gateLevel(v));
      }
      this.tl.ramp(t, t2, v);
      return;
    }
    // the platter turns round: slows to rest at tz, and the other direction takes
    // over from rest on a fresh source starting at the platter's position there
    const a = Math.abs(v1), b = Math.abs(v);
    const tz = Math.min(t2 - 1e-4, t + (a + b > 0 ? (t2 - t) * a / (a + b) : 0));
    run0.src.playbackRate.linearRampToValueAtTime(0, tz);
    rampGate(run0, tz, 0);
    const pz = p1 + v1 * (tz - t) / 2;
    const dir = v > 0 ? 1 : -1;
    const run = this.startRun(dir, dir < 0 ? this.windowFor(pz) : null, tz, pz,
      [{ t: tz, r: 0 }, { t: t2, r: b }], [{ t: tz, g: 0 }, { t: t2, g: gateLevel(v) }]);
    this.flip = { tz: tz, old: run0, run: run };
    this.run = run;
    this.tl.ramp(t, t2, v);
  };

  // Let go: the platter glides back up to the deck's own speed, going forwards.
  // Returns the time at which the deck is back to normal.
  Session.prototype.end = function (t, glide) {
    const g = Math.max(0.005, glide == null ? 0.2 : glide);
    this.setRate(t, this.rate0, g, true);
    this.endsAt = t + g;
    return this.endsAt;
  };

  // Hand the deck back to the mixer: one forward source, one plain timeline.
  Session.prototype.finish = function () {
    this.settleFlip(Infinity);
    const voice = this.voice, t = this.endsAt;
    voice.tl = new Timeline(t, this.tl.posAt(t), this.rate0);
    voice.src = this.run.src; voice.sg = this.run.gate;
    if (isFinite(voice.endTime)) { try { this.run.src.stop(voice.endTime); } catch (e) { /* ok */ } }
    this.done = true;
  };

  return {
    Session: Session, angleOf: angleOf, rateFromDrag: rateFromDrag, searchRate: searchRate, reversedWindow: reversedWindow,
    DEG_PER_SEC: DEG_PER_SEC, MAX_RATE: MAX_RATE,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Turntable;
