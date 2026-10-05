# htdemucs model files

`htdemucs.onnx.part00` to `htdemucs.onnx.part03` are one file, `htdemucs.onnx` (174,263,526 bytes, fp32), cut
into four parts so each stays well under GitHub's file size limits. `manifest.json` lists the parts with their
sizes and SHA-256 checksums, and the checksum of the whole file. `js/separator.js` downloads the parts,
checks them against the manifest and hands them to the worker, which joins them in memory.

## Source

The file is `htdemucs.onnx` from the npm package **demucs@1.0.0** (<https://www.npmjs.com/package/demucs>,
repository <https://github.com/bakkot/demucs-js>) by Kevin Gibbons and contributors. It is an ONNX export of the
4-stem "Hybrid Transformer Demucs v4" (`htdemucs`) weights from Meta's Demucs project
(<https://github.com/facebookresearch/demucs>). The network leaves the STFT and inverse STFT outside the graph;
`dj/tools/separator/src/core.js` does those.

## Licence caveat

The code of that package is MIT-licensed (see `dj/tools/separator/LICENSE-demucs-js.md`). The weights are not
covered by that licence. This is the package's `LICENSE.md`, verbatim:

> However, this repository/package also include a weights file ("htdemucs.onnx"), which is not covered by this license. It is derived from a weights file provided by Meta, which is made available for personal and research use only.

So the model in this folder is **for personal and research use only**. Do not use this site's vocal separation
for anything commercial, and do not redistribute these files for such use.

## Rebuilding

`dj/tools/separator/build.sh` fetches demucs@1.0.0 from npm, checks the SHA-256 of `htdemucs.onnx`
(`da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748`) and splits it again with
`dj/tools/separator/split-model.js`. The parts are byte-identical to these.
