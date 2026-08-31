#!/usr/bin/env python3
"""Checks for the bridge.

    python3 test_bridge.py

The DSU protocol is a wire format with a checksum, so being nearly right
produces nothing at all — Dolphin drops the packet and the controller simply
never appears, with no error anywhere to explain why. So the packets are
decoded here by a reader written against the spec independently of the writer,
and the servers are exercised over real sockets rather than called directly.
"""

import json
import os
import socket
import ssl
import struct
import sys
import threading
import time
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dsu
import wsframe
import wiibridge

PASSED = 0
FAILED = []


def check(name, condition, detail=""):
    global PASSED
    if condition:
        PASSED += 1
    else:
        FAILED.append(name + ((" — " + str(detail)) if detail else ""))


def near(a, b, tolerance=1e-4):
    return abs(a - b) < tolerance


# ---------------------------------------------------------------------------
# An independent decoder, written from the spec rather than from dsu.py, so a
# misreading in one doesn't cancel out in the other.


def decode_server_packet(packet):
    assert packet[0:4] == b"DSUS", "magic"
    version, length = struct.unpack_from("<HH", packet, 4)
    crc = struct.unpack_from("<I", packet, 8)[0]
    server_id = struct.unpack_from("<I", packet, 12)[0]

    blanked = bytearray(packet)
    blanked[8:12] = b"\x00\x00\x00\x00"
    assert zlib.crc32(bytes(blanked)) & 0xFFFFFFFF == crc, "crc"
    assert length == len(packet) - 16, "length field"

    return {
        "version": version,
        "server_id": server_id,
        "type": struct.unpack_from("<I", packet, 16)[0],
        "payload": packet[20:],
    }


def decode_data_payload(payload):
    assert len(payload) == 80, "data payload is 80 bytes, got %d" % len(payload)
    slot, state, model, conn = payload[0:4]
    mac = payload[4:10]
    battery = payload[10]
    connected = payload[11]
    number = struct.unpack_from("<I", payload, 12)[0]
    buttons1, buttons2, home, touch = payload[16:20]
    # 20 sticks(4) 24 analog dpad+face(8) 32 analog shoulders(4)
    # 36 two touch points(12) 48 timestamp(8) 56 accel(12) 68 gyro(12) = 80
    timestamp = struct.unpack_from("<Q", payload, 48)[0]
    accel = struct.unpack_from("<fff", payload, 56)
    gyro = struct.unpack_from("<fff", payload, 68)
    return {
        "slot": slot, "state": state, "model": model, "conn": conn,
        "mac": mac, "battery": battery, "connected": connected,
        "number": number, "buttons1": buttons1, "buttons2": buttons2,
        "home": home, "touch": touch,
        "timestamp": timestamp, "accel": accel, "gyro": gyro,
    }


def client_packet(msg_type, payload, client_id=0x1234ABCD):
    body = struct.pack("<I", msg_type) + payload
    packet = bytearray(
        b"DSUC" + struct.pack("<HH", 1001, len(body))
        + b"\x00\x00\x00\x00" + struct.pack("<I", client_id) + body)
    packet[8:12] = struct.pack("<I", zlib.crc32(bytes(packet)) & 0xFFFFFFFF)
    return bytes(packet)


# ---------------------------------------------------------------------------
# Packet format


