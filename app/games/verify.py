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
KSTRIPE = 0x2A
KFINISHED = 0x30
KRY, KITEMY = 0x31, 0x34
CENTRE, OFFSCREEN = 150, 250
OAM_PLAYER, OAM_RIVAL, OAM_STRIPE, OAM_ITEM = 0x00, 0x10, 0x40, 0x50
OAM_LAP, OAM_POS = 0x54, 0x58

kart = load("kart-dash.nes")
check("NMI enabled", kart.ppuctrl, 0x80)
check("player is red", kart.palette[17], 0x16)
check("rivals are blue", kart.palette[21], 0x11)
check("starts on lap 1 in 1st", (kart.ram[KLAP], kart.ram[KPOS]), (1, 1))
check("starts at base speed", kart.ram[KPSPEED], 2)

kart.run_nmi()
kart.run_nmi()
check("player sits at the centre row", kart.oam[OAM_PLAYER], CENTRE)
check("item box uses its own palette", kart.oam[OAM_ITEM + 2], 3)
check("HUD shows lap as a digit", kart.oam[OAM_LAP + 1], 0x11)

# Steering.
kart.buttons = 0x01
for _ in range(10):
    kart.run_nmi()
check("steers right", kart.ram[KPX], 150)
kart.buttons = 0x02
for _ in range(20):
    kart.run_nmi()
check("steers left", kart.ram[KPX], 90)
kart.buttons = 0x00

# Distance accumulates as a 16-bit value and drives the lap counter.
before = (kart.ram[PDIST_HI] << 8) | kart.ram[PDIST_LO]
kart.run_nmi()
after = (kart.ram[PDIST_HI] << 8) | kart.ram[PDIST_LO]
check("distance advances by the speed", after - before, kart.ram[KPSPEED])

kart.ram[PDIST_HI] = 8          # one lap in
kart.run_nmi()
check("lap 2 after 8 high-bytes", kart.ram[KLAP], 2)
kart.ram[PDIST_HI] = 16
kart.run_nmi()
check("lap 3 after 16", kart.ram[KLAP], 3)

# A rival further along should sit higher up the screen than one behind.
kart.ram[PDIST_LO], kart.ram[PDIST_HI] = 100, 4
kart.ram[RDIST_LO], kart.ram[RDIST_HI] = 140, 4          # 40 ahead
kart.ram[RDIST_LO + 1], kart.ram[RDIST_HI + 1] = 60, 4   # 40 behind
kart.ram[KRX], kart.ram[KRX + 1] = 30, 40                # clear of the player
kart.ram[KPX] = 200
kart.ram[KRSPEED] = kart.ram[KRSPEED + 1] = 0            # hold them still
kart.run_nmi()
check("a rival ahead is drawn higher", kart.ram[KRY] < CENTRE, True)
check("a rival behind is drawn lower", kart.ram[KRY + 1] > CENTRE, True)
# The player advances during the frame, so the gaps shift by the speed —
# but they stay symmetric about the new position, 80 units apart.
check("gaps stay symmetric about the player",
      (CENTRE - kart.ram[KRY]) + (kart.ram[KRY + 1] - CENTRE), 80)

# Far away in either direction, they are parked off screen.
kart.ram[RDIST_LO], kart.ram[RDIST_HI] = 100, 6          # 512 ahead
kart.run_nmi()
check("a distant rival is hidden", kart.ram[KRY], OFFSCREEN)

# Position: each rival further along costs a place.
kart.ram[PDIST_LO], kart.ram[PDIST_HI] = 0, 4
for i in range(3):
    kart.ram[RDIST_LO + i], kart.ram[RDIST_HI + i] = 0, 2      # all behind
kart.run_nmi()
check("leading the field is 1st", kart.ram[KPOS], 1)

kart.ram[RDIST_HI] = 6                                         # one gets ahead
kart.run_nmi()
check("one rival ahead is 2nd", kart.ram[KPOS], 2)
kart.ram[RDIST_HI + 1] = 6
kart.ram[RDIST_HI + 2] = 6
kart.run_nmi()
check("all three ahead is 4th", kart.ram[KPOS], 4)

# Item box: driving over one grants a boost, and a new box goes out ahead.
for i in range(3):
    kart.ram[RDIST_HI + i] = 0                                 # rivals out of the way
    kart.ram[KRX + i] = 20
kart.ram[PDIST_LO], kart.ram[PDIST_HI] = 100, 4
kart.ram[KPX] = 120
kart.ram[KITEMX] = 120
kart.ram[KITEM_LO], kart.ram[KITEM_HI] = 100, 4                # right on top of us
kart.ram[KBOOST] = 0
old_item = (kart.ram[KITEM_LO], kart.ram[KITEM_HI])
kart.run_nmi()
check("item box grants a boost", kart.ram[KBOOST] > 0, True)
check("a new item box goes out ahead",
      (kart.ram[KITEM_LO], kart.ram[KITEM_HI]) != old_item, True)
check("the new box is on the road", 16 < kart.ram[KITEMX] < 232, True)

kart.run_nmi()
check("boost raises the speed", kart.ram[KPSPEED], 5)
for _ in range(120):
    kart.run_nmi()
check("boost runs out", kart.ram[KBOOST], 0)
check("speed returns to normal", kart.ram[KPSPEED], 2)

# Contact with a rival spins you out and cancels any boost.
kart.ram[KBOOST] = 60
kart.ram[KSPIN] = 0
kart.ram[KPX] = 100
kart.ram[PDIST_LO], kart.ram[PDIST_HI] = 100, 4
kart.ram[KRX], kart.ram[RDIST_LO], kart.ram[RDIST_HI] = 100, 100, 4
kart.ram[KRSPEED] = 0
kart.run_nmi()
check("contact spins you out", kart.ram[KSPIN] > 0, True)
check("a spin cancels the boost", kart.ram[KBOOST], 0)
kart.run_nmi()
check("spinning slows you down", kart.ram[KPSPEED], 1)

# A near miss must not.
kart.ram[KSPIN] = 0
kart.ram[KPX] = 100
kart.ram[KRX] = 140                                            # 40px clear
kart.run_nmi()
check("a near miss does not spin you", kart.ram[KSPIN], 0)

# Road markings scroll and loop.
first = kart.ram[KSTRIPE]
kart.run_nmi()
check("markings scroll", kart.ram[KSTRIPE] != first, True)
kart.ram[KSTRIPE] = 230
kart.run_nmi()
check("markings loop", kart.ram[KSTRIPE] < 16, True)

# Three laps ends the race, and it stays ended.
kart.ram[KSPIN] = 0
kart.ram[PDIST_HI] = 24
kart.run_nmi()
check("race finishes after three laps", kart.ram[KFINISHED], 1)
check("it shows lap 3, not a fourth", kart.ram[KLAP], 3)
frozen = ((kart.ram[PDIST_HI] << 8) | kart.ram[PDIST_LO])
for _ in range(10):
    kart.run_nmi()
check("nothing moves once finished",
      ((kart.ram[PDIST_HI] << 8) | kart.ram[PDIST_LO]), frozen)

print("\n=== %d failures ===" % len(failures))
for name in failures:
    print("  " + name)
raise SystemExit(1 if failures else 0)
