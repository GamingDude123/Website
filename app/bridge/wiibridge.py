#!/usr/bin/env python3
"""Turn an iPhone into a Wii Remote for Dolphin.

    python3 wiibridge.py

Dolphin can take motion from a DSU server (Config -> Controllers -> Alternate
Input Sources). This is one, except the accelerometer and gyroscope it reports
come from a phone's own sensors over your Wi-Fi rather than from a DualShock.
Bind them to an emulated Wii Remote and swinging the phone swings the remote.

Three things run at once:

  * an HTTPS server handing the phone its controller page,
  * a WebSocket on that same port carrying motion samples back,
  * a DSU/UDP server on 127.0.0.1:26760 that Dolphin polls.

HTTPS is not decoration. Safari only exposes motion sensors to a secure page,
and only after an explicit permission prompt that a plain http:// page is not
even allowed to ask. So the bridge generates its own certificate and serves
over TLS; trusting it on the phone is a one-time detour, described in
README.md.

Standard library only — no pip install, nothing to keep up to date.
"""

import argparse
import http.server
import json
import os
import random
import socket
import socketserver
import ssl
import struct
import subprocess
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dsu
import wsframe

HERE = os.path.dirname(os.path.abspath(__file__))
CERT_DIR = os.path.join(HERE, ".cert")
CONFIG_PATH = os.path.join(HERE, "bridge-config.json")

DEFAULT_HTTPS_PORT = 8443
DEFAULT_SETUP_PORT = 8080
DSU_PORT = 26760          # Dolphin's default; change both if you change it
DSU_HOST = "127.0.0.1"

# Where Dolphin usually is on a Mac. The launcher checks these in order before
# falling back to asking macOS by bundle id.
DOLPHIN_PATHS = [
    "/Applications/Dolphin.app",
    os.path.expanduser("~/Applications/Dolphin.app"),
    "/Applications/DolphinEmulator.app",
]
DOLPHIN_BUNDLE_ID = "org.dolphin-emu.dolphin"

# Dolphin drops a controller it hasn't heard from. 60 Hz is roughly what a
# phone's motion events arrive at anyway, so this is also the keepalive rate.
KEEPALIVE_INTERVAL = 1 / 60.0
CLIENT_TIMEOUT = 5.0

GRAVITY = 9.80665         # m/s^2 per g


# ---------------------------------------------------------------------------
# Shared state


