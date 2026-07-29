"""A small 6502 assembler and NES tile helpers, shared by the game builds.

Only the opcodes and addressing modes these games use. Labels are resolved in
a second pass, so code can branch and jump forwards.
"""

IMPLIED = {
    "sei": 0x78, "cld": 0xD8, "clc": 0x18, "sec": 0x38, "txs": 0x9A,
    "txa": 0x8A, "tax": 0xAA, "tay": 0xA8, "tya": 0x98, "inx": 0xE8,
    "iny": 0xC8, "dex": 0xCA, "dey": 0x88, "rts": 0x60, "rti": 0x40,
    "pha": 0x48, "pla": 0x68, "lsr_a": 0x4A, "asl_a": 0x0A, "nop": 0xEA,
    "rol_a": 0x2A, "ror_a": 0x6A,
}

IMM = {"lda": 0xA9, "ldx": 0xA2, "ldy": 0xA0, "cmp": 0xC9, "cpx": 0xE0,
       "cpy": 0xC0, "adc": 0x69, "sbc": 0xE9, "and": 0x29, "ora": 0x09,
       "eor": 0x49}
ZP = {"lda": 0xA5, "sta": 0x85, "ldx": 0xA6, "stx": 0x86, "ldy": 0xA4,
      "sty": 0x84, "cmp": 0xC5, "adc": 0x65, "sbc": 0xE5, "inc": 0xE6,
      "dec": 0xC6, "and": 0x25, "ora": 0x05, "eor": 0x45}
ABS = {"lda": 0xAD, "sta": 0x8D, "ldx": 0xAE, "stx": 0x8E, "ldy": 0xAC,
       "sty": 0x8C, "cmp": 0xCD, "bit": 0x2C, "jmp": 0x4C, "jsr": 0x20,
       "inc": 0xEE, "dec": 0xCE}
ABS_X = {"lda": 0xBD, "sta": 0x9D}
ZP_X = {"lda": 0xB5, "sta": 0x95}
BRANCH = {"bne": 0xD0, "beq": 0xF0, "bpl": 0x10, "bmi": 0x30,
          "bcc": 0x90, "bcs": 0xB0}


class Asm:
    """Emits 6502 machine code. Every method returns self, so calls chain."""

    def __init__(self, origin):
        self.origin = origin
        self.code = bytearray()
        self.labels = {}
        self.fixups = []          # (offset, label, kind)

    @property
    def pc(self):
        return self.origin + len(self.code)

    def label(self, name):
        if name in self.labels:
            raise ValueError("duplicate label: " + name)
        self.labels[name] = self.pc
        return self

    def _emit(self, *values):
        self.code.extend(values)

    def op(self, name):
        self._emit(IMPLIED[name])
        return self

    def imm(self, name, value):
        self._emit(IMM[name], value & 0xFF)
        return self

    def zp(self, name, addr):
        self._emit(ZP[name], addr & 0xFF)
        return self

    def zpx(self, name, addr):
        self._emit(ZP_X[name], addr & 0xFF)
        return self

    def abs(self, name, addr):
        if isinstance(addr, str):
            self._emit(ABS[name], 0, 0)
            self.fixups.append((len(self.code) - 2, addr, "abs"))
        else:
            self._emit(ABS[name], addr & 0xFF, (addr >> 8) & 0xFF)
        return self

    def absx(self, name, addr):
        if isinstance(addr, str):
            self._emit(ABS_X[name], 0, 0)
            self.fixups.append((len(self.code) - 2, addr, "abs"))
        else:
            self._emit(ABS_X[name], addr & 0xFF, (addr >> 8) & 0xFF)
        return self

    def branch(self, name, target):
        self._emit(BRANCH[name], 0)
        self.fixups.append((len(self.code) - 1, target, "rel"))
        return self

    def byte(self, *values):
        self._emit(*[v & 0xFF for v in values])
        return self

    def link(self):
        for offset, name, kind in self.fixups:
            if name not in self.labels:
                raise KeyError("undefined label: " + name)
            target = self.labels[name]
            if kind == "abs":
                self.code[offset] = target & 0xFF
                self.code[offset + 1] = (target >> 8) & 0xFF
            else:
                delta = target - (self.origin + offset + 1)
                if not -128 <= delta <= 127:
                    raise ValueError(
                        "branch to %s is %d bytes away, limit is 127" % (name, delta))
                self.code[offset] = delta & 0xFF
        return bytes(self.code)