def test_packet_format():
    packet = dsu.version_response(0xDEADBEEF)
    decoded = decode_server_packet(packet)
    check("version packet type", decoded["type"] == dsu.MSG_VERSION)
    check("version packet protocol", decoded["version"] == 1001)
    check("version packet server id", decoded["server_id"] == 0xDEADBEEF)
    check("version packet reports 1001",
          struct.unpack("<H", decoded["payload"][:2])[0] == 1001)

    ports = dsu.ports_response(0, b"WIIBR\x01", True, 1)
    payload = decode_server_packet(ports)["payload"]
    check("ports payload is 12 bytes", len(payload) == 12, len(payload))
    check("ports slot", payload[0] == 0)
    check("ports state connected", payload[1] == dsu.STATE_CONNECTED)
    check("ports model is full gyro", payload[2] == dsu.MODEL_FULL_GYRO)

    empty = decode_server_packet(dsu.ports_response(3, b"WIIBR\x01", False, 1))["payload"]
    check("empty slot reports disconnected", empty[1] == dsu.STATE_DISCONNECTED)
    check("empty slot keeps its index", empty[0] == 3)

    data = dsu.data_response(
        slot=0, mac=b"WIIBR\x01", packet_number=7,
        buttons1=dsu.BUTTONS1["options"], buttons2=dsu.BUTTONS2["cross"],
        extra={"home": 1, "touch": 0},
        accel=(0.25, -0.5, 1.0), gyro=(10.0, -20.0, 30.0),
        motion_timestamp_us=123456789, server_id=1)
    payload = decode_server_packet(data)["payload"]
    fields = decode_data_payload(payload)

    check("data packet number", fields["number"] == 7)
    check("data marks pad connected", fields["connected"] == 1)
    check("data button set 1", fields["buttons1"] == 0x08, hex(fields["buttons1"]))
    check("data button set 2", fields["buttons2"] == 0x40, hex(fields["buttons2"]))
    check("data home byte", fields["home"] == 1)
    check("data timestamp", fields["timestamp"] == 123456789)
    check("data accel x", near(fields["accel"][0], 0.25), fields["accel"])
    check("data accel y", near(fields["accel"][1], -0.5), fields["accel"])
    check("data accel z", near(fields["accel"][2], 1.0), fields["accel"])
    check("data gyro pitch", near(fields["gyro"][0], 10.0), fields["gyro"])
    check("data gyro yaw", near(fields["gyro"][1], -20.0), fields["gyro"])
    check("data gyro roll", near(fields["gyro"][2], 30.0), fields["gyro"])

    check("total data packet is 100 bytes", len(data) == 100, len(data))


def test_parse_rejects_junk():
    good = client_packet(dsu.MSG_VERSION, b"")
    check("parses a valid request", dsu.parse(good) is not None)

    check("rejects empty", dsu.parse(b"") is None)
    check("rejects wrong magic", dsu.parse(b"XXXX" + good[4:]) is None)

    corrupt = bytearray(good)
    corrupt[-1] ^= 0xFF
    check("rejects a bad CRC", dsu.parse(bytes(corrupt)) is None)

    truncated = good[:18]
    check("rejects a truncated packet", dsu.parse(truncated) is None)

    lying = bytearray(client_packet(dsu.MSG_PORTS, b"\x01\x00\x00\x00\x00"))
    struct.pack_into("<H", lying, 6, 9999)   # claims more data than it carries
    lying[8:12] = b"\x00\x00\x00\x00"
    lying[8:12] = struct.pack("<I", zlib.crc32(bytes(lying)) & 0xFFFFFFFF)
    check("rejects an overlong length field", dsu.parse(bytes(lying)) is None)


# ---------------------------------------------------------------------------
# WebSocket framing


def test_websocket_framing():
    # The one worked example in RFC 6455 section 1.3.
    check("handshake accept key",
          wsframe.accept_key("dGhlIHNhbXBsZSBub25jZQ==") == "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=")

    def masked(payload, opcode=wsframe.OP_TEXT):
        mask = bytes([0x37, 0xFA, 0x21, 0x3D])
        body = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        header = bytearray([0x80 | opcode])
        if len(payload) < 126:
            header.append(0x80 | len(payload))
        else:
            header.append(0x80 | 126)
            header += struct.pack(">H", len(payload))
        return bytes(header) + mask + body

    reader = wsframe.Reader()
    frames = reader.feed(masked(b"hello"))
    check("unmasks a short frame", frames == [(wsframe.OP_TEXT, b"hello")], frames)

    # Two frames in one read, which is what a burst of motion samples looks
    # like when the network coalesces them.
    reader = wsframe.Reader()
    frames = reader.feed(masked(b"one") + masked(b"two"))
    check("splits two frames from one chunk",
          frames == [(wsframe.OP_TEXT, b"one"), (wsframe.OP_TEXT, b"two")], frames)

    # One frame split across two reads, which is the same burst arriving
    # differently — the case that breaks a naive implementation.
    reader = wsframe.Reader()
    whole = masked(b"abcdefghij")
    check("holds an incomplete frame", reader.feed(whole[:6]) == [])
    check("completes it on the next read",
          reader.feed(whole[6:]) == [(wsframe.OP_TEXT, b"abcdefghij")])

    reader = wsframe.Reader()
    big = b"x" * 300
    check("handles a 16-bit length", reader.feed(masked(big)) == [(wsframe.OP_TEXT, big)])

    reader = wsframe.Reader()
    check("passes close through",
          reader.feed(masked(b"", wsframe.OP_CLOSE)) == [(wsframe.OP_CLOSE, b"")])

    encoded = wsframe.encode("hi")
    check("server frames are unmasked", (encoded[1] & 0x80) == 0)
    check("server frame payload", encoded[2:] == b"hi")


