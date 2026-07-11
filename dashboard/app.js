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

const DATA_VERSION = "2026-07-11-driver-breakdowns";
const APP_ROOT = new URL("../", window.location.href);

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

const sourceUrls = {
  icsgFactbook: "https://icsg.org/copper-factbook/",
  usgsCopper:
    "https://pubs.usgs.gov/periodicals/mcs2026/mcs2026.pdf",
  ieaCriticalMinerals:
    "https://www.iea.org/reports/global-critical-minerals-outlook-2025",
  worldBankGdp: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD",
  worldBankIndustry: "https://data.worldbank.org/indicator/NV.IND.TOTL.ZS",
  worldBankPopulation: "https://data.worldbank.org/indicator/SP.POP.TOTL",
  baseConfig: appUrl("config/base_case.json"),
  bullConfig: appUrl("config/bull_case.json"),
  bearConfig: appUrl("config/bear_case.json"),
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

  const recentSupplyGrowth =
    forecastRow.primary_supply_growth -
    Number(config.supply.project_pipeline_growth) +
    Number(config.supply.disruption_loss);
  const primaryRows = [
    {
      label: "Recent supply growth",
      detail: "USGS mine-production growth, clipped by scenario bounds",
      value: recentSupplyGrowth,
    },
    {
      label: "Project pipeline growth",
      detail: "scenario assumption for added mine/refinery supply",
      value: Number(config.supply.project_pipeline_growth),
    },
    {
      label: "Disruption loss",
      detail: "subtracted from primary supply growth",
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
        "ICSG Factbook 2025 reports 2024 refined copper usage at 27.4 Mt. The model stores that as 27,400 kt.",
        [sourceLink("ICSG usage", sourceUrls.icsgFactbook), ...configLinkItems()],
      ),
      format: (config) => `${formatKt(config.demand.global_refined_demand_kt)} kt in ${config.base_year}`,
    },
    {
      label: "Starting mine/refinery supply",
      source: sourceNote(
        "USGS Mineral Commodity Summaries 2026 reports 2024 world mine production at 23,000 kt and refinery production at 27,600 kt.",
        [sourceLink("USGS copper table", sourceUrls.usgsCopper), ...configLinkItems()],
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
        "World Bank GDP, industry-share, and population indicators are the public drivers. The model converts them into fixed 10-year historical CAGRs: industry activity is real GDP times industry share, GDP per capita is real GDP per person, and population is total population. The weights are model judgment, with industry largest because copper use is concentrated in industrial, construction, electrical, and infrastructure activity.",
        [
          sourceLink("GDP", sourceUrls.worldBankGdp),
          sourceLink("Industry share", sourceUrls.worldBankIndustry),
          sourceLink("Population", sourceUrls.worldBankPopulation),
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
        "IEA provides copper demand and supply outlooks across energy-transition scenarios. The dashboard uses that as the reason for a transition-demand bonus; the exact annual bonus is a model assumption.",
        [sourceLink("IEA copper outlook", sourceUrls.ieaCriticalMinerals), ...configLinkItems()],
      ),
      format: (config) => `${formatPct(averageTransitionBonus(config))} weighted average per year`,
      detail: regionBonusText,
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
        "ICSG refinery-capacity data says capacity is expected to grow through 2028, but capacity is not the same as production. The annual production-growth number here is a conservative scenario assumption.",
        [sourceLink("ICSG capacity trends", sourceUrls.icsgFactbook), ...configLinkItems()],
      ),
      format: (config) => `${formatPct(config.supply.project_pipeline_growth)} per year`,
    },
    {
      label: "Disruption loss",
      source: sourceNote(
        "ICSG highlights constraints on copper supply. The loss percentage is a scenario stress assumption for outages, grades, delays, and operating disruption.",
        [sourceLink("ICSG supply constraints", sourceUrls.icsgFactbook), ...configLinkItems()],
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
  const scenarioEntries = await Promise.all(
    SCENARIOS.map(async (scenario) => {
      const files = scenarioFiles(scenario.id);
      const [config, forecast, regional, mine] = await Promise.all([
        loadJson(files.config),
        loadDataset(files.forecast),
        loadDataset(files.regional),
        loadDataset(files.mine),
      ]);
      return [scenario.id, { ...scenario, files, config, forecast, regional, mine }];
    }),
  );

  const state = {
    scenarios: Object.fromEntries(scenarioEntries),
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
  render(state);
}

init().catch((error) => {
  document.body.innerHTML = `<main class="app-shell"><section class="panel"><h1>Dashboard data unavailable</h1><p>${error.message}</p></section></main>`;
});
