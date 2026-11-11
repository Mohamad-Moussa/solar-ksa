# Verification: hand calculation for Riyadh and Jeddah

Date: 11 November 2026. Inputs: tool defaults (200 m² roof, 50% free, SAR 600 monthly bill, 2027 tariff, south-facing, best tilt).
Climate data: NASA POWER climatology, as fetched by the live tool.

The tool works hour by hour. The hand check uses a different, closed-form monthly method
(Liu & Jordan with Klein's monthly R̄b, Duffie & Beckman ch. 2) and plain arithmetic for the rest.

## 1. Sunlight on the tilted panel (worked example: Riyadh, January)

| Step | Value |
|---|---|
| Latitude 24.71° N, tilt 23°, mean day 17 Jan, declination | −20.92° |
| Sunset hour angle | 79.87° |
| Extraterrestrial irradiation H0 | 6.76 kWh/m²/day |
| NASA horizontal irradiation H | 4.44 kWh/m²/day |
| Clearness index KT = H / H0 | 0.657 |
| Diffuse fraction (Erbs) | 0.254 |
| Beam tilt factor R̄b | 1.442 |
| Tilted irradiation = H × [0.746 × 1.442 + 0.254 × 0.960 + 0.2 × 0.040] | 5.90 kWh/m²/day |
| Tool (hourly method) | 5.77 kWh/m²/day |

Single months differ by about 2% because the two methods weight the hours differently. Over the year they agree:

| | Riyadh | Jeddah |
|---|---|---|
| Yearly sunlight on panel, hand | 2,404 kWh/m² | 2,364 kWh/m² |
| Yearly sunlight on panel, tool | 2,402 kWh/m² | 2,363 kWh/m² |
| Difference | 0.07% | 0.04% |

## 2. Losses and yield

Loss chain = 0.95 (dust) × 0.97 (shading) × 0.98 (mismatch) × 0.98 (wiring) × 0.995 (connections) × 0.99 (nameplate) × 0.97 (downtime) × 0.96 (inverter) = 0.8118

| | Riyadh | Jeddah |
|---|---|---|
| Temperature loss (from tool) | 8.56% | 9.20% |
| Yield, hand = sunlight × (1 − temperature loss) × 0.8118 | 1,784 kWh/kWp | 1,743 kWh/kWp |
| Yield, tool | 1,783 kWh/kWp | 1,742 kWh/kWp |

## 3. Bill to energy

(600 / 1.15 − 70) / 0.21 = 2,151 kWh per month = 25,814 kWh per year. Tool: 25,814.

## 4. Size, production, money

| | Riyadh | Jeddah |
|---|---|---|
| Row pitch × panel width = roof per panel | 3.43 × 1.134 = 3.89 m² | 3.14 × 1.134 = 3.56 m² |
| Panels that fit on 100 m² | 25 | 28 |
| Panels chosen (best 25-year saving) | 19 (11.02 kWp) | 16 (9.28 kWp) |
| First-year production = kWp × yield × 0.99 | 19,454 kWh | 16,003 kWh |
| Used in the home / exported | 12,907 / 6,547 kWh | 12,907 / 3,096 kWh |
| Saving = used × 0.21 × 1.15 + exported × 0.07 | SAR 3,575 | SAR 3,334 |
| Cost = kWp × 3,500 | SAR 38,570 | SAR 32,480 |
| Simple payback = cost / (saving − 1% upkeep) | 12.1 years | 10.8 years |
| Tool payback (with panel degradation) | 12.2 years | 10.9 years |
| CO₂ avoided = production × 0.568 kg/kWh | 11.1 t/year | 9.1 t/year |

All hand values match the tool to within 0.1%, except payback, where the tool is slightly longer because it includes degradation.

## Limits

- The temperature loss is taken from the tool, not re-derived by hand.
- Jeddah and Makkah share one NASA solar grid cell, so their sunlight values are identical.
- The daylight share of use (50%), free roof share (50%) and upkeep (1%) are assumptions.
