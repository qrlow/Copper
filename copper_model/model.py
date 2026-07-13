"""Forecast engine for the global copper supply-demand model."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from copper_model.supply import build_supply_forecast

GDP = "gdp_constant_usd"
INDUSTRY = "industry_value_added_constant_usd"
INDUSTRY_SHARE = "industry_value_added_share_of_gdp"
POPULATION = "population"


@dataclass(frozen=True)
class ModelOutputs:
    forecast: pd.DataFrame
    regional_demand: pd.DataFrame
    mine_supply_by_country: pd.DataFrame
    supply_asset_forecast: pd.DataFrame
    supply_summary: pd.DataFrame
    supply_conversion_bridge: pd.DataFrame
    supply_sources: pd.DataFrame


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_public_data(data_dir: Path) -> pd.DataFrame | None:
    raw_dir = data_dir / "raw"
    macro_path = raw_dir / "world_bank_indicators.csv"

    return pd.read_csv(macro_path) if macro_path.exists() else None


def _cagr(start: float, end: float, periods: int) -> float:
    if periods <= 0 or start <= 0 or end <= 0:
        return 0.0
    return float((end / start) ** (1 / periods) - 1)


def _clip(value: float, lower: float, upper: float) -> float:
    return float(min(max(value, lower), upper))


def _linear_phase(year: int, start_year: int, end_year: int) -> float:
    if year < start_year:
        return 0.0
    if year >= end_year:
        return 1.0
    return float((year - start_year + 1) / max(end_year - start_year + 1, 1))


def _pivot_macro(macro: pd.DataFrame) -> pd.DataFrame:
    pivot = macro.pivot_table(
        index=["country_code", "year"],
        columns="indicator",
        values="value",
        aggfunc="first",
    ).reset_index()
    pivot.columns.name = None
    if INDUSTRY not in pivot.columns and {GDP, INDUSTRY_SHARE}.issubset(pivot.columns):
        pivot[INDUSTRY] = pivot[GDP] * pivot[INDUSTRY_SHARE] / 100.0
    return pivot


def _add_rest_of_world(pivot: pd.DataFrame) -> pd.DataFrame:
    required = {"WLD", "CHN", "USA", "EUU"}
    present = set(pivot["country_code"].unique())
    if not required.issubset(present):
        return pivot

    rows: list[dict[str, float | int | str]] = []
    for year, year_data in pivot.groupby("year"):
        by_code = year_data.set_index("country_code")
        if not required.issubset(set(by_code.index)):
            continue
        row: dict[str, float | int | str] = {"country_code": "ROW", "year": int(year)}
        for indicator in [GDP, INDUSTRY, POPULATION]:
            row[indicator] = float(
                by_code.loc["WLD", indicator]
                - by_code.loc["CHN", indicator]
                - by_code.loc["USA", indicator]
                - by_code.loc["EUU", indicator]
            )
        rows.append(row)

    if not rows:
        return pivot
    return pd.concat([pivot, pd.DataFrame(rows)], ignore_index=True, sort=False)


def _macro_growth_for_code(
    pivot: pd.DataFrame,
    country_code: str,
    lookback_years: int,
) -> dict[str, float]:
    country = pivot[pivot["country_code"] == country_code].dropna(
        subset=[GDP, INDUSTRY, POPULATION]
    )
    if country.empty:
        return {"industry": 0.02, "gdp_per_capita": 0.015, "population": 0.005}

    country = country.sort_values("year")
    end = country.iloc[-1]
    start_year = int(end["year"]) - lookback_years
    start_candidates = country[country["year"] <= start_year]
    start = start_candidates.iloc[-1] if not start_candidates.empty else country.iloc[0]
    periods = max(int(end["year"] - start["year"]), 1)

    industry_growth = _cagr(float(start[INDUSTRY]), float(end[INDUSTRY]), periods)
    population_growth = _cagr(float(start[POPULATION]), float(end[POPULATION]), periods)
    start_gdp_per_capita = float(start[GDP]) / float(start[POPULATION])
    end_gdp_per_capita = float(end[GDP]) / float(end[POPULATION])
    gdp_per_capita_growth = _cagr(start_gdp_per_capita, end_gdp_per_capita, periods)
    return {
        "industry": industry_growth,
        "gdp_per_capita": gdp_per_capita_growth,
        "population": population_growth,
    }


def _demand_growth_components(
    demand_config: dict[str, Any],
    region_config: dict[str, Any],
    macro_growth: dict[str, float],
    year: int,
) -> dict[str, float]:
    weights = demand_config["driver_weights"]
    industry_contribution = float(weights["industry_value_added"]) * macro_growth["industry"]
    gdp_per_capita_contribution = (
        float(weights["gdp_per_capita"]) * macro_growth["gdp_per_capita"]
    )
    population_contribution = float(weights["population"]) * macro_growth["population"]
    transition_bonus = float(region_config.get("transition_growth_bonus", 0.0))
    scenario_shock = float(demand_config["scenario_growth_shock"])

    property_drag = float(region_config.get("property_downturn_drag", 0.0)) * _linear_phase(
        year,
        int(region_config.get("property_downturn_start_year", year)),
        int(region_config.get("property_downturn_end_year", year)),
    )
    substitution_drag = float(
        region_config.get("substitution_drag", demand_config.get("substitution_drag", 0.0))
    )
    raw_growth = (
        industry_contribution
        + gdp_per_capita_contribution
        + population_contribution
        + transition_bonus
        + scenario_shock
        + property_drag
        + substitution_drag
    )
    demand_growth = _clip(
        raw_growth,
        float(demand_config["growth_floor"]),
        float(demand_config["growth_cap"]),
    )
    return {
        "industry_contribution": industry_contribution,
        "gdp_per_capita_contribution": gdp_per_capita_contribution,
        "population_contribution": population_contribution,
        "transition_bonus": transition_bonus,
        "scenario_shock": scenario_shock,
        "property_downturn_drag": property_drag,
        "substitution_drag": substitution_drag,
        "raw_demand_growth": raw_growth,
        "clip_adjustment": demand_growth - raw_growth,
        "demand_growth": demand_growth,
    }


def estimate_regional_demand_growth(
    config: dict[str, Any], macro: pd.DataFrame | None
) -> pd.DataFrame:
    """Estimate demand growth by region from public macro data."""

    demand_config = config["demand"]
    lookback = int(demand_config["macro_lookback_years"])
    display_year = int(config.get("base_year", 2024)) + 1

    if macro is None or macro.empty:
        pivot = pd.DataFrame()
    else:
        pivot = _add_rest_of_world(_pivot_macro(macro))

    rows: list[dict[str, object]] = []
    for region, region_config in demand_config["regions"].items():
        country_code = region_config["world_bank_code"]
        growth = (
            _macro_growth_for_code(pivot, country_code, lookback)
            if not pivot.empty
            else {"industry": 0.02, "gdp_per_capita": 0.015, "population": 0.005}
        )
        components = _demand_growth_components(
            demand_config, region_config, growth, display_year
        )
        rows.append(
            {
                "region": region,
                "world_bank_code": country_code,
                "industry_growth": growth["industry"],
                "gdp_per_capita_growth": growth["gdp_per_capita"],
                "population_growth": growth["population"],
                **components,
            }
        )
    return pd.DataFrame(rows)


def _recent_supply_growth(seed_global: pd.DataFrame, config: dict[str, Any]) -> float:
    ordered = seed_global.sort_values("year")
    if len(ordered) < 2:
        return 0.015
    start = float(ordered.iloc[-2]["mine_production_kt"])
    end = float(ordered.iloc[-1]["mine_production_kt"])
    growth = _cagr(start, end, 1)
    return _clip(
        growth,
        float(config["supply"]["recent_growth_floor"]),
        float(config["supply"]["recent_growth_cap"]),
    )


def run_model(
    config: dict[str, Any],
    data_dir: Path,
    macro: pd.DataFrame | None = None,
) -> ModelOutputs:
    if macro is None:
        macro = load_public_data(data_dir)

    seed_global = pd.read_csv(data_dir / "seed" / "usgs_mcs_global_balance.csv")
    seed_country = pd.read_csv(data_dir / "seed" / "usgs_mcs_2025_country_supply.csv")

    base_year = int(config["base_year"])
    end_year = int(config["forecast_end_year"])
    years = list(range(base_year, end_year + 1))

    regional_growth = estimate_regional_demand_growth(config, macro)
    demand_config = config["demand"]
    supply_config = config["supply"]
    secondary_config = config["secondary_supply"]
    supply_outputs = build_supply_forecast(config, data_dir, years)
    supply_by_year = supply_outputs.summary.set_index("year")

    recent_supply_growth = _recent_supply_growth(seed_global, config)
    primary_growth = (
        recent_supply_growth
        + float(supply_config["project_pipeline_growth"])
        - float(supply_config["disruption_loss"])
    )

    regional_demand_rows: list[dict[str, object]] = []
    demand_by_region = {
        region: float(demand_config["global_refined_demand_kt"]) * float(cfg["share"])
        for region, cfg in demand_config["regions"].items()
    }
    macro_growth_by_region = regional_growth.set_index("region")[
        ["industry_growth", "gdp_per_capita_growth", "population_growth"]
    ].to_dict("index")
    region_configs = demand_config["regions"]

    global_rows: list[dict[str, object]] = []
    primary_refined = float(supply_by_year.loc[base_year, "primary_refined_supply_kt"])
    secondary_refined = float(supply_config["refinery_production_kt"]) - primary_refined
    mine_supply = float(supply_by_year.loc[base_year, "mine_supply_kt"])

    for year in years:
        growth_detail_by_region = {
            region: _demand_growth_components(
                demand_config,
                region_configs[region],
                {
                    "industry": float(macro_growth["industry_growth"]),
                    "gdp_per_capita": float(macro_growth["gdp_per_capita_growth"]),
                    "population": float(macro_growth["population_growth"]),
                },
                year if year > base_year else base_year + 1,
            )
            for region, macro_growth in macro_growth_by_region.items()
        }
        secondary_growth = 0.0
        if year > base_year:
            for region in demand_by_region:
                demand_by_region[region] *= 1 + float(
                    growth_detail_by_region[region]["demand_growth"]
                )

            global_demand_growth = np.average(
                [
                    growth_detail_by_region[region]["demand_growth"]
                    for region in demand_by_region
                ],
                weights=[demand_by_region[region] for region in demand_by_region],
            )
            secondary_growth = (
                float(secondary_config["demand_link"]) * float(global_demand_growth)
                + float(secondary_config["collection_growth"])
            )
            secondary_growth = _clip(
                secondary_growth,
                float(secondary_config["growth_floor"]),
                float(secondary_config["growth_cap"]),
            )
            secondary_refined *= 1 + secondary_growth

        supply_row = supply_by_year.loc[year]
        mine_supply = float(supply_row["mine_supply_kt"])
        primary_refined = float(supply_row["primary_refined_supply_kt"])
        for region, demand_kt in demand_by_region.items():
            regional_demand_rows.append(
                {
                    "scenario": config["scenario_name"],
                    "year": year,
                    "region": region,
                    "demand_kt": demand_kt,
                    "growth_rate": growth_detail_by_region[region]["demand_growth"],
                    "industry_contribution": growth_detail_by_region[region][
                        "industry_contribution"
                    ],
                    "gdp_per_capita_contribution": growth_detail_by_region[region][
                        "gdp_per_capita_contribution"
                    ],
                    "population_contribution": growth_detail_by_region[region][
                        "population_contribution"
                    ],
                    "transition_bonus": growth_detail_by_region[region][
                        "transition_bonus"
                    ],
                    "property_downturn_drag": growth_detail_by_region[region][
                        "property_downturn_drag"
                    ],
                    "substitution_drag": growth_detail_by_region[region][
                        "substitution_drag"
                    ],
                    "scenario_shock": growth_detail_by_region[region]["scenario_shock"],
                    "raw_demand_growth": growth_detail_by_region[region][
                        "raw_demand_growth"
                    ],
                    "clip_adjustment": growth_detail_by_region[region][
                        "clip_adjustment"
                    ],
                }
            )

        demand = sum(demand_by_region.values())
        refined_supply = primary_refined + secondary_refined
        balance = refined_supply - demand

        global_rows.append(
            {
                "scenario": config["scenario_name"],
                "year": year,
                "demand_kt": demand,
                "mine_supply_kt": mine_supply,
                "primary_refined_supply_kt": primary_refined,
                "secondary_refined_supply_kt": secondary_refined,
                "refined_supply_kt": refined_supply,
                "market_balance_kt": balance,
                "primary_supply_growth": primary_growth,
                "supply_model_primary_growth": float(supply_row["primary_supply_growth"]),
                "secondary_supply_growth": secondary_growth,
            }
        )

    forecast = pd.DataFrame(global_rows)
    forecast["primary_supply_growth"] = forecast["supply_model_primary_growth"]
    conversion_bridge = _build_supply_conversion_bridge(
        supply_outputs.summary, forecast, config["scenario_name"]
    )
    supply_summary = supply_outputs.summary.merge(
        forecast[
            [
                "scenario",
                "year",
                "secondary_refined_supply_kt",
                "refined_supply_kt",
                "market_balance_kt",
            ]
        ],
        on=["scenario", "year"],
        how="left",
    )
    country_supply = _allocate_mine_supply_by_country(
        seed_country, forecast, config["scenario_name"]
    )
    return ModelOutputs(
        forecast=forecast,
        regional_demand=pd.DataFrame(regional_demand_rows),
        mine_supply_by_country=country_supply,
        supply_asset_forecast=supply_outputs.asset_forecast,
        supply_summary=supply_summary,
        supply_conversion_bridge=conversion_bridge,
        supply_sources=supply_outputs.sources,
    )


def _build_supply_conversion_bridge(
    supply_summary: pd.DataFrame, forecast: pd.DataFrame, scenario: str
) -> pd.DataFrame:
    forecast_by_year = forecast.set_index("year")
    rows: list[dict[str, object]] = []
    for item in supply_summary.itertuples(index=False):
        forecast_row = forecast_by_year.loc[int(item.year)]
        bridge_steps = [
            {
                "step_order": 1,
                "step": "Risk-adjusted mine supply",
                "kt": float(item.mine_supply_kt),
                "note": "Reported operating output plus configured probability-weighted project and expansion output.",
            },
            {
                "step_order": 2,
                "step": "Payable / route calibration",
                "kt": float(item.primary_refined_before_constraints_kt)
                - float(item.mine_supply_kt),
                "note": "Calibrates mine copper content to the 2024 ICSG primary refined anchor before bottlenecks.",
            },
            {
                "step_order": 3,
                "step": "Smelter / refinery constraint",
                "kt": -float(item.smelter_refinery_constraint_kt),
                "note": "Loss when concentrate availability exceeds configured processing capacity growth.",
            },
            {
                "step_order": 4,
                "step": "Blending / maintenance constraint",
                "kt": -float(item.blending_constraint_kt),
                "note": "Configured allowance for concentrate quality; blending; planned conversion downtime.",
            },
            {
                "step_order": 5,
                "step": "Primary refined supply",
                "kt": float(item.primary_refined_supply_kt),
                "note": "Mine-linked refined output after conversion constraints.",
            },
            {
                "step_order": 6,
                "step": "Secondary refined supply",
                "kt": float(forecast_row.secondary_refined_supply_kt),
                "note": "Scrap/recycled supply from the model's secondary-supply rule.",
            },
            {
                "step_order": 7,
                "step": "Total refined supply",
                "kt": float(forecast_row.refined_supply_kt),
                "note": "Primary refined supply plus secondary refined supply used in the Model tab.",
            },
        ]
        for step in bridge_steps:
            rows.append({"scenario": scenario, "year": int(item.year), **step})
    return pd.DataFrame(rows)


def _allocate_mine_supply_by_country(
    seed_country: pd.DataFrame, forecast: pd.DataFrame, scenario: str
) -> pd.DataFrame:
    country = seed_country[seed_country["country"] != "World total"].copy()
    base_total = float(country["mine_production_2024_kt"].sum())
    country["share_2024"] = country["mine_production_2024_kt"] / base_total

    rows: list[dict[str, object]] = []
    for item in forecast.itertuples(index=False):
        for country_item in country.itertuples(index=False):
            rows.append(
                {
                    "scenario": scenario,
                    "year": int(item.year),
                    "country": country_item.country,
                    "mine_supply_kt": float(item.mine_supply_kt)
                    * float(country_item.share_2024),
                    "share_2024": float(country_item.share_2024),
                }
            )
    return pd.DataFrame(rows)


def write_outputs(outputs: ModelOutputs, output_dir: Path, scenario: str) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        output_dir / f"{scenario}_forecast.csv",
        output_dir / f"{scenario}_regional_demand.csv",
        output_dir / f"{scenario}_mine_supply_by_country.csv",
        output_dir / f"{scenario}_supply_assets.csv",
        output_dir / f"{scenario}_supply_summary.csv",
        output_dir / f"{scenario}_supply_conversion_bridge.csv",
        output_dir / f"{scenario}_supply_sources.csv",
    ]
    outputs.forecast.to_csv(paths[0], index=False)
    outputs.regional_demand.to_csv(paths[1], index=False)
    outputs.mine_supply_by_country.to_csv(paths[2], index=False)
    outputs.supply_asset_forecast.to_csv(paths[3], index=False)
    outputs.supply_summary.to_csv(paths[4], index=False)
    outputs.supply_conversion_bridge.to_csv(paths[5], index=False)
    outputs.supply_sources.to_csv(paths[6], index=False)
    return paths
