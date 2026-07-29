"""Builds 'Kart Dash', an original NES kart racing game.

A real race rather than a dodge: three rivals run the same track, everyone has
a distance along it, and where a rival appears on screen is worked out from how
far ahead or behind you it is. Drive over an item box for a speed boost, clip a
rival and you spin out. Three laps, and your position updates as you overtake.

Controls: left and right steer. That's it — the kart drives itself.

Original code and art. Not a copy of any existing game.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nesasm import Asm, tile, split16, BLANK, DIGIT_ROWS, ines, with_vectors

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kart-dash.nes")

# ---- Zero page ------------------------------------------------------------
PX = 0x10          # player lane position
PSPEED = 0x11      # units of track per frame
BOOST = 0x12       # frames of boost left
SPIN = 0x13        # frames of spin-out left
PDIST_LO, PDIST_HI = 0x14, 0x15

RX = 0x16          # rival lane positions      (3)
RSPEED = 0x19      # rival speeds              (3)
RDIST_LO = 0x1C    # rival distance, low byte  (3)
RDIST_HI = 0x1F    # rival distance, high byte (3)

ITEMX = 0x22
ITEM_LO, ITEM_HI = 0x23, 0x24
LAP, POS = 0x25, 0x26
SEED, BTN, FRAME = 0x27, 0x28, 0x29
STRIPE = 0x2A      # four road markings        (4)
TMP_LO, TMP_HI = 0x2E, 0x2F
FINISHED = 0x30
RY = 0x31          # rival screen row, worked out each frame (3)
ITEMY = 0x34

RIVALS = 3
STRIPES = 4

CENTRE = 150       # the player's fixed row; everything else is relative to it
BASE_SPEED = 2
BOOST_SPEED = 5
SPIN_SPEED = 1
BOOST_FRAMES = 90
SPIN_FRAMES = 50
OFFSCREEN = 250
LAP_SHIFT = 3      # a lap is 8 high-bytes of distance, about 17 seconds
FINAL_HI = 24      # three laps

# ---- OAM ------------------------------------------------------------------
OAM = 0x0200
OAM_PLAYER = OAM
OAM_RIVAL = OAM + 16
OAM_STRIPE = OAM_RIVAL + RIVALS * 16
OAM_ITEM = OAM_STRIPE + STRIPES * 4
OAM_LAP = OAM_ITEM + 4
OAM_POS = OAM_LAP + 4

PPUCTRL, PPUMASK, PPUSTATUS = 0x2000, 0x2001, 0x2002
OAMADDR, PPUSCROLL, PPUADDR, PPUDATA = 0x2003, 0x2005, 0x2006, 0x2007
OAMDMA, JOY1 = 0x4014, 0x4016

# ---- Art ------------------------------------------------------------------
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
    "00022000", "00022000", "00022000", "00022000",
    "00022000", "00022000", "00000000", "00000000",
])

# Item box: a bordered square with a mark in the middle.
ITEM_TILE = tile([
    "01111110",
    "10000001",
    "10022001",
    "10222201",
    "10222201",
    "10022001",
    "10000001",
    "01111110",
])

PALETTE = [
    0x00, 0x0F, 0x10, 0x30,
    0x00, 0x0F, 0x10, 0x30,
    0x00, 0x0F, 0x10, 0x30,
    0x00, 0x0F, 0x10, 0x30,
    0x00, 0x16, 0x30, 0x0F,      # 0: player, red
    0x00, 0x11, 0x30, 0x0F,      # 1: rivals, blue
    0x00, 0x30, 0x30, 0x30,      # 2: markings and digits, white
    0x00, 0x2A, 0x28, 0x0F,      # 3: item box, green and gold
]


def build_chr():
    chr_rom = bytearray()
    chr_rom += BLANK                    # $00
    for quad in split16(KART):          # $01..$04
        chr_rom += quad
    chr_rom += STRIPE_TILE              # $05
    chr_rom += ITEM_TILE                # $06
    while len(chr_rom) < 0x10 * 16:
        chr_rom += BLANK
    for rows in DIGIT_ROWS:             # $10..$19
        chr_rom += tile(rows)
    chr_rom += BLANK * (512 - len(chr_rom) // 16)
    return bytes(chr_rom[:8192])


def build_prg():
    a = Asm(0x8000)

    def add16(lo, hi, amount_zp=None, amount_imm=None):
        """dest += amount, carrying into the high byte."""
        a.zp("lda", lo).op("clc")
        if amount_zp is not None:
            a.zp("adc", amount_zp)
        else:
            a.imm("adc", amount_imm)
        a.zp("sta", lo)
        a.zp("lda", hi).imm("adc", 0).zp("sta", hi)

    def sub16_into_tmp(lo, hi):
        """TMP = (lo,hi) - player distance, as a 16-bit signed value."""
        a.zp("lda", lo).op("sec").zp("sbc", PDIST_LO).zp("sta", TMP_LO)
        a.zp("lda", hi).zp("sbc", PDIST_HI).zp("sta", TMP_HI)

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

    a.imm("lda", 0xFE)
    a.label("clear_oam")
    a.absx("sta", OAM)
    a.op("inx").branch("bne", "clear_oam")

    a.label("vblank2")
    a.abs("bit", PPUSTATUS).branch("bpl", "vblank2")

    a.abs("lda", PPUSTATUS)
    a.imm("lda", 0x3F).abs("sta", PPUADDR)
    a.imm("lda", 0x00).abs("sta", PPUADDR)
    a.imm("ldx", 0x00)
    a.label("pal_loop")
    a.absx("lda", "palette_data")
    a.abs("sta", PPUDATA)
    a.op("inx").imm("cpx", 32).branch("bne", "pal_loop")

    # ---- starting grid ----------------------------------------------------
    a.imm("lda", 120).zp("sta", PX)
    a.imm("lda", BASE_SPEED).zp("sta", PSPEED)
    a.imm("lda", 0).zp("sta", PDIST_LO).zp("sta", PDIST_HI)
    a.imm("lda", 0).zp("sta", BOOST).zp("sta", SPIN).zp("sta", FINISHED)
    a.imm("lda", 1).zp("sta", LAP).zp("sta", POS)
    a.imm("lda", 0x7D).zp("sta", SEED)

    # Rivals line up just ahead, each a little quicker or slower than you.
    for i in range(RIVALS):
        a.imm("lda", 70 + i * 45).zp("sta", RX + i)
        a.imm("lda", 40 + i * 30).zp("sta", RDIST_LO + i)
        a.imm("lda", 0).zp("sta", RDIST_HI + i)
        a.imm("lda", [2, 2, 3][i]).zp("sta", RSPEED + i)

    for i in range(STRIPES):
        a.imm("lda", i * 60).zp("sta", STRIPE + i)

    # The first item box sits a little way up the road.
    a.imm("lda", 120).zp("sta", ITEMX)
    a.imm("lda", 180).zp("sta", ITEM_LO)
    a.imm("lda", 0).zp("sta", ITEM_HI)

    # Fixed sprite tiles and palettes.
    for base, attr in [(OAM_PLAYER, 0)] + [(OAM_RIVAL + i * 16, 1) for i in range(RIVALS)]:
        for quad in range(4):
            a.imm("lda", 0x01 + quad).abs("sta", base + quad * 4 + 1)
            a.imm("lda", attr).abs("sta", base + quad * 4 + 2)

    for i in range(STRIPES):
        a.imm("lda", 0x05).abs("sta", OAM_STRIPE + i * 4 + 1)
        a.imm("lda", 0x02).abs("sta", OAM_STRIPE + i * 4 + 2)
        a.imm("lda", 124).abs("sta", OAM_STRIPE + i * 4 + 3)

    a.imm("lda", 0x06).abs("sta", OAM_ITEM + 1)
    a.imm("lda", 0x03).abs("sta", OAM_ITEM + 2)

    # HUD: lap on the left, position on the right.
    a.imm("lda", 0x02).abs("sta", OAM_LAP + 2).abs("sta", OAM_POS + 2)
    a.imm("lda", 16).abs("sta", OAM_LAP + 0).abs("sta", OAM_POS + 0)
    a.imm("lda", 16).abs("sta", OAM_LAP + 3)
    a.imm("lda", 232).abs("sta", OAM_POS + 3)

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
    a.zp("lda", FINISHED).branch("bne", "skip_race")
    a.abs("jsr", "steer")
    a.abs("jsr", "advance")
    a.abs("jsr", "run_rivals")
    a.abs("jsr", "run_item")
    a.abs("jsr", "run_stripes")
    a.abs("jsr", "standings")
    a.label("skip_race")
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

    # ---- the player's progress --------------------------------------------
    a.label("advance")
    # Spin-out first: it overrides a boost.
    a.zp("lda", SPIN).branch("beq", "not_spinning")
    a.zp("dec", SPIN)
    a.imm("lda", SPIN_SPEED).zp("sta", PSPEED)
    a.abs("jmp", "speed_set")
    a.label("not_spinning")
    a.zp("lda", BOOST).branch("beq", "no_boost")
    a.zp("dec", BOOST)
    a.imm("lda", BOOST_SPEED).zp("sta", PSPEED)
    a.abs("jmp", "speed_set")
    a.label("no_boost")
    a.imm("lda", BASE_SPEED).zp("sta", PSPEED)
    a.label("speed_set")

    add16(PDIST_LO, PDIST_HI, amount_zp=PSPEED)

    # Lap number is just the distance shifted down.
    a.zp("lda", PDIST_HI)
    for _ in range(LAP_SHIFT):
        a.op("lsr_a")
    a.op("clc").imm("adc", 1).zp("sta", LAP)

    a.zp("lda", PDIST_HI).imm("cmp", FINAL_HI).branch("bcc", "still_racing")
    a.imm("lda", 1).zp("sta", FINISHED)
    a.imm("lda", 3).zp("sta", LAP)          # show the last lap, not a fourth
    a.label("still_racing")
    a.op("rts")

    # ---- rivals -----------------------------------------------------------
    a.label("run_rivals")
    for i in range(RIVALS):
        rx, rs = RX + i, RSPEED + i
        rlo, rhi = RDIST_LO + i, RDIST_HI + i

        add16(rlo, rhi, amount_zp=rs)

        # Screen row = CENTRE - (their distance - ours), so a rival further
        # along the track sits higher up. The subtraction wraps, which handles
        # "behind us" for free: TMP_LO is then 256 minus the gap, and
        # CENTRE - TMP_LO comes out as CENTRE + gap.
        sub16_into_tmp(rlo, rhi)
        a.zp("lda", TMP_HI).branch("beq", "ahead_%d" % i)
        a.imm("cmp", 0xFF).branch("beq", "behind_%d" % i)
        a.abs("jmp", "hide_%d" % i)                  # more than a screen away

        a.label("ahead_%d" % i)
        a.zp("lda", TMP_LO).imm("cmp", 140).branch("bcs", "hide_%d" % i)
        a.abs("jmp", "place_%d" % i)

        a.label("behind_%d" % i)
        a.zp("lda", TMP_LO).imm("cmp", 176).branch("bcc", "hide_%d" % i)
        a.abs("jmp", "place_%d" % i)

        a.label("hide_%d" % i)
        a.imm("lda", OFFSCREEN).zp("sta", RY + i)
        a.abs("jmp", "placed_%d" % i)

        a.label("place_%d" % i)
        a.imm("lda", CENTRE).op("sec").zp("sbc", TMP_LO).zp("sta", RY + i)
        a.label("placed_%d" % i)

        # Contact: only worth testing when they are on screen near our row.
        a.zp("lda", RY + i).imm("cmp", OFFSCREEN).branch("beq", "no_bump_%d" % i)
        a.zp("lda", rx).op("sec").zp("sbc", PX).op("clc").imm("adc", 15)
        a.imm("cmp", 31).branch("bcs", "no_bump_%d" % i)
        a.zp("lda", RY + i).op("sec").imm("sbc", CENTRE).op("clc").imm("adc", 15)
        a.imm("cmp", 31).branch("bcs", "no_bump_%d" % i)
        a.zp("lda", SPIN).branch("bne", "no_bump_%d" % i)   # already spinning
        a.imm("lda", SPIN_FRAMES).zp("sta", SPIN)
        a.imm("lda", 0).zp("sta", BOOST)
        a.label("no_bump_%d" % i)
    a.op("rts")

    # ---- item box ---------------------------------------------------------
    a.label("run_item")
    sub16_into_tmp(ITEM_LO, ITEM_HI)
    a.zp("lda", TMP_HI).branch("beq", "item_ahead")
    a.imm("cmp", 0xFF).branch("beq", "item_just_behind")
    a.abs("jmp", "item_passed")              # far behind: put a new one out

    # A boost moves several units a frame, so a box can end up marginally
    # behind before it is ever tested. Anything within a few units still
    # counts, otherwise driving fast would skip boxes entirely.
    a.label("item_just_behind")
    a.zp("lda", TMP_LO).imm("cmp", 240).branch("bcs", "item_reachable")
    a.abs("jmp", "item_passed")

    a.label("item_ahead")
    a.zp("lda", TMP_LO).imm("cmp", 140).branch("bcc", "item_reachable")
    a.imm("lda", OFFSCREEN).zp("sta", ITEMY)  # still too far up the road
    a.op("rts")

    a.label("item_reachable")
    a.imm("lda", CENTRE).op("sec").zp("sbc", TMP_LO).zp("sta", ITEMY)

    # Collect it by driving over it.
    a.zp("lda", ITEMX).op("sec").zp("sbc", PX).op("clc").imm("adc", 15)
    a.imm("cmp", 31).branch("bcs", "no_pickup")
    a.zp("lda", ITEMY).op("sec").imm("sbc", CENTRE).op("clc").imm("adc", 15)
    a.imm("cmp", 31).branch("bcs", "no_pickup")
    a.imm("lda", BOOST_FRAMES).zp("sta", BOOST)
    a.imm("lda", 0).zp("sta", SPIN)
    a.abs("jmp", "item_passed")
    a.label("no_pickup")
    a.op("rts")

    a.label("item_passed")
    # Place the next one a good way up the road, in a random lane.
    a.abs("jsr", "random")
    a.imm("and", 0x7F).op("clc").imm("adc", 24).zp("sta", ITEMX)
    a.zp("lda", PDIST_LO).op("clc").imm("adc", 200).zp("sta", ITEM_LO)
    a.zp("lda", PDIST_HI).imm("adc", 0).zp("sta", ITEM_HI)
    a.imm("lda", OFFSCREEN).zp("sta", ITEMY)
    a.op("rts")

    # ---- road markings ----------------------------------------------------
    a.label("run_stripes")
    for i in range(STRIPES):
        a.zp("lda", STRIPE + i).op("clc").zp("adc", PSPEED).op("clc").imm("adc", 2)
        a.zp("sta", STRIPE + i)
        a.imm("cmp", 232).branch("bcc", "stripe_ok_%d" % i)
        a.imm("lda", 0).zp("sta", STRIPE + i)
        a.label("stripe_ok_%d" % i)
    a.op("rts")

    # ---- position ---------------------------------------------------------
    # First place until proven otherwise; each rival further along bumps us down.
    a.label("standings")
    a.imm("lda", 1).zp("sta", POS)
    for i in range(RIVALS):
        # 16-bit compare: subtract ours from theirs and read the carry.
        # Carry set means they are level or further along, so we drop a place.
        a.zp("lda", RDIST_LO + i).zp("cmp", PDIST_LO)
        a.zp("lda", RDIST_HI + i).zp("sbc", PDIST_HI)
        a.branch("bcc", "behind_us_%d" % i)
        a.zp("inc", POS)
        a.label("behind_us_%d" % i)
    a.op("rts")

    a.label("random")
    a.zp("lda", SEED)
    a.op("lsr_a")
    a.branch("bcc", "no_eor")
    a.imm("eor", 0xB4)
    a.label("no_eor")
    a.zp("sta", SEED)
    a.op("rts")

    # ---- drawing ----------------------------------------------------------
    a.label("draw")
    a.imm("lda", CENTRE).abs("sta", OAM_PLAYER + 0).abs("sta", OAM_PLAYER + 4)
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

    a.zp("lda", ITEMY).abs("sta", OAM_ITEM + 0)
    a.zp("lda", ITEMX).abs("sta", OAM_ITEM + 3)

    a.zp("lda", LAP).op("clc").imm("adc", 0x10).abs("sta", OAM_LAP + 1)
    a.zp("lda", POS).op("clc").imm("adc", 0x10).abs("sta", OAM_POS + 1)
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


if __name__ == "__main__":
    main()
