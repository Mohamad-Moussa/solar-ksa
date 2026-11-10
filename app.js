/* app.js — the page: reads the form, loads NASA POWER data, calls calc.js, draws results. */

(function () {
  const DATA = SOLAR_DATA, Calc = SolarCalc, D = DATA.DEFAULTS;
  const $ = function (s) { return document.querySelector(s); };
  const KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const NASA = "https://power.larc.nasa.gov/api/temporal/climatology/point";

  const state = { lang: "en", climate: null, offline: false, error: null, last: null, loadId: 0 };
  const cache = {};

  /* ---------- small helpers ---------- */
  function t(key, vars) {
    let s = I18N[state.lang][key];
    if (s === undefined) s = I18N.en[key] || key;
    if (vars && typeof s === "string") Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  }
  function fmt(n, dec) {
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(id, lo, hi, fallback) {
    const v = parseFloat($("#" + id).value);
    if (!isFinite(v)) return fallback;
    return Math.max(lo, Math.min(hi, v));
  }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

  /* ---------- NASA POWER ---------- */
  // Turns the NASA reply into { lat, ghi[12], t[12], range[12]|null }, or null if anything looks wrong.
  function parseNasa(json, lat) {
    try {
      const p = json.properties.parameter;
      let ghi = KEYS.map(function (k) { return Number(p.ALLSKY_SFC_SW_DWN[k]); });
      const units = (json.parameters && json.parameters.ALLSKY_SFC_SW_DWN && json.parameters.ALLSKY_SFC_SW_DWN.units) || "";
      if (/MJ/i.test(units)) ghi = ghi.map(function (v) { return v / 3.6; });   // MJ to kWh
      const temp = KEYS.map(function (k) { return Number(p.T2M[k]); });
      const okG = ghi.every(function (v) { return isFinite(v) && v > 0.5 && v < 12; });
      const okT = temp.every(function (v) { return isFinite(v) && v > -30 && v < 60; });
      if (!okG || !okT) return null;
      let range = null;
      if (p.T2M_RANGE) {
        range = KEYS.map(function (k) { return Number(p.T2M_RANGE[k]); });
        if (!range.every(function (v) { return isFinite(v) && v > 0 && v < 40; })) range = null;
      }
      return { lat: lat, ghi: ghi, t: temp, range: range };
    } catch (e) { return null; }
  }

  async function fetchClimate(lat, lon) {
    const key = "solarksa:" + lat.toFixed(3) + "," + lon.toFixed(3);
    if (cache[key]) return cache[key];
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && saved.ghi && saved.ghi.length === 12) { cache[key] = saved; return saved; }
    } catch (e) { /* storage not available: carry on */ }
    const sets = ["ALLSKY_SFC_SW_DWN,T2M,T2M_RANGE", "ALLSKY_SFC_SW_DWN,T2M"];
    for (let i = 0; i < sets.length; i++) {
      try {
        const r = await fetch(NASA + "?parameters=" + sets[i] + "&community=RE&longitude=" + lon + "&latitude=" + lat + "&format=JSON");
        if (!r.ok) continue;
        const c = parseNasa(await r.json(), lat);
        if (c) {
          cache[key] = c;
          try { localStorage.setItem(key, JSON.stringify(c)); } catch (e) { /* ignore */ }
          return c;
        }
      } catch (e) { /* try the next set */ }
    }
    throw new Error("NASA POWER unavailable");
  }

  function currentLocation() {
    const id = $("#city").value;
    if (id === "custom") {
      const lat = parseFloat($("#lat").value), lon = parseFloat($("#lon").value);
      if (!(lat >= 15 && lat <= 33 && lon >= 34 && lon <= 56)) return null;
      return { id: "custom", lat: lat, lon: lon };
    }
    return DATA.CITIES.find(function (c) { return c.id === id; });
  }

  async function loadClimate() {
    const loc = currentLocation(), my = ++state.loadId;
    state.climate = null; state.error = null; state.offline = false;
    if (!loc) { state.error = "badCoords"; render(); return; }
    $("#status").textContent = t("loading");
    try {
      const c = await fetchClimate(loc.lat, loc.lon);
      if (my !== state.loadId) return;
      state.climate = c;
    } catch (e) {
      if (my !== state.loadId) return;
      const fb = DATA.FALLBACK_CLIMATE[loc.id];
      if (fb) { state.climate = Object.assign({ lat: loc.lat }, fb); state.offline = true; }
      else state.error = "loadFail";
    }
    state.loc = loc;
    render();
  }

  /* ---------- inputs and calculation ---------- */
  function readInputs() {
    const unit = document.querySelector('input[name="unit"]:checked').value;
    const monthly = [];
    for (let m = 0; m < 12; m++) { const v = parseFloat($("#m" + m).value); monthly.push(isFinite(v) && v > 0 ? v : 0); }
    return {
      roofArea: num("roofArea", 0, 100000, D.roofArea), usable: num("usable", 0, 100, D.usableShare),
      az: parseFloat($("#facing").value), autoTilt: $("#autoTilt").checked, tilt: num("tilt", 0, 45, 22),
      unit: unit, pattern: $("#pattern").value, usage: num("usage", 0, 1e7, 0), monthly: monthly,
      dayShare: num("dayShare", 0, 100, D.dayShare) / 100,
      tariffKey: $("#tariff").value, fee: num("fee", 0, 10000, 0),
      cost: num("cost", 0, 100000, D.costPerKwp), om: num("om", 0, 20, D.omPct),
      soiling: num("soiling", 0, 90, D.losses.soiling), shading: num("shading", 0, 90, D.losses.shading),
      autoSize: $("#autoSize").checked, panels: parseInt($("#panels").value, 10) || 1
    };
  }

  function compute(inp, climate) {
    const tariff = DATA.TARIFFS[inp.tariffKey], panel = D.panel;
    const toKwh = function (x) { return inp.unit === "bill" ? Calc.kwhFromBill(x, tariff, D.vat, inp.fee) : x; };
    const load = inp.pattern === "monthly" ? inp.monthly.map(toKwh)
      : Calc.consumptionProfile(toKwh(inp.usage), inp.pattern, climate.t);

    const simOpt = {
      tilt: 0, az: inp.az, albedo: D.albedo, tempCoeff: panel.tempCoeff, noct: panel.noct,
      losses: Object.assign({}, D.losses, { soiling: inp.soiling, shading: inp.shading }), inverterEff: D.inverterEff
    };
    simOpt.tilt = inp.autoTilt ? Calc.optimalTilt(climate, simOpt) : inp.tilt;
    const sim = Calc.simulate(climate, simOpt);

    const pitch = Calc.rowPitch(climate.lat, simOpt.tilt, inp.az, panel.length);
    const areaPerPanel = pitch * panel.width;
    const maxPanels = Math.floor(inp.roofArea * inp.usable / 100 / areaPerPanel);

    const p = {
      yieldMonthly: sim.monthly.map(function (m) { return m.ac; }), panelKw: panel.kw, load: load,
      dayShare: inp.dayShare, tariff: tariff, vat: D.vat, exportRate: D.exportRate, costPerKwp: inp.cost,
      omPct: inp.om, years: D.years, deg1: panel.deg1, degAnnual: panel.degAnnual
    };
    let best = null, eco = null;
    if (maxPanels >= 1 && sum(load) > 0) {
      best = Calc.recommend(p, maxPanels);
      const n = inp.autoSize ? best.nPanels : Math.min(inp.panels, maxPanels);
      eco = Calc.economics(Object.assign({}, p, { nPanels: n }));
      eco.nPanels = n;
    }
    return { tilt: simOpt.tilt, sim: sim, pitch: pitch, areaPerPanel: areaPerPanel, maxPanels: maxPanels, load: load, best: best, eco: eco };
  }

  /* ---------- drawing ---------- */
  function niceTicks(lo, hi, count) {
    const span = hi - lo || 1, raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).find(function (s) { return s >= raw; });
    const start = Math.floor(lo / step) * step, ticks = [];
    for (let v = start; v < hi + step * 0.999; v += step) ticks.push(Math.round(v / step) * step);
    return ticks;
  }
  function short(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
    return String(Math.round(v));
  }
  // Bar with a rounded top that sits flat on the baseline.
  function bar(x, y, w, h, cls) {
    const r = Math.min(3, w / 2, h);
    return '<path style="fill:var(--' + cls + ')" d="M' + x + "," + (y + h) + "V" + (y + r) + "q0," + -r + " " + r + "," + -r +
      "h" + (w - 2 * r) + "q" + r + ",0 " + r + "," + r + "V" + (y + h) + 'z"/>';
  }

  function drawMonths(res) {
    const el = $("#chartMonth"), W = Math.max(el.clientWidth, 280), H = 260;
    const m = { l: 44, r: 8, t: 10, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const prod = res.eco.first.months.map(function (x) { return x.prod; }), use = res.load;
    const ticks = niceTicks(0, Math.max.apply(null, prod.concat(use)), 4), top = ticks[ticks.length - 1];
    const y = function (v) { return m.t + ih - v / top * ih; };
    const band = iw / 12, bw = Math.max(3, Math.min(16, (band - 8) / 2));
    const labels = (W < 520 || state.lang === "ar") ? t("monthsShort") : t("months");
    let s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("c_month")) + '">';
    ticks.forEach(function (v) {
      s += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
           '<text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + short(v) + "</text>";
    });
    for (let i = 0; i < 12; i++) {
      const cx = m.l + band * i + band / 2;
      s += bar(cx - bw - 1, y(prod[i]), bw, y(0) - y(prod[i]), "sun") + bar(cx + 1, y(use[i]), bw, y(0) - y(use[i]), "use");
      s += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(labels[i]) + "</text>";
      const tip = "<b>" + esc(t("months")[i]) + "</b>|" + esc(t("l_prod")) + ": " + fmt(prod[i]) + " " + esc(t("u_kwh")) + "|" + esc(t("l_use")) + ": " + fmt(use[i]) + " " + esc(t("u_kwh"));
      s += '<rect class="hit" x="' + (m.l + band * i) + '" y="' + m.t + '" width="' + band + '" height="' + ih + '" data-tip="' + esc(tip) + '"/>';
    }
    s += '<line class="axis" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(0) + '" y2="' + y(0) + '"/></svg>';
    el.innerHTML = s;
  }

  function drawCash(res) {
    const el = $("#chartCash"), W = Math.max(el.clientWidth, 280), H = 260, cash = res.eco.cash, n = cash.length - 1;
    const m = { l: 50, r: 12, t: 22, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const ticks = niceTicks(Math.min.apply(null, cash), Math.max(Math.max.apply(null, cash), 0), 5);
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const x = function (i) { return m.l + i / n * iw; }, y = function (v) { return m.t + (hi - v) / (hi - lo) * ih; };
    let s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("c_cash")) + '">';
    ticks.forEach(function (v) {
      s += '<line class="' + (v === 0 ? "axis" : "grid") + '" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
           '<text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + short(v) + "</text>";
    });
    for (let i = 0; i <= n; i += 5) s += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + i + "</text>";
    s += '<polyline class="cash" points="' + cash.map(function (v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); }).join(" ") + '"/>';
    const pb = res.eco.payback;
    if (pb !== null) {
      const px = x(pb), left = px > m.l + 150;   // label sits where the line is not
      s += '<circle class="dot" cx="' + px + '" cy="' + y(0) + '" r="5"/>' +
           '<text class="paylab" x="' + (px + (left ? -10 : 10)) + '" y="' + (left ? y(0) - 9 : y(0) + 18) + '" text-anchor="' + (left ? "end" : "start") + '">' + esc(t("payAt", { y: fmt(pb, 1) })) + "</text>";
    }
    for (let i = 0; i <= n; i++) {
      const tip = "<b>" + esc(t("year", { y: i })) + "</b>|" + esc(t("tipCash", { v: fmt(cash[i]) }));
      s += '<rect class="hit" x="' + (x(i) - iw / n / 2) + '" y="' + m.t + '" width="' + iw / n + '" height="' + ih + '" data-tip="' + esc(tip) + '"/>';
    }
    el.innerHTML = s + "</svg>";
  }

  function drawLosses(res) {
    const steps = res.sim.steps, max = Math.max.apply(null, steps.map(function (s) { return s.pct; })) || 1;
    $("#lossBars").innerHTML = steps.map(function (s) {
      return "<span>" + esc(t("loss_" + s.id)) + '</span><span class="bar"><i style="width:' + (s.pct / max * 100).toFixed(1) + '%"></i></span><span class="v">' + fmt(s.pct, 1) + "%</span>";
    }).join("");
    const g = res.sim.tiltGainPct;
    $("#lossCap").textContent = t("c_lossCap", { gain: (g >= 0 ? "+" : "") + fmt(g, 1) });
  }

  function drawTable(res) {
    const f = res.eco.first, rows = f.months.map(function (x, i) {
      return "<tr><td>" + esc(t("months")[i]) + '</td><td class="num">' + fmt(res.sim.monthly[i].poaDaily, 2) + '</td><td class="num">' + fmt(x.prod) +
        '</td><td class="num">' + fmt(res.load[i]) + '</td><td class="num">' + fmt(x.self) + '</td><td class="num">' + fmt(x.exp) + '</td><td class="num">' + fmt(x.saving) + "</td></tr>";
    }).join("");
    $("#monthTable").innerHTML = "<thead><tr><th>" + esc(t("th_month")) + "</th>" +
      ["th_sun", "th_prod", "th_use", "th_self", "th_exp", "th_sav"].map(function (k) { return '<th class="num">' + esc(t(k)) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows + "</tbody><tfoot><tr><td>" + esc(t("total")) + '</td><td class="num">' + fmt(res.sim.poaYear / 365, 2) + '</td><td class="num">' + fmt(f.prod) +
      '</td><td class="num">' + fmt(res.eco.loadYear) + '</td><td class="num">' + fmt(f.self) + '</td><td class="num">' + fmt(f.exp) + '</td><td class="num">' + fmt(f.saving) + "</td></tr></tfoot>";
  }

  function drawAssumptions() {
    $("#assumeTable").innerHTML = "<thead><tr>" + ["th_item", "th_value", "th_source", "th_date"].map(function (k) { return "<th>" + esc(t(k)) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      DATA.SOURCES.map(function (a) {
        const src = a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.src) + "</a>" : esc(t("noSource"));
        return "<tr><td>" + esc(t(a.key)) + '</td><td dir="ltr">' + esc(a.value) + "</td><td>" + src + "</td><td>" + esc(a.date) + "</td></tr>";
      }).join("") + "</tbody>";
  }

  function rows(el, items) {
    $(el).innerHTML = items.map(function (r) {
      return "<div" + (r[3] ? ' class="key"' : "") + "><dt>" + esc(t(r[0])) + "</dt><dd>" + r[1] + (r[2] ? " <small><bdi>" + esc(r[2]) + "</bdi></small>" : "") + "</dd></div>";
    }).join("");
  }

  function render() {
    const out = $("#out"), err = $("#error");
    drawAssumptions();
    if (state.error) {
      out.hidden = true; err.hidden = false;
      $("#errorText").textContent = t(state.error);
      $("#retry").hidden = state.error !== "loadFail";
      $("#status").textContent = "";
      return;
    }
    err.hidden = true;
    if (!state.climate) { out.hidden = true; return; }
    $("#status").textContent = state.offline ? t("loadedOffline") : t("loaded", { lat: state.loc.lat.toFixed(2), lon: state.loc.lon.toFixed(2) });

    const inp = readInputs(), res = compute(inp, state.climate);
    state.last = { inputs: inp, location: state.loc, climate: state.climate, result: res };

    // size slider follows the roof
    const slider = $("#panels");
    slider.max = Math.max(res.maxPanels, 1);
    if (res.eco) { slider.value = res.eco.nPanels; $("#panelsOut").textContent = res.eco.nPanels + " (" + fmt(res.eco.kwp, 1) + " " + t("u_kw") + ")"; }

    if (!res.eco) {
      out.hidden = true; err.hidden = false; $("#retry").hidden = true;
      $("#errorText").textContent = t(res.maxPanels < 1 ? "noRoof" : "noUse");
      return;
    }
    out.hidden = false;
    const e = res.eco, f = e.first;
    const b = function (s) { return "<b>" + s + "</b>"; };
    $("#summary").innerHTML = t("sum", { kw: b(fmt(e.kwp, 1)), n: b(e.nPanels), prod: b(fmt(f.prod)), sav: b(fmt(f.saving)) }) + " " +
      (e.payback !== null ? t("sumPay", { pb: b(fmt(e.payback, 1)) }) : t("sumNoPay"));

    const notes = [];
    if (inp.autoSize && e.nPanels === res.maxPanels) notes.push(t("n_roofLimit", { n: res.maxPanels }));
    if (!inp.autoSize && res.best.nPanels !== e.nPanels) notes.push(t("n_manual", { n: res.best.nPanels }));
    if (e.kwp < 1) notes.push(t("n_min"));
    notes.push(t("n_cap"));
    $("#notes").innerHTML = notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("");

    rows("#gSystem", [
      ["m_kw", fmt(e.kwp, 1), t("u_kw"), 1], ["m_panels", fmt(e.nPanels), "× " + D.panel.kw * 1000 + " W"],
      ["m_area", fmt(e.nPanels * res.areaPerPanel), t("u_m2")], ["m_tilt", fmt(res.tilt) + "°", ""]
    ]);
    rows("#gEnergy", [
      ["m_prod", fmt(f.prod), t("u_kwh"), 1], ["m_yield", fmt(f.prod / e.kwp), t("u_kwh")],
      ["m_pr", fmt(res.sim.performanceRatio * 100) + "%", ""], ["m_self", fmt(e.selfUseShare * 100) + "%", ""],
      ["m_cover", fmt(e.coverage * 100) + "%", ""], ["m_co2", fmt(f.prod * D.co2 / 1000, 1), t("u_t")]
    ]);
    rows("#gMoney", [
      ["m_pb", e.payback !== null ? fmt(e.payback, 1) : "—", e.payback !== null ? t("u_years") : t("u_none"), 1],
      ["m_cost", fmt(e.cost), t("u_sar")], ["m_sav", fmt(f.saving), t("u_sar")], ["m_net", fmt(e.net), t("u_sar")]
    ]);
    drawMonths(res); drawCash(res); drawLosses(res); drawTable(res);
  }

  /* ---------- language ---------- */
  function applyLang() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    const sel = $("#city"), cur = sel.value || "riyadh";
    sel.innerHTML = DATA.CITIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c[state.lang]) + "</option>"; }).join("") +
      '<option value="custom">' + esc(t("custom")) + "</option>";
    sel.value = cur;
    $("#monthInputs").querySelectorAll("label").forEach(function (l, i) { l.firstChild.textContent = t("months")[i]; });
    syncForm();
    render();
  }

  // Show or hide the parts of the form that depend on other choices.
  function syncForm() {
    const unit = document.querySelector('input[name="unit"]:checked').value, monthly = $("#pattern").value === "monthly";
    $("#customBox").hidden = $("#city").value !== "custom";
    $("#tiltBox").hidden = $("#autoTilt").checked;
    $("#sizeBox").hidden = $("#autoSize").checked;
    $("#avgBox").hidden = monthly; $("#monthlyBox").hidden = !monthly;
    $("#usageLabel").textContent = t(unit === "bill" ? "usageBill" : "usageKwh");
    $("#monthlyLabel").textContent = t(unit === "bill" ? "monthlyBill" : "monthlyKwh");
  }

  /* ---------- downloads ---------- */
  function save(name, obj) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  // Open the page with ?export=all to save NASA data for every listed city in one file.
  async function exportAll() {
    const all = {};
    for (const c of DATA.CITIES) {
      $("#status").textContent = c.en + "…";
      try { const d = await fetchClimate(c.lat, c.lon); all[c.id] = { ghi: d.ghi, t: d.t, range: d.range }; }
      catch (e) { all[c.id] = null; }
    }
    save("nasa-power-ksa.json", all);
  }

  /* ---------- start ---------- */
  function init() {
    $("#monthInputs").innerHTML = KEYS.map(function (k, i) {
      return '<label>' + k + '<input id="m' + i + '" type="number" min="0" step="10" inputmode="decimal"></label>';
    }).join("");
    let timer = null;
    const later = function () { clearTimeout(timer); timer = setTimeout(render, 150); };

    $("#form").addEventListener("input", function (ev) {
      const id = ev.target.id;
      syncForm();
      if (id === "tariff") $("#fee").value = DATA.TARIFFS[$("#tariff").value].fee;
      if (id === "pattern" && $("#pattern").value === "monthly" && !$("#m0").value) {
        for (let m = 0; m < 12; m++) $("#m" + m).value = $("#usage").value;
      }
      if (id === "city" || id === "lat" || id === "lon") { clearTimeout(timer); timer = setTimeout(loadClimate, id === "city" ? 0 : 500); }
      else later();
    });
    $("#langBtn").addEventListener("click", function () {
      state.lang = state.lang === "en" ? "ar" : "en";
      try { localStorage.setItem("solarksa:lang", state.lang); } catch (e) { /* ignore */ }
      applyLang();
    });
    $("#retry").addEventListener("click", loadClimate);
    $("#download").addEventListener("click", function () { if (state.last) save("solar-ksa-calculation.json", state.last); });
    window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(function () { if (state.last && state.last.result.eco && !$("#out").hidden) { drawMonths(state.last.result); drawCash(state.last.result); } }, 150); });

    // one shared tooltip for both charts
    const tip = $("#tip");
    document.addEventListener("pointermove", function (ev) {
      const hit = ev.target.closest && ev.target.closest("[data-tip]");
      if (!hit) { tip.hidden = true; return; }
      tip.innerHTML = hit.dataset.tip.split("|").join("<br>");
      tip.hidden = false;
      tip.dir = state.lang === "ar" ? "rtl" : "ltr";
      const w = tip.offsetWidth, x = Math.min(ev.clientX + 14, window.innerWidth - w - 8);
      tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, ev.clientY - tip.offsetHeight - 12) + "px";
    });
    document.addEventListener("pointerdown", function (ev) { if (!(ev.target.closest && ev.target.closest("[data-tip]"))) tip.hidden = true; });

    try { if (localStorage.getItem("solarksa:lang") === "ar") state.lang = "ar"; } catch (e) { /* ignore */ }
    applyLang();
    if (/[?&]export=all/.test(window.location.search)) exportAll().then(loadClimate); else loadClimate();
  }
  init();
})();
