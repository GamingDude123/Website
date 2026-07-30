/* Wiring: pads, the step grid, the pad sheet, and the bounce.
 *
 * The polish pass blocks the main thread for a few hundred milliseconds, which
 * is long enough to swallow a click but too short to be worth a worker and the
 * buffer-passing that comes with it. Every call is therefore made after a
 * paint, with the status line already updated, so the page never looks frozen.
 */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const STEPS = Patterns.steps;

  const ui = {
    keyRoot: 9,          // A
    scale: "minor",
    genre: "garage",
    selected: null,
    counter: 0,
    saveTimer: null,
  };

  // ------------------------------------------------------------------ toast

  let toastTimer = null;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  function status(message, busy) {
    const el = $("status");
    el.textContent = message;
    el.classList.toggle("is-busy", !!busy);
  }

  /* Let the browser paint the "working on it" state before we hog the thread. */
  function afterPaint(fn) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { setTimeout(fn, 0); });
    });
  }

  // ------------------------------------------------------------- waveforms

  /* Min/max per column rather than sampling every nth point, so a short
   * transient cannot fall between the cracks and vanish from the drawing. */
  function drawWave(canvas, samples, colour) {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(40, canvas.clientWidth || canvas.width);
    const height = canvas.clientHeight || canvas.height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const g = canvas.getContext("2d");
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);

    if (!samples || !samples.length) return;
    const mid = height / 2;
    const per = samples.length / width;

    g.strokeStyle = "rgba(255,255,255,0.10)";
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(width, mid);
    g.stroke();

    g.fillStyle = colour || "#4dd4ff";
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
      const top = mid - max * mid * 0.95;
      const bottom = mid - min * mid * 0.95;
      g.fillRect(x, top, 1, Math.max(1, bottom - top));
    }
  }

  // ------------------------------------------------------------------ pads

  function padSubtitle(pad) {
    const bits = [];
    if (pad.note) bits.push(pad.note);
    if (pad.beats) bits.push(pad.beats + (pad.beats === 1 ? " beat" : " beats"));
    // The length of whatever is actually loaded, not of the take it came from —
    // trimming can cut a second of dead air off the front.
    const active = pad.usePolished && pad.polished ? pad.polished : pad.raw;
    bits.push((active.length / pad.sampleRate).toFixed(2) + "s");
    return bits.join(" · ");
  }

  function renderPads() {
    const host = $("pads");
    host.innerHTML = "";
    const pads = Engine.pads();

    pads.forEach(function (pad) {
      const tile = document.createElement("div");
      tile.className = "pad" + (pad.mute ? " is-muted" : "");
      tile.dataset.role = pad.role;
      tile.dataset.id = pad.id;
      tile.tabIndex = 0;

      const top = document.createElement("div");
      top.className = "pad-top";
      const name = document.createElement("span");
      name.className = "pad-name";
      name.textContent = pad.name;
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = pad.role;
      top.appendChild(name);
      top.appendChild(tag);

      const canvas = document.createElement("canvas");
      const sub = document.createElement("div");
      sub.className = "pad-sub";
      sub.textContent = padSubtitle(pad);

      const cog = document.createElement("button");
      cog.className = "cog";
      cog.textContent = "edit";

      tile.appendChild(top);
      tile.appendChild(canvas);
      tile.appendChild(sub);
      tile.appendChild(cog);
      host.appendChild(tile);

      drawWave(canvas, pad.usePolished && pad.polished ? pad.polished : pad.raw,
        pad.role === "kick" ? "#ff3b6b" : pad.role === "bass" ? "#ffb03a" : "#4dd4ff");

      function hit() {
        Engine.tap(pad.id, 1);
        tile.classList.add("is-hit");
        setTimeout(function () { tile.classList.remove("is-hit"); }, 130);
      }

      // pointerdown, not click: a pad has to fire the instant it is touched.
      tile.addEventListener("pointerdown", function (event) {
        if (event.target === cog) return;
        hit();
      });
      tile.addEventListener("keydown", function (event) {
        if (event.key === " " || event.key === "Enter") { event.preventDefault(); hit(); }
      });
      cog.addEventListener("click", function (event) {
        event.stopPropagation();
        openSheet(pad.id);
      });
    });
  }

  // ------------------------------------------------------------- sequencer

  function renderGrid() {
    const host = $("grid");
    const pads = Engine.pads();
    host.innerHTML = "";
    $("grid-empty").hidden = pads.length > 0;

    pads.forEach(function (pad) {
      const row = document.createElement("div");
      row.className = "grid-row";
      row.dataset.id = pad.id;

      const label = document.createElement("div");
      label.className = "label";
      label.textContent = pad.name;
      row.appendChild(label);

      const existing = Engine.rows()[pad.id];
      const steps = existing ? existing.steps : new Array(STEPS).fill(0);

      for (let s = 0; s < STEPS; s++) {
        const cell = document.createElement("button");
        cell.className = "cell";
        cell.dataset.step = s;
        cell.dataset.beat = s % 4 === 0 ? "1" : "0";
        cell.setAttribute("aria-label", pad.name + " step " + (s + 1));
        paintCell(cell, steps[s]);
        cell.addEventListener("click", function () {
          const row = Engine.rows()[pad.id] || { steps: new Array(STEPS).fill(0), loop: false };
          row.steps[s] = row.steps[s] ? 0 : 1;
          Engine.setRow(pad.id, row.steps, row.loop);
          paintCell(cell, row.steps[s]);
          if (row.steps[s]) Engine.tap(pad.id, 1);
          scheduleSave();
        });
        row.appendChild(cell);
      }
      host.appendChild(row);
    });
  }

  function paintCell(cell, velocity) {
    cell.classList.toggle("is-on", !!velocity);
    cell.dataset.vel = velocity && velocity < 0.7 ? "soft" : "hard";
  }

  Engine.onStep(function (step) {
    const cells = document.querySelectorAll(".cell.is-now");
    for (let i = 0; i < cells.length; i++) cells[i].classList.remove("is-now");
    if (step < 0) return;
    const now = document.querySelectorAll('.cell[data-step="' + step + '"]');
    for (let i = 0; i < now.length; i++) now[i].classList.add("is-now");
  });

  // --------------------------------------------------------- adding sounds

  function polishOptions(role) {
    return {
      sampleRate: Engine.context().sampleRate,
      bpm: Engine.state.bpm,
      keyRoot: ui.keyRoot,
      scale: ui.scale,
      role: role || null,
    };
  }

  /* Turn a recording into a pad. Everything the polish pass decided is kept on
   * the pad so the sheet can show its reasoning and so a later re-polish can
   * start from the raw take again. */
  function addSample(name, samples, role) {
    const result = Polish.process(samples, polishOptions(role));
    if (!result) {
      toast("that take was silent");
      return null;
    }
    ui.counter++;
    const pad = Engine.addPad({
      id: "pad-" + Date.now().toString(36) + "-" + ui.counter,
      name: name || "take " + ui.counter,
      raw: Float32Array.from(samples),
      polished: result.samples,
      sampleRate: result.sampleRate,
      usePolished: true,
      role: result.role,
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
    });

    // A new pad gets a part straight away, otherwise pressing play does nothing.
    const arrangement = Patterns.arrange([{ id: pad.id, role: pad.role, beats: pad.beats }], ui.genre,
      Math.floor(Math.random() * 1e9));
    const row = arrangement.rows[pad.id];
    Engine.setRow(pad.id, row.steps, row.loop);

    renderPads();
    renderGrid();
    scheduleSave();
    return pad;
  }

  function repolish(pad, role) {
    const previous = Polish.recipes[pad.role];
    // Only move the fader if it is still where the previous role put it —
    // a level the user set by hand survives a change of role.
    const untouched = previous && Math.abs(pad.gain - previous.level) < 0.005;
    const result = Polish.process(pad.raw, polishOptions(role || pad.role));
    if (!result) return;
    if (untouched) pad.gain = result.level;
    pad.polished = result.samples;
    pad.role = result.role;
    pad.sends = { reverb: result.sends.reverb, delay: result.sends.delay };
    pad.duck = result.duck;
    pad.beats = result.beats;
    pad.note = result.note;
    pad.shifted = result.shifted;
    pad.report = result.steps;
    pad.version++;
  }

  // ------------------------------------------------------------- recording

  let meterTimer = null;

  function startRecording() {
    const ctx = Engine.context();
    Engine.resume().then(function () {
      return Recorder.start(ctx);
    }).then(function () {
      $("btn-rec").classList.add("is-live");
      $("rec-label").textContent = "Stop";
      status("listening… tap stop when you are done", true);
      meterTimer = setInterval(function () {
        $("meter-fill").style.width = Math.min(100, Recorder.level() * 140) + "%";
        if (Recorder.elapsed(ctx) > Recorder.maxSeconds) stopRecording();
      }, 60);
    }).catch(function (err) {
      const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
      status(denied
        ? "microphone blocked — allow it in the address bar, or import a file instead"
        : "no microphone here — import a file or load the scratch kit instead");
      toast(denied ? "microphone permission denied" : "microphone unavailable");
    });
  }

  function stopRecording() {
    const ctx = Engine.context();
    clearInterval(meterTimer);
    meterTimer = null;
    const take = Recorder.stop(ctx);
    $("btn-rec").classList.remove("is-live");
    $("rec-label").textContent = "Record a sound";
    $("meter-fill").style.width = "0%";

    if (!take || take.length < ctx.sampleRate * 0.05) {
      status("that was too short to keep — hold it for a moment longer");
      return;
    }
    status("working out what that was…", true);
    afterPaint(function () {
      const pad = addSample(null, take, null);
      if (pad) {
        status(pad.report.join(" · "));
        toast("added " + pad.name + " as a " + pad.role);
      }
    });
  }

  // ------------------------------------------------------------ pad sheet

  function openSheet(id) {
    const pad = Engine.padById(id);
    if (!pad) return;
    ui.selected = id;

    $("pad-name").value = pad.name;
    $("pad-role").value = pad.role;
    $("btn-ab").textContent = pad.usePolished ? "Polished" : "Raw take";
    $("btn-ab").classList.toggle("is-on", pad.usePolished);
    $("p-gain").value = Math.round(pad.gain * 100);
    $("p-pitch").value = pad.pitch;
    $("p-pan").value = Math.round(pad.pan * 100);
    $("p-len").value = Math.round(pad.length * 100);
    $("p-rev").value = Math.round(pad.sends.reverb * 100);
    $("p-dly").value = Math.round(pad.sends.delay * 100);
    $("p-reverse").checked = !!pad.reverse;
    $("p-duck").checked = pad.duck >= 0.3;
    syncOutputs();

    const report = $("pad-report");
    report.innerHTML = "";
    const head = document.createElement("div");
    head.className = "head";
    head.textContent = "what it did to this one";
    report.appendChild(head);
    (pad.report || []).forEach(function (line) {
      const row = document.createElement("div");
      row.className = "line";
      const bullet = document.createElement("b");
      bullet.textContent = "✓";
      const text = document.createElement("span");
      text.textContent = line;
      row.appendChild(bullet);
      row.appendChild(text);
      report.appendChild(row);
    });

    $("sheet").hidden = false;
    drawSheetWave(pad);
  }

  function drawSheetWave(pad) {
    drawWave($("pad-wave"), pad.usePolished && pad.polished ? pad.polished : pad.raw,
      pad.usePolished ? "#3ce68a" : "#a49cc4");
  }

  function closeSheet() {
    $("sheet").hidden = true;
    ui.selected = null;
  }

  function selected() {
    return ui.selected ? Engine.padById(ui.selected) : null;
  }

  function syncOutputs() {
    $("p-gain-out").value = $("p-gain").value;
    $("p-pitch-out").value = $("p-pitch").value;
    $("p-pan-out").value = $("p-pan").value;
    $("p-len-out").value = $("p-len").value;
    $("p-rev-out").value = $("p-rev").value;
    $("p-dly-out").value = $("p-dly").value;
  }

  function bindPadSlider(inputId, apply) {
    $(inputId).addEventListener("input", function () {
      const pad = selected();
      if (!pad) return;
      apply(pad, parseFloat(this.value));
      syncOutputs();
      scheduleSave();
    });
  }

  // ------------------------------------------------------------------ save

  function scheduleSave() {
    clearTimeout(ui.saveTimer);
    ui.saveTimer = setTimeout(function () {
      const rows = Engine.rows();
      Engine.pads().forEach(function (pad) {
        pad.steps = rows[pad.id] ? rows[pad.id].steps : [];
        pad.loop = rows[pad.id] ? rows[pad.id].loop : false;
      });
      Store.savePads(Engine.pads()).catch(function () { /* private mode, no disk */ });
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

  // ------------------------------------------------------------------ boot

  function fillSelects() {
    const key = $("key");
    Polish.noteNames.forEach(function (note, index) {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = note;
      key.appendChild(option);
    });
    key.value = ui.keyRoot;

    const genre = $("genre");
    Object.keys(Patterns.genres).forEach(function (name) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = Patterns.genres[name].name;
      genre.appendChild(option);
    });
    genre.value = ui.genre;
  }

  function bind() {
    $("btn-about").addEventListener("click", function () {
      const box = $("about");
      box.hidden = !box.hidden;
      this.setAttribute("aria-expanded", String(!box.hidden));
    });

    $("btn-play").addEventListener("click", function () {
      const self = this;
      Engine.toggle().then(function () {
        const on = Engine.isPlaying();
        self.classList.toggle("is-playing", on);
        self.innerHTML = on ? "&#9632;" : "&#9654;";
        self.setAttribute("aria-label", on ? "Stop" : "Play");
      });
    });

    $("bpm").addEventListener("input", function () {
      Engine.setTempo(parseInt(this.value, 10));
      $("bpm-out").value = this.value;
      scheduleSave();
    });

    $("swing").addEventListener("input", function () {
      Engine.setSwing(parseInt(this.value, 10) / 100);
      $("swing-out").value = this.value + "%";
      scheduleSave();
    });

    $("key").addEventListener("change", function () {
      ui.keyRoot = parseInt(this.value, 10);
      retuneKit("key");
    });

    $("scale").addEventListener("change", function () {
      ui.scale = this.value;
      retuneKit("scale");
    });

    $("genre").addEventListener("change", function () {
      ui.genre = this.value;
      const genre = Patterns.genres[ui.genre];
      $("bpm").value = genre.bpm;
      $("bpm-out").value = genre.bpm;
      Engine.setTempo(genre.bpm);
      $("swing").value = Math.round(genre.swing * 100);
      $("swing-out").value = Math.round(genre.swing * 100) + "%";
      Engine.setSwing(genre.swing);
      arrange();
      toast(genre.name + " — " + genre.hint);
    });

    $("btn-rec").addEventListener("click", function () {
      if (Recorder.isRecording()) stopRecording();
      else startRecording();
    });

    $("btn-import").addEventListener("click", function () { $("file").click(); });
    $("file").addEventListener("change", function () {
      importFiles(Array.prototype.slice.call(this.files));
      this.value = "";
    });

    $("btn-demo").addEventListener("click", loadDemoKit);
    $("btn-arrange").addEventListener("click", function () { arrange(true); });
    $("btn-bounce").addEventListener("click", bounce);

    $("btn-clear").addEventListener("click", function () {
      if (!Engine.pads().length) return;
      if (!window.confirm("Delete every pad and start over?")) return;
      Engine.pads().slice().forEach(function (pad) { Engine.removePad(pad.id); });
      Engine.clearRows();
      Store.clear();
      renderPads();
      renderGrid();
      status("cleared. record something.");
    });

    // --- mix
    [["m-vol", "volume", 100], ["m-rev", "reverb", 100], ["m-dly", "delay", 100],
     ["m-duck", "sidechain", 100]].forEach(function (entry) {
      $(entry[0]).addEventListener("input", function () {
        Engine.setMaster(entry[1], parseInt(this.value, 10) / entry[2]);
        $(entry[0] + "-out").value = this.value;
        scheduleSave();
      });
    });

    // --- pad sheet
    $("sheet-close").addEventListener("click", closeSheet);
    $("sheet").addEventListener("click", function (event) {
      if (event.target === this) closeSheet();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !$("sheet").hidden) closeSheet();
    });

    $("pad-name").addEventListener("input", function () {
      const pad = selected();
      if (!pad) return;
      pad.name = this.value || "untitled";
      renderPads();
      renderGrid();
      scheduleSave();
    });

    $("btn-ab").addEventListener("click", function () {
      const pad = selected();
      if (!pad || !pad.polished) return;
      pad.usePolished = !pad.usePolished;
      pad.version++;
      this.textContent = pad.usePolished ? "Polished" : "Raw take";
      this.classList.toggle("is-on", pad.usePolished);
      drawSheetWave(pad);
      renderPads();
      Engine.tap(pad.id, 1);
      scheduleSave();
    });

    $("btn-play-pad").addEventListener("click", function () {
      const pad = selected();
      if (pad) Engine.tap(pad.id, 1);
    });

    $("pad-role").addEventListener("change", function () {
      const pad = selected();
      if (!pad) return;
      const role = this.value;
      status("re-shaping as a " + role + "…", true);
      afterPaint(function () {
        repolish(pad, role);
        openSheet(pad.id);
        renderPads();
        status("now shaped like a " + role);
        scheduleSave();
      });
    });

    $("btn-repolish").addEventListener("click", function () {
      const pad = selected();
      if (!pad) return;
      status("polishing again at " + Engine.state.bpm + " bpm in " +
        Polish.noteNames[ui.keyRoot] + " " + ui.scale + "…", true);
      afterPaint(function () {
        repolish(pad, null);
        openSheet(pad.id);
        renderPads();
        status(pad.report.join(" · "));
        scheduleSave();
      });
    });

    $("btn-delete").addEventListener("click", function () {
      const pad = selected();
      if (!pad) return;
      Engine.removePad(pad.id);
      closeSheet();
      renderPads();
      renderGrid();
      scheduleSave();
    });

    bindPadSlider("p-gain", function (pad, v) { pad.gain = v / 100; });
    bindPadSlider("p-pitch", function (pad, v) { pad.pitch = v; });
    bindPadSlider("p-pan", function (pad, v) { pad.pan = v / 100; });
    bindPadSlider("p-len", function (pad, v) { pad.length = v / 100; });
    bindPadSlider("p-rev", function (pad, v) { pad.sends.reverb = v / 100; });
    bindPadSlider("p-dly", function (pad, v) { pad.sends.delay = v / 100; });

    $("p-reverse").addEventListener("change", function () {
      const pad = selected();
      if (!pad) return;
      pad.reverse = this.checked;
      pad.version++;
      renderPads();
      Engine.tap(pad.id, 1);
      scheduleSave();
    });

    $("p-duck").addEventListener("change", function () {
      const pad = selected();
      if (!pad) return;
      pad.duck = this.checked ? 0.6 : 0;
      scheduleSave();
    });

    // --- drag and drop anywhere on the page
    let dragDepth = 0;
    window.addEventListener("dragover", function (event) { event.preventDefault(); });
    window.addEventListener("dragenter", function (event) {
      event.preventDefault();
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

    // --- keyboard: number keys fire pads, space plays
    document.addEventListener("keydown", function (event) {
      if (event.target.tagName === "INPUT" || event.target.tagName === "SELECT") return;
      if (event.code === "Space") {
        event.preventDefault();
        $("btn-play").click();
        return;
      }
      const index = "123456789".indexOf(event.key);
      if (index >= 0) {
        const pad = Engine.pads()[index];
        if (pad) Engine.tap(pad.id, 1);
      }
    });
  }

  function retuneKit(what) {
    const pads = Engine.pads().filter(function (pad) {
      return Polish.recipes[pad.role] && Polish.recipes[pad.role].tune;
    });
    scheduleSave();
    if (!pads.length) return;
    status("re-tuning " + pads.length + " pad" + (pads.length === 1 ? "" : "s") +
      " to " + Polish.noteNames[ui.keyRoot] + " " + ui.scale + "…", true);
    afterPaint(function () {
      pads.forEach(function (pad) { repolish(pad, pad.role); });
      renderPads();
      if (ui.selected) openSheet(ui.selected);
      status("kit is now in " + Polish.noteNames[ui.keyRoot] + " " + ui.scale);
      toast("re-tuned to the new " + what);
    });
  }

  function importFiles(files) {
    const audio = files.filter(function (file) {
      return file.type.indexOf("audio") === 0 || /\.(wav|mp3|m4a|ogg|aac|flac|webm)$/i.test(file.name);
    });
    if (!audio.length) {
      toast("that is not an audio file");
      return;
    }
    const ctx = Engine.context();
    status("reading " + audio.length + " file" + (audio.length === 1 ? "" : "s") + "…", true);

    // One at a time: decoding and polishing four files at once just makes the
    // page stutter for longer.
    audio.reduce(function (chain, file) {
      return chain.then(function () {
        return Recorder.fromFile(ctx, file).then(function (samples) {
          return new Promise(function (resolve) {
            afterPaint(function () {
              const name = file.name.replace(/\.[^.]+$/, "").slice(0, 18);
              const pad = addSample(name, samples, null);
              if (pad) status(pad.name + ": " + pad.report.join(" · "));
              resolve();
            });
          });
        }).catch(function () {
          toast("could not decode " + file.name);
        });
      });
    }, Promise.resolve());
  }

  function loadDemoKit() {
    const ctx = Engine.context();
    status("building a scratch kit…", true);
    afterPaint(function () {
      const kit = DemoKit.build(ctx.sampleRate);
      kit.forEach(function (entry) { addSample(entry.name, entry.samples, null); });
      arrange();
      status("six rough takes in. open one to see what was done to it.");
      toast("scratch kit loaded — press play");
    });
  }

  function arrange(announce) {
    const pads = Engine.pads();
    if (!pads.length) {
      toast("nothing to arrange yet");
      return;
    }
    const result = Patterns.arrange(pads.map(function (pad) {
      return { id: pad.id, role: pad.role, beats: pad.beats };
    }), ui.genre, Math.floor(Math.random() * 1e9));

    Object.keys(result.rows).forEach(function (id) {
      Engine.setRow(id, result.rows[id].steps, result.rows[id].loop);
    });
    renderGrid();
    scheduleSave();
    if (announce) toast("new " + Patterns.genres[ui.genre].name.toLowerCase() + " arrangement");
  }

  function bounce() {
    if (!Engine.pads().length) {
      toast("nothing to bounce yet");
      return;
    }
    const bars = 4;
    status("rendering " + bars + " bars…", true);
    Engine.resume().then(function () {
      return Engine.bounce(bars);
    }).then(function (rendered) {
      const channels = [];
      for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
        channels.push(rendered.getChannelData(ch));
      }
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
      status("bounced " + bars + " bars, " + (blob.size / 1048576).toFixed(1) + " MB");
      toast("WAV saved");
    }).catch(function (err) {
      status("could not bounce: " + (err && err.message ? err.message : "unknown error"));
    });
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
      $("bpm-out").value = Engine.state.bpm;
      $("swing").value = Math.round(Engine.state.swing * 100);
      $("swing-out").value = Math.round(Engine.state.swing * 100) + "%";
      $("key").value = ui.keyRoot;
      $("scale").value = ui.scale;
      $("genre").value = ui.genre;
      $("m-vol").value = Math.round(Engine.state.master.volume * 100);
      $("m-rev").value = Math.round(Engine.state.master.reverb * 100);
      $("m-dly").value = Math.round(Engine.state.master.delay * 100);
      $("m-duck").value = Math.round(Engine.state.master.sidechain * 100);
      ["m-vol", "m-rev", "m-dly", "m-duck"].forEach(function (id) {
        $(id + "-out").value = $(id).value;
      });
      return session;
    }).then(function () {
      return Store.loadPads(ctx);
    }).then(function (records) {
      if (!records || !records.length) return false;
      records.forEach(function (record) {
        Engine.addPad({
          id: record.id,
          name: record.name,
          raw: record.raw,
          polished: record.polished,
          sampleRate: record.sampleRate || ctx.sampleRate,
          usePolished: record.usePolished !== false,
          role: record.role,
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
    }).catch(function () {
      return false;
    });
  }

  function boot() {
    fillSelects();
    bind();
    if (!Recorder.supported()) {
      status("this browser will not give a page the microphone — import a file or load the scratch kit");
    }
    restore().then(function (restored) {
      renderPads();
      renderGrid();
      if (restored) {
        status("picked your kit back up where you left it.");
        toast("kit restored");
      }
    });
    window.addEventListener("resize", function () {
      renderPads();
      const pad = selected();
      if (pad) drawSheetWave(pad);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Exposed so the browser test can drive the page without a microphone.
  window.LoopLab = {
    addSample: addSample,
    arrange: arrange,
    pads: function () { return Engine.pads(); },
    ui: ui,
    drawWave: drawWave,
  };
})();