class PadState:
    """What the phone last told us, in the units Dolphin wants.

    Written by the WebSocket thread, read by the DSU thread, so every access
    goes through the lock.
    """

    def __init__(self, config):
        self._lock = threading.Lock()
        self.config = config

        self.accel = (0.0, 0.0, 1.0)   # g; at rest, lying flat, screen up
        self.gyro = (0.0, 0.0, 0.0)    # deg/s, as (pitch, yaw, roll)
        self.buttons1 = 0
        self.buttons2 = 0
        self.home = 0

        self.motion_timestamp_us = 0
        self.samples = 0
        self.phone_last_seen = 0.0
        self.phone_connected = False

        # Set when a fresh sample lands, so the DSU thread can forward it at
        # once instead of waiting out its keepalive tick.
        self.updated = threading.Event()

    # -- writes ------------------------------------------------------------

    def apply_sample(self, message):
        """Take one JSON message from the phone.

        Browser units are m/s^2 and deg/s with the axes of a phone held flat.
        Dolphin wants g and deg/s with the axes of a Wii Remote held flat.
        Hold the phone the way you would hold a remote — screen up, top edge
        pointing at the screen — and those two frames line up already, so the
        only conversion needed is gravity. The sign flips exist because which
        way round "up" is depends on the phone, and finding out by testing
        beats guessing in a comment.
        """
        accel = message.get("a")
        gyro = message.get("g")
        if not (isinstance(accel, list) and isinstance(gyro, list)):
            return
        if len(accel) != 3 or len(gyro) != 3:
            return

        flip = self.config["invert"]
        try:
            ax, ay, az = (float(v) / GRAVITY for v in accel)
            gx, gy, gz = (float(v) for v in gyro)
        except (TypeError, ValueError):
            return

        with self._lock:
            self.accel = (
                ax * flip["accel_x"], ay * flip["accel_y"], az * flip["accel_z"])
            self.gyro = (
                gx * flip["gyro_pitch"], gy * flip["gyro_yaw"], gz * flip["gyro_roll"])

            buttons = message.get("b")
            if isinstance(buttons, list) and len(buttons) == 3:
                self.buttons1 = int(buttons[0]) & 0xFF
                self.buttons2 = int(buttons[1]) & 0xFF
                self.home = int(buttons[2]) & 0xFF

            # Advancing this is what tells Dolphin the reading is new. See the
            # note in dsu.data_response.
            self.motion_timestamp_us = time.monotonic_ns() // 1000
            self.samples += 1
            self.phone_last_seen = time.monotonic()
            self.phone_connected = True

        self.updated.set()

    def set_phone_connected(self, connected):
        with self._lock:
            self.phone_connected = connected
            if not connected:
                # Let go of every button, or a press held at the moment the
                # connection dropped stays held forever.
                self.buttons1 = self.buttons2 = self.home = 0
                self.accel = (0.0, 0.0, 1.0)
                self.gyro = (0.0, 0.0, 0.0)
        self.updated.set()

    # -- reads -------------------------------------------------------------

    def snapshot(self):
        with self._lock:
            return {
                "accel": self.accel,
                "gyro": self.gyro,
                "buttons1": self.buttons1,
                "buttons2": self.buttons2,
                "home": self.home,
                "motion_timestamp_us": self.motion_timestamp_us,
                "samples": self.samples,
                "phone_connected": self.phone_connected,
            }


DEFAULT_CONFIG = {
    "invert": {
        "accel_x": 1, "accel_y": 1, "accel_z": 1,
        "gyro_pitch": 1, "gyro_yaw": 1, "gyro_roll": 1,
    },
}


def load_config():
    config = json.loads(json.dumps(DEFAULT_CONFIG))
    try:
        with open(CONFIG_PATH) as handle:
            saved = json.load(handle)
        for axis, value in (saved.get("invert") or {}).items():
            if axis in config["invert"]:
                config["invert"][axis] = -1 if int(value) < 0 else 1
    except (OSError, ValueError):
        pass
    return config


def save_config(config):
    try:
        with open(CONFIG_PATH, "w") as handle:
            json.dump(config, handle, indent=2)
    except OSError:
        pass


# ---------------------------------------------------------------------------
# DSU server


