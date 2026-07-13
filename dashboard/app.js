const SCENARIOS = [
  {
    id: "base_case",
    label: "Base",
    eyebrow: "Base Case",
    description: "Current public macro trend with moderate transition demand and supply additions.",
  },
  {
    id: "bull_case",
    label: "Bull",
    eyebrow: "Bull Case",
    description: "Higher electrification demand, tighter supply, and lower scrap response.",
  },
  {
    id: "bear_case",
    label: "Bear",
    eyebrow: "Bear Case",
    description: "Softer demand, stronger supply additions, and higher scrap response.",
  },
];

const DATA_VERSION = "2026-07-13-icsg-anchor-calibration";
const APP_ROOT = new URL("../", window.location.href);
const RELATIONSHIP_PLOT_ORDER = [
  {
    plotId: "world_gdp_annual_no_intercept",
    diagnosticId: "annual_growth_no_intercept",
    title: "World GDP rule-of-thumb",
  },
  { plotId: "log_levels", diagnosticId: "log_levels" },
  { plotId: "pre_1990_annual_growth", diagnosticId: "pre_1990_annual_growth" },
  { plotId: "exclude_2020_2021", diagnosticId: "exclude_2020_2021" },
];
const PLOTTED_RELATIONSHIP_IDS = new Set(
  RELATIONSHIP_PLOT_ORDER.map((plot) => plot.diagnosticId),
);

function appUrl(path) {
  return new URL(path, APP_ROOT).toString();
}

function versionedAppUrl(path) {
  const url = new URL(path, APP_ROOT);
  url.searchParams.set("v", DATA_VERSION);
  return url.toString();
}

function scenarioFiles(id) {
  return {
    config: versionedAppUrl(`config/${id}.json`),
    forecast: versionedAppUrl(`outputs/${id}_forecast.csv`),
    regional: versionedAppUrl(`outputs/${id}_regional_demand.csv`),
    mine: versionedAppUrl(`outputs/${id}_mine_supply_by_country.csv`),
    supplyAssets: versionedAppUrl(`outputs/${id}_supply_assets.csv`),
    supplySummary: versionedAppUrl(`outputs/${id}_supply_summary.csv`),
    supplyBridge: versionedAppUrl(`outputs/${id}_supply_conversion_bridge.csv`),
    supplySources: versionedAppUrl(`outputs/${id}_supply_sources.csv`),
  };
}

function regressionFiles() {
  return {
    dataset: versionedAppUrl("outputs/demand_driver_regression_dataset.csv"),
    gdpDataset: versionedAppUrl("outputs/demand_world_gdp_regression_dataset.csv"),
    plotPoints: versionedAppUrl("outputs/demand_regression_plot_points.csv"),
    relationshipDiagnostics: versionedAppUrl("outputs/copper_gdp_relationship_diagnostics.csv"),
    summary: versionedAppUrl("outputs/demand_driver_regression_summary.csv"),
    fit: versionedAppUrl("outputs/demand_driver_regression_fit.csv"),
  };
}

function workbookFiles() {
  return {
    marketBalance: versionedAppUrl("outputs/workbook_market_balance.csv"),
    demandComponents: versionedAppUrl("outputs/workbook_demand_components.csv"),
    majorMines: versionedAppUrl("outputs/workbook_major_mines.csv"),
    mineSupplyCountry: versionedAppUrl("outputs/workbook_mine_supply_country.csv"),
  };
}

function icsgFiles() {
  return {
    forecast: versionedAppUrl("outputs/icsg_forecast_2026_04_23.csv"),
    regional: versionedAppUrl("outputs/icsg_regional_forecast_2026_04_23.csv"),
  };
}

const colors = {
  copper: "#b65f2a",
  teal: "#207b7f",
  green: "#54753a",
  red: "#af3f3f",
  gold: "#b58b2b",
  blue: "#496f9e",
  line: "#d8d3c9",
  muted: "#69645c",
  ink: "#202124",
};

const regionColors = {
  China: colors.copper,
  "United States": colors.blue,
  "European Union": colors.teal,
  "Rest of World": colors.gold,
};

const supplyBreakdownColors = {
  "Primary refined": colors.copper,
  "Secondary refined": colors.teal,
};

const modelSourceColors = {
  Model: colors.copper,
  "Reference Model": colors.blue,
  "ICSG Model": colors.teal,
};

const sourceUrls = {
  icsgFactbook: "https://icsg.org/copper-factbook/",
  icsgHome: "https://icsg.org/",
  usgsCopper:
    "https://pubs.usgs.gov/periodicals/mcs2026/mcs2026.pdf",
  ieaCriticalMinerals:
    "https://www.iea.org/reports/global-critical-minerals-outlook-2025",
  marketWatchCopperDemand:
    "https://www.marketwatch.com/story/how-ai-and-evs-are-boosting-demand-for-copper-fd9ec5db",
  worldBankGdp: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD",
  worldBankIndustry: "https://data.worldbank.org/indicator/NV.IND.TOTL.ZS",
  worldBankPopulation: "https://data.worldbank.org/indicator/SP.POP.TOTL",
  baseConfig: appUrl("config/base_case.json"),
  bullConfig: appUrl("config/bull_case.json"),
  bearConfig: appUrl("config/bear_case.json"),
  regressionDataset: appUrl("outputs/demand_driver_regression_dataset.csv"),
  regressionGdpDataset: appUrl("outputs/demand_world_gdp_regression_dataset.csv"),
  regressionPlotPoints: appUrl("outputs/demand_regression_plot_points.csv"),
  relationshipDiagnostics: appUrl("outputs/copper_gdp_relationship_diagnostics.csv"),
  regressionSummary: appUrl("outputs/demand_driver_regression_summary.csv"),
  regressionFit: appUrl("outputs/demand_driver_regression_fit.csv"),
  workbookMarketBalance: appUrl("outputs/workbook_market_balance.csv"),
  workbookDemandComponents: appUrl("outputs/workbook_demand_components.csv"),
  workbookMajorMines: appUrl("outputs/workbook_major_mines.csv"),
  workbookMineSupplyCountry: appUrl("outputs/workbook_mine_supply_country.csv"),
  icsgForecast: appUrl("outputs/icsg_forecast_2026_04_23.csv"),
  icsgRegionalForecast: appUrl("outputs/icsg_regional_forecast_2026_04_23.csv"),
  supplyAssetSeed: appUrl("data/seed/global_copper_supply_assets.csv"),
  supplyDisruptionsSeed: appUrl("data/seed/global_copper_supply_disruptions.csv"),
  baseSupplyAssets: appUrl("outputs/base_case_supply_assets.csv"),
  baseSupplySummary: appUrl("outputs/base_case_supply_summary.csv"),
  baseSupplyBridge: appUrl("outputs/base_case_supply_conversion_bridge.csv"),
  baseSupplySources: appUrl("outputs/base_case_supply_sources.csv"),
  icsgHistoricalBalance: appUrl("data/seed/icsg_world_copper_balance_1960_2024.csv"),
};

function sourceLink(label, url) {
  return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
}

function configLinkItems() {
  return [
    sourceLink("Base JSON", sourceUrls.baseConfig),
    sourceLink("Bull JSON", sourceUrls.bullConfig),
    sourceLink("Bear JSON", sourceUrls.bearConfig),
  ];
}

function sourceNote(text, links = []) {
  return `${text}${links.length ? `<div class="source-links">${links.join(" ")}</div>` : ""}`;
}

function parseCsv(text) {
  const rows = [];
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      const value = values[index] ?? "";
      const numeric = Number(value);
      row[header] = value !== "" && Number.isFinite(numeric) ? numeric : value;
    });
    rows.push(row);
  }

  return rows;
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function formatKt(value) {
  return `${Math.round(value).toLocaleString()}`;
}

function formatOptionalKt(value) {
  if (value === "" || value === null || value === undefined) return "--";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatKt(numeric) : "--";
}

function formatOptionalKtUnit(value) {
  const formatted = formatOptionalKt(value);
  return formatted === "--" ? formatted : `${formatted} kt`;
}

function formatSignedKt(value) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}`;
}

function formatPct(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSignedPct(value, digits = 1) {
  const scaled = value * 100;
  const sign = scaled > 0 ? "+" : "";
  return `${sign}${scaled.toFixed(digits)}%`;
}

function formatNumber(value, digits = 3) {
  if (value === "" || value === null || value === undefined) return "--";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "--";
}

function formatUsd(value) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatBalance(value) {
  if (Math.abs(value) < 100) {
    return `near balance (${formatSignedKt(value)} kt)`;
  }
  return `${formatKt(Math.abs(value))} kt ${value < 0 ? "deficit" : "surplus"}`;
}

function clip(value, lower, upper) {
  return Math.min(Math.max(value, lower), upper);
}

function balanceClass(value) {
  if (value < -100) return "deficit";
  if (value > 100) return "surplus";
  return "balanced";
}

function rowForYear(scenario, year) {
  return scenario.forecast.find((row) => row.year === year) ?? scenario.forecast.at(-1);
}

function cumulativeBalance(scenario, year) {
  return scenario.forecast
    .filter((row) => row.year <= year)
    .reduce((sum, row) => sum + row.market_balance_kt, 0);
}

function scenarioRowsForYear(state, year) {
  return SCENARIOS.map((scenario) => {
    const loadedScenario = state.scenarios[scenario.id];
    return {
      ...loadedScenario,
      row: rowForYear(loadedScenario, year),
      cumulativeBalance: cumulativeBalance(loadedScenario, year),
    };
  });
}

function weightedAverage(rows, valueAccessor, weightAccessor = (row) => row.demand_kt) {
  const totalWeight = rows.reduce((sum, row) => sum + Number(weightAccessor(row) || 0), 0);
  if (totalWeight === 0) return 0;
  return rows.reduce((sum, row) => sum + Number(valueAccessor(row) || 0) * weightAccessor(row), 0) /
    totalWeight;
}

function extent(values) {
  return [Math.min(...values), Math.max(...values)];
}

function scaleLinear(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin || 1;
  return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

function linePath(rows, xAccessor, yAccessor) {
  return rows
    .map((row, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${xAccessor(row).toFixed(2)},${yAccessor(row).toFixed(2)}`;
    })
    .join(" ");
}

function renderLegend(items) {
  return `<div class="legend">${items
    .map(
      (item) =>
        `<span class="legend-item"><span class="legend-swatch" style="background:${item.color}"></span>${item.label}</span>`,
    )
    .join("")}</div>`;
}

