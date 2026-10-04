/* vocal-worklet.js -- AudioWorkletProcessor 'vox-processor'
 *
 * STFT centre-channel extraction on a stereo signal:
 *   cut  0..1  remove the centred, vocal-band content   (karaoke / instrumental version)
 *   solo 0..1  keep ONLY the centred, vocal-band content (a cappella: removes the instrumental)
 *
 * LATENCY: exactly 512 samples (= N) in EVERY mode, including cut = solo = 0 (a pure delay).
 * Output sample n is built from input sample n - 512.  Delay-compensate the other paths by
 * 512 / sampleRate seconds (11.6 ms at 44.1 kHz, 10.7 ms at 48 kHz).  This holds when the render
 * quantum is 128, which it is in every browser today; for any other quantum the processor never
 * throws, the latency becomes N + (hop - gcd(quantum, hop)) unless the quantum is a multiple of 128,
 * and the 'vox-info' message reports the real value (see below).
 *
 * How it works (radix-2 FFT with precomputed twiddles, nothing allocated inside process()):
 *   frame N = 512, hop 128 (75 % overlap), Hann analysis window, Hann synthesis window,
 *   overlap-add normalised by sum(hann^2) = 1.5.
 *   L and R go through ONE complex FFT (z = L + iR) and are split with the conjugate-symmetry
 *   identities; the same real gain multiplies both channels' bins, so the inverse is one FFT too.
 *   Per bin   coh = 2 Re(L conj R) / (|L|^2 + |R|^2 + eps)           (+1 centred ... 0 hard-panned)
 *   is computed from the cross-spectrum and the energy, each smoothed over time by a one-pole
 *   (smoothMs, energy-weighted, so loud frames count more and noise bins stop flickering);
 *   cm = smoothstep(a, b, coh) is the centre-ness (a, b for cut;  aSolo, bSolo for solo, which
 *   wants a stricter test), smoothed once more with a one-pole attack / release;
 *   w(f) is the vocal-band weight (raised cosine, see lo / hi);   e = w * cm
 *        cut  mask = 1 - cut * e
 *        solo mask = (1 - solo) + solo * e              (solo > 0 wins over cut)
 *   The SAME real, non-negative gain multiplies the L bin and the R bin, so each channel keeps
 *   its own phase and a hard-panned source can never reappear, inverted, in the other channel
 *   (a gain never adds energy).  Mid-subtraction (L-M, R-M) does exactly that; this does not.
 *   With cut = solo = 0 the gain is exactly 1.
 *
 * Why latency N and not N - hop: the oldest hop of a frame is complete after 4 frames have been
 * added (384 samples).  The extra hop is spent on a ONE-FRAME LOOK-AHEAD: frame f is synthesised
 * one block after it is analysed, so its mask already knows frame f+1 (a vocal onset is caught
 * before its first samples leave the node).
 *
 * Bypass: when cut = solo = 0 the gain would be exactly 1, so the frame is added to the overlap
 * buffer straight from the input (no FFT), 7-14x cheaper, bit-identical output.  The first
 * block with cut or solo > 0 does the FFT work it skipped (three extra frames, once) and rebuilds
 * the coherence state from the input ring, so switching on is seamless.  (To keep the analysis
 * running before a planned transition anyway, set cut to 1e-4.)
 *
 * Parameters (all k-rate, read once per 128-sample block; a change is smeared over the frame,
 * ~512 samples, so automation never clicks):
 *   cut 0..1 (0)   solo 0..1 (0)   lo Hz (150)   hi Hz (8000)
 *   lo / hi: band edges of the 'vocal band'.  The weight rises 0 -> 1 over [0.6 lo, 1.5 lo] and
 *   falls 1 -> 0 over [0.6 hi, 1.5 hi], a raised cosine in log frequency (50 % at about 0.95 edge).
 *
 * processorOptions (all optional), or port.postMessage({type: 'tune', ...}) later:
 *   a, b            cut thresholds of the smoothstep on coherence          (0.3, 0.8)
 *   aSolo, bSolo    solo thresholds                                        (0.55, 0.92)
 *   smoothMs        time constant of the coherence smoothing               (8)
 *   attackMs, releaseMs   mask one-pole                                    (3, 25)
 *   bypass          false: always run the full FFT path (testing)          (true)
 *   Lower a / b = removes more (and more of the neighbours); higher = gentler.
 * port.postMessage({type: 'reset'}) clears all state.
 * The processor posts {type: 'vox-info', N, hop, latency, sampleRate} when constructed (and again,
 * with the real latency, if the render quantum is not 128).  Loaded as a plain <script> in a page
 * (where there is no AudioWorkletGlobalScope) the file only sets window.VOX_INFO = {N, hop, latency}.
 *
 * Input handling: zero channels = silence; one channel = L = R (mono); more than two: the first
 * two are used; channel-count changes are handled per block; NaN / Infinity samples become 0.
 * Silent input costs almost nothing, and the output is exactly zero 1024 samples after the last
 * non-zero input (512 delay + up to 384 of ring-out from the masked frames).
 *
 * Not AI separation: a per-bin gain on the stereo image.  See the notes that came with this file for
 * what it cannot separate (stereo-wide or reverberant vocals, centre-panned drums / bass / guitars
 * in the band, mono recordings, vocals panned off-centre).
 */
