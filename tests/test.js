/* Engine tests. Run from the site folder: node tests/test.js
   The climate below is a SYNTHETIC test input (not NASA data). It only checks the maths. */
const path = require("path");
const dir = path.resolve(process.argv[2] || ".");
const C = require(path.join(dir, "calc.js"));
const D = require(path.join(dir, "data.js"));
const DEG = Math.PI / 180;
let fail = 0;
function check(name, got, want, tolPct) {
  const err = want === 0 ? Math.abs(got) : Math.abs(got / want - 1) * 100;
  const ok = err <= tolPct;
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + name + ": got " + (+got).toFixed(4) + ", expected " + (+want).toFixed(4) + " (" + err.toFixed(2) + "% off, limit " + tolPct + "%)");
}

const test = { lat: 24.7, ghi: [3.8, 4.8, 5.7, 6.4, 7.2, 7.9, 7.7, 7.2, 6.4, 5.3, 4.1, 3.5],
               t: [14, 17, 21, 27, 33, 36, 37, 37, 33, 28, 21, 16], range: Array(12).fill(13) };
const d = D.DEFAULTS;
const opt = { tilt: 24, az: 0, albedo: d.albedo, tempCoeff: d.panel.tempCoeff, noct: d.panel.noct, losses: d.losses, inverterEff: d.inverterEff };

// 1. Extraterrestrial irradiation, hand value for lat 24.7 N, 17 January (worked by hand: 6.76 kWh/m2/day)
check("H0 Riyadh-latitude, 17 Jan", C.extraterrestrial(24.7, 17), 6.76, 0.5);

// 2. Hourly split conserves the daily total; flat panel receives exactly the horizontal value
for (const m of [0, 5]) {
  const day = C.hourlyDay(24.7, C.MEAN_DAY[m], test.ghi[m], 0, 0, 0.2);
  check("hourly GHI sums to daily, month " + (m + 1), day.reduce((a, h) => a + h.ghi, 0), test.ghi[m], 0.01);
  check("tilt 0 gives POA = GHI, month " + (m + 1), day.reduce((a, h) => a + h.poa, 0), test.ghi[m], 0.01);
}

// 3. Independent closed-form check (Liu & Jordan / Klein monthly method, south-facing)
function kleinPOA(lat, n, H, tilt, rho) {
  const dec = C.declination(n) * DEG, phi = lat * DEG, b = tilt * DEG;
  const ws = Math.acos(-Math.tan(phi) * Math.tan(dec));
  const wsT = Math.min(ws, Math.acos(-Math.tan(phi - b) * Math.tan(dec)));
  const rb = (Math.cos(phi - b) * Math.cos(dec) * Math.sin(wsT) + wsT * Math.sin(phi - b) * Math.sin(dec)) /
             (Math.cos(phi) * Math.cos(dec) * Math.sin(ws) + ws * Math.sin(phi) * Math.sin(dec));
  const fd = C.diffuseFraction(H / C.extraterrestrial(lat, n), ws / DEG);
  return H * ((1 - fd) * rb + fd * (1 + Math.cos(b)) / 2 + rho * (1 - Math.cos(b)) / 2);
}
const sim = C.simulate(test, opt);
let kleinYear = 0;
for (let m = 0; m < 12; m++) kleinYear += kleinPOA(24.7, C.MEAN_DAY[m], test.ghi[m], 24, 0.2) * C.DAYS[m];
check("yearly POA, hourly engine vs closed-form Klein", sim.poaYear, kleinYear, 3);
check("January POA vs Klein", sim.monthly[0].poaDaily, kleinPOA(24.7, 17, 3.8, 24, 0.2), 5);
check("June POA vs Klein", sim.monthly[5].poaDaily, kleinPOA(24.7, 162, 7.9, 24, 0.2), 5);

// 4. Loss chain multiplies out
const chain = 0.95 * 0.97 * 0.98 * 0.98 * 0.995 * 0.99 * 0.97 * 0.96;
const tempFactor = sim.monthly.reduce((a, x) => a + x.afterTemp, 0) / sim.poaYear;
check("AC yield = POA x temperature x losses x inverter", sim.acYear, sim.poaYear * tempFactor * chain, 0.01);
console.log("     info: POA " + sim.poaYear.toFixed(0) + " kWh/m2, temperature loss " + ((1 - tempFactor) * 100).toFixed(1) + "%, PR " + sim.performanceRatio.toFixed(3) + ", yield " + sim.acYear.toFixed(0) + " kWh/kWp, best tilt " + C.optimalTilt(test, opt));

