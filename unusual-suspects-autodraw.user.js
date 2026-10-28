// ==UserScript==
// @name         Unusual Suspects Auto Draw
// @namespace    https://github.com/gamingdude123
// @version      0.1.0
// @description  Detects the prompt on neal.fun/unusual-suspects and draws a matching picture on the canvas.
// @match        https://neal.fun/unusual-suspects/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      cdn.jsdelivr.net
// ==/UserScript==

(function () {
  'use strict';

  const EMOJI_DB = 'https://cdn.jsdelivr.net/npm/emojibase-data@15.3.2/en/data.json';
  const SIZE = 200; // resolution the emoji is rasterised at before tracing

  let emojiDb = null;
  let drawing = false;
  let lastPrompt = '';

  // ---------- helpers ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = {
    get: (k, d) => { try { return GM_getValue(k, d); } catch (e) { return d; } },
    set: (k, v) => { try { GM_setValue(k, v); } catch (e) { /* ignore */ } },
  };

  function loadEmojiDb() {
    if (emojiDb) return Promise.resolve(emojiDb);
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: EMOJI_DB,
        onload: (r) => {
          try { emojiDb = JSON.parse(r.responseText); resolve(emojiDb); } catch (e) { reject(e); }
        },
        onerror: reject,
      });
    });
  }

  // ---------- prompt detection ----------
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

  // ---------- canvas ----------
  function findCanvas() {
    const canvases = [...document.querySelectorAll('canvas')].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 100 && r.height > 100;
    });
    canvases.sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height
      - a.getBoundingClientRect().width * a.getBoundingClientRect().height);
    return canvases[0] || null;
  }

  // ---------- prompt -> emoji ----------
  const STOP = new Set('a an the of and with in on at to for is it his her their my your draw someone something person'.split(' '));

  function pickEmoji(text, db) {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
      .filter((w) => w && !STOP.has(w));
    let best = null;
    let bestScore = 0;
    for (const e of db) {
      if (e.group === 2) continue; // skin-tone components
      const label = (e.label || '').toLowerCase();
      const tags = (e.tags || []).map((t) => t.toLowerCase());
      let score = 0;
      for (const w of words) {
        const stem = w.replace(/(es|s)$/, '');
        if (label === w || label === stem) score += 5;
        else if (label.split(/\s+/).some((l) => l === w || l === stem)) score += 3;
        if (tags.includes(w) || tags.includes(stem)) score += 2;
      }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  // ---------- emoji -> strokes ----------
  function emojiToStrokes(emoji) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff';
    g.fillRect(0, 0, SIZE, SIZE);
    g.font = `${SIZE * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, SIZE / 2, SIZE / 2 + SIZE * 0.05);
    const { data } = g.getImageData(0, 0, SIZE, SIZE);
    const lum = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < lum.length; i++) {
      lum[i] = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];
    }
    // Sobel edge detection
    const edge = new Uint8Array(SIZE * SIZE);
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const i = y * SIZE + x;
        const gx = -lum[i - SIZE - 1] - 2 * lum[i - 1] - lum[i + SIZE - 1]
          + lum[i - SIZE + 1] + 2 * lum[i + 1] + lum[i + SIZE + 1];
        const gy = -lum[i - SIZE - 1] - 2 * lum[i - SIZE] - lum[i - SIZE + 1]
          + lum[i + SIZE - 1] + 2 * lum[i + SIZE] + lum[i + SIZE + 1];
        if (Math.hypot(gx, gy) > 120) edge[i] = 1;
      }
    }
    // Chain edge pixels into strokes (greedy neighbour walk)
    const strokes = [];
    const nb = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!edge[y * SIZE + x]) continue;
        const pts = [];
        let cx = x, cy = y;
        for (;;) {
          edge[cy * SIZE + cx] = 0;
          pts.push([cx / SIZE, cy / SIZE]);
          let moved = false;
          for (const [dx, dy] of nb) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && edge[ny * SIZE + nx]) {
              cx = nx; cy = ny; moved = true; break;
            }
          }
          if (!moved) break;
        }
        if (pts.length > 6) strokes.push(pts);
      }
    }
    return strokes;
  }

  // ---------- drawing ----------
  function fire(canvas, type, x, y, buttons) {
    const init = {
      bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y,
      screenX: x, screenY: y, buttons, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    };
    canvas.dispatchEvent(new PointerEvent('pointer' + type, init));
    canvas.dispatchEvent(new MouseEvent('mouse' + type, init));
  }

  async function drawStrokes(strokes, canvas) {
    const r = canvas.getBoundingClientRect();
    const side = Math.min(r.width, r.height) * 0.85;
    const ox = r.left + (r.width - side) / 2;
    const oy = r.top + (r.height - side) / 2;
    const delay = Number(document.querySelector('#usad-speed').value);
    const step = 2; // skip points to speed things up
    for (const s of strokes) {
      if (!drawing) return;
      const p = (pt) => [ox + pt[0] * side, oy + pt[1] * side];
      let [x, y] = p(s[0]);
      fire(canvas, 'down', x, y, 1);
      for (let i = step; i < s.length; i += step) {
        [x, y] = p(s[i]);
        fire(canvas, 'move', x, y, 1);
        if (i % (step * 8) === 0) await sleep(delay);
      }
      fire(canvas, 'up', x, y, 0);
      await sleep(delay);
    }
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
      setStatus('Looking up a picture…');
      const db = await loadEmojiDb();
      const hit = pickEmoji(text, db);
      if (!hit) { setStatus('No matching picture for "' + text + '".'); return; }
      setStatus(`Drawing ${hit.emoji} (${hit.label})…`);
      const strokes = emojiToStrokes(hit.emoji);
      await drawStrokes(strokes, canvas);
      setStatus(drawing ? 'Done.' : 'Stopped.');
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally {
      drawing = false;
      document.querySelector('#usad-go').textContent = 'Draw';
    }
  }

  // ---------- UI ----------
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
    p.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;width:240px;padding:10px;'
      + 'background:#111c;color:#fff;font:13px sans-serif;border-radius:10px;backdrop-filter:blur(6px)';
    p.innerHTML = `
      <b>Auto Draw</b>
      <textarea id="usad-prompt" rows="2" style="width:100%;margin:6px 0;box-sizing:border-box" placeholder="Prompt (auto-detected or type it)"></textarea>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button id="usad-go" style="flex:1">Draw</button>
        <button id="usad-pick" style="flex:1">Pick prompt</button>
      </div>
      <label><input type="checkbox" id="usad-auto"> Draw automatically</label><br>
      <label>Delay <input type="range" id="usad-speed" min="0" max="30" value="4" style="width:130px"></label>
      <div id="usad-status" style="margin-top:6px;opacity:.8">Click “Pick prompt”, then the prompt text.</div>`;
    document.body.appendChild(p);
    p.querySelector('#usad-go').onclick = run;
    p.querySelector('#usad-pick').onclick = pickPrompt;
    const auto = p.querySelector('#usad-auto');
    auto.checked = store.get('auto', false);
    auto.onchange = () => store.set('auto', auto.checked);
  }

  function init() {
    buildPanel();
    new MutationObserver(() => refreshPrompt(false)).observe(document.body, {
      childList: true, subtree: true, characterData: true,
    });
    refreshPrompt(false);
  }

  if (document.body) init();
  else window.addEventListener('DOMContentLoaded', init);
})();
