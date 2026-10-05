# Vocal separator: how it is built

Autopilot DJ separates vocals from instruments with Meta's Demucs v4 (`htdemucs`, 4 stems) running in the
browser through onnxruntime-web: WebGPU when the browser has it, WebAssembly otherwise (tests and last resort
only: about a quarter of real time on one thread). The app itself has no build step; this folder is the build
step for the three things it ships for the separator:

| Shipped file | Made from |
| --- | --- |
| `dj/vendor/separator/worker.js` | `worker-src.js` + `src/core.js` + onnxruntime-web 1.23.0, bundled by esbuild into one classic worker script |
| `dj/vendor/separator/ort/ort-wasm-simd-threaded.jsep.wasm` | copied from onnxruntime-web 1.23.0 (the only file the worker fetches) |
| `dj/models/htdemucs/*.part0N`, `manifest.json` | `htdemucs.onnx` from npm `demucs@1.0.0`, cut by `split-model.js` |

The page side is `dj/js/separator.js` (downloads and caches the parts, owns the worker, queues requests).

## Rebuild

```sh
dj/tools/separator/build.sh               # needs node 18+, npm, and network access to registry.npmjs.org
SEP_WORK=/some/dir dj/tools/separator/build.sh      # where node_modules goes (default $TMPDIR/autopilot-dj-separator-build)
SEP_SKIP_MODEL=1 dj/tools/separator/build.sh        # just the worker; leave the model parts alone
SEP_WITH_NODE=1 dj/tools/separator/build.sh         # also install onnxruntime-node (600 MB) for test/separator.test.js
```

`npm ci` runs against the committed `package-lock.json` (esbuild 0.25.10, onnxruntime-web 1.23.0), nothing is
installed inside the repository, and the model is checked against its known SHA-256 before it is split. Run
`node dj/test/separator.test.js` afterwards (`SEP_SKIP_BROWSER=1` skips the slow Chromium part).

## What is in here

- `src/core.js`: everything except the network. STFT and inverse STFT, cutting a song into 7.8 s chunks with 25%
  overlap, the triangle blend, and the stems. Plain JS without imports: the worker bundles it, the node test
  `require`s it with onnxruntime-node. It only accumulates the two outputs that are wanted (`vocals` and
  `inst` = drums + bass + other); the iSTFT is linear, so the three instrumental spectrograms are added and
  inverted once. Two output buffers instead of four, two inverse transforms per chunk instead of four.
- `worker-src.js`: the worker's message loop and the onnxruntime session (WebGPU first, wasm when allowed).
- `upstream/`: the unmodified files from demucs-js that `core.js` is derived from (`apply.js`, `dsp.js`,
  `onnx-htdemucs.js`), kept so the differences below can be diffed. They are not built or loaded.
- `LICENSE-demucs-js.md`: demucs-js's licence, verbatim (MIT for the code; the weights are not covered, see
  `dj/models/htdemucs/NOTICE.md`: personal and research use only).

## What was changed from demucs-js, and why

demucs-js (`apply.js`, `dsp.js`) was the starting point; running it showed three things that did not hold up:

1. **Reflect padding on the left was wrong.** `padReflect` turns `[1..8]` padded by 3 into `[1,0,0,1,2,3,...]`
   instead of `[4,3,2,1,2,3,...]` (it copies from a slot that is not filled yet). Every chunk's spectrogram
   therefore has a wrong first frame or two. Fixed; the STFT now matches torch's (checked against an
   independent numpy implementation and a direct DFT, see the test).
2. **The inverse STFT is 4096 samples too short.** `istft` subtracts `nFft` from the requested length when
   `center` is set, which torch does not. `ispec` then reads past the end of its buffer: the last 2476 samples
   of every chunk are another row's data, and the very last row's are `NaN`. Fixed.
