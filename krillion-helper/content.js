// Finds the on-screen category prompt, asks the background worker for answers, and shows them in a sidebar.
(() => {
  const HOST = document.createElement("div");
  HOST.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;";
  const root = HOST.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .box{width:230px;font:13px ui-monospace,monospace;color:#e8f6ff;background:#0a2a45ee;border:1px solid #3cc8ff;border-radius:8px;padding:8px}
      .row{display:flex;justify-content:space-between;align-items:center;gap:6px}
      .p{margin:6px 0;color:#7fd8ff;word-break:break-word}
      button{font:inherit;background:#12466e;color:inherit;border:1px solid #3cc8ff;border-radius:4px;padding:2px 6px;cursor:pointer}
      .a{display:block;width:100%;text-align:left;margin:3px 0}
      .a.top{background:#1f7a4d}
      .err{color:#ff9a9a}
    </style>
    <div class="box">
      <div class="row"><b>Puffer helper</b><span><button id="pick">pick</button> <button id="min">_</button></span></div>
      <div id="body"><div class="p" id="prompt">waiting for a prompt...</div><div id="out"></div></div>
    </div>`;
  document.documentElement.appendChild(HOST);
  const $ = (id) => root.getElementById(id);

  let current = "";
  let used = [];
  let pickedSelector = null;
  try { pickedSelector = localStorage.getItem("puffer-helper-selector"); } catch (_) {}

  // Score visible, short, leaf-ish text elements; the category prompt is usually large and question-like.
  function detectPrompt() {
    if (pickedSelector) {
      const el = document.querySelector(pickedSelector);
      if (el && el.innerText.trim()) return el.innerText.trim();
    }
    let best = null, bestScore = 0;
    for (const el of document.body.querySelectorAll("h1,h2,h3,h4,p,div,span")) {
      if (HOST.contains(el) || el.children.length > 2) continue;
      const t = (el.innerText || "").trim();
      if (t.length < 6 || t.length > 120) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      let s = parseFloat(getComputedStyle(el).fontSize) / 10;
      if (/\?$/.test(t)) s += 3;
      if (/^(name|list|things|types?|kinds?|famous|which|what|words?|foods?|animals?)\b/i.test(t)) s += 3;
      if (/category|topic/i.test(t)) s += 1;
      if (s > bestScore) { bestScore = s; best = t; }
    }
    return bestScore >= 4 ? best : "";
  }

  function render(answers, error) {
    const out = $("out");
    out.textContent = "";
    if (error) {
      const d = document.createElement("div");
      d.className = "err";
      d.textContent = error;
      out.append(d);
      return;
    }
    answers.forEach((a, i) => {
      const b = document.createElement("button");
      b.className = "a" + (i === 0 ? " top" : "");
      b.textContent = a;
      b.onclick = () => { navigator.clipboard?.writeText(a); used.push(a); b.disabled = true; };
      out.append(b);
    });
  }

  async function refresh() {
    const p = detectPrompt();
    if (!p || p === current) return;
    current = p;
    used = [];
    $("prompt").textContent = p;
    $("out").textContent = "thinking...";
    const res = await chrome.runtime.sendMessage({ type: "suggest", prompt: p, used });
    if (p !== current) return; // prompt changed while waiting
    res.error ? render([], res.error) : render(res.answers);
  }

  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(refresh, 250); })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  refresh();

  $("min").onclick = () => { const b = $("body"); b.style.display = b.style.display === "none" ? "" : "none"; };

  // Manual fallback: click "pick", then click the element that holds the prompt.
  $("pick").onclick = () => {
    $("prompt").textContent = "click the prompt text...";
    const handler = (e) => {
      if (HOST.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      document.removeEventListener("click", handler, true);
      const el = e.target;
      pickedSelector = el.id ? `#${CSS.escape(el.id)}` : el.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).map(CSS.escape).join(".") : el.tagName.toLowerCase();
      try { localStorage.setItem("puffer-helper-selector", pickedSelector); } catch (_) {}
      current = "";
      refresh();
    };
    document.addEventListener("click", handler, true);
  };
})();
