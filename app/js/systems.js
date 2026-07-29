/* Shown at the bottom of Settings. Bump it with any change worth telling a
   device apart by — it is the quickest way to know whether a phone is running
   the current copy or a stale cached one. */
const APP_VERSION = "9";

/* Console definitions.
 *
 * `core` values are EmulatorJS system keys (see its consts.js).
 *
 * Systems marked `isolated` need SharedArrayBuffer, which the browser only
 * hands out to a cross-origin isolated page — normally impossible on GitHub
 * Pages, since that needs COOP/COEP response headers a static host won't send.
 * The service worker synthesises those headers when Heavy Systems is switched
 * on in Settings, so these appear only in that mode. See js/isolation.js.
 */

const SYSTEMS = [
  {
    core: "nes", name: "Nintendo Entertainment System", short: "NES",
    ext: ["nes", "fds", "unf", "unif", "nez"],
    art: ["#d24b3f", "#7a1f18"]
  },
  {
    core: "snes", name: "Super Nintendo", short: "SNES",
    ext: ["sfc", "smc", "fig", "swc", "bs"],
    art: ["#6f63b0", "#372f66"]
  },
  {
    core: "gb", name: "Game Boy / Color", short: "GB",
    ext: ["gb", "gbc", "dmg", "sgb"],
    art: ["#9bbc0f", "#41600a"]
  },
  {
    core: "gba", name: "Game Boy Advance", short: "GBA",
    ext: ["gba", "agb", "srl"],
    art: ["#5a4fc0", "#251d63"]
  },
  {
    core: "n64", name: "Nintendo 64", short: "N64",
    ext: ["n64", "z64", "v64", "ndd"],
    art: ["#2e8b57", "#14532d"], heavy: true
  },
  {
    core: "nds", name: "Nintendo DS", short: "DS",
    ext: ["nds", "dsi", "ids"],
    art: ["#7b8494", "#2f3440"], heavy: true
  },
  {
    core: "vb", name: "Virtual Boy", short: "VB",
    ext: ["vb", "vboy"],
    art: ["#d1462f", "#641e16"]
  },
  {
    core: "segaMD", name: "Sega Genesis / Mega Drive", short: "Genesis",
    ext: ["md", "gen", "smd", "mdx"],
    art: ["#1f5fbd", "#0b2a5c"]
  },
  {
    core: "segaMS", name: "Sega Master System", short: "Master System",
    ext: ["sms"],
    art: ["#3277c9", "#17386a"]
  },
  {
    core: "segaGG", name: "Sega Game Gear", short: "Game Gear",
    ext: ["gg"],
    art: ["#48597f", "#1c2438"]
  },
  {
    core: "sega32x", name: "Sega 32X", short: "32X",
    ext: ["32x"],
    art: ["#8b3a9c", "#3c1545"]
  },
  {
    core: "psx", name: "PlayStation", short: "PS1",
    ext: ["pbp", "chd", "ecm", "m3u", "cue"],
    art: ["#5a5a63", "#1e1e24"], heavy: true, bios: "SCPH1001.BIN or similar"
  },
  {
    core: "pce", name: "PC Engine / TurboGrafx-16", short: "PC Engine",
    ext: ["pce", "sgx"],
    art: ["#e08a1e", "#7c3a00"]
  },
  {
    core: "lynx", name: "Atari Lynx", short: "Lynx",
    ext: ["lnx"],
    art: ["#4b5563", "#111827"], bios: "lynxboot.img"
  },
  {
    core: "atari2600", name: "Atari 2600", short: "Atari 2600",
    ext: ["a26"],
    art: ["#9c4522", "#4a1d0a"]
  },
  {
    core: "arcade", name: "Arcade (FinalBurn Neo)", short: "Arcade",
    ext: [],
    art: ["#7c3aed", "#3b1d8f"]
  },

  /* ---- Heavy systems: only offered when isolation is active ------------- */
  {
    core: "psp", name: "PlayStation Portable", short: "PSP",
    ext: ["cso", "pbp"],
    art: ["#334155", "#0b1220"], heavy: true, isolated: true,
    /* Smooth-mode defaults for PPSSPP. Option names and values taken from the
       core's own libretro_core_options.h, not guessed. */
    perf: {
      ppsspp_internal_resolution: "480x272",   // native; upscaling is the big cost
      ppsspp_cpu_core: "JIT",
      ppsspp_texture_scaling_level: "disabled",
      ppsspp_texture_filtering: "Nearest",
      ppsspp_texture_anisotropic_filtering: "disabled",
      ppsspp_spline_quality: "Low",
      ppsspp_frameskip: "1"                    // drop a frame rather than stutter
    }
  },
  {
    core: "3ds", name: "Nintendo 3DS", short: "3DS",
    ext: ["3ds", "cci", "cxi", "app", "3dsx"],
    art: ["#dc2626", "#7f1d1d"], heavy: true, isolated: true,
    warning: "3DS is the heaviest thing here. Smooth mode is on — if it still " +
      "crawls, that's the console being emulated, not a setting.",
    /* Option names and values from the Citra libretro core's own definitions.
       The single-screen layout is the biggest win: the 3DS renders two. */
    perf: {
      citra_resolution_factor: "1x (Native)",
      citra_layout_option: "Single Screen Only",
      citra_use_hw_shaders: "enabled",
      citra_use_shader_jit: "enabled",
      citra_use_cpu_jit: "enabled",
      citra_use_acc_mul: "disabled",           // accuracy costs more than it gives
      citra_use_acc_geo_shaders: "disabled",
      citra_texture_filter: "none"
    }
  },
  {
    core: "dos", name: "MS-DOS", short: "DOS",
    ext: ["exe", "com", "bat", "jsdos"],
    art: ["#3f3f46", "#18181b"], isolated: true
  }
];