(function () {
  'use strict';

  const N = 512;                  // frame size, a power of two >= 256.  The spec value is 512; a larger N separates better
                                  // (see the notes) and costs latency: N + max(0, N/4 - 128)
  const HOP = N >> 2;             // hop size: 75 % overlap
  const NB = (N >> 1) + 1;        // bins 0 .. N/2
  const MASK = N - 1;
  const RMASK = 2 * N - 1;        // the input ring holds 8 hops
  const LOG2N = Math.round(Math.log2(N));
  const QUANTUM = 128;            // Web Audio render quantum
  const LATENCY = N + (HOP > QUANTUM ? HOP - QUANTUM : 0);   // = 512 for N = 512; a larger N pays a FIFO of hop - 128
  const EPS = 1e-6;               // energy floor of the coherence denominator

  const DEFAULTS = { a: 0.3, b: 0.8, aSolo: 0.55, bSolo: 0.92, smoothMs: 8, attackMs: 3, releaseMs: 25 };

  // ---- shared tables ------------------------------------------------------
  const TW_RE = new Float64Array(N >> 1);
  const TW_IM = new Float64Array(N >> 1);
  for (let i = 0; i < (N >> 1); i++) {
    const ang = -2 * Math.PI * i / N;
    TW_RE[i] = Math.cos(ang);
    TW_IM[i] = Math.sin(ang);
  }
  const REV = new Uint16Array(N);
  for (let i = 0; i < N; i++) {
    let r = 0, x = i;
    for (let b = 0; b < LOG2N; b++) { r = (r << 1) | (x & 1); x >>= 1; }
    REV[i] = r;
  }
  const OLA_GAIN = 3 * N / (8 * HOP);          // sum of hann^2 over the hop = 1.5
  const WIN = new Float64Array(N);             // analysis window (periodic Hann)
  const SWIN = new Float64Array(N);            // synthesis window / OLA_GAIN / N (the inverse FFT scale)
  const DRYW = new Float64Array(N);            // hann^2 / OLA_GAIN: a frame passed through with gain 1
  for (let n = 0; n < N; n++) {
    const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / N);
    WIN[n] = h;
    SWIN[n] = h / OLA_GAIN / N;
    DRYW[n] = h * h / OLA_GAIN;
  }

  // In-place radix-2 decimation-in-time FFT of N points, forward (e^-i).
  // Inverse: call fft(im, re) -- swapping the arrays computes the unscaled inverse; the real part
  // of the result ends up in the array passed SECOND (re), the imaginary part in the one passed first.
  function fft(re, im) {
    for (let i = 0; i < N; i++) {
      const j = REV[i];
      if (j > i) {
        const tr = re[i]; re[i] = re[j]; re[j] = tr;
        const ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1;
      const step = N / size;
      for (let start = 0; start < N; start += size) {
        for (let j = 0, t = 0; j < half; j++, t += step) {
          const wr = TW_RE[t], wi = TW_IM[t];
          const a = start + j, b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr;        im[a] += xi;
        }
      }
    }
  }

  function gcd(x, y) { while (y) { const t = x % y; x = y; y = t; } return x; }

  const INFO = { N: N, hop: HOP, latency: LATENCY, bins: NB };

  // Loaded as a plain <script> in the page (no worklet scope): expose the constants and stop.
  if (typeof AudioWorkletProcessor === 'undefined' || typeof registerProcessor === 'undefined') {
    const g = typeof globalThis !== 'undefined' ? globalThis : self;
    g.VOX_INFO = INFO;
    return;
  }

  class VoxProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        { name: 'cut',  defaultValue: 0,    minValue: 0,   maxValue: 1,     automationRate: 'k-rate' },
        { name: 'solo', defaultValue: 0,    minValue: 0,   maxValue: 1,     automationRate: 'k-rate' },
        { name: 'lo',   defaultValue: 150,  minValue: 20,  maxValue: 20000, automationRate: 'k-rate' },
        { name: 'hi',   defaultValue: 8000, minValue: 100, maxValue: 24000, automationRate: 'k-rate' },
      ];
    }
    static get latency() { return LATENCY; }
    static get frameSize() { return N; }
    static get hopSize() { return HOP; }

    constructor(options) {
      super();
      const o = (options && options.processorOptions) || {};
      this.bypassOK = o.bypass !== false;
      this.tune(o);

      // input ring: 8 hop-slots (frame f = slots f-3 .. f; frame f-1 = slots f-4 .. f-1)
      this.ringL = new Float64Array(2 * N);
      this.ringR = new Float64Array(2 * N);
      // overlap-add ring: 4 hop-slots
      this.olaL = new Float64Array(N);
      this.olaR = new Float64Array(N);
      // spectra of the frame being analysed (cur) and of the previous frame (prv)
      this.curRe = new Float64Array(N); this.curIm = new Float64Array(N);
      this.prvRe = new Float64Array(N); this.prvIm = new Float64Array(N);
      this.curOn = false; this.prvOn = false;   // frame is not digital silence
      this.prvSpec = true;                      // prv spectrum is valid (false after a bypassed block)
      this.dirty = false;                       // coherence state has been written since the last reset
      // per-bin running cross-spectrum and energy (energy-weighted coherence)
      this.pc = new Float64Array(NB);
      this.pe = new Float64Array(NB);
      this.smC = new Float64Array(NB);          // smoothed centre-ness, cut mapping
      this.smS = new Float64Array(NB);          // smoothed centre-ness, solo mapping
      this.w = new Float64Array(NB);            // band weight
      this.g = new Float64Array(NB);            // gain of the frame being synthesised
      this.blk = 0;
      this.quiet = 0;                           // consecutive all-zero input blocks
      this.loC = -1; this.hiC = -1;
      this._cut = 0; this._solo = 0;
      this._band(150, 8000);

      // FIFO adapter for render quanta other than HOP
      this.fifoL = new Float64Array(HOP);
      this.fifoR = new Float64Array(HOP);
      this.fifoN = 0;
      this.outFL = new Float64Array(2 * HOP);
      this.outFR = new Float64Array(2 * HOP);
      this.outN = 0;
      this.quantum = -1;
      this.extra = 0;

      this.port.onmessage = (e) => {
        const d = e && e.data;
        if (!d) return;
        if (d.type === 'tune') this.tune(d);
        else if (d.type === 'reset') this.reset();
      };
      this.port.postMessage({ type: 'vox-info', N: N, hop: HOP, latency: LATENCY, sampleRate: sampleRate });
    }

    tune(o) {
      const d = DEFAULTS;
      const pick = (k) => (typeof o[k] === 'number' && isFinite(o[k]) ? o[k] : (this[k] !== undefined ? this[k] : d[k]));
      const a = pick('a'), b = pick('b'), aS = pick('aSolo'), bS = pick('bSolo');
      this.a = a; this.b = b > a + 0.01 ? b : a + 0.01;
      this.aSolo = aS; this.bSolo = bS > aS + 0.01 ? bS : aS + 0.01;
      this.invAB = 1 / (this.b - this.a);
      this.invABs = 1 / (this.bSolo - this.aSolo);
      this.smoothMs = pick('smoothMs'); this.attackMs = pick('attackMs'); this.releaseMs = pick('releaseMs');
      const coef = (ms) => (ms > 0 ? Math.exp(-HOP / (sampleRate * ms * 0.001)) : 0);
      this.alpha = coef(this.smoothMs);                    // coherence one-pole (per hop)
      this.kAtt = 1 - coef(this.attackMs);                 // mask one-pole
      this.kRel = 1 - coef(this.releaseMs);
      if (o.bypass !== undefined) this.bypassOK = o.bypass !== false;
    }

    reset() {
      this.ringL.fill(0); this.ringR.fill(0);
      this.olaL.fill(0); this.olaR.fill(0);
      this.curRe.fill(0); this.curIm.fill(0); this.prvRe.fill(0); this.prvIm.fill(0);
      this.curOn = false; this.prvOn = false; this.prvSpec = true;
      this._resetState();
      this.quiet = 0;
      this.fifoN = 0; this.outN = 0;
    }

    _resetState() {
      this.pc.fill(0); this.pe.fill(0); this.smC.fill(0); this.smS.fill(0);
      this.dirty = false;
    }

    // band weight per bin: raised cosine in log frequency, 0.6x .. 1.5x of each edge
    _band(lo, hi) {
      const nyq = sampleRate * 0.5;
      lo = lo > 5 ? (lo < nyq ? lo : nyq) : 5;
      hi = hi > lo * 1.1 ? hi : lo * 1.1;
      this.loC = lo; this.hiC = hi;
      const span = Math.log(1.5 / 0.6);
      const w = this.w;
      const binHz = sampleRate / N;
      for (let k = 0; k < NB; k++) {
        const f = k * binHz;
        let wl, wh;
        if (f <= 0.6 * lo) wl = 0;
        else if (f >= 1.5 * lo) wl = 1;
        else wl = 0.5 - 0.5 * Math.cos(Math.PI * Math.log(f / (0.6 * lo)) / span);
        if (f <= 0.6 * hi) wh = 1;
        else if (f >= 1.5 * hi) wh = 0;
        else wh = 0.5 + 0.5 * Math.cos(Math.PI * Math.log(f / (0.6 * hi)) / span);
        w[k] = wl * wh;
      }
    }

    // window the frame that starts at ring slot `slot` into (re, im) = (L, R) and transform it
    _analyse(slot, re, im) {
      const rl = this.ringL, rr = this.ringR;
      const s0 = slot * HOP;
      for (let n = 0; n < N; n++) {
        const idx = (s0 + n) & RMASK;
        const wv = WIN[n];
        re[n] = wv * rl[idx];
        im[n] = wv * rr[idx];
      }
      fft(re, im);
    }

    // One hop: consume HOP input samples (inL null = silence, inR null = mono), emit HOP output samples.
    _hop(inL, inR, io, outL, outR, oo) {
      const blk = this.blk;
      const q = blk & 7;
      const base = (blk & 3) * HOP;            // overlap-add slot of this block
      const rl = this.ringL, rr = this.ringR;
      const rb = q * HOP;

      // ---- 1. ingest ------------------------------------------------------
      let any = false;
      if (inL === null) {
        for (let i = 0; i < HOP; i++) { rl[rb + i] = 0; rr[rb + i] = 0; }
      } else if (inR === null) {
        for (let i = 0; i < HOP; i++) {
          let l = inL[io + i];
          if (l - l !== 0) l = 0;
          rl[rb + i] = l; rr[rb + i] = l;
          if (l !== 0) any = true;
        }
      } else {
        for (let i = 0; i < HOP; i++) {
          let l = inL[io + i], r = inR[io + i];
          if (l - l !== 0) l = 0;
          if (r - r !== 0) r = 0;
          rl[rb + i] = l; rr[rb + i] = r;
          if (l !== 0 || r !== 0) any = true;
        }
      }
      this.quiet = any ? 0 : this.quiet + 1;
      const curOn = this.quiet < 4;            // frame f is not digital silence
      const oL = this.olaL, oR = this.olaR;

      if (this._cut === 0 && this._solo === 0 && this.bypassOK) {
        // ---- bypass: gain is exactly 1, add frame f-1 straight from the input ----
        if (this.dirty) this._resetState();
        if (this.prvOn) {
          const s0 = ((q + 4) & 7) * HOP;
          for (let n = 0; n < N; n++) {
            const idx = (s0 + n) & RMASK, o = (base + n) & MASK, d = DRYW[n];
            oL[o] += d * rl[idx];
            oR[o] += d * rr[idx];
          }
        }
        this.prvSpec = false;                  // frame f's spectrum was not computed
        this.curOn = curOn;
      } else {
        // ---- 2. analyse frame f (the 4 newest slots) ---------------------
        const cr = this.curRe, ci = this.curIm;
        if (!this.prvSpec) {
          // Coming from bypass: rebuild the coherence state from the three frames before f (they are
          // still in the input ring; the state is scale-free, so three frames are nearly as good as
          // the whole history) and give frame f-1 the spectrum the bypass skipped.
          this._analyse((q + 2) & 7, cr, ci); this._centreness(cr, ci);                              // frame f-3
          this._analyse((q + 3) & 7, cr, ci); this._centreness(cr, ci);                              // frame f-2
          this._analyse((q + 4) & 7, this.prvRe, this.prvIm); this._centreness(this.prvRe, this.prvIm);  // frame f-1
          this.prvSpec = true;
        }
        if (!curOn) { cr.fill(0); ci.fill(0); }
        else this._analyse((q + 5) & 7, cr, ci);
        this.curOn = curOn;
        // coherence state is updated every active block (a silent frame decays it to 0); it now
        // includes frame f, so the mask used for frame f-1 below has one frame of look-ahead.
        this._centreness(cr, ci);
        this.dirty = true;

        // ---- 3. mask + synthesis of frame f-1 ----------------------------
        if (this.prvOn) {
          const pr = this.prvRe, pi = this.prvIm;
          this._gain(this._cut, this._solo);
          const g = this.g;
          pr[0] *= g[0]; pi[0] *= g[0];
          const hN = N >> 1;
          pr[hN] *= g[hN]; pi[hN] *= g[hN];
          for (let k = 1; k < hN; k++) {
            const gk = g[k], m = N - k;
            pr[k] *= gk; pi[k] *= gk; pr[m] *= gk; pi[m] *= gk;
          }
          fft(pi, pr);                         // inverse (array swap trick): L' = pr, R' = pi
          for (let n = 0; n < N; n++) {
            const idx = (base + n) & MASK;
            const sw = SWIN[n];
            oL[idx] += sw * pr[n];
            oR[idx] += sw * pi[n];
          }
        }
        // swap cur <-> prv spectra
        const tr = this.curRe; this.curRe = this.prvRe; this.prvRe = tr;
        const ti = this.curIm; this.curIm = this.prvIm; this.prvIm = ti;
      }

      // ---- 4. emit the completed hop (overlap slot of this block) ---------
      if (outR === null) {
        for (let i = 0; i < HOP; i++) { outL[oo + i] = oL[base + i]; oL[base + i] = 0; oR[base + i] = 0; }
      } else {
        for (let i = 0; i < HOP; i++) {
          outL[oo + i] = oL[base + i]; outR[oo + i] = oR[base + i];
          oL[base + i] = 0; oR[base + i] = 0;
        }
      }
      this.prvOn = this.curOn;
      this.blk = blk + 1;
    }

    // Per-bin energy-weighted coherence of the packed spectrum zr + i zi, smoothed over time (a
    // one-pole on the cross-spectrum and on the energy separately), mapped by smoothstep for the cut
    // and for the solo mode, then smoothed again with attack / release.
    _centreness(zr, zi) {
      const a = this.a, inv = this.invAB, aS = this.aSolo, invS = this.invABs;
      const al = this.alpha, be = 1 - al;
      const pc = this.pc, pe = this.pe, smC = this.smC, smS = this.smS;
      const kAtt = this.kAtt, kRel = this.kRel;
      for (let k = 0; k < NB; k++) {
        const m = (N - k) & MASK;
        const ar = zr[k], ai = zi[k], br = zr[m], bi = zi[m];
        const lr = ar + br, li = ai - bi;        // 2 L
        const rr = ai + bi, ri = br - ar;        // 2 R
        let c = al * pc[k] + be * (lr * rr + li * ri);                              // 4 Re(L conj R)
        let e = al * pe[k] + be * 0.5 * (lr * lr + li * li + rr * rr + ri * ri);    // 2 (|L|^2 + |R|^2)
        if (e < 1e-18) { c = 0; e = 0; }                                            // flush denormals
        pc[k] = c; pe[k] = e;
        const coh = c / (e + 2 * EPS);                                              // = 2 Re / (|L|^2 + |R|^2 + eps)
        let t = (coh - a) * inv;
        t = t > 0 ? (t < 1 ? t : 1) : 0;
        const xc = t * t * (3 - 2 * t);
        let u = (coh - aS) * invS;
        u = u > 0 ? (u < 1 ? u : 1) : 0;
        const xs = u * u * (3 - 2 * u);
        const pC = smC[k], pS = smS[k];
        const vC = pC + (xc - pC) * (xc > pC ? kAtt : kRel);
        const vS = pS + (xs - pS) * (xs > pS ? kAtt : kRel);
        smC[k] = vC < 1e-9 ? 0 : vC;
        smS[k] = vS < 1e-9 ? 0 : vS;
      }
    }

    _gain(cut, solo) {
      const g = this.g, w = this.w;
      if (solo > 0) {
        const dry = 1 - solo, sm = this.smS;
        for (let k = 0; k < NB; k++) g[k] = dry + solo * w[k] * sm[k];
      } else {
        const sm = this.smC;
        for (let k = 0; k < NB; k++) g[k] = 1 - cut * w[k] * sm[k];
      }
    }

    process(inputs, outputs, parameters) {
      const out = outputs[0];
      if (!out || out.length === 0) return true;
      const outL = out[0];
      const outR = out.length > 1 ? out[1] : null;
      const B = outL.length;

      // parameters (k-rate: element 0); NaN counts as 0
      const pc = parameters.cut, ps = parameters.solo;
      let cut = pc ? pc[0] : 0, solo = ps ? ps[0] : 0;
      cut = cut > 0 ? (cut < 1 ? cut : 1) : 0;
      solo = solo > 0 ? (solo < 1 ? solo : 1) : 0;
      this._cut = cut; this._solo = solo;
      const pl = parameters.lo, ph = parameters.hi;
      let lo = pl ? pl[0] : 150, hi = ph ? ph[0] : 8000;
      if (!(lo > 0)) lo = 150;
      if (!(hi > 0)) hi = 8000;
      if (lo !== this.loC || hi !== this.hiC) this._band(lo, hi);

      // input channels
      const inp = inputs[0];
      const nch = inp ? inp.length : 0;
      let inL = nch > 0 ? inp[0] : null;
      let inR = nch > 1 ? inp[1] : null;
      if (inL !== null && inL.length < B) { inL = null; inR = null; }
      if (inR !== null && inR.length < B) inR = null;

      if (B === HOP && this.fifoN === 0 && this.outN === 0 && this.extra === 0 && this.quantum < 0) {
        this._hop(inL, inR, 0, outL, outR, 0);
        return true;
      }
      this._fifo(inL, inR, outL, outR, B);
      return true;
    }

    // Render quanta other than HOP: stage through FIFOs (adds a constant extra delay, reported).
    _fifo(inL, inR, outL, outR, B) {
      if (B !== this.quantum) {
        // (rare path: runs once, and again only if the quantum changes; allocates then)
        this.quantum = B;
        if (this.outFL.length < B + 3 * HOP) {
          const nl = new Float64Array(B + 3 * HOP), nr = new Float64Array(B + 3 * HOP);
          nl.set(this.outFL.subarray(0, this.outN)); nr.set(this.outFR.subarray(0, this.outN));
          this.outFL = nl; this.outFR = nr;
        }
        if (this.outN === 0 && this.fifoN === 0 && this.extra === 0) {
          this.extra = (B % HOP === 0) ? 0 : HOP - gcd(B, HOP);
          this.outN = this.extra;                 // prime with zeros: a constant extra delay
        }
        this.port.postMessage({ type: 'vox-info', N: N, hop: HOP, latency: N + this.extra, sampleRate: sampleRate, quantum: B });
      }
      let pos = 0;
      while (pos < B) {
        const take = Math.min(HOP - this.fifoN, B - pos);
        for (let i = 0; i < take; i++) {
          const j = this.fifoN + i;
          if (inL === null) { this.fifoL[j] = 0; this.fifoR[j] = 0; }
          else {
            this.fifoL[j] = inL[pos + i];
            this.fifoR[j] = inR === null ? inL[pos + i] : inR[pos + i];
          }
        }
        this.fifoN += take;
        pos += take;
        if (this.fifoN === HOP) {
          this._hop(this.fifoL, this.fifoR, 0, this.outFL, this.outFR, this.outN);
          this.outN += HOP;
          this.fifoN = 0;
        }
      }
      // pop B samples (zeros if the FIFO ran short)
      const have = this.outN < B ? this.outN : B;
      for (let i = 0; i < have; i++) {
        outL[i] = this.outFL[i];
        if (outR !== null) outR[i] = this.outFR[i];
      }
      for (let i = have; i < B; i++) { outL[i] = 0; if (outR !== null) outR[i] = 0; }
      const rest = this.outN - have;
      if (rest > 0) {
        this.outFL.copyWithin(0, have, have + rest);
        this.outFR.copyWithin(0, have, have + rest);
      }
      this.outN = rest;
    }
  }

  registerProcessor('vox-processor', VoxProcessor);
})();
