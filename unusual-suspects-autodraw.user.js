// ==UserScript==
// @name         Unusual Suspects Auto Draw
// @namespace    https://github.com/gamingdude123
// @version      1.4.0
// @updateURL    https://raw.githubusercontent.com/gamingdude123/website/claude/wonderful-goodall-v4zskp/unusual-suspects-autodraw.user.js
// @downloadURL  https://raw.githubusercontent.com/gamingdude123/website/claude/wonderful-goodall-v4zskp/unusual-suspects-autodraw.user.js
// @description  Reads the suspect description on neal.fun/unusual-suspects and draws it part by part (colors, eyes, mouth, teeth, antenna, legs...).
// @match        https://neal.fun/unusual-suspects/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @connect      api.anthropic.com
// @connect      generativelanguage.googleapis.com
// @connect      en.wikipedia.org
// @connect      upload.wikimedia.org
// ==/UserScript==

(function () {
  'use strict';

  let drawing = false;
  let lastPrompt = '';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = {
    get: (k, d) => { try { return GM_getValue(k, d); } catch (e) { return d; } },
    set: (k, v) => { try { GM_setValue(k, v); } catch (e) { /* ignore */ } },
  };

  // ======================================================================
  // Prompt detection
  // ======================================================================
  function selectorFor(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let part = el.tagName.toLowerCase();
      const cls = [...el.classList].filter((c) => !/^\d|\d{3,}/.test(c)).slice(0, 2);
      if (cls.length) part += '.' + cls.map(CSS.escape).join('.');
      const sibs = [...el.parentNode.children].filter((s) => s.tagName === el.tagName);
      if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(el) + 1})`;
      parts.unshift(part);
      el = el.parentNode;
      if (parts.length >= 4) break;
    }
    return parts.join(' > ');
  }

  function readPrompt() {
    const sel = store.get('promptSelector', '');
    if (!sel) return '';
    try {
      const el = document.querySelector(sel);
      return el ? el.innerText.trim() : '';
    } catch (e) { return ''; }
  }

  // ---- witness statements: "Witness #1/#2/#3" cards stepped through with "Next →" ----
  let gathering = false;
  let lastCount = 0;

  // Visible text with whitespace collapsed (templates pad elements with newlines/indentation).
  const norm = (el) => (el.textContent || '').replace(/[\s\u00a0\u200b]+/g, ' ').trim();

  function findWitnessLabels() {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const t = norm(el);
      if (t.length > 25 || el.closest('#usad-panel')) continue;
      const m = t.match(/^witness\s*#?\s*(\d+)$/i);
      if (m && !out.some((o) => o.el.contains(el) || el.contains(o.el))) out.push({ el, n: Number(m[1]) });
    }
    if (out.length) return out;
    // Fallback: anchor on the "Next →" button inside the witness card.
    const nexts = [...document.querySelectorAll('body *')].filter((el) => !el.closest('#usad-panel')
      && norm(el).length <= 12 && /^next\s*[→>›»]?$/i.test(norm(el)));
    return nexts.filter((e) => !nexts.some((o) => o !== e && e.contains(o))).map((el) => ({ el, n: 0 }));
  }

  function findWitnessLabel() { return findWitnessLabels()[0] || null; }

  // The statement lives in the nearest ancestor of the label that holds real text besides the label.
  function witnessCard(label) {
    let el = label.el.parentElement;
    while (el && el !== document.body) {
      const extra = el.innerText.replace(/witness\s*#?\s*\d+/i, '').replace(/next\s*[→>]?/i, '').trim();
      if (extra.length >= 5) return el;
      el = el.parentElement;
    }
    return null;
  }

  function witnessText(card) {
    return card.innerText.split('\n').map((l) => l.trim())
      .filter((l) => l && !/^witness\s*#?\s*\d+$/i.test(l) && !/^(next|back|prev|previous)\b/i.test(l))
      .join(' ');
  }

  // Innermost element whose text is "Next" (clicks bubble up to whatever handler the game attached).
  function findNext(card) {
    const scan = (root) => {
      const c = [...root.querySelectorAll('*')]
        .filter((e) => !e.closest('#usad-panel') && /^next\s*[→>›»]?$/i.test(norm(e)));
      return c.filter((e) => !c.some((o) => o !== e && e.contains(o)))[0];
    };
    return (card && scan(card)) || scan(document.body);
  }

  function caseKey() {
    const m = document.body.innerText.match(/case\s+\d+\s+of\s+\d+/i);
    return m ? m[0].toLowerCase() : '';
  }

  // neal.fun structure: #witness-box > .witness (.who = "Witness #N", .say = statement split into per-letter spans).
  // Hidden witnesses are display:none but their text is still in the DOM.
  function boxWitnesses() {
    const box = document.querySelector('#witness-box');
    if (!box) return [];
    return [...box.querySelectorAll('.witness')].map((card) => {
      const who = card.querySelector('.who');
      const m = who && norm(who).match(/(\d+)/);
      const say = card.querySelector('.say, .quote');
      const text = say ? norm(say).replace(/\s*next\s*[→>›»]?\s*$/i, '') : '';
      return { n: m ? Number(m[1]) : 0, text, card };
    }).filter((w) => w.text);
  }

  // Every witness card currently in the page (during a transition the old and new card can coexist).
  function visibleWitnesses() {
    const out = [];
    for (const w of boxWitnesses()) if (!out.some((o) => o.text === w.text)) out.push(w);
    if (out.length) return out;
    for (const label of findWitnessLabels()) {
      const card = witnessCard(label);
      if (!card) continue;
      const text = witnessText(card);
      if (text && !out.some((o) => o.text === text)) out.push({ n: label.n, text, card });
    }
    return out;
  }

  // Greyed-out Next = still typing, or last witness.
  function nextDisabled(el) {
    if (!el) return true;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return true;
    if (/disabled|inactive/i.test(el.className + ' ' + (el.parentElement ? el.parentElement.className : ''))) return true;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === 'none' || Number(cs.opacity) < 0.6) return true;
    const m = cs.color.match(/\d+/g);
    return !!m && Math.max(+m[0], +m[1], +m[2]) - Math.min(+m[0], +m[1], +m[2]) < 30 && +m[0] > 110; // grey text
  }

  // Resolves once getTexts() has stopped changing for `quiet` ms (the game types statements out letter by letter).
  async function settle(getTexts, quiet = 1100, max = 20000) {
    let prev = getTexts().join('|');
    let since = Date.now();
    const t0 = since;
    while (Date.now() - since < quiet && Date.now() - t0 < max) {
      await sleep(250);
      const cur = getTexts().join('|');
      if (cur !== prev) { prev = cur; since = Date.now(); }
    }
  }

  // Reads every witness, clicking Next between them, and returns the combined description.
  async function gatherWitnesses() {
    const seen = new Map();
    let last = null;
    const seenTexts = () => [...seen.values()];
    const unseen = () => visibleWitnesses().filter((w) => !seenTexts().includes(w.text));
    const addNew = async () => {
      if (!unseen().length) return false;
      setStatus('Waiting for the witness to finish talking…');
      await settle(() => unseen().map((w) => w.text));
      const found = unseen();
      for (const w of found) { seen.set(w.n || seen.size + 1, w.text); last = w; }
      return found.length > 0;
    };
    await addNew();
    for (let i = 0; i < 6 && last; i++) {
      let next = findNext(last.card);
      for (let k = 0; k < 10 && nextDisabled(next); k++) { await sleep(250); next = findNext(last.card); } // enabled once typing ends
      if (nextDisabled(next)) break; // still greyed after the text is done = last witness
      setStatus('Read witness ' + seen.size + '… clicking Next');
      clickEl(next);
      let ok = false;
      for (let k = 0; k < 20 && !ok; k++) { // up to ~3s for the next statement to appear
        await sleep(150);
        ok = unseen().length > 0;
      }
      if (!ok) break;
      await addNew();
    }
    lastCount = seen.size;
    return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t).join(' ');
  }

  let lastKey = null;
  async function autoDetect() {
    if (gathering || drawing) return;
    const ws = visibleWitnesses();
    if (!ws.length) { setStatus('No witness statements on screen yet.'); return; }
    const key = caseKey();
    const newSuspect = ws.some((w) => !lastPrompt.includes(w.text));
    if (key === lastKey && !newSuspect) return;
    gathering = true;
    try {
      setStatus('Reading witness statements…');
      const text = await gatherWitnesses();
      lastKey = key;
      if (text && text !== lastPrompt) {
        lastPrompt = text;
        document.querySelector('#usad-prompt').value = text;
        setStatus('Read ' + lastCount + ' witness statement(s)' + (lastCount < 3 ? ' — click Read now once all 3 are visible' : '') + '.');
        if (document.querySelector('#usad-auto').checked) { gathering = false; await run(); }
      }
    } finally {
      gathering = false;
    }
  }

  function pickPrompt() {
    setStatus('Click the prompt text on the page…');
    const onClick = (e) => {
      if (e.target.closest('#usad-panel')) return;
      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener('click', onClick, true);
      store.set('promptSelector', selectorFor(e.target));
      setStatus('Prompt element saved.');
      refreshPrompt(true);
    };
    document.addEventListener('click', onClick, true);
  }

  // ======================================================================
  // Canvas + palette
  // ======================================================================
  function findCanvas() {
    const pad = document.querySelector('#sketchpad');
    if (pad) return pad;
    const area = (c) => { const r = c.getBoundingClientRect(); return r.width * r.height; };
    const canvases = [...document.querySelectorAll('canvas')].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 100 && r.height > 100;
    });
    canvases.sort((a, b) => area(b) - area(a));
    return canvases[0] || null;
  }

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function findSwatches() {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('#usad-panel') || el.tagName === 'CANVAS') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.width > 90 || r.height < 10 || r.height > 90) continue;
      const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const [rr, g, b, a = 1] = m[1].split(',').map(Number);
      if (a < 1) continue;
      out.push({ el, rgb: [rr, g, b] });
    }
    return out;
  }

  function clickEl(el) {
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      const C = t.startsWith('pointer') ? PointerEvent : MouseEvent;
      el.dispatchEvent(new C(t, { bubbles: true, cancelable: true, composed: true, button: 0 }));
    }
    el.click();
  }

  function selectColor(hex, swatches) {
    if (!swatches.length) return false;
    const t = hexToRgb(hex);
    let best = null;
    let bestD = Infinity;
    for (const s of swatches) {
      const d = Math.hypot(s.rgb[0] - t[0], s.rgb[1] - t[1], s.rgb[2] - t[2]);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best && bestD < 140) { clickEl(best.el); return true; }
    return false;
  }

  // ======================================================================
  // Shape primitives. Everything lives in a unit square; a stroke is
  // { c: '#hex', pts: [[x, y], ...] }.
  // ======================================================================
  const COLORS = {
    green: '#2eb82e', red: '#e02020', blue: '#2a6fdb', yellow: '#f5d90a', orange: '#f08a1c',
    purple: '#8a2be2', pink: '#ff7eb6', brown: '#7a4a21', black: '#111111', gray: '#888888',
    grey: '#888888', white: '#ffffff', tan: '#d2b48c', gold: '#e6b800', teal: '#12a5a5',
    beige: '#d9c3a0', silver: '#bbbbbb',
  };
  const COLOR_RE = Object.keys(COLORS).join('|');
  const INK = '#111111';

  function ellipsePts(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 36) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  }

  // Zig-zag hatching inside an ellipse so the fill colour actually shows.
  function fillEllipse(cx, cy, rx, ry, c, gap = fillGap()) {
    const pts = [];
    let dir = 1;
    for (let y = cy - ry + gap; y < cy + ry; y += gap) {
      const k = Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)) * rx * 0.97;
      if (dir > 0) pts.push([cx - k, y], [cx + k, y]);
      else pts.push([cx + k, y], [cx - k, y]);
      dir = -dir;
    }
    return { c, pts };
  }

  const line = (c, ...pts) => ({ c, pts });
  const outline = (cx, cy, rx, ry, c = INK) => ({ c, pts: ellipsePts(cx, cy, rx, ry) });
  const blob = (cx, cy, rx, ry, c) => [fillEllipse(cx, cy, rx, ry, c), outline(cx, cy, rx, ry)];

  // ======================================================================
  // Description -> strokes
  // ======================================================================
  function colorBefore(t, nouns, fallback) {
    const m = t.match(new RegExp(`\\b(${COLOR_RE})\\b(?:\\s+\\w+){0,2}?\\s+(?:${nouns})`));
    return m ? COLORS[m[1]] : fallback;
  }

  function wordCount(t, word) {
    if (new RegExp(`\\b(one|single|a)\\s+(\\w+\\s+)?${word}\\b`).test(t) && !new RegExp(`\\b(two|three|four|many)\\b[^.]*${word}`).test(t)) return 1;
    if (new RegExp(`\\b(two|pair|both|2)\\b[^.]*${word}`).test(t)) return 2;
    if (new RegExp(`\\b(three|3)\\b[^.]*${word}`).test(t)) return 3;
    if (new RegExp(`\\b(four|4)\\b[^.]*${word}`).test(t)) return 4;
    if (new RegExp(`\\b(many|multiple|dozens|several)\\b[^.]*${word}`).test(t)) return 5;
    return 0;
  }

  // Full-figure person from a description, built from the same ops the AI planner uses.
  function composeHumanOps(text) {
    const t = text.toLowerCase();
    const has = (re) => re.test(t);
    const ops = [];
    const E = (c, cx, cy, rx, ry, o = {}) => ops.push({ t: 'ellipse', c, cx, cy, rx, ry, ...o });
    const P = (c, pts, o = {}) => ops.push({ t: 'poly', c, pts, ...o });
    const L = (c, pts, o = {}) => ops.push({ t: 'line', c, pts, ...o });

    const skinWord = (t.match(/\b(pale|fair|light|tan|tanned|dark|brown|black)[- ]skin/) || [])[1];
    const skin = { pale: '#fbe3d0', fair: '#fbe3d0', light: '#f8d9c0', tan: '#e0a878', tanned: '#e0a878', dark: '#8b5a3c', brown: '#8b5a3c', black: '#8b5a3c' }[skinWord] || '#f6c8a4';
    const shirtC = colorBefore(t, 'shirt|t-shirt|top|hoodie|sweater|jacket|coat|uniform|dress|vest|blouse|jersey|robe', '#888888');
    const shorts = has(/\b(shorts|skirt)\b/);
    const pantsC = colorBefore(t, 'shorts|pants|jeans|trousers|skirt|leggings|slacks', '#3b4a8a');
    const hairC = colorBefore(t, 'hair|mohawk|ponytail|curls|bangs|afro|bun|braids?', '#6b4423');
    const shoeC = colorBefore(t, 'shoes?|sneakers?|boots?|sandals?', '#2d2d2d');

    // legs, shoes
    for (const x of [0.44, 0.56]) {
      if (shorts) {
        E(skin, x, 0.84, 0.028, 0.07);
        P(pantsC, [[x - 0.05, 0.66], [x + 0.05, 0.66], [x + 0.045, 0.78], [x - 0.045, 0.78]]);
      } else {
        P(pantsC, [[x - 0.05, 0.66], [x + 0.05, 0.66], [x + 0.04, 0.9], [x - 0.04, 0.9]]);
      }
      E(shoeC, x + (x < 0.5 ? -0.01 : 0.01), 0.925, 0.055, 0.028);
    }
    // arms (sleeve, forearm, hand)
    for (const s of [-1, 1]) {
      E(shirtC, 0.5 + s * 0.15, 0.45, 0.036, 0.085, { rot: -s * 6 });
      E(skin, 0.5 + s * 0.165, 0.6, 0.028, 0.07, { rot: -s * 4 });
      E(skin, 0.5 + s * 0.17, 0.68, 0.03, 0.03);
    }
    if (has(/\b(backpack|bag|satchel)\b/)) P(colorBefore(t, 'backpack|bag|satchel', '#8b5a3c'), [[0.34, 0.4], [0.66, 0.4], [0.67, 0.64], [0.33, 0.64]], { smooth: true });
    // torso + shirt pattern
    P(shirtC, [[0.38, 0.36], [0.62, 0.36], [0.635, 0.68], [0.365, 0.68]]);
    if (has(/\bstripe/)) {
      const stripeC = colorBefore(t, 'stripes?|striped', shirtC === '#ffffff' ? '#2d2d2d' : '#ffffff');
      for (const y of [0.405, 0.475, 0.545, 0.615]) {
        const w = 0.012 * (y - 0.36) / 0.3;
        P(stripeC, [[0.38 - w - 0.002, y], [0.62 + w + 0.002, y], [0.622 + w, y + 0.03], [0.378 - w, y + 0.03]], { outline: false });
      }
    }
    if (has(/\b(belt)\b/)) P(colorBefore(t, 'belt', '#2d2d2d'), [[0.365, 0.655], [0.635, 0.655], [0.636, 0.68], [0.364, 0.68]]);
    if (has(/\b(tie|necktie)\b/)) P(colorBefore(t, 'tie|necktie', '#e5533d'), [[0.5, 0.37], [0.475, 0.41], [0.5, 0.58], [0.525, 0.41]]);
    if (has(/\b(scarf)\b/)) P(colorBefore(t, 'scarf', '#e5533d'), [[0.4, 0.34], [0.6, 0.34], [0.6, 0.4], [0.4, 0.4]], { smooth: true });
    if (has(/\b(badge|medal|ribbon|pin|brooch|star)\b/)) {
      const bc = colorBefore(t, 'ribbon|badge|medal|pin|brooch|star', '#f5c542');
      E(bc, 0.43, 0.46, 0.03, 0.03);
      if (has(/ribbon/)) P(bc, [[0.42, 0.48], [0.4, 0.55], [0.43, 0.53], [0.45, 0.56], [0.44, 0.48]]);
    }
    // neck
    P(skin, [[0.46, 0.3], [0.54, 0.3], [0.54, 0.37], [0.46, 0.37]]);

    // hair behind the head
    const longHair = has(/\b(long|flowing)\b[^.]*hair|hair[^.]*\b(long|flowing)\b|ponytail|braids?/);
    if (longHair) E(hairC, 0.5, 0.24, 0.17, 0.2);
    // head
    const tri = has(/triang|pointy head|cone[- ]shaped/);
    const box = has(/\b(square|boxy|blocky|rectang\w*)\b[^.]*(head|face|jaw)|(head|face|jaw)[^.]*\b(square|boxy|blocky)\b/);
    const tall = has(/\b(long|oval|oblong|elongated)\b[^.]*(face|head)/);
    let headTop = 0.07;
    if (tri) { P(skin, [[0.5, 0.03], [0.34, 0.35], [0.66, 0.35]]); headTop = 0.03; }
    else if (box) P(skin, [[0.37, 0.07], [0.63, 0.07], [0.63, 0.33], [0.37, 0.33]], { smooth: true });
    else if (tall) E(skin, 0.5, 0.2, 0.11, 0.17);
    else E(skin, 0.5, 0.2, 0.135, 0.145);
    if (has(/\bears?\b/) || !tri) for (const s of [-1, 1]) E(skin, 0.5 + s * (tri ? 0.12 : 0.14), 0.22, 0.02, 0.03);

    // hair on top
    if (!has(/\bbald\b/) && (has(/\bhair|mohawk|bangs|curls|afro|bun\b/) || true)) {
      if (has(/\b(spiky|spikes|spiked|mohawk|punk)\b/)) {
        const x0 = tri ? 0.42 : 0.37;
        const x1 = tri ? 0.58 : 0.63;
        const yb = tri ? 0.15 : 0.17;
        const pts = [[x0, yb]];
        for (let i = 0; i <= 6; i++) pts.push([x0 + i * (x1 - x0) / 6, i % 2 ? yb - 0.045 : Math.max(0.0, headTop - 0.05) + (i === 3 ? 0 : 0.025)]);
        pts.push([x1, yb]);
        P(hairC, pts);
      } else if (has(/\b(curly|curls|afro)\b/)) {
        for (let i = 0; i < 5; i++) E(hairC, 0.39 + i * 0.055, 0.09 + (i % 2 ? 0 : 0.015), 0.04, 0.04);
      } else if (has(/\bhair\b/) || longHair) {
        E(hairC, 0.5, 0.1, 0.14, 0.06);
      }
    }
    if (has(/\b(hat|cap|helmet|beanie|crown)\b/)) {
      const hc = colorBefore(t, 'hat|cap|helmet|beanie|crown', '#e5533d');
      E(hc, 0.5, 0.09, 0.15, 0.025);
      E(hc, 0.5, 0.055, 0.095, 0.05);
    }

    // face
    const eyeR = has(/\b(big|huge|large|round|bulging)\b[^.]*eyes?/) ? 0.035 : 0.025;
    const eyeY = tri ? 0.21 : 0.19;
    const gap = has(/\b(squished|close together|close-set)\b/) ? 0.045 : 0.07;
    for (const s of [-1, 1]) {
      E('white', 0.5 + s * gap, eyeY, eyeR, eyeR);
      E('black', 0.5 + s * gap + s * 0.004, eyeY + 0.004, eyeR * 0.45, eyeR * 0.45, { outline: false });
    }
    if (has(/glasses|spectacles|shades/)) {
      const dark = has(/sunglasses|shades/);
      for (const s of [-1, 1]) E('black', 0.5 + s * gap, eyeY, eyeR * 1.4, eyeR * 1.4, { fill: dark });
      L('black', [[0.5 - gap + eyeR * 1.4, eyeY], [0.5 + gap - eyeR * 1.4, eyeY]]);
    }
    if (has(/\b(freckles?)\b/)) for (const [x, y] of [[-0.05, 0.245], [-0.03, 0.255], [0.03, 0.255], [0.05, 0.245]]) E('brown', 0.5 + x, y, 0.007, 0.007, { outline: false });
    const bigNose = has(/\b(big|long|large|huge|pointy|pointed|hooked)\b[^.]*nose/);
    L('black', bigNose ? [[0.5, 0.2], [0.47, 0.275], [0.52, 0.275]] : [[0.5, 0.22], [0.485, 0.255], [0.515, 0.255]], { smooth: bigNose });
    if (has(/\b(frown|sad|angry|scowl)\b/)) L('black', [[0.45, 0.305], [0.5, 0.285], [0.55, 0.305]], { smooth: true });
    else if (has(/\b(teeth|grin|cheesy|toothy)\b/)) {
      P('white', [[0.44, 0.285], [0.56, 0.285], [0.54, 0.315], [0.46, 0.315]], { smooth: true });
    } else L('black', [[0.45, 0.285], [0.5, 0.31], [0.55, 0.285]], { smooth: true });
    if (has(/\b(mustache|moustache)\b/)) { E(hairC, 0.475, 0.272, 0.028, 0.012); E(hairC, 0.525, 0.272, 0.028, 0.012); }
    if (has(/\bbeard\b/)) P(hairC, [[0.4, 0.28], [0.5, 0.36], [0.6, 0.28], [0.57, 0.33], [0.5, 0.38], [0.43, 0.33]], { smooth: true });
    return ops;
  }

  function composeProcedural(text) {
    const t = text.toLowerCase();
    const has = (re) => re.test(t);
    const out = [];

    const human = has(/\b(man|woman|guy|lady|girl|boy|kid|child|teen\w*|person|human|gentleman|dude|grandma|grandpa|he's|she's|years? old|captain|officer|clerk|waiter|student|doctor|nurse|chef|pirate)\b/) && !has(/\b(monster|frog|creature|alien|fella|beast|blob|dragon|feline|cat|dog|bird|robot|ghost)\b/);
    if (human) return opsToStrokes(composeHumanOps(text));
    const firstColor = (t.match(new RegExp(`\\b(${COLOR_RE})\\b`)) || [])[1];
    const bodyColor = colorBefore(t, 'creature|monster|frog|fella|guy|man|woman|body|skin|blob|alien|beast|dragon|bird|cat|dog|bear|fellow|thing|coat|fur|suit|feline|rabbit|bunny|mouse|robot|ghost|fish|fox|wolf', null)
      || (human ? '#f1c27d' : (firstColor ? COLORS[firstColor] : '#6fbf73'));

    // body proportions
    let rx = 0.28;
    let ry = 0.24;
    let cy = 0.55;
    if (has(/\b(squat|short|stubby|small|little|tiny|stout)\b/)) { ry = 0.2; cy = 0.58; }
    if (has(/\b(tall|lanky|long|skinny|thin)\b/)) { ry = 0.32; rx = 0.19; cy = 0.5; }
    if (has(/\b(fat|chubby|round|plump|stocky|heavy)\b/)) { rx = 0.33; }
    if (human) { rx = 0.2; ry = 0.24; cy = 0.45; }
    const cx = 0.5;
    const top = cy - ry;
    const bot = cy + ry;

    // legs (drawn first so the body overlaps their tops)
    if (has(/\b(legs?|feet|foot|stubby|walks?|standing|shoes?|sneakers?|boots?)\b/) || !human) {
      const len = has(/\b(stubby|short|tiny|little)\b/) ? 0.07 : 0.15;
      const lc = colorBefore(t, 'legs?|feet', bodyColor);
      const sc = colorBefore(t, 'shoes?|sneakers?|boots?|socks?', lc);
      for (const s of [-1, 1]) {
        const x = cx + s * rx * 0.45;
        out.push(line(lc, [x, bot - 0.03], [x, bot + len]));
        out.push(...blob(x + s * 0.025, bot + len, 0.05, 0.025, sc));
      }
    }

    // arms
    if (has(/\b(arms?|hands?|claws?|fingers?)\b/)) {
      for (const s of [-1, 1]) {
        out.push(line(bodyColor, [cx + s * rx, cy], [cx + s * (rx + 0.1), cy + 0.08]));
        out.push(...blob(cx + s * (rx + 0.11), cy + 0.09, 0.03, 0.03, bodyColor));
      }
    }

    // wings, tail
    if (has(/\bwings?\b/)) {
      const wc = colorBefore(t, 'wings?', bodyColor);
      for (const s of [-1, 1]) out.push(...blob(cx + s * (rx + 0.08), cy - 0.05, 0.08, 0.14, wc));
    }
    if (has(/\btail\b/)) {
      out.push(line(bodyColor, [cx + rx, cy + ry * 0.5], [cx + rx + 0.1, cy + ry * 0.2], [cx + rx + 0.14, cy - 0.05]));
    }

    // body
    out.push(...blob(cx, cy, rx, ry, bodyColor));

    // spikes / horns / antennae / ears / hair (above the head)
    if (has(/\bantenna/)) {
      const ac = colorBefore(t, 'antennae?', bodyColor);
      const n = wordCount(t, 'antennae?') === 1 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const s = n === 1 ? 0 : (i ? 1 : -1);
        const x0 = cx + s * 0.07;
        const x1 = cx + s * 0.14 + (s === 0 ? 0.02 : 0);
        out.push(line(INK, [x0, top + 0.02], [x0 + (x1 - x0) / 2 - 0.02, top - 0.06], [x1, top - 0.12]));
        out.push(...blob(x1, top - 0.14, 0.025, 0.025, ac));
      }
    }
    if (has(/\bhorns?\b/)) {
      for (const s of [-1, 1]) {
        out.push(line(INK, [cx + s * 0.1, top + 0.02], [cx + s * 0.16, top - 0.12], [cx + s * 0.04, top - 0.01]));
      }
    }
    const catty = has(/\b(feline|cat|kitty|kitten|fox|wolf|bunny|rabbit)\b/);
    if (catty) {
      for (const s of [-1, 1]) {
        out.push(line(bodyColor, [cx + s * rx * 0.75, top + 0.04], [cx + s * rx * 0.8, top - 0.1], [cx + s * rx * 0.35, top - 0.01]));
        out.push(line(INK, [cx + s * rx * 0.75, top + 0.04], [cx + s * rx * 0.8, top - 0.1], [cx + s * rx * 0.35, top - 0.01]));
      }
    } else if (has(/\bears?\b/) && !human) {
      for (const s of [-1, 1]) out.push(...blob(cx + s * (rx * 0.85), top + 0.03, 0.05, 0.07, bodyColor));
    }
    if (has(/\b(spikes?|spiky|mohawk|spines?)\b/)) {
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push([cx - 0.15 + i * 0.05, top + (i % 2 ? -0.09 : 0.0)]);
      out.push(line(INK, ...pts));
    }
    if (has(/\bhair|bald|curly|wig|bangs\b/) && !has(/\bbald\b/)) {
      const hc = colorBefore(t, 'hair', '#4a2c14');
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push([cx - rx * 0.9 + i * (rx * 1.8 / 8), top + 0.02 - (i % 2 ? 0.07 : 0.015)]);
      out.push(line(hc, ...pts));
      out.push(line(hc, ...pts.map(([x, y]) => [x, y + 0.02])));
    }
    if (has(/\b(hat|cap|helmet|beanie|crown)\b/)) {
      const hc = colorBefore(t, 'hat|cap|helmet|beanie|crown', '#444444');
      out.push(...blob(cx, top - 0.02, 0.16, 0.05, hc));
      out.push(...blob(cx, top - 0.07, 0.09, 0.07, hc));
    }

    // eyes
    const eyeY = cy - ry * 0.35;
    let eyeCount = has(/\b(cyclops|one eye|single eye|an eye)\b/) ? 1 : (wordCount(t, 'eyes?') || 2);
    eyeCount = Math.min(eyeCount, 5);
    const eyeR = has(/\b(tiny|beady|small|little)\b[^.]*eyes?/) ? 0.03 : (has(/\b(big|huge|large|giant|googly|round|bulging)\b[^.]*eyes?|eyes?[^.]*\b(big|huge|large|giant|googly|bulging)\b/) ? 0.085 : 0.055);
    const spacing = has(/\b(squished|together|close|cross|crowded)\b/) ? eyeR * 2.05 : eyeR * 3.2;
    const ec = colorBefore(t, 'eyes?', '#ffffff');
    const eyes = [];
    for (let i = 0; i < eyeCount; i++) {
      const x = cx + (i - (eyeCount - 1) / 2) * spacing;
      eyes.push([x, eyeY - (eyeCount > 2 && i % 2 ? 0.05 : 0)]);
    }
    for (const [x, y] of eyes) {
      out.push(...blob(x, y, eyeR, eyeR, ec === '#ffffff' ? '#ffffff' : ec));
      out.push(fillEllipse(x, y + eyeR * 0.1, eyeR * 0.4, eyeR * 0.4, INK, 0.008));
    }
    if (has(/glasses|spectacles|monocle|shades/)) {
      const dark = has(/sunglasses|shades/);
      for (const [x, y] of eyes) {
        if (dark) out.push(fillEllipse(x, y, eyeR * 1.35, eyeR * 1.35, INK, 0.008));
        out.push(outline(x, y, eyeR * 1.35, eyeR * 1.35));
      }
      if (eyes.length > 1) out.push(line(INK, [eyes[0][0] + eyeR * 1.35, eyes[0][1]], [eyes[1][0] - eyeR * 1.35, eyes[1][1]]));
    }
    if (has(/\b(eyebrows?|brows?|angry|mean|grumpy)\b/)) {
      for (const [x, y] of eyes) out.push(line(INK, [x - eyeR, y - eyeR * 1.5 + (x < cx ? 0 : 0.03)], [x + eyeR, y - eyeR * 1.5 + (x < cx ? 0.03 : 0)]));
    }

    // nose
    if (has(/\b(nose|snout|beak)\b/)) {
      const nc = colorBefore(t, 'nose|snout|beak', INK);
      const nose = [[cx, eyeY + 0.06], [cx - 0.03, eyeY + 0.12], [cx + 0.03, eyeY + 0.12], [cx, eyeY + 0.06]];
      for (let k = 0; k < 4; k++) out.push(line(nc, [cx - 0.025 + k * 0.017, eyeY + 0.115], [cx, eyeY + 0.065 + k * 0.0]));
      out.push(line(INK, ...nose));
    }

    if (catty) {
      for (const s of [-1, 1]) for (const dy of [-0.02, 0.02]) out.push(line(INK, [cx + s * 0.04, eyeY + 0.12], [cx + s * 0.16, eyeY + 0.12 + dy * 3]));
    }

    // mouth
    const my = cy + ry * 0.28;
    let mw = rx * 0.45;
    if (has(/\b(wide|huge|big|enormous|giant|massive|gaping)\b[^.]*(mouth|grin|smile|jaw)|(mouth|grin|smile)[^.]*\b(wide|huge|enormous|giant|massive)\b/)) mw = rx * 0.85;
    if (has(/wider than/)) mw = rx * 0.97;
    const sad = has(/\b(frown|sad|angry|scowl|grumpy|mean)\b/);
    const curve = (sad ? -1 : 1) * (has(/\b(smile|grin|happy|smirk|friendly|sweet)\b/) || !sad ? 0.05 : 0.03);
    const hasTeeth = has(/\b(teeth|tooth|fangs?|tusks?|jagged|chompers|cheesy|toothy)\b/);
    const mouthTop = [];
    const mouthBot = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const x = cx - mw + u * mw * 2;
      const bow = Math.sin(u * Math.PI);
      mouthTop.push([x, my + bow * curve * 0.5]);
      mouthBot.push([x, my + bow * (curve * 0.5 + (hasTeeth || curve ? 0.06 : 0.0))]);
    }
    out.push(line(INK, ...mouthTop));
    if (hasTeeth) {
      out.push(line(INK, ...mouthBot));
      const sharp = has(/\b(sharp|pointy|pointed|jagged|fangs?|spiky)\b/);
      const nT = Math.max(5, Math.round(mw * 2 / 0.05));
      const teeth = [];
      for (let i = 0; i <= nT; i++) {
        const u = i / nT;
        const x = cx - mw + u * mw * 2;
        const baseY = my + Math.sin(u * Math.PI) * curve * 0.5;
        if (i === nT) { teeth.push([x, baseY]); break; }
        teeth.push([x, baseY], [x + (mw * 2 / nT) / 2, baseY + (sharp ? 0.045 : 0.03)]);
      }
      out.push(line('#ffffff', ...teeth));
      out.push(line(INK, ...teeth));
    } else {
      out.push(line(INK, ...mouthBot.map(([x, y]) => [x, y + 0.004])));
    }
    if (has(/\b(tongue)\b/)) out.push(...blob(cx, my + 0.07, 0.04, 0.03, '#ff6b81'));

    // facial hair
    if (has(/\b(mustache|moustache|stache)\b/)) {
      const mc = colorBefore(t, 'mustache|moustache|stache', '#3b2a1a');
      out.push(...blob(cx - 0.05, my - 0.04, 0.05, 0.02, mc), ...blob(cx + 0.05, my - 0.04, 0.05, 0.02, mc));
    }
    if (has(/\bbeard\b/)) {
      const bc = colorBefore(t, 'beard', '#3b2a1a');
      out.push(...blob(cx, my + 0.1, rx * 0.65, 0.09, bc));
    }

    // markings
    if (has(/\b(badge|medal|ribbon)\b/)) out.push(...blob(cx - rx * 0.35, cy + ry * 0.1, 0.03, 0.03, colorBefore(t, 'ribbon|badge|medal', '#e5533d')));
    if (has(/\b(spots?|spotted|dots?|polka)\b/)) {
      for (const [x, y] of [[-0.12, 0.08], [0.12, 0.1], [0.0, 0.14], [-0.2, 0.02], [0.2, 0.02]]) {
        out.push(...blob(cx + x * (rx / 0.28), cy + y, 0.025, 0.025, colorBefore(t, 'spots?|dots?', '#33693a')));
      }
    }
    if (has(/\bstripes?\b/)) {
      for (let i = -2; i <= 2; i++) out.push(line(INK, [cx + i * 0.07, cy + ry * 0.45], [cx + i * 0.07, cy + ry * 0.9]));
    }
    if (has(/\b(sweet tooth|candy|lollipop|cake|ice cream|cupcake|donut)\b/) && !hasTeeth) {
      out.push(...blob(cx + rx + 0.1, cy + 0.05, 0.05, 0.05, '#ff7eb6'));
      out.push(line(INK, [cx + rx + 0.1, cy + 0.1], [cx + rx + 0.1, cy + 0.22]));
    }
    return out;
  }

  // ======================================================================
  // Claude-planned drawings (needs an API key): shapes with fills, then a
  // second pass where Claude looks at its own render and corrects it.
  // ======================================================================
  const PAL = {
    black: '#2d2d2d', red: '#e5533d', yellow: '#f5c542', green: '#3aa655', blue: '#4a90e2',
    purple: '#8a63d2', brown: '#8b5a3c', pink: '#f77fb0', orange: '#f5922b', white: '#ffffff',
  };
  const palColor = (c) => PAL[String(c || 'black').toLowerCase()] || (/^#[0-9a-f]{6}$/i.test(c) ? c : PAL.black);
  const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
  // Brush thickness as a fraction of the drawing square. Measured from the game (see measureBrush) so fills cover solidly.
  let brushUnit = Number(store.get('brushUnit', 0.006)) || 0.006;
  const fillGap = () => Math.min(0.02, Math.max(0.003, brushUnit * 0.85));
  const deadModels = new Set(); // models that answered "quota 0" / "gone" this session

  const ID_PROMPT = `You identify the "suspect" in a police-sketch guessing game. Players read up to three witness statements about a suspect, which is almost always a famous character or personality (mascot, cartoon / anime / video-game character, celebrity, mythical creature, historical figure, brand icon) described vaguely, jokingly and with chatter. Work out who it most likely is from ALL the clues together.
Reply ONLY with JSON: {"identity":"the name","wikipedia_title":"exact English Wikipedia article title, or empty string","confidence":"high | medium | low","colors":"the character's iconic colours and look in one sentence","why":"max 25 words"}
Be honest: if you are not fairly sure, say low.`;

  function parseId(raw) {
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    const o = JSON.parse(raw.slice(a, b + 1));
    if (!o.identity) throw new Error('no identification in reply');
    return {
      identity: String(o.identity),
      wiki: o.wikipedia_title ? String(o.wikipedia_title) : '',
      confidence: String(o.confidence || ''),
      colors: o.colors ? String(o.colors) : '',
    };
  }

  // Worked examples (good proportions, layout and style) shown to the AI.
  const EX_MAN = JSON.stringify([{"t":"ellipse","c":"pink","cx":0.385,"cy":0.2,"rx":0.02,"ry":0.03},{"t":"ellipse","c":"pink","cx":0.615,"cy":0.2,"rx":0.02,"ry":0.03},{"t":"line","c":"blue","pts":[[0.44,0.6],[0.43,0.9]],"w":0.08},{"t":"line","c":"blue","pts":[[0.56,0.6],[0.57,0.9]],"w":0.08},{"t":"poly","c":"black","pts":[[0.37,0.9],[0.47,0.9],[0.48,0.95],[0.35,0.95]],"smooth":true},{"t":"poly","c":"black","pts":[[0.53,0.9],[0.63,0.9],[0.65,0.95],[0.52,0.95]],"smooth":true},{"t":"line","c":"pink","pts":[[0.31,0.4],[0.24,0.52],[0.27,0.63]],"smooth":true,"w":0.06},{"t":"line","c":"pink","pts":[[0.69,0.4],[0.76,0.52],[0.73,0.63]],"smooth":true,"w":0.06},{"t":"ellipse","c":"pink","cx":0.27,"cy":0.65,"rx":0.035,"ry":0.035},{"t":"ellipse","c":"pink","cx":0.73,"cy":0.65,"rx":0.035,"ry":0.035},{"t":"poly","c":"black","pts":[[0.3,0.34],[0.7,0.34],[0.65,0.5],[0.6,0.66],[0.4,0.66],[0.35,0.5]],"smooth":true},{"t":"line","c":"black","pts":[[0.31,0.38],[0.27,0.45]],"w":0.085},{"t":"line","c":"black","pts":[[0.69,0.38],[0.73,0.45]],"w":0.085},{"t":"poly","c":"pink","pts":[[0.46,0.28],[0.54,0.28],[0.54,0.35],[0.46,0.35]],"outline":false},{"t":"poly","c":"pink","pts":[[0.39,0.13],[0.61,0.13],[0.61,0.22],[0.56,0.3],[0.44,0.3],[0.39,0.22]],"smooth":true},{"t":"poly","c":"yellow","pts":[[0.4,0.15],[0.37,0.06],[0.44,0.02],[0.56,0.02],[0.63,0.06],[0.6,0.15],[0.5,0.1]],"smooth":true},{"t":"poly","c":"black","pts":[[0.41,0.17],[0.59,0.17],[0.58,0.215],[0.52,0.215],[0.5,0.19],[0.48,0.215],[0.42,0.215]]},{"t":"line","c":"black","pts":[[0.5,0.215],[0.49,0.25],[0.52,0.25]]},{"t":"line","c":"black","pts":[[0.45,0.275],[0.5,0.29],[0.56,0.27]],"smooth":true}]);
  const EX_TIGER = JSON.stringify([{"t":"line","c":"orange","pts":[[0.64,0.6],[0.82,0.64],[0.9,0.52],[0.86,0.36]],"smooth":true,"w":0.045},{"t":"poly","c":"orange","pts":[[0.4,0.62],[0.49,0.62],[0.48,0.9],[0.36,0.9]]},{"t":"poly","c":"orange","pts":[[0.51,0.62],[0.6,0.62],[0.64,0.9],[0.52,0.9]]},{"t":"ellipse","c":"orange","cx":0.41,"cy":0.925,"rx":0.085,"ry":0.035},{"t":"ellipse","c":"orange","cx":0.59,"cy":0.925,"rx":0.085,"ry":0.035},{"t":"line","c":"orange","pts":[[0.36,0.4],[0.27,0.5],[0.3,0.62]],"smooth":true,"w":0.055},{"t":"line","c":"orange","pts":[[0.64,0.4],[0.73,0.3],[0.71,0.17]],"smooth":true,"w":0.055},{"t":"ellipse","c":"orange","cx":0.3,"cy":0.64,"rx":0.04,"ry":0.035},{"t":"ellipse","c":"orange","cx":0.71,"cy":0.15,"rx":0.04,"ry":0.04},{"t":"poly","c":"orange","pts":[[0.36,0.33],[0.64,0.33],[0.69,0.5],[0.62,0.68],[0.38,0.68],[0.31,0.5]],"smooth":true},{"t":"ellipse","c":"white","cx":0.5,"cy":0.52,"rx":0.1,"ry":0.14},{"t":"poly","c":"black","pts":[[0.32,0.42],[0.4,0.45],[0.4,0.49],[0.32,0.47]],"outline":false},{"t":"poly","c":"black","pts":[[0.68,0.42],[0.6,0.45],[0.6,0.49],[0.68,0.47]],"outline":false},{"t":"poly","c":"red","pts":[[0.4,0.32],[0.6,0.32],[0.5,0.46]],"smooth":true},{"t":"ellipse","c":"orange","cx":0.37,"cy":0.09,"rx":0.045,"ry":0.045},{"t":"ellipse","c":"orange","cx":0.63,"cy":0.09,"rx":0.045,"ry":0.045},{"t":"ellipse","c":"orange","cx":0.5,"cy":0.2,"rx":0.15,"ry":0.13},{"t":"ellipse","c":"white","cx":0.5,"cy":0.255,"rx":0.095,"ry":0.06},{"t":"ellipse","c":"blue","cx":0.5,"cy":0.215,"rx":0.032,"ry":0.02},{"t":"ellipse","c":"white","cx":0.45,"cy":0.15,"rx":0.032,"ry":0.036},{"t":"ellipse","c":"white","cx":0.55,"cy":0.15,"rx":0.032,"ry":0.036},{"t":"ellipse","c":"black","cx":0.452,"cy":0.155,"rx":0.012,"ry":0.016},{"t":"ellipse","c":"black","cx":0.552,"cy":0.155,"rx":0.012,"ry":0.016},{"t":"line","c":"black","pts":[[0.41,0.265],[0.5,0.3],[0.59,0.265]],"smooth":true},{"t":"line","c":"black","pts":[[0.44,0.08],[0.46,0.11]],"w":0.015},{"t":"line","c":"black","pts":[[0.56,0.08],[0.54,0.11]],"w":0.015},{"t":"line","c":"black","pts":[[0.5,0.07],[0.5,0.11]],"w":0.015}]);

  const SYSTEM_PROMPT = `You are an expert cartoon sketch artist playing a police-sketch drawing game. The player reads up to three witness statements about a "suspect" and draws it; an AI judge then compares the sketch with a lineup of about 70 suspects, so your sketch must be INSTANTLY RECOGNISABLE as the right one.

KEY INSIGHT: suspects are almost always famous characters or personalities (mascots, cartoon / anime / video-game characters, celebrities, mythical creatures, historical figures, brand icons), described vaguely and often as a joke ("a man's body with black stripes over it"). Work out WHO it most likely is from all the clues together. If you recognise them, draw their ICONIC look (signature colours, costume, hair, props, silhouette, proportions) in addition to everything the witnesses said. If you are not sure, rely on the witness details only. Loose witness wording ("slime", "melting", "fluffy") must not override the character's known colours and shape: a recognised character keeps its real colours. Never write the name or any text on the drawing.

THINK FIRST, then answer:
1. Identify the suspect (best guess + confidence) and list its iconic visual traits.
2. List every trait the witnesses mention: what it is, body shape and proportions (tall, thin, squat), head/face, eyes, nose, mouth, teeth, hair, ears, extra parts (tail, wings, antennae), the colour of each part, clothes, accessories, patterns (stripes, spots), expression, held props. Statements are chatty and may disagree: keep what most agree on, drop non-visual chatter.
3. Plan the layout, then output the drawing.

OUTPUT: ONLY one JSON object, no prose, no code fences:
{"identity":"the character's name","wikipedia_title":"exact English Wikipedia article title of that character/person, or empty string if unsure","confidence":"high | medium | low","traits":["every trait you will draw"],"ops":[ ... ]}

CANVAS: unit square, x right 0..1, y down 0..1. Ops are drawn in order, so draw back-to-front (tail and far limbs, body, clothes, head, face, small details last) and make sure later shapes never hide earlier details by accident.

LAYOUT TEMPLATES (adapt to the character)
- Standing figure: head centre about (0.5, 0.2) with radius 0.12-0.15; shoulders y 0.33; torso y 0.33-0.65; arms start at the shoulders (y about 0.36) and hang to y 0.62; legs y 0.65-0.92; feet y 0.93. Stretch the torso and legs for tall or thin characters, shrink them for squat ones. Arms and legs must visibly attach to the body.
- Four-legged animal: body is a horizontal ellipse near (0.5, 0.55), head at one end, four legs below, tail behind.
- Face: eyes around the middle of the head, nose below them, mouth in the lower third INSIDE the head outline. Ears and hair belong on the head, never on the body. Never draw two heads or duplicate shapes.
- The figure should fill 80-95% of the canvas height. Show the whole body from head to feet unless only a face is described.

STYLE: bold, simplified, high-contrast cartoon. Big clear shapes beat tiny details. Use real silhouettes (polygons with "smooth":true) for hands, feet, ears, hair, tails, hats and clothes instead of plain ellipses. Patterns such as stripes or spots are separate filled shapes drawn ON TOP of the body fill with "outline":false and kept inside the body outline. Aim for 80-200 ops.

OPS (all coordinates 0..1)
- {"t":"ellipse","c":"orange","cx":0.5,"cy":0.5,"rx":0.2,"ry":0.15,"rot":0}  filled + black outline (rot in degrees, optional)
- {"t":"poly","c":"red","pts":[[x,y],...],"closed":true,"smooth":true}  filled polygon + outline; max 40 points; "smooth" rounds the corners
- {"t":"line","c":"black","pts":[[x,y],...],"smooth":true,"w":0.02}  an open stroke; "w" is its thickness (0.012 is a normal pen; use 0.02-0.05 for tails, limbs, scarves, antennae); for mouths and whiskers a thin line is fine
Optional on ellipse/poly: "fill":false (outline only), "outline":false (no outline), "oc":"brown" (outline colour).

EXAMPLES (they only show good proportions, layout and drawing style: draw the real suspect, never copy these)
Example 1, a generic standing man: ${EX_MAN}
Example 2, an upright animal with a tail: ${EX_TIGER}

COLOURS: only these names: black, red, yellow, green, blue, purple, brown, pink, orange, white. Pick the closest (light skin = pink, tan skin = orange, dark skin = brown, light grey = white with a black outline, dark grey = black, gold = yellow). Colour matters a lot: match each part's colour to the statements and to the character's iconic colours.`;

  // Turns are provider-neutral: { role: 'user' | 'assistant', text, image?: base64 png }.
  function httpJson(url, headers, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST', url, headers, timeout: 280000, data: JSON.stringify(body),
        onload: (r) => {
          try {
            if (r.status === 429 || r.status >= 500) {
              let msg = '';
              try { msg = (JSON.parse(r.responseText).error || {}).message || ''; } catch (e) { /* not JSON */ }
              throw new Error('HTTP ' + r.status + ' busy ' + msg);
            }
            const j = JSON.parse(r.responseText);
            if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
            resolve(j);
          } catch (e) { reject(e); }
        },
        onerror: () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timed out')),
      });
    });
  }

  // ---- Provider chain: every usable model of every key is tried in turn until one answers. ----
  let ROUND_DELAYS = [4000, 8000, 15000]; // pauses between full rounds when everything is busy
  const BUSY = /high demand|overload|unavailable|try again|busy|rate.?limit|resource.?exhausted|quota|\b429\b|\b503\b|\b529\b|temporar|timed out|network error/i;
  const KEY_BAD = /api key|api_key|invalid.*key|permission|unauthori[sz]ed|forbidden|\b40[13]\b|credit balance|billing/i;
  const MODEL_GONE = /no longer available|not found|not supported|deprecated|does not exist|\b404\b|unknown model/i;
  const splitKeys = (raw) => raw.split(/[\s,;]+/).filter(Boolean);
  const geminiListCache = new Map();

  // Names of the Gemini models this key may call (text + images), newest information from Google itself.
  function listGeminiModels(key) {
    if (geminiListCache.has(key)) return geminiListCache.get(key);
    const pr = new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET', timeout: 30000,
        url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(key),
        headers: { 'x-goog-api-key': key },
        onload: (r) => {
          try {
            resolve((JSON.parse(r.responseText).models || [])
              .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
              .map((m) => m.name.replace(/^models\//, ''))
              .filter((n) => /^gemini-/.test(n) && !/image|tts|live|embed|aqa|robotics|computer|audio|learnlm|customtools|vision/i.test(n)));
          } catch (e) { resolve([]); }
        },
        onerror: () => resolve([]),
        ontimeout: () => resolve([]),
      });
    });
    geminiListCache.set(key, pr);
    return pr;
  }

  // Preferred family first, then the others; newest versions first; "-latest" aliases lead each family.
  function rankGemini(names, preferPro) {
    const kind = (n) => (/lite/.test(n) ? 'lite' : /pro/.test(n) ? 'pro' : /flash/.test(n) ? 'flash' : 'other');
    const ver = (n) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]);
    const order = preferPro ? ['pro', 'flash', 'lite'] : ['flash', 'lite', 'pro'];
    const out = [];
    for (const k of order) {
      const fam = names.filter((n) => kind(n) === k)
        .sort((a, b) => (/latest/.test(b) - /latest/.test(a)) || (ver(b) - ver(a)) || (/preview|exp/.test(a) - /preview|exp/.test(b)));
      out.push(...fam.slice(0, 3));
    }
    return out;
  }

  async function buildCandidates(keysRaw, selected) {
    const cands = [];
    for (const key of splitKeys(keysRaw)) {
      if (/^sk-ant/.test(key)) {
        const model = selected.startsWith('claude') ? selected : 'claude-sonnet-5-5';
        cands.push({ key, provider: 'anthropic', model, id: key.slice(-6) + model });
      } else {
        let names = rankGemini(await listGeminiModels(key), /pro/.test(selected));
        if (!names.length) names = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'];
        for (const model of names) cands.push({ key, provider: 'gemini', model, id: key.slice(-6) + model });
      }
    }
    return cands;
  }

  async function callOne(c, system, turns) {
    if (c.provider === 'gemini') {
      const j = await httpJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${c.model}:generateContent?key=${encodeURIComponent(c.key)}`,
        { 'content-type': 'application/json', 'x-goog-api-key': c.key },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: turns.map((t) => ({
            role: t.role === 'assistant' ? 'model' : 'user',
            parts: [...t.images.map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })), { text: t.text }],
          })),
          generationConfig: { maxOutputTokens: 32000, temperature: 0.7, responseMimeType: 'application/json' },
        });
      const cand = (j.candidates || [])[0] || {};
      const text = ((cand.content || {}).parts || []).map((x) => x.text || '').join('');
      if (!text) throw new Error('empty reply (' + (cand.finishReason || (j.promptFeedback && j.promptFeedback.blockReason) || 'unknown') + ')');
      return text;
    }
    const j = await httpJson('https://api.anthropic.com/v1/messages',
      { 'content-type': 'application/json', 'x-api-key': c.key, 'anthropic-version': '2023-06-01' },
      {
        model: c.model, max_tokens: 16000, system,
        messages: turns.map((t) => ({
          role: t.role,
          content: t.images.length
            ? [...t.images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } })), { type: 'text', text: t.text }]
            : t.text,
        })),
      });
    return j.content.map((b) => b.text || '').join('');
  }

  // Tries every candidate; a busy/failed/garbled answer just moves on to the next model. Gives up only after several full rounds.
  async function callLLM(keysRaw, selected, system, turns, validate) {
    turns = turns.map((t) => ({ ...t, images: t.images || (t.image ? [{ data: t.image, mime: 'image/png' }] : []) }));
    const cands = await buildCandidates(keysRaw, selected);
    if (!cands.length) throw new Error('no API key');
    const dead = new Set();
    let lastErr = new Error('no model answered');
    for (let round = 0; ; round++) {
      let busy = false;
      for (const c of cands) {
        if (!drawing) throw new Error('stopped');
        if (dead.has(c.id) || deadModels.has(c.id)) continue;
        setStatus('Asking ' + c.model + (round ? ' (round ' + (round + 1) + ')' : '') + '…');
        try {
          const text = await callOne(c, system, turns);
          if (validate) validate(text);
          return text;
        } catch (e) {
          lastErr = e;
          if (KEY_BAD.test(e.message) && !BUSY.test(e.message)) { for (const d of cands) if (d.key === c.key) dead.add(d.id); }
          else if (MODEL_GONE.test(e.message) || /limit:\s*0\b/.test(e.message)) { dead.add(c.id); deadModels.add(c.id); }
          else if (BUSY.test(e.message)) { busy = true; setStatus(c.model + ' is busy — trying the next model…'); await sleep(700); }
        }
      }
      if (!busy || round >= ROUND_DELAYS.length) break;
      const wait = ROUND_DELAYS[round];
      setStatus('Every model is busy — retrying in ' + Math.round(wait / 1000) + 's (round ' + (round + 2) + '/' + (ROUND_DELAYS.length + 1) + ')…');
      await sleep(wait);
    }
    throw new Error(lastErr.message);
  }

  function parseOps(raw) {
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    let obj;
    if (a !== -1 && b > a) {
      try { obj = JSON.parse(raw.slice(a, b + 1)); } catch (e) { obj = null; }
    }
    if (!obj) {
      const i = raw.indexOf('[');
      const j = raw.lastIndexOf(']');
      obj = { ops: JSON.parse(raw.slice(i, j + 1)) };
    }
    const ops = (obj.ops || []).filter((o) => o && ['ellipse', 'poly', 'line'].includes(o.t));
    if (!ops.length) throw new Error('no drawing ops in reply');
    ops.identity = obj.identity ? String(obj.identity) : '';
    ops.wiki = obj.wikipedia_title ? String(obj.wikipedia_title) : '';
    ops.confidence = obj.confidence ? String(obj.confidence) : ((ops.identity.match(/\b(high|medium|low)\b/i) || [])[1] || '');
    return ops;
  }

  // Catmull-Rom smoothing for rounded polygons / curves.
  function smoothPts(pts, closed) {
    if (pts.length < 3) return pts;
    const P = closed ? pts : [pts[0], ...pts, pts[pts.length - 1]];
    const out = [];
    const n = closed ? P.length : P.length - 3;
    for (let i = 0; i < n; i++) {
      const p0 = P[(i + (closed ? P.length - 1 : 0)) % P.length];
      const p1 = P[(i + (closed ? 0 : 1)) % P.length];
      const p2 = P[(i + (closed ? 1 : 2)) % P.length];
      const p3 = P[(i + (closed ? 2 : 3)) % P.length];
      for (let k = 0; k < 8; k++) {
        const t = k / 8;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push([0, 1].map((d) => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t
          + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2
          + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    if (!closed) out.push(pts[pts.length - 1]);
    return out;
  }

  // ---- geometry helpers (hidden-surface removal: never paint where a later shape will cover) ----
  const bboxOf = (pts) => {
    let x0 = 1; let y0 = 1; let x1 = 0; let y1 = 0;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return [x0, y0, x1, y1];
  };
  const bbOverlap = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

  function inPoly(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // x-intervals covered by a polygon along the horizontal line y
  function scanSpans(poly, y) {
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % poly.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
    return out;
  }

  function subtractSpans(spans, cuts) {
    if (!cuts.length) return spans;
    const sorted = cuts.slice().sort((p, q) => p[0] - q[0]);
    const out = [];
    for (const [a, b] of spans) {
      let cur = a;
      for (const [c0, c1] of sorted) {
        if (c1 <= cur) continue;
        if (c0 >= b) break;
        if (c0 > cur) out.push([cur, c0]);
        cur = Math.max(cur, c1);
        if (cur >= b) break;
      }
      if (cur < b) out.push([cur, b]);
    }
    return out;
  }

  // Pieces of a polyline that lie outside every occluder.
  function clipPolyline(pts, occ, closed) {
    const src = closed ? [...pts, pts[0]] : pts;
    if (!occ.length) return [src];
    const dense = densify(src, 0.004);
    const runs = [];
    let cur = [];
    for (const p of dense) {
      let hidden = false;
      for (const o of occ) {
        if (p[0] < o.bb[0] || p[0] > o.bb[2] || p[1] < o.bb[1] || p[1] > o.bb[3]) continue;
        if (inPoly(o.pts, p[0], p[1])) { hidden = true; break; }
      }
      if (hidden) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push(p);
    }
    if (cur.length > 1) runs.push(cur);
    return runs;
  }

  // Scanline hatching of a polygon, minus the areas later shapes will cover, chained into zig-zags where possible.
  function hatchPolygon(poly, c, gap = fillGap(), occ = []) {
    const [, minY, , maxY] = bboxOf(poly);
    const inset = brushUnit * 0.4;
    const strokes = [];
    let cur = null;
    const flush = () => { if (cur && cur.pts.length > 1) strokes.push(cur); cur = null; };
    for (let y = minY + gap / 2; y < maxY; y += gap) {
      let segs = scanSpans(poly, y).filter(([a, b]) => b - a > 0.002);
      if (occ.length) {
        const cuts = [];
        for (const o of occ) {
          if (y < o.bb[1] || y > o.bb[3]) continue;
          for (const [a, b] of scanSpans(o.pts, y)) if (b - a > inset * 2) cuts.push([a + inset, b - inset]);
        }
        segs = subtractSpans(segs, cuts).filter(([a, b]) => b - a > 0.002);
      }
      if (segs.length === 1) {
        const [a, b] = segs[0];
        const last = cur && cur.pts[cur.pts.length - 1];
        const [first, second] = last && Math.abs(last[0] - a) <= Math.abs(last[0] - b) ? [a, b] : [b, a];
        if (last && Math.abs(last[0] - first) < gap * 3 && Math.abs(last[1] - y) < gap * 1.5) cur.pts.push([first, y], [second, y]);
        else { flush(); cur = { c, pts: [[a, y], [b, y]] }; }
      } else {
        flush();
        for (const [a, b] of segs) strokes.push({ c, pts: [[a, y], [b, y]] });
      }
    }
    flush();
    return strokes;
  }

  // A line wider than the brush becomes several parallel passes, offset along the line's normal.
  function thickLine(pts, c, w) {
    const step = brushUnit * 0.85;
    const spread = Math.max(0, w - brushUnit);
    const k = Math.max(2, Math.ceil(spread / step) + 1);
    const out = [];
    for (let i = 0; i < k; i++) {
      const off = -spread / 2 + (spread * i) / (k - 1);
      out.push({
        c,
        pts: pts.map((p, j) => {
          const a = pts[Math.max(0, j - 1)];
          const b = pts[Math.min(pts.length - 1, j + 1)];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          return [clamp01(p[0] - ((b[1] - a[1]) / len) * off), clamp01(p[1] + ((b[0] - a[0]) / len) * off)];
        }),
      });
    }
    return out;
  }

  function opsToStrokes(ops, gap = fillGap(), occlude = true) {
    const shapes = [];
    for (const op of ops) {
      let pts;
      let closed = true;
      if (op.t === 'ellipse') {
        const rot = (Number(op.rot) || 0) * Math.PI / 180;
        pts = ellipsePts(0, 0, Number(op.rx) || 0.02, Number(op.ry) || 0.02, 0, Math.PI * 2, 40).map(([x, y]) => [
          clamp01((Number(op.cx) || 0.5) + x * Math.cos(rot) - y * Math.sin(rot)),
          clamp01((Number(op.cy) || 0.5) + x * Math.sin(rot) + y * Math.cos(rot)),
        ]);
      } else {
        if (!Array.isArray(op.pts) || op.pts.length < 2) continue;
        pts = op.pts.map(([x, y]) => [clamp01(x), clamp01(y)]);
        closed = op.t === 'poly' && op.closed !== false;
        if (op.smooth) pts = smoothPts(pts, closed);
      }
      const isLine = op.t === 'line';
      shapes.push({
        op, pts, closed, isLine, bb: bboxOf(pts),
        color: palColor(op.c), outlineColor: palColor(op.oc || 'black'),
        filled: !isLine && op.fill !== false && pts.length >= 3,
        outlined: !isLine && op.outline !== false,
      });
    }
    const strokes = [];
    shapes.forEach((sh, i) => {
      // later filled shapes hide what is under them, so skip painting there (the game's brush is slightly see-through)
      const occ = occlude ? shapes.slice(i + 1).filter((o) => o.filled && (sh.isLine || bbOverlap(o.bb, sh.bb))) : [];
      if (sh.isLine) {
        const w = Number(sh.op.w) || 0;
        const lines = w > brushUnit * 1.6 ? thickLine(sh.pts, sh.color, Math.min(w, 0.08)) : [{ c: sh.color, pts: sh.pts }];
        for (const l of lines) for (const run of clipPolyline(l.pts, occ, false)) strokes.push({ c: l.c, pts: run });
        return;
      }
      if (sh.filled) strokes.push(...hatchPolygon(sh.pts, sh.color, gap, occ));
      if (sh.outlined) for (const run of clipPolyline(sh.pts, occ, sh.closed)) strokes.push({ c: sh.outlineColor, pts: run });
    });
    return strokes;
  }

  // What the game will roughly show; used for the panel preview and for Claude's self-check.
  function renderStrokes(strokes, canvas) {
    const g = canvas.getContext('2d');
    const S = canvas.width;
    g.fillStyle = '#fcf3e8';
    g.fillRect(0, 0, S, S);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(1.2, S * brushUnit);
    for (const st of strokes) {
      g.strokeStyle = st.c;
      g.beginPath();
      st.pts.forEach(([x, y], i) => (i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)));
      g.stroke();
    }
  }

  function showPreview(strokes) {
    const cv = document.querySelector('#usad-preview');
    if (!cv) return;
    cv.style.display = 'block';
    renderStrokes(strokes, cv);
  }

  async function planWithClaude(text, key, model, refine) {
    const user = 'Witness statements:\n' + text;
    const useRef = document.querySelector('#usad-trace').checked;
    let hint = null;
    let ref = null;
    if (!useRef) note('picture tracing is off');
    if (useRef) {
      // Step 1: a short call just to work out who the suspect is
      setStatus('Working out who the suspect is…');
      hint = parseId(await callLLM(key, model, ID_PROMPT, [{ role: 'user', text: user }], parseId));
      setStatus('Suspect: ' + hint.identity + ' (' + (hint.confidence || '?') + ' confidence)');
      note('suspect: ' + hint.identity + ' (' + (hint.confidence || '?') + ')');
      if (/^(high|medium)/i.test(hint.confidence) && drawing) {
        ref = await getReference(hint);
        if (ref && referenceIsIllustration(ref.bmp)) {
          note('picture: ' + ref.title + ' → traced');
          // clean character art: trace it directly, no drawing call needed
          return Object.assign([], { reference: ref.bmp, referenceTitle: ref.title, identity: hint.identity, wiki: hint.wiki, confidence: hint.confidence });
        }
      }
      if (ref) note('picture: ' + ref.title + ' is a photo → used as AI reference');
      if (!/^(high|medium)/i.test(hint.confidence)) { note('not sure who it is → drawing from the description'); hint = null; }
    }
    // Step 2: the AI plans the drawing (guided by the reference photo when there is one)
    let userMsg = user;
    if (hint) {
      userMsg += '\n\nIdentification (already worked out): ' + hint.identity + ' (' + hint.confidence + ' confidence). Its look: ' + hint.colors
        + (ref ? '\nA reference picture of ' + ref.title + ' is attached. Match its real shapes, proportions and colours, simplified into a bold cartoon sketch.' : '');
    }
    const refImg = ref ? bitmapToImage(ref.bmp) : null;
    setStatus('Planning the drawing…');
    const first = await callLLM(key, model, SYSTEM_PROMPT, [{ role: 'user', text: userMsg, images: refImg ? [refImg] : [] }], parseOps);
    let ops = parseOps(first);
    if (hint) { ops.identity = ops.identity || hint.identity; ops.wiki = ops.wiki || hint.wiki; ops.confidence = ops.confidence || hint.confidence; }
    showPreview(opsToStrokes(ops));
    if (!refine || !drawing) return ops;
    try {
      setStatus('Checking its own drawing…');
      const shot = document.createElement('canvas');
      shot.width = shot.height = 512;
      renderStrokes(opsToStrokes(ops), shot);
      const mine = { data: shot.toDataURL('image/png').split(',')[1], mime: 'image/png' };
      const second = await callLLM(key, model, SYSTEM_PROMPT, [
        { role: 'user', text: userMsg, images: refImg ? [refImg] : [] },
        { role: 'assistant', text: first },
        { role: 'user', images: refImg ? [mine, refImg] : [mine], text: (refImg ? 'The first picture is how your ops render (fills are hatched, outlines black); the second is the reference picture. ' : 'This is how your ops render (fills are hatched, outlines black). ')
          + 'Review it critically against the witness statements AND the character you identified: '
          + '(1) would it be instantly recognisable as that character' + (refImg ? ' (compare it with the reference)' : '') + '? (2) are the proportions and layout right: head size, tall enough body, limbs attached, face features inside the head, mouth in the lower face? '
          + '(3) is every witness trait visible, large enough and the right colour? (4) remove duplicate or overlapping shapes that make a mess, and add the iconic details that are missing. '
          + 'Reply with the COMPLETE corrected JSON object (same format, full ops list, not a diff).' },
      ], parseOps);
      const better = parseOps(second);
      better.identity = better.identity || ops.identity;
      better.wiki = better.wiki || ops.wiki;
      better.confidence = better.confidence || ops.confidence;
      ops = better;
      showPreview(opsToStrokes(ops));
    } catch (e) {
      setStatus('Self-check failed (' + e.message + '); using first drawing.');
      await sleep(800);
    }
    return ops;
  }

  // ======================================================================
  // Reference tracing: once the character is recognised, fetch its Wikipedia picture and trace it
  // into the game's colours (row by row, like a printer).
  // ======================================================================
  function gmGet(url, responseType = 'text') {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, responseType, timeout: 45000,
        onload: (r) => (r.status >= 200 && r.status < 300 ? resolve(r) : reject(new Error('HTTP ' + r.status))),
        onerror: () => reject(new Error('network error (allow the connection in Tampermonkey if it asks)')),
        ontimeout: () => reject(new Error('timed out')),
      });
    });
  }

  // Tampermonkey's request first; if it is blocked (permission denied), try a normal CORS fetch from the page.
  async function httpGet(url, type = 'text') {
    try { return await gmGet(url, type); } catch (e) {
      try {
        const r = await fetch(/api\.php/.test(url) ? url + '&origin=*' : url, { mode: 'cors', credentials: 'omit' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return type === 'arraybuffer' ? { response: await r.arrayBuffer() } : { responseText: await r.text() };
      } catch (e2) { throw e; }
    }
  }

  // Main picture of the first Wikipedia article that has one: exact title first, then a search.
  async function findReferenceImage(titles) {
    const pick = (j, byRank) => {
      const pages = Object.values((j.query || {}).pages || {});
      if (byRank) pages.sort((a, b) => (a.index || 0) - (b.index || 0));
      const hit = pages.find((pg) => pg.thumbnail && pg.thumbnail.source);
      return hit ? { url: hit.thumbnail.source, title: hit.title } : null;
    };
    const base = 'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=900';
    for (const t of titles.filter(Boolean)) {
      try {
        let hit = pick(JSON.parse((await httpGet(base + '&redirects=1&titles=' + encodeURIComponent(t))).responseText), false);
        if (hit) return hit;
        hit = pick(JSON.parse((await httpGet(base + '&generator=search&gsrlimit=3&gsrsearch=' + encodeURIComponent(t))).responseText), true);
        if (hit) return hit;
      } catch (e) {
        if (/network error/.test(e.message)) throw e; // permission / connectivity problem: no point trying more titles
      }
    }
    return null;
  }

  async function getReference(hint) {
    const name = (hint.wiki || hint.identity || '').trim();
    if (!name) return null;
    try {
      setStatus('Looking up a picture of ' + name + '…');
      const hit = await findReferenceImage([hint.wiki, (hint.identity || '').split(/[,(—–]/)[0].trim()]);
      if (!hit) { note('no Wikipedia picture for "' + name + '"'); setStatus('No Wikipedia picture found for ' + name + ' — drawing from the description.'); await sleep(900); return null; }
      setStatus('Downloading the picture of ' + hit.title + '…');
      const r = await httpGet(hit.url, 'arraybuffer');
      return { bmp: await createImageBitmap(new Blob([r.response])), title: hit.title };
    } catch (e) {
      note('picture lookup failed: ' + e.message);
      setStatus('Picture lookup failed (' + e.message + ') — drawing from the description.');
      await sleep(1200);
      return null;
    }
  }

  function srgbToLab(r, g, b) {
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const R = lin(r); const G = lin(g); const B = lin(b);
    const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    const fx = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
    const fy = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
    const fz = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  // Background = transparent cells plus the colour connected to the picture border.
  function floodBackground(px, cols, rows, tol = 40) {
    const N = cols * rows;
    const bg = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (px[i * 4 + 3] < 40) bg[i] = 1;
    const border = [];
    for (let x = 0; x < cols; x++) border.push(x, (rows - 1) * cols + x);
    for (let y = 0; y < rows; y++) border.push(y * cols, y * cols + cols - 1);
    const ref = [0, 1, 2].map((c) => {
      const v = border.filter((i) => px[i * 4 + 3] >= 40).map((i) => px[i * 4 + c]).sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : 255;
    });
    const near = (i) => Math.hypot(px[i * 4] - ref[0], px[i * 4 + 1] - ref[1], px[i * 4 + 2] - ref[2]) < tol;
    const stack = border.filter((i) => near(i) && !bg[i]);
    stack.forEach((i) => { bg[i] = 1; });
    while (stack.length) {
      const i = stack.pop();
      const x = i % cols;
      const y = (i - x) / cols;
      for (const j of [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, y > 0 ? i - cols : -1, y < rows - 1 ? i + cols : -1]) {
        if (j >= 0 && !bg[j] && near(j)) { bg[j] = 1; stack.push(j); }
      }
    }
    let count = 0;
    for (let i = 0; i < N; i++) count += bg[i];
    return { bg, count };
  }

  // Clean character art on a plain background traces well; busy photographs do not.
  function referenceIsIllustration(bmp) {
    const sc = 80 / Math.max(bmp.width, bmp.height);
    const w = Math.max(8, Math.round(bmp.width * sc));
    const h = Math.max(8, Math.round(bmp.height * sc));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, w, h);
    const { count } = floodBackground(g.getImageData(0, 0, w, h).data, w, h, 14); // strict: only a truly uniform backdrop counts
    return count / (w * h) >= 0.2;
  }

  // JPEG for sending a reference picture to the AI (transparent areas become white).
  function bitmapToImage(bmp, max = 768) {
    const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
    const g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(bmp, 0, 0, cv.width, cv.height);
    return { data: cv.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' };
  }

  // Turns a picture into strokes: background removed, every cell snapped to the nearest palette colour,
  // runs of equal colour drawn as horizontal strokes, one swatch at a time.
  function traceToStrokes(bmp) {
    const iw = bmp.width;
    const ih = bmp.height;
    const sc = 0.96 / Math.max(iw, ih);
    const dw = iw * sc;
    const dh = ih * sc;
    const names = Object.keys(PAL);
    const palLab = names.map((n) => srgbToLab(...hexToRgb(PAL[n])));
    const WHITE = names.indexOf('white');
    const BLACK = names.indexOf('black');

    let cell = Math.max(fillGap(), Math.max(dw, dh) / 200);
    for (let attempt = 0; attempt < 4; attempt++) {
      const cols = Math.max(8, Math.round(dw / cell));
      const rows = Math.max(8, Math.round(dh / cell));
      // downscale in halving steps so thin lines are not lost to aliasing
      let cv = document.createElement('canvas');
      cv.width = iw; cv.height = ih;
      let g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      while (cv.width / 2 >= cols && cv.height / 2 >= rows) {
        const n = document.createElement('canvas');
        n.width = Math.ceil(cv.width / 2); n.height = Math.ceil(cv.height / 2);
        const ng = n.getContext('2d', { willReadFrequently: true });
        ng.imageSmoothingQuality = 'high';
        ng.drawImage(cv, 0, 0, n.width, n.height);
        cv = n; g = ng;
      }
      const fin = document.createElement('canvas');
      fin.width = cols; fin.height = rows;
      const fg = fin.getContext('2d', { willReadFrequently: true });
      fg.imageSmoothingQuality = 'high';
      fg.drawImage(cv, 0, 0, cols, rows);
      const px = fg.getImageData(0, 0, cols, rows).data;
      const N = cols * rows;

      const flood = floodBackground(px, cols, rows);
      const bg = flood.bg;
      if (flood.count > N * 0.97) bg.fill(0); // the "background" swallowed the subject: keep everything

      // snap every cell to the nearest palette colour (-1 = leave blank paper)
      const q = new Int8Array(N).fill(-1);
      for (let i = 0; i < N; i++) {
        if (bg[i]) continue;
        const lab = srgbToLab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
        let best = 0; let bd = Infinity;
        for (let k = 0; k < names.length; k++) {
          const d = (lab[0] - palLab[k][0]) ** 2 + (lab[1] - palLab[k][1]) ** 2 + (lab[2] - palLab[k][2]) ** 2;
          if (d < bd) { bd = d; best = k; }
        }
        q[i] = best === WHITE ? -1 : best;
      }
      // majority filter: edge anti-aliasing leaves stray fringe colours; snap a cell to its neighbourhood's majority
      {
        const next = q.slice();
        const cnt = new Int16Array(names.length + 1);
        for (let y = 1; y < rows - 1; y++) {
          for (let x = 1; x < cols - 1; x++) {
            const i = y * cols + x;
            if (q[i] === BLACK) continue; // keep thin dark outlines
            cnt.fill(0);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cnt[q[i + dy * cols + dx] + 1]++;
            let best = q[i] + 1;
            for (let k = 0; k < cnt.length; k++) if (cnt[k] > cnt[best]) best = k;
            if (cnt[best] >= 5 && best - 1 !== BLACK) next[i] = best - 1;
          }
        }
        q.set(next);
      }
      // remove isolated speckles (a cell whose 8 neighbours all agree on another colour)
      for (let pass = 0; pass < 2; pass++) {
        const next = q.slice();
        for (let y = 1; y < rows - 1; y++) {
          for (let x = 1; x < cols - 1; x++) {
            const i = y * cols + x;
            const v = q[i - 1];
            if (v === q[i]) continue;
            if (q[i + 1] === v && q[i - cols] === v && q[i + cols] === v && q[i - cols - 1] === v && q[i - cols + 1] === v && q[i + cols - 1] === v && q[i + cols + 1] === v) next[i] = v;
          }
        }
        q.set(next);
      }

      // runs -> strokes, grouped per colour (largest area first, black last so outlines end up on top)
      const ox = (1 - cols * cell) / 2;
      const oy = (1 - rows * cell) / 2;
      const passes = Math.max(1, Math.ceil(cell / (brushUnit * 0.9)));
      const groups = new Map();
      let total = 0;
      for (let y = 0; y < rows; y++) {
        let x = 0;
        while (x < cols) {
          const id = q[y * cols + x];
          if (id < 0) { x++; continue; }
          let x1 = x;
          while (x1 + 1 < cols && q[y * cols + x1 + 1] === id) x1++;
          let a = ox + x * cell + brushUnit / 2;
          let b = ox + (x1 + 1) * cell - brushUnit / 2;
          if (b <= a) { const m = (a + b) / 2; a = m - 0.0004; b = m + 0.0004; }
          if (!groups.has(id)) groups.set(id, []);
          for (let k = 0; k < passes; k++) {
            const yy = oy + (y + (k + 0.5) / passes) * cell;
            groups.get(id).push({ c: PAL[names[id]], pts: [[a, yy], [b, yy]] });
            total++;
          }
          x = x1 + 1;
        }
      }
      if (total > 6000 && attempt < 3) { cell *= 1.35; continue; } // too many strokes: trace more coarsely
      const order = [...groups.keys()].sort((m, n) => (m === BLACK) - (n === BLACK) || groups.get(n).length - groups.get(m).length);
      return order.flatMap((id) => groups.get(id));
    }
    return [];
  }

  // ======================================================================
  // Drawing
  // ======================================================================
  function fire(canvas, type, x, y, buttons) {
    const init = {
      bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y,
      screenX: x, screenY: y, buttons, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    };
    canvas.dispatchEvent(new PointerEvent('pointer' + type, init));
    canvas.dispatchEvent(new MouseEvent('mouse' + type, init));
  }

  // Add points along long segments so the game sees a smooth line.
  function densify(pts, maxStep = 0.012) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / maxStep));
      for (let k = 1; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
    }
    return out;
  }

  async function drawStrokes(strokes, canvas) {
    const r = canvas.getBoundingClientRect();
    const side = Math.min(r.width, r.height) * 0.9;
    const ox = r.left + (r.width - side) / 2;
    const oy = r.top + (r.height - side) / 2;
    const delay = Number(document.querySelector('#usad-speed').value);
    const swatches = findSwatches();
    let current = null;
    let colorMiss = false;
    const every = strokes.length > 800 ? 8 : 1; // with thousands of tiny strokes, pause less often
    for (let si = 0; si < strokes.length; si++) {
      const s = strokes[si];
      if (!drawing) return;
      if (s.c && s.c !== current) {
        if (!selectColor(s.c, swatches)) colorMiss = true;
        current = s.c;
        await sleep(30);
      }
      const pts = densify(s.pts).map(([x, y]) => [ox + x * side, oy + y * side]);
      fire(canvas, 'down', pts[0][0], pts[0][1], 1);
      for (let i = 1; i < pts.length; i++) {
        fire(canvas, 'move', pts[i][0], pts[i][1], 1);
        if (i % 6 === 0) await sleep(delay);
      }
      fire(canvas, 'up', pts[pts.length - 1][0], pts[pts.length - 1][1], 0);
      if (si % every === 0) await sleep(delay);
    }
    if (colorMiss) setStatus('Done (couldn\'t find some palette colours).');
  }

  function findClearButton() {
    const sels = ['#btn-clear', '#btn-trash', '#btn-delete', '#btn-reset', 'button[aria-label*="clear" i]', 'button[title*="clear" i]',
      'button[aria-label*="trash" i]', 'button[title*="trash" i]', 'button[aria-label*="delete" i]', 'button[title*="delete" i]'];
    for (const sel of sels) { const el = document.querySelector(sel); if (el && !el.closest('#usad-panel')) return el; }
    // Fallback: the leftmost button of the bottom-left toolbar (the trash can).
    const bs = [...document.querySelectorAll('button')].filter((b) => {
      if (b.closest('#usad-panel')) return false;
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.top > innerHeight * 0.75 && r.left < innerWidth * 0.4;
    });
    bs.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    return bs[0] || null;
  }

  async function clearCanvas() {
    const btn = findClearButton();
    if (!btn) return;
    setStatus('Clearing the canvas…');
    clickEl(btn);
    await sleep(350);
    const confirm = [...document.querySelectorAll('button')].find((b) => b !== btn && !b.closest('#usad-panel')
      && /^(yes|ok|confirm|clear( all)?|delete|erase)\b/i.test(norm(b)));
    if (confirm) { clickEl(confirm); await sleep(250); }
  }

  // Draws a short test stroke in the game (on a freshly cleared canvas) and measures how thick it came out,
  // so hatch fills can be spaced to cover solidly. The caller clears the canvas again afterwards.
  async function measureBrush(canvas) {
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const r = canvas.getBoundingClientRect();
      const side = Math.min(r.width, r.height) * 0.9;
      const scale = canvas.width / r.width;
      const x = r.left + r.width / 2;
      const y0 = r.top + r.height / 2 - 30;
      fire(canvas, 'down', x, y0, 1);
      for (let i = 1; i <= 12; i++) fire(canvas, 'move', x, y0 + i * 5, 1);
      fire(canvas, 'up', x, y0 + 60, 0);
      await sleep(200);
      const cx = Math.round((x - r.left) * scale);
      const x0 = Math.max(0, cx - 40);
      const n = Math.min(80, canvas.width - x0);
      const row = ctx.getImageData(x0, Math.round((y0 + 30 - r.top) * scale), n, 1).data;
      const d = (i) => Math.abs(row[i * 4] - row[0]) + Math.abs(row[i * 4 + 1] - row[1]) + Math.abs(row[i * 4 + 2] - row[2]) + Math.abs(row[i * 4 + 3] - row[3]);
      let maxd = 0;
      for (let i = 1; i < n; i++) maxd = Math.max(maxd, d(i));
      if (maxd < 60) return; // nothing was drawn
      let width = 0;
      for (let i = 1; i < n; i++) width += Math.min(1, d(i) / maxd);
      const css = width / scale;
      if (css < 0.8 || css > 80) return;
      brushUnit = Math.min(0.03, Math.max(0.002, css / side));
      store.set('brushUnit', brushUnit);
    } catch (e) { /* keep the previous estimate */ }
  }

  async function run(forceBasic = false) {
    if (drawing) { drawing = false; return; }
    const text = document.querySelector('#usad-prompt').value.trim();
    if (!text) { setStatus('No prompt text.'); return; }
    const canvas = findCanvas();
    if (!canvas) { setStatus('Could not find a drawing canvas.'); return; }
    drawing = true;
    clearNotes();
    document.querySelector('#usad-go').textContent = 'Stop';
    try {
      let strokes = null;
      let ops = null;
      const key = document.querySelector('#usad-key').value.trim();
      if (key && !forceBasic) {
        try {
          ops = await planWithClaude(text, key, document.querySelector('#usad-model').value,
            document.querySelector('#usad-refine').checked);
        } catch (e) {
          setStatus('AI FAILED: ' + e.message + ' — nothing drawn. Click Draw to retry, or Basic for the keyword drawer.');
          return;
        }
      }
      const clear = document.querySelector('#usad-clear').checked;
      if (ops) {
        if (clear && drawing) { await clearCanvas(); await measureBrush(canvas); } // the clear below removes the test stroke
        strokes = ops.reference ? traceToStrokes(ops.reference) : opsToStrokes(ops);
        showPreview(strokes);
      } else { strokes = composeProcedural(text); showPreview(strokes); }
      if (clear) await clearCanvas();
      setStatus(`Drawing ${strokes.length} strokes…` + (ops && ops.reference ? ' Tracing the picture of ' + ops.referenceTitle + '.' : ops && ops.identity ? ' Looks like: ' + ops.identity : ''));
      await drawStrokes(strokes, canvas);
      if (drawing && forceBasic && key) setStatus('Done — drew with the BASIC drawer (no AI).');
      else if (drawing && !key) setStatus('Done — BASIC drawer only (no API key). Add a free Gemini API key (or an Anthropic key) above for detailed drawings.');
      else if (drawing) setStatus('Done.' + (ops && ops.reference ? ' Traced: ' + ops.referenceTitle : ops && ops.identity ? ' Guess: ' + ops.identity : ''));
      if (!drawing) setStatus('Stopped.');
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally {
      drawing = false;
      document.querySelector('#usad-go').textContent = 'Draw';
    }
  }

  // ======================================================================
  // UI
  // ======================================================================
  function debugDump() {
    const hits = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('#usad-panel') || el.children.length > 2 || el.textContent.length > 120) continue;
      if (/witness|\bnext\b|case\s+\d+/i.test(el.textContent)) {
        let up = el;
        for (let i = 0; i < 3 && up.parentElement && up.parentElement !== document.body; i++) up = up.parentElement;
        hits.push(up.outerHTML.slice(0, 1800));
      }
    }
    const out = hits.slice(0, 4).join('\n---\n') || 'no elements mention witness/next/case';
    document.querySelector('#usad-prompt').value = out;
    try { GM_setClipboard(out); } catch (e) { /* ignore */ }
    setStatus('Debug HTML copied (and placed in the box above).');
  }

  // Short facts about how the last drawing was made (suspect, picture used or why not); they stay on screen.
  const notes = [];
  function note(msg) {
    if (msg) notes.push(msg);
    const el = document.querySelector('#usad-note');
    if (el) el.textContent = notes.join(' · ');
  }
  function clearNotes() { notes.length = 0; note(''); }

  function setStatus(t) {
    const el = document.querySelector('#usad-status');
    if (el) el.textContent = t;
  }

  function refreshPrompt(force) {
    const text = readPrompt();
    if (!text || (text === lastPrompt && !force)) return;
    lastPrompt = text;
    document.querySelector('#usad-prompt').value = text;
    if (document.querySelector('#usad-auto').checked && !drawing) run();
  }

  function buildPanel() {
    const css = document.createElement('style');
    css.textContent = `
      #usad-panel{position:fixed;right:8px;top:8px;z-index:2147483647;width:178px;padding:5px 7px 6px;background:#111d;color:#fff;font:11px/1.3 system-ui,sans-serif;border-radius:8px;backdrop-filter:blur(6px);box-shadow:0 2px 10px #0006}
      #usad-panel *{box-sizing:border-box}
      #usad-panel button{font:11px system-ui,sans-serif;padding:2px 5px;border-radius:5px;border:1px solid #555;background:#2b2b2b;color:#fff;cursor:pointer}
      #usad-panel button:hover{background:#3b3b3b}
      #usad-panel input[type=password],#usad-panel select,#usad-panel textarea{font:11px system-ui,sans-serif;width:100%;margin:2px 0;background:#1c1c1c;color:#fff;border:1px solid #555;border-radius:4px;padding:2px 4px}
      #usad-panel label{display:flex;align-items:center;gap:4px;margin:1px 0;cursor:pointer}
      #usad-panel input[type=checkbox]{margin:0;width:12px;height:12px}
      #usad-bar{display:flex;align-items:center;gap:4px}
      #usad-bar .t{font-weight:600}
      #usad-bar .v{opacity:.5;font-size:10px}
      #usad-bar .g{flex:1}
      #usad-bar button{padding:0 5px;line-height:15px}
      #usad-row{display:flex;gap:4px;margin:4px 0 3px}
      #usad-row button{flex:1}
      #usad-status{opacity:.9;max-height:4.2em;overflow:auto;word-break:break-word}
      #usad-note{opacity:.55;font-size:10px;max-height:3.9em;overflow:auto;word-break:break-word}
      #usad-more{display:none;margin-top:5px;padding-top:5px;border-top:1px solid #444}
      #usad-row2{display:flex;gap:4px;margin-top:4px}
      #usad-row2 button{flex:1}
      #usad-preview{display:none;width:100%;margin-top:4px;border-radius:5px;background:#fcf3e8}
    `;
    document.head.appendChild(css);
    const p = document.createElement('div');
    p.id = 'usad-panel';
    p.innerHTML = `
      <div id="usad-bar"><span class="t">Auto Draw</span><span class="v">v1.4.0</span><span class="g"></span>
        <button id="usad-gear" title="Settings">⚙</button><button id="usad-min" title="Minimise">–</button></div>
      <div id="usad-body">
        <div id="usad-row">
          <button id="usad-go">Draw</button>
          <button id="usad-read" title="Re-read the witness statements">Read</button>
          <button id="usad-basic" title="Draw with the built-in keyword drawer (no AI)">Basic</button>
        </div>
        <div id="usad-status">Waiting for witness statements…</div>
        <div id="usad-note"></div>
        <div id="usad-more">
          <textarea id="usad-prompt" rows="3" placeholder="Witness text (auto-filled, or type it)"></textarea>
          <label><input type="checkbox" id="usad-auto"> Draw automatically</label>
          <label><input type="checkbox" id="usad-clear"> Clear canvas first</label>
          <label title="When the character is recognised, fetch its Wikipedia picture and trace it in the game's colours"><input type="checkbox" id="usad-trace"> Trace the real picture</label>
          <label title="The AI looks at its own drawing and fixes it"><input type="checkbox" id="usad-refine"> AI self-check</label>
          <label>Delay <input type="range" id="usad-speed" min="0" max="30" value="3" style="flex:1;min-width:0"></label>
          <input id="usad-key" type="password" placeholder="API key(s), comma-separated">
          <select id="usad-model"><option value="gemini-pro-latest">Gemini Pro (best)</option><option value="gemini-flash-latest">Gemini Flash (fast)</option><option value="claude-opus-5-5">Claude Opus 5.5</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5</option></select>
          <canvas id="usad-preview" width="240" height="240"></canvas>
          <div id="usad-row2"><button id="usad-debug" title="Copies page structure for troubleshooting">Debug</button><button id="usad-pick" title="Only needed if witnesses aren't detected">Pick text</button></div>
        </div>
      </div>`;
    document.body.appendChild(p);

    // minimise / settings state (settings start open until an API key has been entered)
    const ui = Object.assign({ min: false, more: false }, store.get('ui', {}) || {});
    let more = ui.more || !store.get('apiKey', '');
    const apply = () => {
      p.querySelector('#usad-body').style.display = ui.min ? 'none' : '';
      p.querySelector('#usad-more').style.display = more ? 'block' : 'none';
      p.querySelector('#usad-min').textContent = ui.min ? '+' : '–';
      p.querySelector('#usad-gear').style.display = ui.min ? 'none' : '';
    };
    p.querySelector('#usad-gear').onclick = () => { more = !more; ui.more = more; store.set('ui', ui); apply(); };
    p.querySelector('#usad-min').onclick = () => { ui.min = !ui.min; store.set('ui', ui); apply(); };
    apply();

    p.querySelector('#usad-go').onclick = () => run();
    p.querySelector('#usad-basic').onclick = () => run(true);
    p.querySelector('#usad-pick').onclick = pickPrompt;
    p.querySelector('#usad-debug').onclick = debugDump;
    p.querySelector('#usad-read').onclick = () => { lastKey = null; lastPrompt = ''; gathering = false; autoDetect(); };
    const auto = p.querySelector('#usad-auto');
    auto.checked = store.get('auto', true);
    auto.onchange = () => store.set('auto', auto.checked);
    const key = p.querySelector('#usad-key');
    key.value = store.get('apiKey', '');
    const flagKey = () => { key.style.outline = key.value.trim() ? '' : '2px solid #f5c542'; };
    key.onchange = () => { store.set('apiKey', key.value.trim()); flagKey(); };
    key.oninput = flagKey;
    flagKey();
    const model = p.querySelector('#usad-model');
    const saved = store.get('model', 'gemini-pro-latest').replace('gemini-2.5-flash', 'gemini-flash-latest').replace('gemini-2.5-pro', 'gemini-pro-latest');
    model.value = saved;
    if (model.value !== saved) model.value = 'gemini-pro-latest';
    model.onchange = () => store.set('model', model.value);
    const trc = p.querySelector('#usad-trace');
    trc.checked = store.get('trace', true);
    trc.onchange = () => store.set('trace', trc.checked);
    const clr = p.querySelector('#usad-clear');
    clr.checked = store.get('clear', true);
    clr.onchange = () => store.set('clear', clr.checked);
    const refine = p.querySelector('#usad-refine');
    refine.checked = store.get('refine', true);
    refine.onchange = () => store.set('refine', refine.checked);
  }

  function init() {
    buildPanel();
    // Witness cards are found automatically; the picked selector is only a fallback.
    setInterval(() => {
      if (visibleWitnesses().length) autoDetect();
      else if (!store.get('promptSelector', '')) setStatus('Looking for witness statements…');
      else if (store.get('promptSelector', '')) refreshPrompt(false);
    }, 800);
  }

  if (document.body) init();
  else window.addEventListener('DOMContentLoaded', init);

  // Exposed for testing outside the browser.
  if (typeof module !== 'undefined') module.exports = { composeProcedural, opsToStrokes, parseOps, renderStrokes, planWithClaude, traceToStrokes, setRetryDelays: (a) => { ROUND_DELAYS = a; } };
})();
