/* Menu music.
 *
 * An original loop written in the style of a lounge-jazz console dashboard
 * theme: a Rhodes-ish electric piano comping off the beat, a walking upright
 * bass, finger snaps on the backbeat, and a lot of deliberate silence.
 *
 * Two things carry that style, and both are done here rather than faked with
 * samples: the electric piano is FM-synthesised, so it has the bell-like
 * attack that decays into a soft sine; and almost nothing lands squarely on
 * a beat. It is all generated at runtime, so it costs no download.
 *
 * Deliberately not a transcription of any existing game's theme.
 */

const WiiMusic = (function () {
  const BPM = 92;
  const SWING = 0.22;          // how far the off-beats lean back
  const MASTER_GAIN = 0.30;    // background level: present, never in the way
  const BARS = 8;
  const PER_BAR = 8;           // eighth notes
  const STEPS = BARS * PER_BAR;

  /* Eight bars in C: Cmaj9 · Cmaj9 · Am9 · Am9 · Dm9 · G13 · Em7 · A7.
     Rootless voicings in the middle octave, which is where a lounge pianist
     would actually play them — the bass covers the roots. */
  const CHORDS = [
    [64, 67, 71, 74],
    [64, 67, 71, 74],
    [60, 64, 67, 71],
    [60, 64, 67, 71],
    [65, 69, 72, 76],
    [65, 69, 71, 76],
    [67, 71, 74, 78],
    [64, 67, 73, 76]
  ];

  /* Walking bass: root, then an approach note leading to the next bar. */
  const BASS = [
    [36, 43], [36, 40], [33, 40], [33, 36],
    [38, 45], [31, 38], [40, 45], [33, 35]
  ];

  /* The hook. Sparse and syncopated — most steps are rests, and the phrases
     start off the beat. `put(bar, step, note)`. */
  const MELODY = (() => {
    const line = new Array(STEPS).fill(null);
    const put = (bar, step, note) => { line[bar * PER_BAR + step] = note; };

    put(0, 6, 76);
    put(1, 0, 79); put(1, 3, 76); put(1, 7, 74);
    put(2, 1, 72); put(2, 5, 76);
    put(3, 6, 74);
    put(4, 0, 77); put(4, 3, 81); put(4, 7, 79);
    put(5, 1, 79); put(5, 5, 74);
    put(6, 0, 76); put(6, 4, 79); put(6, 7, 78);
    put(7, 2, 74); put(7, 6, 72);
    return line;
  })();

  /* Comping hits, as offsets within a bar. Note the absence of 0 and 4: the
     piano answers the bass rather than doubling it. */
  const COMP_STEPS = [3, 6];
  const SNAP_STEPS = [2, 6];

  let ctx = null;
  let master = null;
  let reverb = null;
  let timer = null;
  let step = 0;
  let nextNoteTime = 0;
  let playing = false;
  let enabled = localStorage.getItem("wii-music") !== "off";

  /* An audio file the user picked from their own device. It lives in
     IndexedDB alongside the games and is never uploaded anywhere — the app
     ships no music of its own beyond the loop synthesised below. */
  let customTrack = null;
  let customUrl = null;

  function midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  /* A short exponentially-decaying noise burst makes a serviceable room
     reverb without shipping an impulse response file. */
  function buildReverb(audio) {
    const seconds = 2.4;
    const length = Math.floor(audio.sampleRate * seconds);
    const buffer = audio.createBuffer(2, length, audio.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8);
      }
    }
    const convolver = audio.createConvolver();
    convolver.buffer = buffer;
    return convolver;
  }

  function setup() {
    if (ctx) return true;
    ctx = WiiUI.audioContext();
    if (!ctx) return false;
    buildGraph(ctx);
    return true;
  }

  function buildGraph(audio) {
    master = audio.createGain();
    master.gain.value = 0;
    master.connect(audio.destination);

    reverb = buildReverb(audio);
    const wet = audio.createGain();
    wet.gain.value = 0.3;
    reverb.connect(wet);
    wet.connect(master);
  }

  function panned(node, amount) {
    if (!amount || !ctx.createStereoPanner) return node;
    const panner = ctx.createStereoPanner();
    panner.pan.value = amount;
    node.connect(panner);
    return panner;
  }

  /* FM electric piano.
   *
   * A carrier sine is frequency-modulated by a second sine an octave up. The
   * modulation depth starts high and collapses within about a tenth of a
   * second, which is exactly what gives a Rhodes its struck-tine attack
   * before it settles into a mellow, almost pure tone. */
  function rhodes(freq, time, duration, peak, pan) {
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modDepth = ctx.createGain();
    const amp = ctx.createGain();
    const tone = ctx.createBiquadFilter();

    carrier.type = "sine";
    carrier.frequency.value = freq;
    modulator.type = "sine";
    modulator.frequency.value = freq * 2;

    // The bell attack: deep modulation for a moment, then essentially none.
    modDepth.gain.setValueAtTime(freq * 2.4, time);
    modDepth.gain.exponentialRampToValueAtTime(freq * 0.02, time + 0.11);
    modulator.connect(modDepth);
    modDepth.connect(carrier.frequency);

    tone.type = "lowpass";
    tone.frequency.setValueAtTime(Math.max(1800, freq * 8), time);
    tone.frequency.exponentialRampToValueAtTime(Math.max(700, freq * 2.5), time + 0.4);

    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(peak, time + 0.006);
    amp.gain.exponentialRampToValueAtTime(peak * 0.28, time + 0.18);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    carrier.connect(tone);
    tone.connect(amp);
    const out = panned(amp, pan);
    out.connect(master);
    out.connect(reverb);

    carrier.start(time);
    modulator.start(time);
    carrier.stop(time + duration + 0.05);
    modulator.stop(time + duration + 0.05);
  }

  /* Upright bass: a round sine with a touch of grit and a quick thump. */
  function bass(freq, time, duration, peak) {
    const osc = ctx.createOscillator();
    const click = ctx.createOscillator();
    const amp = ctx.createGain();
    const clickAmp = ctx.createGain();
    const tone = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 1.01, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.05);

    // A brief higher partial reads as the finger releasing the string.
    click.type = "triangle";
    click.frequency.value = freq * 3;
    clickAmp.gain.setValueAtTime(peak * 0.35, time);
    clickAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

    tone.type = "lowpass";
    tone.frequency.value = 520;

    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(peak, time + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(amp);
    click.connect(clickAmp);
    clickAmp.connect(tone);
    tone.connect(master);
    amp.connect(master);
    amp.connect(reverb);

    osc.start(time);
    click.start(time);
    osc.stop(time + duration + 0.05);
    click.stop(time + 0.1);
  }

  /* Filtered noise click for the backbeat snap. */
  function snap(time) {
    const length = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4.5);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2400;
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.value = 0.2;

    source.connect(filter);
    filter.connect(gain);
    const out = panned(gain, 0.25);
    out.connect(master);
    out.connect(reverb);
    source.start(time);
  }

  function scheduleStep(index, time) {
    const bar = Math.floor(index / PER_BAR);
    const beat = index % PER_BAR;
    const stepDuration = 60 / BPM / 2;

    // Bass on beat one, and a walking approach note late in the bar.
    if (beat === 0) bass(midiToFreq(BASS[bar][0]), time, 0.85, 0.26);
    if (beat === 5) bass(midiToFreq(BASS[bar][1]), time, 0.55, 0.19);

    // Comping: spread the voices by a few milliseconds so the chord is
    // strummed rather than stamped, and lean it slightly left.
    if (COMP_STEPS.indexOf(beat) !== -1) {
      const chord = CHORDS[bar];
      const long = beat === 6;
      chord.forEach((note, i) => {
        rhodes(midiToFreq(note), time + i * 0.009,
          long ? 1.5 : 0.85, long ? 0.075 : 0.06, -0.18);
      });
    }

    if (SNAP_STEPS.indexOf(beat) !== -1) snap(time);

    const melodyNote = MELODY[index];
    if (melodyNote) {
      rhodes(midiToFreq(melodyNote), time, 1.4, 0.13, 0.12);
    }

    // A quiet grace note ahead of each phrase start adds a human lilt.
    if (melodyNote && beat === 0 && MELODY[index + 1] === null) {
      rhodes(midiToFreq(melodyNote - 2), time - stepDuration * 0.24, 0.25, 0.035, 0.12);
    }
  }

  /* Standard Web Audio lookahead scheduler: a coarse timer queues notes a
     little ahead of time, so playback stays sample-accurate. */
  function scheduler() {
    const stepDuration = 60 / BPM / 2;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      // Odd steps lean late, which is what gives the loop its swing.
      const swung = (step % 2 === 1) ? stepDuration * SWING : 0;
      scheduleStep(step, nextNoteTime + swung);
      nextNoteTime += stepDuration;
      step = (step + 1) % STEPS;
    }
  }

  /* ---------- Your own music file ---------------------------------------- */

  function customElement() {
    if (customTrack && !customUrl) {
      customUrl = URL.createObjectURL(customTrack.blob);
      const el = new Audio(customUrl);
      el.loop = true;
      el.volume = 0.45;
      customTrack.audio = el;
    }
    return customTrack ? customTrack.audio : null;
  }

  function setCustomTrack(file) {
    return Settings.set("custom-music", { name: file.name, blob: file }).then(() => {
      stop(0.2);
      if (customUrl) {
        URL.revokeObjectURL(customUrl);
        customUrl = null;
      }
      customTrack = { name: file.name, blob: file, audio: null };
      if (enabled) start();
      return customTrack;
    });
  }

  function clearCustomTrack() {
    return Settings.set("custom-music", null).then(() => {
      stop(0.2);
      if (customUrl) {
        URL.revokeObjectURL(customUrl);
        customUrl = null;
      }
      customTrack = null;
      if (enabled) start();
    });
  }

  function customName() {
    return customTrack ? customTrack.name : null;
  }

  /* ---------- Transport --------------------------------------------------- */

  function start() {
    if (playing || !enabled) return;

    // A file the user supplied wins over the built-in loop.
    const track = customElement();
    if (track) {
      playing = true;
      track.currentTime = track.currentTime || 0;
      const attempt = track.play();
      if (attempt && attempt.catch) {
        // Autoplay was refused; wait for the next gesture rather than throw.
        attempt.catch(() => { playing = false; });
      }
      return;
    }

    if (!setup()) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    playing = true;
    step = 0;
    nextNoteTime = ctx.currentTime + 0.12;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(MASTER_GAIN, ctx.currentTime + 2.2);
    scheduler();
    timer = setInterval(scheduler, 40);
  }

  function stop(fadeSeconds) {
    if (!playing) return;
    playing = false;

    if (customTrack && customTrack.audio) {
      customTrack.audio.pause();
      return;
    }

    clearInterval(timer);
    timer = null;
    if (!master) return;
    const fade = fadeSeconds === undefined ? 0.6 : fadeSeconds;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
  }

  function setEnabled(on) {
    enabled = on;
    localStorage.setItem("wii-music", on ? "on" : "off");
    if (on) start(); else stop();
  }

  /* Browsers refuse to make sound until the user has interacted, so the loop
     waits for the first tap rather than failing silently on load. */
  function armAutostart() {
    const begin = () => {
      document.removeEventListener("pointerdown", begin);
      document.removeEventListener("keydown", begin);
      // Wait for the saved track to load, so a chosen file isn't skipped in
      // favour of the built-in loop on a fast tap.
      ready.then(start);
    };
    document.addEventListener("pointerdown", begin);
    document.addEventListener("keydown", begin);
  }

  // Hand the speakers over when the app is in the background.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stop(0.25);
    } else if (enabled) {
      start();
    }
  });

  /* Renders the loop to an AudioBuffer as fast as the CPU allows, rather than
     in real time. Used to preview the tune without playing it aloud. */
  function renderOffline(seconds) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) return Promise.reject(new Error("OfflineAudioContext unavailable"));

    const rate = 44100;
    const offline = new Offline(2, Math.ceil(rate * seconds), rate);
    const saved = { ctx: ctx, master: master, reverb: reverb };

    // The voice builders read module state, so point it at the offline graph.
    ctx = offline;
    buildGraph(offline);
    master.gain.value = MASTER_GAIN;

    const stepDuration = 60 / BPM / 2;
    let time = 0.4;
    let index = 0;
    while (time < seconds) {
      scheduleStep(index, time + (index % 2 === 1 ? stepDuration * SWING : 0));
      time += stepDuration;
      index = (index + 1) % STEPS;
    }

    return offline.startRendering().then((buffer) => {
      ctx = saved.ctx;
      master = saved.master;
      reverb = saved.reverb;
      return buffer;
    });
  }

  /* Restore a previously chosen track, then arm the first-gesture autostart. */
  const ready = Settings.get("custom-music", null).then((saved) => {
    if (saved && saved.blob) {
      customTrack = { name: saved.name, blob: saved.blob, audio: null };
    }
  }).catch(() => null);

  armAutostart();

  return {
    start: start,
    stop: stop,
    renderOffline: renderOffline,
    setEnabled: setEnabled,
    setCustomTrack: setCustomTrack,
    clearCustomTrack: clearCustomTrack,
    customName: customName,
    ready: ready,
    get enabled() { return enabled; },
    get playing() { return playing; }
  };
})();
