"""Forecast engine for the global copper supply-demand model."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

GDP = "gdp_constant_usd"
INDUSTRY = "industry_value_added_constant_usd"
INDUSTRY_SHARE = "industry_value_added_share_of_gdp"
POPULATION = "population"


@dataclass(frozen=True)
class ModelOutputs:
    forecast: pd.DataFrame
    regional_demand: pd.DataFrame
    mine_supply_by_country: pd.DataFrame


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

    gdp_growth = _cagr(float(start[GDP]), float(end[GDP]), periods)
    industry_growth = _cagr(float(start[INDUSTRY]), float(end[INDUSTRY]), periods)
    population_growth = _cagr(float(start[POPULATION]), float(end[POPULATION]), periods)
    return {
        "industry": industry_growth,
        "gdp_per_capita": gdp_growth - population_growth,
        "population": population_growth,
    }


def estimate_regional_demand_growth(
    config: dict[str, Any], macro: pd.DataFrame | None
) -> pd.DataFrame:
    """Estimate demand growth by region from public macro data."""

    demand_config = config["demand"]
    weights = demand_config["driver_weights"]
    lookback = int(demand_config["macro_lookback_years"])
    floor = float(demand_config["growth_floor"])
    cap = float(demand_config["growth_cap"])
    shock = float(demand_config["scenario_growth_shock"])

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
        raw_growth = (
            float(weights["industry_value_added"]) * growth["industry"]
            + float(weights["gdp_per_capita"]) * growth["gdp_per_capita"]
            + float(weights["population"]) * growth["population"]
            + float(region_config["transition_growth_bonus"])
            + shock
        )
        demand_growth = _clip(raw_growth, floor, cap)
        rows.append(
            {
                "region": region,
                "world_bank_code": country_code,
                "industry_growth": growth["industry"],
                "gdp_per_capita_growth": growth["gdp_per_capita"],
                "population_growth": growth["population"],
                "industry_contribution": float(weights["industry_value_added"])
                * growth["industry"],
                "gdp_per_capita_contribution": float(weights["gdp_per_capita"])
                * growth["gdp_per_capita"],
                "population_contribution": float(weights["population"])
                * growth["population"],
                "transition_bonus": float(region_config["transition_growth_bonus"]),
                "scenario_shock": shock,
                "raw_demand_growth": raw_growth,
                "clip_adjustment": demand_growth - raw_growth,
                "demand_growth": demand_growth,
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

    seed_global = pd.read_csv(data_dir / "seed" / "usgs_mcs_2025_global_balance.csv")
    seed_country = pd.read_csv(data_dir / "seed" / "usgs_mcs_2025_country_supply.csv")

    base_year = int(config["base_year"])
    end_year = int(config["forecast_end_year"])
    years = list(range(base_year, end_year + 1))

    regional_growth = estimate_regional_demand_growth(config, macro)
    demand_config = config["demand"]
    supply_config = config["supply"]
    secondary_config = config["secondary_supply"]

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
    growth_by_region = regional_growth.set_index("region")["demand_growth"].to_dict()
    growth_detail_by_region = regional_growth.set_index("region").to_dict("index")

    global_rows: list[dict[str, object]] = []
    primary_refined = float(supply_config["refinery_production_kt"]) * float(
        supply_config["primary_refined_share"]
    )
    secondary_refined = float(supply_config["refinery_production_kt"]) - primary_refined
    mine_supply = float(supply_config["mine_production_kt"])

    for year in years:
        secondary_growth = 0.0
        if year > base_year:
            for region in demand_by_region:
                demand_by_region[region] *= 1 + float(growth_by_region[region])

            global_demand_growth = np.average(
                [growth_by_region[region] for region in demand_by_region],
                weights=[demand_by_region[region] for region in demand_by_region],
            )
            mine_supply *= 1 + primary_growth
            primary_refined *= 1 + primary_growth
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

        for region, demand_kt in demand_by_region.items():
            regional_demand_rows.append(
                {
                    "scenario": config["scenario_name"],
                    "year": year,
                    "region": region,
                    "demand_kt": demand_kt,
                    "growth_rate": growth_by_region[region],
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
                "secondary_supply_growth": secondary_growth,
            }
        )

    country_supply = _allocate_mine_supply_by_country(
        seed_country, pd.DataFrame(global_rows), config["scenario_name"]
    )
    return ModelOutputs(
        forecast=pd.DataFrame(global_rows),
        regional_demand=pd.DataFrame(regional_demand_rows),
        mine_supply_by_country=country_supply,
    )


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
    ]
    outputs.forecast.to_csv(paths[0], index=False)
    outputs.regional_demand.to_csv(paths[1], index=False)
    outputs.mine_supply_by_country.to_csv(paths[2], index=False)
    return paths
