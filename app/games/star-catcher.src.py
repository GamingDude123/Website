"""Builds 'Star Catcher', an original NES game, as a real .nes ROM.

Written from scratch: a tiny 6502 assembler, hand-drawn tile graphics, and the
game itself. Move the smiley with the D-pad, touch the star, score goes up.

No copyrighted material anywhere in here — it exists so there is something to
play immediately without hunting for a ROM.
"""

# --------------------------------------------------------------------------
# A very small 6502 assembler: two passes, just the opcodes this game uses.
# --------------------------------------------------------------------------

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
    def __init__(self, origin):
        self.origin = origin
        self.code = bytearray()
        self.labels = {}
        self.fixups = []          # (offset, label, kind)

    @property
    def pc(self):
        return self.origin + len(self.code)

    def label(self, name):
        self.labels[name] = self.pc
        return self

    def _emit(self, *values):
        self.code.extend(values)

    # -- addressing modes ---------------------------------------------------
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
                    raise ValueError("branch out of range to " + name)
                self.code[offset] = delta & 0xFF
        return bytes(self.code)


# --------------------------------------------------------------------------
# Graphics. Each tile is 8x8, two bits per pixel, stored as two bitplanes.
# --------------------------------------------------------------------------

def tile(rows):
    """rows: 8 strings of 8 chars, each '0'-'3' selecting a palette entry."""
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

# A 16x16 smiley, split into four 8x8 tiles.
FACE = [
    "0000011111100000",
    "0000111111110000",
    "0011111111111100",
    "0111111111111110",
    "0111133113311110",
    "1111133113311111",
    "1111133113311111",
    "1111111111111111",
    "1111111111111111",
    "1111133333311111",
    "1111333333331111",
    "0111133333311110",
    "0111113333111110",
    "0011111111111100",
    "0000111111110000",
    "0000011111100000",
]


def split16(grid):
    """Cut a 16x16 grid into the four tiles the NES draws it with."""
    quads = []
    for row_offset in (0, 8):
        for col_offset in (0, 8):
            quads.append(tile([
                grid[row_offset + r][col_offset:col_offset + 8] for r in range(8)
            ]))
    # OAM order is top-left, top-right, bottom-left, bottom-right.
    return [quads[0], quads[1], quads[2], quads[3]]


STAR = tile([
    "00022000",
    "00022000",
    "02222220",
    "00222200",
    "00222200",
    "02200220",
    "02000020",
    "00000000",
])

