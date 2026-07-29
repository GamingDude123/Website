"""Builds 'Kart Dash', an original NES racing game.

Steer left and right, dodge the oncoming karts, survive as long as you can.
The road markings scroll to sell the speed, and the karts come faster as you
go. Hit one and the score resets.

Original code and art — nothing borrowed from any existing game.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nesasm import Asm, tile, split16, BLANK, DIGIT_ROWS, ines, with_vectors

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kart-dash.nes")

# ---- Zero page ------------------------------------------------------------
PX = 0x10          # player X (Y is fixed)
RX, RY, RS = 0x12, 0x15, 0x18      # three rivals: X, Y, speed
ONES, TENS = 0x1B, 0x1C
SEED, BTN, FRAME = 0x1D, 0x1E, 0x1F
STRIPE = 0x20      # four road markings, Y only

RIVALS = 3
STRIPES = 4
PLAYER_Y = 184

# ---- OAM layout -----------------------------------------------------------
OAM = 0x0200
OAM_PLAYER = OAM                      # 4 sprites
OAM_RIVAL = OAM + 16                  # 4 sprites each
OAM_STRIPE = OAM + 16 + RIVALS * 16   # 1 sprite each
OAM_SCORE = OAM_STRIPE + STRIPES * 4  # 2 sprites

PPUCTRL, PPUMASK, PPUSTATUS = 0x2000, 0x2001, 0x2002
OAMADDR, PPUSCROLL, PPUADDR, PPUDATA = 0x2003, 0x2005, 0x2006, 0x2007
OAMDMA, JOY1 = 0x4014, 0x4016

# ---- Art ------------------------------------------------------------------
# Top-down kart: body in colour 1, windows in 3, wheels in 3 either side.
KART = [
    "0001111111111000",
    "0011111111111100",
    "0011133333311100",
    "0011133333311100",
    "0011111111111100",
    "0111111111111110",
    "3311111111111133",
    "3311111111111133",
    "3311111111111133",
    "0111111111111110",
    "0011111111111100",
    "0011133333311100",
    "0011133333311100",
    "0011111111111100",
    "0011111111111100",
    "0001111111111000",
]

STRIPE_TILE = tile([
    "00022000",
    "00022000",
    "00022000",
    "00022000",
    "00022000",
    "00022000",
    "00000000",
    "00000000",
])

PALETTE = [
    0x00, 0x0F, 0x10, 0x30,      # background (a plain grey road)
    0x00, 0x0F, 0x10, 0x30,
    0x00, 0x0F, 0x10, 0x30,
    0x00, 0x0F, 0x10, 0x30,
    0x00, 0x16, 0x30, 0x0F,      # sprite 0: player, red
    0x00, 0x11, 0x30, 0x0F,      # sprite 1: rivals, blue
    0x00, 0x30, 0x30, 0x30,      # sprite 2: road markings and digits, white
    0x00, 0x28, 0x30, 0x0F,      # sprite 3: spare
]


def build_chr():
    chr_rom = bytearray()
    chr_rom += BLANK                    # $00
    for quad in split16(KART):          # $01..$04
        chr_rom += quad
    chr_rom += STRIPE_TILE              # $05
    while len(chr_rom) < 0x10 * 16:
        chr_rom += BLANK
    for rows in DIGIT_ROWS:             # $10..$19
        chr_rom += tile(rows)
    chr_rom += BLANK * (512 - len(chr_rom) // 16)
    return bytes(chr_rom[:8192])


def build_prg():
    a = Asm(0x8000)

    # ---- reset ------------------------------------------------------------
    a.label("reset")
    a.op("sei").op("cld")
    a.imm("ldx", 0x40).abs("stx", 0x4017)
    a.imm("ldx", 0xFF).op("txs")
    a.op("inx")
    a.abs("stx", PPUCTRL).abs("stx", PPUMASK).abs("stx", 0x4010)

    a.label("vblank1")
    a.abs("bit", PPUSTATUS).branch("bpl", "vblank1")

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

    a.imm("lda", 0xFE)                     # park every sprite off screen
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
    a.imm("lda", 0x9B).zp("sta", SEED)
    a.imm("lda", 0).zp("sta", ONES).zp("sta", TENS).zp("sta", FRAME)

    # Rivals start spread up the road so they arrive one at a time.
    for i in range(RIVALS):
        a.imm("lda", 60 + i * 60).zp("sta", RX + i)
        a.imm("lda", 250 - i * 70).zp("sta", RY + i)   # wraps to just off-screen
        a.imm("lda", 2 + i).zp("sta", RS + i)

    for i in range(STRIPES):
        a.imm("lda", i * 60).zp("sta", STRIPE + i)

    # Tiles and palettes never change, so write them once.
    for base, attr in [(OAM_PLAYER, 0)] + [(OAM_RIVAL + i * 16, 1) for i in range(RIVALS)]:
        for quad in range(4):
            a.imm("lda", 0x01 + quad).abs("sta", base + quad * 4 + 1)
            a.imm("lda", attr).abs("sta", base + quad * 4 + 2)

    for i in range(STRIPES):
        a.imm("lda", 0x05).abs("sta", OAM_STRIPE + i * 4 + 1)
        a.imm("lda", 0x02).abs("sta", OAM_STRIPE + i * 4 + 2)
        a.imm("lda", 124).abs("sta", OAM_STRIPE + i * 4 + 3)   # centre of the road

    for i in range(2):
        a.imm("lda", 0x02).abs("sta", OAM_SCORE + i * 4 + 2)
        a.imm("lda", 16).abs("sta", OAM_SCORE + i * 4 + 0)
    a.imm("lda", 200).abs("sta", OAM_SCORE + 3)
    a.imm("lda", 208).abs("sta", OAM_SCORE + 7)

    a.imm("lda", 0x80).abs("sta", PPUCTRL)
    a.imm("lda", 0x1E).abs("sta", PPUMASK)

    a.label("forever")
    a.abs("jmp", "forever")

    # ---- NMI --------------------------------------------------------------
    a.label("nmi")
    a.op("pha")
    a.imm("lda", 0x00).abs("sta", OAMADDR)
    a.imm("lda", 0x02).abs("sta", OAMDMA)

    a.abs("jsr", "read_pad")
    a.abs("jsr", "steer")
    a.abs("jsr", "run_rivals")
    a.abs("jsr", "run_stripes")
    a.abs("jsr", "tick_score")
    a.abs("jsr", "draw")

    a.imm("lda", 0x00).abs("sta", PPUSCROLL).abs("sta", PPUSCROLL)
    a.op("pla")
    a.op("rti")

    # ---- controller -------------------------------------------------------
    a.label("read_pad")
    a.imm("lda", 0x01).abs("sta", JOY1)
    a.imm("lda", 0x00).abs("sta", JOY1)
    a.imm("ldx", 8)
    a.label("pad_loop")
    a.abs("lda", JOY1)
    a.imm("and", 0x01)
    a.op("lsr_a")
    a.zp("lda", BTN)
    a.op("rol_a")
    a.zp("sta", BTN)
    a.op("dex").branch("bne", "pad_loop")
    a.op("rts")

    # ---- steering ---------------------------------------------------------
    # Three pixels a frame: quick enough to dodge, slow enough to be a choice.
    a.label("steer")
    a.zp("lda", BTN).imm("and", 0x01).branch("beq", "no_right")
    a.zp("lda", PX).imm("cmp", 224).branch("bcs", "no_right")
    a.zp("lda", PX).op("clc").imm("adc", 3).zp("sta", PX)
    a.label("no_right")
    a.zp("lda", BTN).imm("and", 0x02).branch("beq", "no_left")
    a.zp("lda", PX).imm("cmp", 19).branch("bcc", "no_left")
    a.zp("lda", PX).op("sec").imm("sbc", 3).zp("sta", PX)
    a.label("no_left")
    a.op("rts")

    # ---- rivals -----------------------------------------------------------
    # Unrolled: only three of them, and it keeps every address constant.
    a.label("run_rivals")
    for i in range(RIVALS):
        rx, ry, rs = RX + i, RY + i, RS + i

        a.zp("lda", ry).op("clc").zp("adc", rs).zp("sta", ry)
        a.imm("cmp", 232).branch("bcc", "onscreen_%d" % i)
        # Past the bottom: send it back to the top in a new lane.
        a.abs("jsr", "random")
        a.imm("and", 0x7F).op("clc").imm("adc", 24).zp("sta", rx)
        a.imm("lda", 0).zp("sta", ry)
        a.abs("jsr", "random")
        a.imm("and", 0x03).op("clc").imm("adc", 2).zp("sta", rs)
        a.label("onscreen_%d" % i)

        # Overlap when the gap is under 16 pixels on both axes.
        a.zp("lda", rx).op("sec").zp("sbc", PX).op("clc").imm("adc", 15)
        a.imm("cmp", 31).branch("bcs", "clear_%d" % i)
        a.zp("lda", ry).op("sec").imm("sbc", PLAYER_Y).op("clc").imm("adc", 15)
        a.imm("cmp", 31).branch("bcs", "clear_%d" % i)
        a.abs("jsr", "crash")
        a.label("clear_%d" % i)
    a.op("rts")

    # ---- road markings ----------------------------------------------------
    a.label("run_stripes")
    for i in range(STRIPES):
        a.zp("lda", STRIPE + i).op("clc").imm("adc", 5).zp("sta", STRIPE + i)
        a.imm("cmp", 232).branch("bcc", "stripe_ok_%d" % i)
        a.imm("lda", 0).zp("sta", STRIPE + i)
        a.label("stripe_ok_%d" % i)
    a.op("rts")

    # ---- score ------------------------------------------------------------
    # A point roughly every half second of survival.
    a.label("tick_score")
    a.zp("inc", FRAME)
    a.zp("lda", FRAME).imm("and", 0x1F).branch("bne", "no_point")
    a.zp("lda", ONES).op("clc").imm("adc", 1).zp("sta", ONES)
    a.imm("cmp", 10).branch("bcc", "no_point")
    a.imm("lda", 0).zp("sta", ONES)
    a.zp("lda", TENS).op("clc").imm("adc", 1).zp("sta", TENS)
    a.imm("cmp", 10).branch("bcc", "no_point")
    a.imm("lda", 9).zp("sta", TENS)       # park at 99 rather than wrapping
    a.imm("lda", 9).zp("sta", ONES)
    a.label("no_point")
    a.op("rts")

    # ---- crash ------------------------------------------------------------
    a.label("crash")
    a.imm("lda", 0).zp("sta", ONES).zp("sta", TENS)
    a.imm("lda", 120).zp("sta", PX)
    for i in range(RIVALS):
        # Send everyone back to the top so the restart isn't an instant re-hit.
        a.imm("lda", 0).zp("sta", RY + i)
        a.imm("lda", 2).zp("sta", RS + i)
    a.op("rts")

    a.label("random")
    a.zp("lda", SEED)
    a.op("lsr_a")
    a.branch("bcc", "no_eor")
    a.imm("eor", 0xB4)
    a.label("no_eor")
    a.zp("sta", SEED)
    a.op("rts")

    # ---- sprite positions --------------------------------------------------
    a.label("draw")
    # Player: four tiles in a 2x2 block.
    a.imm("lda", PLAYER_Y).abs("sta", OAM_PLAYER + 0).abs("sta", OAM_PLAYER + 4)
    a.op("clc").imm("adc", 8).abs("sta", OAM_PLAYER + 8).abs("sta", OAM_PLAYER + 12)
    a.zp("lda", PX).abs("sta", OAM_PLAYER + 3).abs("sta", OAM_PLAYER + 11)
    a.op("clc").imm("adc", 8).abs("sta", OAM_PLAYER + 7).abs("sta", OAM_PLAYER + 15)

    for i in range(RIVALS):
        base = OAM_RIVAL + i * 16
        a.zp("lda", RY + i).abs("sta", base + 0).abs("sta", base + 4)
        a.op("clc").imm("adc", 8).abs("sta", base + 8).abs("sta", base + 12)
        a.zp("lda", RX + i).abs("sta", base + 3).abs("sta", base + 11)
        a.op("clc").imm("adc", 8).abs("sta", base + 7).abs("sta", base + 15)

    for i in range(STRIPES):
        a.zp("lda", STRIPE + i).abs("sta", OAM_STRIPE + i * 4)

    a.zp("lda", TENS).op("clc").imm("adc", 0x10).abs("sta", OAM_SCORE + 1)
    a.zp("lda", ONES).op("clc").imm("adc", 0x10).abs("sta", OAM_SCORE + 5)
    a.op("rts")

    a.label("irq")
    a.op("rti")

    a.label("palette_data")
    a.byte(*PALETTE)

    code = a.link()
    return with_vectors(a, code), a.labels, len(code)


def main():
    prg, labels, used = build_prg()
    rom = ines(prg, build_chr())
    with open(OUT, "wb") as fh:
        fh.write(rom)
    print("wrote %s" % OUT)
    print("  total %d bytes, code uses %d of 16384 PRG bytes" % (len(rom), used))
    print("  reset=$%04X nmi=$%04X" % (labels["reset"], labels["nmi"]))


if __name__ == "__main__":
    main()
