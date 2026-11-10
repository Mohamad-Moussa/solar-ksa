/* data.js — cities, default values and every sourced assumption used by the tool.
   Nothing in this file is calculated. Change a number here and the whole app follows. */

const SOLAR_DATA = (function () {
  // Coordinates are city-centre points (decimal degrees, north / east).
  const CITIES = [
    { id: "riyadh",  en: "Riyadh",   ar: "الرياض",          lat: 24.7136, lon: 46.6753 },
    { id: "jeddah",  en: "Jeddah",   ar: "جدة",             lat: 21.4858, lon: 39.1925 },
    { id: "dammam",  en: "Dammam",   ar: "الدمام",          lat: 26.4207, lon: 50.0888 },
    { id: "makkah",  en: "Makkah",   ar: "مكة المكرمة",     lat: 21.3891, lon: 39.8579 },
    { id: "madinah", en: "Madinah",  ar: "المدينة المنورة", lat: 24.5247, lon: 39.5692 },
    { id: "abha",    en: "Abha",     ar: "أبها",            lat: 18.2164, lon: 42.5053 },
    { id: "tabuk",   en: "Tabuk",    ar: "تبوك",            lat: 28.3838, lon: 36.5550 },
    { id: "hail",    en: "Hail",     ar: "حائل",            lat: 27.5114, lon: 41.7208 },
    { id: "jazan",   en: "Jazan",    ar: "جازان",           lat: 16.8892, lon: 42.5511 },
    { id: "alahsa",  en: "Al-Ahsa",  ar: "الأحساء",         lat: 25.3839, lon: 49.5861 }
  ];

  // Residential tariffs. Rates in SAR per kWh, before VAT.
  const TARIFFS = {
    y2027: { r1: 0.21, r2: 0.33, limit: 6000, fee: 70 },  // from 1 Jan 2027
    y2026: { r1: 0.18, r2: 0.30, limit: 6000, fee: 0 }    // until 31 Dec 2026 (meter fee: enter from your bill)
  };

  const DEFAULTS = {
    vat: 0.15,                 // VAT on electricity bills
    exportRate: 0.07,          // SAR per kWh credited for surplus sent to the grid (residential)
    co2: 0.568,                // kg CO2 per kWh of grid electricity
    costPerKwp: 3500,          // SAR per kWp installed (estimate)
    omPct: 1,                  // yearly upkeep as % of system cost (assumption)
    years: 25,                 // analysis period
    dayShare: 50,              // % of household use that happens in daylight hours (assumption)
    roofArea: 200,             // m2
    usableShare: 50,           // % of the roof that can take panels (assumption)
    albedo: 0.2,               // ground reflectance
    panel: {
      name: "Jinko Tiger Neo N-type 580 W",
      kw: 0.580, length: 2.278, width: 1.134,
      tempCoeff: -0.0030,      // power change per deg C
      noct: 45,                // nominal operating cell temperature, deg C
      deg1: 0.01,              // first-year degradation
      degAnnual: 0.004         // degradation per year after that
    },
    losses: {                  // percent
      soiling: 5, shading: 3, mismatch: 2, wiring: 2,
      connections: 0.5, nameplate: 1, availability: 3
    },
    inverterEff: 96            // percent
  };

  // Shown in the app as the "Assumptions and sources" table.
  const SOURCES = [
    { key: "a_tariff27", value: "0.21 / 0.33 SAR/kWh",
      src: "Saudi Energy announcement (reported by Ajel, MEED)", date: "25 Oct 2026",
      url: "https://english.ajel.sa/business/s3eb9mw5n" },
    { key: "a_fee27", value: "SAR 70–100 / month",
      src: "Saudi Energy announcement (reported by Ajel)", date: "25 Oct 2026",
      url: "https://english.ajel.sa/business/s3eb9mw5n" },
    { key: "a_tariff26", value: "0.18 / 0.30 SAR/kWh",
      src: "Saudi Energy, Consumption Tariffs", date: "2018 – 2026",
      url: "https://www.se.com.sa/en/Ourservices/ColumnC/Bills-and-Consumption/ConsumptionTariffs" },
    { key: "a_vat", value: "15%",
      src: "ZATCA (VAT standard rate)", date: "1 Jul 2020",
      url: "https://zatca.gov.sa/en/" },
    { key: "a_export", value: "0.07 SAR/kWh",
      src: "ECRA/SERA, Regulatory Framework for Small-Scale Solar PV Systems", date: "2020",
      url: "https://rise.esmap.org/sites/default/files/library/saudi-arabia/Renewable%20Energy/Kingdom%20of%20Saudi%20Arabia_Regulatory%20Framework%20for%20Small-%20Scale%20Solar%20PV%20Systems.pdf" },
    { key: "a_co2", value: "0.568 kg CO₂/kWh",
      src: "Saudi CDM Designated National Authority, Grid Emission Factor 2021", date: "2021",
      url: "https://cdmdna.gov.sa/Resources/70/e179cf72596d15213c8772bf7a9dab642.pdf" },
    { key: "a_cost", value: "SAR 3,500 / kWp",
      src: "Range SAR 2,813–4,688/kWp across four Saudi studies (preprint review)", date: "2026",
      url: "https://www.researchsquare.com/article/rs-11270821/v1" },
    { key: "a_panel", value: "580 W, 2.278 × 1.134 m, −0.30 %/°C",
      src: "Jinko Tiger Neo N-type datasheet (distributor copy)", date: "2024",
      url: "https://fronus.com/products/modules/JinkoSolar/Tiger-neo/580W/" },
    { key: "a_degr", value: "1% + 0.40% / yr",
      src: "Jinko Tiger Neo linear power warranty", date: "2021",
      url: "https://www.pv-magazine.com/2021/08/26/jinkosolar-unveils-details-of-its-topcon-620-w-bifacial-solar-panel/" },
    { key: "a_losses", value: "3 / 2 / 2 / 0.5 / 1 / 3 %, 96%",
      src: "NREL, PVWatts Version 5 Manual (Dobos)", date: "2014",
      url: "https://www.nrel.gov/docs/fy14osti/62641.pdf" },
    { key: "a_soiling", value: "5%",
      src: "Assumption for monthly cleaning; see Al Garni, Energies 15(21) 8033", date: "2022",
      url: "https://doi.org/10.3390/en15218033" },
    { key: "a_climate", value: "kWh/m²/day, °C",
      src: "NASA POWER climatology API (fetched live)", date: "live",
      url: "https://power.larc.nasa.gov/" },
    { key: "a_method", value: "—",
      src: "Duffie & Beckman, Solar Engineering of Thermal Processes (Erbs 1982; Collares-Pereira & Rabl 1979; Liu & Jordan)", date: "textbook",
      url: "https://onlinelibrary.wiley.com/doi/book/10.1002/9781118671603" },
    { key: "a_noSource", value: "50% / 50% / 1%",
      src: "", date: "", url: "" }
  ];

  // Optional offline copy of NASA POWER data, keyed by city id:
  // { riyadh: { ghi:[12], t:[12], range:[12] }, ... }. Empty until filled.
  const FALLBACK_CLIMATE = {};

  return { CITIES, TARIFFS, DEFAULTS, SOURCES, FALLBACK_CLIMATE };
})();

if (typeof module !== "undefined") module.exports = SOLAR_DATA;
