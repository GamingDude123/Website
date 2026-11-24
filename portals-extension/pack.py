#!/usr/bin/env python3
"""Builds the extension download: just the files Chrome needs, in a folder called
portals-extension, so unzipping gives something that can be loaded with "Load unpacked".
The repo is 200 MB, so this is what to download instead.

    python3 portals-extension/pack.py            build ../portals-extension.zip (the public one)
    python3 portals-extension/pack.py --check    fail if that zip is missing or out of date

    python3 portals-extension/pack.py --personal MINE.json --out MINE.zip
        a copy filled in for one person: the colleges the extension knows (so a line in the
        list can be just a name) and the list it starts with. MINE.json stays wherever you
        keep it; nothing about it goes in the repo or the public zip. Its shape:

        { "colleges": [ { "name": "Yale University",
                          "aliases": ["Yale"],
                          "url": "https://apply.yale.edu/status",
                          "colors": ["#00356b"] }, ... ],
          "starter":  ["Yale University", ...] }          (starter defaults to every college)
"""
import json
import pathlib
import re
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "portals-extension.zip"
FILES = ["manifest.json", "background.js", "reader.js", "hub.html", "hub.css", "hub.js", "portals.js",
         "colleges.js", "starter.js", "README.md"]
NOT_SHIPPED = {"test", "pack.py"}
GENERATED = {"colleges.js", "starter.js"}   # what --personal replaces
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def wanted(personal=None):
    files = {"portals-extension/" + name: (HERE / name).read_bytes() for name in FILES}
    if personal is not None:
        colleges, starter = personal
        files["portals-extension/colleges.js"] = (
            "/* The colleges this copy knows. Made by pack.py --personal. */\n"
            "var COLLEGES = " + json.dumps(colleges, indent=2) + ";\n").encode()
        files["portals-extension/starter.js"] = (
            "/* The list this copy starts with. Made by pack.py --personal. */\n"
            "var STARTER = " + json.dumps("\n".join(starter)) + ";\n").encode()
    return files


def forgotten():
    """Anything in the folder that is neither shipped nor deliberately left out."""
    return sorted(p.name for p in HERE.iterdir() if p.name not in FILES and p.name not in NOT_SHIPPED)


def write_zip(path, files):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))   # fixed date: the same files give the same zip
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, data)
    print("wrote", path, f"({pathlib.Path(path).stat().st_size} bytes)")


def load_personal(path):
    data = json.loads(pathlib.Path(path).read_text())
    colleges = data.get("colleges")
    if not isinstance(colleges, list) or not colleges:
        sys.exit("the file needs a non-empty \"colleges\" list")
    clean = []
    for c in colleges:
        name = str(c.get("name", "")).strip()
        url = str(c.get("url", "")).strip()
        colors = [str(x).strip().lower() for x in c.get("colors", [])][:2]
        if not name:
            sys.exit("a college has no name")
        if not re.match(r"^https?://[^\s/]+\.[^\s/]+", url):
            sys.exit(f"{name}: url must be a web address, got {url!r}")
        for x in colors:
            if not HEX.match(x):
                sys.exit(f"{name}: colours must look like #aabbcc, got {x!r}")
        clean.append({"name": name, "aliases": [str(a) for a in c.get("aliases", [])], "url": url, "colors": colors})
    names = {c["name"] for c in clean}
    starter = [str(n) for n in data.get("starter", [c["name"] for c in clean])]
    for n in starter:
        if n not in names:
            sys.exit(f"starter has {n!r}, which is not one of the colleges")
    return clean, starter


def check():
    problems = []
    if forgotten():
        problems.append("in the folder but not in FILES or NOT_SHIPPED: " + ", ".join(forgotten()))
    # What is committed must be the generic version, so nothing personal ever lands in the repo.
    for name in sorted(GENERATED):
        text = (HERE / name).read_text()
        if not re.search(r"var (COLLEGES = \[\]|STARTER = \"\");", text):
            problems.append(f"{name} must be the empty, public version (it was changed; keep personal data out of the repo)")
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


def main(argv):
    if "--check" in argv:
        return check()
    if "--personal" in argv:
        try:
            src = argv[argv.index("--personal") + 1]
            out = argv[argv.index("--out") + 1]
        except (ValueError, IndexError):
            sys.exit("usage: pack.py --personal MINE.json --out MINE.zip")
        write_zip(out, wanted(load_personal(src)))
        return 0
    write_zip(OUT, wanted())
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
