#!/usr/bin/env node
/* Split htdemucs.onnx into parts small enough for GitHub (which refuses files over 100 MB and
 * warns over 50 MB) and write manifest.json next to them.
 *
 *   node split-model.js <htdemucs.onnx> <out dir> [expected sha256]
 *
 * Parts are of equal size and at most MAX_PART bytes. The manifest is what js/separator.js reads:
 *   {name, version, bytes, sha256, parts: [{file, bytes, sha256}, ...]}
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_PART = 44000000;            // bytes; well under GitHub's 50 MB warning
const NAME = "htdemucs", VERSION = "demucs@1.0.0";

const [src, outDir, expected] = process.argv.slice(2);
if (!src || !outDir) { console.error("usage: split-model.js <htdemucs.onnx> <out dir> [expected sha256]"); process.exit(2); }
const data = fs.readFileSync(src);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const whole = sha(data);
if (expected && expected !== whole) { console.error("model sha256 is " + whole + ", expected " + expected); process.exit(1); }

const n = Math.ceil(data.length / MAX_PART), size = Math.ceil(data.length / n);
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^htdemucs\.onnx\.part\d+$/.test(f)) fs.unlinkSync(path.join(outDir, f));
const parts = [];
for (let i = 0; i < n; i++) {
  const chunk = data.subarray(i * size, Math.min(data.length, (i + 1) * size));
  const file = NAME + ".onnx.part" + String(i).padStart(2, "0");
  fs.writeFileSync(path.join(outDir, file), chunk);
  parts.push({ file: file, bytes: chunk.length, sha256: sha(chunk) });
}
const manifest = { name: NAME, version: VERSION, bytes: data.length, sha256: whole, parts: parts };
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(NAME + ": " + data.length + " bytes in " + n + " parts of up to " + size + " bytes, sha256 " + whole);
