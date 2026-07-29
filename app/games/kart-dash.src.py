"""Builds 'Kart Dash', an original NES kart racing game.

There is an actual road, drawn into the background: tarmac with a white line
down each side and grass beyond it. Run onto the grass and you bog down, so
staying on the racing line is the whole game.

Hold B through a corner to drift. Drifting steers harder and charges a
mini-turbo; let go once it's charged and you get a burst of speed. Item boxes
give a boost too. Clip a rival and you spin out.

Three laps against three rivals, with your position updating as you overtake.

Controls: left/right steer, B drift.

Original code and art. Not a copy of any existing game.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nesasm import Asm, tile, split16, BLANK, DIGIT_ROWS, ines, with_vectors

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kart-dash.nes")

# ---- Zero page ------------------------------------------------------------
PX = 0x10
PSPEED = 0x11
BOOST = 0x12
SPIN = 0x13
PDIST_LO, PDIST_HI = 0x14, 0x15

RX = 0x16          # rival lane            (3)
RSPEED = 0x19      # rival speed           (3)
RDIST_LO = 0x1C    # rival distance low    (3)
RDIST_HI = 0x1F    # rival distance high   (3)

ITEMX = 0x22
ITEM_LO, ITEM_HI = 0x23, 0x24
LAP, POS = 0x25, 0x26
SEED, BTN = 0x27, 0x28
DRIFT = 0x29       # how far the mini-turbo is charged
STRIPE = 0x2A      # centre-line dashes    (4)
TMP_LO, TMP_HI = 0x2E, 0x2F
FINISHED = 0x30
RY = 0x31          # rival screen row      (3)
ITEMY = 0x34

RIVALS = 3
STRIPES = 4

CENTRE = 150
BASE_SPEED = 3
BOOST_SPEED = 7
SPIN_SPEED = 1
GRASS_SPEED = 1        # bogged down off the tarmac
BOOST_FRAMES = 90
TURBO_FRAMES = 45
SPIN_FRAMES = 50
DRIFT_MAX = 60
DRIFT_READY = 24       # charge needed before releasing pays off
OFFSCREEN = 250
LAP_SHIFT = 3
FINAL_HI = 24

# The road runs from tile 4 to tile 27, so x=32 to x=223. The kart is 16 wide.
ROAD_LEFT = 40
ROAD_RIGHT = 200
STEER_LEFT = 10        # you *can* leave the road; it just costs you
STEER_RIGHT = 230

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

BTN_RIGHT, BTN_LEFT, BTN_B = 0x01, 0x02, 0x40

# ---- Sprite art -----------------------------------------------------------
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

DASH_TILE = tile([
    "00022000", "00022000", "00022000", "00022000",
    "00022000", "00022000", "00000000", "00000000",
])

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

# ---- Background art -------------------------------------------------------
ROAD_TILE = tile(["00000000"] * 8)                     # bare tarmac
LEFT_EDGE = tile(["22000000"] * 8)                     # white line, left side
RIGHT_EDGE = tile(["00000022"] * 8)                    # white line, right side
GRASS_TILE = tile([
    "11111111",
    "11121111",
    "11111111",
    "11111121",
    "11111111",
    "12111111",
    "11111111",
    "11111112",
])

T_ROAD, T_LEFT, T_RIGHT, T_GRASS = 0x20, 0x21, 0x22, 0x23

# One row of the nametable: grass, white line, tarmac, white line, grass.
ROW = ([T_GRASS] * 4 + [T_LEFT] + [T_ROAD] * 22 + [T_RIGHT] + [T_GRASS] * 4)
assert len(ROW) == 32
# Attributes: 0x55 puts all four quadrants on palette 1 (grass), 0x00 on 0.
ATTR_ROW = [0x55] + [0x00] * 6 + [0x55]

PALETTE = [
    0x00, 0x10, 0x30, 0x0F,      # bg 0: tarmac, kerb white
    0x00, 0x1A, 0x2A, 0x0F,      # bg 1: grass
    0x00, 0x10, 0x30, 0x0F,
    0x00, 0x10, 0x30, 0x0F,
    0x00, 0x16, 0x30, 0x0F,      # sprite 0: player, red
    0x00, 0x11, 0x30, 0x0F,      # sprite 1: rivals, blue
    0x00, 0x30, 0x30, 0x30,      # sprite 2: dashes and digits
    0x00, 0x2A, 0x28, 0x0F,      # sprite 3: item box
]


def build_chr():
    chr_rom = bytearray()
    chr_rom += BLANK                    # $00
    for quad in split16(KART):          # $01..$04
        chr_rom += quad
    chr_rom += DASH_TILE                # $05
    chr_rom += ITEM_TILE                # $06
    while len(chr_rom) < 0x20 * 16:
        chr_rom += BLANK
    chr_rom += ROAD_TILE                # $20
    chr_rom += LEFT_EDGE                # $21
    chr_rom += RIGHT_EDGE               # $22
    chr_rom += GRASS_TILE               # $23
    while len(chr_rom) < 0x10 * 16 + 0x100:
        chr_rom += BLANK
    # Digits live at $30 so they clear the background tiles.
    while len(chr_rom) < 0x30 * 16:
        chr_rom += BLANK
    for rows in DIGIT_ROWS:             # $30..$39
        chr_rom += tile(rows)
    chr_rom += BLANK * (512 - len(chr_rom) // 16)
    return bytes(chr_rom[:8192])


DIGIT_BASE = 0x30


def build_prg():
    a = Asm(0x8000)

    def add16(lo, hi, amount_zp):
        a.zp("lda", lo).op("clc").zp("adc", amount_zp).zp("sta", lo)
        a.zp("lda", hi).imm("adc", 0).zp("sta", hi)

    def sub16_into_tmp(lo, hi):
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

    # ---- palette ----------------------------------------------------------
    a.abs("lda", PPUSTATUS)
    a.imm("lda", 0x3F).abs("sta", PPUADDR)
    a.imm("lda", 0x00).abs("sta", PPUADDR)
    a.imm("ldx", 0x00)
    a.label("pal_loop")
    a.absx("lda", "palette_data")
    a.abs("sta", PPUDATA)
    a.op("inx").imm("cpx", 32).branch("bne", "pal_loop")

    # ---- draw the road ----------------------------------------------------
    # Every row of the track looks the same, so one 32-byte row is written
    # thirty times. Rendering is still off, so this can take its time.
    a.abs("lda", PPUSTATUS)
    a.imm("lda", 0x20).abs("sta", PPUADDR)
    a.imm("lda", 0x00).abs("sta", PPUADDR)
    a.imm("ldy", 30)
    a.label("row_loop")
    a.imm("ldx", 0)
    a.label("col_loop")
    a.absx("lda", "row_data")
    a.abs("sta", PPUDATA)
    a.op("inx").imm("cpx", 32).branch("bne", "col_loop")
    a.op("dey").branch("bne", "row_loop")

    a.imm("lda", 0x23).abs("sta", PPUADDR)
    a.imm("lda", 0xC0).abs("sta", PPUADDR)
    a.imm("ldy", 8)
    a.label("attr_row")
    a.imm("ldx", 0)
    a.label("attr_col")
    a.absx("lda", "attr_data")
    a.abs("sta", PPUDATA)
    a.op("inx").imm("cpx", 8).branch("bne", "attr_col")
    a.op("dey").branch("bne", "attr_row")

    # ---- starting grid ----------------------------------------------------
    a.imm("lda", 120).zp("sta", PX)
    a.imm("lda", BASE_SPEED).zp("sta", PSPEED)
    a.imm("lda", 0).zp("sta", PDIST_LO).zp("sta", PDIST_HI)
    a.imm("lda", 0).zp("sta", BOOST).zp("sta", SPIN).zp("sta", FINISHED)
    a.imm("lda", 0).zp("sta", DRIFT)
    a.imm("lda", 1).zp("sta", LAP).zp("sta", POS)
    a.imm("lda", 0x7D).zp("sta", SEED)

    for i in range(RIVALS):
        a.imm("lda", [60, 110, 165][i]).zp("sta", RX + i)
        a.imm("lda", 50 + i * 35).zp("sta", RDIST_LO + i)
        a.imm("lda", 0).zp("sta", RDIST_HI + i)
        a.imm("lda", [3, 3, 4][i]).zp("sta", RSPEED + i)

    for i in range(STRIPES):
        a.imm("lda", i * 60).zp("sta", STRIPE + i)

    a.imm("lda", 120).zp("sta", ITEMX)
    a.imm("lda", 200).zp("sta", ITEM_LO)
    a.imm("lda", 0).zp("sta", ITEM_HI)

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
    a.abs("jsr", "run_dashes")
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

    # ---- steering and drifting --------------------------------------------
    a.label("steer")
    # Drifting turns harder — that's the trade for holding B.
    a.imm("lda", 3).zp("sta", TMP_LO)          # borrow TMP_LO as the turn rate
    a.zp("lda", BTN).imm("and", BTN_B).branch("beq", "normal_turn")
    a.imm("lda", 5).zp("sta", TMP_LO)
    a.label("normal_turn")

    a.zp("lda", BTN).imm("and", BTN_RIGHT).branch("beq", "no_right")
    a.zp("lda", PX).imm("cmp", STEER_RIGHT).branch("bcs", "no_right")
    a.zp("lda", PX).op("clc").zp("adc", TMP_LO).zp("sta", PX)
    a.label("no_right")
    a.zp("lda", BTN).imm("and", BTN_LEFT).branch("beq", "no_left")
    a.zp("lda", PX).imm("cmp", STEER_LEFT).branch("bcc", "no_left")
    a.zp("lda", PX).op("sec").zp("sbc", TMP_LO).zp("sta", PX)
    a.label("no_left")

    # Charge the mini-turbo while B is held and the kart is turning.
    a.zp("lda", BTN).imm("and", BTN_B).branch("beq", "drift_released")
    a.zp("lda", BTN).imm("and", 0x03).branch("beq", "steer_done")
    a.zp("lda", DRIFT).imm("cmp", DRIFT_MAX).branch("bcs", "steer_done")
    a.zp("inc", DRIFT)
    a.abs("jmp", "steer_done")

    a.label("drift_released")
    # Let go with enough charge and the turbo fires.
    a.zp("lda", DRIFT).imm("cmp", DRIFT_READY).branch("bcc", "no_turbo")
    a.imm("lda", TURBO_FRAMES).zp("sta", BOOST)
    a.label("no_turbo")
    a.imm("lda", 0).zp("sta", DRIFT)
    a.label("steer_done")
    a.op("rts")

    # ---- speed and progress -----------------------------------------------
    a.label("advance")
    a.zp("lda", SPIN).branch("beq", "not_spinning")
    a.zp("dec", SPIN)
    a.imm("lda", SPIN_SPEED).zp("sta", PSPEED)
    a.abs("jmp", "speed_set")

    a.label("not_spinning")
    # Off the tarmac, nothing else matters: you bog down in the grass.
    a.zp("lda", PX).imm("cmp", ROAD_LEFT).branch("bcc", "on_grass")
    a.zp("lda", PX).imm("cmp", ROAD_RIGHT + 1).branch("bcs", "on_grass")
    a.zp("lda", BOOST).branch("beq", "no_boost")
    a.zp("dec", BOOST)
    a.imm("lda", BOOST_SPEED).zp("sta", PSPEED)
    a.abs("jmp", "speed_set")
    a.label("no_boost")
    a.imm("lda", BASE_SPEED).zp("sta", PSPEED)
    a.abs("jmp", "speed_set")

    a.label("on_grass")
    a.imm("lda", GRASS_SPEED).zp("sta", PSPEED)
    a.imm("lda", 0).zp("sta", DRIFT)
    a.label("speed_set")

    add16(PDIST_LO, PDIST_HI, PSPEED)

    a.zp("lda", PDIST_HI)
    for _ in range(LAP_SHIFT):
        a.op("lsr_a")
    a.op("clc").imm("adc", 1).zp("sta", LAP)

    a.zp("lda", PDIST_HI).imm("cmp", FINAL_HI).branch("bcc", "still_racing")
    a.imm("lda", 1).zp("sta", FINISHED)
    a.imm("lda", 3).zp("sta", LAP)
    a.label("still_racing")
    a.op("rts")

    # ---- rivals -----------------------------------------------------------
    a.label("run_rivals")
    for i in range(RIVALS):
        rx, rs = RX + i, RSPEED + i
        rlo, rhi = RDIST_LO + i, RDIST_HI + i

        add16(rlo, rhi, rs)

        # Screen row = CENTRE - (their distance - ours), so a rival further
        # along sits higher up. The subtraction wraps, which handles "behind"
        # for free: TMP_LO is then 256 minus the gap.
        sub16_into_tmp(rlo, rhi)
        a.zp("lda", TMP_HI).branch("beq", "ahead_%d" % i)
        a.imm("cmp", 0xFF).branch("beq", "behind_%d" % i)
        a.abs("jmp", "hide_%d" % i)

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

        a.zp("lda", RY + i).imm("cmp", OFFSCREEN).branch("beq", "no_bump_%d" % i)
        a.zp("lda", rx).op("sec").zp("sbc", PX).op("clc").imm("adc", 15)
        a.imm("cmp", 31).branch("bcs", "no_bump_%d" % i)
        a.zp("lda", RY + i).op("sec").imm("sbc", CENTRE).op("clc").imm("adc", 15)
        a.imm("cmp", 31).branch("bcs", "no_bump_%d" % i)
        a.zp("lda", SPIN).branch("bne", "no_bump_%d" % i)
        a.imm("lda", SPIN_FRAMES).zp("sta", SPIN)
        a.imm("lda", 0).zp("sta", BOOST).zp("sta", DRIFT)
        a.label("no_bump_%d" % i)
    a.op("rts")

    # ---- item box ---------------------------------------------------------
    a.label("run_item")
    sub16_into_tmp(ITEM_LO, ITEM_HI)
    a.zp("lda", TMP_HI).branch("beq", "item_ahead")
    a.imm("cmp", 0xFF).branch("beq", "item_just_behind")
    a.abs("jmp", "item_passed")

    # A boost covers several units a frame, so a box can slip marginally
    # behind before it is ever tested. A few units of grace stops going fast
    # from making boxes unobtainable.
    a.label("item_just_behind")
    a.zp("lda", TMP_LO).imm("cmp", 240).branch("bcs", "item_reachable")
    a.abs("jmp", "item_passed")

    a.label("item_ahead")
    a.zp("lda", TMP_LO).imm("cmp", 140).branch("bcc", "item_reachable")
    a.imm("lda", OFFSCREEN).zp("sta", ITEMY)
    a.op("rts")

    a.label("item_reachable")
    a.imm("lda", CENTRE).op("sec").zp("sbc", TMP_LO).zp("sta", ITEMY)

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
    # Next box goes up the road, always somewhere on the tarmac.
    a.abs("jsr", "random")
    a.imm("and", 0x7F).op("clc").imm("adc", ROAD_LEFT + 8).zp("sta", ITEMX)
    a.zp("lda", PDIST_LO).op("clc").imm("adc", 190).zp("sta", ITEM_LO)
    a.zp("lda", PDIST_HI).imm("adc", 0).zp("sta", ITEM_HI)
    a.imm("lda", OFFSCREEN).zp("sta", ITEMY)
    a.op("rts")

    # ---- centre-line dashes -----------------------------------------------
    a.label("run_dashes")
    for i in range(STRIPES):
        a.zp("lda", STRIPE + i).op("clc").zp("adc", PSPEED)
        a.op("clc").zp("adc", PSPEED).zp("sta", STRIPE + i)
        a.imm("cmp", 232).branch("bcc", "dash_ok_%d" % i)
        a.imm("lda", 0).zp("sta", STRIPE + i)
        a.label("dash_ok_%d" % i)
    a.op("rts")

    # ---- position ---------------------------------------------------------
    a.label("standings")
    a.imm("lda", 1).zp("sta", POS)
    for i in range(RIVALS):
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

    a.zp("lda", LAP).op("clc").imm("adc", DIGIT_BASE).abs("sta", OAM_LAP + 1)
    a.zp("lda", POS).op("clc").imm("adc", DIGIT_BASE).abs("sta", OAM_POS + 1)
    a.op("rts")

    a.label("irq")
    a.op("rti")

    a.label("palette_data")
    a.byte(*PALETTE)
    a.label("row_data")
    a.byte(*ROW)
    a.label("attr_data")
    a.byte(*ATTR_ROW)

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