DIGITS = [
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


def build_chr():
    chr_rom = bytearray()
    chr_rom += BLANK                       # $00 blank
    for quad in split16(FACE):             # $01..$04 player
        chr_rom += quad
    chr_rom += STAR                        # $05 star
    while len(chr_rom) < 0x10 * 16:        # pad up to tile $10
        chr_rom += BLANK
    for digit in DIGITS:                   # $10..$19 digits
        chr_rom += tile(digit)
    chr_rom += BLANK * (512 - len(chr_rom) // 16)
    return bytes(chr_rom[:8192])


# --------------------------------------------------------------------------
# The game.
# --------------------------------------------------------------------------

# Zero page
PX, PY, SX, SY = 0x10, 0x11, 0x12, 0x13
ONES, TENS, SEED, BTN = 0x14, 0x15, 0x16, 0x17

OAM = 0x0200
PPUCTRL, PPUMASK, PPUSTATUS = 0x2000, 0x2001, 0x2002
OAMADDR, PPUSCROLL, PPUADDR, PPUDATA = 0x2003, 0x2005, 0x2006, 0x2007
OAMDMA, JOY1 = 0x4014, 0x4016

PALETTE = [
    0x21, 0x0F, 0x10, 0x30,   # background
    0x21, 0x0F, 0x10, 0x30,
    0x21, 0x0F, 0x10, 0x30,
    0x21, 0x0F, 0x10, 0x30,
    0x21, 0x28, 0x30, 0x16,   # sprites: yellow, white, red
    0x21, 0x28, 0x30, 0x16,
    0x21, 0x28, 0x30, 0x16,
    0x21, 0x28, 0x30, 0x16,
]


def build_prg():
    a = Asm(0x8000)

    # ---- reset ------------------------------------------------------------
    a.label("reset")
    a.op("sei").op("cld")
    a.imm("ldx", 0x40).abs("stx", 0x4017)          # silence APU frame IRQ
    a.imm("ldx", 0xFF).op("txs")
    a.op("inx")                                     # X = 0
    a.abs("stx", PPUCTRL).abs("stx", PPUMASK).abs("stx", 0x4010)

    a.label("vblank1")
    a.abs("bit", PPUSTATUS).branch("bpl", "vblank1")

    # Clear RAM, parking every sprite off the bottom of the screen.
    a.imm("lda", 0x00)
    a.label("clear")
    a.zpx("sta", 0x00)
    a.absx("sta", 0x0100)
    a.absx("sta", 0x0300)
    a.absx("sta", 0x0400)
    a.absx("sta", 0x0500)
    a.absx("sta", 0x0600)
    a.absx("sta", 0x0700)
    a.op("inx").branch("bne", "clear")

    a.imm("lda", 0xFE)
    a.label("clear_oam")
    a.absx("sta", OAM)
    a.op("inx").branch("bne", "clear_oam")

    a.label("vblank2")
    a.abs("bit", PPUSTATUS).branch("bpl", "vblank2")

    # ---- palette ----------------------------------------------------------
    a.abs("lda", PPUSTATUS)
    a.imm("lda", 0x3F).abs("sta", PPUADDR)
    a.imm("lda", 0x00).abs("sta", PPUADDR)
    a.imm("ldx", 0x00)
    a.label("pal_loop")
    a.absx("lda", "palette_data")
    a.abs("sta", PPUDATA)
    a.op("inx").imm("cpx", 32).branch("bne", "pal_loop")

    # ---- starting state ---------------------------------------------------
    a.imm("lda", 120).zp("sta", PX)
    a.imm("lda", 120).zp("sta", PY)
    a.imm("lda", 60).zp("sta", SX)
    a.imm("lda", 60).zp("sta", SY)
    a.imm("lda", 0).zp("sta", ONES).zp("sta", TENS)
    a.imm("lda", 0x5D).zp("sta", SEED)

    # Sprite attributes and the fixed tiles never change, so set them once.
    a.imm("lda", 0x01).abs("sta", OAM + 1)     # player quadrants
    a.imm("lda", 0x02).abs("sta", OAM + 5)
    a.imm("lda", 0x03).abs("sta", OAM + 9)
    a.imm("lda", 0x04).abs("sta", OAM + 13)
    a.imm("lda", 0x05).abs("sta", OAM + 17)    # star
    a.imm("lda", 0x00)
    a.abs("sta", OAM + 2).abs("sta", OAM + 6).abs("sta", OAM + 10)
    a.abs("sta", OAM + 14).abs("sta", OAM + 18)
    a.abs("sta", OAM + 22).abs("sta", OAM + 26)
    a.imm("lda", 16).abs("sta", OAM + 20).abs("sta", OAM + 24)   # score Y
    a.imm("lda", 200).abs("sta", OAM + 23)                        # tens X
    a.imm("lda", 208).abs("sta", OAM + 27)                        # ones X

    # Enable NMI and rendering.
    a.imm("lda", 0x80).abs("sta", PPUCTRL)
    a.imm("lda", 0x1E).abs("sta", PPUMASK)

    a.label("forever")
    a.abs("jmp", "forever")

    # ---- NMI: once per frame ---------------------------------------------
    a.label("nmi")
    a.op("pha")
    a.imm("lda", 0x00).abs("sta", OAMADDR)
    a.imm("lda", 0x02).abs("sta", OAMDMA)

    a.abs("jsr", "read_pad")
    a.abs("jsr", "move")
    a.abs("jsr", "collide")
    a.abs("jsr", "draw")

    a.imm("lda", 0x00).abs("sta", PPUSCROLL).abs("sta", PPUSCROLL)
    a.op("pla")
    a.op("rti")

    # ---- controller -------------------------------------------------------
    # Latch, then shift 8 bits into BTN: A B Select Start Up Down Left Right
    a.label("read_pad")
    a.imm("lda", 0x01).abs("sta", JOY1)
    a.imm("lda", 0x00).abs("sta", JOY1)
    a.imm("ldx", 8)
    a.label("pad_loop")
    a.abs("lda", JOY1)
    a.imm("and", 0x01)
    a.op("lsr_a")                 # bit 0 -> carry
    a.zp("lda", BTN)
    a.op("rol_a")                 # shift that carry into BTN
    a.zp("sta", BTN)
    a.op("dex").branch("bne", "pad_loop")
    a.op("rts")

    # ---- movement ---------------------------------------------------------
    a.label("move")
    a.zp("lda", BTN).imm("and", 0x01).branch("beq", "no_right")   # Right
    a.zp("lda", PX).imm("cmp", 236).branch("bcs", "no_right")
    a.zp("lda", PX).op("clc").imm("adc", 2).zp("sta", PX)
    a.label("no_right")

    a.zp("lda", BTN).imm("and", 0x02).branch("beq", "no_left")    # Left
    a.zp("lda", PX).imm("cmp", 3).branch("bcc", "no_left")
    a.zp("lda", PX).op("sec").imm("sbc", 2).zp("sta", PX)
    a.label("no_left")

    a.zp("lda", BTN).imm("and", 0x04).branch("beq", "no_down")    # Down
    a.zp("lda", PY).imm("cmp", 206).branch("bcs", "no_down")
    a.zp("lda", PY).op("clc").imm("adc", 2).zp("sta", PY)
    a.label("no_down")

    a.zp("lda", BTN).imm("and", 0x08).branch("beq", "no_up")      # Up
    a.zp("lda", PY).imm("cmp", 10).branch("bcc", "no_up")
    a.zp("lda", PY).op("sec").imm("sbc", 2).zp("sta", PY)
    a.label("no_up")
    a.op("rts")

    # ---- collision --------------------------------------------------------
    # Overlap when (star - player + 8) < 24 on both axes.
    a.label("collide")
    a.zp("lda", SX).op("sec").zp("sbc", PX).op("clc").imm("adc", 8)
    a.imm("cmp", 24).branch("bcs", "no_hit")
    a.zp("lda", SY).op("sec").zp("sbc", PY).op("clc").imm("adc", 8)
    a.imm("cmp", 24).branch("bcs", "no_hit")

    # Score up, rolling ones into tens and stopping at 99.
    a.zp("lda", ONES).op("clc").imm("adc", 1).zp("sta", ONES)
    a.imm("cmp", 10).branch("bcc", "scored")
    a.imm("lda", 0).zp("sta", ONES)
    a.zp("lda", TENS).op("clc").imm("adc", 1).zp("sta", TENS)
    a.imm("cmp", 10).branch("bcc", "scored")
    a.imm("lda", 0).zp("sta", TENS)
    a.label("scored")

    # New star position from a little LFSR, kept well inside the screen.
    a.abs("jsr", "random")
    a.imm("and", 0x7F).op("clc").imm("adc", 40).zp("sta", SX)
    a.abs("jsr", "random")
    a.imm("and", 0x6F).op("clc").imm("adc", 40).zp("sta", SY)
    a.label("no_hit")
    a.op("rts")

    a.label("random")
    a.zp("lda", SEED)
    a.op("lsr_a")
    a.branch("bcc", "no_eor")
    a.imm("eor", 0xB4)
    a.label("no_eor")
    a.zp("sta", SEED)
    a.op("rts")

    # ---- sprite positions -------------------------------------------------
    a.label("draw")
    a.zp("lda", PY).abs("sta", OAM + 0).abs("sta", OAM + 4)
    a.op("clc").imm("adc", 8).abs("sta", OAM + 8).abs("sta", OAM + 12)
    a.zp("lda", PX).abs("sta", OAM + 3).abs("sta", OAM + 11)
    a.op("clc").imm("adc", 8).abs("sta", OAM + 7).abs("sta", OAM + 15)
    a.zp("lda", SY).abs("sta", OAM + 16)
    a.zp("lda", SX).abs("sta", OAM + 19)
    # Digit tiles live at $10, so the tile index is $10 + value.
    a.zp("lda", TENS).op("clc").imm("adc", 0x10).abs("sta", OAM + 21)
    a.zp("lda", ONES).op("clc").imm("adc", 0x10).abs("sta", OAM + 25)
    a.op("rts")

    a.label("irq")
    a.op("rti")

    a.label("palette_data")
    a.byte(*PALETTE)

    code = a.link()

    # 16 KB bank with the vectors at the very top.
    prg = bytearray(b"\xEA" * 16384)
    prg[0:len(code)] = code
    reset, nmi, irq = a.labels["reset"], a.labels["nmi"], a.labels["irq"]
    prg[0x3FFA] = nmi & 0xFF
    prg[0x3FFB] = nmi >> 8
    prg[0x3FFC] = reset & 0xFF
    prg[0x3FFD] = reset >> 8
    prg[0x3FFE] = irq & 0xFF
    prg[0x3FFF] = irq >> 8
    return bytes(prg), a.labels, len(code)


def main():
    prg, labels, used = build_prg()
    chr_rom = build_chr()
    header = bytes([
        0x4E, 0x45, 0x53, 0x1A,   # "NES\x1a"
        1,                        # 1 x 16 KB PRG
        1,                        # 1 x 8 KB CHR
        0x01,                     # mapper 0, vertical mirroring
        0, 0, 0, 0, 0, 0, 0, 0, 0,
    ])
    rom = header + prg + chr_rom
    path = "/home/user/Website/app/games/star-catcher.nes"
    with open(path, "wb") as fh:
        fh.write(rom)
    print("wrote %s" % path)
    print("  total %d bytes (16 header + 16384 PRG + 8192 CHR)" % len(rom))
    print("  code uses %d of 16384 PRG bytes" % used)
    print("  reset=$%04X nmi=$%04X" % (labels["reset"], labels["nmi"]))


if __name__ == "__main__":
    main()
