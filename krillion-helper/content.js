// Detects the Puffer Party category prompt, asks the background worker for answers, and shows them in a sidebar.
// The sidebar only appears while a "CATEGORY n" prompt is on screen.
(() => {
  try { localStorage.removeItem("puffer-helper-selector"); } catch (_) {}

  const HOST = document.createElement("div");
  HOST.style.cssText = "position:fixed;top:110px;left:12px;z-index:2147483647;display:none;";
  const root = HOST.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .box{width:210px;font:13px ui-monospace,monospace;color:#e8f6ff;background:#0a2a45ee;border:1px solid #3cc8ff;border-radius:8px;padding:8px}
      .row{display:flex;justify-content:space-between;align-items:center;gap:6px}
      .p{margin:6px 0;color:#7fd8ff;word-break:break-word}
      button{font:inherit;background:#12466e;color:inherit;border:1px solid #3cc8ff;border-radius:4px;padding:2px 6px;cursor:pointer}
      .a{display:block;width:100%;text-align:left;margin:3px 0}
      .a.top{background:#1f7a4d}
      .t{color:#9bb;font-size:11px;margin-bottom:4px}
      .err{color:#ff9a9a}
    </style>
    <div class="box">
      <div class="row"><b>Puffer helper</b><button id="min">_</button></div>
      <div id="body"><div class="p" id="prompt"></div><div id="out"></div></div>
    </div>`;
  document.documentElement.appendChild(HOST);
  const $ = (id) => root.getElementById(id);

  const LABEL = /^category\s*\d+$/i;
  const IGNORE = /^(any answer|category|unrated|floating)/i;
  const fontOf = (el) => parseFloat(getComputedStyle(el).fontSize) || 0;
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const leaves = (el) => [...el.querySelectorAll("*")].filter((n) => n.children.length === 0 && (n.innerText || "").trim() && visible(n));

  // The prompt is the largest text sharing a container (up to 3 levels up) with a "CATEGORY n" label.
  function detectPrompt() {
    let best = null, bestFont = 0;
    for (const label of leaves(document.body)) {
      if (HOST.contains(label) || !LABEL.test(label.innerText.trim())) continue;
      let box = label.parentElement;
      for (let i = 0; i < 3 && box; i++, box = box.parentElement) {
        for (const n of leaves(box)) {
          const t = n.innerText.trim();
          if (n === label || IGNORE.test(t) || t.length < 4) continue;
          const f = fontOf(n);
          if (f > fontOf(label) && f > bestFont) { best = t; bestFont = f; }
        }
        if (best) break;
      }
    }
    return best || "";
  }

  // Words already on screen outside the helper (players' answer bubbles, chat) count as used.
  function onScreenText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let s = "";
    for (let n; (n = walker.nextNode()); ) if (!HOST.contains(n.parentNode)) s += " " + n.nodeValue;
    return s.toLowerCase();
  }
  const isUsed = (a) => new RegExp(`(^|[^a-z])${a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(onScreenText());

  let current = "";
  let all = [];
  let topic = "";
  let clicked = new Set();

  function render(error) {
    const out = $("out");
    out.textContent = "";
    if (error) { const d = document.createElement("div"); d.className = "err"; d.textContent = error; out.append(d); return; }
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = "searched: " + topic;
    out.append(t);
    const left = all.filter((a) => !clicked.has(a) && !isUsed(a)).slice(0, 8);
    left.forEach((a, i) => {
      const b = document.createElement("button");
      b.className = "a" + (i === 0 ? " top" : "");
      b.textContent = a;
      b.onclick = () => { navigator.clipboard?.writeText(a); clicked.add(a); render(); };
      out.append(b);
    });
    if (!left.length) out.append(Object.assign(document.createElement("div"), { className: "err", textContent: "nothing left" }));
  }

  async function refresh() {
    const p = detectPrompt();
    HOST.style.display = p ? "" : "none";
    if (!p) { current = ""; return; }
    if (p === current) { if (all.length) render(); return; } // re-filter as new answers appear on screen
    current = p; all = []; clicked = new Set();
    $("prompt").textContent = p;
    $("out").textContent = "thinking...";
    const res = await chrome.runtime.sendMessage({ type: "suggest", prompt: p, used: [] });
    if (p !== current) return; // prompt changed while waiting
    if (res.error) return render(res.error);
    all = res.answers; topic = res.topic;
    render();
  }

  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(refresh, 250); })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  refresh();

  $("min").onclick = () => { const b = $("body"); b.style.display = b.style.display === "none" ? "" : "none"; };
})();
