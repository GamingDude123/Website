// ==UserScript==
// @name         Unusual Suspects Auto Draw
// @namespace    https://github.com/gamingdude123
// @version      0.5.0
// @updateURL    https://raw.githubusercontent.com/gamingdude123/website/claude/wonderful-goodall-v4zskp/unusual-suspects-autodraw.user.js
// @downloadURL  https://raw.githubusercontent.com/gamingdude123/website/claude/wonderful-goodall-v4zskp/unusual-suspects-autodraw.user.js
// @description  Reads the suspect description on neal.fun/unusual-suspects and draws it part by part (colors, eyes, mouth, teeth, antenna, legs...).
// @match        https://neal.fun/unusual-suspects/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @connect      api.anthropic.com
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

  // Reads every witness, clicking Next between them, and returns the combined description.
  async function gatherWitnesses() {
    const seen = new Map();
    let last = null;
    const seenTexts = () => [...seen.values()];
    const unseen = () => visibleWitnesses().filter((w) => !seenTexts().includes(w.text));
    const addNew = async () => {
      let found = unseen();
      if (!found.length) return false;
      for (let k = 0; k < 12; k++) { // wait for the typing animation to finish
        await sleep(200);
        const again = unseen();
        if (again.map((w) => w.text).join('|') === found.map((w) => w.text).join('|')) break;
        found = again;
        if (!found.length) return false;
      }
      for (const w of found) { seen.set(w.n || seen.size + 1, w.text); last = w; }
      return found.length > 0;
    };
    await addNew();
    for (let i = 0; i < 4 && seen.size < 3 && last; i++) {
      const next = findNext(last.card);
      if (!next || next.disabled || /disabled/.test(next.className + (next.getAttribute('aria-disabled') || ''))) break;
      setStatus('Read witness ' + seen.size + '… clicking Next');
      clickEl(next);
      let ok = false;
      for (let k = 0; k < 20 && !ok; k++) { // wait up to ~3s for the next statement to appear
        await sleep(150);
        ok = await addNew();
      }
      if (!ok) break;
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
  function fillEllipse(cx, cy, rx, ry, c, gap = 0.014) {
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

  function composeProcedural(text) {
    const t = text.toLowerCase();
    const has = (re) => re.test(t);
    const out = [];

    const human = has(/\b(man|woman|guy|lady|girl|boy|person|human|gentleman|dude|grandma|grandpa|he's|she's)\b/) && !has(/\b(monster|frog|creature|alien|fella|beast|blob|dragon)\b/);
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
  const FILL_GAP = 0.011;

  const SYSTEM_PROMPT = `You are an expert sketch artist playing a police-sketch drawing game. The player reads up to three witness statements about a suspect and must draw the suspect so that an AI judge can recognise every described trait. You will be given the merged witness statements.

HOW TO WORK
1. Extract EVERY visual trait: what the suspect is (human, animal, monster, creature...), body shape and proportions (tall, thin, squat, round), head/face shape, eyes, nose, mouth, teeth, hair, ears, extra body parts (antennae, tails, wings, legs), the colour of each part, clothing, accessories (hat, glasses, shoes, jewellery), patterns (spots, stripes), expression, held objects. Statements are chatty, vague and sometimes disagree: keep what the witnesses agree on, drop non-visual chatter (questions, emotions about the case).
2. Draw the whole suspect, centred, filling 70-90% of the canvas, head to toe unless only a face is described. Exaggerate the distinguishing traits and make each one clearly visible (at least ~0.03 units across).
3. Use plenty of shapes (60-150) so there is real detail: layered body parts, shading blocks, eyebrows, pupils, nostrils, teeth one by one, buttons, patterns.

OUTPUT: ONLY one JSON object, no prose, no code fences:
{"traits":["short list of every trait you will draw"],"ops":[ ... ]}

CANVAS: unit square, x right 0..1, y down 0..1. Ops are drawn in order, so draw back-to-front (limbs, body, clothes, head, face, small details last) and make sure later shapes do not hide earlier details.

OPS (all coordinates 0..1)
- {"t":"ellipse","c":"green","cx":0.5,"cy":0.5,"rx":0.2,"ry":0.15,"rot":0}  filled + black outline (rot in degrees, optional)
- {"t":"poly","c":"red","pts":[[x,y],...],"closed":true}  filled polygon + outline; max 40 points; add "smooth":true to round the corners
- {"t":"line","c":"black","pts":[[x,y],...],"smooth":false}  an open stroke (mouth, brow, whisker, antenna, limb)
Optional on ellipse/poly: "fill":false (outline only), "outline":false (no outline), "oc":"brown" (outline colour).

COLOURS: you may only use these names: black, red, yellow, green, blue, purple, brown, pink, orange, white. Pick the closest one (light skin = pink, tan skin = orange, dark skin = brown, light grey = white with black outline, dark grey = black, gold = yellow). Colour matters a lot: match each part's colour to the statements exactly.`;

  function callClaude(key, model, system, messages) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: 'https://api.anthropic.com/v1/messages',
        timeout: 280000,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        data: JSON.stringify({ model, max_tokens: 16000, system, messages }),
        onload: (r) => {
          try {
            const body = JSON.parse(r.responseText);
            if (body.error) throw new Error(body.error.message);
            resolve(body.content.map((b) => b.text || '').join(''));
          } catch (e) { reject(e); }
        },
        onerror: () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timed out')),
      });
    });
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

  // Scanline hatching of a polygon, chained into zig-zags where possible.
  function hatchPolygon(poly, c, gap = FILL_GAP) {
    const ys = poly.map((p) => p[1]);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const strokes = [];
    let cur = null;
    const flush = () => { if (cur && cur.pts.length > 1) strokes.push(cur); cur = null; };
    for (let y = minY + gap / 2; y < maxY; y += gap) {
      const xs = [];
      for (let i = 0; i < poly.length; i++) {
        const [x0, y0] = poly[i];
        const [x1, y1] = poly[(i + 1) % poly.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + (y - y0) / (y1 - y0) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      const segs = [];
      for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 0.002) segs.push([xs[i], xs[i + 1]]);
      if (segs.length === 1) {
        const [a, b] = segs[0];
        if (cur) {
          const last = cur.pts[cur.pts.length - 1];
          const [first, second] = Math.abs(last[0] - a) <= Math.abs(last[0] - b) ? [a, b] : [b, a];
          cur.pts.push([first, y], [second, y]);
        } else cur = { c, pts: [[a, y], [b, y]] };
      } else {
        flush();
        for (const [a, b] of segs) strokes.push({ c, pts: [[a, y], [b, y]] });
      }
    }
    flush();
    return strokes;
  }

  function opsToStrokes(ops, gap = FILL_GAP) {
    const strokes = [];
    for (const op of ops) {
      const color = palColor(op.c);
      const outlineColor = palColor(op.oc || 'black');
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
      if (op.t === 'line') { strokes.push({ c: color, pts }); continue; }
      if (op.fill !== false && pts.length >= 3) strokes.push(...hatchPolygon(pts, color, gap));
      if (op.outline !== false) strokes.push({ c: outlineColor, pts: closed ? [...pts, pts[0]] : pts });
    }
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
    g.lineWidth = Math.max(1.5, S * 0.012);
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
    setStatus('Claude is planning the drawing…');
    const first = await callClaude(key, model, SYSTEM_PROMPT, [{ role: 'user', content: user }]);
    let ops = parseOps(first);
    let strokes = opsToStrokes(ops);
    showPreview(strokes);
    if (!refine || !drawing) return strokes;
    try {
      setStatus('Claude is checking its own drawing…');
      const shot = document.createElement('canvas');
      shot.width = shot.height = 512;
      renderStrokes(strokes, shot);
      const data = shot.toDataURL('image/png').split(',')[1];
      const second = await callClaude(key, model, SYSTEM_PROMPT, [
        { role: 'user', content: user },
        { role: 'assistant', content: first },
        { role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
          { type: 'text', text: 'This is how your ops render (fills are hatched, outlines black). Compare it against every trait in the witness statements. '
            + 'Find what is missing, too small, wrongly coloured, mis-proportioned or hidden by draw order, then reply with the COMPLETE corrected JSON object (same format, full ops list, not a diff). Add more detail where the drawing is plain.' },
        ] },
      ]);
      ops = parseOps(second);
      strokes = opsToStrokes(ops);
      showPreview(strokes);
    } catch (e) {
      setStatus('Self-check failed (' + e.message + '); using first drawing.');
      await sleep(800);
    }
    return strokes;
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
    for (const s of strokes) {
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
      await sleep(delay);
    }
    if (colorMiss) setStatus('Done (couldn\'t find some palette colours).');
  }

  async function run() {
    if (drawing) { drawing = false; return; }
    const text = document.querySelector('#usad-prompt').value.trim();
    if (!text) { setStatus('No prompt text.'); return; }
    const canvas = findCanvas();
    if (!canvas) { setStatus('Could not find a drawing canvas.'); return; }
    drawing = true;
    document.querySelector('#usad-go').textContent = 'Stop';
    try {
      let strokes = null;
      const key = document.querySelector('#usad-key').value.trim();
      if (key) {
        try {
          strokes = await planWithClaude(text, key, document.querySelector('#usad-model').value,
            document.querySelector('#usad-refine').checked);
        } catch (e) { setStatus('Claude failed (' + e.message + '), using built-in drawer…'); await sleep(800); }
      }
      if (!strokes) { strokes = composeProcedural(text); showPreview(strokes); }
      setStatus(`Drawing ${strokes.length} strokes…`);
      await drawStrokes(strokes, canvas);
      if (drawing && !/palette/.test(document.querySelector('#usad-status').textContent)) setStatus('Done.');
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
    const p = document.createElement('div');
    p.id = 'usad-panel';
    p.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483647;width:250px;padding:10px;'
      + 'background:#111c;color:#fff;font:13px sans-serif;border-radius:10px;backdrop-filter:blur(6px)';
    p.innerHTML = `
      <b>Auto Draw</b> <span style="opacity:.6">v0.5.0</span>
      <textarea id="usad-prompt" rows="4" style="width:100%;margin:6px 0;box-sizing:border-box" placeholder="Prompt (auto-detected or type it)"></textarea>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button id="usad-go" style="flex:1">Draw</button>
        <button id="usad-read" style="flex:1">Read now</button>
        <button id="usad-debug" style="flex:1" title="Copies page structure for troubleshooting">Debug</button>
        <button id="usad-pick" style="flex:1" title="Only needed if witnesses aren't detected">Pick text</button>
      </div>
      <label><input type="checkbox" id="usad-auto"> Draw automatically</label><br>
      <label>Delay <input type="range" id="usad-speed" min="0" max="30" value="3" style="width:130px"></label><br>
      <input id="usad-key" type="password" placeholder="Anthropic API key (detailed, accurate drawings)" style="width:100%;box-sizing:border-box;margin-top:4px">
      <div style="display:flex;gap:6px;margin-top:4px;align-items:center">
        <select id="usad-model" style="flex:1"><option value="claude-opus-5-5">Opus 5.5 (best)</option><option value="claude-sonnet-5-5">Sonnet 5.5 (faster)</option></select>
        <label title="Claude looks at its own drawing and fixes it"><input type="checkbox" id="usad-refine"> Refine</label>
      </div>
      <canvas id="usad-preview" width="240" height="240" style="display:none;width:100%;margin-top:6px;border-radius:6px;background:#fcf3e8"></canvas>
      <div id="usad-status" style="margin-top:6px;opacity:.8">Waiting for witness statements…</div>`;
    document.body.appendChild(p);
    p.querySelector('#usad-go').onclick = run;
    p.querySelector('#usad-pick').onclick = pickPrompt;
    p.querySelector('#usad-debug').onclick = debugDump;
    p.querySelector('#usad-read').onclick = () => { lastKey = null; lastPrompt = ''; gathering = false; autoDetect(); };
    const auto = p.querySelector('#usad-auto');
    auto.checked = store.get('auto', true);
    auto.onchange = () => store.set('auto', auto.checked);
    const key = p.querySelector('#usad-key');
    key.value = store.get('apiKey', '');
    key.onchange = () => store.set('apiKey', key.value.trim());
    const model = p.querySelector('#usad-model');
    model.value = store.get('model', 'claude-opus-5-5');
    model.onchange = () => store.set('model', model.value);
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
  if (typeof module !== 'undefined') module.exports = { composeProcedural, opsToStrokes, parseOps, renderStrokes, planWithClaude };
})();
