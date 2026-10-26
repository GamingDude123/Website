#!/usr/bin/env python3
"""Runs the browser-level checks: a real page, a real bridge, a real DSU client.

    python3 test_page.py

test_bridge.py proves the wire formats. This proves the part that only shows
up once a browser is involved — that tapping A on the phone actually arrives
at Dolphin's end as a button press, rather than merely lighting up on screen.

This process owns both servers and subscribes to the DSU port exactly as
Dolphin would, so what it asserts on is the same stream Dolphin sees.
"""

import json
import os
import socket
import ssl
import struct
import subprocess
import sys
import threading
import time
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dsu
import wiibridge

HERE = os.path.dirname(os.path.abspath(__file__))
NODE_PATH = "/opt/node22/lib/node_modules"

PASSED = 0
FAILED = []


def check(name, condition, detail=""):
    global PASSED
    if condition:
        PASSED += 1
    else:
        FAILED.append(name + ((" — " + str(detail)) if detail else ""))


class DsuWatcher(threading.Thread):
    """Subscribes like Dolphin and keeps every packet it is sent."""

    daemon = True

    def __init__(self, port):
        super().__init__(name="watcher")
        self.port = port
        self.packets = []
        self._stop = threading.Event()
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.settimeout(0.3)

    def _request(self, msg_type, payload):
        body = struct.pack("<I", msg_type) + payload
        packet = bytearray(
            b"DSUC" + struct.pack("<HH", 1001, len(body))
            + b"\x00\x00\x00\x00" + struct.pack("<I", 0xC0FFEE) + body)
        packet[8:12] = struct.pack("<I", zlib.crc32(bytes(packet)) & 0xFFFFFFFF)
        self.socket.sendto(bytes(packet), ("127.0.0.1", self.port))

    def run(self):
        self._request(dsu.MSG_DATA, b"\x00\x00" + b"\x00" * 6)
        last = time.monotonic()
        while not self._stop.is_set():
            # Dolphin re-registers periodically; without that the bridge
            # correctly forgets us after five seconds.
            if time.monotonic() - last > 2.0:
                self._request(dsu.MSG_DATA, b"\x00\x00" + b"\x00" * 6)
                last = time.monotonic()
            try:
                packet = self.socket.recvfrom(2048)[0]
            except socket.timeout:
                continue
            except OSError:
                break
            if len(packet) < 100 or packet[0:4] != b"DSUS":
                continue
            payload = packet[20:]
            self.packets.append({
                "buttons1": payload[16],
                "buttons2": payload[17],
                "home": payload[18],
                "timestamp": struct.unpack_from("<Q", payload, 48)[0],
                "accel": struct.unpack_from("<fff", payload, 56),
                "gyro": struct.unpack_from("<fff", payload, 68),
            })

    def stop(self):
        self._stop.set()


def main():
    state = wiibridge.PadState(wiibridge.load_config())
    dsu_port = 27610
    dsu_server = wiibridge.DsuServer(state, host="127.0.0.1", port=dsu_port)
    dsu_server.start()

    cert, key, _ca, _ = wiibridge.ensure_certificate(
        wiibridge.local_hostname(), wiibridge.local_ip())

    server = wiibridge.BridgeServer(("127.0.0.1", 0), state, dsu_server)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, key)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    port = server.socket.getsockname()[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()

    watcher = DsuWatcher(dsu_port)
    watcher.start()
    time.sleep(0.3)

    env = dict(os.environ)
    env["NODE_PATH"] = NODE_PATH
    env["BRIDGE_URL"] = "https://127.0.0.1:%d/" % port

    result = subprocess.run(
        ["node", os.path.join(HERE, "test_page.js")],
        env=env, capture_output=True, text=True, timeout=180)

    watcher.stop()
    server.shutdown()
    server.server_close()
    dsu_server.stop()

    stdout = result.stdout.strip().splitlines()
    if not stdout:
        print("Browser harness produced no output.")
        print(result.stderr[-3000:])
        return 1

    try:
        report = json.loads(stdout[-1])
    except ValueError:
        print("Unreadable harness output:")
        print(result.stdout[-2000:])
        print(result.stderr[-2000:])
        return 1

    for entry in report["checks"]:
        check(entry["name"], entry["ok"], entry.get("detail", ""))

    # Now the half the browser can't see: what actually left for Dolphin.
    packets = watcher.packets
    check("dolphin's end received packets", len(packets) > 20, len(packets))

    moved = [p for p in packets if abs(p["gyro"][0]) > 100]
    check("the swing reached dolphin as gyro", len(moved) > 0, len(moved))

    flat = [p for p in packets if abs(p["accel"][2] - 1.0) < 0.05]
    check("a flat phone reads 1 g on Z at dolphin's end", len(flat) > 0, len(flat))

    pressed_a = [p for p in packets if p["buttons2"] & dsu.BUTTONS2["cross"]]
    check("A press reached dolphin", len(pressed_a) > 0, len(pressed_a))
    check("A was released again",
          packets[-1]["buttons2"] & dsu.BUTTONS2["cross"] == 0,
          hex(packets[-1]["buttons2"]))

    pressed_b = [p for p in packets if p["buttons2"] & dsu.BUTTONS2["circle"]]
    check("B press reached dolphin", len(pressed_b) > 0, len(pressed_b))

    pressed_home = [p for p in packets if p["home"]]
    check("HOME press reached dolphin", len(pressed_home) > 0, len(pressed_home))

    recenter = [p for p in packets if p["buttons1"] & dsu.BUTTONS1["l3"]]
    check("RECENTER press reached dolphin", len(recenter) > 0, len(recenter))

    # No two buttons may share a bit, or one would silently trigger the other.
    combined = {}
    for name, entry in (("a", ("buttons2", dsu.BUTTONS2["cross"])),
                        ("b", ("buttons2", dsu.BUTTONS2["circle"])),
                        ("one", ("buttons2", dsu.BUTTONS2["square"])),
                        ("two", ("buttons2", dsu.BUTTONS2["triangle"])),
                        ("plus", ("buttons1", dsu.BUTTONS1["options"])),
                        ("minus", ("buttons1", dsu.BUTTONS1["share"])),
                        ("recenter", ("buttons1", dsu.BUTTONS1["l3"]))):
        combined.setdefault(entry, []).append(name)
    clashes = {k: v for k, v in combined.items() if len(v) > 1}
    check("every button has its own bit", not clashes, clashes)

    # Timestamps must never go backwards; Dolphin's integration would jump.
    stamps = [p["timestamp"] for p in packets]
    check("motion timestamps never go backwards",
          all(b >= a for a, b in zip(stamps, stamps[1:])))

    print()
    if FAILED:
        print("  %d passed, %d FAILED" % (PASSED, len(FAILED)))
        for failure in FAILED:
            print("    x %s" % failure)
        if result.stderr.strip():
            print("\n  stderr:\n%s" % result.stderr[-1500:])
        return 1
    print("  %d browser checks passed." % PASSED)
    return 0


if __name__ == "__main__":
    sys.exit(main())