# --------------------------------------------------------------------------
# Graphics. A tile is 8x8, two bits per pixel, stored as two 8-byte bitplanes.
# --------------------------------------------------------------------------

def tile(rows):
    """rows: 8 strings of 8 chars, each '0'-'3' choosing a palette entry."""
    if len(rows) != 8 or any(len(r) != 8 for r in rows):
        raise ValueError("a tile must be 8 rows of 8 characters")
    plane0 = bytearray()
    plane1 = bytearray()
    for row in rows:
        low = high = 0
        for x, ch in enumerate(row):
            value = int(ch)
            low |= (value & 1) << (7 - x)
            high |= ((value >> 1) & 1) << (7 - x)
        plane0.append(low)
        plane1.append(high)
    return bytes(plane0 + plane1)


BLANK = tile(["00000000"] * 8)


def split16(grid):
    """Cut a 16x16 grid into four tiles, in the order OAM draws them."""
    if len(grid) != 16 or any(len(r) != 16 for r in grid):
        raise ValueError("expected a 16x16 grid")
    quads = []
    for row_offset in (0, 8):
        for col_offset in (0, 8):
            quads.append(tile([
                grid[row_offset + r][col_offset:col_offset + 8] for r in range(8)
            ]))
    return quads          # top-left, top-right, bottom-left, bottom-right


DIGIT_ROWS = [
    ["02222200", "02200220", "02200220", "02200220", "02200220", "02200220", "02222200", "00000000"],
    ["00022000", "00222000", "00022000", "00022000", "00022000", "00022000", "02222220", "00000000"],
    ["02222200", "00000220", "00000220", "02222200", "02200000", "02200000", "02222220", "00000000"],
    ["02222200", "00000220", "00000220", "00222200", "00000220", "00000220", "02222200", "00000000"],
    ["02200220", "02200220", "02200220", "02222220", "00000220", "00000220", "00000220", "00000000"],
    ["02222220", "02200000", "02200000", "02222200", "00000220", "00000220", "02222200", "00000000"],
    ["02222200", "02200000", "02200000", "02222200", "02200220", "02200220", "02222200", "00000000"],
    ["02222220", "00000220", "00000220", "00002200", "00022000", "00022000", "00022000", "00000000"],
    ["02222200", "02200220", "02200220", "02222200", "02200220", "02200220", "02222200", "00000000"],
    ["02222200", "02200220", "02200220", "02222200", "00000220", "00000220", "02222200", "00000000"],
]


def ines(prg, chr_rom, mapper_flags=0x01):
    """Wrap a 16 KB PRG bank and 8 KB CHR bank in an iNES header."""
    if len(prg) != 16384:
        raise ValueError("PRG must be exactly 16384 bytes")
    if len(chr_rom) != 8192:
        raise ValueError("CHR must be exactly 8192 bytes")
    header = bytes([0x4E, 0x45, 0x53, 0x1A, 1, 1, mapper_flags,
                    0, 0, 0, 0, 0, 0, 0, 0, 0])
    return header + prg + chr_rom


def with_vectors(asm, code, nmi="nmi", reset="reset", irq="irq"):
    """Place code at the bottom of a 16 KB bank and the vectors at the top."""
    prg = bytearray(b"\xEA" * 16384)
    if len(code) > 16384 - 6:
        raise ValueError("code does not fit in one bank")
    prg[0:len(code)] = code
    for offset, name in ((0x3FFA, nmi), (0x3FFC, reset), (0x3FFE, irq)):
        address = asm.labels[name]
        prg[offset] = address & 0xFF
        prg[offset + 1] = address >> 8
    return bytes(prg)