class DsuServer(threading.Thread):
    """Answers Dolphin, and streams whatever the phone last sent."""

    daemon = True

    def __init__(self, state, host=DSU_HOST, port=DSU_PORT):
        super().__init__(name="dsu")
        self.state = state
        self.server_id = random.getrandbits(32)
        # Stable-looking MAC so Dolphin recognises the same pad across runs.
        self.mac = b"\x57\x49\x49\x42\x52\x01"     # "WIIBR" + slot
        self.packet_number = 0
        self.clients = {}
        self._stop = threading.Event()

        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind((host, port))
        self.socket.settimeout(0.2)

        self.sender = threading.Thread(target=self._stream, name="dsu-stream",
                                       daemon=True)

    def start(self):
        super().start()
        self.sender.start()

    def stop(self):
        self._stop.set()
        self.state.updated.set()

    # -- receiving ---------------------------------------------------------

    def run(self):
        while not self._stop.is_set():
            try:
                packet, addr = self.socket.recvfrom(2048)
            except socket.timeout:
                continue
            except OSError:
                break
            try:
                self._handle(packet, addr)
            except Exception:
                # A malformed request from anywhere on the network must not be
                # able to take the bridge down mid-game.
                continue

    def _handle(self, packet, addr):
        parsed = dsu.parse(packet)
        if parsed is None:
            return
        msg_type, payload = parsed

        if msg_type == dsu.MSG_VERSION:
            self.socket.sendto(dsu.version_response(self.server_id), addr)
            return

        if msg_type == dsu.MSG_PORTS:
            if len(payload) < 4:
                return
            count = struct.unpack_from("<I", payload, 0)[0]
            for index in range(min(count, 4)):
                if 4 + index >= len(payload):
                    break
                slot = payload[4 + index]
                # We are a single controller and it lives in slot 0. Every
                # other slot has to be answered too, as empty, or Dolphin
                # keeps asking.
                self.socket.sendto(
                    dsu.ports_response(slot, self.mac, slot == 0, self.server_id),
                    addr)
            return

        if msg_type == dsu.MSG_DATA:
            self.clients[addr] = time.monotonic()
            self.state.updated.set()

    # -- sending -----------------------------------------------------------

    def _stream(self):
        while not self._stop.is_set():
            # Wake early when the phone moves; otherwise tick, so Dolphin sees
            # a live controller even while the phone is being held still.
            self.state.updated.wait(KEEPALIVE_INTERVAL)
            self.state.updated.clear()
            if self._stop.is_set():
                break

            now = time.monotonic()
            for addr, last in list(self.clients.items()):
                if now - last > CLIENT_TIMEOUT:
                    del self.clients[addr]
            if not self.clients:
                continue

            snap = self.state.snapshot()
            self.packet_number += 1
            packet = dsu.data_response(
                slot=0,
                mac=self.mac,
                packet_number=self.packet_number,
                buttons1=snap["buttons1"],
                buttons2=snap["buttons2"],
                extra={"home": snap["home"], "touch": 0},
                accel=snap["accel"],
                gyro=snap["gyro"],
                motion_timestamp_us=snap["motion_timestamp_us"],
                server_id=self.server_id,
            )
            for addr in list(self.clients):
                try:
                    self.socket.sendto(packet, addr)
                except OSError:
                    self.clients.pop(addr, None)

    @property
    def dolphin_connected(self):
        now = time.monotonic()
        return any(now - last <= CLIENT_TIMEOUT for last in self.clients.values())


# ---------------------------------------------------------------------------
# HTTPS + WebSocket


class BridgeHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "WiiBridge"

    # The default logger prints a line per request, which at 60 Hz would bury
    # the status display. Errors still surface through log_error.
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if self.headers.get("Upgrade", "").lower() == "websocket":
            self._websocket()
            return

        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html", "/controller.html"):
            self._serve_file("controller.html", "text/html; charset=utf-8")
        elif path == "/status":
            self._serve_json(self.server.status())
        elif path == "/favicon.ico":
            # Answered rather than 404'd: the page is a controller, not a site,
            # and a console full of failed favicon requests hides real errors.
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _cors(self):
        """Let the arcade page talk to the bridge.

        Wide open on purpose, and safe because of what is behind it: this
        server is bound to the machine it runs on, and the only thing it will
        do on request is open an emulator. It holds no account, no data and no
        credentials, so there is nothing for a hostile page to steal.
        """
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_POST(self):
        path = self.path.split("?", 1)[0]

        if path == "/launch":
            ok, message = launch_dolphin()
            self._serve_json({"ok": ok, "message": message})
            return

        if path != "/invert":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, OSError):
            self.send_error(400)
            return

        invert = self.server.state.config["invert"]
        for axis, value in body.items():
            if axis in invert:
                invert[axis] = -1 if int(value) < 0 else 1
        save_config(self.server.state.config)
        self._serve_json({"invert": invert})

    def _serve_file(self, name, content_type):
        try:
            with open(os.path.join(HERE, name), "rb") as handle:
                body = handle.read()
        except OSError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _serve_json(self, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    # -- the socket itself -------------------------------------------------

    def _websocket(self):
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            self.send_error(400)
            return

        self.wfile.write(
            b"HTTP/1.1 101 Switching Protocols\r\n"
            b"Upgrade: websocket\r\n"
            b"Connection: Upgrade\r\n"
            b"Sec-WebSocket-Accept: " + wsframe.accept_key(key).encode("ascii") +
            b"\r\n\r\n")
        self.wfile.flush()

        state = self.server.state
        state.set_phone_connected(True)
        self.server.note_phone(+1)

        reader = wsframe.Reader()
        self.connection.settimeout(10.0)
        try:
            while True:
                chunk = self.rfile.read1(4096)
                if not chunk:
                    break
                for opcode, payload in reader.feed(chunk):
                    if opcode == wsframe.OP_CLOSE:
                        return
                    if opcode == wsframe.OP_PING:
                        self.wfile.write(wsframe.encode(payload, wsframe.OP_PONG))
                        self.wfile.flush()
                        continue
                    if opcode != wsframe.OP_TEXT:
                        continue
                    try:
                        message = json.loads(payload)
                    except ValueError:
                        continue
                    if message.get("ping"):
                        # Echoed straight back so the phone can show a real
                        # round-trip figure rather than a guess.
                        self.wfile.write(wsframe.encode(json.dumps(
                            {"pong": message["ping"]})))
                        self.wfile.flush()
                        continue
                    state.apply_sample(message)
        except (OSError, ValueError):
            pass
        finally:
            self.server.note_phone(-1)


class BridgeServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, state, dsu_server):
        super().__init__(address, BridgeHandler)
        self.state = state
        self.dsu_server = dsu_server
        self._phones = 0
        self._phone_lock = threading.Lock()

    def note_phone(self, delta):
        with self._phone_lock:
            self._phones = max(0, self._phones + delta)
            remaining = self._phones
        if remaining == 0:
            self.state.set_phone_connected(False)

    def status(self):
        snap = self.state.snapshot()
        return {
            "bridge": True,
            "dolphin": self.dsu_server.dolphin_connected,
            "canLaunch": bool(find_dolphin()),
            "samples": snap["samples"],
            "accel": [round(v, 3) for v in snap["accel"]],
            "gyro": [round(v, 2) for v in snap["gyro"]],
            "invert": self.state.config["invert"],
        }


# ---------------------------------------------------------------------------
# Opening Dolphin
#
# A web page cannot start a Mac application — that is the whole reason the
# Launch button has only ever been able to give directions. But the bridge is
# not a web page: it is a program running on the Mac, and it can. So the
# button asks the bridge, and the bridge does it.