function renderBalanceChart(rows, selectedYear) {
  const container = document.getElementById("balanceChart");
  const width = 960;
  const height = 390;
  const margin = { top: 18, right: 28, bottom: 54, left: 68 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const years = rows.map((row) => row.year);
  const [minYear, maxYear] = extent(years);
  const yValues = rows.flatMap((row) => [row.demand_kt, row.refined_supply_kt]);
  const [minY, maxY] = extent(yValues);
  const balanceExtent = Math.max(...rows.map((row) => Math.abs(row.market_balance_kt)), 1);
  const x = scaleLinear(minYear, maxYear, margin.left, margin.left + chartWidth);
  const y = scaleLinear(minY * 0.96, maxY * 1.03, margin.top + chartHeight, margin.top);
  const balanceZeroY = margin.top + chartHeight + 22;
  const balanceHeight = 46;
  const barWidth = Math.max(10, chartWidth / rows.length - 8);

  const yTicks = [minY * 0.98, (minY + maxY) / 2, maxY * 1.01];
  const yearTicks = rows.filter((row, index) => index % 2 === 0 || row.year === maxYear);

  const demandPath = linePath(rows, (row) => x(row.year), (row) => y(row.demand_kt));
  const supplyPath = linePath(rows, (row) => x(row.year), (row) => y(row.refined_supply_kt));
  const selectedX = x(selectedYear);

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${yTicks
        .map(
          (tick) => `
            <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" />
            <text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${formatKt(tick)}</text>
          `,
        )
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + chartHeight}" y2="${margin.top + chartHeight}" />
      ${yearTicks
        .map(
          (row) =>
            `<text x="${x(row.year)}" y="${height - 14}" text-anchor="middle">${row.year}</text>`,
        )
        .join("")}
      <path class="series-demand" d="${demandPath}" />
      <path class="series-supply" d="${supplyPath}" />
      ${rows
        .map((row) => {
          const h = (Math.abs(row.market_balance_kt) / balanceExtent) * balanceHeight;
          const positive = row.market_balance_kt >= 0;
          return `
            <rect
              class="${positive ? "balance-positive" : "balance-negative"}"
              x="${x(row.year) - barWidth / 2}"
              y="${positive ? balanceZeroY - h : balanceZeroY}"
              width="${barWidth}"
              height="${Math.max(h, 1)}"
              rx="2"
            />
          `;
        })
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${balanceZeroY}" y2="${balanceZeroY}" />
      <line class="selected-year" x1="${selectedX}" x2="${selectedX}" y1="${margin.top}" y2="${balanceZeroY + balanceHeight}" />
      <text x="${margin.left - 38}" y="${height - 16}" text-anchor="start">kt</text>
    </svg>
    ${renderLegend([
      { label: "Demand", color: colors.copper },
      { label: "Refined supply", color: colors.teal },
      { label: "Balance", color: colors.red },
    ])}
  `;
}

function renderSupplyMix(row) {
  const container = document.getElementById("supplyMixChart");
  const primary = row.primary_refined_supply_kt;
  const secondary = row.secondary_refined_supply_kt;
  const total = primary + secondary;
  const secondaryShare = secondary / total;
  const primaryDash = `${(1 - secondaryShare) * 100} ${secondaryShare * 100}`;

  container.innerHTML = `
    <svg viewBox="0 0 320 280" preserveAspectRatio="xMidYMid meet">
      <circle cx="160" cy="125" r="86" fill="none" stroke="#207b7f" stroke-width="34" pathLength="100" />
      <circle cx="160" cy="125" r="86" fill="none" stroke="#b65f2a" stroke-width="34" pathLength="100"
        stroke-dasharray="${primaryDash}" transform="rotate(-90 160 125)" />
      <text x="160" y="118" text-anchor="middle" style="font-size:30px;fill:#202124;font-weight:700">${Math.round(
        (primary / total) * 100,
      )}%</text>
      <text x="160" y="142" text-anchor="middle">primary</text>
      <text x="72" y="244" text-anchor="middle">${formatKt(primary)} kt</text>
      <text x="248" y="244" text-anchor="middle">${formatKt(secondary)} kt</text>
    </svg>
    ${renderLegend([
      { label: "Primary refined", color: colors.copper },
      { label: "Secondary refined", color: colors.teal },
    ])}
  `;
}

function renderRegionalDemand(rows) {
  const container = document.getElementById("regionalDemandChart");
  const total = rows.reduce((sum, row) => sum + row.demand_kt, 0);
  document.getElementById("regionalTotal").textContent = `${formatKt(total)} kt`;

  container.innerHTML = rows
    .sort((a, b) => b.demand_kt - a.demand_kt)
    .map((row) => {
      const width = (row.demand_kt / total) * 100;
      return `
        <div class="bar-row">
          <span class="bar-label" title="${row.region}">${row.region}</span>
          <span class="bar-track">
            <span class="bar-fill" style="width:${width}%;background:${regionColors[row.region] ?? colors.copper}"></span>
          </span>
          <span class="bar-value">${formatKt(row.demand_kt)}</span>
        </div>
      `;
    })
    .join("");
}

function renderMineSupply(rows) {
  const container = document.getElementById("mineSupplyChart");
  const sorted = [...rows].sort((a, b) => b.mine_supply_kt - a.mine_supply_kt);
  const topRows = sorted.slice(0, 10);
  const max = Math.max(...topRows.map((row) => row.mine_supply_kt));
  const total = rows.reduce((sum, row) => sum + row.mine_supply_kt, 0);
  document.getElementById("mineTotal").textContent = `${formatKt(total)} kt`;

  container.innerHTML = topRows
    .map((row) => `
      <div class="bar-row">
        <span class="bar-label" title="${row.country}">${row.country}</span>
        <span class="bar-track">
          <span class="bar-fill" style="width:${(row.mine_supply_kt / max) * 100}%"></span>
        </span>
        <span class="bar-value">${formatKt(row.mine_supply_kt)}</span>
      </div>
    `)
    .join("");
}

function riskClass(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "high") return "risk-high";
  if (normalized === "medium") return "risk-medium";
  if (normalized === "low") return "risk-low";
  return "risk-mixed";
}

function formatMaybeKt(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${formatKt(numeric)} kt` : "--";
}

function supplyRowForYear(summaryRows, year) {
  return summaryRows.find((row) => Math.round(row.year) === year) ?? summaryRows.at(-1);
}

function renderSupplyBridge(rows, year) {
  const bridgeRows = rows
    .filter((row) => Math.round(row.year) === year)
    .sort((a, b) => Number(a.step_order) - Number(b.step_order));
  const container = document.getElementById("supplyBridgeRows");
  const maxAbs = Math.max(...bridgeRows.map((row) => Math.abs(Number(row.kt))), 1);
  container.innerHTML = bridgeRows
    .map((row) => {
      const value = Number(row.kt);
      const width = Math.max((Math.abs(value) / maxAbs) * 48, 1);
      const left = value < 0 ? 50 - width : 50;
      const tone = value < -1 ? "negative" : value > 1 ? "positive" : "neutral";
      return `
        <div class="bridge-row">
          <div class="bridge-copy">
            <strong>${row.step}</strong>
            <span>${row.note}</span>
          </div>
          <span class="bridge-track">
            <span class="bridge-zero"></span>
            <span class="bridge-fill ${tone}" style="left:${left}%;width:${width}%"></span>
          </span>
          <strong class="bridge-value ${tone}">${formatSignedKt(value)} kt</strong>
        </div>
      `;
    })
    .join("");
}

function renderSupplyBucketChart(assetRows) {
  const grouped = Object.values(
    assetRows.reduce((groups, row) => {
      const bucket = row.supply_bucket || "Other";
      groups[bucket] = groups[bucket] || { label: bucket, value: 0 };
      groups[bucket].value += Number(row.risk_adjusted_mine_supply_kt || 0);
      return groups;
    }, {}),
  );
  const palette = [colors.copper, colors.teal, colors.gold, colors.green, colors.blue, colors.red];
  renderStackedBreakdown(
    "supplyBucketStack",
    "supplyBucketRows",
    grouped.map((row, index) => ({ ...row, color: palette[index % palette.length] })),
  );
}

function renderSupplyRiskRows(assetRows) {
  const relevant = assetRows
    .filter((row) => row.asset !== "Rest of World aggregate")
    .sort((a, b) => {
      const bSwing =
        Number(b.disruption_loss_kt || 0) +
        Number(b.project_probability_discount_kt || 0) +
        Number(b.maintenance_loss_kt || 0);
      const aSwing =
        Number(a.disruption_loss_kt || 0) +
        Number(a.project_probability_discount_kt || 0) +
        Number(a.maintenance_loss_kt || 0);
      return bSwing - aSwing;
    })
    .slice(0, 10);

  document.getElementById("supplyRiskRows").innerHTML = relevant
    .map((row) => `
      <tr>
        <td>${row.asset}<br><small>${row.country}</small></td>
        <td>${formatMaybeKt(row.disruption_loss_kt)}</td>
        <td>${formatMaybeKt(row.project_probability_discount_kt)}</td>
        <td>${formatMaybeKt(row.maintenance_loss_kt)}</td>
        <td>
          <span class="risk-pill ${riskClass(row.political_risk)}">${row.political_risk}</span>
          <span class="risk-pill ${riskClass(row.permitting_risk)}">${row.permitting_risk}</span>
          <span class="risk-pill ${riskClass(row.infrastructure_risk)}">${row.infrastructure_risk}</span>
        </td>
      </tr>
    `)
    .join("");
}

function renderSupplyAssetRows(assetRows) {
  const rows = [...assetRows]
    .sort(
      (a, b) =>
        Number(b.risk_adjusted_mine_supply_kt || 0) -
        Number(a.risk_adjusted_mine_supply_kt || 0),
    )
    .slice(0, 18);
  document.getElementById("supplyAssetRows").innerHTML = rows
    .map((row) => `
      <tr>
        <td>${row.asset}<br><small>${row.operator}</small></td>
        <td>${row.country}</td>
        <td>${row.supply_bucket}<br><small>${row.production_type}; ${row.route}</small></td>
        <td>${formatMaybeKt(row.gross_nameplate_kt)}</td>
        <td>${formatMaybeKt(row.risk_adjusted_mine_supply_kt)}</td>
        <td>${formatNumber(row.project_probability, 2)}</td>
        <td>${formatNumber(row.grade_pct, 2)}% / ${formatNumber(row.recovery_pct, 0)}%</td>
        <td><a href="${row.source_url}" target="_blank" rel="noreferrer">${row.source_name}</a><br><small>${row.assumption_note}</small></td>
      </tr>
    `)
    .join("");
}

function renderSupplyProjectRows(assetRows) {
  const rows = assetRows
    .filter((row) =>
      ["Committed projects", "Probable projects", "Possible projects", "Suspended supply", "Brownfield and expansion"].includes(
        row.supply_bucket,
      ),
    )
    .filter((row) => row.asset !== "Rest of World aggregate")
    .sort(
      (a, b) =>
        Number(b.gross_nameplate_kt || 0) - Number(a.gross_nameplate_kt || 0),
    )
    .slice(0, 14);
  document.getElementById("supplyProjectRows").innerHTML = rows
    .map((row) => `
      <tr>
        <td>${row.asset}<br><small>${row.country}</small></td>
        <td>${row.status}</td>
        <td>${formatMaybeKt(row.gross_nameplate_kt)}</td>
        <td>${formatMaybeKt(row.risk_adjusted_mine_supply_kt)}</td>
        <td>${formatMaybeKt(row.project_probability_discount_kt)}</td>
        <td>${formatNumber(row.project_probability, 2)}</td>
      </tr>
    `)
    .join("");
}

function renderSupplySourceRows(rows) {
  document.getElementById("supplySourceRows").innerHTML = rows
    .slice(0, 18)
    .map((row) => `
      <tr>
        <td>${row.asset}<br><small>${row.country}</small></td>
        <td><a href="${row.source_url}" target="_blank" rel="noreferrer">${row.source_name}</a></td>
        <td>${row.assumption_note}</td>
      </tr>
    `)
    .join("");
}

function renderSupplyMethodSummary(row) {
  const cards = [
    {
      label: "Mine supply",
      value: `${formatKt(row.mine_supply_kt)} kt`,
      detail: `${formatKt(row.operating_mine_supply_kt)} kt operating plus ${formatKt(
        row.project_and_expansion_supply_kt,
      )} kt project/expansion supply.`,
    },
    {
      label: "Risk discounts",
      value: `${formatKt(
        Number(row.disruption_loss_kt) +
          Number(row.maintenance_loss_kt) +
          Number(row.project_probability_discount_kt),
      )} kt`,
      detail: "Named disruptions, planned maintenance allowance, and project probability discount.",
    },
    {
      label: "Concentrate route",
      value: `${formatKt(row.concentrate_supply_kt)} kt`,
      detail: `${formatKt(row.sxew_supply_kt)} kt is modelled as SX-EW/direct leach output.`,
    },
    {
      label: "Refined conversion",
      value: `${formatKt(row.primary_refined_supply_kt)} kt`,
      detail: `${formatKt(row.smelter_refinery_constraint_kt + row.blending_constraint_kt)} kt of smelter/refinery and blending constraint.`,
    },
  ];
  document.getElementById("supplyMethodCards").innerHTML = cards
    .map((card) => `
      <article class="narrative-card neutral">
        <span>${card.label}</span>
        <strong>${card.value}</strong>
        <p>${card.detail}</p>
      </article>
    `)
    .join("");
}

function renderSupplyTab(state, year) {
  const scenario = state.scenarios[state.selectedScenarioId];
  const summaryRow = supplyRowForYear(scenario.supplySummary, year);
  const assetRows = scenario.supplyAssets.filter((row) => Math.round(row.year) === year);
  if (!summaryRow || !assetRows.length) return;

  document.getElementById("supplyTabBadge").textContent = `${scenario.label} ${year}`;
  document.getElementById("supplyMineMetric").textContent = `${formatKt(summaryRow.mine_supply_kt)} kt`;
  document.getElementById("supplyPrimaryMetric").textContent = `${formatKt(
    summaryRow.primary_refined_supply_kt,
  )} kt`;
  document.getElementById("supplyConstraintMetric").textContent = `${formatKt(
    Number(summaryRow.smelter_refinery_constraint_kt) + Number(summaryRow.blending_constraint_kt),
  )} kt`;
  document.getElementById("supplyModelLink").textContent =
    `The Model tab uses ${formatKt(summaryRow.primary_refined_supply_kt)} kt primary refined supply plus ${formatKt(
      summaryRow.secondary_refined_supply_kt,
    )} kt secondary refined supply in ${year}.`;

  renderSupplyMethodSummary(summaryRow);
  renderSupplyBridge(scenario.supplyBridge, year);
  renderSupplyBucketChart(assetRows);
  renderSupplyRiskRows(assetRows);
  renderSupplyAssetRows(assetRows);
  renderSupplyProjectRows(assetRows);
  renderSupplySourceRows(scenario.supplySources);
}

function renderStackedBreakdown(stackId, listId, rows) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  document.getElementById(stackId).innerHTML = sorted
    .map((row) => {
      const share = total > 0 ? row.value / total : 0;
      return `
        <span
          class="stack-segment"
          style="width:${share * 100}%;background:${row.color}"
          title="${row.label}: ${formatKt(row.value)} kt (${formatPct(share)})"
        >
          ${share >= 0.1 ? `<span>${row.label}</span>` : ""}
        </span>
      `;
    })
    .join("");

  document.getElementById(listId).innerHTML = sorted
    .map((row) => {
      const share = total > 0 ? row.value / total : 0;
      return `
        <div class="breakdown-row">
          <span class="breakdown-name">
            <span class="legend-swatch" style="background:${row.color}"></span>
            ${row.label}
          </span>
          <strong>${formatKt(row.value)} kt</strong>
          <span>${formatPct(share)}</span>
        </div>
      `;
    })
    .join("");
}

function renderDemandSupplyBreakdown(forecastRow, regionalRows) {
  document.getElementById("demandBreakdownBadge").textContent = `${formatKt(forecastRow.demand_kt)} kt`;
  document.getElementById("supplyBreakdownBadge").textContent = `${formatKt(
    forecastRow.refined_supply_kt,
  )} kt`;
  document.getElementById("modelSupplyBridgeNote").textContent =
    `${formatKt(forecastRow.refined_supply_kt)} kt refined supply = ${formatKt(
      forecastRow.primary_refined_supply_kt,
    )} kt primary refined supply + ${formatKt(
      forecastRow.secondary_refined_supply_kt,
    )} kt secondary refined supply. Primary refined comes from the Supply tab; secondary refined comes from the scrap/recycling rule.`;

  renderStackedBreakdown(
    "demandBreakdownStack",
    "demandBreakdownRows",
    regionalRows.map((row) => ({
      label: row.region,
      value: row.demand_kt,
      color: regionColors[row.region] ?? colors.copper,
    })),
  );

  renderStackedBreakdown("supplyBreakdownStack", "supplyBreakdownRows", [
    {
      label: "Primary refined",
      value: forecastRow.primary_refined_supply_kt,
      color: supplyBreakdownColors["Primary refined"],
    },
    {
      label: "Secondary refined",
      value: forecastRow.secondary_refined_supply_kt,
      color: supplyBreakdownColors["Secondary refined"],
    },
  ]);
}

function renderFactorRows(containerId, rows) {
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.value)), 0.001);
  document.getElementById(containerId).innerHTML = rows
    .map((row) => {
      const width = Math.max((Math.abs(row.value) / maxAbs) * 48, 1);
      const left = row.value < 0 ? 50 - width : 50;
      const tone = row.value < -0.0001 ? "negative" : "positive";
      return `
        <div class="factor-row">
          <div class="factor-copy">
            <strong>${row.label}</strong>
            <span>${row.detail}</span>
          </div>
          <span class="factor-bar">
            <span class="factor-zero"></span>
            <span class="factor-fill ${tone}" style="left:${left}%;width:${width}%"></span>
          </span>
          <strong class="factor-value ${tone}">${formatSignedPct(row.value)}</strong>
        </div>
      `;
    })
    .join("");
}

