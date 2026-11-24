/* Runs in every page, but does nothing anywhere except inside the portal frame of
 * the hub. There it does two things, both on the hub's say-so:
 *
 *   read   find the status you picked and report its words to the hub
 *   pick   let you click the status on the page, and report where it is
 *
 * It reports only to the hub, with runtime.sendMessage, and never touches the
 * network. Nothing on the page except the one element you pick is read.
 */

(function () {
  "use strict";

  // The portal's own page is the hub's direct child: its only ancestor is the hub.
  const ancestors = location.ancestorOrigins;
  if (!ancestors || ancestors.length !== 1 || ancestors[0] !== "chrome-extension://" + chrome.runtime.id) return;

  const tell = function (message) {
    chrome.runtime.sendMessage(message, function () { void chrome.runtime.lastError; });
  };

  function textOf(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);
  }

  /* ------------------------------------------------------------------ reading */

  function hasLoginForm() {
    return Array.prototype.some.call(document.querySelectorAll('input[type="password"]'), function (i) {
      return i.getClientRects().length > 0;
    });
  }

  /* Portals draw their pages late, so give the status a while to appear. A page
   * that is plainly a sign-in form is not going to grow one, so don't wait long. */
  function waitForText(selector, ms) {
    return new Promise(function (resolve) {
      const start = Date.now();
      (function poll() {
        let el = null;
        try { el = document.querySelector(selector); } catch (err) { /* a selector that no longer parses */ }
        const text = el ? textOf(el) : "";
        const waited = Date.now() - start;
        if (text) resolve(text);
        else if (waited >= ms || (waited >= 3000 && hasLoginForm())) resolve(null);
        else setTimeout(poll, 400);
      })();
    });
  }

  async function read(task) {
    const text = await waitForText(task.selector, 12000);
    // Nothing found, and a password box on the page: it's asking you to sign in.
    tell({ type: "result", taskId: task.taskId, text: text, login: !text && hasLoginForm() });
  }

  /* ------------------------------------------------------------------ picking */

  function stable(s) {
    // Skip ids and classes that look generated, so the pick survives a rebuild.
    return !!s && s.length <= 40 && !/\d{3,}/.test(s) && !/^[a-f0-9-]{16,}$/i.test(s) &&
      !/__[\w-]{4,}$/.test(s) && !/^(css|jsx|sc|ng|ember|react)-/i.test(s);
  }

  function part(node) {
    if (node.id && stable(node.id)) return { sel: "#" + CSS.escape(node.id), absolute: true };
    const tag = node.tagName.toLowerCase();
    for (const attr of ["data-testid", "data-test", "data-qa", "data-cy", "name"]) {
      const v = node.getAttribute(attr);
      if (v && stable(v)) return { sel: tag + "[" + attr + '="' + v.replace(/["\\]/g, "\\$&") + '"]' };
    }
    let sel = tag + Array.prototype.filter.call(node.classList, stable).slice(0, 2).map(function (c) { return "." + CSS.escape(c); }).join("");
    const same = node.parentElement ? Array.prototype.filter.call(node.parentElement.children, function (c) { return c.tagName === node.tagName; }) : [];
    if (same.length > 1) sel += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
    return { sel: sel };
  }

  /* The shortest path from the element upward that matches only that element. */
  function selectorFor(el) {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      const p = part(node);
      parts.unshift(p.sel);
      const sel = parts.join(" > ");
      try {
        const hits = document.querySelectorAll(sel);
        if (hits.length === 1 && hits[0] === el) return sel;
      } catch (err) { /* keep climbing */ }
      if (p.absolute) break;
    }
    return parts.join(" > ");
  }

  let box = null;
  let bar = null;
  let hovered = null;
  const BLOCKED = ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend", "dblclick", "contextmenu"];

  function stop(e) { e.preventDefault(); e.stopPropagation(); }

  function onMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === document.documentElement || el === document.body) { box.style.display = "none"; hovered = null; return; }
    hovered = el;
    const r = el.getBoundingClientRect();
    box.style.cssText = BOX_CSS + "display:block;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px";
  }

  function onClick(e) {
    stop(e);
    const el = hovered || e.target;
    const text = el && el.nodeType === 1 ? textOf(el) : "";
    if (!text) { bar.textContent = "There's no text there. Click the words themselves."; return; }
    const selector = selectorFor(el);
    stopPicker();
    tell({ type: "picked", selector: selector, text: text, href: location.href });
  }

  function onKey(e) {
    if (e.key !== "Escape") return;
    stop(e);
    stopPicker();
    tell({ type: "pick-cancelled" });
  }

  const BOX_CSS = "all:initial;position:fixed;pointer-events:none;z-index:2147483647;box-sizing:border-box;border:2px solid #1a5fb4;background:rgba(26,95,180,0.18);";
  const BAR_CSS = "all:initial;position:fixed;left:0;right:0;top:0;z-index:2147483647;pointer-events:none;box-sizing:border-box;padding:8px 12px;text-align:center;background:#1a5fb4;color:#fff;font:600 14px system-ui,sans-serif;";

  function startPicker() {
    if (box) return;
    box = document.createElement("div");
    box.style.cssText = BOX_CSS + "display:none";
    bar = document.createElement("div");
    bar.style.cssText = BAR_CSS;
    bar.textContent = "Click the status you want to track. Esc to cancel.";
    document.documentElement.append(box, bar);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    BLOCKED.forEach(function (t) { document.addEventListener(t, stop, true); });
  }

  function stopPicker() {
    if (!box) return;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    BLOCKED.forEach(function (t) { document.removeEventListener(t, stop, true); });
    box.remove();
    bar.remove();
    box = bar = hovered = null;
  }

  /* ----------------------------------------------------------------- wiring */

  chrome.runtime.onMessage.addListener(function (message, sender, reply) {
    if (message && message.type === "pick") { startPicker(); reply({ ok: true }); }
    else if (message && message.type === "cancel-pick") { stopPicker(); reply({ ok: true }); }
  });

  // On every page load in the frame, ask the hub what, if anything, to do.
  chrome.runtime.sendMessage({ type: "hello" }, function (task) {
    if (chrome.runtime.lastError || !task) return;
    if (task.mode === "read") read(task);
    else if (task.mode === "pick") startPicker();
  });
})();
