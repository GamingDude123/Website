// ==UserScript==
// @name         Krillion Puffer Helper
// @namespace    https://github.com/GamingDude123/Website
// @version      0.3.1
// @description  Shows suggested answers for the current Puffer Party category in a small sidebar.
// @match        https://krillion.io/*
// @match        https://*.krillion.io/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      en.wikipedia.org
// @connect      api.datamuse.com
// @updateURL    https://raw.githubusercontent.com/GamingDude123/Website/claude/magical-rubin-okrvsh/krillion-helper/puffer-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/GamingDude123/Website/claude/magical-rubin-okrvsh/krillion-helper/puffer-helper.user.js
// ==/UserScript==

(() => {
"use strict";

// Cross-origin GET that works even if the site's CSP blocks fetch().
function getJSON(url) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url,
      onload: (r) => (r.status >= 200 && r.status < 300 ? resolve(JSON.parse(r.responseText)) : reject(new Error(`HTTP ${r.status}`))),
      onerror: () => reject(new Error("network error")),
      ontimeout: () => reject(new Error("timeout")),
      timeout: 6000
    });
  });
}

// Free, keyless answer source: bundled lists first, then Wikipedia categories / list pages.
// Results are cached per topic so repeat categories need no network at all.
const WIKI = "https://en.wikipedia.org/w/api.php";

const BUNDLED = {
  military: ["General", "Colonel", "Major", "Captain", "Lieutenant", "Sergeant", "Corporal", "Private", "Admiral", "Commander", "Ensign", "Brigadier"],
  cheese: ["Cheddar", "Brie", "Gouda", "Mozzarella", "Parmesan", "Feta", "Swiss", "Camembert", "Provolone", "Havarti"],
  fruit: ["Apple", "Banana", "Orange", "Grape", "Mango", "Pear", "Peach", "Cherry", "Lemon", "Strawberry", "Plum", "Kiwi"],
  vegetable: ["Carrot", "Broccoli", "Potato", "Onion", "Spinach", "Celery", "Pepper", "Lettuce", "Corn", "Cabbage", "Pea", "Cucumber"],
  animal: ["Dog", "Cat", "Horse", "Lion", "Tiger", "Bear", "Wolf", "Fox", "Elephant", "Giraffe", "Monkey", "Zebra"],
  bird: ["Eagle", "Robin", "Owl", "Sparrow", "Penguin", "Parrot", "Crow", "Hawk", "Duck", "Swan", "Falcon", "Pigeon"],
  fish: ["Salmon", "Tuna", "Trout", "Bass", "Cod", "Shark", "Goldfish", "Catfish", "Eel", "Carp", "Perch", "Pike"],
  color: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Brown", "Black", "White", "Gray", "Teal"],
  country: ["France", "Brazil", "Japan", "Canada", "Egypt", "India", "Italy", "Mexico", "Spain", "China", "Germany", "Peru"],
  state: ["Texas", "Florida", "Ohio", "Maine", "Utah", "Iowa", "Nevada", "Oregon", "Alaska", "Georgia", "Hawaii", "Idaho"],
  city: ["Paris", "London", "Tokyo", "Rome", "Madrid", "Berlin", "Sydney", "Cairo", "Moscow", "Dallas", "Boston", "Miami"],
  planet: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
  element: ["Hydrogen", "Oxygen", "Carbon", "Iron", "Gold", "Silver", "Helium", "Neon", "Copper", "Zinc", "Sodium", "Lead"],
  language: ["English", "Spanish", "French", "German", "Chinese", "Arabic", "Hindi", "Russian", "Italian", "Japanese", "Korean", "Latin"],
  month: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  car: ["Toyota", "Ford", "Honda", "BMW", "Tesla", "Audi", "Chevrolet", "Nissan", "Jeep", "Subaru", "Mazda", "Kia"],
  sport: ["Soccer", "Tennis", "Golf", "Hockey", "Rugby", "Boxing", "Baseball", "Cricket", "Football", "Basketball", "Swimming", "Skiing"],
  instrument: ["Guitar", "Piano", "Violin", "Drums", "Flute", "Trumpet", "Cello", "Harp", "Saxophone", "Clarinet", "Banjo", "Tuba"],
  dog: ["Poodle", "Beagle", "Bulldog", "Husky", "Corgi", "Boxer", "Dachshund", "Pug", "Labrador", "Collie", "Terrier", "Chihuahua"],
  drink: ["Water", "Coffee", "Tea", "Milk", "Juice", "Soda", "Beer", "Wine", "Lemonade", "Cola", "Smoothie", "Cocoa"],
  tree: ["Oak", "Maple", "Pine", "Birch", "Willow", "Elm", "Cedar", "Palm", "Spruce", "Ash", "Fir", "Redwood"],
  flower: ["Rose", "Tulip", "Daisy", "Lily", "Orchid", "Sunflower", "Daffodil", "Violet", "Poppy", "Lotus", "Iris", "Lilac"],
  subject: ["Math", "Science", "History", "English", "Art", "Music", "Biology", "Chemistry", "Physics", "Geography", "Gym", "Algebra"],
  job: ["Doctor", "Teacher", "Nurse", "Lawyer", "Chef", "Pilot", "Farmer", "Plumber", "Engineer", "Artist", "Police", "Firefighter"]
};