function renderFactorBreakdowns(forecastRow, regionalRows, config) {
  const weightedDemandGrowth = weightedAverage(regionalRows, (row) => row.growth_rate);
  const demandRows = [
    {
      label: "Industry activity",
      detail: `industry weight ${formatPct(config.demand.driver_weights.industry_value_added, 0)}`,
      value: weightedAverage(regionalRows, (row) => row.industry_contribution),
    },
    {
      label: "GDP per capita",
      detail: `income weight ${formatPct(config.demand.driver_weights.gdp_per_capita, 0)}`,
      value: weightedAverage(regionalRows, (row) => row.gdp_per_capita_contribution),
    },
    {
      label: "Population",
      detail: `population weight ${formatPct(config.demand.driver_weights.population, 0)}`,
      value: weightedAverage(regionalRows, (row) => row.population_contribution),
    },
    {
      label: "Energy-transition bonus",
      detail: "weighted regional transition assumption",
      value: weightedAverage(regionalRows, (row) => row.transition_bonus),
    },
    {
      label: "China property downturn",
      detail: "phased regional drag, weighted by demand share",
      value: weightedAverage(regionalRows, (row) => row.property_downturn_drag),
    },
    {
      label: "Substitution / intensity drag",
      detail: "material substitution and copper-thrifting assumption",
      value: weightedAverage(regionalRows, (row) => row.substitution_drag),
    },
    {
      label: "Scenario shock",
      detail: config.demand.scenario_growth_shock === 0 ? "no additional shock" : "scenario stress adjustment",
      value: Number(config.demand.scenario_growth_shock),
    },
  ];
  const clipAdjustment = weightedAverage(regionalRows, (row) => row.clip_adjustment);
  if (Math.abs(clipAdjustment) > 0.0001) {
    demandRows.push({
      label: "Growth cap/floor adjustment",
      detail: "keeps regional demand growth inside scenario bounds",
      value: clipAdjustment,
    });
  }

  const primaryRows = [
    {
      label: "Supply tab primary growth",
      detail: "year-on-year primary refined growth from mine-level supply bridge",
      value: Number(forecastRow.primary_supply_growth),
    },
    {
      label: "Project credit knob",
      detail: "scenario input used by the Supply tab to scale project probabilities",
      value: Number(config.supply.project_pipeline_growth),
    },
    {
      label: "Disruption stress knob",
      detail: "scenario input used by the Supply tab to scale named disruption losses",
      value: -Number(config.supply.disruption_loss),
    },
  ];

  const secondaryDemandLink =
    Number(config.secondary_supply.demand_link) * weightedDemandGrowth;
  const rawSecondaryGrowth = secondaryDemandLink + Number(config.secondary_supply.collection_growth);
  const secondaryClipAdjustment =
    clip(
      rawSecondaryGrowth,
      Number(config.secondary_supply.growth_floor),
      Number(config.secondary_supply.growth_cap),
    ) - rawSecondaryGrowth;
  const secondaryRows = [
    {
      label: "Demand link * demand growth",
      detail: `${formatPct(config.secondary_supply.demand_link, 0)} * ${formatSignedPct(
        weightedDemandGrowth,
      )}`,
      value: secondaryDemandLink,
    },
    {
      label: "Collection growth",
      detail: "scrap/recycling collection improvement",
      value: Number(config.secondary_supply.collection_growth),
    },
  ];
  if (Math.abs(secondaryClipAdjustment) > 0.0001) {
    secondaryRows.push({
      label: "Growth cap/floor adjustment",
      detail: "keeps secondary supply growth inside scenario bounds",
      value: secondaryClipAdjustment,
    });
  }

  document.getElementById("demandFactorBadge").textContent = `${formatSignedPct(
    weightedDemandGrowth,
  )} annual`;
  document.getElementById("supplyFactorBadge").textContent =
    `primary ${formatSignedPct(forecastRow.primary_supply_growth)}, secondary ${formatSignedPct(
      clip(
        rawSecondaryGrowth,
        Number(config.secondary_supply.growth_floor),
        Number(config.secondary_supply.growth_cap),
      ),
    )}`;
  renderFactorRows("demandFactorRows", demandRows);
  renderFactorRows("primaryFactorRows", primaryRows);
  renderFactorRows("secondaryFactorRows", secondaryRows);
}

function updateMetrics(row) {
  document.getElementById("selectedYearLabel").textContent = row.year;
  document.getElementById("metricDemand").textContent = formatKt(row.demand_kt);
  document.getElementById("metricSupply").textContent = formatKt(row.refined_supply_kt);
  document.getElementById("metricBalance").textContent = formatSignedKt(row.market_balance_kt);
  document.getElementById("balanceBadge").textContent = `${formatSignedKt(row.market_balance_kt)} kt`;
}

function renderExecutiveView(state, year) {
  const selected = state.scenarios[state.selectedScenarioId];
  const row = rowForYear(selected, year);
  const scenarioRows = scenarioRowsForYear(state, year);
  const deficitCount = scenarioRows.filter(({ row: scenarioRow }) => scenarioRow.market_balance_kt < -100).length;
  const demandGrowth = row.demand_kt / Number(selected.config.demand.global_refined_demand_kt) - 1;
  const supplyGrowth = row.refined_supply_kt / Number(selected.config.supply.refinery_production_kt) - 1;
  const signal = document.getElementById("marketSignal");

  document.getElementById("marketSignalBadge").textContent = `${year} signal`;
  signal.textContent = formatBalance(row.market_balance_kt);
  signal.className = `signal-value ${balanceClass(row.market_balance_kt)}`;
  document.getElementById("marketSignalCopy").textContent =
    `In ${selected.label}, refined demand is ${formatKt(row.demand_kt)} kt against ${formatKt(
      row.refined_supply_kt,
    )} kt of refined supply. ${deficitCount} of 3 scenarios are in deficit at ${year}.`;

  document.getElementById("readthroughBadge").textContent = selected.label;
  document.getElementById("demandGrowthStat").textContent = formatSignedPct(demandGrowth);
  document.getElementById("supplyGrowthStat").textContent = formatSignedPct(supplyGrowth);
  document.getElementById("selectedReadthrough").textContent =
    row.market_balance_kt < -100
      ? "The selected scenario tightens because demand growth is running ahead of refined supply growth. This is a physical-balance signal, not a price forecast."
      : "The selected scenario is close to balanced because weaker demand or stronger supply offsets most of the projected demand growth.";

  const implicationItems =
    row.market_balance_kt < -100
      ? [
          "Sales: tighter balances support closer attention to customer coverage, contract timing, and regional demand signals.",
          `Operations: primary supply growth is ${formatPct(row.primary_supply_growth)} per year in this scenario, so project execution and disruption assumptions matter.`,
          "Market narrative: China demand, energy-transition demand, mine growth, and scrap response are the key swing factors.",
        ]
      : [
          "Sales: a looser balance would shift attention toward demand resilience and customer pull-through.",
          "Operations: stronger mine/refinery growth and scrap response are doing most of the offsetting work.",
          "Market narrative: the main risk is that demand weakens faster than supply adjusts.",
        ];

  document.getElementById("commercialImplications").innerHTML = implicationItems
    .map((item) => `<li>${item}</li>`)
    .join("");
}

function renderScenarioComparison(state, year) {
  const rows = scenarioRowsForYear(state, year);
  const maxAbsBalance = Math.max(...rows.map(({ row }) => Math.abs(row.market_balance_kt)), 1);
  document.getElementById("comparisonYearBadge").textContent = `${year}`;

  document.getElementById("scenarioComparisonBars").innerHTML = rows
    .map(({ id, label, row }) => {
      const width = Math.max((Math.abs(row.market_balance_kt) / maxAbsBalance) * 48, 1);
      const left = row.market_balance_kt < 0 ? 50 - width : 50;
      const tone = balanceClass(row.market_balance_kt);
      const selectedClass = id === state.selectedScenarioId ? "is-selected" : "";
      return `
        <div class="comparison-bar-row ${selectedClass}">
          <span class="comparison-label">${label}</span>
          <span class="comparison-track">
            <span class="comparison-zero"></span>
            <span class="comparison-fill ${tone}" style="left:${left}%;width:${width}%"></span>
          </span>
          <strong class="${tone}">${formatBalance(row.market_balance_kt)}</strong>
        </div>
      `;
    })
    .join("");

  document.getElementById("scenarioComparisonRows").innerHTML = rows
    .map(({ id, label, row, cumulativeBalance: totalBalance }) => {
      const tone = balanceClass(row.market_balance_kt);
      const selectedClass = id === state.selectedScenarioId ? " class=\"is-selected\"" : "";
      return `
        <tr${selectedClass}>
          <td>${label}</td>
          <td>${formatKt(row.demand_kt)} kt</td>
          <td>${formatKt(row.refined_supply_kt)} kt</td>
          <td class="${tone}">${formatBalance(row.market_balance_kt)}</td>
          <td>${formatSignedKt(totalBalance)} kt</td>
        </tr>
      `;
    })
    .join("");
}

