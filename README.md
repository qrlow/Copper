# Copper Supply and Demand Model

Python model for a global refined copper supply-demand balance.

The model combines public macro feeds with public copper market baselines:

- World Bank API: annual real GDP, industry share of GDP, and population indicators.
- USGS Mineral Commodity Summaries 2026: updated 2024 world mine/refinery production baseline.
- USGS Mineral Commodity Summaries 2025: country mine/refinery production seed table.
- ICSG World Copper Factbook 2025: 2024 refined usage, regional usage, primary/secondary refined production context, capacity trends, supply constraints, and scrap/recycling context.

This is a transparent planning model, not a trading model. It is built to make assumptions visible and easy to change.

## Quick Start

```bash
python3 -m pip install -e ".[dev]"
python3 -m copper_model fetch
python3 -m copper_model estimate-weights
python3 -m copper_model forecast-all
python3 -m copper_model plot
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/dashboard/` to view the dashboard.

Outputs are written to `outputs/`:

- `demand_driver_regression_dataset.csv`: joined annual ICSG/World Bank regression dataset.
- `demand_world_gdp_regression_dataset.csv`: long-history annual ICSG usage and World Bank world real GDP growth dataset.
- `demand_regression_plot_points.csv`: x/y/fitted values used for dashboard regression scatterplots.
- `copper_gdp_relationship_diagnostics.csv`: long-run, annual-growth, smoothing, outlier, and lead/lag checks used to explain the GDP/copper relationship.
- `demand_driver_regression_summary.csv`: OLS coefficients and diagnostic relative-importance shares.
- `demand_driver_regression_fit.csv`: sample, method, and fit diagnostics for the multivariate, GDP-per-capita-only, and world-GDP regressions.
- `base_case_forecast.csv`: annual global refined copper balance.
- `base_case_regional_demand.csv`: annual regional demand paths.
- `base_case_mine_supply_by_country.csv`: mine-supply allocation by 2024 country share.
- `base_case_balance.png`: chart of demand, supply, and balance.
- `bull_case_*` and `bear_case_*`: higher-tightness and lower-tightness scenario outputs for the dashboard.

The static dashboard in `dashboard/` reads those CSV files directly from `outputs/`. It presents the model as a small market-intelligence workbench: executive market signal, scenario comparison, driver bridge, visual demand/supply breakdowns, formula-level demand and supply growth drivers, physical balance charts, source links, and assumption rationale.

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

The macro growth rates are fixed historical CAGRs, not rolling future forecasts. For each region, the model takes the latest World Bank year available in `data/raw/world_bank_indicators.csv`, looks back `macro_lookback_years`, and applies that annualized rate to every forecast year. Industry activity is real GDP multiplied by industry share of GDP. GDP per capita growth is calculated directly as the CAGR of real GDP per person.

Demand driver weights are explicit scenario assumptions, not regression outputs. The `estimate-weights` command is kept as a diagnostic check: it tests global refined copper usage growth from the ICSG Factbook against World Bank macro growth. The dashboard now shows two kinds of tests:

- A long-run log-level test of refined usage against world real GDP. This has very high R-squared because both series trend upward over decades. It is useful evidence that copper consumption scales with economic activity, but it is not a clean annual forecasting model.
- World real GDP diagnostics, which are the closest match to the market rule-of-thumb that a 1 percentage point change in world real GDP growth is associated with roughly a 0.9 percentage point change in global copper demand growth. In the 1961-2024 annual public-data sample, the no-intercept slope is about 0.93. With an intercept, annual R-squared is about 0.321. Using 5-year CAGRs raises R-squared to about 0.395.
- Driver diagnostics using GDP per capita, population, and industry activity. These are weaker and mechanically overlapping: GDP per capita plus population approximately reconstructs GDP growth, and industry activity is real GDP multiplied by industry share.

These diagnostics are not used as forecast weights. They show that GDP matters, but annual copper usage still depends heavily on copper-specific cycles, China property and grid demand, substitution, scrap response, prices, inventories, policy, and sector mix. The strongest annual test is a slope/elasticity read-through, not a high-R-squared forecasting equation.

Quarterly data would be a better way to test cyclical sensitivity, but a reproducible public global quarterly refined-usage history is not available in this repository. ICSG publishes monthly bulletins and maintains an online statistical database covering production, usage, trade, stocks, and prices; that is the right source for a paid or credentialed quarterly version of the analysis.

Supply is split into primary and secondary refined copper:

- Primary supply grows with recent USGS mine/refinery growth, pipeline assumptions, and disruption assumptions.
- Secondary supply grows with demand and collection-rate assumptions.
- Mine supply is also allocated by country using USGS 2024 mine-production shares.
- The primary/secondary refined split starts from ICSG's 2024 refined-production mix. In the base case it is 83% primary and 17% secondary, grouping SX-EW refined output with primary supply.

## Configuration

Edit `config/base_case.json`, `config/bull_case.json`, or `config/bear_case.json` to change:

- forecast horizon;
- 2024 demand baseline;
- regional demand shares and growth weights;
- mine/refinery growth assumptions;
- scrap share and collection growth.

Scenario framing:

- Base case: public macro trend with moderate transition demand and supply additions.
- Bull case: higher electrification demand, tighter supply, and lower scrap response.
- Bear case: softer demand, stronger supply additions, and higher scrap response.

The scenarios are not external forecasts. They are assumption sets built from the same public baseline. Each scenario changes demand-growth shocks, energy-transition bonuses, supply pipeline growth, disruption loss, and secondary-supply response.

## Data Sources

The fetch step downloads:

- `data/raw/world_bank_indicators.csv` from the World Bank API:
  `https://api.worldbank.org/v2/country/{country}/indicator/{indicator}`

Seed tables in `data/seed/` are manually transcribed from:

- U.S. Geological Survey, Mineral Commodity Summaries 2026, Copper:
  `https://pubs.usgs.gov/periodicals/mcs2026/mcs2026.pdf`
- U.S. Geological Survey, Mineral Commodity Summaries 2025, Copper:
  `https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-copper.pdf`
- ICSG World Copper Factbook 2025, Annex "World Copper Production and Refined Copper Usage, 1960-2024":
  `https://icsg.org/copper-factbook/`
- ICSG publications and online statistical database context for monthly/quarterly copper data availability:
  `https://icsg.org/`

USGS reports the copper table in thousand metric tons of copper content unless otherwise specified.
The global seed combines MCS 2025 history for 2023 with the MCS 2026 2024 update. The 2024 refined-supply baseline now uses the USGS MCS 2026 world refinery production figure of 27,600 kt. The country supply seed remains based on the transcribed MCS 2025 country table.

The main non-USGS assumption sources are:

- ICSG World Copper Factbook 2025:
  `https://icsg.org/copper-factbook/`
- IEA Global Critical Minerals Outlook 2025:
  `https://www.iea.org/reports/global-critical-minerals-outlook-2025`

The dashboard's "How Scenarios Are Built" table gives a source or rationale for every assumption row. Where a number is a model judgment rather than a published estimate, the dashboard says that directly and links to the scenario JSON files.

## Tests

```bash
python3 -m pytest
```

## Caveats

- Public machine-readable global copper demand data is limited. The model sets 2024 refined demand from ICSG's 27.4 Mt refined-usage estimate and then projects forward from public macro drivers.
- Industry demand uses a real industry-output proxy: real GDP multiplied by World Bank industry value added as a percentage of GDP.
- The model does not estimate inventory or price. It only reports the annual refined copper surplus or deficit.
