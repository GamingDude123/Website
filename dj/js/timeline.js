/* Where a deck is in its track when its playback rate changes over time.
 *
 * The rate is piecewise linear in context time, matching what
 * AudioParam.linearRampToValueAtTime does, so position is a sum of trapezoids
 * and can be inverted exactly. Everything the mixer schedules — bar lines,
 * EQ swaps, tempo glides — is placed by asking this.
 */

var Timeline = (function () {
  "use strict";

  function Timeline(t0, offset, rate) {
    this.nodes = [{ t: t0, r: rate }];
    this.offset = offset;                 // source seconds at t0
  }

  Timeline.prototype.rateAt = function (t) {
    const n = this.nodes;
    if (t <= n[0].t) return n[0].r;
    for (let i = 1; i < n.length; i++) {
      if (t <= n[i].t) {
        const a = n[i - 1], b = n[i];
        return b.t === a.t ? b.r : a.r + (b.r - a.r) * (t - a.t) / (b.t - a.t);
      }
    }
    return n[n.length - 1].r;
  };

  // Ramp linearly to rate r at time t1 (starting from the current rate at t0).
  Timeline.prototype.ramp = function (t0, t1, r) {
    const last = this.nodes[this.nodes.length - 1];
    if (t0 > last.t) this.nodes.push({ t: t0, r: last.r });
    this.nodes.push({ t: t1, r: r });
  };

  Timeline.prototype.posAt = function (t) {
    const n = this.nodes;
    let pos = this.offset;
    if (t <= n[0].t) return pos - (n[0].t - t) * n[0].r;
    for (let i = 1; i < n.length; i++) {
      const a = n[i - 1], b = n[i];
      const e = Math.min(t, b.t);
      const rb = this.rateAt(e);
      pos += (e - a.t) * (a.r + rb) / 2;
      if (t <= b.t) return pos;
    }
    const last = n[n.length - 1];
    return pos + (t - last.t) * last.r;
  };

  Timeline.prototype.timeAtPos = function (p) {
    const n = this.nodes;
    let pos = this.offset;
    if (p <= pos) return n[0].r > 1e-9 ? n[0].t - (pos - p) / n[0].r : -Infinity;   // a deck that starts from rest has no "before"
    for (let i = 1; i < n.length; i++) {
      const a = n[i - 1], b = n[i];
      const dt = b.t - a.t;
      const gain = dt * (a.r + b.r) / 2;
      if (p <= pos + gain && dt > 0) {
        const k = (b.r - a.r) / dt, need = p - pos;
        if (Math.abs(k) < 1e-12) return a.t + need / a.r;
        // a.r*tau + 0.5*k*tau^2 = need
        return a.t + (-a.r + Math.sqrt(a.r * a.r + 2 * k * need)) / k;
      }
      pos += gain;
    }
    const last = n[n.length - 1];
    return last.t + (p - pos) / last.r;
  };

  return Timeline;
})();

if (typeof module !== "undefined" && module.exports) module.exports = Timeline;