function renderScenarioOptions(state) {
  const select = document.getElementById("scenarioSelect");
  if (select.options.length === 0) {
    SCENARIOS.forEach((scenario) => {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.label;
      option.title = scenario.description;
      select.appendChild(option);
    });
  }
  select.value = state.selectedScenarioId;
}

function averageTransitionBonus(config) {
  const regions = Object.values(config.demand.regions);
  return regions.reduce((sum, region) => sum + region.share * region.transition_growth_bonus, 0);
}

function demandPressure(config) {
  return averageTransitionBonus(config) + Number(config.demand.scenario_growth_shock);
}

function secondaryResponseText(config) {
  return `${formatPct(config.secondary_supply.demand_link, 0)} demand link + ${formatPct(
    config.secondary_supply.collection_growth,
  )} collection`;
}

function renderDriverSensitivity(state, year) {
  const rows = scenarioRowsForYear(state, year);
  const balanceValues = rows.map(({ row }) => row.market_balance_kt);
  const balanceSpread = Math.max(...balanceValues) - Math.min(...balanceValues);
  const byId = Object.fromEntries(rows.map((scenario) => [scenario.id, scenario]));
  const scenarioIds = ["base_case", "bull_case", "bear_case"];

  document.getElementById("driverYearBadge").textContent = `${year}`;
  document.getElementById("driverSummary").textContent =
    `The scenario spread at ${year} is ${formatKt(balanceSpread)} kt between the tightest and loosest balances. In this model, demand pressure and primary supply execution create most of that spread.`;

  const driverRows = [
    {
      label: "Demand pressure",
      why: "Combines energy-transition bonus and explicit demand shock.",
      value: (scenario) => `${formatSignedPct(demandPressure(scenario.config))} per year`,
    },
    {
      label: "Primary supply growth",
      why: "Mine/refinery growth is the largest supply-side lever.",
      value: (scenario) => `${formatPct(scenario.row.primary_supply_growth)} per year`,
    },
    {
      label: "Disruption loss",
      why: "Higher disruption directly reduces primary supply growth.",
      value: (scenario) => `${formatPct(scenario.config.supply.disruption_loss)} per year`,
    },
    {
      label: "Secondary response",
      why: "Scrap/recycling can help, but it responds only partly to demand growth.",
      value: (scenario) => secondaryResponseText(scenario.config),
    },
    {
      label: "Market balance",
      why: "The final physical surplus or deficit after all demand and supply assumptions.",
      value: (scenario) => formatBalance(scenario.row.market_balance_kt),
      className: (scenario) => balanceClass(scenario.row.market_balance_kt),
    },
  ];

  document.getElementById("driverRows").innerHTML = driverRows
    .map((driver) => {
      const cells = scenarioIds
        .map((scenarioId) => {
          const scenario = byId[scenarioId];
          const tone = driver.className ? driver.className(scenario) : "";
          return `<td class="${tone}">${driver.value(scenario)}</td>`;
        })
        .join("");
      return `<tr><td>${driver.label}</td>${cells}<td>${driver.why}</td></tr>`;
    })
    .join("");
}

function regionBonusText(config) {
  return Object.entries(config.demand.regions)
    .map(([name, region]) => `${name}: ${formatPct(region.transition_growth_bonus)}`)
    .join("; ");
}

function regionPropertyText(config) {
  return Object.entries(config.demand.regions)
    .filter(([, region]) => Number(region.property_downturn_drag || 0) !== 0)
    .map(
      ([name, region]) =>
        `${name}: ${formatSignedPct(region.property_downturn_drag)} by ${region.property_downturn_end_year}`,
    )
    .join("; ") || "No explicit property downturn drag";
}

function regionSubstitutionText(config) {
  return Object.entries(config.demand.regions)
    .map(([name, region]) => `${name}: ${formatSignedPct(region.substitution_drag || 0)}`)
    .join("; ");
}

function scenarioCell(state, scenarioId, formatter) {
  return formatter(state.scenarios[scenarioId].config);
}

function renderScenarioExplanation(state) {
  const selected = state.scenarios[state.selectedScenarioId];
  const summary = document.getElementById("selectedScenarioExplanation");
  summary.innerHTML = `<p><strong>${selected.label}:</strong> ${selected.description}</p>`;

  const rows = [
    {
      label: "Starting refined demand",
      source: sourceNote(
        "The model now anchors 2024 refined copper usage exactly to the transcribed ICSG historical balance seed: 27,353 kt.",
        [sourceLink("ICSG usage seed", sourceUrls.icsgHistoricalBalance), ...configLinkItems()],
      ),
      format: (config) => `${formatKt(config.demand.global_refined_demand_kt)} kt in ${config.base_year}`,
    },
    {
      label: "Starting mine/refinery supply",
      source: sourceNote(
        "The model now anchors 2024 mine production and refined production exactly to the transcribed ICSG historical balance seed: 22,990 kt mined copper and 27,486 kt refined production.",
        [sourceLink("ICSG historical balance seed", sourceUrls.icsgHistoricalBalance), ...configLinkItems()],
      ),
      format: (config) =>
        `${formatKt(config.supply.mine_production_kt)} kt mine, ${formatKt(
          config.supply.refinery_production_kt,
        )} kt refinery in ${config.base_year}`,
    },
    {
      label: "Regional demand shares",
      source: sourceNote(
        "ICSG says China accounted for 58% of 2024 global refined copper usage; Asia was 76%, Europe 14%, and North America 8%. US, EU, and Rest-of-World are simplified model buckets based on that context.",
        [sourceLink("ICSG regional usage", sourceUrls.icsgFactbook), ...configLinkItems()],
      ),
      format: (config) =>
        Object.entries(config.demand.regions)
          .map(([name, region]) => `${name}: ${formatPct(region.share, 0)}`)
          .join("; "),
    },
    {
      label: "Demand driver weights",
      source: sourceNote(
        "World Bank GDP, industry-share, and population indicators are the public drivers. The model converts them into fixed 10-year historical CAGRs: industry activity is real GDP times industry share, GDP per capita is real GDP per person, and population is total population. The weights are scenario assumptions. The regression files are kept as a diagnostic and are not used as the forecast weights because the fit is weak and the predictors overlap mechanically: GDP per capita plus population approximately reconstructs GDP growth, while industry activity already contains GDP.",
        [
          sourceLink("ICSG historical usage", sourceUrls.icsgHistoricalBalance),
          sourceLink("GDP", sourceUrls.worldBankGdp),
          sourceLink("Industry share", sourceUrls.worldBankIndustry),
          sourceLink("Population", sourceUrls.worldBankPopulation),
          sourceLink("Regression summary", sourceUrls.regressionSummary),
          sourceLink("Regression fit", sourceUrls.regressionFit),
          ...configLinkItems(),
        ],
      ),
      format: (config) =>
        `industry ${formatPct(config.demand.driver_weights.industry_value_added, 0)}, income ${formatPct(
          config.demand.driver_weights.gdp_per_capita,
          0,
        )}, population ${formatPct(config.demand.driver_weights.population, 0)}`,
    },
    {
      label: "Extra demand shock",
      source: sourceNote(
        "This is a scenario stress knob, not a published forecast. The idea comes from IEA-style scenario framing for critical minerals demand uncertainty; the exact percentage is set by the scenario JSON.",
        [sourceLink("IEA scenarios", sourceUrls.ieaCriticalMinerals), ...configLinkItems()],
      ),
      format: (config) => `${formatSignedPct(config.demand.scenario_growth_shock)} per year`,
    },
    {
      label: "Energy-transition bonus",
      source: sourceNote(
        "IEA provides copper demand and supply outlooks across energy-transition scenarios. The model applies this as a smaller annual add-on to each region's total demand growth; the exact percentages are scenario assumptions, not an IEA forecast.",
        [sourceLink("IEA copper outlook", sourceUrls.ieaCriticalMinerals), ...configLinkItems()],
      ),
      format: (config) => `${formatPct(averageTransitionBonus(config))} weighted average per year`,
      detail: regionBonusText,
    },
    {
      label: "China property downturn",
      source: sourceNote(
        "This is an explicit model adjustment for the risk that China construction/property copper intensity grows more slowly than the trailing macro history implies. It is phased in from the scenario JSON rather than sourced as a precise published forecast.",
        [sourceLink("ICSG historical usage", sourceUrls.icsgHistoricalBalance), ...configLinkItems()],
      ),
      format: (config) =>
        `${formatSignedPct(config.demand.regions.China.property_downturn_drag || 0)} by ${config.demand.regions.China.property_downturn_end_year || config.forecast_end_year}`,
      detail: regionPropertyText,
    },
    {
      label: "Substitution / intensity drag",
      source: sourceNote(
        "This is a model allowance for copper substitution, material efficiency, and copper-thrifting. It reduces regional demand growth after the macro and transition terms.",
        [sourceLink("ICSG scrap and usage context", sourceUrls.icsgFactbook), ...configLinkItems()],
      ),
      format: (config) =>
        `${formatSignedPct(
          Object.values(config.demand.regions).reduce(
            (sum, region) => sum + Number(region.share) * Number(region.substitution_drag || 0),
            0,
          ),
        )} weighted average per year`,
      detail: regionSubstitutionText,
    },
    {
      label: "Demand growth cap",
      source: sourceNote(
        "No external forecast is used for this. It is a model guardrail so the macro proxy cannot create extreme one-year demand growth.",
        configLinkItems(),
      ),
      format: (config) =>
        `${formatPct(config.demand.growth_floor)} floor, ${formatPct(config.demand.growth_cap)} cap`,
    },
    {
      label: "Primary / secondary refined split",
      source: sourceNote(
        "ICSG reports 2024 refined output as 65.5% primary from concentrates, 17.4% SX-EW from leaching ores, and 17.1% secondary. The model groups primary plus SX-EW as primary supply, so the base split is about 83% primary and 17% secondary.",
        [sourceLink("ICSG refined production", sourceUrls.icsgFactbook), ...configLinkItems()],
      ),
      format: (config) =>
        `${formatPct(config.supply.primary_refined_share, 0)} primary, ${formatPct(
          1 - config.supply.primary_refined_share,
          0,
        )} secondary`,
    },
    {
      label: "Mine/refinery project growth",
      source: sourceNote(
        "Primary supply is built in the Supply tab from asset-level production, ramp-ups, project probability, disruptions, and mine-to-refined conversion constraints. The model now uses lighter project probability discounts and an explicit rest-of-world growth rate rather than the old conservative residual formula.",
        [
          sourceLink("Supply asset seed", sourceUrls.supplyAssetSeed),
          sourceLink("Supply summary", sourceUrls.baseSupplySummary),
          sourceLink("ICSG capacity trends", sourceUrls.icsgFactbook),
          ...configLinkItems(),
        ],
      ),
      format: (config) => `${formatPct(config.supply.project_pipeline_growth)} per year`,
    },
    {
      label: "Rest-of-world mine growth",
      source: sourceNote(
        "The prior model barely grew residual rest-of-world mine supply because it used a conservative formula tied to project growth net of disruptions. This is now an explicit scenario assumption.",
        [sourceLink("Supply summary", sourceUrls.baseSupplySummary), ...configLinkItems()],
      ),
      format: (config) => `${formatPct(config.supply.rest_of_world_growth)} per year`,
    },
    {
      label: "Conversion constraints",
      source: sourceNote(
        "The mine-to-refined bridge converts risk-adjusted mine supply into primary refined supply using a 2024 ICSG calibration factor, then subtracts configured smelter/refinery and blending constraints. These constraints have been loosened so the bridge is not the main reason production is below reference cases.",
        [
          sourceLink("Supply conversion bridge", sourceUrls.baseSupplyBridge),
          sourceLink("Supply summary", sourceUrls.baseSupplySummary),
          ...configLinkItems(),
        ],
      ),
      format: (config) =>
        `maintenance ${formatNumber(config.supply.maintenance_loss_multiplier, 2)}x, capacity growth ${formatPct(
          config.supply.concentrate_processing_capacity_growth,
        )}, blending ${formatPct(config.supply.blending_constraint_pct)}`,
    },
    {
      label: "Disruption loss",
      source: sourceNote(
        "Named disruption rows are stored in the supply disruption seed. The scenario disruption knob scales those expected losses and operating-risk allowances.",
        [
          sourceLink("Supply disruptions", sourceUrls.supplyDisruptionsSeed),
          sourceLink("ICSG supply constraints", sourceUrls.icsgFactbook),
          ...configLinkItems(),
        ],
      ),
      format: (config) => `${formatPct(config.supply.disruption_loss)} per year`,
    },
    {
      label: "Secondary supply demand link",
      source: sourceNote(
        "ICSG identifies recycling, scrap supply, prices, industrial growth, regulation, and technology as scrap-market drivers. This link turns stronger demand into some extra secondary supply response.",
        [sourceLink("ICSG scrap drivers", sourceUrls.icsgFactbook), ...configLinkItems()],
      ),
      format: (config) =>
        `${formatPct(config.secondary_supply.demand_link, 0)} of demand growth flows into secondary supply growth`,
    },
    {
      label: "Secondary collection growth",
      source: sourceNote(
        "ICSG recycling work is the source for the collection/recycling concept. The annual collection growth rate is a scenario assumption about how quickly scrap systems improve.",
        [sourceLink("ICSG recycling", sourceUrls.icsgFactbook), ...configLinkItems()],
      ),
      format: (config) => `${formatPct(config.secondary_supply.collection_growth)} per year`,
    },
  ];

  document.getElementById("scenarioAssumptions").innerHTML = rows
    .map((row) => {
      const cells = ["base_case", "bull_case", "bear_case"]
        .map((scenarioId) => {
          const mainText = scenarioCell(state, scenarioId, row.format);
          const detailText = row.detail ? row.detail(state.scenarios[scenarioId].config) : "";
          return `<td>${mainText}${detailText ? `<br><small>${detailText}</small>` : ""}</td>`;
        })
        .join("");
      return `<tr><td>${row.label}</td><td class="assumption-source">${row.source}</td>${cells}</tr>`;
    })
    .join("");
}

