"""The DSU (cemuhook) UDP protocol, which is how Dolphin takes motion input.

Dolphin has a "DSU Client" under Config -> Controllers -> Alternate Input
Sources. It was built so a DualShock 4's gyro could drive an emulated Wii
Remote. Nothing about it is PlayStation-specific, though: it is just a UDP
server that reports button states plus an accelerometer and a gyroscope. A
phone has both of those, so a phone can be that server.

Layout is from the protocol spec (v1993/cemuhook-protocol). Every integer is
little-endian.

    Header, 16 bytes:
      [0:4]   magic       "DSUC" from a client, "DSUS" from a server
      [4:6]   version     u16, 1001
      [6:8]   length      u16, bytes after the header (message type included)
      [8:12]  CRC32       of the whole packet with this field zeroed
      [12:16] sender id   u32
    Then:
      [16:20] message type u32
      [20:]   payload
"""

import struct
import zlib

PROTOCOL_VERSION = 1001

MSG_VERSION = 0x100000   # "what protocol version do you speak?"
MSG_PORTS = 0x100001     # "which slots have a controller in them?"
MSG_DATA = 0x100002      # "start sending me controller state"

# Slot state
STATE_DISCONNECTED = 0x00
STATE_CONNECTED = 0x02

# Device model. 2 means a full gyro, which is what unlocks Dolphin's IMU
# handling — report anything less and it ignores the motion fields.
MODEL_FULL_GYRO = 0x02

CONNECTION_BLUETOOTH = 0x02
BATTERY_FULL = 0xEF

HEADER_SIZE = 16
DATA_PAYLOAD_SIZE = 80


def pack(msg_type, payload, server_id):
    """Wrap a payload in a server packet, with its CRC filled in.

    The CRC covers the finished packet including its own (zeroed) field, so it
    has to be computed after everything else is in place.
    """
    body = struct.pack("<I", msg_type) + payload
    packet = bytearray(
        b"DSUS"
        + struct.pack("<HH", PROTOCOL_VERSION, len(body))
        + b"\x00\x00\x00\x00"
        + struct.pack("<I", server_id)
        + body
    )
    packet[8:12] = struct.pack("<I", zlib.crc32(bytes(packet)) & 0xFFFFFFFF)
    return bytes(packet)


def parse(packet):
    """Returns (message_type, payload) or None if this isn't a valid request.

    Bad packets are dropped rather than raised on: this listens on a UDP port,
    so anything at all on the network can arrive here.
    """
    if len(packet) < HEADER_SIZE + 4 or packet[0:4] != b"DSUC":
        return None

    length = struct.unpack_from("<H", packet, 6)[0]
    # Some clients pad the datagram, so a longer packet than advertised is
    # fine; a shorter one means the message is truncated.
    if length + HEADER_SIZE > len(packet):
        return None

    claimed = struct.unpack_from("<I", packet, 8)[0]
    zeroed = bytearray(packet)
    zeroed[8:12] = b"\x00\x00\x00\x00"
    if zlib.crc32(bytes(zeroed)) & 0xFFFFFFFF != claimed:
        return None

    msg_type = struct.unpack_from("<I", packet, 16)[0]
    return msg_type, packet[20:HEADER_SIZE + length]


def slot_info(slot, mac, connected=True):
    """The 11-byte block every message about a controller starts with."""
    return struct.pack(
        "<BBBB6sB",
        slot,
        STATE_CONNECTED if connected else STATE_DISCONNECTED,
        MODEL_FULL_GYRO if connected else 0,
        CONNECTION_BLUETOOTH if connected else 0,
        mac if connected else b"\x00" * 6,
        BATTERY_FULL if connected else 0,
    )


def ports_response(slot, mac, connected, server_id):
    return pack(MSG_PORTS, slot_info(slot, mac, connected) + b"\x00", server_id)


def version_response(server_id):
    return pack(MSG_VERSION, struct.pack("<H", PROTOCOL_VERSION), server_id)


def data_response(slot, mac, packet_number, buttons1, buttons2, extra,
                  accel, gyro, motion_timestamp_us, server_id):
    """One controller-state packet.

    `accel` is (x, y, z) in g and `gyro` is (pitch, yaw, roll) in degrees per
    second — the units Dolphin expects, not the ones a browser hands out.

    `motion_timestamp_us` matters more than it looks. Dolphin integrates the
    gyro over the gap between timestamps to work out where the Wii Remote is
    pointing, and skips the update entirely when the timestamp hasn't moved.
    That is deliberately useful: keepalive packets carrying a stale reading can
    reuse the old timestamp and Dolphin will correctly ignore them, instead of
    integrating the same rotation over and over and drifting the pointer.
    """
    payload = bytearray()
    payload += slot_info(slot, mac)
    payload += b"\x01"                                # connected
    payload += struct.pack("<I", packet_number & 0xFFFFFFFF)

    payload += bytes([buttons1, buttons2, extra.get("home", 0), extra.get("touch", 0)])

    # Sticks, then the analog values for every button. All neutral: this is a
    # motion controller, and Dolphin reads the digital bits above for presses.
    payload += bytes([0x80, 0x80, 0x80, 0x80])        # L stick X/Y, R stick X/Y
    payload += bytes(8)                               # analog dpad + face
    payload += bytes(4)                               # analog shoulders
    payload += bytes(12)                              # two inactive touch points

    payload += struct.pack("<Q", motion_timestamp_us)
    payload += struct.pack("<fff", *accel)
    payload += struct.pack("<fff", *gyro)

    assert len(payload) == DATA_PAYLOAD_SIZE, len(payload)
    return pack(MSG_DATA, bytes(payload), server_id)


# ---------------------------------------------------------------------------
# Button bits. These are the DualShock 4's, because that is what the protocol
# was written around; Dolphin surfaces them under those names in its binding
# UI, and you map them onto Wii Remote buttons there.

BUTTONS1 = {
    "share": 0x01, "l3": 0x02, "r3": 0x04, "options": 0x08,
    "up": 0x10, "right": 0x20, "down": 0x40, "left": 0x80,
}

BUTTONS2 = {
    "l2": 0x01, "r2": 0x02, "l1": 0x04, "r1": 0x08,
    "triangle": 0x10, "circle": 0x20, "cross": 0x40, "square": 0x80,
}