# ---------------------------------------------------------------------------
# The DSU server, over a real socket


def test_dsu_server():
    state = wiibridge.PadState(wiibridge.load_config())
    server = wiibridge.DsuServer(state, host="127.0.0.1", port=27600)
    server.start()
    time.sleep(0.1)

    client = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    client.settimeout(2.0)
    target = ("127.0.0.1", 27600)

    try:
        client.sendto(client_packet(dsu.MSG_VERSION, b""), target)
        reply = decode_server_packet(client.recvfrom(2048)[0])
        check("server answers a version request", reply["type"] == dsu.MSG_VERSION)

        # Ask about four slots, the way Dolphin does.
        client.sendto(
            client_packet(dsu.MSG_PORTS, struct.pack("<I", 4) + bytes([0, 1, 2, 3])),
            target)
        seen = {}
        for _ in range(4):
            payload = decode_server_packet(client.recvfrom(2048)[0])["payload"]
            seen[payload[0]] = payload[1]
        check("answers about every slot asked for", sorted(seen) == [0, 1, 2, 3], seen)
        check("slot 0 is our pad", seen.get(0) == dsu.STATE_CONNECTED)
        check("slots 1-3 are empty",
              all(seen.get(i) == dsu.STATE_DISCONNECTED for i in (1, 2, 3)), seen)

        # Subscribe, then feed the bridge a sample as if from the phone.
        client.sendto(
            client_packet(dsu.MSG_DATA, b"\x00\x00" + b"\x00" * 6), target)

        state.apply_sample({
            "a": [0.0, 0.0, 9.80665],          # flat, screen up
            "g": [1.0, 2.0, 3.0],
            "b": [dsu.BUTTONS1["options"], dsu.BUTTONS2["cross"], 0],
        })

        fields = None
        deadline = time.time() + 2.0
        while time.time() < deadline:
            fields = decode_data_payload(
                decode_server_packet(client.recvfrom(2048)[0])["payload"])
            if fields["buttons2"]:
                break
        check("streams data once subscribed", fields is not None)
        check("m/s^2 converted to g", near(fields["accel"][2], 1.0), fields["accel"])
        check("gyro passed through as deg/s",
              near(fields["gyro"][0], 1.0) and near(fields["gyro"][1], 2.0), fields["gyro"])
        check("plus button reaches the wire", fields["buttons1"] == 0x08, hex(fields["buttons1"]))
        check("A button reaches the wire", fields["buttons2"] == 0x40, hex(fields["buttons2"]))

        # The timestamp must hold still between samples: Dolphin integrates
        # the gyro over its delta, and a keepalive that bumps it would spin
        # the pointer while the phone sits on the table.
        first = decode_data_payload(
            decode_server_packet(client.recvfrom(2048)[0])["payload"])
        time.sleep(0.25)
        second = decode_data_payload(
            decode_server_packet(client.recvfrom(2048)[0])["payload"])
        check("keepalives reuse the motion timestamp",
              first["timestamp"] == second["timestamp"],
              (first["timestamp"], second["timestamp"]))
        check("keepalives still advance the packet counter",
              second["number"] > first["number"])

        state.apply_sample({"a": [0.0, 0.0, 9.80665], "g": [0.0, 0.0, 0.0]})
        third = None
        deadline = time.time() + 2.0
        while time.time() < deadline:
            third = decode_data_payload(
                decode_server_packet(client.recvfrom(2048)[0])["payload"])
            if third["timestamp"] != second["timestamp"]:
                break
        check("a new sample advances the timestamp",
              third["timestamp"] > second["timestamp"])

        # A dropped phone must not leave a button held down in Dolphin.
        state.apply_sample({
            "a": [0.0, 0.0, 9.80665], "g": [0, 0, 0],
            "b": [0, dsu.BUTTONS2["cross"], 0]})
        state.set_phone_connected(False)
        released = None
        deadline = time.time() + 2.0
        while time.time() < deadline:
            released = decode_data_payload(
                decode_server_packet(client.recvfrom(2048)[0])["payload"])
            if released["buttons2"] == 0:
                break
        check("losing the phone releases every button",
              released["buttons2"] == 0, hex(released["buttons2"]))
    finally:
        client.close()
        server.stop()