function relationshipCoefficient(row) {
  if (row.test_id === "log_levels") {
    return `${formatNumber(row.coefficient, 3)} elasticity`;
  }
  return `${formatNumber(row.coefficient, 3)} pp / pp`;
}

function relationshipResultClass(row) {
  const r2 = Number(row.r_squared);
  if (r2 >= 0.8) return "strong-fit";
  if (r2 >= 0.35) return "moderate-fit";
  return "weak-fit";
}

function compactRelationshipEquation(row) {
  const yVariable = String(row.y_variable || "").trim();
  const xVariable = String(row.x_variable || "").trim();
  const coefficient = Number(row.coefficient);
  const intercept = Number(row.intercept);
  if (!yVariable || !xVariable || !Number.isFinite(coefficient)) {
    return String(row.equation || "");
  }

  const coefficientText = formatNumber(coefficient, 3);
  if (!String(row.equation || "").includes("intercept")) {
    return `${yVariable} = ${coefficientText} * ${xVariable} + error`;
  }

  const interceptText = Number.isFinite(intercept) ? formatNumber(intercept, 3) : "intercept";
  const interceptPart = Number.isFinite(intercept)
    ? `${interceptText} ${coefficient >= 0 ? "+" : "-"} ${formatNumber(Math.abs(coefficient), 3)}`
    : `${interceptText} + ${coefficientText}`;
  return `${yVariable} = ${interceptPart} * ${xVariable} + error`;
}

function renderRelationshipDiagnostics(rows) {
  const container = document.getElementById("relationshipDiagnosticRows");
  container.innerHTML = rows
    .map((row) => {
      const fitClass = relationshipResultClass(row);
      const plottedClass = PLOTTED_RELATIONSHIP_IDS.has(String(row.test_id))
        ? "is-plotted"
        : "";
      return `
        <tr class="${fitClass} ${plottedClass}">
          <td>${row.test_name}${
            plottedClass ? '<span class="plot-badge">Plotted</span>' : ""
          }</td>
          <td>${Math.round(row.sample_start_year)}-${Math.round(row.sample_end_year)}<br><small>${Math.round(
            row.observations,
          )} observations</small></td>
          <td><code>${compactRelationshipEquation(row)}</code><br><small>${row.method}</small></td>
          <td>${relationshipCoefficient(row)}</td>
          <td><strong>${formatNumber(row.r_squared, 3)}</strong></td>
          <td>${row.readthrough}</td>
        </tr>
      `;
    })
    .join("");
}

function plotValueFormatter(points, value, digits = 1) {
  if (points[0].value_format === "log") {
    return Number(value).toFixed(digits + 1);
  }
  return formatSignedPct(value, digits);
}

function paddedDomain(values) {
  const finiteValues = values.map(Number).filter(Number.isFinite);
  if (!finiteValues.length) return [0, 1];
  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);
  const span = maxValue - minValue || Math.max(Math.abs(maxValue) * 0.2, 0.01);
  return [minValue - span * 0.12, maxValue + span * 0.12];
}

function regressionPlotLine(points, xDomain) {
  const firstPoint = points[0];
  if (firstPoint.line_type === "actual_equals_fitted") {
    return [
      { x: xDomain[0], y: xDomain[0] },
      { x: xDomain[1], y: xDomain[1] },
    ];
  }

  const sorted = [...points].sort((a, b) => Number(a.x_value) - Number(b.x_value));
  return [
    { x: Number(sorted[0].x_value), y: Number(sorted[0].fitted_value) },
    {
      x: Number(sorted.at(-1).x_value),
      y: Number(sorted.at(-1).fitted_value),
    },
  ];
}