/* Systems that can be picked right now, given the current isolation state. */
function availableSystems() {
  return SYSTEMS.filter((sys) => !sys.isolated || Isolation.active);
}

/* Files Dolphin handles. These can't run in a browser at any speed, so the
   menu diverts them to the Dolphin Command Center shelf instead. */
const DOLPHIN_EXT = ["wbfs", "rvz", "gcz", "ciso", "wad", "wud", "wux", "wua", "nkit"];

const SYSTEM_BY_CORE = SYSTEMS.reduce((map, sys) => {
  map[sys.core] = sys;
  return map;
}, {});

function extensionOf(filename) {
  const match = /\.([a-z0-9]+)$/i.exec(filename || "");
  return match ? match[1].toLowerCase() : "";
}

/* Returns {kind: "system", system} | {kind: "dolphin"} | {kind: "unknown"}.
   A `.zip` could be anything, so the user picks. A `.iso` could be PlayStation
   or Wii — but a PS1 disc tops out around 700 MB and a Wii disc is 4.7 GB, so
   size settles it without asking. */
const WII_ISO_MIN_BYTES = 900 * 1024 * 1024;

function detectSystem(filename, size) {
  const ext = extensionOf(filename);
  if (!ext) return { kind: "unknown" };
  if (DOLPHIN_EXT.indexOf(ext) !== -1) return { kind: "dolphin" };
  if (ext === "iso" && size > WII_ISO_MIN_BYTES) return { kind: "dolphin" };
  for (const sys of SYSTEMS) {
    if (sys.ext.indexOf(ext) === -1) continue;
    // Recognised, but its core needs Heavy Systems switched on first. Say so
    // rather than pretending the file is unknown.
    if (sys.isolated && !Isolation.active) {
      return { kind: "needs-isolation", system: sys };
    }
    return { kind: "system", system: sys };
  }
  return { kind: "unknown" };
}

/* Strips the extension and the usual scene-release noise from a filename so
   channels get a readable title. */
function prettyTitle(filename) {
  let name = String(filename || "Game").replace(/\.[a-z0-9]+$/i, "");
  name = name.replace(/[_]+/g, " ");
  name = name.replace(/\((?:[^()]*)\)|\[[^\]]*\]/g, " ");
  name = name.replace(/\s{2,}/g, " ").trim();
  return name || "Game";
}

/* Up to three initials for the auto-generated box art. Filler words are
   dropped so "Legend of Zelda" reads LZ rather than LOZ. */
const FILLER_WORDS = ["of", "the", "and", "a", "an", "in", "to", "for", "vs"];

function initialsFor(title) {
  let words = String(title).split(/[\s:.\-_]+/).filter(Boolean);
  const meaty = words.filter((word) => FILLER_WORDS.indexOf(word.toLowerCase()) === -1);
  if (meaty.length) words = meaty;
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map((word) => word[0].toUpperCase()).join("");
}

/* Note: the file input deliberately has no `accept` list. iOS resolves accept
   entries to UTIs, and it has no UTI for .sfc, .z64, .gba and friends — so
   listing them greys those very files out in the Files picker. Everything is
   validated after selection instead. */
