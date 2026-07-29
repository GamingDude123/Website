/* Photo Channel — a Game Boy Camera for your phone.
 *
 * The Wii had a Photo Channel; the Game Boy had a camera that shot 128×112
 * pictures in four shades. This is both: the phone's camera, quantised down
 * to a 128×112 grid and four colours, dithered, framed and kept in an album.
 *
 * Everything runs on the device. No photo is uploaded, and the camera stream
 * is stopped the moment you leave the view. */

const PhotoView = (function () {
  const esc = WiiUI.escapeHtml;

  /* The Game Boy Camera's real sensor resolution. Everything downstream
     assumes these numbers, including saved album entries. */
  const W = 128;
  const H = 112;
  const PIXELS = W * H;

  /* Shade 0 is the lightest, 3 the darkest — the Game Boy's own ordering, so a
     stored picture can be re-tinted later just by swapping the palette. */
  const PALETTES = [
    { id: "dmg",    name: "Game Boy",    colors: ["#9bbc0f", "#8bac0f", "#306230", "#0f380f"] },
    { id: "pocket", name: "Pocket",      colors: ["#e8e8e8", "#a8a8a8", "#585858", "#181818"] },
    { id: "light",  name: "Light",       colors: ["#00b581", "#009a70", "#00614a", "#002d24"] },
    { id: "vb",     name: "Virtual Boy", colors: ["#ff8b8b", "#e02c2c", "#7d0000", "#1c0000"] },
    { id: "ocean",  name: "Ocean",       colors: ["#dff6ff", "#6cc4e8", "#2a6f97", "#0b2545"] },
    { id: "berry",  name: "Berry",       colors: ["#ffe3f1", "#ff9ecd", "#c0468b", "#4a0f34"] },
    { id: "sepia",  name: "Sepia",       colors: ["#f4e4c1", "#c9a227", "#7a5230", "#2b1a0e"] }
  ];

  /* 4×4 ordered dither. A plain threshold turns a face into two flat blobs;
     the Game Boy Camera dithered for the same reason. */
  const BAYER = [
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5
  ];

  const FRAMES = [
    { id: "none",    name: "None" },
    { id: "classic", name: "Classic" },
    { id: "checker", name: "Checker" },
    { id: "film",    name: "Film" },
    { id: "stars",   name: "Stars" }
  ];

  const EXPORT_SCALE = 8; // 1024 × 896 — big enough to actually look at.

  /* ---------- Element handles --------------------------------------------- */

  const viewEl = document.getElementById("view-photo");
  const menuEl = document.getElementById("view-menu");
  const canvas = document.getElementById("pc-canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const flashEl = document.getElementById("pc-flash");
  const statusEl = document.getElementById("pc-status");
  const countEl = document.getElementById("pc-count");
  const paletteRail = document.getElementById("pc-palettes");
  const frameRail = document.getElementById("pc-frames");
  const brightInput = document.getElementById("pc-bright");
  const contrastInput = document.getElementById("pc-contrast");
  const ditherInput = document.getElementById("pc-dither");
  const gallerySub = document.getElementById("pc-gallery-sub");
  const importInput = document.getElementById("photo-input");

  /* ---------- State -------------------------------------------------------- */

  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.setAttribute("playsinline", "");

  let stream = null;
  let facing = localStorage.getItem("pc-facing") || "environment";
  let paletteId = localStorage.getItem("pc-palette") || "dmg";
  let frameId = localStorage.getItem("pc-frame") || "none";
  let brightness = Number(localStorage.getItem("pc-bright") || 0);
  let contrast = Number(localStorage.getItem("pc-contrast") || 120);
  let dither = Number(localStorage.getItem("pc-dither") || 64);

  let stillImage = null;   // an imported picture, shown instead of the camera
  let rafId = null;
  let countdownTimer = null;
  let albumCount = 0;

  // Reused every frame so the render loop doesn't allocate 14 KB a tick.
  const indices = new Uint8Array(PIXELS);

  /* ---------- Palettes and frames ------------------------------------------ */

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  PALETTES.forEach((palette) => {
    palette.rgb = palette.colors.map(hexToRgb);
  });

  function paletteById(id) {
    return PALETTES.filter((p) => p.id === id)[0] || PALETTES[0];
  }

  /* Frames are painted in shade indices rather than colour, so they always sit
     in the current palette and stay crisp — no dithering on a border. */
  const frameArtists = {
    none: null,

    classic(px) {
      edge(8, (x, y, d) => {
        if (d < 2) return 3;
        if (d < 3) return 1;
        if (d < 7) return 0;
        return 3;
      }, px);
    },

    checker(px) {
      edge(8, (x, y, d) => {
        if (d < 1) return 3;
        return ((x >> 2) + (y >> 2)) & 1 ? 3 : 0;
      }, px);
    },

    film(px) {
      const band = 11;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const inBand = y < band || y >= H - band;
          const inSide = x < 4 || x >= W - 4;
          if (!inBand && !inSide) continue;
          let shade = 3;
          if (inBand) {
            // Sprocket holes: a light rounded rectangle every 12 pixels.
            const hx = x % 12;
            const hy = y < band ? y : H - 1 - y;
            if (hx >= 3 && hx <= 8 && hy >= 3 && hy <= 7) shade = 0;
            if ((hx === 3 || hx === 8) && (hy === 3 || hy === 7)) shade = 3;
          }
          px(x, y, shade);
        }
      }
    },

    stars(px) {
      edge(8, (x, y, d) => (d < 1 ? 3 : 0), px);
      // Four-pointed sparkles dotted evenly around the border.
      for (let i = 0; i < W; i += 16) {
        star(px, i + 8, 4);
        star(px, i + 8, H - 5);
      }
      for (let j = 16; j < H - 12; j += 16) {
        star(px, 4, j + 4);
        star(px, W - 5, j + 4);
      }
    }
  };

  /* Walks the `size`-pixel border and asks `shadeFor` what to paint. */
  function edge(size, shadeFor, px) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (d >= size) continue;
        px(x, y, shadeFor(x, y, d));
      }
    }
  }

  function star(px, cx, cy) {
    px(cx, cy, 3);
    px(cx - 1, cy, 3); px(cx + 1, cy, 3);
    px(cx, cy - 1, 3); px(cx, cy + 1, 3);
    px(cx - 2, cy, 2); px(cx + 2, cy, 2);
    px(cx, cy - 2, 2); px(cx, cy + 2, 2);
  }

  function applyFrame(buffer, id) {
    const artist = frameArtists[id];
    if (!artist) return;
    artist((x, y, shade) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      buffer[y * W + x] = shade;
    });
  }

  /* ---------- The picture pipeline ----------------------------------------- */

  /* Draws whatever the source is into the canvas, cropped to 8:7 so nothing is
     stretched, mirroring the selfie camera so it behaves like a mirror. */
  function drawSource() {
    let el = null;
    let sw = 0;
    let sh = 0;

    if (stillImage) {
      el = stillImage;
      sw = stillImage.naturalWidth || stillImage.width;
      sh = stillImage.naturalHeight || stillImage.height;
    } else if (video.readyState >= 2 && video.videoWidth) {
      el = video;
      sw = video.videoWidth;
      sh = video.videoHeight;
    }
    if (!el || !sw || !sh) return false;

    const aspect = W / H;
    let cropW = sw;
    let cropH = sw / aspect;
    if (cropH > sh) {
      cropH = sh;
      cropW = sh * aspect;
    }
    const cropX = (sw - cropW) / 2;
    const cropY = (sh - cropH) / 2;

    const mirror = !stillImage && facing === "user";
    ctx.save();
    if (mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(el, cropX, cropY, cropW, cropH, 0, 0, W, H);
    ctx.restore();
    return true;
  }

  /* Greyscale → brightness/contrast → ordered dither → four shades → palette. */
  function quantise() {
    const image = ctx.getImageData(0, 0, W, H);
    const data = image.data;
    const gain = contrast / 100;

    for (let y = 0; y < H; y++) {
      const bayerRow = (y & 3) * 4;
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        let value = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
        value = (value - 128) * gain + 128 + brightness;
        value += ((BAYER[bayerRow + (x & 3)] - 7.5) / 16) * dither;

        let level = Math.floor(value / 64);
        if (level < 0) level = 0;
        else if (level > 3) level = 3;
        indices[y * W + x] = 3 - level;
      }
    }

    applyFrame(indices, frameId);
    paint(indices, paletteId, data);
    ctx.putImageData(image, 0, 0);
  }

  /* Writes shade indices into an RGBA buffer using the given palette. */
  function paint(buffer, id, out) {
    const rgb = paletteById(id).rgb;
    for (let i = 0; i < PIXELS; i++) {
      const colour = rgb[buffer[i]];
      const p = i * 4;
      out[p] = colour[0];
      out[p + 1] = colour[1];
      out[p + 2] = colour[2];
      out[p + 3] = 255;
    }
  }

  function renderOnce() {
    if (drawSource()) quantise();
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    if (stillImage) return; // a still only needs redrawing when a control moves
    renderOnce();
  }

  function startLoop() {
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ---------- Camera ------------------------------------------------------- */

  function setStatus(html) {
    if (!html) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      return;
    }
    statusEl.hidden = false;
    statusEl.innerHTML = html;
  }

  function stopCamera() {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  }

  function startCamera() {
    if (stillImage) return Promise.resolve();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus(
        "<b>No camera here</b>" +
        (window.isSecureContext === false
          ? "<span>A camera needs a secure (https) page. Open the app over " +
            "https and it'll work.</span>"
          : "<span>This browser won't hand out a camera. You can still bring " +
            "in a picture from your phone with <b>Import</b>.</span>")
      );
      return Promise.resolve();
    }

    setStatus("<b>Starting the camera…</b>");
    stopCamera();

    // Ask for something close to the sensor's aspect; the browser is free to
    // ignore it, and the crop in drawSource() copes either way.
    return navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 1120 }
      },
      audio: false
    }).then((media) => {
      stream = media;
      video.srcObject = media;
      return video.play();
    }).then(() => {
      setStatus("");
    }).catch((err) => {
      stopCamera();
      const name = err && err.name ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus(
          "<b>Camera blocked</b><span>Your browser is holding the camera back. " +
          "Allow it in the site settings, or bring a picture in with " +
          "<b>Import</b> instead.</span>"
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setStatus(
          "<b>No camera found</b><span>Nothing to point at anything. Use " +
          "<b>Import</b> to Game Boy-ify a picture you already have.</span>"
        );
      } else {
        setStatus(
          "<b>The camera didn't start</b><span>" + esc(name || "Unknown error") +
          ". Try again, or use <b>Import</b> to bring a picture in.</span>"
        );
      }
    });
  }

  function flipCamera() {
    if (stillImage) {
      returnToCamera();
      return;
    }
    facing = facing === "user" ? "environment" : "user";
    localStorage.setItem("pc-facing", facing);
    startCamera();
  }

  function returnToCamera() {
    stillImage = null;
    setStatus("");
    startCamera().then(renderOnce);
  }

  /* ---------- Capture ------------------------------------------------------ */

  function flash() {
    flashEl.classList.remove("is-on");
    // Force a reflow so the animation restarts on a rapid second shot.
    void flashEl.offsetWidth;
    flashEl.classList.add("is-on");
  }

  function capture() {
    if (!drawSource()) {
      WiiUI.play("error");
      WiiUI.toast("Nothing to photograph yet");
      return;
    }
    quantise();
    flash();
    WiiUI.feedback("shutter", [8, 26, 12]);

    Photos.add({
      palette: paletteId,
      frame: frameId,
      data: new Uint8Array(indices) // a copy: `indices` is reused next frame
    }).then((record) => {
      albumCount++;
      updateGalleryLabel();
      offerSaved(record);
    }).catch((err) => {
      WiiUI.play("error");
      WiiUI.toast(err && err.name === "QuotaExceededError"
        ? "No room left on this device for another photo"
        : "Couldn't save that photo", 3600);
    });
  }

  function startCountdown(seconds) {
    if (countdownTimer) return;
    let left = seconds;
    countEl.textContent = left;
    countEl.classList.add("is-on");
    WiiUI.play("click");

    countdownTimer = setInterval(() => {
      left--;
      if (left > 0) {
        countEl.textContent = left;
        // Restart the pop animation on each tick.
        countEl.classList.remove("is-on");
        void countEl.offsetWidth;
        countEl.classList.add("is-on");
        WiiUI.play("click");
        return;
      }
      clearInterval(countdownTimer);
      countdownTimer = null;
      countEl.classList.remove("is-on");
      countEl.textContent = "";
      capture();
    }, 1000);
  }

  function cancelCountdown() {
    if (!countdownTimer) return;
    clearInterval(countdownTimer);
    countdownTimer = null;
    countEl.classList.remove("is-on");
    countEl.textContent = "";
  }

  /* ---------- Rendering a saved photo -------------------------------------- */

  /* Saved photos are shade indices, not pixels, so they can be redrawn at any
     size and in any palette long after the shot. */
  function toCanvas(record, scale, overridePalette) {
    const small = document.createElement("canvas");
    small.width = W;
    small.height = H;
    const smallCtx = small.getContext("2d");
    const image = smallCtx.createImageData(W, H);
    paint(record.data, overridePalette || record.palette, image.data);
    smallCtx.putImageData(image, 0, 0);

    if (scale === 1) return small;

    const big = document.createElement("canvas");
    big.width = W * scale;
    big.height = H * scale;
    const bigCtx = big.getContext("2d");
    bigCtx.imageSmoothingEnabled = false;
    bigCtx.drawImage(small, 0, 0, big.width, big.height);
    return big;
  }

  function toBlob(canvasEl) {
    return new Promise((resolve, reject) => {
      canvasEl.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Couldn't encode the image"));
      }, "image/png");
    });
  }

  function fileNameFor(record) {
    const when = new Date(record.created);
    const pad = (n) => String(n).padStart(2, "0");
    return "photo-channel-" + when.getFullYear() + pad(when.getMonth() + 1) +
      pad(when.getDate()) + "-" + pad(when.getHours()) + pad(when.getMinutes()) +
      pad(when.getSeconds()) + ".png";
  }

  /* Share sheet where there is one, a download everywhere else. */
  function exportPhoto(record) {
    const working = WiiUI.busy("Getting the picture ready…");
    return toBlob(toCanvas(record, EXPORT_SCALE)).then((blob) => {
      const name = fileNameFor(record);
      const file = new File([blob], name, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file] })
          .then(() => working.close())
          .catch((err) => {
            working.close();
            // A cancelled share sheet is a normal outcome, not a failure.
            if (err && err.name === "AbortError") return;
            download(blob, name);
          });
      }

      working.close();
      download(blob, name);
    }).catch(() => {
      working.close();
      WiiUI.play("error");
      WiiUI.toast("Couldn't export that photo");
    });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    WiiUI.toast("Saved to your downloads");
  }

  /* ---------- Panels ------------------------------------------------------- */

  function offerSaved(record) {
    const modal = WiiUI.panel(
      "<h2>Got it</h2>" +
      '<p class="muted">Saved to your album — ' + albumCount +
      " photo" + (albumCount === 1 ? "" : "s") + " in there now.</p>" +
      '<div class="pc-preview"><img alt="The photo you just took" src="' +
        toCanvas(record, 2).toDataURL("image/png") + '"></div>' +
      '<div class="panel-actions">' +
        '<button class="wii-btn is-wide is-primary" data-share>Save or share</button>' +
        '<button class="wii-btn" data-album>Open album</button>' +
        '<button class="wii-btn" data-close>Keep shooting</button>' +
      "</div>",
      { noAutofocus: true }
    );
    modal.el.querySelector("[data-share]").addEventListener("click", () => {
      WiiUI.feedback("click");
      exportPhoto(record);
    });
    modal.el.querySelector("[data-album]").addEventListener("click", () => {
      WiiUI.feedback("click");
      modal.close();
      openAlbum();
    });
  }

  function openAlbum() {
    Photos.all().then((photos) => {
      albumCount = photos.length;
      updateGalleryLabel();

      const grid = photos.length
        ? '<div class="pc-grid">' + photos.map((photo, index) =>
            '<button class="pc-thumb" data-photo="' + index + '">' +
            '<img alt="Photo taken ' + esc(whenText(photo.created)) + '" src="' +
            toCanvas(photo, 1).toDataURL("image/png") + '"></button>'
          ).join("") + "</div>"
        : '<div class="dc-empty">No photos yet.<br>Point the camera at ' +
          "something and press the big button.</div>";

      const modal = WiiUI.panel(
        "<h2>Album</h2>" +
        '<p class="muted">' + (photos.length
          ? photos.length + " photo" + (photos.length === 1 ? "" : "s") +
            " · kept on this device only"
          : "Everything you shoot stays on this phone.") + "</p>" +
        grid +
        '<div class="panel-actions">' +
          '<button class="wii-btn is-wide is-primary" data-import>Use a picture I have</button>' +
          (photos.length ? '<button class="wii-btn is-danger" data-clear>Delete all</button>' : "") +
          '<button class="wii-btn" data-close>Close</button>' +
        "</div>",
        { noAutofocus: true }
      );

      modal.el.querySelectorAll("[data-photo]").forEach((button) => {
        button.addEventListener("click", () => {
          WiiUI.feedback("click");
          modal.close();
          openPhoto(photos[Number(button.getAttribute("data-photo"))]);
        });
      });

      modal.el.querySelector("[data-import]").addEventListener("click", () => {
        WiiUI.feedback("click");
        modal.close();
        importInput.click();
      });

      const clearButton = modal.el.querySelector("[data-clear]");
      if (clearButton) {
        clearButton.addEventListener("click", () => {
          WiiUI.feedback("click");
          WiiUI.confirm(
            "Delete all " + photos.length + " photos? They aren't backed up anywhere.",
            "Delete all"
          ).then((ok) => {
            if (!ok) return;
            Photos.clear().then(() => {
              albumCount = 0;
              updateGalleryLabel();
              modal.close();
              WiiUI.toast("Album emptied");
            });
          });
        });
      }
    });
  }

  function openPhoto(record) {
    let shownPalette = record.palette;

    const swatches = PALETTES.map((palette) =>
      '<button class="pc-swatch' + (palette.id === record.palette ? " is-on" : "") +
      '" data-tint="' + palette.id + '" title="' + esc(palette.name) + '" ' +
      'aria-label="' + esc(palette.name) + '" style="background:' +
      "linear-gradient(135deg," + palette.colors[0] + " 0 50%," +
      palette.colors[2] + " 50% 100%)" + '"></button>'
    ).join("");

    const modal = WiiUI.panel(
      "<h2>" + esc(whenText(record.created)) + "</h2>" +
      '<p class="muted">128 × 112 · four shades · exports at ' +
        (W * EXPORT_SCALE) + " × " + (H * EXPORT_SCALE) + "</p>" +
      '<div class="pc-preview"><img data-preview alt="Saved photo" src="' +
        toCanvas(record, 3).toDataURL("image/png") + '"></div>' +
      '<p class="muted" style="margin-bottom:4px">Re-tint it — the shades were ' +
        "saved, not the colours:</p>" +
      '<div class="pc-swatches">' + swatches + "</div>" +
      '<div class="panel-actions">' +
        '<button class="wii-btn is-wide is-primary" data-share>Save or share</button>' +
        '<button class="wii-btn is-danger" data-delete>Delete</button>' +
        '<button class="wii-btn" data-close>Back</button>' +
      "</div>",
      { noAutofocus: true }
    );

    const preview = modal.el.querySelector("[data-preview]");

    modal.el.querySelectorAll("[data-tint]").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        WiiUI.feedback("click");
        shownPalette = swatch.getAttribute("data-tint");
        preview.src = toCanvas(record, 3, shownPalette).toDataURL("image/png");
        modal.el.querySelectorAll("[data-tint]").forEach((other) => {
          other.classList.toggle("is-on", other === swatch);
        });
        // Keep the re-tint, so the album shows what you last chose.
        Photos.update(record.id, { palette: shownPalette });
        record.palette = shownPalette;
      });
    });

    modal.el.querySelector("[data-share]").addEventListener("click", () => {
      WiiUI.feedback("click");
      exportPhoto(record);
    });

    modal.el.querySelector("[data-delete]").addEventListener("click", () => {
      WiiUI.feedback("click");
      WiiUI.confirm("Delete this photo?", "Delete").then((ok) => {
        if (!ok) return;
        Photos.remove(record.id).then(() => {
          albumCount = Math.max(0, albumCount - 1);
          updateGalleryLabel();
          modal.close();
          WiiUI.toast("Photo deleted");
        });
      });
    });
  }

  function openIntro() {
    WiiUI.panel(
      "<h2>Photo Channel</h2>" +
      "<p>Your camera, squeezed down to what a Game Boy Camera could manage: " +
      "<strong>128 × 112 pixels, four shades</strong>, dithered the same way " +
      "the real thing did it.</p>" +
      "<p class='muted'><strong>Big button</strong> takes the photo. " +
      "<strong>Hold it</strong> for a three-second timer.<br>" +
      "<strong>Flip</strong> swaps front and back cameras.<br>" +
      "<strong>Import</strong> at the top turns a picture you already have " +
      "into one of these.<br>" +
      "<strong>Album</strong> keeps everything you shoot, and exports at " +
      (W * EXPORT_SCALE) + " × " + (H * EXPORT_SCALE) + ".</p>" +
      "<p class='muted'>The shades get saved rather than the colours, so any " +
      "photo can be re-tinted later — green, grey, Virtual Boy red — without " +
      "losing anything.</p>" +
      "<p class='muted'>Nothing is uploaded. Photos live in this browser's " +
      "storage on your phone, and the camera shuts off the moment you leave " +
      "this screen.</p>" +
      '<div class="panel-actions">' +
        '<button class="wii-btn is-wide is-primary" data-close>Start shooting</button>' +
      "</div>",
      { noAutofocus: true }
    );
    Settings.set("seen-photo-intro", true);
  }

  function whenText(timestamp) {
    const when = new Date(timestamp);
    return when.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " · " + when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  /* ---------- Importing a picture ------------------------------------------ */

  function importPicture(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      stopCamera();
      stillImage = img;
      setStatus("");
      renderOnce();
      WiiUI.toast("Tap the shutter to keep this one · Flip returns to the camera", 4200);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      WiiUI.play("error");
      WiiUI.toast("Couldn't open that picture");
    };
    img.src = url;
  }

  /* ---------- Control rails ------------------------------------------------- */

  function buildRails() {
    paletteRail.innerHTML = PALETTES.map((palette) =>
      '<button class="chip pc-chip" data-palette="' + palette.id + '">' +
      '<span class="pc-dot" style="background:' +
        "linear-gradient(135deg," + palette.colors[0] + " 0 50%," +
        palette.colors[2] + " 50% 100%)" + '"></span>' +
      esc(palette.name) + "</button>"
    ).join("");

    frameRail.innerHTML = FRAMES.map((frame) =>
      '<button class="chip pc-chip" data-frame="' + frame.id + '">' +
      esc(frame.name) + "</button>"
    ).join("");

    syncRails();
  }

  function syncRails() {
    paletteRail.querySelectorAll("[data-palette]").forEach((chip) => {
      chip.classList.toggle("is-on", chip.getAttribute("data-palette") === paletteId);
    });
    frameRail.querySelectorAll("[data-frame]").forEach((chip) => {
      chip.classList.toggle("is-on", chip.getAttribute("data-frame") === frameId);
    });
  }

  function updateGalleryLabel() {
    gallerySub.textContent = albumCount
      ? albumCount + " photo" + (albumCount === 1 ? "" : "s")
      : "empty";
  }

  /* ---------- Wiring -------------------------------------------------------- */

  buildRails();
  brightInput.value = brightness;
  contrastInput.value = contrast;
  ditherInput.value = dither;

  paletteRail.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-palette]");
    if (!chip) return;
    WiiUI.feedback("click");
    paletteId = chip.getAttribute("data-palette");
    localStorage.setItem("pc-palette", paletteId);
    syncRails();
    renderOnce();
  });

  frameRail.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-frame]");
    if (!chip) return;
    WiiUI.feedback("click");
    frameId = chip.getAttribute("data-frame");
    localStorage.setItem("pc-frame", frameId);
    syncRails();
    renderOnce();
  });

  function slider(input, key, apply) {
    input.addEventListener("input", () => {
      apply(Number(input.value));
      localStorage.setItem(key, input.value);
      renderOnce();
    });
  }

  slider(brightInput, "pc-bright", (v) => { brightness = v; });
  slider(contrastInput, "pc-contrast", (v) => { contrast = v; });
  slider(ditherInput, "pc-dither", (v) => { dither = v; });

  const shootButton = document.getElementById("pc-shoot");
  const heldTimer = WiiUI.onLongPress(shootButton, () => startCountdown(3));
  shootButton.addEventListener("click", () => {
    if (heldTimer()) return; // the hold already started a countdown
    if (countdownTimer) {
      cancelCountdown();
      WiiUI.feedback("back");
      WiiUI.toast("Timer cancelled");
      return;
    }
    capture();
  });

  document.getElementById("pc-flip").addEventListener("click", () => {
    WiiUI.feedback("click");
    flipCamera();
  });

  document.getElementById("pc-gallery").addEventListener("click", () => {
    WiiUI.feedback("click");
    openAlbum();
  });

  document.getElementById("pc-import").addEventListener("click", () => {
    WiiUI.feedback("click");
    importInput.click();
  });

  document.getElementById("pc-back").addEventListener("click", () => {
    WiiUI.feedback("back");
    hide();
  });

  importInput.addEventListener("change", () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = "";
    if (file) importPicture(file);
  });

  // Leaving the app shouldn't leave the camera light on.
  document.addEventListener("visibilitychange", () => {
    if (viewEl.hidden) return;
    if (document.hidden) {
      cancelCountdown();
      stopLoop();
      stopCamera();
    } else {
      startCamera();
      startLoop();
    }
  });

  /* ---------- Show / hide ---------------------------------------------------- */

  function show() {
    menuEl.hidden = true;
    viewEl.hidden = false;
    window.scrollTo(0, 0);
    if (location.hash !== "#photo") location.hash = "#photo";

    Photos.count().then((count) => {
      albumCount = count;
      updateGalleryLabel();
    });

    startLoop();
    startCamera().then(renderOnce);

    return Settings.get("seen-photo-intro", false).then((seen) => {
      if (!seen) openIntro();
    });
  }

  function hide() {
    cancelCountdown();
    stopLoop();
    stopCamera();
    stillImage = null;
    viewEl.hidden = true;
    menuEl.hidden = false;
    window.scrollTo(0, 0);
    if (location.hash === "#photo") {
      // Replace rather than push, so Back doesn't bounce straight back in.
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  window.addEventListener("hashchange", () => {
    if (location.hash === "#photo") {
      if (viewEl.hidden) show();
    } else if (!viewEl.hidden) {
      hide();
    }
  });

  if (location.hash === "#photo") {
    show();
  } else {
    Photos.count().then((count) => {
      albumCount = count;
      updateGalleryLabel();
    });
  }

  return { show: show, hide: hide };
})();