def find_dolphin():
    """Where Dolphin is on this machine, or None."""
    if sys.platform != "darwin":
        return None
    for path in DOLPHIN_PATHS:
        if os.path.isdir(path):
            return path
    # Not in the usual places — ask Spotlight, which finds it wherever it was
    # dragged to.
    try:
        found = subprocess.run(
            ["mdfind", "kMDItemCFBundleIdentifier == '%s'" % DOLPHIN_BUNDLE_ID],
            capture_output=True, text=True, timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None
    for line in found.splitlines():
        if line.strip().endswith(".app") and os.path.isdir(line.strip()):
            return line.strip()
    return None


def launch_dolphin():
    """Returns (ok, message). Never raises — it is reached from a request."""
    if sys.platform != "darwin":
        return False, "This bridge only knows how to open Dolphin on a Mac."

    path = find_dolphin()
    if not path:
        return False, ("Dolphin isn't installed on this Mac, or isn't where "
                       "macOS can find it. Put Dolphin.app in Applications.")
    try:
        subprocess.run(["open", "-a", path], check=True, timeout=10,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError) as err:
        return False, "macOS refused to open it: %s" % err
    return True, os.path.basename(path)


# ---------------------------------------------------------------------------
# Certificate


def local_ip():
    """This machine's address on the LAN, without sending anything.

    Connecting a UDP socket only picks a route; the phone needs the address
    that route would use, which is not necessarily the one gethostbyname
    returns on a Mac with several interfaces up.
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def local_hostname():
    name = socket.gethostname()
    if name.endswith(".local"):
        return name
    return name.split(".")[0] + ".local"


def _openssl(*args):
    subprocess.run(["openssl"] + list(args), check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def ensure_certificate(hostname, ip):
    """Make the certificates this Mac serves with, reusing them if they fit.

    Two certificates, not one, and the reason is specific to iOS. Safari will
    let you click past a certificate warning for a *page*, but it does not
    extend that exception to the WebSocket the page then opens — so the motion
    channel fails while the page itself looks fine, which is an unpleasant
    thing to debug from the sofa. The fix is for the certificate to be really
    trusted rather than merely excused, and iOS only offers that toggle for
    certificates that are certificate authorities. So: a tiny local CA, which
    you install once, and a server certificate it signs.

    Regenerated when the LAN address changes, since a certificate that doesn't
    name the address you typed is refused however well it is trusted.
    """
    ca_cert = os.path.join(CERT_DIR, "ca-cert.pem")
    ca_key = os.path.join(CERT_DIR, "ca-key.pem")
    chain = os.path.join(CERT_DIR, "chain.pem")
    key = os.path.join(CERT_DIR, "key.pem")
    stamp = os.path.join(CERT_DIR, "names.txt")
    names = "%s|%s" % (hostname, ip)

    if all(os.path.exists(p) for p in (ca_cert, chain, key, stamp)):
        with open(stamp) as handle:
            if handle.read().strip() == names:
                return chain, key, ca_cert, False

    os.makedirs(CERT_DIR, exist_ok=True)

    ca_config = os.path.join(CERT_DIR, "ca.cnf")
    with open(ca_config, "w") as handle:
        handle.write(
            "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n"
            "[dn]\nCN=Wii Bridge Local CA\nO=Wii Bridge\n"
            "[ext]\n"
            "basicConstraints=critical,CA:TRUE,pathlen:0\n"
            "keyUsage=critical,keyCertSign,cRLSign\n")

    leaf_config = os.path.join(CERT_DIR, "leaf.cnf")
    with open(leaf_config, "w") as handle:
        handle.write(
            "[req]\ndistinguished_name=dn\nprompt=no\n"
            "[dn]\nCN=Wii Bridge\n"
            "[ext]\n"
            "basicConstraints=critical,CA:FALSE\n"
            "keyUsage=critical,digitalSignature,keyEncipherment\n"
            # iOS ignores the common name completely and refuses a server
            # certificate with no serverAuth, so both of these matter.
            "extendedKeyUsage=serverAuth\n"
            "subjectAltName=DNS:%s,DNS:localhost,IP:%s,IP:127.0.0.1\n"
            % (hostname, ip))

    # iOS rejects any server certificate valid for more than 825 days no
    # matter how it was installed, so both of these stay comfortably under.
    _openssl("req", "-x509", "-newkey", "rsa:2048", "-sha256", "-days", "800",
             "-nodes", "-keyout", ca_key, "-out", ca_cert, "-config", ca_config)

    csr = os.path.join(CERT_DIR, "leaf.csr")
    leaf = os.path.join(CERT_DIR, "cert.pem")
    _openssl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", key,
             "-out", csr, "-config", leaf_config)
    _openssl("x509", "-req", "-in", csr, "-CA", ca_cert, "-CAkey", ca_key,
             "-CAcreateserial", "-out", leaf, "-days", "800", "-sha256",
             "-extfile", leaf_config, "-extensions", "ext")

    with open(chain, "w") as out:
        for part in (leaf, ca_cert):
            with open(part) as handle:
                out.write(handle.read())

    with open(stamp, "w") as handle:
        handle.write(names)
    return chain, key, ca_cert, True


# ---------------------------------------------------------------------------
# Setup server
#
# Plain HTTP, and deliberately so. The phone has to fetch the CA certificate
# before it trusts anything this machine serves, and fetching it over the very
# HTTPS it is needed for is a circle that won't close. It hands out one public
# certificate and nothing else — no key, no motion data, no controls.


class SetupHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "WiiBridgeSetup"

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/ca.cer":
            self._send(self.server.ca_bytes,
                       # This content type is what makes iOS offer to install
                       # it rather than showing a wall of base64.
                       "application/x-x509-ca-cert",
                       'attachment; filename="Wii Bridge.cer"')
        elif path in ("/", "/index.html"):
            self._send(self.server.page.encode("utf-8"), "text/html; charset=utf-8")
        else:
            self.send_error(404)

    def _send(self, body, content_type, disposition=None):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if disposition:
            self.send_header("Content-Disposition", disposition)
        self.end_headers()
        self.wfile.write(body)


class SetupServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, ca_path, secure_url):
        super().__init__(address, SetupHandler)
        with open(ca_path, "rb") as handle:
            self.ca_bytes = handle.read()
        self.page = SETUP_PAGE % {"secure_url": secure_url}


SETUP_PAGE = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wii Bridge setup</title>
<style>
 body{margin:0;padding:28px 22px;background:#0d1116;color:#e6edf3;
      font:16px/1.6 -apple-system,BlinkMacSystemFont,system-ui,sans-serif}
 h1{font-size:22px;margin:0 0 6px}
 p{color:#93a4b5;font-size:15px}
 ol{color:#93a4b5;font-size:15px;padding-left:22px}
 li{margin:10px 0}
 b{color:#e6edf3}
 a.btn{display:block;margin:22px 0;padding:16px;border-radius:12px;
       background:#009ee0;color:#fff;font-weight:700;text-align:center;
       text-decoration:none}
 a.go{display:block;margin:18px 0;padding:14px;border-radius:12px;
      border:1px solid #2b3642;color:#e6edf3;text-align:center;
      text-decoration:none;font-weight:700}
</style></head><body>
<h1>Wii Bridge setup</h1>
<p>One-time, on this phone. Then the phone works as a Wii Remote.</p>

<a class="btn" href="/ca.cer">1 &nbsp;Download the certificate</a>

<ol>
 <li>Tap <b>Allow</b> when it asks about a configuration profile.</li>
 <li>Open <b>Settings</b>. Near the top it now says <b>Profile Downloaded</b>
     — tap it, then <b>Install</b> (top right), enter your passcode, and
     <b>Install</b> again.</li>
 <li>Still in Settings: <b>General &rarr; About &rarr;
     <span>Certificate Trust Settings</span></b>, and switch on
     <b>Wii Bridge Local CA</b>.</li>
</ol>

<p>That third step is the one people miss. Installing the certificate is not
the same as trusting it, and without the switch the controller page will load
but never connect.</p>

<a class="go" href="%(secure_url)s">2 &nbsp;Open the controller &rarr;</a>

<p style="font-size:13px">This certificate only covers this computer on your
own network. It is generated here, it never leaves it, and deleting the
<code>.cert</code> folder undoes it.</p>
</body></html>
"""


# ---------------------------------------------------------------------------
# Status display


def run_status_display(server, state, dsu_server, url):
    """A one-line live readout, so a phone that isn't arriving is diagnosable.

    Without this the failure modes all look identical from the couch: the
    certificate wasn't trusted, the phone is on a different network, Dolphin
    was never pointed at the server. Each of those shows up differently here.
    """
    spinner = "|/-\\"
    tick = 0
    last_samples = 0
    last_time = time.monotonic()
    rate = 0.0

    try:
        while True:
            time.sleep(0.5)
            snap = state.snapshot()

            now = time.monotonic()
            elapsed = now - last_time
            if elapsed >= 1.0:
                rate = (snap["samples"] - last_samples) / elapsed
                last_samples = snap["samples"]
                last_time = now

            phone = "connected %5.1f Hz" % rate if snap["phone_connected"] else "waiting…       "
            dolphin_state = "connected" if dsu_server.dolphin_connected else "waiting…"
            accel = snap["accel"]

            tick += 1
            sys.stdout.write(
                "\r %s  phone: %s   dolphin: %-9s  accel %+.2f %+.2f %+.2f   "
                % (spinner[tick % 4], phone, dolphin_state, accel[0], accel[1], accel[2]))
            sys.stdout.flush()
    except KeyboardInterrupt:
        print("\n\nStopped.")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=DEFAULT_HTTPS_PORT,
                        help="HTTPS port for the phone (default %d)" % DEFAULT_HTTPS_PORT)
    parser.add_argument("--dsu-port", type=int, default=DSU_PORT,
                        help="UDP port Dolphin polls (default %d)" % DSU_PORT)
    parser.add_argument("--host", default="0.0.0.0",
                        help="interface to serve the phone page on")
    parser.add_argument("--setup-port", type=int, default=DEFAULT_SETUP_PORT,
                        help="plain HTTP port for the one-time certificate "
                             "install (default %d)" % DEFAULT_SETUP_PORT)
    args = parser.parse_args()

    hostname = local_hostname()
    ip = local_ip()

    try:
        cert, key, ca_cert, made = ensure_certificate(hostname, ip)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Couldn't create a certificate — is `openssl` on your PATH?")
        return 1

    state = PadState(load_config())

    try:
        dsu_server = DsuServer(state, port=args.dsu_port)
    except OSError as err:
        print("Couldn't listen on UDP %d: %s" % (args.dsu_port, err))
        print("Another DSU server may already be running.")
        return 1
    dsu_server.start()

    server = BridgeServer((args.host, args.port), state, dsu_server)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, key)
    server.socket = context.wrap_socket(server.socket, server_side=True)

    threading.Thread(target=server.serve_forever, daemon=True).start()

    url = "https://%s:%d" % (hostname, args.port)
    setup_url = "http://%s:%d" % (hostname, args.setup_port)

    setup = None
    try:
        setup = SetupServer((args.host, args.setup_port), ca_cert, url)
        threading.Thread(target=setup.serve_forever, daemon=True).start()
    except OSError as err:
        print("  (couldn't start the setup page on %d: %s)" % (args.setup_port, err))

    dolphin_app = find_dolphin()

    print()
    print("  Wii Bridge is up.")
    print()
    if made:
        print("  1. On your iPhone, open:  %s" % setup_url)
        print("     That page installs the certificate — a one-time thing, and")
        print("     the controller can't connect until it's done.")
    else:
        print("  1. On your iPhone, open:  %s" % url)
        print("     (setup page, if the certificate is gone: %s)" % setup_url)
    print("     By address instead: %s / %s:%d"
          % (url.replace(hostname, ip), ip, args.setup_port))
    print()
    print("  2. In Dolphin: Config -> Controllers -> Alternate Input Sources")
    print("     Tick 'Enable', server %s:%d" % (DSU_HOST, args.dsu_port))
    print()
    print("  3. Wii Remote 1 -> Emulated Wii Remote -> Configure -> Motion Input")
    print("     Click each IMU field and move the phone; it detects as DSUClient/0/…")
    print()
    if dolphin_app:
        print("  Dolphin found at %s — the arcade's Launch button can open it." % dolphin_app)
    elif sys.platform == "darwin":
        print("  Dolphin not found in /Applications, so the Launch button can't open it.")
    print()
    print("  Ctrl-C to stop.")
    print()

    run_status_display(server, state, dsu_server, url)
    dsu_server.stop()
    if setup:
        setup.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
