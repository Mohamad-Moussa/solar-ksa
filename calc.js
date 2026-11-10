/* calc.js — the engineering model. Pure functions, no page access, so it can be
   tested on its own (see tests/test.js).

   Method (Duffie & Beckman, Solar Engineering of Thermal Processes):
   1. Monthly mean daily horizontal irradiation H comes from NASA POWER.
   2. Clearness index KT = H / H0 (H0 = extraterrestrial irradiation).
   3. Diffuse part from the Erbs monthly correlation.
   4. The day is split into hours (Collares-Pereira & Rabl).
   5. Each hour is moved onto the tilted panel (isotropic sky model, Liu & Jordan).
   6. Cell temperature from the NOCT model, power from the temperature coefficient.
   7. System losses and inverter efficiency are applied (PVWatts-style factors). */

(function (root) {
  const DEG = Math.PI / 180;
  const MEAN_DAY = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344]; // Klein's mean day of each month
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const GSC = 1.367; // solar constant, kW/m2

  // Solar declination in degrees for day-of-year n (Cooper).
  function declination(n) {
    return 23.45 * Math.sin(DEG * 360 * (284 + n) / 365);
  }

  // Sunset hour angle in degrees.
  function sunsetAngle(lat, dec) {
    const x = -Math.tan(lat * DEG) * Math.tan(dec * DEG);
    return Math.acos(Math.max(-1, Math.min(1, x))) / DEG;
  }

  // Daily extraterrestrial irradiation on a horizontal surface, kWh/m2/day.
  function extraterrestrial(lat, n) {
    const dec = declination(n), ws = sunsetAngle(lat, dec);
    const e0 = 1 + 0.033 * Math.cos(DEG * 360 * n / 365);
    return (24 / Math.PI) * GSC * e0 *
      (Math.cos(lat * DEG) * Math.cos(dec * DEG) * Math.sin(ws * DEG) +
       ws * DEG * Math.sin(lat * DEG) * Math.sin(dec * DEG));
  }

  // Monthly-average diffuse fraction Hd/H (Erbs, Klein & Duffie 1982).
  function diffuseFraction(kt, ws) {
    const k = Math.max(0.3, Math.min(0.8, kt));
    return ws <= 81.4
      ? 1.391 - 3.560 * k + 4.189 * k * k - 2.137 * k * k * k
      : 1.311 - 3.022 * k + 3.427 * k * k - 1.821 * k * k * k;
  }

  /* One average day of a month, hour by hour.
     lat: degrees north. n: day of year. H: kWh/m2/day on the horizontal.
     tilt: degrees from horizontal. az: degrees from south, west positive.
     Returns [{ t (solar hour), ghi, poa }] with ghi and poa in kWh/m2 for that hour. */
  function hourlyDay(lat, n, H, tilt, az, albedo) {
    const phi = lat * DEG, dec = declination(n) * DEG;
    const wsDeg = sunsetAngle(lat, dec / DEG), ws = wsDeg * DEG;
    const Hd = H * diffuseFraction(H / extraterrestrial(lat, n), wsDeg);
    const a = 0.409 + 0.5016 * Math.sin(ws - 60 * DEG);
    const b = 0.6609 - 0.4767 * Math.sin(ws - 60 * DEG);
    const beta = tilt * DEG, g = az * DEG;

    const hours = [];
    let sumT = 0, sumD = 0;
    for (let h = 0; h < 24; h++) {
      const t = h + 0.5, w = 15 * (t - 12) * DEG;
      if (Math.abs(w) >= ws) continue;
      const base = Math.cos(w) - Math.cos(ws);
      const wt = Math.max((a + b * Math.cos(w)) * base, 0);
      hours.push({ t, w, wt, wd: base });
      sumT += wt; sumD += base;
    }

    return hours.map(function (x) {
      const I = H * x.wt / sumT;                     // total on horizontal this hour
      const Id = Math.min(Hd * x.wd / sumD, I);      // diffuse part
      const Ib = I - Id;                             // beam part
      const cosZ = Math.cos(phi) * Math.cos(dec) * Math.cos(x.w) + Math.sin(phi) * Math.sin(dec);
      const cosT =
        Math.sin(dec) * Math.sin(phi) * Math.cos(beta) -
        Math.sin(dec) * Math.cos(phi) * Math.sin(beta) * Math.cos(g) +
        Math.cos(dec) * Math.cos(phi) * Math.cos(beta) * Math.cos(x.w) +
        Math.cos(dec) * Math.sin(phi) * Math.sin(beta) * Math.cos(g) * Math.cos(x.w) +
        Math.cos(dec) * Math.sin(beta) * Math.sin(g) * Math.sin(x.w);
      const rb = Math.min(Math.max(cosT, 0) / Math.max(cosZ, 0.05), 8);
      const poa = Ib * rb + Id * (1 + Math.cos(beta)) / 2 + I * albedo * (1 - Math.cos(beta)) / 2;
      return { t: x.t, ghi: I, poa: poa };
    });
  }

  /* Full-year simulation for 1 kWp of panels.
     climate: { lat, ghi[12] kWh/m2/day, t[12] deg C, range[12] deg C or null }
     opt: { tilt, az, albedo, tempCoeff, noct, losses{...} in %, inverterEff in % }
     Returns monthly and yearly energy in kWh per kWp, plus a step-by-step loss list. */
  function simulate(climate, opt) {
    const L = opt.losses;
    const chain = [
      ["soiling", L.soiling], ["shading", L.shading], ["mismatch", L.mismatch],
      ["wiring", L.wiring], ["connections", L.connections],
      ["nameplate", L.nameplate], ["availability", L.availability]
    ];
    let dcFactor = 1;
    chain.forEach(function (c) { dcFactor *= 1 - c[1] / 100; });
    const inv = opt.inverterEff / 100;

    const monthly = [];
    let ghiY = 0, refY = 0, tempY = 0;
    for (let m = 0; m < 12; m++) {
      const day = hourlyDay(climate.lat, MEAN_DAY[m], climate.ghi[m], opt.tilt, opt.az, opt.albedo);
      let range = climate.range ? climate.range[m] : 12;
      if (!isFinite(range)) range = 12;
      range = Math.max(6, Math.min(18, range));
      let poaDay = 0, eDay = 0;
      day.forEach(function (h) {
        const ta = climate.t[m] + (range / 2) * Math.cos(15 * (h.t - 15) * DEG); // warmest at 15:00
        const tc = ta + (opt.noct - 20) / 0.8 * h.poa;                           // cell temperature
        poaDay += h.poa;
        eDay += h.poa * (1 + opt.tempCoeff * (tc - 25));
      });
      const ref = poaDay * DAYS[m];          // kWh/kWp if panels stayed at 25 deg C with no losses
      const afterTemp = eDay * DAYS[m];
      monthly.push({
        ghi: climate.ghi[m] * DAYS[m], poaDaily: poaDay, ref: ref,
        afterTemp: afterTemp, ac: afterTemp * dcFactor * inv
      });
      ghiY += climate.ghi[m] * DAYS[m]; refY += ref; tempY += afterTemp;
    }

    // Loss list for the "where the energy goes" chart: each step's loss as % of the previous step.
    const steps = [{ id: "temperature", pct: (1 - tempY / refY) * 100 }];
    chain.forEach(function (c) { steps.push({ id: c[0], pct: c[1] }); });
    steps.push({ id: "inverter", pct: 100 - opt.inverterEff });

    const acY = tempY * dcFactor * inv;
    return {
      monthly: monthly, ghiYear: ghiY, poaYear: refY, acYear: acY,
      tiltGainPct: (refY / ghiY - 1) * 100,
      performanceRatio: acY / refY, steps: steps
    };
  }

  // Tilt (0–45 deg) that gives the most yearly energy for this location and direction.
  function optimalTilt(climate, opt) {
    let best = 0, bestE = -1;
    for (let tilt = 0; tilt <= 45; tilt++) {
      const e = simulate(climate, Object.assign({}, opt, { tilt: tilt })).acYear;
      if (e > bestE) { bestE = e; best = tilt; }
    }
    return best;
  }

  /* Distance between panel rows (front edge to front edge) so that one row does not
     shade the next between 9:00 and 15:00 solar time on 21 December. Metres. */
  function rowPitch(lat, tilt, az, panelLength) {
    const phi = lat * DEG, dec = -23.45 * DEG, beta = tilt * DEG;
    let gap = 0;
    [-45, 45].forEach(function (wDeg) {
      const w = wDeg * DEG;
      const cosZ = Math.cos(phi) * Math.cos(dec) * Math.cos(w) + Math.sin(phi) * Math.sin(dec);
      const alt = Math.max(Math.asin(cosZ), 5 * DEG);
      const sinZ = Math.sqrt(1 - cosZ * cosZ);
      let cosAz = (cosZ * Math.sin(phi) - Math.sin(dec)) / (sinZ * Math.cos(phi));
      cosAz = Math.max(-1, Math.min(1, cosAz));
      const sunAz = Math.sign(w) * Math.acos(cosAz);        // from south, west positive
      const d = panelLength * Math.sin(beta) * Math.max(Math.cos(sunAz - az * DEG), 0) / Math.tan(alt);
      if (d > gap) gap = d;
    });
    return panelLength * Math.cos(beta) + gap;
  }

  // Energy charge in SAR before VAT for a month's kWh.
  function energyCost(kwh, tariff) {
    const k = Math.max(kwh, 0);
    return Math.min(k, tariff.limit) * tariff.r1 + Math.max(k - tariff.limit, 0) * tariff.r2;
  }

  // Monthly kWh from a bill total in SAR (bill includes VAT and the fixed fee).
  function kwhFromBill(bill, tariff, vat, fee) {
    const cost = bill / (1 + vat) - fee;
    if (cost <= 0) return 0;
    const first = tariff.limit * tariff.r1;
    return cost <= first ? cost / tariff.r1 : tariff.limit + (cost - first) / tariff.r2;
  }

  /* Spread an average monthly kWh over the year.
     mode "flat": same use every day. mode "seasonal": more in hot months,
     weighted by how far the monthly mean temperature is above 18 deg C. */
  function consumptionProfile(avgKwh, mode, temps) {
    const w = DAYS.map(function (d, m) {
      return mode === "seasonal" ? d * (1 + 0.12 * Math.max(temps[m] - 18, 0)) : d;
    });
    const sum = w.reduce(function (a, b) { return a + b; }, 0);
    return w.map(function (x) { return avgKwh * 12 * x / sum; });
  }

  /* Money side for a given number of panels.
     p: { yieldMonthly[12] kWh/kWp (before degradation), nPanels, panelKw, load[12] kWh,
          dayShare 0..1, tariff, vat, exportRate, costPerKwp, omPct, years, deg1, degAnnual } */
  function economics(p) {
    const kwp = p.nPanels * p.panelKw;
    const cost = kwp * p.costPerKwp;
    const om = cost * p.omPct / 100;

    function year(factor) {
      let prod = 0, self = 0, exp = 0, saving = 0;
      const months = [];
      for (let m = 0; m < 12; m++) {
        const e = kwp * p.yieldMonthly[m] * factor;
        const s = Math.min(e, p.dayShare * p.load[m]);   // solar used in the home
        const x = e - s;                                 // surplus sent to the grid
        const sv = (energyCost(p.load[m], p.tariff) - energyCost(p.load[m] - s, p.tariff)) * (1 + p.vat) +
                   x * p.exportRate;
        prod += e; self += s; exp += x; saving += sv;
        months.push({ prod: e, self: s, exp: x, saving: sv });
      }
      return { prod: prod, self: self, exp: exp, saving: saving, months: months };
    }

    const cash = [-cost];           // cumulative cash position at the end of each year
    let payback = null, first = null, lifeProd = 0;
    for (let y = 1; y <= p.years; y++) {
      const f = (1 - p.deg1) * Math.pow(1 - p.degAnnual, y - 1);
      const r = year(f);
      if (y === 1) first = r;
      lifeProd += r.prod;
      const prev = cash[y - 1], now = prev + r.saving - om;
      cash.push(now);
      if (payback === null && now >= 0) payback = y - 1 + (-prev) / (now - prev);
    }
    const load = p.load.reduce(function (a, b) { return a + b; }, 0);
    return {
      kwp: kwp, cost: cost, om: om, first: first, cash: cash, payback: payback,
      net: cash[p.years], lifeProd: lifeProd, loadYear: load,
      selfUseShare: first.prod > 0 ? first.self / first.prod : 0,   // share of solar used at home
      coverage: load > 0 ? first.self / load : 0                    // share of home use met by solar
    };
  }

  // Number of panels (1..maxPanels) with the highest net saving over the analysis period.
  function recommend(p, maxPanels) {
    let best = null;
    for (let n = 1; n <= maxPanels; n++) {
      const r = economics(Object.assign({}, p, { nPanels: n }));
      if (!best || r.net > best.net) { best = r; best.nPanels = n; }
    }
    return best;
  }

  root.SolarCalc = {
    DAYS: DAYS, MEAN_DAY: MEAN_DAY, declination: declination, sunsetAngle: sunsetAngle,
    extraterrestrial: extraterrestrial, diffuseFraction: diffuseFraction, hourlyDay: hourlyDay,
    simulate: simulate, optimalTilt: optimalTilt, rowPitch: rowPitch, energyCost: energyCost,
    kwhFromBill: kwhFromBill, consumptionProfile: consumptionProfile,
    economics: economics, recommend: recommend
  };
  if (typeof module !== "undefined") module.exports = root.SolarCalc;
})(typeof window !== "undefined" ? window : globalThis);
