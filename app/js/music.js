/* Menu music.
 *
 * An original loop written in the spirit of a console dashboard theme: warm
 * major-seventh chords, a soft upright bass, finger snaps on the backbeat and
 * a lot of empty space. It is synthesised note by note at runtime rather than
 * streamed, so it costs no download and works offline.
 *
 * Deliberately not a transcription of any existing game's theme.
 */

const WiiMusic = (function () {
  const BPM = 84;
  const SWING = 0.16;          // how far the off-beats lean back
  const MASTER_GAIN = 0.28;    // background level: present, never in the way
  const STEPS = 32;            // four bars of straight eighths

  // Bars: Fmaj7 · Dm7 · B♭maj7 · C7. A gentle loop that never resolves hard.
  const BASS = [41, 38, 34, 36];
  const CHORDS = [
    [65, 69, 72, 76],
    [62, 65, 69, 72],
    [58, 62, 65, 69],
    [60, 64, 67, 70]
  ];

  // Sparse melody over the loop; null is a rest, and most steps are rests.
  const MELODY = (() => {
    const line = new Array(STEPS).fill(null);
    const put = (step, note) => { line[step] = note; };
    put(0, 81);  put(3, 84);  put(6, 81);
    put(8, 79);  put(11, 77); put(14, 79);
    put(16, 77); put(19, 81); put(22, 84);
    put(24, 86); put(27, 84); put(30, 81);
    return line;
  })();

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
    const seconds = 1.9;
    const length = Math.floor(audio.sampleRate * seconds);
    const buffer = audio.createBuffer(2, length, audio.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
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

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    reverb = buildReverb(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    reverb.connect(wet);
    wet.connect(master);
    master.wet = wet;
    return true;
  }

  /* One plucked voice. `tone` shapes it from soft bass to bell-like melody. */
  function voice(freq, time, duration, peak, type, detune) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.value = freq;
    if (detune) osc.detune.value = detune;

    filter.type = "lowpass";
    filter.frequency.value = Math.max(900, freq * 6);

    // Percussive attack, long gentle tail — the piano-ish envelope.
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    gain.connect(reverb);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  /* Filtered noise click for the backbeat snap. */
  function snap(time) {
    const length = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 5);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1900;

    const gain = ctx.createGain();
    gain.gain.value = 0.16;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    gain.connect(reverb);
    source.start(time);
  }

  function scheduleStep(index, time) {
    const bar = Math.floor(index / 8);
    const beatInBar = index % 8;
    const chord = CHORDS[bar];

    // Bass on the first and third beats of each bar.
    if (beatInBar === 0 || beatInBar === 4) {
      voice(midiToFreq(BASS[bar]), time, 1.1, 0.22, "sine");
    }

    // Chord voicing lands just after the bass, a little behind the beat.
    if (beatInBar === 1 || beatInBar === 5) {
      chord.forEach((note, i) => {
        voice(midiToFreq(note), time + i * 0.012, 1.4, 0.055, "triangle");
      });
    }

    // Snaps on the backbeat.
    if (beatInBar === 2 || beatInBar === 6) snap(time);

    const melodyNote = MELODY[index];
    if (melodyNote) {
      voice(midiToFreq(melodyNote), time, 1.5, 0.09, "sine");
      voice(midiToFreq(melodyNote), time, 1.5, 0.03, "sine", 7);
    }
  }

  /* Standard Web Audio lookahead scheduler: a coarse timer queues notes a
     little ahead of time, so playback stays sample-accurate. */
  function scheduler() {
    const stepDuration = 60 / BPM / 2;
    while (nextNoteTime < ctx.currentTime + 0.2) {
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
    master = offline.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(offline.destination);
    reverb = buildReverb(offline);
    const wet = offline.createGain();
    wet.gain.value = 0.28;
    reverb.connect(wet);
    wet.connect(master);

    const stepDuration = 60 / BPM / 2;
    let time = 0.05;
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
