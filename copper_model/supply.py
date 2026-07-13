"""Mine supply and refined-supply conversion model."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


BASE_PROJECT_PIPELINE_GROWTH = 0.006
BASE_DISRUPTION_LOSS = 0.003
CONCENTRATE_SHARE_OF_PRIMARY = 0.655 / (0.655 + 0.174)
SXEW_SHARE_OF_PRIMARY = 1 - CONCENTRATE_SHARE_OF_PRIMARY


@dataclass(frozen=True)
class SupplyOutputs:
    asset_forecast: pd.DataFrame
    summary: pd.DataFrame
    sources: pd.DataFrame


def _clip(value: float, lower: float, upper: float) -> float:
    return float(min(max(value, lower), upper))


def _load_assets(data_dir: Path) -> pd.DataFrame:
    path = data_dir / "seed" / "global_copper_supply_assets.csv"
    return pd.read_csv(path)


def _load_disruptions(data_dir: Path) -> pd.DataFrame:
    path = data_dir / "seed" / "global_copper_supply_disruptions.csv"
    return pd.read_csv(path) if path.exists() else pd.DataFrame()


def _scenario_probability_multiplier(config: dict[str, Any]) -> float:
    project_growth = float(config["supply"]["project_pipeline_growth"])
    return _clip(1 + (project_growth - BASE_PROJECT_PIPELINE_GROWTH) / 0.02, 0.75, 1.25)


def _scenario_disruption_multiplier(config: dict[str, Any]) -> float:
    disruption_loss = float(config["supply"]["disruption_loss"])
    return _clip(disruption_loss / BASE_DISRUPTION_LOSS, 0.25, 2.5)


def _scenario_rest_of_world_growth(config: dict[str, Any]) -> float:
    supply_config = config["supply"]
    if "rest_of_world_growth" in supply_config:
        return float(supply_config["rest_of_world_growth"])
    project_growth = float(config["supply"]["project_pipeline_growth"])
    disruption_loss = float(config["supply"]["disruption_loss"])
    return _clip(0.002 + 0.35 * project_growth - 0.25 * disruption_loss, -0.006, 0.010)


def _gross_asset_output(row: pd.Series, year: int, base_year: int) -> float:
    base = float(row["production_2024_kt"])
    target = float(row["nameplate_2030_kt"])
    status = str(row["status"])
    start_year = int(row["start_year"])
    ramp_years = max(int(row["ramp_years"]), 1)

    if year <= base_year:
        return base

    if status == "operating":
        ramp = _clip((year - base_year) / max(2030 - base_year, 1), 0.0, 1.0)
        return base + (target - base) * ramp

    if status == "expansion":
        if year < start_year:
            return base
        ramp = _clip((year - start_year + 1) / ramp_years, 0.0, 1.0)
        return base + (target - base) * ramp

    if year < start_year:
        return base
    ramp = _clip((year - start_year + 1) / ramp_years, 0.0, 1.0)
    return target * ramp


def _asset_route_split(route: str, output_kt: float) -> tuple[float, float]:
    if route == "sxew":
        return 0.0, output_kt
    if route == "mixed":
        return output_kt * 0.75, output_kt * 0.25
    return output_kt, 0.0


def build_supply_forecast(
    config: dict[str, Any],
    data_dir: Path,
    years: list[int],
) -> SupplyOutputs:
    """Build a risk-adjusted mine supply forecast and primary-refined bridge."""

    assets = _load_assets(data_dir)
    disruptions = _load_disruptions(data_dir)
    base_year = int(config["base_year"])
    probability_multiplier = _scenario_probability_multiplier(config)
    disruption_multiplier = _scenario_disruption_multiplier(config)
    rest_growth = _scenario_rest_of_world_growth(config)
    supply_config = config["supply"]
    project_risk_discount_factor = _clip(
        float(supply_config.get("project_risk_discount_factor", 1.0)), 0.0, 1.0
    )
    maintenance_loss_multiplier = float(
        supply_config.get("maintenance_loss_multiplier", 1.0)
    )
    concentrate_capacity_growth = float(
        supply_config.get("concentrate_processing_capacity_growth", 0.012)
    )
    smelter_constraint_capture_rate = float(
        supply_config.get("smelter_constraint_capture_rate", 0.70)
    )
    blending_constraint_pct = float(supply_config.get("blending_constraint_pct", 0.0025))

    disruption_lookup: dict[tuple[str, int], float] = {}
    if not disruptions.empty:
        for item in disruptions.itertuples(index=False):
            disruption_lookup[(str(item.asset), int(item.year))] = float(item.impact_kt)

    asset_rows: list[dict[str, object]] = []
    for row in assets.to_dict("records"):
        asset = str(row["asset"])
        base_output = float(row["production_2024_kt"])
        probability = float(row["project_probability"])
        if str(row["status"]) in {"project", "expansion", "suspended"}:
            probability = _clip(probability * probability_multiplier, 0.0, 1.0)
            probability = _clip(
                1 - ((1 - probability) * project_risk_discount_factor), 0.0, 1.0
            )

        for year in years:
            gross = _gross_asset_output(pd.Series(row), year, base_year)
            incremental = max(gross - base_output, 0.0)
            stable_base = gross - incremental
            probability_discount = incremental * (1 - probability)
            risk_adjusted_before_losses = stable_base + incremental * probability
            maintenance_loss = (
                0.0
                if year == base_year
                else risk_adjusted_before_losses
                * float(row["maintenance_allowance_pct"])
                * maintenance_loss_multiplier
            )
            disruption_loss = (
                disruption_lookup.get((asset, year), 0.0) * disruption_multiplier
                if year > base_year
                else 0.0
            )
            achievable = max(risk_adjusted_before_losses - maintenance_loss - disruption_loss, 0.0)
            concentrate_kt, sxew_kt = _asset_route_split(str(row["route"]), achievable)
            contained_from_formula = None
            if pd.notna(row["grade_pct"]) and pd.notna(row["recovery_pct"]):
                grade = float(row["grade_pct"])
                recovery = float(row["recovery_pct"]) / 100.0
                if grade > 0 and recovery > 0:
                    ore_processed_mt = achievable / (grade * recovery * 10)
                    contained_from_formula = ore_processed_mt * grade * recovery * 10

            asset_rows.append(
                {
                    "scenario": config["scenario_name"],
                    "asset": asset,
                    "country": row["country"],
                    "operator": row["operator"],
                    "supply_bucket": row["supply_bucket"],
                    "production_type": row["production_type"],
                    "route": row["route"],
                    "status": row["status"],
                    "year": year,
                    "gross_nameplate_kt": gross,
                    "risk_adjusted_before_losses_kt": risk_adjusted_before_losses,
                    "maintenance_loss_kt": maintenance_loss,
                    "disruption_loss_kt": disruption_loss,
                    "project_probability_discount_kt": probability_discount,
                    "risk_adjusted_mine_supply_kt": achievable,
                    "concentrate_supply_kt": concentrate_kt,
                    "sxew_supply_kt": sxew_kt,
                    "project_probability": probability,
                    "technical_capacity_kt": float(row["technical_capacity_kt"]),
                    "grade_pct": float(row["grade_pct"]),
                    "recovery_pct": float(row["recovery_pct"]),
                    "contained_formula_check_kt": contained_from_formula,
                    "political_risk": row["political_risk"],
                    "permitting_risk": row["permitting_risk"],
                    "infrastructure_risk": row["infrastructure_risk"],
                    "source_name": row["source_name"],
                    "source_url": row["source_url"],
                    "assumption_note": row["assumption_note"],
                }
            )

    asset_forecast = pd.DataFrame(asset_rows)
    base_asset_total = float(
        asset_forecast[asset_forecast["year"] == base_year]["risk_adjusted_mine_supply_kt"].sum()
    )
    global_mine_base = float(config["supply"]["mine_production_kt"])
    rest_base = max(global_mine_base - base_asset_total, 0.0)

    rest_rows: list[dict[str, object]] = []
    for year in years:
        periods = year - base_year
        rest_output = rest_base * ((1 + rest_growth) ** periods)
        concentrate_kt = rest_output * CONCENTRATE_SHARE_OF_PRIMARY
        sxew_kt = rest_output * SXEW_SHARE_OF_PRIMARY
        rest_rows.append(
            {
                "scenario": config["scenario_name"],
                "asset": "Rest of World aggregate",
                "country": "Rest of World",
                "operator": "Multiple",
                "supply_bucket": "Other operating mines",
                "production_type": "mixed",
                "route": "mixed",
                "status": "operating",
                "year": year,
                "gross_nameplate_kt": rest_output,
                "risk_adjusted_before_losses_kt": rest_output,
                "maintenance_loss_kt": 0.0,
                "disruption_loss_kt": 0.0,
                "project_probability_discount_kt": 0.0,
                "risk_adjusted_mine_supply_kt": rest_output,
                "concentrate_supply_kt": concentrate_kt,
                "sxew_supply_kt": sxew_kt,
                "project_probability": 1.0,
                "technical_capacity_kt": rest_output,
                "grade_pct": 0.0,
                "recovery_pct": 0.0,
                "contained_formula_check_kt": 0.0,
                "political_risk": "mixed",
                "permitting_risk": "mixed",
                "infrastructure_risk": "mixed",
                "source_name": "ICSG World Copper Factbook 2025 global mine production",
                "source_url": "https://icsg.org/copper-factbook/",
                "assumption_note": (
                    "Residual global mine supply after named assets; grown with an explicit "
                    "scenario rest-of-world rate."
                ),
            }
        )

    asset_forecast = pd.concat([asset_forecast, pd.DataFrame(rest_rows)], ignore_index=True)

    summary_rows: list[dict[str, object]] = []
    base_primary_refined = float(config["supply"]["refinery_production_kt"]) * float(
        config["supply"]["primary_refined_share"]
    )
    primary_conversion_factor = base_primary_refined / global_mine_base
    base_concentrate_supply = float(
        asset_forecast[asset_forecast["year"] == base_year]["concentrate_supply_kt"].sum()
    )

    for year, year_data in asset_forecast.groupby("year"):
        mine_supply = float(year_data["risk_adjusted_mine_supply_kt"].sum())
        concentrate_supply = float(year_data["concentrate_supply_kt"].sum())
        sxew_supply = float(year_data["sxew_supply_kt"].sum())
        concentrate_capacity = base_concentrate_supply * (
            (1 + concentrate_capacity_growth) ** (int(year) - base_year)
        )
        smelter_constraint = (
            max(concentrate_supply - concentrate_capacity, 0.0)
            * smelter_constraint_capture_rate
        )
        blending_constraint = (
            0.0 if int(year) == base_year else concentrate_supply * blending_constraint_pct
        )
        primary_before_constraints = mine_supply * primary_conversion_factor
        primary_refined = max(
            primary_before_constraints - smelter_constraint - blending_constraint,
            0.0,
        )
        operating_supply = float(
            year_data[year_data["supply_bucket"].isin(["Operating mines", "Other operating mines"])][
                "risk_adjusted_mine_supply_kt"
            ].sum()
        )
        project_supply = mine_supply - operating_supply
        byproduct_supply = float(
            year_data[year_data["production_type"] == "by-product"][
                "risk_adjusted_mine_supply_kt"
            ].sum()
        )
        summary_rows.append(
            {
                "scenario": config["scenario_name"],
                "year": int(year),
                "mine_supply_kt": mine_supply,
                "nameplate_mine_supply_kt": float(year_data["gross_nameplate_kt"].sum()),
                "technical_capacity_kt": float(year_data["technical_capacity_kt"].sum()),
                "operating_mine_supply_kt": operating_supply,
                "project_and_expansion_supply_kt": project_supply,
                "byproduct_supply_kt": byproduct_supply,
                "concentrate_supply_kt": concentrate_supply,
                "sxew_supply_kt": sxew_supply,
                "maintenance_loss_kt": float(year_data["maintenance_loss_kt"].sum()),
                "disruption_loss_kt": float(year_data["disruption_loss_kt"].sum()),
                "project_probability_discount_kt": float(
                    year_data["project_probability_discount_kt"].sum()
                ),
                "primary_conversion_factor": primary_conversion_factor,
                "primary_refined_before_constraints_kt": primary_before_constraints,
                "smelter_refinery_constraint_kt": smelter_constraint,
                "blending_constraint_kt": blending_constraint,
                "primary_refined_supply_kt": primary_refined,
                "concentrate_processing_capacity_kt": concentrate_capacity,
                "rest_of_world_growth": rest_growth,
                "project_probability_multiplier": probability_multiplier,
                "project_risk_discount_factor": project_risk_discount_factor,
                "disruption_multiplier": disruption_multiplier,
                "maintenance_loss_multiplier": maintenance_loss_multiplier,
                "concentrate_processing_capacity_growth": concentrate_capacity_growth,
                "smelter_constraint_capture_rate": smelter_constraint_capture_rate,
                "blending_constraint_pct": blending_constraint_pct,
            }
        )

    summary = pd.DataFrame(summary_rows).sort_values("year")
    summary["primary_supply_growth"] = (
        summary["primary_refined_supply_kt"].pct_change().fillna(0.0)
    )

    sources = assets[
        ["asset", "country", "source_name", "source_url", "assumption_note"]
    ].drop_duplicates()
    return SupplyOutputs(
        asset_forecast=asset_forecast.sort_values(["year", "risk_adjusted_mine_supply_kt"], ascending=[True, False]),
        summary=summary,
        sources=sources,
    )
