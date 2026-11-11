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

  // Offline copy of NASA POWER climatology, saved from the live API on 11 Nov 2026.
  // Used only if the live service cannot be reached. ghi: kWh/m2/day, t and range: deg C, Jan..Dec.
  const FALLBACK_CLIMATE = {
    riyadh: { ghi: [4.4422, 5.2944, 6.1764, 6.7126, 7.4011, 7.9786, 7.7023, 7.3051, 6.7663, 5.8927, 4.5768, 4.1791], t: [13.8, 16.56, 21.2, 26.51, 31.99, 34.5, 36, 35.71, 32.37, 27.11, 20.44, 15.09], range: [14.36, 15.4, 15.63, 15.49, 15.95, 16.54, 15.97, 15.67, 15.68, 14.81, 13.28, 13.64] },
    jeddah: { ghi: [4.5929, 5.4367, 6.4822, 7.1278, 7.4381, 7.6085, 7.3308, 6.9108, 6.4462, 5.8646, 4.8809, 4.3529], t: [23.43, 24.64, 26.68, 29.77, 32.77, 34.06, 34.48, 34.34, 33.65, 31.58, 28.17, 25.29], range: [10.24, 11.11, 11.88, 11.8, 12.54, 13.45, 12.16, 11.4, 11.67, 10.9, 9.81, 9.69] },
    dammam: { ghi: [3.5232, 4.2043, 5.0134, 5.6333, 6.5366, 7.0738, 6.7231, 6.4267, 5.8843, 4.9106, 3.7356, 3.3127], t: [16.71, 17.86, 21.49, 26.12, 31.46, 34.44, 36.17, 36.13, 33.81, 30.1, 24.21, 18.91], range: [8.02, 8.89, 10.18, 10.76, 11.56, 11.48, 11.01, 10.93, 11.05, 9.96, 7.58, 7.59] },
    makkah: { ghi: [4.5929, 5.4367, 6.4822, 7.1278, 7.4381, 7.6085, 7.3308, 6.9108, 6.4462, 5.8646, 4.8809, 4.3529], t: [21.08, 23.02, 25.64, 29.1, 32.72, 34.73, 34.18, 34.15, 33.99, 30.37, 25.88, 22.8], range: [13.04, 14.08, 14.54, 14.25, 14.87, 15.56, 14.22, 14.1, 14.51, 13.54, 12.56, 12.49] },
    madinah: { ghi: [4.4918, 5.3645, 6.4601, 7.1028, 7.4647, 7.9325, 7.6865, 7.0697, 6.4932, 5.671, 4.7074, 4.1921], t: [15.9, 18.33, 22.06, 26.25, 30.78, 33.63, 34.01, 34.76, 33.24, 28.63, 22.42, 17.95], range: [16.09, 17.12, 17.71, 17.27, 17.53, 18.2, 17.57, 17.17, 16.88, 15.7, 14.92, 15.2] },
    abha: { ghi: [5.0837, 5.8284, 6.5981, 6.9415, 7.0663, 7.152, 6.5777, 6.3701, 6.5702, 6.3216, 5.3287, 4.9608], t: [19.54, 21.06, 23.08, 25.43, 28.24, 30.22, 29.64, 28.86, 28.87, 25.35, 22.3, 20.1], range: [11.54, 11.88, 11.85, 11.42, 11.83, 12.78, 12.01, 11.96, 13.24, 13.38, 12.39, 12.07] },
    tabuk: { ghi: [4.1918, 5.1806, 6.4025, 7.3198, 7.9183, 8.495, 8.2236, 7.6226, 6.7721, 5.5145, 4.4374, 3.9019], t: [9.18, 11.54, 15.81, 20.32, 25.01, 28.46, 30.21, 30.33, 27.71, 23.1, 16.01, 10.94], range: [14.92, 16.32, 17.61, 17.94, 18.1, 18.83, 18.02, 18.13, 18.03, 16.43, 14.75, 14.74] },
    hail: { ghi: [4.229, 5.1612, 6.2522, 7.0243, 7.5598, 8.3225, 8.1542, 7.5482, 6.6986, 5.4895, 4.3313, 3.8945], t: [10.21, 12.72, 17.13, 22.08, 27.58, 31.04, 32.7, 33.04, 30.34, 25.18, 17.09, 12.09], range: [14.58, 15.76, 16.55, 16.73, 16.77, 17.22, 16.58, 16.51, 16.39, 15.27, 13.78, 13.87] },
    jazan: { ghi: [4.9265, 5.5975, 6.3785, 6.8918, 6.9883, 6.5988, 6.071, 6.0233, 6.2719, 6.0994, 5.2668, 4.8888], t: [26.54, 27.14, 28.91, 31.27, 32.89, 33.54, 33.27, 32.95, 33.34, 32.1, 29.74, 27.54], range: [5.29, 5.59, 5.77, 5.83, 6.04, 6.6, 6.58, 5.88, 6.11, 6.21, 5.67, 5.41] },
    alahsa: { ghi: [4.2264, 5.0256, 5.9652, 6.5916, 7.4059, 7.8698, 7.5634, 7.2437, 6.6706, 5.6465, 4.3526, 3.9564], t: [14.19, 16.68, 21.68, 27.29, 33.18, 36.01, 37.61, 37.21, 33.75, 28.8, 21.58, 15.8], range: [12.58, 13.85, 14.75, 14.95, 15.82, 16.25, 15.7, 15.63, 15.83, 14.6, 12.28, 12.08] }
  };

  return { CITIES, TARIFFS, DEFAULTS, SOURCES, FALLBACK_CLIMATE };
})();

if (typeof module !== "undefined") module.exports = SOLAR_DATA;