// 5. Tariff: published example (1,000 kWh, breaker under 100 A = SAR 280 before VAT) and inverse
const t27 = D.TARIFFS.y2027;
check("1,000 kWh bill before VAT (Ajel example)", C.energyCost(1000, t27) + t27.fee, 280, 0.001);
check("8,000 kWh energy charge", C.energyCost(8000, t27), 6000 * 0.21 + 2000 * 0.33, 0.001);
for (const k of [900, 6000, 7500]) {
  const bill = (C.energyCost(k, t27) + 70) * 1.15;
  check("bill -> kWh inverse at " + k, C.kwhFromBill(bill, t27, 0.15, 70), k, 0.001);
}

// 6. Economics, simple case worked by hand:
// 10 panels (5.8 kWp), 150 kWh/kWp every month, load 3,000 kWh/month, 100% daytime, no degradation, no upkeep.
// Year production 5.8*150*12 = 10,440 kWh, all self-used. Saving 10,440*0.21*1.15 = 2,521.26 SAR.
// Cost 5.8*3,500 = 20,300 SAR. Payback 20,300/2,521.26 = 8.05 years.
const base = { yieldMonthly: Array(12).fill(150), nPanels: 10, panelKw: 0.58, load: Array(12).fill(3000), dayShare: 1,
  tariff: t27, vat: 0.15, exportRate: 0.07, costPerKwp: 3500, omPct: 0, years: 25, deg1: 0, degAnnual: 0 };
const e = C.economics(base);
check("year-1 production", e.first.prod, 10440, 0.001);
check("year-1 saving", e.first.saving, 2521.26, 0.001);
check("payback", e.payback, 20300 / 2521.26, 0.01);
// Export case: daytime share 20% -> self 600/month, export 270/month. Saving = 7,200*0.2415 + 3,240*0.07 = 1,965.60
const e2 = C.economics(Object.assign({}, base, { dayShare: 0.2 }));
check("saving with export", e2.first.saving, 7200 * 0.2415 + 3240 * 0.07, 0.001);
check("energy balance self + export = production", e2.first.self + e2.first.exp, e2.first.prod, 0.0001);
// Tier crossing: load 7,000, self 2,000 -> saves 1,000 kWh at 0.33 and 1,000 at 0.21
const e3 = C.economics(Object.assign({}, base, { load: Array(12).fill(7000), yieldMonthly: Array(12).fill(2000 / 5.8) }));
check("tier-aware saving", e3.first.saving / 12, (1000 * 0.33 + 1000 * 0.21) * 1.15, 0.001);
// Degradation: year 25 factor 0.99*0.996^24
const e4 = C.economics(Object.assign({}, base, { deg1: 0.01, degAnnual: 0.004 }));
let life = 0; for (let y = 1; y <= 25; y++) life += 10440 * 0.99 * Math.pow(0.996, y - 1);
check("25-year production with degradation", e4.lifeProd, life, 0.001);

// 7. Row spacing: flat panel needs no gap; tilted needs more than its own footprint
check("row pitch at tilt 0", C.rowPitch(24.7, 0, 0, 2.278), 2.278, 0.001);
const pitch = C.rowPitch(24.7, 24, 0, 2.278);
console.log("     info: row pitch at 24 deg tilt = " + pitch.toFixed(2) + " m");
if (!(pitch > 2.278 * Math.cos(24 * DEG) && pitch < 6)) { fail++; console.log("FAIL row pitch out of range"); }

// 8. Recommended size beats neighbours
const yM = sim.monthly.map(x => x.ac);
const load = C.consumptionProfile(3000, "seasonal", test.t);
check("seasonal profile keeps the yearly total", load.reduce((a, b) => a + b, 0), 36000, 0.001);
const p = Object.assign({}, base, { yieldMonthly: yM, load: load, dayShare: 0.5, omPct: 1, deg1: 0.01, degAnnual: 0.004 });
const rec = C.recommend(p, 80);
const lo = C.economics(Object.assign({}, p, { nPanels: Math.max(rec.nPanels - 1, 1) })).net;
const hi = C.economics(Object.assign({}, p, { nPanels: rec.nPanels + 1 })).net;
console.log("     info: recommended " + rec.nPanels + " panels (" + rec.kwp.toFixed(1) + " kWp), payback " + (rec.payback || 0).toFixed(1) + " y, net " + rec.net.toFixed(0) + " SAR, self-use " + (rec.selfUseShare * 100).toFixed(0) + "%");
if (rec.net < lo || rec.net < hi) { fail++; console.log("FAIL recommended size is not the best"); } else console.log("PASS recommended size is a maximum of 25-year net saving");

console.log(fail ? "\n" + fail + " FAILED" : "\nALL PASSED");
process.exit(fail ? 1 : 0);
