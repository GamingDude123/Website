# vendor/separator

- `worker.js`: built by `dj/tools/separator/build.sh` from `dj/tools/separator/worker-src.js` and
  `dj/tools/separator/src/core.js` (this project) together with **onnxruntime-web 1.23.0**
  (MIT, Copyright (c) Microsoft Corporation) and the libraries that bundle pulls in: onnxruntime-common (MIT),
  protobufjs (BSD-3-Clause), flatbuffers (Apache-2.0), long (Apache-2.0), platform (MIT), guid-typescript (ISC).
  The licence notices that survive minification are in `worker.LEGAL.txt`. The file is minified; the readable
  sources are in `dj/tools/separator/`.
- `ort/ort-wasm-simd-threaded.jsep.wasm`: onnxruntime-web 1.23.0's WebAssembly runtime, unmodified (MIT,
  Microsoft). The "jsep" build contains both the WebGPU and the CPU execution provider, so this one file serves
  both. It is the only file the worker fetches at run time.
- The neural network lives in `dj/models/htdemucs/` and has its own licence caveat: see `NOTICE.md` there.