function renderRegressionScatter(modelId, points) {
  const width = 520;
  const height = 330;
  const margin = { top: 22, right: 24, bottom: 62, left: 72 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const xValues = points.map((point) => Number(point.x_value));
  const yValues = points.map((point) => Number(point.y_value));
  let xDomain = paddedDomain(xValues);
  let yDomain = paddedDomain(yValues);
  const equalityPlot = points[0].line_type === "actual_equals_fitted";
  if (equalityPlot) {
    const sharedDomain = paddedDomain([...xValues, ...yValues]);
    xDomain = sharedDomain;
    yDomain = sharedDomain;
  }

  const linePoints = regressionPlotLine(points, xDomain);
  xDomain = paddedDomain([...xValues, ...linePoints.map((point) => point.x)]);
  yDomain = equalityPlot
    ? xDomain
    : paddedDomain([...yValues, ...linePoints.map((point) => point.y)]);
  const x = scaleLinear(xDomain[0], xDomain[1], margin.left, margin.left + chartWidth);
  const y = scaleLinear(yDomain[0], yDomain[1], margin.top + chartHeight, margin.top);
  const xTicks = [xDomain[0], (xDomain[0] + xDomain[1]) / 2, xDomain[1]];
  const yTicks = [yDomain[0], (yDomain[0] + yDomain[1]) / 2, yDomain[1]];
  const linePathValue = linePath(linePoints, (point) => x(point.x), (point) => y(point.y));
  const lineLabel = equalityPlot ? "Actual = fitted" : "Regression line";

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${points[0].model_name} scatterplot">
      ${yTicks
        .map(
          (tick) => `
            <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" />
            <text class="scatter-axis-label" x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${plotValueFormatter(points, tick, 1)}</text>
          `,
        )
        .join("")}
      ${xTicks
        .map(
          (tick) => `
            <line class="grid-line vertical" x1="${x(tick)}" x2="${x(tick)}" y1="${margin.top}" y2="${margin.top + chartHeight}" />
            <text class="scatter-axis-label" x="${x(tick)}" y="${height - 34}" text-anchor="middle">${plotValueFormatter(points, tick, 1)}</text>
          `,
        )
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + chartHeight}" y2="${margin.top + chartHeight}" />
      <line class="axis-line" x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${margin.top + chartHeight}" />
      <path class="${equalityPlot ? "scatter-equality-line" : "scatter-regression-line"}" d="${linePathValue}" />
      ${points
        .map(
          (point) => `
            <circle class="scatter-point" cx="${x(Number(point.x_value))}" cy="${y(Number(point.y_value))}" r="4.2">
              <title>${Math.round(point.year)}: x ${plotValueFormatter(points, point.x_value, 2)}, y ${plotValueFormatter(points, point.y_value, 2)}</title>
            </circle>
          `,
        )
        .join("")}
      <text class="scatter-axis-title" x="${margin.left + chartWidth / 2}" y="${height - 8}" text-anchor="middle">${points[0].x_label}</text>
      <text class="scatter-axis-title" transform="translate(18 ${margin.top + chartHeight / 2}) rotate(-90)" text-anchor="middle">${points[0].y_label}</text>
    </svg>
    ${renderLegend([
      { label: "Observation", color: colors.copper },
      { label: lineLabel, color: equalityPlot ? colors.green : colors.teal },
    ])}
  `;
}

function renderRegressionPlots(diagnostics, plotPoints) {
  const container = document.getElementById("regressionPlotGrid");
  const grouped = plotPoints.reduce((groups, point) => {
    groups[point.model_id] = groups[point.model_id] || [];
    groups[point.model_id].push(point);
    return groups;
  }, {});
  const diagnosticsById = Object.fromEntries(
    diagnostics.map((row) => [String(row.test_id), row]),
  );

  container.innerHTML = RELATIONSHIP_PLOT_ORDER
    .filter((plot) => grouped[plot.plotId] && diagnosticsById[plot.diagnosticId])
    .map((plot) => {
      const diagnostic = diagnosticsById[plot.diagnosticId];
      const points = grouped[plot.plotId].sort((a, b) => Number(a.year) - Number(b.year));
      return `
        <article class="regression-plot-card">
          <div class="plot-card-header">
            <div>
              <h3>${plot.title ?? diagnostic.test_name}</h3>
              <span>${points.length} observations</span>
            </div>
            <strong>R² ${formatNumber(diagnostic.r_squared, 3)}</strong>
          </div>
          <div class="scatter-chart">${renderRegressionScatter(plot.plotId, points)}</div>
          <code class="plot-equation">${compactRelationshipEquation(diagnostic)}</code>
          <p>${points[0].plot_note}</p>
        </article>
      `;
    })
    .join("");
}

function renderRegressionTab(regression) {
  const fitRows = regression.fit;
  const gdpRuleFit =
    fitRows.find((row) => row.model_id === "world_gdp_annual_no_intercept") ??
    fitRows[0];
  const diagnostics = regression.relationshipDiagnostics;
  const logLevels =
    diagnostics.find((row) => row.test_id === "log_levels") ?? diagnostics[0];
  const ruleDiagnostic =
    diagnostics.find((row) => row.test_id === "annual_growth_no_intercept") ??
    gdpRuleFit;
  document.getElementById("relationshipRuleSlope").textContent = formatNumber(
    ruleDiagnostic.coefficient ?? gdpRuleFit.key_coefficient,
    2,
  );
  document.getElementById("relationshipRuleR2").textContent = formatNumber(
    ruleDiagnostic.r_squared ?? gdpRuleFit.r_squared,
    3,
  );
  document.getElementById("relationshipLongRunR2").textContent = formatNumber(
    logLevels.r_squared,
    3,
  );
  document.getElementById("relationshipSample").textContent =
    `${Math.round(gdpRuleFit.observations)} observations`;

  renderRelationshipDiagnostics(regression.relationshipDiagnostics);
  renderRegressionPlots(regression.relationshipDiagnostics, regression.plotPoints);
}

function renderWorkbookBalanceChart(rows) {
  const container = document.getElementById("workbookBalanceChart");
  const width = 960;
  const height = 390;
  const margin = { top: 18, right: 28, bottom: 54, left: 68 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = 260;
  const years = rows.map((row) => row.year);
  const [minYear, maxYear] = extent(years);
  const yValues = rows.flatMap((row) => [row.refined_consumption_kt, row.refined_production_kt]);
  const [minY, maxY] = extent(yValues);
  const balanceExtent = Math.max(...rows.map((row) => Math.abs(row.market_balance_kt)), 1);
  const x = scaleLinear(minYear, maxYear, margin.left, margin.left + chartWidth);
  const y = scaleLinear(minY * 0.96, maxY * 1.03, margin.top + chartHeight, margin.top);
  const balanceZeroY = margin.top + chartHeight + 34;
  const balanceHeight = 46;
  const barWidth = Math.max(10, chartWidth / rows.length - 10);
  const yTicks = [minY * 0.98, (minY + maxY) / 2, maxY * 1.01];
  const yearTicks = rows.filter((row, index) => index % 2 === 0 || row.year === maxYear);
  const consumptionPath = linePath(rows, (row) => x(row.year), (row) => y(row.refined_consumption_kt));
  const productionPath = linePath(rows, (row) => x(row.year), (row) => y(row.refined_production_kt));

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${yTicks
        .map(
          (tick) => `
            <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" />
            <text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${formatKt(tick)}</text>
          `,
        )
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + chartHeight}" y2="${margin.top + chartHeight}" />
      ${yearTicks
        .map(
          (row) =>
            `<text x="${x(row.year)}" y="${height - 14}" text-anchor="middle">${row.year}</text>`,
        )
        .join("")}
      <path class="series-demand" d="${consumptionPath}" />
      <path class="series-supply" d="${productionPath}" />
      ${rows
        .map((row) => {
          const h = (Math.abs(row.market_balance_kt) / balanceExtent) * balanceHeight;
          const positive = row.market_balance_kt >= 0;
          return `
            <rect
              class="${positive ? "balance-positive" : "balance-negative"}"
              x="${x(row.year) - barWidth / 2}"
              y="${positive ? balanceZeroY - h : balanceZeroY}"
              width="${barWidth}"
              height="${Math.max(h, 1)}"
              rx="2"
            />
          `;
        })
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${balanceZeroY}" y2="${balanceZeroY}" />
      <text x="${margin.left - 38}" y="${height - 16}" text-anchor="start">kt</text>
    </svg>
    ${renderLegend([
      { label: "Refined consumption", color: colors.copper },
      { label: "Refined production", color: colors.teal },
      { label: "Market balance", color: colors.red },
    ])}
  `;
}

function renderWorkbookPriceChart(rows) {
  const container = document.getElementById("workbookPriceChart");
  const width = 520;
  const height = 260;
  const margin = { top: 16, right: 20, bottom: 38, left: 72 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const years = rows.map((row) => row.year);
  const prices = rows.map((row) => row.copper_price_usd_per_t);
  const [minYear, maxYear] = extent(years);
  const [minPrice, maxPrice] = extent(prices);
  const x = scaleLinear(minYear, maxYear, margin.left, margin.left + chartWidth);
  const y = scaleLinear(minPrice * 0.92, maxPrice * 1.05, margin.top + chartHeight, margin.top);
  const path = linePath(rows, (row) => x(row.year), (row) => y(row.copper_price_usd_per_t));
  const yTicks = [minPrice, (minPrice + maxPrice) / 2, maxPrice];
  const yearTicks = rows.filter((row, index) => index % 2 === 0 || row.year === maxYear);

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${yTicks
        .map(
          (tick) => `
            <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" />
            <text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${formatUsd(tick)}</text>
          `,
        )
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + chartHeight}" y2="${margin.top + chartHeight}" />
      <path class="series-price" d="${path}" />
      ${rows
        .map(
          (row) =>
            `<circle cx="${x(row.year)}" cy="${y(row.copper_price_usd_per_t)}" r="3.5" class="price-point" />`,
        )
        .join("")}
      ${yearTicks
        .map(
          (row) =>
            `<text x="${x(row.year)}" y="${height - 12}" text-anchor="middle">${row.year}</text>`,
        )
        .join("")}
    </svg>
  `;
}

function renderWorkbookDemandMix(row) {
  const otherDemand = Math.max(
    row.total_copper_consumption_kt -
      row.grid_power_infrastructure_kt -
      row.evs_renewables_kt -
      row.china_building_kt,
    0,
  );
  document.getElementById("workbookDemandMixBadge").textContent =
    `${Math.round(row.year)} total ${formatKt(row.total_copper_consumption_kt)} kt`;
  renderStackedBreakdown("workbookDemandMixStack", "workbookDemandMixRows", [
    {
      label: "Grid & power",
      value: row.grid_power_infrastructure_kt,
      color: colors.teal,
    },
    {
      label: "EVs & renewables",
      value: row.evs_renewables_kt,
      color: colors.green,
    },
    {
      label: "China building",
      value: row.china_building_kt,
      color: colors.copper,
    },
    {
      label: "Other demand",
      value: otherDemand,
      color: colors.blue,
    },
  ]);
}

function renderWorkbookSplitRow(label, leftLabel, leftValue, rightLabel, rightValue, leftColor, rightColor) {
  const total = leftValue + rightValue || 1;
  return `
    <div class="split-row">
      <div class="split-row-header">
        <strong>${label}</strong>
        <span>${formatKt(total)} kt</span>
      </div>
      <div class="split-track" aria-hidden="true">
        <span style="width:${(leftValue / total) * 100}%;background:${leftColor}"></span>
        <span style="width:${(rightValue / total) * 100}%;background:${rightColor}"></span>
      </div>
      <div class="split-row-values">
        <span><span class="legend-swatch" style="background:${leftColor}"></span>${leftLabel}: ${formatPct(
          leftValue / total,
          0,
        )}</span>
        <span><span class="legend-swatch" style="background:${rightColor}"></span>${rightLabel}: ${formatPct(
          rightValue / total,
          0,
        )}</span>
      </div>
    </div>
  `;
}

function renderWorkbookChinaSplit(row) {
  document.getElementById("workbookChinaSplitBadge").textContent = `${Math.round(row.year)}`;
  document.getElementById("workbookChinaSplit").innerHTML = [
    renderWorkbookSplitRow(
      "Refined consumption",
      "China",
      row.china_refined_consumption_kt,
      "World ex-China",
      row.world_ex_china_refined_consumption_kt,
      colors.copper,
      colors.blue,
    ),
    renderWorkbookSplitRow(
      "Refined production",
      "China",
      row.china_refined_production_kt,
      "World ex-China",
      row.world_ex_china_refined_production_kt,
      colors.copper,
      colors.teal,
    ),
  ].join("");
}

function renderWorkbookScrapRows(row) {
  document.getElementById("workbookScrapBadge").textContent =
    `${Math.round(row.year)} total ${formatKt(row.total_scrap_consumption_kt)} kt`;
  renderStackedBreakdown("workbookScrapStack", "workbookScrapRows", [
    {
      label: "Smelting & refining",
      value: row.scrap_smelting_refining_kt,
      color: colors.teal,
    },
    {
      label: "Direct melt",
      value: row.direct_melt_scrap_kt,
      color: colors.gold,
    },
  ]);
}

function renderWorkbookRows(rows) {
  document.getElementById("workbookRows").innerHTML = rows
    .slice(-6)
    .map((row) => {
      const tone = balanceClass(row.market_balance_kt);
      return `
        <tr>
          <td>${Math.round(row.year)}</td>
          <td>${formatKt(row.refined_production_kt)} kt</td>
          <td>${formatKt(row.refined_consumption_kt)} kt</td>
          <td class="${tone}">${formatBalance(row.market_balance_kt)}</td>
          <td>${formatUsd(row.copper_price_usd_per_t)}</td>
          <td>${formatPct(row.electrification_share_of_demand)}</td>
        </tr>
      `;
    })
    .join("");
}

function workbookYearRow(rows, year) {
  return rows.find((row) => Math.round(row.year) === year) ?? rows.at(-1);
}

function workbookDemandValue(rows, region, component, year) {
  const row = rows.find(
    (item) =>
      item.region === region &&
      item.component === component &&
      Math.round(item.year) === year,
  );
  return Number(row?.consumption_kt || 0);
}

function workbookSeries(rows, keyField, key, valueField) {
  return rows
    .filter((row) => row[keyField] === key)
    .sort((a, b) => a.year - b.year)
    .map((row) => ({ year: Number(row.year), value: Number(row[valueField] || 0) }));
}

function renderWorkbookNarrative(workbook) {
  const marketRows = workbook.marketBalance;
  const demandRows = workbook.demandComponents;
  const countryRows = workbook.mineSupplyCountry;
  const start = workbookYearRow(marketRows, 2024);
  const end = workbookYearRow(marketRows, 2030);
  const balanceTightening = end.market_balance_kt - start.market_balance_kt;
  const demandGrowth = end.refined_consumption_kt - start.refined_consumption_kt;
  const productionGrowth = end.refined_production_kt - start.refined_production_kt;
  const transitionComponents = [
    "Solar",
    "Onshore Wind",
    "Offshore Wind",
    "EVs",
    "Grid & Power Infrastructure",
  ];
  const transitionGrowth = transitionComponents.reduce(
    (sum, component) =>
      sum +
      workbookDemandValue(demandRows, "World", component, 2030) -
      workbookDemandValue(demandRows, "World", component, 2024),
    0,
  );
  const disruptionLoss =
    end.mine_production_pre_disruption_kt - end.mine_production_kt;
  const country2030 = countryRows
    .filter((row) => Math.round(row.year) === 2030 && row.country !== "World")
    .sort((a, b) => b.mine_supply_kt - a.mine_supply_kt);
  const worldMine2030 = Number(
    countryRows.find((row) => row.country === "World" && Math.round(row.year) === 2030)
      ?.mine_supply_kt || 0,
  );
  const topThree = country2030.filter((row) => row.country !== "Rest of World").slice(0, 3);
  const topThreeShare =
    worldMine2030 > 0
      ? topThree.reduce((sum, row) => sum + Number(row.mine_supply_kt || 0), 0) /
        worldMine2030
      : 0;

  document.getElementById("workbookNarrativeLead").textContent =
    `The reference model tells a tightening story: refined copper moves from a ${formatBalance(
      start.market_balance_kt,
    )} in 2024 to a ${formatBalance(end.market_balance_kt)} in 2030, while the price path rises to ${formatUsd(
      end.copper_price_usd_per_t,
    )}/t.`;

  document.getElementById("workbookNarrativeCards").innerHTML = [
    {
      label: "Balance pivots tighter",
      value: `${formatSignedKt(balanceTightening)} kt`,
      detail: `Production adds ${formatKt(productionGrowth)} kt, but refined consumption adds ${formatKt(
        demandGrowth,
      )} kt from 2024 to 2030.`,
      tone: balanceTightening < 0 ? "negative" : "positive",
    },
    {
      label: "Transition demand carries the growth",
      value: `${formatKt(transitionGrowth)} kt`,
      detail: `Grid, renewables, and EVs add more than the net demand increase, offsetting declines in buildings and ICE transport.`,
      tone: "positive",
    },
    {
      label: "Supply risk is concentrated",
      value: `${formatPct(topThreeShare, 0)}`,
      detail: `${topThree.map((row) => row.country).join(", ")} account for this share of 2030 mine supply in the reference model.`,
      tone: "neutral",
    },
    {
      label: "Disruption allowance matters",
      value: `${formatKt(disruptionLoss)} kt`,
      detail: `The 2030 mine output line is reduced by the model's ${formatPct(
        end.disruption_allowance,
        1,
      )} disruption allowance.`,
      tone: "negative",
    },
  ]
    .map(
      (card) => `
        <article class="narrative-card ${card.tone}">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
          <p>${card.detail}</p>
        </article>
      `,
    )
    .join("");
}

function renderWorkbookBalanceBridge(rows) {
  const start = workbookYearRow(rows, 2024);
  const end = workbookYearRow(rows, 2030);
  const productionGrowth = end.refined_production_kt - start.refined_production_kt;
  const consumptionGrowth = end.refined_consumption_kt - start.refined_consumption_kt;
  const bridgeRows = [
    {
      label: "2024 balance",
      value: start.market_balance_kt,
      detail: "starting point",
    },
    {
      label: "Refined production change",
      value: productionGrowth,
      detail: "adds supply",
    },
    {
      label: "Refined consumption change",
      value: -consumptionGrowth,
      detail: "absorbs supply",
    },
    {
      label: "2030 balance",
      value: end.market_balance_kt,
      detail: "ending point",
    },
  ];
  const maxAbs = Math.max(...bridgeRows.map((row) => Math.abs(row.value)), 1);
  document.getElementById("workbookBalanceBridge").innerHTML = bridgeRows
    .map((row) => {
      const width = Math.max((Math.abs(row.value) / maxAbs) * 48, 1);
      const left = row.value < 0 ? 50 - width : 50;
      const tone = row.value < -100 ? "negative" : row.value > 100 ? "positive" : "neutral";
      return `
        <div class="bridge-row">
          <div class="bridge-copy">
            <strong>${row.label}</strong>
            <span>${row.detail}</span>
          </div>
          <span class="bridge-track">
            <span class="bridge-zero"></span>
            <span class="bridge-fill ${tone}" style="left:${left}%;width:${width}%"></span>
          </span>
          <strong class="bridge-value ${tone}">${formatSignedKt(row.value)} kt</strong>
        </div>
      `;
    })
    .join("");
}

function renderWorkbookComponentTrendChart(rows) {
  const container = document.getElementById("workbookComponentTrendChart");
  const components = [
    { name: "Grid & Power Infrastructure", label: "Grid & power", color: colors.teal },
    { name: "EVs", label: "EVs", color: colors.green },
    { name: "Buildings", label: "Buildings", color: colors.copper },
    { name: "ICE", label: "ICE", color: colors.red },
    { name: "Data", label: "Data", color: colors.gold },
  ];
  const series = components.map((component) => {
    const values = workbookSeries(
      rows.filter((row) => row.region === "World"),
      "component",
      component.name,
      "consumption_kt",
    );
    const base = values.find((row) => row.year === 2024)?.value || values[0]?.value || 1;
    return {
      ...component,
      values: values.map((row) => ({ year: row.year, value: (row.value / base) * 100 })),
    };
  });
  const allPoints = series.flatMap((item) => item.values);
  const years = allPoints.map((row) => row.year);
  const values = allPoints.map((row) => row.value);
  const [minYear, maxYear] = extent(years);
  const [minValue, maxValue] = extent(values);
  const width = 960;
  const height = 330;
  const margin = { top: 18, right: 28, bottom: 54, left: 68 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const x = scaleLinear(minYear, maxYear, margin.left, margin.left + chartWidth);
  const y = scaleLinear(Math.min(80, minValue * 0.96), maxValue * 1.06, margin.top + chartHeight, margin.top);
  const yTicks = [80, 100, Math.ceil(maxValue / 25) * 25];
  const yearTicks = allPoints
    .filter((row, index) => index < 12)
    .filter((row, index) => index % 2 === 0 || row.year === maxYear);

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${yTicks
        .map(
          (tick) => `
            <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" />
            <text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${Math.round(tick)}</text>
          `,
        )
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + chartHeight}" y2="${margin.top + chartHeight}" />
      ${yearTicks
        .map(
          (row) =>
            `<text x="${x(row.year)}" y="${height - 14}" text-anchor="middle">${row.year}</text>`,
        )
        .join("")}
      ${series
        .map(
          (item) =>
            `<path class="component-line" d="${linePath(
              item.values,
              (row) => x(row.year),
              (row) => y(row.value),
            )}" style="stroke:${item.color}" />`,
        )
        .join("")}
      <text x="${margin.left - 42}" y="${height - 16}" text-anchor="start">2024=100</text>
    </svg>
    ${renderLegend(series.map((item) => ({ label: item.label, color: item.color })))}
  `;
}

function renderWorkbookDemandMoverRows(rows) {
  const worldRows = rows.filter((row) => row.region === "World" && row.component !== "Total");
  const components = [...new Set(worldRows.map((row) => row.component))];
  const movers = components
    .map((component) => {
      const start = workbookDemandValue(rows, "World", component, 2024);
      const end = workbookDemandValue(rows, "World", component, 2030);
      const total2024 = workbookDemandValue(rows, "World", "Total", 2024);
      const total2030 = workbookDemandValue(rows, "World", "Total", 2030);
      return {
        component,
        start,
        end,
        change: end - start,
        startShare: total2024 > 0 ? start / total2024 : 0,
        endShare: total2030 > 0 ? end / total2030 : 0,
      };
    })
    .sort((a, b) => b.change - a.change);
  document.getElementById("workbookDemandMoverRows").innerHTML = movers
    .map((row) => {
      const tone = row.change < -100 ? "negative" : row.change > 100 ? "positive" : "";
      return `
        <tr>
          <td>${row.component}</td>
          <td>${formatKt(row.start)} kt</td>
          <td>${formatPct(row.startShare)}</td>
          <td>${formatKt(row.end)} kt</td>
          <td class="${tone}">${formatSignedKt(row.change)} kt</td>
          <td>${formatPct(row.endShare)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderWorkbookCountrySupply(rows) {
  const countryRows = rows
    .filter((row) => Math.round(row.year) === 2030 && row.country !== "World")
    .sort((a, b) => b.mine_supply_kt - a.mine_supply_kt)
    .slice(0, 10);
  const max = Math.max(...countryRows.map((row) => row.mine_supply_kt), 1);
  document.getElementById("workbookCountrySupplyChart").innerHTML = countryRows
    .map((row) => {
      const start = Number(
        rows.find((item) => item.country === row.country && Math.round(item.year) === 2024)
          ?.mine_supply_kt || 0,
      );
      const change = Number(row.mine_supply_kt || 0) - start;
      const tone = change < -50 ? "negative" : change > 50 ? "positive" : "neutral";
      return `
        <div class="country-row">
          <span class="bar-label" title="${row.country}">${row.country}</span>
          <span class="bar-track">
            <span class="bar-fill" style="width:${(row.mine_supply_kt / max) * 100}%"></span>
          </span>
          <span class="country-value">${formatKt(row.mine_supply_kt)} kt</span>
          <span class="country-change ${tone}">${formatSignedKt(change)}</span>
        </div>
      `;
    })
    .join("");
}

function renderWorkbookMineMovers(rows) {
  const mines = [...new Set(rows.map((row) => row.mine))];
  const movers = mines
    .map((mine) => {
      const start = Number(
        rows.find((row) => row.mine === mine && Math.round(row.year) === 2024)
          ?.mine_supply_kt || 0,
      );
      const end = Number(
        rows.find((row) => row.mine === mine && Math.round(row.year) === 2030)
          ?.mine_supply_kt || 0,
      );
      return { mine, start, end, change: end - start };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10);
  document.getElementById("workbookMineMoverRows").innerHTML = movers
    .map((row) => {
      const tone = row.change < -25 ? "negative" : row.change > 25 ? "positive" : "";
      return `
        <tr>
          <td>${row.mine}</td>
          <td>${formatKt(row.start)} kt</td>
          <td>${formatKt(row.end)} kt</td>
          <td class="${tone}">${formatSignedKt(row.change)} kt</td>
        </tr>
      `;
    })
    .join("");
}

function renderWorkbookTab(workbook) {
  const rows = Array.isArray(workbook) ? workbook : workbook.marketBalance;
  const workbookData = Array.isArray(workbook)
    ? { marketBalance: rows, demandComponents: [], majorMines: [], mineSupplyCountry: [] }
    : workbook;
  const first = rows[0];
  const last = rows.at(-1);
  const balanceMetric = document.getElementById("workbookFinalBalance");

  document.getElementById("workbookDataBadge").textContent =
    `${Math.round(first.year)}-${Math.round(last.year)} from reference model`;
  balanceMetric.textContent = formatBalance(last.market_balance_kt);
  balanceMetric.className = balanceClass(last.market_balance_kt);
  document.getElementById("workbookFinalPrice").textContent = formatUsd(
    last.copper_price_usd_per_t,
  );
  document.getElementById("workbookFinalElectrification").textContent = formatPct(
    last.electrification_share_of_demand,
  );

  renderWorkbookBalanceChart(rows);
  renderWorkbookDemandMix(last);
  renderWorkbookPriceChart(rows);
  renderWorkbookChinaSplit(last);
  renderWorkbookScrapRows(last);
  renderWorkbookRows(rows);
  if (
    workbookData.demandComponents.length &&
    workbookData.mineSupplyCountry.length &&
    workbookData.majorMines.length
  ) {
    renderWorkbookNarrative(workbookData);
    renderWorkbookBalanceBridge(rows);
    renderWorkbookComponentTrendChart(workbookData.demandComponents);
    renderWorkbookDemandMoverRows(workbookData.demandComponents);
    renderWorkbookCountrySupply(workbookData.mineSupplyCountry);
    renderWorkbookMineMovers(workbookData.majorMines);
  }
}

function icsgYearRow(rows, year) {
  return rows.find((row) => Math.round(row.year) === year) ?? rows.at(-1);
}

function renderIcsgBalanceChart(rows) {
  const container = document.getElementById("icsgBalanceChart");
  const width = 960;
  const height = 390;
  const margin = { top: 18, right: 28, bottom: 54, left: 68 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = 260;
  const years = rows.map((row) => row.year);
  const [minYear, maxYear] = extent(years);
  const yValues = rows.flatMap((row) => [
    row.refined_consumption_kt,
    row.refined_production_adjusted_kt,
  ]);
  const [minY, maxY] = extent(yValues);
  const balanceExtent = Math.max(...rows.map((row) => Math.abs(row.market_balance_kt)), 1);
  const x = scaleLinear(minYear, maxYear, margin.left, margin.left + chartWidth);
  const y = scaleLinear(minY * 0.985, maxY * 1.02, margin.top + chartHeight, margin.top);
  const balanceZeroY = margin.top + chartHeight + 34;
  const balanceHeight = 46;
  const barWidth = Math.max(36, chartWidth / rows.length - 78);
  const yTicks = [minY, (minY + maxY) / 2, maxY];
  const consumptionPath = linePath(rows, (row) => x(row.year), (row) => y(row.refined_consumption_kt));
  const productionPath = linePath(rows, (row) => x(row.year), (row) => y(row.refined_production_adjusted_kt));

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${yTicks
        .map(
          (tick) => `
            <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" />
            <text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${formatKt(tick)}</text>
          `,
        )
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + chartHeight}" y2="${margin.top + chartHeight}" />
      <path class="series-demand" d="${consumptionPath}" />
      <path class="series-supply" d="${productionPath}" />
      ${rows
        .map((row) => {
          const h = (Math.abs(row.market_balance_kt) / balanceExtent) * balanceHeight;
          const positive = row.market_balance_kt >= 0;
          return `
            <rect
              class="${positive ? "balance-positive" : "balance-negative"}"
              x="${x(row.year) - barWidth / 2}"
              y="${positive ? balanceZeroY - h : balanceZeroY}"
              width="${barWidth}"
              height="${Math.max(h, 1)}"
              rx="2"
            />
          `;
        })
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${balanceZeroY}" y2="${balanceZeroY}" />
      ${rows
        .map((row) => `<text x="${x(row.year)}" y="${height - 14}" text-anchor="middle">${row.year}</text>`)
        .join("")}
      <text x="${margin.left - 38}" y="${height - 16}" text-anchor="start">kt</text>
    </svg>
    ${renderLegend([
      { label: "Refined consumption", color: colors.copper },
      { label: "Adjusted refined production", color: colors.teal },
      { label: "Refined balance", color: colors.green },
    ])}
  `;
}

function renderIcsgGrowthRows(rows) {
  const growthRows = rows
    .filter((row) => row.year >= 2026)
    .flatMap((row) => [
      {
        label: `${Math.round(row.year)} mine production`,
        detail: "world adjusted mine production growth",
        value: row.mine_production_growth,
      },
      {
        label: `${Math.round(row.year)} refined production`,
        detail: "world adjusted refined production growth",
        value: row.refined_production_growth,
      },
      {
        label: `${Math.round(row.year)} refined usage`,
        detail: "world apparent refined consumption growth",
        value: row.refined_consumption_growth,
      },
    ]);
  renderFactorRows("icsgGrowthRows", growthRows);
}

function renderIcsgRegionalBars(containerId, badgeId, rows, year, valueField) {
  const regionRows = rows
    .filter((row) => Math.round(row.year) === year && row[valueField] !== "")
    .map((row) => ({ ...row, value: Number(row[valueField]) }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value);
  const total = regionRows.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(...regionRows.map((row) => row.value), 1);

  document.getElementById(badgeId).textContent = `${formatKt(total)} kt`;
  document.getElementById(containerId).innerHTML = regionRows
    .map((row) => {
      const share = total > 0 ? row.value / total : 0;
      return `
        <div class="country-row">
          <span class="bar-label" title="${row.region}">${row.region}</span>
          <span class="bar-track">
            <span class="bar-fill" style="width:${(row.value / max) * 100}%"></span>
          </span>
          <span class="country-value">${formatKt(row.value)} kt</span>
          <span class="country-change neutral">${formatPct(share, 0)}</span>
        </div>
      `;
    })
    .join("");
}

function renderIcsgRegionalRows(rows) {
  document.getElementById("icsgRegionalRows").innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.region}</td>
          <td>${Math.round(row.year)}</td>
          <td>${formatKt(row.mine_production_kt)} kt</td>
          <td>${formatKt(row.refined_production_kt)} kt</td>
          <td>${formatOptionalKtUnit(row.refined_consumption_kt)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderIcsgTab(icsg) {
  const rows = icsg.forecast;
  const regionalRows = icsg.regional;
  const final = icsgYearRow(rows, 2027);
  const prior = icsgYearRow(rows, 2026);

  document.getElementById("icsgDataBadge").textContent = "2025-2027 forecast";
  document.getElementById("icsgNarrativeLead").textContent =
    `ICSG forecasts a refined copper surplus of ${formatKt(prior.market_balance_kt)} kt in 2026, widening to ${formatKt(
      final.market_balance_kt,
    )} kt in 2027 as adjusted refined production rises ${formatPct(
      final.refined_production_growth,
    )} and refined usage rises ${formatPct(final.refined_consumption_growth)}.`;
  document.getElementById("icsgFinalBalance").textContent = formatBalance(
    final.market_balance_kt,
  );
  document.getElementById("icsgFinalBalance").className = balanceClass(
    final.market_balance_kt,
  );
  document.getElementById("icsgFinalProduction").textContent = `${formatKt(
    final.refined_production_adjusted_kt,
  )} kt`;
  document.getElementById("icsgFinalConsumption").textContent = `${formatKt(
    final.refined_consumption_kt,
  )} kt`;

  renderIcsgBalanceChart(rows);
  renderIcsgGrowthRows(rows);
  renderIcsgRegionalBars(
    "icsgRegionalProductionChart",
    "icsgProductionRegionBadge",
    regionalRows,
    2027,
    "refined_production_kt",
  );
  renderIcsgRegionalBars(
    "icsgRegionalConsumptionChart",
    "icsgConsumptionRegionBadge",
    regionalRows,
    2027,
    "refined_consumption_kt",
  );
  renderIcsgRegionalRows(regionalRows);
}

function buildModelComparisonRows(state) {
  const years = state.icsg.forecast.map((row) => Math.round(row.year));
  const scenario = state.scenarios[state.selectedScenarioId];
  return years.flatMap((year) => {
    const modelRow = rowForYear(scenario, year);
    const referenceRow = workbookYearRow(state.workbook.marketBalance, year);
    const icsgRow = icsgYearRow(state.icsg.forecast, year);
    return [
      {
        year,
        metric: "Total refined consumption",
        model: modelRow.demand_kt,
        reference: referenceRow.refined_consumption_kt,
        icsg: icsgRow.refined_consumption_kt,
      },
      {
        year,
        metric: "Total refined production",
        model: modelRow.refined_supply_kt,
        reference: referenceRow.refined_production_kt,
        icsg: icsgRow.refined_production_adjusted_kt,
      },
    ];
  });
}

function comparisonSeriesRows(rows, metric) {
  return rows
    .filter((row) => row.metric === metric)
    .flatMap((row) => [
      { year: row.year, source: "Model", value: row.model },
      { year: row.year, source: "Reference Model", value: row.reference },
      { year: row.year, source: "ICSG Model", value: row.icsg },
    ]);
}

function renderGroupedComparisonChart(containerId, rows, metric) {
  const container = document.getElementById(containerId);
  const points = comparisonSeriesRows(rows, metric);
  const years = [...new Set(points.map((point) => point.year))];
  const sources = ["Model", "Reference Model", "ICSG Model"];
  const values = points.map((point) => point.value);
  const [minValue, maxValue] = extent(values);
  const yMin = Math.floor((minValue * 0.975) / 250) * 250;
  const yMax = Math.ceil((maxValue * 1.015) / 250) * 250;
  const width = 960;
  const height = 330;
  const margin = { top: 22, right: 24, bottom: 58, left: 74 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const groupWidth = chartWidth / years.length;
  const barWidth = Math.min(46, (groupWidth - 34) / sources.length);
  const xForYear = (year) =>
    margin.left + groupWidth * years.indexOf(year) + groupWidth / 2;
  const y = scaleLinear(yMin, yMax, margin.top + chartHeight, margin.top);
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${yTicks
        .map(
          (tick) => `
            <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" />
            <text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${formatKt(tick)}</text>
          `,
        )
        .join("")}
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + chartHeight}" y2="${margin.top + chartHeight}" />
      ${points
        .map((point) => {
          const sourceIndex = sources.indexOf(point.source);
          const x =
            xForYear(point.year) -
            ((sources.length * barWidth) / 2) +
            sourceIndex * barWidth;
          const barHeight = Math.max(y(yMin) - y(point.value), 1);
          return `
            <rect
              x="${x}"
              y="${y(point.value)}"
              width="${barWidth - 4}"
              height="${barHeight}"
              rx="2"
              fill="${modelSourceColors[point.source]}"
            />
          `;
        })
        .join("")}
      ${years
        .map((year) => `<text x="${xForYear(year)}" y="${height - 18}" text-anchor="middle">${year}</text>`)
        .join("")}
      <text x="${margin.left - 42}" y="${height - 20}" text-anchor="start">kt</text>
    </svg>
    ${renderLegend(sources.map((source) => ({ label: source, color: modelSourceColors[source] })))}
  `;
}

function renderModelComparisonRows(rows) {
  document.getElementById("modelComparisonRows").innerHTML = rows
    .map((row) => {
      const modelGap = row.model - row.icsg;
      const referenceGap = row.reference - row.icsg;
      const modelTone = modelGap < 0 ? "negative" : "positive";
      const referenceTone = referenceGap < 0 ? "negative" : "positive";
      return `
        <tr>
          <td>${row.year}</td>
          <td>${row.metric}</td>
          <td>${formatKt(row.model)} kt</td>
          <td>${formatKt(row.reference)} kt</td>
          <td>${formatKt(row.icsg)} kt</td>
          <td class="${modelTone}">${formatSignedKt(modelGap)} kt</td>
          <td class="${referenceTone}">${formatSignedKt(referenceGap)} kt</td>
        </tr>
      `;
    })
    .join("");
}

function renderModelComparisonTab(state) {
  const scenario = state.scenarios[state.selectedScenarioId];
  const rows = buildModelComparisonRows(state);
  const consumption2027 = rows.find(
    (row) => row.year === 2027 && row.metric === "Total refined consumption",
  );
  const production2027 = rows.find(
    (row) => row.year === 2027 && row.metric === "Total refined production",
  );
  const consumptionGap = consumption2027.model - consumption2027.icsg;
  const productionGap = production2027.model - production2027.icsg;

  document.getElementById("comparisonScenarioMetric").textContent = scenario.label;
  document.getElementById("comparisonConsumptionGap").textContent = `${formatSignedKt(
    consumptionGap,
  )} kt`;
  document.getElementById("comparisonConsumptionGap").className =
    consumptionGap < 0 ? "negative" : "positive";
  document.getElementById("comparisonProductionGap").textContent = `${formatSignedKt(
    productionGap,
  )} kt`;
  document.getElementById("comparisonProductionGap").className =
    productionGap < 0 ? "negative" : "positive";
  document.getElementById("modelComparisonNarrative").textContent =
    `In 2027, ${scenario.label} model refined consumption is ${formatKt(
      consumption2027.model,
    )} kt versus ICSG's ${formatKt(consumption2027.icsg)} kt, while refined production is ${formatKt(
      production2027.model,
    )} kt versus ICSG's adjusted ${formatKt(production2027.icsg)} kt.`;

  renderGroupedComparisonChart(
    "comparisonConsumptionChart",
    rows,
    "Total refined consumption",
  );
  renderGroupedComparisonChart(
    "comparisonProductionChart",
    rows,
    "Total refined production",
  );
  renderModelComparisonRows(rows);
}

function setupTabNavigation() {
  const buttons = Array.from(document.querySelectorAll("[data-tab-target]"));
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-selected", String(isActive));
      });
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("is-hidden", panel.id !== button.dataset.tabTarget);
      });
    });
  });
}

