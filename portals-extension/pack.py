#!/usr/bin/env python3
"""Builds portals-extension.zip (next to the portals-extension folder): just the files
Chrome needs, in a folder called portals-extension, so unzipping gives something that can be
loaded with "Load unpacked". The repo is 200 MB, so this is what to download instead.

    python3 portals-extension/pack.py            build the zip
    python3 portals-extension/pack.py --check    fail if the zip is missing or out of date
"""
import pathlib
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "portals-extension.zip"
FILES = ["manifest.json", "background.js", "reader.js", "hub.html", "hub.css", "hub.js", "portals.js", "README.md"]
NOT_SHIPPED = {"test", "pack.py"}


def wanted():
    return {"portals-extension/" + name: (HERE / name).read_bytes() for name in FILES}


def forgotten():
    """Anything in the folder that is neither shipped nor deliberately left out."""
    return sorted(p.name for p in HERE.iterdir() if p.name not in FILES and p.name not in NOT_SHIPPED)


def build():
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in sorted(wanted().items()):
            info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))   # fixed date: the same files give the same zip
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, data)
    print("wrote", OUT, f"({OUT.stat().st_size} bytes)")


def check():
    problems = []
    if forgotten():
        problems.append("in the folder but not in FILES or NOT_SHIPPED: " + ", ".join(forgotten()))
    if not OUT.exists():
        problems.append(f"{OUT.name} does not exist; run pack.py")
    else:
        with zipfile.ZipFile(OUT) as z:
            have = {n: z.read(n) for n in z.namelist()}
        want = wanted()
        problems += [f"{OUT.name} is missing {n}" for n in sorted(set(want) - set(have))]
        problems += [f"{OUT.name} has an unexpected {n}" for n in sorted(set(have) - set(want))]
        problems += [f"{OUT.name} has an out-of-date {n}" for n in sorted(want) if n in have and have[n] != want[n]]
    for p in problems:
        print("PROBLEM:", p)
    if not problems:
        print("zip is up to date")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(check() if "--check" in sys.argv else (build() or 0))
