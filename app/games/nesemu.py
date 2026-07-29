"""A small 6502 simulator, enough to run these games and check what they do.

Not a full NES: RAM, the handful of PPU and controller registers the games
touch, and OAM DMA. The point is to execute the real ROM rather than trust it.
"""


class Nes:
    def __init__(self, rom):
        assert rom[:4] == b"NES\x1a", "bad iNES magic"
        self.prg = rom[16:16 + 16384]
        self.chr = rom[16 + 16384:16 + 16384 + 8192]
        self.ram = bytearray(0x800)
        self.oam = bytearray(256)
        self.palette = bytearray(32)
        self.ppu_addr = 0
        self.ppu_latch = False
        self.ppuctrl = 0
        self.ppumask = 0
        self.buttons = 0          # A B Select Start Up Down Left Right
        self.shift = 0
        self.a = self.x = self.y = 0
        self.sp = 0xFD
        self.pc = 0
        self.c = self.z = self.n = self.v = 0

    # -- memory -------------------------------------------------------------
    def read(self, addr):
        addr &= 0xFFFF
        if addr < 0x2000:
            return self.ram[addr & 0x7FF]
        if addr < 0x4000:
            reg = 0x2000 + (addr & 7)
            if reg == 0x2002:
                self.ppu_latch = False
                return 0x80        # vblank always set, so the waits complete
            return 0
        if addr == 0x4016:
            bit = (self.shift >> 7) & 1
            self.shift = (self.shift << 1) & 0xFF
            return bit
        if addr >= 0x8000:
            return self.prg[(addr - 0x8000) & 0x3FFF]
        return 0

    def write(self, addr, value):
        addr &= 0xFFFF
        value &= 0xFF
        if addr < 0x2000:
            self.ram[addr & 0x7FF] = value
            return
        if addr < 0x4000:
            reg = 0x2000 + (addr & 7)
            if reg == 0x2000:
                self.ppuctrl = value
            elif reg == 0x2001:
                self.ppumask = value
            elif reg == 0x2006:
                if self.ppu_latch:
                    self.ppu_addr = ((self.ppu_addr << 8) | value) & 0x3FFF
                    self.ppu_latch = False
                else:
                    self.ppu_addr = value
                    self.ppu_latch = True
            elif reg == 0x2007:
                if 0x3F00 <= self.ppu_addr < 0x3F20:
                    self.palette[self.ppu_addr - 0x3F00] = value
                self.ppu_addr += 1
            return
        if addr == 0x4014:
            base = value << 8
            for i in range(256):
                self.oam[i] = self.read(base + i)
            return
        if addr == 0x4016:
            if value & 1:
                self.shift = self.buttons
            return

    # -- helpers ------------------------------------------------------------
    def setzn(self, value):
        value &= 0xFF
        self.z = 1 if value == 0 else 0
        self.n = 1 if value & 0x80 else 0
        return value

    def push(self, value):
        self.ram[0x100 + self.sp] = value & 0xFF
        self.sp = (self.sp - 1) & 0xFF

    def pop(self):
        self.sp = (self.sp + 1) & 0xFF
        return self.ram[0x100 + self.sp]

    def fetch(self):
        value = self.read(self.pc)
        self.pc = (self.pc + 1) & 0xFFFF
        return value

    def fetch16(self):
        low = self.fetch()
        return low | (self.fetch() << 8)

    def branch(self, take):
        offset = self.fetch()
        if take:
            if offset & 0x80:
                offset -= 256
            self.pc = (self.pc + offset) & 0xFFFF

    def compare(self, register, value):
        result = (register - value) & 0x1FF
        self.c = 1 if register >= value else 0
        self.setzn(result & 0xFF)

    def step(self):
        op = self.fetch()

        if op == 0x78 or op == 0xD8:  return          # SEI / CLD
        if op == 0x18: self.c = 0;    return          # CLC
        if op == 0x38: self.c = 1;    return          # SEC
        if op == 0x9A: self.sp = self.x; return       # TXS
        if op == 0xE8: self.x = self.setzn(self.x + 1); return
        if op == 0xCA: self.x = self.setzn(self.x - 1); return
        if op == 0xC8: self.y = self.setzn(self.y + 1); return
        if op == 0x88: self.y = self.setzn(self.y - 1); return
        if op == 0xAA: self.x = self.setzn(self.a); return
        if op == 0xA8: self.y = self.setzn(self.a); return
        if op == 0x8A: self.a = self.setzn(self.x); return
        if op == 0x98: self.a = self.setzn(self.y); return
        if op == 0x48: self.push(self.a); return
        if op == 0x68: self.a = self.setzn(self.pop()); return
        if op == 0xEA: return

        if op == 0x4A:                                  # LSR A
            self.c = self.a & 1
            self.a = self.setzn(self.a >> 1)
            return
        if op == 0x0A:                                  # ASL A
            self.c = (self.a >> 7) & 1
            self.a = self.setzn(self.a << 1)
            return
        if op == 0x2A:                                  # ROL A
            carry = self.c
            self.c = (self.a >> 7) & 1
            self.a = self.setzn((self.a << 1) | carry)
            return

        if op == 0xA9: self.a = self.setzn(self.fetch()); return
        if op == 0xA2: self.x = self.setzn(self.fetch()); return
        if op == 0xA0: self.y = self.setzn(self.fetch()); return
        if op == 0xA5: self.a = self.setzn(self.read(self.fetch())); return
        if op == 0xA6: self.x = self.setzn(self.read(self.fetch())); return
        if op == 0xAD: self.a = self.setzn(self.read(self.fetch16())); return
        if op == 0xAE: self.x = self.setzn(self.read(self.fetch16())); return
        if op == 0xB5: self.a = self.setzn(self.read((self.fetch() + self.x) & 0xFF)); return
        if op == 0xBD: self.a = self.setzn(self.read(self.fetch16() + self.x)); return

        if op == 0x85: self.write(self.fetch(), self.a); return
        if op == 0x86: self.write(self.fetch(), self.x); return
        if op == 0x84: self.write(self.fetch(), self.y); return
        if op == 0x8D: self.write(self.fetch16(), self.a); return
        if op == 0x8E: self.write(self.fetch16(), self.x); return
        if op == 0x8C: self.write(self.fetch16(), self.y); return
        if op == 0x95: self.write((self.fetch() + self.x) & 0xFF, self.a); return
        if op == 0x9D: self.write(self.fetch16() + self.x, self.a); return

        if op == 0xC9: self.compare(self.a, self.fetch()); return
        if op == 0xE0: self.compare(self.x, self.fetch()); return
        if op == 0xC0: self.compare(self.y, self.fetch()); return
        if op == 0xC5: self.compare(self.a, self.read(self.fetch())); return
        if op == 0xCD: self.compare(self.a, self.read(self.fetch16())); return

        if op == 0x29: self.a = self.setzn(self.a & self.fetch()); return
        if op == 0x09: self.a = self.setzn(self.a | self.fetch()); return
        if op == 0x49: self.a = self.setzn(self.a ^ self.fetch()); return
        if op == 0x25: self.a = self.setzn(self.a & self.read(self.fetch())); return

        if op == 0x69:                                  # ADC #
            value = self.fetch()
            total = self.a + value + self.c
            self.c = 1 if total > 0xFF else 0
            self.a = self.setzn(total)
            return
        if op == 0x65:                                  # ADC zp
            value = self.read(self.fetch())
            total = self.a + value + self.c
            self.c = 1 if total > 0xFF else 0
            self.a = self.setzn(total)
            return
        if op == 0xE9 or op == 0xE5:                    # SBC # / zp
            value = self.fetch() if op == 0xE9 else self.read(self.fetch())
            total = self.a - value - (1 - self.c)
            self.c = 0 if total < 0 else 1
            self.a = self.setzn(total & 0xFF)
            return

        if op == 0xE6:                                  # INC zp
            addr = self.fetch()
            self.write(addr, self.setzn(self.read(addr) + 1))
            return
        if op == 0xC6:                                  # DEC zp
            addr = self.fetch()
            self.write(addr, self.setzn(self.read(addr) - 1))
            return

        if op == 0x2C:                                  # BIT abs
            value = self.read(self.fetch16())
            self.n = (value >> 7) & 1
            self.v = (value >> 6) & 1
            self.z = 1 if (self.a & value) == 0 else 0
            return

        if op == 0xD0: self.branch(self.z == 0); return
        if op == 0xF0: self.branch(self.z == 1); return
        if op == 0x10: self.branch(self.n == 0); return
        if op == 0x30: self.branch(self.n == 1); return
        if op == 0x90: self.branch(self.c == 0); return
        if op == 0xB0: self.branch(self.c == 1); return

        if op == 0x4C: self.pc = self.fetch16(); return
        if op == 0x20:                                  # JSR
            target = self.fetch16()
            back = (self.pc - 1) & 0xFFFF
            self.push(back >> 8)
            self.push(back & 0xFF)
            self.pc = target
            return
        if op == 0x60:                                  # RTS
            low = self.pop()
            self.pc = ((self.pop() << 8) | low) + 1
            return
        if op == 0x40:                                  # RTI
            self.pc = 0xFFFF                            # marker: NMI finished
            return

        raise AssertionError("unimplemented opcode $%02X at $%04X"
                             % (op, (self.pc - 1) & 0xFFFF))

    # -- driving ------------------------------------------------------------
    def run_reset(self, budget=200000):
        self.pc = self.prg[0x3FFC] | (self.prg[0x3FFD] << 8)
        last = None
        for _ in range(budget):
            here = self.pc
            self.step()
            if self.pc == here:        # the JMP-to-self main loop
                return True
            last = here
        raise AssertionError("reset never settled, last pc $%04X" % last)

    def run_nmi(self, budget=20000):
        vector = self.prg[0x3FFA] | (self.prg[0x3FFB] << 8)
        self.pc = vector
        for _ in range(budget):
            self.step()
            if self.pc == 0xFFFF:
                return True
        raise AssertionError("NMI never returned")
