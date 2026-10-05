#!/usr/bin/env bash
# Rebuilds everything under dj/vendor/separator and dj/models/htdemucs from sources.
#
#   dj/tools/separator/build.sh
#
# Needs node 18+, npm and (for the model) network access to registry.npmjs.org.
# Nothing is installed into the repository: tooling goes to $SEP_WORK
# (default: $TMPDIR/autopilot-dj-separator-build).
#
#   SEP_WORK=dir        where node_modules goes
#   SEP_MODEL=file      use this htdemucs.onnx instead of fetching npm demucs@1.0.0
#   SEP_SKIP_MODEL=1    only rebuild the worker, not the model parts
#   SEP_WITH_NODE=1     also install onnxruntime-node (about 600 MB; test/separator.test.js uses it)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DJ="$(cd "$HERE/../.." && pwd)"
WORK="${SEP_WORK:-${TMPDIR:-/tmp}/autopilot-dj-separator-build}"
MODEL_SHA256="da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748"   # htdemucs.onnx from npm demucs@1.0.0

mkdir -p "$WORK"
cp "$HERE/package.json" "$HERE/package-lock.json" "$WORK/"
cd "$WORK"
if [ "${SEP_WITH_NODE:-}" = "1" ]; then npm ci --no-audit --no-fund; else npm ci --omit=optional --no-audit --no-fund; fi

# 1. the worker: core.js + onnxruntime-web (WebGPU + wasm), one classic script
#    import.meta.url is defined away: ort then loads its wasm from the path worker-src.js gives it
OUT="$DJ/vendor/separator"
mkdir -p "$OUT/ort"
NODE_PATH="$WORK/node_modules" "$WORK/node_modules/.bin/esbuild" "$HERE/worker-src.js" \
  --bundle --format=iife --platform=browser --target=es2020 --minify \
  --define:import.meta.url=undefined --legal-comments=external \
  --outfile="$OUT/worker.js"
mv "$OUT/worker.js.LEGAL.txt" "$OUT/worker.LEGAL.txt"

# 2. the one wasm file ort fetches at run time. The "jsep" build contains both the WebGPU and the CPU (wasm)
#    execution providers, so this single file serves both.
cp "$WORK/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm" "$OUT/ort/"

# 3. the model, split into parts under GitHub's file size limits, plus manifest.json
if [ "${SEP_SKIP_MODEL:-}" != "1" ]; then
  MODEL="${SEP_MODEL:-}"
  if [ -z "$MODEL" ]; then
    (cd "$WORK" && npm pack demucs@1.0.0 --silent && rm -rf demucs-pkg && mkdir demucs-pkg && tar -xzf demucs-1.0.0.tgz -C demucs-pkg)
    MODEL="$WORK/demucs-pkg/package/htdemucs.onnx"
  fi
  node "$HERE/split-model.js" "$MODEL" "$DJ/models/htdemucs" "$MODEL_SHA256"
fi

echo "done:"; ls -l "$OUT" "$OUT/ort" "$DJ/models/htdemucs"
