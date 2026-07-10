# Copper Supply and Demand Model

Python model for a global refined copper supply-demand balance.

The model combines public macro feeds with a USGS copper supply seed table:

- World Bank API: annual real GDP, industry share of GDP, and population indicators.
- USGS Mineral Commodity Summaries 2025: global and country mine/refinery production baselines.

This is a transparent planning model, not a trading model. It is built to make assumptions visible and easy to change.

## Quick Start

```bash
python3 -m pip install -e ".[dev]"
python3 -m copper_model fetch
python3 -m copper_model forecast-all
python3 -m copper_model plot
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/dashboard/` to view the dashboard.

Outputs are written to `outputs/`:

- `base_case_forecast.csv`: annual global refined copper balance.
- `base_case_regional_demand.csv`: annual regional demand paths.
- `base_case_mine_supply_by_country.csv`: mine-supply allocation by 2024 country share.
- `base_case_balance.png`: chart of demand, supply, and balance.
- `bull_case_*` and `bear_case_*`: higher-tightness and lower-tightness scenario outputs for the dashboard.

The static dashboard in `dashboard/` reads those CSV files directly from `outputs/`.

## Model Structure

The refined copper balance is:

```text
refined supply = primary refined supply + secondary refined supply
market balance = refined supply - refined demand
```

Demand is regional and driver-based:

```text
regional demand growth =
  industry weight * industry value-added growth
  + income weight * GDP-per-capita growth
  + population weight * population growth
  + energy-transition bonus
  + scenario shock
```

Supply is split into primary and secondary refined copper:

- Primary supply grows with recent USGS mine/refinery growth, pipeline assumptions, and disruption assumptions.
- Secondary supply grows with demand and collection-rate assumptions.
- Mine supply is also allocated by country using USGS 2024 mine-production shares.
- The primary/secondary refined split is a scenario assumption. In the base case it is 82% primary and 18% secondary.

## Configuration

Edit `config/base_case.json`, `config/bull_case.json`, or `config/bear_case.json` to change:

- forecast horizon;
- 2024 demand assumptions;
- regional demand shares and growth weights;
- mine/refinery growth assumptions;
- scrap share and collection growth.

Scenario framing:

- Base case: public macro trend with moderate transition demand and supply additions.
- Bull case: higher electrification demand, tighter supply, and lower scrap response.
- Bear case: softer demand, stronger supply additions, and higher scrap response.

## Data Sources

The fetch step downloads:

- `data/raw/world_bank_indicators.csv` from the World Bank API:
  `https://api.worldbank.org/v2/country/{country}/indicator/{indicator}`

Seed tables in `data/seed/` are manually transcribed from:

- U.S. Geological Survey, Mineral Commodity Summaries 2025, Copper:
  `https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-copper.pdf`

USGS reports the copper table in thousand metric tons of copper content unless otherwise specified.

## Tests

```bash
python3 -m pytest
```

## Caveats

- Public machine-readable global copper demand data is limited. The model calibrates 2024 refined demand to refined production and then projects forward from public macro drivers.
- Industry demand uses a real industry-output proxy: real GDP multiplied by World Bank industry value added as a percentage of GDP.
- The model does not estimate inventory or price. It only reports the annual refined copper surplus or deficit.