3. **Speed and memory.** sin/cos were recomputed in the inner loop of the FFT, eight inverse transforms
   were done per frame (four stems times left and right), and the output held all four stems. Now: tabulated
   twiddles, one complex transform carries two real signals (two inverse transforms per frame instead of eight),
   two stems out. The transforms for one chunk take 0.23 s here (forward, two inverses, blending) against about
   1.7 s for demucs-js's `spec` + `ispec` alone; for a 5-minute song, 12 s of JS against 90 s or more. Memory for a
   5-minute song (measured with a stand-in model): the input 101 MB, the two stereo stems 202 MB and about
   115 MB for the chunk in flight; the network's own memory comes on top (see below).

And in the browser build:

- ort's `ort.bundle.min.mjs` is used (the wasm loader is inlined in the bundle), so the worker needs only the
  `.wasm` file and no dynamic `import()` of an `.mjs`, which a classic worker may not allow. esbuild turns
  `import.meta.url` into nothing, so `worker-src.js` gives ort the wasm's URL explicitly, resolved against the
  worker's own URL: it works under any base path.
- ort's `jsep` wasm contains both the WebGPU and the CPU execution providers, so one 23.7 MB file serves both;
  the plain-wasm build (11.8 MB) is not shipped.
- `numThreads = 1` and `proxy = false`: GitHub Pages cannot send the COOP/COEP headers threads need. With the
  wasm loader inlined ort has no script URL to start thread workers from, so multi-threading is not set up at
  all (it would only speed up the wasm fallback, not WebGPU). The page therefore never needs
  `SharedArrayBuffer`; it runs, quietly, on one thread.
- The wasm session is created with `graphOptimizationLevel: "disabled"`. Measured in headless Chromium on one
  wasm thread: the same output (to 1e-7) and the same speed as `"all"` (25.0 s against 24.4 s per 7.8 s chunk),
  session creation 5.3 s against 7.0 s, but the renderer process peaked at 1.5 GB instead of 2.6 GB (constant
  folding and fusion copy the weights). `enableCpuMemArena` made no difference. The WebGPU session keeps ort's
  default `"all"` (what upstream uses; it could not be measured here, see the test output), and runs the
  network once at the end of `init()` so the shaders are compiled and a broken GPU is found before anyone waits on a song.
- The model parts are assembled in the worker straight into one preallocated `Uint8Array` as they arrive
  (the page transfers each part instead of copying it), and the buffer is dropped once the session exists.

## Licences

esbuild output includes onnxruntime-web (MIT, Microsoft) and what it bundles; notices are in
`dj/vendor/separator/NOTICE.md` and `worker.LEGAL.txt`. The model has its own caveat: **personal and research
use only** (`dj/models/htdemucs/NOTICE.md`).

## Measured here (4-core Linux sandbox, no GPU)

| | |
| --- | --- |
| node, onnxruntime-node CPU, 4 threads | 3.35 s per 7.8 s chunk; a 16 s clip in 10.0 s, 1.6x real time with the overlap |
| Chromium, wasm EP, 1 thread | about 24 s per chunk (48 s for the 2 chunks of a 7.8 s clip): about 0.24x real time |
| Chromium, WebGPU EP on SwiftShader (the GPU emulated on the CPU) | session created in 9 s (the shipped worker, which also runs one chunk inside `init()` to compile the shaders, reached `ready` with `ep: "webgpu"` after 1084 s), one chunk 883 s; the stems agree with node's to 77.6 dB (instrumental) and 57.2 dB (vocals), correlation 0.999999. That proves the WebGPU path runs the network and gets the right numbers; it says nothing about speed on a real GPU, which was not measured |
| Chromium renderer memory, wasm EP | 0.95 GB peak while the session is created, 1.5 GB after a first song, plus 0.3 GB for a 5-minute song's buffers |
| `vocals + inst` against the mix, synthetic clip | 35.7 dB SDR |

`node dj/test/separator.test.js` repeats these checks (it reports its own timings).
