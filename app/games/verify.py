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
KPX = 0x10
KRX, KRY, KRS = 0x12, 0x15, 0x18
KONES, KTENS = 0x1B, 0x1C
KSTRIPE = 0x20
PLAYER_Y = 184
OAM_PLAYER, OAM_RIVAL, OAM_STRIPE = 0x00, 0x10, 0x40

kart = load("kart-dash.nes")
check("NMI enabled", kart.ppuctrl, 0x80)
check("rendering enabled", kart.ppumask, 0x1E)
check("player is red", kart.palette[17], 0x16)
check("rivals are blue", kart.palette[21], 0x11)
check("markings are white", kart.palette[25], 0x30)
check("player starts centred", kart.ram[KPX], 120)
check("three rivals, three speeds",
      [kart.ram[KRS + i] for i in range(3)], [2, 3, 4])

kart.run_nmi()
kart.run_nmi()
check("player sits at the bottom", kart.oam[OAM_PLAYER + 0], PLAYER_Y)
check("player drawn as a kart",
      [kart.oam[OAM_PLAYER + q * 4 + 1] for q in range(4)], [0x01, 0x02, 0x03, 0x04])
check("rivals use the second palette", kart.oam[OAM_RIVAL + 2], 1)
check("markings run down the centre", kart.oam[OAM_STRIPE + 3], 124)
check("markings use the stripe tile", kart.oam[OAM_STRIPE + 1], 0x05)

# Steering: three pixels a frame.
kart.buttons = 0x01
for _ in range(10):
    kart.run_nmi()
check("steers right", kart.ram[KPX], 150)
kart.buttons = 0x02
for _ in range(20):
    kart.run_nmi()
check("steers left", kart.ram[KPX], 90)

for start, button, limit, name in [(222, 0x01, 227, "right"), (20, 0x02, 240, "left")]:
    kart.ram[KPX] = start
    kart.buttons = button
    for _ in range(20):
        kart.run_nmi()
    check("stays on the road at the %s edge" % name,
          0 < kart.ram[KPX] <= limit, True)

# Rivals come down the road and loop back to the top.
kart.buttons = 0x00
kart.ram[KPX] = 120
kart.ram[KRX], kart.ram[KRY] = 20, 100          # far from the player
before = kart.ram[KRY]
kart.run_nmi()
check("rival advances down the road", kart.ram[KRY] > before, True)

kart.ram[KRY] = 230
kart.run_nmi()
check("rival loops to the top", kart.ram[KRY] < 16, True)
check("rival respawns on the road", 16 < kart.ram[KRX] < 232, True)
check("rival gets a fresh speed", 2 <= kart.ram[KRS] <= 5, True)


def hold_rivals_clear():
    """Park the rivals well away from the player for score-only frames."""
    for index, (x, y) in enumerate([(20, 40), (30, 60), (40, 80)]):
        kart.ram[KRX + index] = x
        kart.ram[KRY + index] = y


kart.ram[KONES] = kart.ram[KTENS] = 0
for _ in range(40):
    hold_rivals_clear()
    kart.run_nmi()
check("score climbs while surviving", kart.ram[KONES] > 0, True)

kart.ram[KTENS], kart.ram[KONES] = 9, 9
for _ in range(80):
    hold_rivals_clear()
    kart.run_nmi()
check("score stops at 99", (kart.ram[KTENS], kart.ram[KONES]), (9, 9))

# Driving into a rival resets the run.
kart.ram[KTENS], kart.ram[KONES] = 4, 2
kart.ram[KPX] = 100
kart.ram[KRX], kart.ram[KRY] = 100, PLAYER_Y
kart.run_nmi()
check("crash clears the score", (kart.ram[KTENS], kart.ram[KONES]), (0, 0))
check("crash recentres the kart", kart.ram[KPX], 120)
check("crash sends rivals back to the top",
      all(kart.ram[KRY + i] < 16 for i in range(3)), True)

# A near miss must not count.
kart.ram[KTENS], kart.ram[KONES] = 3, 3
kart.ram[KPX] = 100
kart.ram[KRX], kart.ram[KRY] = 130, PLAYER_Y      # 30px clear
kart.ram[KRX + 1], kart.ram[KRY + 1] = 40, 40
kart.ram[KRX + 2], kart.ram[KRY + 2] = 60, 60
kart.run_nmi()
check("a near miss is not a crash", (kart.ram[KTENS], kart.ram[KONES]), (3, 3))

# Road markings scroll and loop.
first = kart.ram[KSTRIPE]
kart.run_nmi()
check("markings scroll", kart.ram[KSTRIPE] != first, True)
kart.ram[KSTRIPE] = 230
kart.run_nmi()
check("markings loop at the bottom", kart.ram[KSTRIPE] < 16, True)

print("\n=== %d failures ===" % len(failures))
for name in failures:
    print("  " + name)
raise SystemExit(1 if failures else 0)
