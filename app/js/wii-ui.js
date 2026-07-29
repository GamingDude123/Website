/* Shared Wii Menu chrome: synthesised sounds, haptics, clock, panels, toasts.
   Everything here is generated at runtime — no audio files to download. */

const WiiUI = (function () {
  let audioCtx = null;
  let soundOn = localStorage.getItem("wii-sound") !== "off";
  let hapticsOn = localStorage.getItem("wii-haptics") !== "off";

  function ctx() {
    if (!audioCtx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioCtx = new AudioCtor();
    }
    // iOS suspends the context until a user gesture touches it.
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  /* One plucked note. The Wii Menu's blips are short, soft and sine-ish. */
  function tone(freq, startAt, duration, peak, type) {
    const ac = ctx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t0 = ac.currentTime + startAt;
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const sounds = {
    hover: () => tone(1180, 0, 0.06, 0.05),
    click: () => { tone(880, 0, 0.09, 0.12); tone(1760, 0.01, 0.07, 0.05); },
    back: () => { tone(700, 0, 0.1, 0.1); tone(480, 0.05, 0.14, 0.08); },
    boot: () => { tone(660, 0, 0.14, 0.1); tone(880, 0.09, 0.14, 0.1); tone(1320, 0.18, 0.28, 0.09); },
    insert: () => { tone(520, 0, 0.12, 0.09); tone(780, 0.08, 0.2, 0.09); },
    error: () => { tone(320, 0, 0.16, 0.11, "triangle"); tone(240, 0.12, 0.22, 0.1, "triangle"); }
  };

  function play(name) {
    if (!soundOn) return;
    const fn = sounds[name];
    if (fn) {
      try { fn(); } catch (err) { /* audio is decorative; never break the UI */ }
    }
  }

  function buzz(pattern) {
    if (!hapticsOn || !navigator.vibrate) return;
    try { navigator.vibrate(pattern || 12); } catch (err) { /* unsupported */ }
  }

  /* Sound + haptic together, for anything the user taps. */
  function feedback(name, pattern) {
    play(name);
    buzz(pattern);
  }

  /* ---------- Clock ------------------------------------------------------ */

  function startClock(dateEl, clockEl) {
    function tick() {
      const now = new Date();
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString(undefined, {
          weekday: "short", month: "numeric", day: "numeric"
        });
      }
      if (clockEl) {
        let hours = now.getHours();
        const suffix = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        const minutes = String(now.getMinutes()).padStart(2, "0");
        clockEl.innerHTML = hours + '<span class="colon">:</span>' + minutes +
          ' <span class="sec">' + suffix + "</span>";
      }
    }
    tick();
    return setInterval(tick, 1000);
  }

  /* ---------- Panels ----------------------------------------------------- */

  /* Opens a modal. Returns {el, close}. `html` is trusted markup built by the
     app; anything user-supplied must be escaped by the caller first. */
  function panel(html, options) {
    const opts = options || {};
    const backdrop = document.createElement("div");
    backdrop.className = "panel-backdrop";
    backdrop.innerHTML = '<div class="panel" role="dialog" aria-modal="true">' + html + "</div>";

    function close() {
      if (!backdrop.parentNode) return;
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      if (opts.onClose) opts.onClose();
    }

    function onKey(event) {
      if (event.key === "Escape") {
        play("back");
        close();
      }
    }

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop && opts.dismissable !== false) {
        play("back");
        close();
      }
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(backdrop);

    backdrop.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        feedback("back");
        close();
      });
    });

    const focusable = backdrop.querySelector("input, select, textarea, button");
    if (focusable && !opts.noAutofocus) {
      setTimeout(() => focusable.focus(), 60);
    }
    return { el: backdrop.firstChild, backdrop: backdrop, close: close };
  }

  function confirm(message, confirmLabel) {
    return new Promise((resolve) => {
      // Both paths must go through close(), or the panel's Escape handler stays
      // bound to the document. A flag decides the answer instead.
      let answer = false;
      const modal = panel(
        "<h2>Hold on</h2><p>" + escapeHtml(message) + "</p>" +
        '<div class="panel-actions">' +
        '<button class="wii-btn is-danger" data-ok>' + escapeHtml(confirmLabel || "Do it") + "</button>" +
        '<button class="wii-btn" data-cancel>Cancel</button>' +
        "</div>",
        { onClose: () => resolve(answer) }
      );
      modal.el.querySelector("[data-cancel]").addEventListener("click", () => {
        feedback("back");
        modal.close();
      });
      modal.el.querySelector("[data-ok]").addEventListener("click", () => {
        feedback("click");
        answer = true;
        modal.close();
      });
    });
  }

  /* A blocking overlay for work that takes long enough to notice, like
     importing a 32 MB ROM. Returns a handle so callers can retitle it. */
  function busy(message) {
    const el = document.createElement("div");
    el.className = "panel-backdrop is-busy";
    el.innerHTML = '<div class="busy-box"><div class="spinner"></div>' +
      '<p class="busy-text"></p></div>';
    el.querySelector(".busy-text").textContent = message || "Working…";
    document.body.appendChild(el);
    return {
      update(text) {
        const node = el.querySelector(".busy-text");
        if (node) node.textContent = text;
      },
      close() { el.remove(); }
    };
  }

  /* Press-and-hold, used as a shortcut to a channel's options. Cancels if the
     finger moves, so it never fires mid-scroll. */
  function onLongPress(element, callback, ms) {
    let timer = null;
    let startX = 0;
    let startY = 0;
    let fired = false;

    function cancel() {
      clearTimeout(timer);
      timer = null;
    }

    element.addEventListener("pointerdown", (event) => {
      if (event.button && event.button !== 0) return;
      fired = false;
      startX = event.clientX;
      startY = event.clientY;
      timer = setTimeout(() => {
        fired = true;
        buzz(18);
        callback();
      }, ms || 480);
    });

    element.addEventListener("pointermove", (event) => {
      if (!timer) return;
      if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10) {
        cancel();
      }
    });

    element.addEventListener("pointerup", cancel);
    element.addEventListener("pointercancel", cancel);
    element.addEventListener("pointerleave", cancel);

    // Let the caller suppress the click that follows a completed long press.
    return () => fired;
  }

  let toastTimer = null;
  function toast(message, ms) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    clearTimeout(toastTimer);
    const el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.textContent = message;
    document.body.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), ms || 2600);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setSound(on) {
    soundOn = on;
    localStorage.setItem("wii-sound", on ? "on" : "off");
  }

  function setHaptics(on) {
    hapticsOn = on;
    localStorage.setItem("wii-haptics", on ? "on" : "off");
  }

  return {
    play: play,
    buzz: buzz,
    feedback: feedback,
    startClock: startClock,
    panel: panel,
    confirm: confirm,
    busy: busy,
    onLongPress: onLongPress,
    toast: toast,
    escapeHtml: escapeHtml,
    setSound: setSound,
    setHaptics: setHaptics,
    // Shared so the music loop mixes into the same context as the menu blips.
    audioContext: ctx,
    get soundOn() { return soundOn; },
    get hapticsOn() { return hapticsOn; }
  };
})();

/* Register the service worker so the menu works offline once installed. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* Offline support is a bonus — a failed registration is not fatal. */
    });
  });
}
