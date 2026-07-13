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
- `base_case_supply_assets.csv`: mine/project-level risk-adjusted supply forecast.
- `base_case_supply_summary.csv`: annual supply bridge from mine output to primary refined supply.
- `base_case_supply_conversion_bridge.csv`: selected bridge steps from mine supply to total refined supply.
- `base_case_supply_sources.csv`: source and assumption notes for the supply assets.
- `base_case_balance.png`: chart of demand, supply, and balance.
- `bull_case_*` and `bear_case_*`: higher-tightness and lower-tightness scenario outputs for the dashboard.

The static dashboard in `dashboard/` reads those CSV files directly from `outputs/`. It presents the model as a small market-intelligence workbench: executive market signal, scenario comparison, driver bridge, visual demand/supply breakdowns, a dedicated supply tab, formula-level demand and supply growth drivers, physical balance charts, source links, and assumption rationale.

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
  + China property downturn drag
  + substitution / intensity drag
  + scenario shock
```

The macro growth rates are fixed historical CAGRs, not rolling future forecasts. For each region, the model takes the latest World Bank year available in `data/raw/world_bank_indicators.csv`, looks back `macro_lookback_years`, and applies that annualized rate to every forecast year. Industry activity is real GDP multiplied by industry share of GDP. GDP per capita growth is calculated directly as the CAGR of real GDP per person.

The demand forecast now includes explicit copper-specific drags. China has a phased property-downturn adjustment so the trailing macro history does not mechanically project high construction-linked demand forever. Each region also has a substitution / intensity drag for material substitution, copper-thrifting, and efficiency.

Demand driver weights are fixed model assumptions, not regression outputs and not scenario-specific. Base, bull, and bear all use the same 55% industry, 30% income, and 15% population weights so the core demand equation stays stable. The scenarios instead differ through copper-specific overlays such as energy-transition bonus, China property drag, substitution drag, growth caps/floors, and scenario shock. The `estimate-weights` command is kept as a diagnostic check: it tests global refined copper usage growth from the ICSG Factbook against World Bank macro growth. The dashboard now shows two kinds of tests:

- A long-run log-level test of refined usage against world real GDP. This has very high R-squared because both series trend upward over decades. It is useful evidence that copper consumption scales with economic activity, but it is not a clean annual forecasting model.
- World real GDP diagnostics, which are the closest match to the market rule-of-thumb that a 1 percentage point change in world real GDP growth is associated with roughly a 0.9 percentage point change in global copper demand growth. In the 1961-2024 annual public-data sample, the no-intercept slope is about 0.93. With an intercept, annual R-squared is about 0.321. Using 5-year CAGRs raises R-squared to about 0.395.
- Driver diagnostics using GDP per capita, population, and industry activity. These are weaker and mechanically overlapping: GDP per capita plus population approximately reconstructs GDP growth, and industry activity is real GDP multiplied by industry share.

These diagnostics are not used as forecast weights. They show that GDP matters, but annual copper usage still depends heavily on copper-specific cycles, China property and grid demand, substitution, scrap response, prices, inventories, policy, and sector mix. The strongest annual test is a slope/elasticity read-through, not a high-R-squared forecasting equation.

Quarterly data would be a better way to test cyclical sensitivity, but a reproducible public global quarterly refined-usage history is not available in this repository. ICSG publishes monthly bulletins and maintains an online statistical database covering production, usage, trade, stocks, and prices; that is the right source for a paid or credentialed quarterly version of the analysis.

Supply is split into primary and secondary refined copper:

- Primary supply now comes from a mine-level supply module. It starts from the ICSG 2024 world mine-production anchor, adds named operating mines and projects, applies ramp-up curves, lighter project probability discounts, planned maintenance allowances, disruption losses, and a residual rest-of-world supply bucket with an explicit scenario growth rate.
- Mine supply is then converted into primary refined supply through a separate bridge. The bridge distinguishes mine copper content from refined copper output and applies a 2024 ICSG calibration factor plus looser smelter/refinery, blending, and maintenance constraints.
- Secondary supply grows with demand and collection-rate assumptions.
- Mine supply is also allocated by country using USGS 2024 mine-production shares.
- The primary/secondary refined split starts from ICSG's 2024 refined-production mix. In the base case it is 83% primary and 17% secondary, grouping SX-EW refined output with primary supply.

The mine-level formula used where grade and recovery are available is:

```text
contained copper kt = ore processed Mt * copper grade % * recovery % * 10
```

For many mines, the model uses reported production directly because current ore processed, grade, and recovery are not disclosed in one consistent public source. In those cases, grade and recovery fields are shown as modelling assumptions and the source/assumption note says so.

## Configuration

Edit `config/base_case.json`, `config/bull_case.json`, or `config/bear_case.json` to change:

- forecast horizon;
- 2024 ICSG demand and supply baseline;
- regional demand shares and fixed macro-driver weights;
- mine/refinery growth assumptions, rest-of-world growth, project risk discounts, and conversion constraints;
- scrap share and collection growth.

Scenario framing:

- Base case: public macro trend with moderate transition demand and supply additions.
- Bull case: higher electrification demand, tighter supply, and lower scrap response.
- Bear case: softer demand, stronger supply additions, and higher scrap response.

The scenarios are not external forecasts. They are assumption sets built from the same public baseline. Each scenario changes demand-growth shocks, energy-transition bonuses, China property drag, substitution drag, supply pipeline growth, rest-of-world growth, disruption loss, conversion constraints, and secondary-supply response.

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
- ICSG project-pipeline chart and mine/smelter/refinery context from the World Copper Factbook 2025:
  `https://icsg.org/copper-factbook/`
- ICSG publications and online statistical database context for monthly/quarterly copper data availability:
  `https://icsg.org/`
- Company/project public pages and annual-report context for named mine/project assumptions, linked row-by-row in `data/seed/global_copper_supply_assets.csv`.

USGS reports the copper table in thousand metric tons of copper content unless otherwise specified.
The model now anchors the 2024 global baseline exactly to the transcribed ICSG historical balance seed: 22,990 kt mine production, 27,486 kt refined production, and 27,353 kt refined usage. USGS MCS 2026 remains a public cross-check for mine/refinery totals. The country supply seed remains based on the transcribed MCS 2025 country table.

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

- Public machine-readable global copper demand data is limited. The model sets 2024 refined demand exactly from the ICSG historical balance seed and then projects forward from public macro drivers plus explicit copper-specific adjustments.
- Industry demand uses a real industry-output proxy: real GDP multiplied by World Bank industry value added as a percentage of GDP.
- The model does not estimate inventory or price. It only reports the annual refined copper surplus or deficit.
- The mine-level supply module is intentionally transparent rather than definitive. It uses public data, explicit assumptions, and probability weighting. A professional version should replace the seed CSV with paid mine-by-mine datasets, current TC/RC data, smelter maintenance schedules, concentrate quality assays, and regional trade-flow data.
