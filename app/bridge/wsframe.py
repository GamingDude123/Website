"""Just enough WebSocket to carry motion samples, using only the standard
library.

The bridge is meant to be run with `python3 wiibridge.py` and nothing else —
no pip, no virtualenv, on a Mac that has whatever Python came with it. That
rules out the `websockets` package, and the server half of RFC 6455 is small
enough to write out: a handshake, and frames that are never fragmented because
neither side sends anything close to a megabyte.
"""

import base64
import hashlib
import struct

GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

OP_CONTINUATION = 0x0
OP_TEXT = 0x1
OP_BINARY = 0x2
OP_CLOSE = 0x8
OP_PING = 0x9
OP_PONG = 0xA

# A motion sample is a couple of hundred bytes. Anything far past that is
# either a bug or someone poking at the port, and is not worth buffering.
MAX_PAYLOAD = 64 * 1024


def accept_key(client_key):
    """The handshake response value: the client's key, salted and hashed."""
    digest = hashlib.sha1(client_key.strip().encode("ascii") + GUID).digest()
    return base64.b64encode(digest).decode("ascii")


def encode(payload, opcode=OP_TEXT):
    """Frame a message. Server-to-client frames are never masked."""
    if isinstance(payload, str):
        payload = payload.encode("utf-8")

    header = bytearray([0x80 | opcode])
    length = len(payload)
    if length < 126:
        header.append(length)
    elif length < 65536:
        header.append(126)
        header += struct.pack(">H", length)
    else:
        header.append(127)
        header += struct.pack(">Q", length)
    return bytes(header) + payload


class Reader:
    """Feed it bytes off the socket, take finished frames out.

    A socket hands over whatever happened to arrive, which may be half a frame
    or three of them, so the split has to be tracked across reads rather than
    assumed to line up.
    """

    def __init__(self):
        self._buffer = bytearray()

    def feed(self, chunk):
        """Returns a list of (opcode, payload) for every frame now complete."""
        self._buffer += chunk
        frames = []
        while True:
            frame = self._take_one()
            if frame is None:
                return frames
            frames.append(frame)

    def _take_one(self):
        buf = self._buffer
        if len(buf) < 2:
            return None

        opcode = buf[0] & 0x0F
        masked = bool(buf[1] & 0x80)
        length = buf[1] & 0x7F
        offset = 2

        if length == 126:
            if len(buf) < offset + 2:
                return None
            length = struct.unpack_from(">H", buf, offset)[0]
            offset += 2
        elif length == 127:
            if len(buf) < offset + 8:
                return None
            length = struct.unpack_from(">Q", buf, offset)[0]
            offset += 8

        if length > MAX_PAYLOAD:
            raise ValueError("frame too large: %d bytes" % length)

        mask = b""
        if masked:
            if len(buf) < offset + 4:
                return None
            mask = bytes(buf[offset:offset + 4])
            offset += 4

        if len(buf) < offset + length:
            return None

        payload = bytes(buf[offset:offset + length])
        del self._buffer[:offset + length]

        if masked:
            payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        return opcode, payload