function syncYearRange(forecast) {
  const years = forecast.map((row) => row.year);
  const yearRange = document.getElementById("yearRange");
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const currentYear = Number(yearRange.value);

  yearRange.min = minYear;
  yearRange.max = maxYear;
  if (!Number.isFinite(currentYear) || currentYear < minYear || currentYear > maxYear) {
    yearRange.value = maxYear;
  }
}

function render(state) {
  const scenario = state.scenarios[state.selectedScenarioId];
  const { forecast, regional, mine } = scenario;
  syncYearRange(forecast);
  const year = Number(document.getElementById("yearRange").value);
  const selectedForecast = forecast.find((row) => row.year === year);
  const selectedRegional = regional.filter((row) => row.year === year);
  const selectedMine = mine.filter((row) => row.year === year);

  document.getElementById("scenarioEyebrow").textContent = scenario.eyebrow;
  renderScenarioOptions(state);
  renderExecutiveView(state, year);
  renderScenarioComparison(state, year);
  renderDriverSensitivity(state, year);
  renderScenarioExplanation(state);
  updateMetrics(selectedForecast);
  renderDemandSupplyBreakdown(selectedForecast, selectedRegional);
  renderFactorBreakdowns(selectedForecast, selectedRegional, scenario.config);
  renderBalanceChart(forecast, year);
  renderSupplyMix(selectedForecast);
  renderRegionalDemand(selectedRegional);
  renderMineSupply(selectedMine);
  renderSupplyTab(state, year);
  renderModelComparisonTab(state);
}

