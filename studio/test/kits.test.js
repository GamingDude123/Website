global.DSP = require(__dirname + "/../js/dsp.js");
global.Instrument = require(__dirname + "/../js/instrument.js");
global.Polish = require(__dirname + "/../js/polish.js");
const Kits = require(__dirname + "/../js/kits.js");

const SR = 44100;
let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}
function centroid(x) { return DSP.features(x, SR).centroid; }
function bandShare(x, lo, hi) {
  const N = 8192;
  const re = new Float64Array(N), im = new Float64Array(N);
  const w = DSP.hann(N);
  for (let i = 0; i < N; i++) { re[i] = (x[i] || 0) * w[i]; im[i] = 0; }
  DSP.fft(re, im, false);
  let inBand = 0, total = 1e-12;
  for (let k = 1; k < N / 2; k++) {
    const f = (k * SR) / N;
    const m = Math.hypot(re[k], im[k]);
    total += m;
    if (f >= lo && f <= hi) inBand += m;
  }
  return inBand / total;
}

// --- every voice makes a sound, and is the sound it says it is
{
  const names = Object.keys(Instrument.voices);
  check("there are enough voices for a kit", names.length >= 12, names.length + ": " + names.join(" "));

  let problems = [];
  names.forEach(function (name) {
    const x = Instrument.render(name, SR, { rootHz: 55, pitchHz: 110, seed: 3 });
    if (!x || !x.length) { problems.push(name + ": empty"); return; }
    for (let i = 0; i < x.length; i++) {
      if (!isFinite(x[i])) { problems.push(name + ": NaN"); return; }
    }
    if (DSP.peak(x) < 0.5) problems.push(name + ": too quiet (" + DSP.peak(x).toFixed(2) + ")");
    if (DSP.peak(x) > 0.9001) problems.push(name + ": too loud (" + DSP.peak(x).toFixed(2) + ")");
    // nothing should start or end with a step, or it clicks on every hit
    if (Math.abs(x[0]) > 0.02 || Math.abs(x[x.length - 1]) > 0.02) problems.push(name + ": clicks");
  });
  check("every voice renders clean", problems.length === 0, problems.join("; ") || names.length + " voices");
}

// --- the voices are distinguishable as what they claim to be
{
  const kick = Instrument.render("kick", SR, { rootHz: 55, seed: 1 });
  check("the kick is nearly all low end", bandShare(kick, 0, 200) > 0.8,
    (100 * bandShare(kick, 0, 200)).toFixed(0) + "% under 200Hz");

  const hat = Instrument.render("hat", SR, { seed: 1 });
  check("the hat is nearly all top end", bandShare(hat, 6000, 20000) > 0.75 && hat.length / SR < 0.12,
    (100 * bandShare(hat, 6000, 20000)).toFixed(0) + "% over 6kHz, " + (hat.length / SR).toFixed(3) + "s");

  const open = Instrument.render("openhat", SR, { seed: 1 });
  check("the open hat rings much longer than the closed one", open.length > hat.length * 4,
    (open.length / SR).toFixed(2) + "s vs " + (hat.length / SR).toFixed(2) + "s");

  // A shaker and a hat are both bright noise; the attack is what separates them.
  const shaker = Instrument.render("shaker", SR, { seed: 1 });
  const rise = function (x) {
    const peak = DSP.peak(x);
    for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > peak * 0.8) return i / SR;
    return 0;
  };
  check("the shaker takes longer to speak than the hat", rise(shaker) > rise(hat) * 1.5,
    "shaker " + (1000 * rise(shaker)).toFixed(1) + "ms vs hat " + (1000 * rise(hat)).toFixed(1) + "ms");

  const sub = Instrument.render("sub", SR, { pitchHz: 55, seed: 1 });
  const p = DSP.detectPitch(sub, SR, 30, 400);
  check("the sub plays the note it was asked for", Math.abs(p.freq - 55) < 2, p.freq.toFixed(2) + "Hz");

  // The stab is a triad, so its third and fifth should both be there.
  const stab = Instrument.render("stab", SR, { rootHz: 220, notes: [0, 3, 7], seed: 1 });
  const third = 220 * Math.pow(2, 3 / 12);
  const fifth = 220 * Math.pow(2, 7 / 12);
  check("the stab is an actual chord",
    bandShare(stab, 216, 224) > 0.02 && bandShare(stab, third * 0.99, third * 1.01) > 0.02 &&
    bandShare(stab, fifth * 0.99, fifth * 1.01) > 0.02,
    "root/third/fifth = " + [220, third, fifth].map(function (f, i) {
      const lo = [216, third * 0.99, fifth * 0.99][i];
      const hi = [224, third * 1.01, fifth * 1.01][i];
      return (100 * bandShare(stab, lo, hi)).toFixed(1) + "%";
    }).join(" / "));

  // The filter closing is what makes a stab a stab rather than a held chord.
  const early = centroid(stab.slice(0, Math.round(0.04 * SR)));
  const late = centroid(stab.slice(Math.round(0.18 * SR)));
  check("the stab's filter closes over its life", early > late * 1.5,
    "centroid " + early.toFixed(0) + "Hz -> " + late.toFixed(0) + "Hz");
}