const ALIAS = { army: "military", navy: "military", rank: "military", ranks: "military", cities: "city", states: "state", breed: "dog", breeds: "dog", cars: "car", brand: "car", beverage: "drink", beverages: "drink", occupation: "job", profession: "job", school: "subject", countries: "country" };

// "Name types of cheese?" -> "cheese"
function topicOf(prompt) {
  const lead = /^(please|name|list|say|give me|tell me|famous|some|any|different|popular|types? of|kinds? of|things|which|what are|what is|a|an|the)\s+/;
  let t = prompt.toLowerCase().replace(/[?!.:]+$/g, "").trim();
  for (let prev; prev !== t; ) { prev = t; t = t.replace(lead, ""); }
  return t;
}

function singular(w) {
  return w.replace(/ies$/, "y").replace(/(s|x|ch|sh)es$/, "$1").replace(/s$/, "");
}

function clean(title) {
  return title.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function usable(title) {
  return (
    title &&
    !/^(list|lists|category|template|portal|wikipedia|help|file|outline|index|glossary|timeline)\b/i.test(title) &&
    !/\b(list of|lists of)\b/i.test(title) &&
    !/^\d/.test(title) &&
    title.length <= 30
  );
}

function wiki(params) {
  return getJSON(`${WIKI}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`);
}

// Orders titles by recent pageviews, so well-known answers come before obscure ones.
async function byPopularity(titles) {
  const views = new Map();
  const batches = [];
  for (let i = 0; i < titles.length; i += 50) batches.push(titles.slice(i, i + 50));
  const results = await Promise.all(
    batches.map((batch) => wiki({ action: "query", prop: "pageviews", pvipdays: "30", titles: batch.join("|") }).catch(() => null))
  );
  for (const r of results) {
    for (const p of Object.values(r?.query?.pages || {})) {
      views.set(p.title, Object.values(p.pageviews || {}).reduce((sum, v) => sum + (v || 0), 0));
    }
  }
  return [...titles].sort((a, b) => (views.get(b) || 0) - (views.get(a) || 0));
}

async function fromCategory(topic) {
  const s = await wiki({ action: "query", list: "search", srsearch: topic, srnamespace: "14", srlimit: "3" });
  const lists = await Promise.all(
    (s.query?.search || []).map((hit) =>
      wiki({ action: "query", list: "categorymembers", cmtitle: hit.title, cmtype: "page", cmlimit: "150" }).catch(() => null)
    )
  );
  for (const m of lists) {
    const titles = (m?.query?.categorymembers || []).map((p) => p.title).filter((t) => usable(clean(t)));
    if (titles.length >= 5) return (await byPopularity(titles)).map(clean);
  }
  return [];
}

async function fromListPage(topic) {
  const s = await wiki({ action: "query", list: "search", srsearch: `List of ${topic}`, srlimit: "1" });
  const page = s.query?.search?.[0]?.title;
  if (!page) return [];
  const l = await wiki({ action: "query", prop: "links", titles: page, pllimit: "100", plnamespace: "0" });
  const pages = Object.values(l.query?.pages || {});
  const titles = (pages[0]?.links || []).map((x) => x.title).filter((t) => usable(clean(t)));
  return (await byPopularity(titles)).map(clean);
}

// Datamuse (free, no key): words that are kinds of the given word, e.g. "cheese" -> cheddar, brie...
async function fromDatamuse(word) {
  const rows = await getJSON(`https://api.datamuse.com/words?rel_gen=${encodeURIComponent(word)}&max=100&md=f`);
  const freq = (r) => parseFloat((r.tags || []).find((t) => t.startsWith("f:"))?.slice(2)) || 0;
  return rows
    .filter((r) => /^[a-z][a-z' -]{2,}$/i.test(r.word))
    .sort((a, b) => freq(b) - freq(a)) // everyday words first
    .map((r) => r.word.replace(/^./, (c) => c.toUpperCase()));
}

// "animal that lives in the ocean" -> ["animal that lives in the ocean", "animal", "ocean", ...]
function variants(topic) {
  const words = topic.split(/\s+/).filter((w) => !/^(in|of|the|that|which|who|a|an|and|or|on|at|to|from|with|you|can|find|found|lives?)$/.test(w));
  const out = [topic, singular(topic)];
  if (words.length > 1) out.push(words.join(" "), words.slice(-2).join(" "), words[words.length - 1], words[0]);
  out.push(...words.map(singular));
  return [...new Set(out.filter(Boolean))];
}

// onPartial gets the quick built-in list right away; the return value is built-in + web answers.
async function candidates(topic, onPartial) {
  const words = topic.split(/\s+/);
  const keys = [topic, singular(topic), ...words, ...words.map(singular)];
  let builtin = [];
  for (const k of keys) if (BUNDLED[k]) { builtin = BUNDLED[k]; break; }
  if (!builtin.length) for (const w of words) if (ALIAS[w]) { builtin = BUNDLED[ALIAS[w]]; break; }
  if (builtin.length) onPartial(builtin);

  const cacheKey = `cache3:${topic}`;
  let web = GM_getValue(cacheKey);
  if (!web) {
    // Every variant and source runs at once. The best-ranked variant wins, and within it the best source
    // with enough answers (Wikipedia category, then list page, then word database). Sources are not mixed.
    let lastError;
    const runs = variants(topic).map((v) =>
      Promise.all([fromCategory, fromListPage, fromDatamuse].map((src) => src(v).catch((e) => { lastError = e; return []; })))
    );
    web = [];
    for (const run of runs) {
      const found = (await run).find((n) => n.length >= 5);
      if (found) { web = [...new Set(found)]; break; }
    }
    if (!web.length && !builtin.length && lastError) throw lastError;
    web = web.slice(0, 200);
    if (web.length) GM_setValue(cacheKey, web);
  }
  const have = new Set(builtin.map((n) => n.toLowerCase()));
  return [...builtin, ...web.filter((n) => !have.has(n.toLowerCase()))];
}

async function suggest(prompt, onPartial) {
  const topic = topicOf(prompt);
  if (!topic) throw new Error("Couldn't work out the category.");
  const answers = await candidates(topic, (a) => onPartial({ answers: a, topic }));
  if (!answers.length) throw new Error(`No answers found for "${topic}".`);
  return { answers, topic };
}

// Detects the Puffer Party category prompt, asks the background worker for answers, and shows them in a sidebar.
// The sidebar only appears while a "CATEGORY n" prompt is on screen.
(() => {
  try { localStorage.removeItem("puffer-helper-selector"); } catch (_) {}

  const HOST = document.createElement("div");
  HOST.style.cssText = "position:fixed;top:110px;left:12px;z-index:2147483647;display:none;";
  const root = HOST.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .box{width:210px;max-height:80vh;overflow:auto;font:13px ui-monospace,monospace;color:#e8f6ff;background:#0a2a45ee;border:1px solid #3cc8ff;border-radius:8px;padding:8px}
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
  const HINT = /any answer passes the puffer/i;
  const IGNORE = /^(any answer|category|unrated|floating)/i;
  const clip = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
  const fontOf = (el) => parseFloat(getComputedStyle(el).fontSize) || 0;
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

  // Anchors: the small "CATEGORY n" label, or the "any answer passes the puffer" hint. Text may be split across
  // child elements (typewriter effects), so match on an element's whole text, deepest match first.
  function anchors() {
    const found = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (HOST.contains(el) || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      const t = clip(el);
      if (t.length > 40 || !t) continue;
      if (!(LABEL.test(t) || HINT.test(t)) || !visible(el)) continue;
      if ([...el.children].some((c) => LABEL.test(clip(c)) || HINT.test(clip(c)))) continue; // deeper match wins
      found.push(el);
    }
    return found;
  }

  // The prompt is the largest text sharing a container (up to 4 levels up) with an anchor.
  function detectPrompt() {
    let best = "", bestFont = 0;
    for (const anchor of anchors()) {
      let box = anchor.parentElement;
      for (let i = 0; i < 4 && box && !best; i++, box = box.parentElement) {
        let pick = null;
        for (const n of box.querySelectorAll("*")) {
          if (HOST.contains(n) || !visible(n)) continue;
          const t = clip(n);
          if (t.length < 8 || t.length > 120 || IGNORE.test(t) || n.contains(anchor)) continue;
          const f = fontOf(n);
          // largest font wins; among equals, the tightest element (shortest text) is the prompt itself
          if (!pick || f > pick.f || (f === pick.f && t.length < pick.t.length)) pick = { f, t };
        }
        if (pick && pick.f > fontOf(anchor) && pick.f > bestFont) { best = pick.t; bestFont = pick.f; }
      }
    }
    return best;
  }

  // Click the dot (bottom-left) to copy a description of the page; useful when detection misses.
  const dot = document.createElement("div");
  dot.title = "Puffer helper is running. Click to copy debug info.";
  dot.style.cssText = "position:fixed;bottom:6px;left:6px;width:10px;height:10px;border-radius:50%;background:#3cc8ff;opacity:.5;cursor:pointer;z-index:2147483647";
  dot.onclick = () => {
    const lines = [location.href, "anchors: " + anchors().length, "prompt: " + detectPrompt(), ""];
    for (const el of document.body.querySelectorAll("*")) {
      const t = clip(el);
      if (HOST.contains(el) || el.dataset?.pufferDot || !t || t.length > 80 || !visible(el)) continue;
      lines.push(`<${el.tagName.toLowerCase()} children=${el.children.length} font=${fontOf(el)}> ${t}`);
    }
    navigator.clipboard.writeText(lines.slice(0, 150).join("\n")).then(() => { dot.style.background = "#4f4"; setTimeout(() => (dot.style.background = "#3cc8ff"), 1500); });
  };
  dot.dataset.pufferDot = "1";
  document.documentElement.appendChild(dot);

  // Every short piece of text that appears on the page this round (answer bubbles, chat) is remembered,
  // so an answer still counts as used after its bubble disappears.
  let seen = new Set();
  const note = (text) => {
    const t = (text || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (t && t.length <= 40 && !(current && t.includes(current.toLowerCase()))) seen.add(t);
  };
  function noteTree(node) {
    if (node.nodeType === 3) return note(node.nodeValue);
    if (node.nodeType !== 1) return;
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) note(n.nodeValue);
  }
  function onScreenText() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) note(n.nodeValue);
  }
  const esc = (a) => a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isUsed = (a) => {
    const re = new RegExp(`(^|[^a-z])${esc(a)}(e?s)?([^a-z]|$)`);
    for (const t of seen) if (re.test(t)) return true;
    return false;
  };

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
    const left = all.filter((a) => !clicked.has(a) && !isUsed(a)).slice(0, 40);
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
    current = p; all = []; clicked = new Set(); seen = new Set();
    onScreenText();
    $("prompt").textContent = p;
    $("out").textContent = "thinking...";
    const res = await suggest(p, (part) => {
      if (p !== current) return;
      all = part.answers; topic = part.topic;
      render();
    }).catch((e) => ({ error: String(e.message || e) }));
    if (p !== current) return; // prompt changed while waiting
    if (res.error) return render(res.error);
    all = res.answers; topic = res.topic;
    render();
  }

  let timer;
  let last = 0;
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") note(m.target.nodeValue);
      else m.addedNodes.forEach(noteTree);
    }
    if (timer) return;
    timer = setTimeout(() => { timer = 0; last = Date.now(); refresh(); }, Math.max(300, 800 - (Date.now() - last)));
  })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  refresh();

  $("min").onclick = () => { const b = $("body"); b.style.display = b.style.display === "none" ? "" : "none"; };
})();

})();
