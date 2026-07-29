"""Runs every bundled game on the 6502 simulator and checks what it does.

These ROMs ship to real devices, so "it assembled" is not enough — each one is
executed here and its behaviour asserted.

    python3 verify.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nesemu import Nes

HERE = os.path.dirname(os.path.abspath(__file__))
failures = []


def check(label, actual, expected):
    ok = actual == expected
    if not ok:
        failures.append(label)
    print(("  ok  " if ok else " FAIL ") + "%s: %r%s"
          % (label, actual, "" if ok else " (expected %r)" % (expected,)))


def load(name):
    rom = open(os.path.join(HERE, name), "rb").read()
    check("iNES header", rom[:4], b"NES\x1a")
    check("16 KB PRG, 8 KB CHR", (rom[4], rom[5]), (1, 1))
    nes = Nes(rom)
    nes.run_reset()
    return nes


# ==========================================================================
print("=== star-catcher.nes ===")
# ==========================================================================
PX, PY, SX, SY = 0x10, 0x11, 0x12, 0x13
ONES, TENS = 0x14, 0x15

nes = load("star-catcher.nes")
check("background colour set", nes.palette[0], 0x21)
check("sprite palette yellow", nes.palette[17], 0x28)
check("NMI enabled", nes.ppuctrl, 0x80)
check("rendering enabled", nes.ppumask, 0x1E)
check("player starts centred", (nes.ram[PX], nes.ram[PY]), (120, 120))

# OAM is DMA'd at the top of the NMI, before this frame's logic, so what the
# PPU shows is deliberately one frame behind — the standard NES pattern.
nes.run_nmi()
nes.run_nmi()
check("player sprite placed", (nes.oam[0], nes.oam[3]), (120, 120))
check("star sprite tile", nes.oam[17], 0x05)
check("score digits are tiles $10", (nes.oam[21], nes.oam[25]), (0x10, 0x10))

nes.buttons = 0x01                      # right
for _ in range(10):
    nes.run_nmi()
check("moved right 20px", nes.ram[PX], 140)
nes.buttons = 0x08                      # up
for _ in range(5):
    nes.run_nmi()
check("moved up 10px", nes.ram[PY], 110)

nes.buttons = 0x00
nes.ram[PX], nes.ram[PY] = nes.ram[SX], nes.ram[SY]
old_star = (nes.ram[SX], nes.ram[SY])
nes.run_nmi()
check("score went up", (nes.ram[TENS], nes.ram[ONES]), (0, 1))
check("star moved", (nes.ram[SX], nes.ram[SY]) != old_star, True)
check("star stayed on screen", 8 < nes.ram[SX] < 248 and 8 < nes.ram[SY] < 232, True)

for _ in range(10):                     # roll the ones digit into the tens
    nes.ram[PX], nes.ram[PY] = nes.ram[SX], nes.ram[SY]
    nes.run_nmi()
check("score rolled to 11", (nes.ram[TENS], nes.ram[ONES]), (1, 1))

for start, button, expect, name in [(230, 0x01, 236, "right"), (10, 0x02, 2, "left")]:
    nes.ram[PX] = start
    nes.buttons = button
    for _ in range(20):
        nes.run_nmi()
    check("stops at the %s edge" % name, nes.ram[PX], expect)

for start, button, expect, name in [(200, 0x04, 206, "bottom"), (20, 0x08, 8, "top")]:
    nes.ram[PY] = start
    nes.buttons = button
    for _ in range(20):
        nes.run_nmi()
    check("stops at the %s edge" % name, nes.ram[PY], expect)


# ==========================================================================
print("\n=== kart-dash.nes ===")
# ==========================================================================
KPX, KPSPEED, KBOOST, KSPIN = 0x10, 0x11, 0x12, 0x13
PDIST_LO, PDIST_HI = 0x14, 0x15
KRX, KRSPEED = 0x16, 0x19
RDIST_LO, RDIST_HI = 0x1C, 0x1F
KITEMX, KITEM_LO, KITEM_HI = 0x22, 0x23, 0x24
KLAP, KPOS = 0x25, 0x26
KDRIFT = 0x29
KSTRIPE = 0x2A
KFINISHED = 0x30
KRY = 0x31
CENTRE, OFFSCREEN = 150, 250
T_ROAD, T_LEFT, T_RIGHT, T_GRASS = 0x20, 0x21, 0x22, 0x23
BTN_RIGHT, BTN_LEFT, BTN_B = 0x01, 0x02, 0x40
OAM_PLAYER, OAM_ITEM, OAM_LAP, OAM_POS = 0x00, 0x50, 0x54, 0x58

kart = load("kart-dash.nes")

# ---- the road is actually drawn ----------------------------------------
row = list(kart.vram[0:32])
check("road: grass on the left", row[0:4], [T_GRASS] * 4)
check("road: white line, left", row[4], T_LEFT)
check("road: tarmac between", row[5:27], [T_ROAD] * 22)
check("road: white line, right", row[27], T_RIGHT)
check("road: grass on the right", row[28:32], [T_GRASS] * 4)
check("road runs the full height", list(kart.vram[29 * 32:30 * 32]), row)
attr = list(kart.vram[0x3C0:0x3C8])
check("grass and tarmac get different palettes", attr, [0x55] + [0x00] * 6 + [0x55])
check("tarmac palette", kart.palette[1], 0x10)
check("grass palette", kart.palette[5], 0x1A)

check("starts on lap 1 in 1st", (kart.ram[KLAP], kart.ram[KPOS]), (1, 1))
check("starts at base speed", kart.ram[KPSPEED], 3)

kart.run_nmi()
kart.run_nmi()
check("player sits at the centre row", kart.oam[OAM_PLAYER], CENTRE)
check("HUD digits come from the digit tiles", kart.oam[OAM_LAP + 1], 0x31)

# ---- steering, and the grass penalty ------------------------------------
kart.buttons = BTN_RIGHT
for _ in range(10):
    kart.run_nmi()
check("steers right at 3px a frame", kart.ram[KPX], 150)
kart.buttons = BTN_LEFT
for _ in range(20):
    kart.run_nmi()
check("steers left", kart.ram[KPX], 90)

kart.buttons = 0x00
kart.ram[KPX] = 120
kart.ram[KSPIN] = 0
kart.run_nmi()
check("full speed on the tarmac", kart.ram[KPSPEED], 3)
kart.ram[KPX] = 20                       # out on the grass
kart.run_nmi()
check("the grass bogs you down", kart.ram[KPSPEED], 1)
kart.ram[KPX] = 220                      # grass on the other side
kart.run_nmi()
check("both verges bog you down", kart.ram[KPSPEED], 1)
kart.ram[KPX] = 120
kart.run_nmi()
check("back on the tarmac, back to speed", kart.ram[KPSPEED], 3)

# ---- drifting ------------------------------------------------------------
kart.ram[KDRIFT] = 0
kart.ram[KBOOST] = 0
kart.buttons = BTN_B | BTN_RIGHT
kart.ram[KPX] = 60
kart.run_nmi()
check("drifting turns harder than steering", kart.ram[KPX], 65)

kart.ram[KPX] = 120
for _ in range(30):
    kart.ram[KPX] = 120                  # hold station while charging
    kart.run_nmi()
check("holding B while turning charges the drift", kart.ram[KDRIFT] > 0, True)
charged = kart.ram[KDRIFT]

kart.buttons = 0x00                      # release
kart.run_nmi()
# The turbo is granted in steer() and then ticked down by advance() in the
# same frame, so it reads one less than it was set to.
check("releasing a charged drift fires a turbo", kart.ram[KBOOST], 44)
check("the charge resets after firing", kart.ram[KDRIFT], 0)
kart.run_nmi()
check("the turbo actually raises speed", kart.ram[KPSPEED], 7)

# A brief flick of B should not pay out.
for _ in range(120):
    kart.run_nmi()                       # let the turbo expire
kart.ram[KDRIFT] = 0
kart.ram[KBOOST] = 0
kart.ram[KPX] = 120
kart.buttons = BTN_B | BTN_RIGHT
kart.run_nmi()
kart.buttons = 0x00
kart.ram[KPX] = 120
kart.run_nmi()
check("a flick of B earns nothing", kart.ram[KBOOST], 0)

# Drifting onto the grass loses the charge.
kart.ram[KDRIFT] = 40
kart.ram[KPX] = 20
kart.buttons = BTN_B | BTN_RIGHT
kart.run_nmi()
check("sliding onto the grass kills the charge", kart.ram[KDRIFT], 0)
kart.buttons = 0x00
kart.ram[KPX] = 120

# ---- laps, position, rivals ---------------------------------------------
kart.ram[PDIST_HI] = 8
kart.run_nmi()
check("lap 2 after 8 high-bytes", kart.ram[KLAP], 2)

kart.ram[PDIST_LO], kart.ram[PDIST_HI] = 100, 4
kart.ram[RDIST_LO], kart.ram[RDIST_HI] = 140, 4          # 40 ahead
kart.ram[RDIST_LO + 1], kart.ram[RDIST_HI + 1] = 60, 4   # 40 behind
kart.ram[KRX], kart.ram[KRX + 1] = 45, 55
kart.ram[KPX] = 190
kart.ram[KRSPEED] = kart.ram[KRSPEED + 1] = 0
kart.run_nmi()
check("a rival ahead draws higher", kart.ram[KRY] < CENTRE, True)
check("a rival behind draws lower", kart.ram[KRY + 1] > CENTRE, True)
check("gaps stay symmetric about the player",
      (CENTRE - kart.ram[KRY]) + (kart.ram[KRY + 1] - CENTRE), 80)

kart.ram[RDIST_HI] = 6
kart.run_nmi()
check("one rival ahead is 2nd", kart.ram[KPOS], 2)
kart.ram[RDIST_HI + 1] = kart.ram[RDIST_HI + 2] = 6
kart.run_nmi()
check("all three ahead is 4th", kart.ram[KPOS], 4)
for i in range(3):
    kart.ram[RDIST_HI + i] = 0
kart.run_nmi()
check("leading the field is 1st", kart.ram[KPOS], 1)

# ---- item boxes ----------------------------------------------------------
for i in range(3):
    kart.ram[KRX + i] = 45
kart.ram[KPX] = 120
kart.ram[PDIST_LO], kart.ram[PDIST_HI] = 100, 4
kart.ram[KITEMX] = 120
kart.ram[KITEM_LO], kart.ram[KITEM_HI] = 100, 4
kart.ram[KBOOST] = 0
kart.run_nmi()
check("an item box grants a boost", kart.ram[KBOOST], 90)
check("the next box lands on the tarmac", 40 <= kart.ram[KITEMX] <= 200, True)

# ---- contact -------------------------------------------------------------
kart.ram[KSPIN] = 0
kart.ram[KDRIFT] = 30
kart.ram[KPX] = 100
kart.ram[PDIST_LO], kart.ram[PDIST_HI] = 100, 4
kart.ram[KRX], kart.ram[RDIST_LO], kart.ram[RDIST_HI] = 100, 100, 4
kart.ram[KRSPEED] = 0
kart.run_nmi()
check("contact spins you out", kart.ram[KSPIN] > 0, True)
check("a spin cancels boost and charge",
      (kart.ram[KBOOST], kart.ram[KDRIFT]), (0, 0))
kart.run_nmi()
check("spinning slows you to a crawl", kart.ram[KPSPEED], 1)

kart.ram[KSPIN] = 0
kart.ram[KRX] = 150                       # 50px clear
kart.run_nmi()
check("a near miss does not spin you", kart.ram[KSPIN], 0)

# ---- the finish ----------------------------------------------------------
kart.ram[KSPIN] = 0
kart.ram[PDIST_HI] = 24
kart.run_nmi()
check("three laps ends the race", kart.ram[KFINISHED], 1)
frozen = (kart.ram[PDIST_HI] << 8) | kart.ram[PDIST_LO]
for _ in range(10):
    kart.run_nmi()
check("nothing moves once finished",
      (kart.ram[PDIST_HI] << 8) | kart.ram[PDIST_LO], frozen)

print("\n=== %d failures ===" % len(failures))
for name in failures:
    print("  " + name)
raise SystemExit(1 if failures else 0)