def test_invert_applies():
    config = json.loads(json.dumps(wiibridge.DEFAULT_CONFIG))
    config["invert"]["accel_z"] = -1
    config["invert"]["gyro_yaw"] = -1
    state = wiibridge.PadState(config)
    state.apply_sample({"a": [0.0, 0.0, 9.80665], "g": [1.0, 2.0, 3.0]})
    snap = state.snapshot()
    check("accel inversion applied", near(snap["accel"][2], -1.0), snap["accel"])
    check("gyro inversion applied", near(snap["gyro"][1], -2.0), snap["gyro"])
    check("untouched axes stay put", near(snap["gyro"][0], 1.0), snap["gyro"])


def test_bad_samples_ignored():
    state = wiibridge.PadState(wiibridge.load_config())
    state.apply_sample({"a": [0.0, 0.0, 9.80665], "g": [0.0, 0.0, 0.0]})
    baseline = state.snapshot()

    for junk in ({}, {"a": [1, 2]}, {"a": "nope", "g": [1, 2, 3]},
                 {"a": [1, 2, 3]}, {"a": [None, None, None], "g": [1, 2, 3]}):
        state.apply_sample(junk)

    after = state.snapshot()
    check("malformed samples leave the pad alone",
          after["samples"] == baseline["samples"], (baseline["samples"], after["samples"]))


# ---------------------------------------------------------------------------
# HTTPS + WebSocket, end to end