async function loadDataset(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return parseCsv(await response.text());
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

async function init() {
  const files = regressionFiles();
  const workbookDataFiles = workbookFiles();
  const icsgDataFiles = icsgFiles();
  const [
    scenarioEntries,
    regressionDataset,
    regressionGdpDataset,
    regressionPlotPoints,
    relationshipDiagnostics,
    regressionSummary,
    regressionFit,
    workbookMarketBalance,
    workbookDemandComponents,
    workbookMajorMines,
    workbookMineSupplyCountry,
    icsgForecast,
    icsgRegional,
  ] =
    await Promise.all([
      Promise.all(
        SCENARIOS.map(async (scenario) => {
          const scenarioDataFiles = scenarioFiles(scenario.id);
          const [
            config,
            forecast,
            regional,
            mine,
            supplyAssets,
            supplySummary,
            supplyBridge,
            supplySources,
          ] = await Promise.all([
            loadJson(scenarioDataFiles.config),
            loadDataset(scenarioDataFiles.forecast),
            loadDataset(scenarioDataFiles.regional),
            loadDataset(scenarioDataFiles.mine),
            loadDataset(scenarioDataFiles.supplyAssets),
            loadDataset(scenarioDataFiles.supplySummary),
            loadDataset(scenarioDataFiles.supplyBridge),
            loadDataset(scenarioDataFiles.supplySources),
          ]);
          return [
            scenario.id,
            {
              ...scenario,
              files: scenarioDataFiles,
              config,
              forecast,
              regional,
              mine,
              supplyAssets,
              supplySummary,
              supplyBridge,
              supplySources,
            },
          ];
        }),
      ),
      loadDataset(files.dataset),
      loadDataset(files.gdpDataset),
      loadDataset(files.plotPoints),
      loadDataset(files.relationshipDiagnostics),
      loadDataset(files.summary),
      loadDataset(files.fit),
      loadDataset(workbookDataFiles.marketBalance),
      loadDataset(workbookDataFiles.demandComponents),
      loadDataset(workbookDataFiles.majorMines),
      loadDataset(workbookDataFiles.mineSupplyCountry),
      loadDataset(icsgDataFiles.forecast),
      loadDataset(icsgDataFiles.regional),
    ]);

  const state = {
    scenarios: Object.fromEntries(scenarioEntries),
    regression: {
      dataset: regressionDataset,
      gdpDataset: regressionGdpDataset,
      plotPoints: regressionPlotPoints,
      relationshipDiagnostics,
      summary: regressionSummary,
      fit: regressionFit,
    },
    workbook: {
      marketBalance: workbookMarketBalance,
      demandComponents: workbookDemandComponents,
      majorMines: workbookMajorMines,
      mineSupplyCountry: workbookMineSupplyCountry,
    },
    icsg: {
      forecast: icsgForecast,
      regional: icsgRegional,
    },
    selectedScenarioId: "base_case",
  };
  const scenarioSelect = document.getElementById("scenarioSelect");
  scenarioSelect.addEventListener("change", () => {
    state.selectedScenarioId = scenarioSelect.value;
    render(state);
  });
  const yearRange = document.getElementById("yearRange");
  yearRange.addEventListener("input", () => render(state));
  window.addEventListener("resize", () => render(state));
  setupTabNavigation();
  renderRegressionTab(state.regression);
  renderWorkbookTab(state.workbook);
  renderIcsgTab(state.icsg);
  render(state);
}

init().catch((error) => {
  document.body.innerHTML = `<main class="app-shell"><section class="panel"><h1>Dashboard data unavailable</h1><p>${error.message}</p></section></main>`;
});