// --- the kits themselves
{
  check("there are several kits", Kits.all.length >= 4, Kits.all.map(function (k) { return k.id; }).join(" "));

  Kits.all.forEach(function (kit) {
    const built = Kits.build(kit, SR);
    check(kit.name + ": builds every pad", built.length === kit.pads.length && built.every(function (p) {
      return p.samples && p.samples.length > 64 && DSP.peak(p.samples) > 0.5;
    }), built.length + " pads");

    check(kit.name + ": every pad has a part", built.every(function (p) {
      return p.steps.length === 16 && p.steps.some(Boolean);
    }));

    // A kit nobody can hear the kick in is not a kit.
    const kick = built.find(function (p) { return p.role === "kick"; });
    check(kit.name + ": has a kick on the downbeat", kick && kick.steps[0] > 0,
      kick ? "step 0 at " + kick.steps[0] : "no kick");

    check(kit.name + ": tempo and swing are set", kit.bpm >= 100 && kit.bpm <= 150 && kit.swing >= 0 && kit.swing <= 0.4,
      kit.bpm + "bpm swing " + kit.swing);
    check(kit.name + ": brings its own effects",
      kit.master && kit.master.reverb !== undefined && kit.master.delay !== undefined &&
      kit.master.sidechain !== undefined,
      JSON.stringify(kit.master));
  });
}

// --- the genres are actually different from each other
{
  const house = Kits.byId("house");
  const garage = Kits.byId("garage");
  const houseKick = house.pads[0].steps;
  const garageKick = garage.pads[0].steps;

  // Four on the floor means a kick on every beat.
  check("house is four on the floor", [0, 4, 8, 12].every(function (i) { return houseKick[i] > 0; }),
    [0, 4, 8, 12].map(function (i) { return houseKick[i]; }).join(","));
  // Two-step means beats two and four are left alone for the clap.
  check("garage leaves beats two and four to the clap",
    garageKick[4] === 0 && garageKick[12] === 0 && garageKick[0] > 0,
    "kick on " + garageKick.reduce(function (n, v, i) { return v ? n.concat(i) : n; }, []).join(","));
  check("garage swings much harder than house", garage.swing > house.swing * 2,
    garage.swing + " vs " + house.swing);

  const tech = Kits.byId("tech");
  const techBass = tech.pads.find(function (p) { return p.voice === "bass"; }).steps;
  check("tech house bass rolls on the offbeats",
    [2, 6, 10, 14].every(function (i) { return techBass[i] > 0; }) &&
    [0, 4, 8, 12].every(function (i) { return !techBass[i]; }),
    techBass.reduce(function (n, v, i) { return v ? n.concat(i) : n; }, []).join(","));
}

// --- loading a kit is quick enough not to feel like a wait
{
  const t0 = Date.now();
  Kits.all.forEach(function (kit) { Kits.build(kit, SR); });
  const ms = Date.now() - t0;
  console.log("timing: building all " + Kits.all.length + " kits = " + ms + "ms");
  check("kits build fast enough to feel instant", ms < 900, ms + "ms for " + Kits.all.length);
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nall green");
process.exit(fails ? 1 : 0);