def test_https_and_websocket():
    hostname = wiibridge.local_hostname()
    ip = wiibridge.local_ip()
    cert, key, ca_cert, _ = wiibridge.ensure_certificate(hostname, ip)
    check("certificates written",
          all(os.path.exists(p) for p in (cert, key, ca_cert)))

    text = os.popen("openssl x509 -in %s -noout -text" % cert).read()
    check("certificate carries a SAN", "Subject Alternative Name" in text)
    check("SAN names this machine", hostname in text)
    check("SAN includes the LAN address", ip in text)
    # iOS ignores the common name and refuses a server certificate lacking
    # serverAuth, so both of these are load-bearing rather than tidiness.
    check("certificate is serverAuth", "TLS Web Server Authentication" in text)
    check("certificate is sha256", "sha256" in text.lower())
    check("certificate is not itself a CA", "CA:FALSE" in text)

    ca_text = os.popen("openssl x509 -in %s -noout -text" % ca_cert).read()
    # Only a CA gets a switch in iOS's Certificate Trust Settings, and without
    # that switch the WebSocket is refused even though the page loads.
    check("the CA really is a CA", "CA:TRUE" in ca_text)
    check("CA can sign certificates", "Certificate Sign" in ca_text)

    # Both must stay under iOS's 825-day ceiling for server certificates.
    for label, path in (("leaf", cert), ("CA", ca_cert)):
        dates = os.popen("openssl x509 -in %s -noout -dates" % path).read()
        start = dates.split("notBefore=")[1].split("\n")[0].strip()
        end = dates.split("notAfter=")[1].split("\n")[0].strip()
        fmt = "%b %d %H:%M:%S %Y %Z"
        import datetime
        span = (datetime.datetime.strptime(end, fmt)
                - datetime.datetime.strptime(start, fmt)).days
        check("%s validity is under iOS's 825-day limit" % label, span < 825, span)

    # The chain the server presents has to include the CA, or a phone that
    # trusts the CA still can't build a path to the leaf.
    with open(cert) as handle:
        chain_text = handle.read()
    check("served chain includes both certificates",
          chain_text.count("BEGIN CERTIFICATE") == 2,
          chain_text.count("BEGIN CERTIFICATE"))

    verified = os.popen(
        "openssl verify -CAfile %s %s 2>&1" % (ca_cert, cert)).read()
    check("leaf verifies against the CA", ": OK" in verified, verified.strip())

    state = wiibridge.PadState(wiibridge.load_config())
    dsu_server = wiibridge.DsuServer(state, host="127.0.0.1", port=27601)
    dsu_server.start()

    server = wiibridge.BridgeServer(("127.0.0.1", 0), state, dsu_server)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, key)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    port = server.socket.getsockname()[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    time.sleep(0.1)

    client_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    client_context.check_hostname = False
    client_context.verify_mode = ssl.CERT_NONE

    def open_tls():
        raw = socket.create_connection(("127.0.0.1", port), timeout=5)
        return client_context.wrap_socket(raw)

    try:
        # The page itself.
        conn = open_tls()
        conn.sendall(b"GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        response = b""
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            response += chunk
        conn.close()
        check("serves the controller page over TLS", b"200 OK" in response)
        check("page is the controller", b"Wii Bridge" in response)
        check("page asks for motion permission", b"requestPermission" in response)

        # The socket.
        conn = open_tls()
        conn.sendall(
            b"GET /ws HTTP/1.1\r\nHost: localhost\r\n"
            b"Upgrade: websocket\r\nConnection: Upgrade\r\n"
            b"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
            b"Sec-WebSocket-Version: 13\r\n\r\n")
        handshake = conn.recv(4096)
        check("upgrades to a websocket", b"101 Switching Protocols" in handshake)
        check("returns the derived accept key",
              b"s3pPLMBiTxaQ9kYGzzhZRbK+xOo=" in handshake, handshake[:200])

        def send(payload):
            mask = bytes([0x11, 0x22, 0x33, 0x44])
            body = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            header = bytearray([0x81])
            if len(payload) < 126:
                header.append(0x80 | len(payload))
            else:
                header.append(0x80 | 126)
                header += struct.pack(">H", len(payload))
            conn.sendall(bytes(header) + mask + body)

        send(json.dumps({
            "a": [0.0, 9.80665, 0.0],
            "g": [5.0, 0.0, 0.0],
            "b": [0, dsu.BUTTONS2["circle"], 0],
        }).encode())

        deadline = time.time() + 2.0
        snap = None
        while time.time() < deadline:
            snap = state.snapshot()
            if snap["samples"]:
                break
            time.sleep(0.02)
        check("a websocket sample reaches the pad", snap and snap["samples"] >= 1)
        check("sample converted to g", snap and near(snap["accel"][1], 1.0), snap["accel"])
        check("sample buttons decoded", snap and snap["buttons2"] == dsu.BUTTONS2["circle"])

        # Round-trip ping, which is what the phone's latency readout uses.
        send(json.dumps({"ping": 1234}).encode())
        reader = wsframe.Reader()
        conn.settimeout(2.0)
        pong = None
        deadline = time.time() + 2.0
        while time.time() < deadline and pong is None:
            for opcode, payload in reader.feed(conn.recv(4096)):
                if opcode == wsframe.OP_TEXT:
                    pong = json.loads(payload)
        check("ping is echoed", pong == {"pong": 1234}, pong)

        conn.close()

        # Closing the socket has to release the pad, or a phone that walks out
        # of Wi-Fi range leaves Dolphin holding whatever was pressed.
        deadline = time.time() + 2.0
        while time.time() < deadline:
            if not state.snapshot()["phone_connected"]:
                break
            time.sleep(0.05)
        check("dropping the socket releases the pad",
              state.snapshot()["buttons2"] == 0)
    finally:
        server.shutdown()
        server.server_close()
        dsu_server.stop()


def test_setup_server():
    """The plain-HTTP page that bootstraps trust on the phone."""
    hostname = wiibridge.local_hostname()
    _, _, ca_cert, _ = wiibridge.ensure_certificate(hostname, wiibridge.local_ip())

    server = wiibridge.SetupServer(("127.0.0.1", 0), ca_cert, "https://example:8443")
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    time.sleep(0.1)

    def get(path):
        conn = socket.create_connection(("127.0.0.1", port), timeout=5)
        conn.sendall(("GET %s HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n"
                      % path).encode())
        data = b""
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            data += chunk
        conn.close()
        return data

    try:
        page = get("/")
        check("setup page serves", b"200 OK" in page)
        check("setup page explains the trust switch",
              b"Certificate Trust Settings" in page)
        check("setup page links the certificate", b'href="/ca.cer"' in page)

        cer = get("/ca.cer")
        # Without this exact content type iOS renders the certificate as text
        # instead of offering to install it.
        check("certificate served as a profile",
              b"application/x-x509-ca-cert" in cer, cer[:200])
        check("certificate body is the CA", b"BEGIN CERTIFICATE" in cer)

        with open(ca_cert, "rb") as handle:
            check("serves exactly the CA on disk", handle.read() in cer)

        # The private key must never be reachable, by any path.
        for path in ("/key.pem", "/ca-key.pem", "/.cert/ca-key.pem", "/chain.pem"):
            check("setup server refuses %s" % path, b"404" in get(path))
    finally:
        server.shutdown()
        server.server_close()


def test_launch_endpoint():
    state = wiibridge.PadState(wiibridge.load_config())
    dsu_server = wiibridge.DsuServer(state, host="127.0.0.1", port=27602)
    dsu_server.start()
    server = wiibridge.BridgeServer(("127.0.0.1", 0), state, dsu_server)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    time.sleep(0.1)

    def request(method, path, body=b""):
        conn = socket.create_connection(("127.0.0.1", port), timeout=5)
        head = ("%s %s HTTP/1.1\r\nHost: x\r\nOrigin: https://example.github.io\r\n"
                "Content-Length: %d\r\nConnection: close\r\n\r\n"
                % (method, path, len(body))).encode()
        conn.sendall(head + body)
        data = b""
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            data += chunk
        conn.close()
        return data

    try:
        # The arcade page is served from another origin, so without CORS the
        # button can't even ask.
        preflight = request("OPTIONS", "/launch")
        check("preflight allowed", b"204" in preflight)
        check("preflight advertises POST", b"POST" in preflight)
        check("preflight allows any origin",
              b"Access-Control-Allow-Origin: *" in preflight)

        response = request("POST", "/launch")
        check("launch answers", b"200 OK" in response)
        check("launch response carries CORS",
              b"Access-Control-Allow-Origin: *" in response)
        payload = json.loads(response.split(b"\r\n\r\n", 1)[1])
        check("launch reports a result", "ok" in payload and "message" in payload)
        # This container is not a Mac, so it must decline rather than pretend.
        if sys.platform != "darwin":
            check("declines cleanly when not on a Mac", payload["ok"] is False)
            check("says why", "Mac" in payload["message"], payload["message"])

        status = json.loads(request("GET", "/status").split(b"\r\n\r\n", 1)[1])
        check("status advertises the bridge", status.get("bridge") is True)
        check("status reports whether Dolphin can be opened", "canLaunch" in status)
        check("status reports whether Dolphin is listening", "dolphin" in status)
    finally:
        server.shutdown()
        server.server_close()
        dsu_server.stop()


def test_find_dolphin_is_safe():
    """Must never raise: it runs inside a request handler."""
    try:
        result = wiibridge.find_dolphin()
        check("find_dolphin returns a path or None",
              result is None or isinstance(result, str))
    except Exception as err:
        check("find_dolphin doesn't raise", False, err)

    ok, message = wiibridge.launch_dolphin()
    check("launch_dolphin returns a pair",
          isinstance(ok, bool) and isinstance(message, str))


def main():
    for test in (test_packet_format, test_parse_rejects_junk, test_websocket_framing,
                 test_dsu_server, test_invert_applies, test_bad_samples_ignored,
                 test_setup_server, test_launch_endpoint, test_find_dolphin_is_safe,
                 test_https_and_websocket):
        try:
            test()
        except Exception as err:
            FAILED.append("%s raised %s: %s" % (test.__name__, type(err).__name__, err))

    print()
    if FAILED:
        print("  %d passed, %d FAILED" % (PASSED, len(FAILED)))
        for failure in FAILED:
            print("    x %s" % failure)
        return 1
    print("  %d checks passed." % PASSED)
    return 0


if __name__ == "__main__":
    sys.exit(main())
