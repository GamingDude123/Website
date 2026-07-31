/* The instrument you actually touch.
 *
 * The rule everywhere: a press does something immediately. Holding an empty pad
 * starts recording on the way down, not after a dialog; tapping a full pad
 * fires it on pointerdown, not on click. Nothing that makes a sound is allowed
 * to ask a question first — the pad guesses, and the pad editor is there to
 * disagree with it later.
 */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const SLOTS = 16;
  const STEPS = Patterns.steps;
  const HOLD_MS = 420;        // press longer than this on a full pad to open it

  const ui = {
    keyRoot: 9,               // A
    scale: "minor",
    genre: "garage",
    micMode: false,           // hold any pad to record over it
    capturing: false,         // taps get written into the loop
    editing: null,
    counter: 0,
    saveTimer: null,
    lastPlayed: null,
  };

  // Pointer bookkeeping. Several fingers can be down at once, so everything is
  // keyed by pointerId rather than held in one variable.
  const touches = {};
  let recordingSlot = -1;
  let recordTimer = null;
  let rollTimer = null;

  // ------------------------------------------------------------------ chrome

  let toastTimer = null;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  function hud(message, kind) {
    const el = $("hud");
    el.textContent = message;
    el.className = "hud" + (kind ? " is-" + kind : "");
  }

  /* Let the browser paint before we hog the thread for a few hundred ms. */
  function afterPaint(fn) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { setTimeout(fn, 0); });
    });
  }

  function idle() {
    if (!Engine.pads().length) return hud("hold an empty pad to record into it");
    if (ui.capturing) return hud("playing goes straight into the loop", "live");
    if (ui.micMode) return hud("hold any pad to record over it", "live");
    hud("tap to play · hold a pad to open it");
  }

  // --------------------------------------------------------------- waveforms

  function drawWave(canvas, samples, colour, fill) {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(24, canvas.clientWidth || canvas.width);
    const height = Math.max(16, canvas.clientHeight || canvas.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const g = canvas.getContext("2d");
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);
    if (!samples || !samples.length) return;

    const mid = height / 2;
    const per = samples.length / width;
    g.fillStyle = colour;
    // Min/max per column rather than every nth sample, so a short transient
    // cannot fall between the cracks and vanish.
    for (let x = 0; x < width; x++) {
      const from = Math.floor(x * per);
      const to = Math.min(samples.length, Math.floor((x + 1) * per));
      let min = 1;
      let max = -1;
      for (let i = from; i < to; i++) {
        const v = samples[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (from >= to) { min = 0; max = 0; }
      const top = mid - max * mid * (fill ? 0.98 : 0.9);
      const bottom = mid - min * mid * (fill ? 0.98 : 0.9);
      g.fillRect(x, top, 1, Math.max(1, bottom - top));
    }
  }

  // -------------------------------------------------------------------- pads

  function tileAt(slot) {
    return $("grid").children[slot];
  }

  function paintPad(slot) {
    const tile = tileAt(slot);
    const pad = Engine.padAt(slot);
    if (!tile) return;

    if (!pad) {
      tile.className = "pad is-empty" + (ui.micMode ? " is-armed" : "");
      tile.dataset.role = "";
      tile.innerHTML = '<span class="plus">+</span><span class="hold">hold to record</span>';
      tile.setAttribute("aria-label", "empty pad " + (slot + 1) + ", hold to record");
      return;
    }

    tile.className = "pad" + (pad.mute ? " is-muted" : "") + (ui.micMode ? " is-armed" : "");
    tile.dataset.role = pad.role;
    tile.innerHTML = '<canvas></canvas><span class="role"></span><span class="label"></span><i class="fill"></i>';
    tile.querySelector(".role").textContent = pad.role;
    tile.querySelector(".label").textContent = pad.name;
    tile.setAttribute("aria-label", pad.name + ", " + pad.role);

    const colour = pad.role === "kick" ? "#ff3b6b"
      : pad.role === "bass" ? "#a774ff"
      : pad.role === "snare" || pad.role === "perc" ? "#ffb03a"
      : pad.role === "vocal" || pad.role === "chord" ? "#3ce68a" : "#4dd4ff";
    drawWave(tile.querySelector("canvas"), pad.usePolished && pad.polished ? pad.polished : pad.raw, colour);
  }

  function paintAll() {
    for (let slot = 0; slot < SLOTS; slot++) paintPad(slot);
  }

  function flash(slot) {
    const tile = tileAt(slot);
    if (!tile) return;
    tile.classList.add("is-hit");
    setTimeout(function () { tile.classList.remove("is-hit"); }, 110);
  }

  function firstEmptySlot() {
    for (let slot = 0; slot < SLOTS; slot++) if (!Engine.padAt(slot)) return slot;
    return -1;
  }

  // ------------------------------------------------------------ playing pads

  function hitPad(slot, fromSequencer) {
    const pad = Engine.padAt(slot);
    if (!pad) return;
    flash(slot);
    if (fromSequencer) return;

    Engine.tap(pad.id, 1);
    ui.lastPlayed = pad.id;

    // Live capture: write the tap into the loop at the nearest sixteenth.
    if (ui.capturing && Engine.isPlaying()) {
      const at = Engine.nearestStep();
      const row = Engine.rows()[pad.id] || { steps: new Array(STEPS).fill(0), loop: false };
      row.steps[at.step] = 1;
      Engine.setRow(pad.id, row.steps, row.loop);
      scheduleSave();
    }
  }

  Engine.onStep(function (step) {
    const lights = $("steps").children;
    for (let i = 0; i < lights.length; i++) lights[i].classList.toggle("is-now", i === step);
    if (step < 0) return;
    // Light the pads the sequencer is hitting, so the grid shows the pattern
    // playing rather than the pattern being a table somewhere else.
    const rows = Engine.rows();
    Engine.pads().forEach(function (pad) {
      const row = rows[pad.id];
      if (row && row.steps[step]) flash(pad.slot);
    });
  });

  // ------------------------------------------------------------- recording

  function beginRecord(slot) {
    const ctx = Engine.context();
    recordingSlot = slot;
    const tile = tileAt(slot);
    tile.classList.add("is-recording");

    Engine.resume()
      .then(function () { return Recorder.open(ctx); })
      .then(function () {
        // The finger may already be gone by the time permission comes back.
        if (recordingSlot !== slot) return;
        Recorder.begin(ctx);
        hud("recording…", "live");
        recordTimer = setInterval(function () {
          const seconds = Recorder.elapsed(ctx);
          const fill = tile.querySelector(".fill");
          if (fill) fill.style.height = Math.min(100, 12 + Recorder.level() * 120) + "%";
          if (seconds > Recorder.maxSeconds) endRecord(slot);
        }, 50);
      })
      .catch(function (err) {
        cancelRecordUI(slot);
        const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
        hud(denied
          ? "microphone blocked — allow it, then hold the pad again"
          : "no microphone here — use Import in settings instead");
        toast(denied ? "microphone denied" : "no microphone");
      });
  }

  function cancelRecordUI(slot) {
    clearInterval(recordTimer);
    recordTimer = null;
    recordingSlot = -1;
    const tile = tileAt(slot);
    if (tile) {
      tile.classList.remove("is-recording");
      const fill = tile.querySelector(".fill");
      if (fill) fill.style.height = "0%";
    }
  }

  function endRecord(slot) {
    if (recordingSlot !== slot) return;
    const ctx = Engine.context();
    const take = Recorder.end(ctx);
    cancelRecordUI(slot);

    if (!take || take.length < ctx.sampleRate * 0.06) {
      hud("too short — hold it a moment longer");
      return;
    }
    hud("cleaning it up…", "busy");
    afterPaint(function () {
      const pad = addSample(slot, null, take, null);
      if (!pad) {
        hud("that take was silent");
        return;
      }
      Engine.tap(pad.id, 1);
      flash(slot);
      hud(pad.report.join(" · "));
      // A new sound with nothing to play over is a dead end, so give it a part.
      // Not when the loop is being performed by hand, and not when this take
      // replaced a pad that already had a part — that one was inherited on
      // purpose, and writing over it would undo the swap.
      const row = Engine.rows()[pad.id];
      const hasPart = row && row.steps.some(Boolean);
      if (!ui.capturing && !hasPart) giveDefaultRow(pad);
    });
  }

  function giveDefaultRow(pad) {
    const arrangement = Patterns.arrange(
      [{ id: pad.id, role: pad.role, beats: pad.beats }], ui.genre,
      Math.floor(Math.random() * 1e9)
    );
    const row = arrangement.rows[pad.id];
    Engine.setRow(pad.id, row.steps, row.loop);
    scheduleSave();
  }

  // ------------------------------------------------------------ pad gestures

  function onPadDown(event) {
    const tile = event.currentTarget;
    const slot = parseInt(tile.dataset.slot, 10);
    tile.setPointerCapture(event.pointerId);
    const pad = Engine.padAt(slot);

    // Empty pad, or the mic is armed: the press is a record.
    if (!pad || ui.micMode) {
      touches[event.pointerId] = { slot: slot, kind: "record" };
      beginRecord(slot);
      return;
    }

    hitPad(slot);
    touches[event.pointerId] = {
      slot: slot,
      kind: "play",
      // Keep holding and the editor opens; let go first and it was just a hit.
      timer: setTimeout(function () {
        const held = touches[event.pointerId];
        if (held) held.kind = "opened";
        openEditor(slot);
      }, HOLD_MS),
    };
  }

  function onPadUp(event) {
    const held = touches[event.pointerId];
    if (!held) return;
    delete touches[event.pointerId];
    if (held.timer) clearTimeout(held.timer);
    if (held.kind === "record") {
      endRecord(held.slot);
      if (!Recorder.isRecording()) idle();
    }
  }

  function buildGrid() {
    const grid = $("grid");
    grid.innerHTML = "";
    for (let slot = 0; slot < SLOTS; slot++) {
      const tile = document.createElement("button");
      tile.className = "pad is-empty";
      tile.dataset.slot = slot;
      tile.addEventListener("pointerdown", onPadDown);
      tile.addEventListener("pointerup", onPadUp);
      tile.addEventListener("pointercancel", onPadUp);
      // A press must not also fire a click, or a pad would sound twice.
      tile.addEventListener("click", function (e) { e.preventDefault(); });
      tile.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      grid.appendChild(tile);
    }

    const steps = $("steps");
    steps.innerHTML = "";
    for (let i = 0; i < STEPS; i++) {
      const light = document.createElement("i");
      light.dataset.beat = i % 4 === 0 ? "1" : "0";
      steps.appendChild(light);
    }
  }

  // ------------------------------------------------------------ making pads

  function polishOptions(extra) {
    const opts = {
      sampleRate: Engine.context().sampleRate,
      bpm: Engine.state.bpm,
      keyRoot: ui.keyRoot,
      scale: ui.scale,
    };
    if (extra) Object.keys(extra).forEach(function (k) { opts[k] = extra[k]; });
    return opts;
  }

  function addSample(slot, name, samples, choice) {
    const prep = Polish.prepare(samples, polishOptions());
    if (!prep) return null;
    const result = Polish.finish(prep, polishOptions(choice));
    if (!result) return null;

    // Recording over a pad replaces the sound but keeps the part it was
    // playing — you are swapping the snare, not rewriting the bar.
    const existing = Engine.padAt(slot);
    let inheritedRow = null;
    if (existing) {
      const row = Engine.rows()[existing.id];
      if (row) inheritedRow = { steps: row.steps.slice(), loop: row.loop };
      Engine.removePad(existing.id);
    }

    ui.counter++;
    const pad = Engine.addPad({
      id: "pad-" + Date.now().toString(36) + "-" + ui.counter,
      slot: slot,
      name: name || result.instrumentLabel.toLowerCase() + " " + ui.counter,
      // A name nobody typed follows the instrument. Leaving "hi-hat 3" on a pad
      // that has since been rebuilt as a kick is just a lie on the front of it.
      autoName: !name,
      autoIndex: ui.counter,
      raw: Float32Array.from(samples),
      polished: result.samples,
      sampleRate: result.sampleRate,
      usePolished: true,
      role: result.role,
      instrument: result.instrument,
      morph: result.morph,
      sends: { reverb: result.sends.reverb, delay: result.sends.delay },
      duck: result.duck,
      beats: result.beats,
      note: result.note,
      shifted: result.shifted,
      report: result.steps,
      gain: result.level,
      pan: 0,
      pitch: 0,
      length: 1,
      reverse: false,
      mute: false,
      choke: result.role !== "chord" && result.role !== "texture",
      version: 1,
      // In memory only: saves re-analysing the take on every edit.
      _prep: prep,
    });
    if (inheritedRow) Engine.setRow(pad.id, inheritedRow.steps, inheritedRow.loop);
    paintPad(slot);
    scheduleSave();
    return pad;
  }

  function repolish(pad, choice) {
    const previous = Polish.recipes[pad.role];
    const untouched = previous && Math.abs(pad.gain - previous.level) < 0.005;
    if (!pad._prep) pad._prep = Polish.prepare(pad.raw, polishOptions());
    if (!pad._prep) return;

    const wanted = { instrument: pad.instrument, morph: pad.morph };
    if (choice) Object.keys(choice).forEach(function (k) { wanted[k] = choice[k]; });
    const result = Polish.finish(pad._prep, polishOptions(wanted));
    if (!result) return;

    if (untouched) pad.gain = result.level;
    if (pad.autoName && result.instrument !== pad.instrument) {
      pad.name = result.instrumentLabel.toLowerCase() + " " + (pad.autoIndex || 1);
    }
    pad.polished = result.samples;
    pad.role = result.role;
    pad.instrument = result.instrument;
    pad.morph = result.morph;
    pad.sends = { reverb: result.sends.reverb, delay: result.sends.delay };
    pad.duck = result.duck;
    pad.beats = result.beats;
    pad.note = result.note;
    pad.shifted = result.shifted;
    pad.report = result.steps;
    pad.version++;
    paintPad(pad.slot);
  }

  /* Slice a long take across the empty pads. Cut at the loudest onsets, so a
   * bar of someone beatboxing lands one hit per pad. */
  function chop(pad) {
    const sr = pad.sampleRate;
    const source = pad.usePolished && pad.polished ? pad.polished : pad.raw;
    const empties = [];
    for (let slot = 0; slot < SLOTS; slot++) if (!Engine.padAt(slot)) empties.push(slot);
    if (!empties.length) {
      toast("no empty pads to chop into");
      return;
    }

    const hop = 256;
    const env = DSP.envelope(source, hop);
    const peak = DSP.peak(env);
    const gap = Math.round((sr * 0.06) / hop);      // ignore retriggers within 60 ms
    const onsets = [];
    let last = -gap;
    for (let i = 1; i < env.length; i++) {
      const rising = env[i] > env[i - 1] * 1.6 && env[i] > peak * 0.16;
      if (rising && i - last >= gap) { onsets.push(i * hop); last = i; }
    }
    // Nothing rhythmic in there: fall back to equal slices, which is still the
    // useful thing to do with a two-second pad or a held note.
    if (onsets.length < 2) {
      const pieces = Math.min(empties.length, 8);
      onsets.length = 0;
      for (let i = 0; i < pieces; i++) onsets.push(Math.floor((i * source.length) / pieces));
    }

    const made = [];
    for (let i = 0; i < onsets.length && i < empties.length; i++) {
      const from = onsets[i];
      const to = i + 1 < onsets.length ? onsets[i + 1] : source.length;
      if (to - from < sr * 0.02) continue;
      const slice = source.slice(from, to);
      const made_pad = addSample(empties[made.length], "chop " + (made.length + 1), slice,
        { instrument: "asis" });
      if (made_pad) made.push(made_pad);
    }
    made.forEach(giveDefaultRow);
    paintAll();
    toast(made.length ? "chopped into " + made.length + " pads" : "nothing to chop");
    hud(made.length + " slices — tap them");
  }

  // ------------------------------------------------------------- pad editor

  function openEditor(slot) {
    const pad = Engine.padAt(slot);
    if (!pad) return;
    ui.editing = pad.id;

    $("pad-name").value = pad.name;
    $("pad-instrument").value = pad.instrument || "asis";
    $("p-morph").value = Math.round((pad.morph || 0) * 100);
    $("p-gain").value = Math.round(pad.gain * 100);
    $("p-pitch").value = pad.pitch;
    $("p-pan").value = Math.round(pad.pan * 100);
    $("p-len").value = Math.round(pad.length * 100);
    $("p-rev").value = Math.round(pad.sends.reverb * 100);
    $("p-dly").value = Math.round(pad.sends.delay * 100);
    $("p-reverse").checked = !!pad.reverse;
    $("p-duck").checked = pad.duck >= 0.3;
    $("btn-ab").textContent = pad.usePolished ? "Polished" : "Raw take";
    $("btn-ab").classList.toggle("is-on", pad.usePolished);
    const inst = Instrument.get(pad.instrument || "asis");
    $("pad-hint").textContent = inst ? inst.hint : "";
    syncOutputs();

    const report = $("pad-report");
    report.innerHTML = "";
    (pad.report || []).forEach(function (line) {
      const row = document.createElement("div");
      row.className = "line";
      const tick = document.createElement("b");
      tick.textContent = "✓";
      const text = document.createElement("span");
      text.textContent = line;
      row.appendChild(tick);
      row.appendChild(text);
      report.appendChild(row);
    });

    $("editor").hidden = false;
    drawEditorWave(pad);
  }

  function drawEditorWave(pad) {
    drawWave($("pad-wave"), pad.usePolished && pad.polished ? pad.polished : pad.raw,
      pad.usePolished ? "#3ce68a" : "#a49cc4", true);
  }

  function editing() {
    return ui.editing ? Engine.padById(ui.editing) : null;
  }

  function syncOutputs() {
    ["p-morph", "p-gain", "p-pitch", "p-pan", "p-len", "p-rev", "p-dly",
     "bpm", "swing", "m-vol", "m-rev", "m-dly", "m-duck"].forEach(function (id) {
      const out = $(id + "-out");
      if (out) out.value = $(id).value;
    });
  }

  function bindPadSlider(id, apply) {
    $(id).addEventListener("input", function () {
      const pad = editing();
      if (!pad) return;
      apply(pad, parseFloat(this.value));
      syncOutputs();
      scheduleSave();
    });
  }

  // ------------------------------------------------------------------- save

  function scheduleSave() {
    clearTimeout(ui.saveTimer);
    ui.saveTimer = setTimeout(function () {
      const rows = Engine.rows();
      Engine.pads().forEach(function (pad) {
        pad.steps = rows[pad.id] ? rows[pad.id].steps : [];
        pad.loop = rows[pad.id] ? rows[pad.id].loop : false;
      });
      Store.savePads(Engine.pads()).catch(function () { /* private mode */ });
      Store.saveSession({
        bpm: Engine.state.bpm,
        swing: Engine.state.swing,
        keyRoot: ui.keyRoot,
        scale: ui.scale,
        genre: ui.genre,
        master: Engine.state.master,
        counter: ui.counter,
      }).catch(function () { /* ignore */ });
    }, 700);
  }

  function updateKitChip() {
    $("kit-key").textContent = Polish.noteNames[ui.keyRoot] + " " +
      (ui.scale === "minor" ? "min" : ui.scale === "major" ? "maj" : ui.scale);
    $("kit-bpm").textContent = Engine.state.bpm;
  }

  // ------------------------------------------------------------------- deck

  function setPlaying(on) {
    const button = $("btn-play");
    button.classList.toggle("is-playing", on);
    button.innerHTML = on ? "&#9632;" : "&#9654;";
    if (!on && ui.capturing) setCapturing(false);
  }

  function setCapturing(on) {
    ui.capturing = on;
    $("btn-cap").classList.toggle("is-on", on);
    $("btn-cap").setAttribute("aria-pressed", String(on));
    idle();
  }

  /* ROLL: while held, retrigger the last pad you played on every sixteenth.
   * Cheaper than a real beat-repeat and it is the one people actually use. */
  function startRoll() {
    if (rollTimer) return;
    const padId = ui.lastPlayed || (Engine.pads()[0] || {}).id;
    if (!padId) return;
    const every = Engine.stepDuration() * 1000;
    const fire = function () {
      Engine.tap(padId, 0.9);
      const pad = Engine.padById(padId);
      if (pad) flash(pad.slot);
    };
    fire();
    rollTimer = setInterval(fire, Math.max(50, every));
  }

  function stopRoll() {
    clearInterval(rollTimer);
    rollTimer = null;
  }

  function bindHold(id, down, up) {
    const el = $(id);
    el.addEventListener("pointerdown", function (event) {
      el.setPointerCapture(event.pointerId);
      el.classList.add("is-on");
      down();
    });
    const release = function () {
      if (!el.classList.contains("is-on")) return;
      el.classList.remove("is-on");
      up();
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("pointerleave", release);
  }

  // ------------------------------------------------------------------- bind

  function bind() {
    $("btn-play").addEventListener("click", function () {
      Engine.toggle().then(function () { setPlaying(Engine.isPlaying()); });
    });

    $("btn-cap").addEventListener("click", function () {
      const turningOn = !ui.capturing;
      setCapturing(turningOn);
      // Arming the loop starts it: capturing against a stopped transport would
      // have nowhere to put the hits.
      if (turningOn && !Engine.isPlaying()) {
        Engine.play().then(function () { setPlaying(true); });
      }
    });

    $("btn-mic").addEventListener("click", function () {
      ui.micMode = !ui.micMode;
      this.classList.toggle("is-on", ui.micMode);
      this.setAttribute("aria-pressed", String(ui.micMode));
      paintAll();
      idle();
    });

    bindHold("fx-filter", function () { Engine.setSweep(0.85); }, function () { Engine.setSweep(0); });
    bindHold("fx-roll", startRoll, stopRoll);

    // --- sheets
    const sheets = [["btn-settings", "settings"], ["btn-help", "help"]];
    sheets.forEach(function (pair) {
      $(pair[0]).addEventListener("click", function () { $(pair[1]).hidden = false; });
    });
    $("btn-kit").addEventListener("click", function () { $("settings").hidden = false; });
    [["settings-close", "settings"], ["help-close", "help"], ["editor-close", "editor"]].forEach(function (pair) {
      $(pair[0]).addEventListener("click", function () {
        $(pair[1]).hidden = true;
        if (pair[1] === "editor") ui.editing = null;
      });
    });
    ["settings", "help", "editor"].forEach(function (id) {
      $(id).addEventListener("pointerdown", function (event) {
        if (event.target === this) {
          this.hidden = true;
          if (id === "editor") ui.editing = null;
        }
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      ["settings", "help", "editor"].forEach(function (id) { $(id).hidden = true; });
      ui.editing = null;
    });

    // --- settings
    $("bpm").addEventListener("input", function () {
      Engine.setTempo(parseInt(this.value, 10));
      syncOutputs();
      updateKitChip();
      scheduleSave();
    });
    $("swing").addEventListener("input", function () {
      Engine.setSwing(parseInt(this.value, 10) / 100);
      syncOutputs();
      scheduleSave();
    });
    $("key").addEventListener("change", function () {
      ui.keyRoot = parseInt(this.value, 10);
      updateKitChip();
      retune();
    });
    $("scale").addEventListener("change", function () {
      ui.scale = this.value;
      updateKitChip();
      retune();
    });
    $("genre").addEventListener("change", function () {
      ui.genre = this.value;
      const genre = Patterns.genres[ui.genre];
      $("bpm").value = genre.bpm;
      Engine.setTempo(genre.bpm);
      $("swing").value = Math.round(genre.swing * 100);
      Engine.setSwing(genre.swing);
      syncOutputs();
      updateKitChip();
      arrange();
      toast(genre.name + " — " + genre.hint);
    });

    [["m-vol", "volume"], ["m-rev", "reverb"], ["m-dly", "delay"], ["m-duck", "sidechain"]]
      .forEach(function (pair) {
        $(pair[0]).addEventListener("input", function () {
          Engine.setMaster(pair[1], parseInt(this.value, 10) / 100);
          syncOutputs();
          scheduleSave();
        });
      });

    $("btn-arrange").addEventListener("click", function () { arrange(true); });
    $("btn-bounce").addEventListener("click", bounce);
    $("btn-demo").addEventListener("click", loadDemoKit);
    $("btn-import").addEventListener("click", function () { $("file").click(); });
    $("file").addEventListener("change", function () {
      importFiles(Array.prototype.slice.call(this.files));
      this.value = "";
    });
    $("btn-clear").addEventListener("click", function () {
      if (!Engine.pads().length) return;
      if (!window.confirm("Delete every pad and start over?")) return;
      Engine.pads().slice().forEach(function (pad) { Engine.removePad(pad.id); });
      Engine.clearRows();
      Store.clear();
      paintAll();
      $("settings").hidden = true;
      idle();
    });

    // --- editor
    $("pad-name").addEventListener("input", function () {
      const pad = editing();
      if (!pad) return;
      pad.name = this.value || "untitled";
      pad.autoName = false;
      paintPad(pad.slot);
      scheduleSave();
    });

    $("btn-play-pad").addEventListener("click", function () {
      const pad = editing();
      if (pad) Engine.tap(pad.id, 1);
    });

    $("btn-ab").addEventListener("click", function () {
      const pad = editing();
      if (!pad || !pad.polished) return;
      pad.usePolished = !pad.usePolished;
      pad.version++;
      this.textContent = pad.usePolished ? "Polished" : "Raw take";
      this.classList.toggle("is-on", pad.usePolished);
      drawEditorWave(pad);
      paintPad(pad.slot);
      Engine.tap(pad.id, 1);
      scheduleSave();
    });

    $("pad-instrument").addEventListener("change", function () {
      const pad = editing();
      if (!pad) return;
      const inst = Instrument.get(this.value);
      const name = this.value;
      $("pad-hint").textContent = inst.hint;
      afterPaint(function () {
        repolish(pad, { instrument: name, morph: inst.morph });
        $("p-morph").value = Math.round(pad.morph * 100);
        syncOutputs();
        drawEditorWave(pad);
        openEditor(pad.slot);
        Engine.tap(pad.id, 1);
        scheduleSave();
      });
    });

    let morphTimer = null;
    $("p-morph").addEventListener("input", function () {
      const pad = editing();
      if (!pad) return;
      const morph = parseInt(this.value, 10) / 100;
      syncOutputs();
      clearTimeout(morphTimer);
      morphTimer = setTimeout(function () {
        repolish(pad, { morph: morph });
        drawEditorWave(pad);
        Engine.tap(pad.id, 1);
        scheduleSave();
      }, 240);
    });

    bindPadSlider("p-gain", function (pad, v) { pad.gain = v / 100; });
    bindPadSlider("p-pitch", function (pad, v) { pad.pitch = v; });
    bindPadSlider("p-pan", function (pad, v) { pad.pan = v / 100; });
    bindPadSlider("p-len", function (pad, v) { pad.length = v / 100; });
    bindPadSlider("p-rev", function (pad, v) { pad.sends.reverb = v / 100; });
    bindPadSlider("p-dly", function (pad, v) { pad.sends.delay = v / 100; });

    $("p-reverse").addEventListener("change", function () {
      const pad = editing();
      if (!pad) return;
      pad.reverse = this.checked;
      pad.version++;
      paintPad(pad.slot);
      Engine.tap(pad.id, 1);
      scheduleSave();
    });
    $("p-duck").addEventListener("change", function () {
      const pad = editing();
      if (pad) { pad.duck = this.checked ? 0.6 : 0; scheduleSave(); }
    });

    $("btn-chop").addEventListener("click", function () {
      const pad = editing();
      if (!pad) return;
      $("editor").hidden = true;
      ui.editing = null;
      afterPaint(function () { chop(pad); });
    });

    $("btn-clear-row").addEventListener("click", function () {
      const pad = editing();
      if (!pad) return;
      Engine.setRow(pad.id, new Array(STEPS).fill(0), false);
      toast("steps cleared");
      scheduleSave();
    });

    $("btn-delete").addEventListener("click", function () {
      const pad = editing();
      if (!pad) return;
      const slot = pad.slot;
      Engine.removePad(pad.id);
      $("editor").hidden = true;
      ui.editing = null;
      paintPad(slot);
      scheduleSave();
      idle();
    });

    // --- drag and drop, onto a pad if you aim at one
    let dragDepth = 0;
    window.addEventListener("dragover", function (e) { e.preventDefault(); });
    window.addEventListener("dragenter", function (e) {
      e.preventDefault();
      dragDepth++;
      $("drop").hidden = false;
    });
    window.addEventListener("dragleave", function () {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) $("drop").hidden = true;
    });
    window.addEventListener("drop", function (event) {
      event.preventDefault();
      dragDepth = 0;
      $("drop").hidden = true;
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) importFiles(Array.prototype.slice.call(files));
    });

    // --- keyboard, for anyone at a desk
    document.addEventListener("keydown", function (event) {
      if (event.repeat) return;
      const tag = event.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (event.code === "Space") { event.preventDefault(); $("btn-play").click(); return; }
      const index = "1234567890qwerty".indexOf(event.key.toLowerCase());
      if (index >= 0) hitPad(index);
    });

    window.addEventListener("resize", paintAll);
  }

  // ----------------------------------------------------------------- actions

  function retune() {
    const pads = Engine.pads().filter(function (pad) {
      const inst = Instrument.get(pad.instrument || "asis");
      return inst && inst.pitched;
    });
    scheduleSave();
    if (!pads.length) return;
    hud("re-tuning " + pads.length + " pad" + (pads.length === 1 ? "" : "s") + "…", "busy");
    afterPaint(function () {
      pads.forEach(function (pad) { repolish(pad, null); });
      hud("kit is in " + Polish.noteNames[ui.keyRoot] + " " + ui.scale);
      toast("re-tuned");
    });
  }

  function arrange(announce) {
    const pads = Engine.pads();
    if (!pads.length) return toast("nothing to arrange yet");
    const result = Patterns.arrange(pads.map(function (pad) {
      return { id: pad.id, role: pad.role, beats: pad.beats };
    }), ui.genre, Math.floor(Math.random() * 1e9));
    Object.keys(result.rows).forEach(function (id) {
      Engine.setRow(id, result.rows[id].steps, result.rows[id].loop);
    });
    scheduleSave();
    if (announce) {
      toast("new " + Patterns.genres[ui.genre].name.toLowerCase() + " pattern");
      $("settings").hidden = true;
    }
  }

  function importFiles(files) {
    const audio = files.filter(function (file) {
      return file.type.indexOf("audio") === 0 || /\.(wav|mp3|m4a|ogg|aac|flac|webm)$/i.test(file.name);
    });
    if (!audio.length) return toast("not an audio file");
    const ctx = Engine.context();
    $("settings").hidden = true;
    hud("reading " + audio.length + " file" + (audio.length === 1 ? "" : "s") + "…", "busy");

    audio.reduce(function (chain, file) {
      return chain.then(function () {
        const slot = firstEmptySlot();
        if (slot < 0) return null;
        return Recorder.fromFile(ctx, file).then(function (samples) {
          return new Promise(function (resolve) {
            afterPaint(function () {
              const name = file.name.replace(/\.[^.]+$/, "").slice(0, 14);
              const pad = addSample(slot, name, samples, null);
              if (pad) { giveDefaultRow(pad); hud(pad.name + ": " + pad.report.join(" · ")); }
              resolve();
            });
          });
        }).catch(function () { toast("could not read " + file.name); });
      });
    }, Promise.resolve());
  }

  function loadDemoKit() {
    const ctx = Engine.context();
    $("settings").hidden = true;
    hud("building a scratch kit…", "busy");
    afterPaint(function () {
      DemoKit.build(ctx.sampleRate).forEach(function (entry) {
        const slot = firstEmptySlot();
        if (slot >= 0) addSample(slot, entry.name, entry.samples, null);
      });
      arrange();
      paintAll();
      hud("six takes in — press play, then hold a pad to open it");
      toast("scratch kit loaded");
    });
  }

  function bounce() {
    if (!Engine.pads().length) return toast("nothing to bounce yet");
    const bars = 4;
    hud("rendering " + bars + " bars…", "busy");
    Engine.resume().then(function () {
      return Engine.bounce(bars);
    }).then(function (rendered) {
      const channels = [];
      for (let ch = 0; ch < rendered.numberOfChannels; ch++) channels.push(rendered.getChannelData(ch));
      const blob = new Blob([DSP.encodeWav(channels, rendered.sampleRate)], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "loop-lab-" + Engine.state.bpm + "bpm-" +
        Polish.noteNames[ui.keyRoot].replace("#", "s") + ui.scale + ".wav";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      hud("bounced " + bars + " bars, " + (blob.size / 1048576).toFixed(1) + " MB");
      toast("WAV saved");
    }).catch(function (err) {
      hud("could not bounce: " + (err && err.message ? err.message : "unknown error"));
    });
  }

  // ------------------------------------------------------------------- boot

  function fillSelects() {
    const key = $("key");
    Polish.noteNames.forEach(function (note, index) {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = note;
      key.appendChild(option);
    });
    key.value = ui.keyRoot;

    const instruments = $("pad-instrument");
    Instrument.order.forEach(function (name) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = Instrument.get(name).label;
      instruments.appendChild(option);
    });

    const genre = $("genre");
    Object.keys(Patterns.genres).forEach(function (name) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = Patterns.genres[name].name;
      genre.appendChild(option);
    });
    genre.value = ui.genre;
  }

  function restore() {
    const ctx = Engine.context();
    return Store.loadSession().then(function (session) {
      if (!session) return null;
      ui.keyRoot = session.keyRoot === undefined ? ui.keyRoot : session.keyRoot;
      ui.scale = session.scale || ui.scale;
      ui.genre = session.genre || ui.genre;
      ui.counter = session.counter || 0;
      Engine.setTempo(session.bpm || 132);
      Engine.setSwing(session.swing === undefined ? 0.18 : session.swing);
      if (session.master) {
        Object.keys(session.master).forEach(function (key) {
          Engine.setMaster(key, session.master[key]);
        });
      }
      $("bpm").value = Engine.state.bpm;
      $("swing").value = Math.round(Engine.state.swing * 100);
      $("key").value = ui.keyRoot;
      $("scale").value = ui.scale;
      $("genre").value = ui.genre;
      $("m-vol").value = Math.round(Engine.state.master.volume * 100);
      $("m-rev").value = Math.round(Engine.state.master.reverb * 100);
      $("m-dly").value = Math.round(Engine.state.master.delay * 100);
      $("m-duck").value = Math.round(Engine.state.master.sidechain * 100);
      return session;
    }).then(function () {
      return Store.loadPads(ctx);
    }).then(function (records) {
      if (!records || !records.length) return false;
      records.forEach(function (record, index) {
        Engine.addPad({
          id: record.id,
          slot: record.slot === undefined ? index : record.slot,
          name: record.name,
          raw: record.raw,
          polished: record.polished,
          sampleRate: record.sampleRate || ctx.sampleRate,
          usePolished: record.usePolished !== false,
          autoName: record.autoName !== false,
          autoIndex: record.autoIndex || 1,
          role: record.role,
          instrument: record.instrument || "asis",
          morph: record.morph || 0,
          sends: record.sends || { reverb: 0, delay: 0 },
          duck: record.duck || 0,
          beats: record.beats || null,
          note: record.note || null,
          shifted: record.shifted || 0,
          report: record.report || [],
          gain: record.gain === undefined ? 1 : record.gain,
          pan: record.pan || 0,
          pitch: record.pitch || 0,
          length: record.length === undefined ? 1 : record.length,
          reverse: !!record.reverse,
          mute: !!record.mute,
          choke: record.role !== "chord" && record.role !== "texture",
          version: 1,
        });
        if (record.steps && record.steps.length) {
          Engine.setRow(record.id, record.steps, !!record.loop);
        }
      });
      return true;
    }).catch(function () { return false; });
  }

  function boot() {
    buildGrid();
    fillSelects();
    bind();
    syncOutputs();
    updateKitChip();

    restore().then(function (restored) {
      paintAll();
      updateKitChip();
      if (restored) toast("kit restored");
      idle();
      if (!Recorder.supported()) {
        hud("this browser will not share a microphone — use Import in settings");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Exposed so the browser test can drive the page without a microphone.
  window.LoopLab = {
    pads: function () { return Engine.pads(); },
    padAt: function (slot) { return Engine.padAt(slot); },
    addSample: addSample,
    chop: chop,
    arrange: arrange,
    openEditor: openEditor,
    ui: ui,
  };
})();
