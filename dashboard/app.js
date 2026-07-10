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

function scenarioFiles(id) {
  return {
    config: `/config/${id}.json`,
    forecast: `/outputs/${id}_forecast.csv`,
    regional: `/outputs/${id}_regional_demand.csv`,
    mine: `/outputs/${id}_mine_supply_by_country.csv`,
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

function updateMetrics(row) {
  document.getElementById("selectedYearLabel").textContent = row.year;
  document.getElementById("metricDemand").textContent = formatKt(row.demand_kt);
  document.getElementById("metricSupply").textContent = formatKt(row.refined_supply_kt);
  document.getElementById("metricBalance").textContent = formatSignedKt(row.market_balance_kt);
  document.getElementById("balanceBadge").textContent = `${formatSignedKt(row.market_balance_kt)} kt`;
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
      format: (config) => `${formatKt(config.demand.global_refined_demand_kt)} kt in ${config.base_year}`,
    },
    {
      label: "Regional demand shares",
      format: (config) =>
        Object.entries(config.demand.regions)
          .map(([name, region]) => `${name}: ${formatPct(region.share, 0)}`)
          .join("; "),
    },
    {
      label: "Demand driver weights",
      format: (config) =>
        `industry ${formatPct(config.demand.driver_weights.industry_value_added, 0)}, income ${formatPct(
          config.demand.driver_weights.gdp_per_capita,
          0,
        )}, population ${formatPct(config.demand.driver_weights.population, 0)}`,
    },
    {
      label: "Extra demand shock",
      format: (config) => `${formatSignedPct(config.demand.scenario_growth_shock)} per year`,
    },
    {
      label: "Energy-transition bonus",
      format: (config) => `${formatPct(averageTransitionBonus(config))} weighted average per year`,
      detail: regionBonusText,
    },
    {
      label: "Demand growth cap",
      format: (config) =>
        `${formatPct(config.demand.growth_floor)} floor, ${formatPct(config.demand.growth_cap)} cap`,
    },
    {
      label: "Primary / secondary refined split",
      format: (config) =>
        `${formatPct(config.supply.primary_refined_share, 0)} primary, ${formatPct(
          1 - config.supply.primary_refined_share,
          0,
        )} secondary`,
    },
    {
      label: "Mine/refinery project growth",
      format: (config) => `${formatPct(config.supply.project_pipeline_growth)} per year`,
    },
    {
      label: "Disruption loss",
      format: (config) => `${formatPct(config.supply.disruption_loss)} per year`,
    },
    {
      label: "Secondary supply demand link",
      format: (config) =>
        `${formatPct(config.secondary_supply.demand_link, 0)} of demand growth flows into secondary supply growth`,
    },
    {
      label: "Secondary collection growth",
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
      return `<tr><td>${row.label}</td>${cells}</tr>`;
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
  renderScenarioExplanation(state);
  updateMetrics(selectedForecast);
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
