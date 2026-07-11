"""Regression calibration for copper demand driver weights."""

from __future__ import annotations

from dataclasses import dataclass
from itertools import permutations
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

from copper_model.model import GDP, INDUSTRY_SHARE, POPULATION, _cagr, load_public_data

PREDICTORS = [
    "industry_activity_growth",
    "gdp_per_capita_growth",
    "population_growth",
]
GDP_PER_CAPITA_ONLY = ["gdp_per_capita_growth"]
WORLD_GDP_ONLY = ["world_real_gdp_growth"]
WORLD_GDP_CHANGE_ONLY = ["world_real_gdp_growth_change"]

MODEL_WEIGHT_FIELDS = {
    "industry_activity_growth": "industry_value_added",
    "gdp_per_capita_growth": "gdp_per_capita",
    "population_growth": "population",
}


@dataclass(frozen=True)
class RegressionOutputs:
    dataset: pd.DataFrame
    gdp_dataset: pd.DataFrame
    plot_points: pd.DataFrame
    relationship_diagnostics: pd.DataFrame
    summary: pd.DataFrame
    fit: pd.DataFrame

    @property
    def weights(self) -> dict[str, float]:
        return {
            str(row.model_field): float(row.diagnostic_lmg_share)
            for row in self.summary.itertuples(index=False)
        }


def prepare_regression_dataset(
    data_dir: Path,
    window_years: int = 1,
    macro: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Join ICSG refined usage to World Bank macro data and calculate growth rows."""

    balance = pd.read_csv(data_dir / "seed" / "icsg_world_copper_balance_1960_2024.csv")
    macro_data = load_public_data(data_dir) if macro is None else macro
    if macro_data is None or macro_data.empty:
        raise ValueError("World Bank macro data is required for regression calibration.")

    world_macro = macro_data[macro_data["country_code"] == "WLD"].pivot_table(
        index="year",
        columns="indicator",
        values="value",
        aggfunc="first",
    )
    world_macro = world_macro.reset_index()
    world_macro["industry_activity"] = (
        world_macro[GDP] * world_macro[INDUSTRY_SHARE] / 100.0
    )
    world_macro["gdp_per_capita"] = world_macro[GDP] / world_macro[POPULATION]

    joined = balance.merge(
        world_macro[["year", "industry_activity", "gdp_per_capita", POPULATION]],
        on="year",
        how="inner",
    ).sort_values("year")

    rows: list[dict[str, float | int]] = []
    for end in joined.itertuples(index=False):
        start_year = int(end.year) - window_years
        start_rows = joined[joined["year"] == start_year]
        if start_rows.empty:
            continue
        start = start_rows.iloc[0]
        values = [
            start["refined_usage_kt"],
            end.refined_usage_kt,
            start["industry_activity"],
            end.industry_activity,
            start["gdp_per_capita"],
            end.gdp_per_capita,
            start[POPULATION],
            getattr(end, POPULATION),
        ]
        if any(pd.isna(value) or float(value) <= 0 for value in values):
            continue
        rows.append(
            {
                "start_year": start_year,
                "year": int(end.year),
                "refined_usage_growth": _cagr(
                    float(start["refined_usage_kt"]),
                    float(end.refined_usage_kt),
                    window_years,
                ),
                "industry_activity_growth": _cagr(
                    float(start["industry_activity"]),
                    float(end.industry_activity),
                    window_years,
                ),
                "gdp_per_capita_growth": _cagr(
                    float(start["gdp_per_capita"]),
                    float(end.gdp_per_capita),
                    window_years,
                ),
                "population_growth": _cagr(
                    float(start[POPULATION]),
                    float(getattr(end, POPULATION)),
                    window_years,
                ),
                "refined_usage_start_kt": float(start["refined_usage_kt"]),
                "refined_usage_end_kt": float(end.refined_usage_kt),
            }
        )

    if not rows:
        raise ValueError("No overlapping ICSG/World Bank observations for regression.")
    return pd.DataFrame(rows)


def prepare_world_gdp_regression_dataset(
    data_dir: Path,
    window_years: int = 1,
    macro: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Join ICSG refined usage to World Bank world real GDP growth."""

    balance = pd.read_csv(data_dir / "seed" / "icsg_world_copper_balance_1960_2024.csv")
    macro_data = load_public_data(data_dir) if macro is None else macro
    if macro_data is None or macro_data.empty:
        raise ValueError("World Bank macro data is required for regression calibration.")

    world_macro = macro_data[macro_data["country_code"] == "WLD"].pivot_table(
        index="year",
        columns="indicator",
        values="value",
        aggfunc="first",
    )
    world_macro = world_macro.reset_index()

    joined = balance.merge(
        world_macro[["year", GDP]],
        on="year",
        how="inner",
    ).sort_values("year")

    rows: list[dict[str, float | int]] = []
    for end in joined.itertuples(index=False):
        start_year = int(end.year) - window_years
        start_rows = joined[joined["year"] == start_year]
        if start_rows.empty:
            continue
        start = start_rows.iloc[0]
        values = [
            start["refined_usage_kt"],
            end.refined_usage_kt,
            start[GDP],
            getattr(end, GDP),
        ]
        if any(pd.isna(value) or float(value) <= 0 for value in values):
            continue
        rows.append(
            {
                "start_year": start_year,
                "year": int(end.year),
                "window_years": window_years,
                "refined_usage_growth": _cagr(
                    float(start["refined_usage_kt"]),
                    float(end.refined_usage_kt),
                    window_years,
                ),
                "world_real_gdp_growth": _cagr(
                    float(start[GDP]),
                    float(getattr(end, GDP)),
                    window_years,
                ),
                "refined_usage_start_kt": float(start["refined_usage_kt"]),
                "refined_usage_end_kt": float(end.refined_usage_kt),
                "world_real_gdp_start_usd": float(start[GDP]),
                "world_real_gdp_end_usd": float(getattr(end, GDP)),
            }
        )

    if not rows:
        raise ValueError("No overlapping ICSG/World Bank GDP observations.")
    return pd.DataFrame(rows)


def prepare_world_gdp_growth_change_dataset(gdp_dataset: pd.DataFrame) -> pd.DataFrame:
    """Calculate year-on-year changes in annual copper and GDP growth rates."""

    ordered = gdp_dataset.sort_values("year").reset_index(drop=True)
    rows: list[dict[str, float | int]] = []
    for index in range(1, len(ordered)):
        previous = ordered.iloc[index - 1]
        current = ordered.iloc[index]
        rows.append(
            {
                "start_year": int(previous["year"]),
                "year": int(current["year"]),
                "window_years": 1,
                "refined_usage_growth_change": float(
                    current["refined_usage_growth"] - previous["refined_usage_growth"]
                ),
                "world_real_gdp_growth_change": float(
                    current["world_real_gdp_growth"]
                    - previous["world_real_gdp_growth"]
                ),
                "refined_usage_growth": float(current["refined_usage_growth"]),
                "world_real_gdp_growth": float(current["world_real_gdp_growth"]),
                "previous_refined_usage_growth": float(
                    previous["refined_usage_growth"]
                ),
                "previous_world_real_gdp_growth": float(
                    previous["world_real_gdp_growth"]
                ),
            }
        )

    if not rows:
        raise ValueError("No annual GDP growth-change observations.")
    return pd.DataFrame(rows)


def estimate_driver_weights(
    data_dir: Path,
    window_years: int = 1,
    macro: pd.DataFrame | None = None,
) -> RegressionOutputs:
    """Estimate model demand-driver weights from a multivariate regression."""

    dataset = prepare_regression_dataset(data_dir, window_years, macro)
    world_gdp_dataset = prepare_world_gdp_regression_dataset(data_dir, 1, macro)
    world_gdp_5y_dataset = prepare_world_gdp_regression_dataset(data_dir, 5, macro)
    world_gdp_change_dataset = prepare_world_gdp_growth_change_dataset(
        world_gdp_dataset
    )
    coefficients, r_squared = _ols(dataset, PREDICTORS)
    standardized = _standardized_coefficients(dataset, PREDICTORS)
    lmg = _lmg_relative_importance(dataset, PREDICTORS)
    lmg_total = sum(max(0.0, value) for value in lmg.values())
    if lmg_total <= 0:
        raise ValueError("Regression did not produce positive relative importance.")
    gdp_only_coefficients, gdp_only_r_squared = _ols(dataset, GDP_PER_CAPITA_ONLY)
    gdp_only_standardized = _standardized_coefficients(dataset, GDP_PER_CAPITA_ONLY)
    world_gdp_coefficients, world_gdp_r_squared = _ols(
        world_gdp_dataset, WORLD_GDP_ONLY
    )
    world_gdp_no_intercept_coefficients, world_gdp_no_intercept_r_squared = _ols(
        world_gdp_dataset, WORLD_GDP_ONLY, include_intercept=False
    )
    world_gdp_5y_coefficients, world_gdp_5y_r_squared = _ols(
        world_gdp_5y_dataset, WORLD_GDP_ONLY
    )
    world_gdp_change_coefficients, world_gdp_change_r_squared = _ols(
        world_gdp_change_dataset,
        WORLD_GDP_CHANGE_ONLY,
        target="refined_usage_growth_change",
    )

    rows: list[dict[str, float | str]] = []
    for predictor in PREDICTORS:
        rows.append(
            {
                "predictor": predictor,
                "model_field": MODEL_WEIGHT_FIELDS[predictor],
                "ols_coefficient": coefficients[predictor],
                "standardized_beta": standardized[predictor],
                "lmg_r2_contribution": lmg[predictor],
                "diagnostic_lmg_share": max(0.0, lmg[predictor]) / lmg_total,
            }
        )

    common_fit = {
        "dependent_variable": "refined_usage_growth",
        "window_years": window_years,
        "observations": len(dataset),
        "sample_start_year": int(dataset["year"].min()),
        "sample_end_year": int(dataset["year"].max()),
    }
    fit = pd.DataFrame(
        [
            {
                **common_fit,
                "model_id": "multivariate_macro",
                "model_name": "Multivariate macro diagnostic",
                "method": "OLS with intercept; diagnostic LMG relative R-squared shares",
                "equation": (
                    "refined_usage_growth = intercept + industry_activity_growth "
                    "+ gdp_per_capita_growth + population_growth + error"
                ),
                "predictors": ";".join(PREDICTORS),
                "r_squared": r_squared,
                "intercept": coefficients["intercept"],
                "key_coefficient_label": "GDP/capita coefficient",
                "key_coefficient": coefficients["gdp_per_capita_growth"],
                "gdp_per_capita_coefficient": coefficients["gdp_per_capita_growth"],
                "world_real_gdp_coefficient": np.nan,
                "gdp_per_capita_standardized_beta": standardized[
                    "gdp_per_capita_growth"
                ],
            },
            {
                **common_fit,
                "model_id": "gdp_per_capita_only",
                "model_name": "GDP per capita only",
                "method": "OLS with intercept",
                "equation": (
                    "refined_usage_growth = intercept + gdp_per_capita_growth + error"
                ),
                "predictors": "gdp_per_capita_growth",
                "r_squared": gdp_only_r_squared,
                "intercept": gdp_only_coefficients["intercept"],
                "key_coefficient_label": "GDP/capita coefficient",
                "key_coefficient": gdp_only_coefficients["gdp_per_capita_growth"],
                "gdp_per_capita_coefficient": gdp_only_coefficients[
                    "gdp_per_capita_growth"
                ],
                "world_real_gdp_coefficient": np.nan,
                "gdp_per_capita_standardized_beta": gdp_only_standardized[
                    "gdp_per_capita_growth"
                ],
            },
            {
                "dependent_variable": "refined_usage_growth",
                "window_years": 1,
                "observations": len(world_gdp_dataset),
                "sample_start_year": int(world_gdp_dataset["year"].min()),
                "sample_end_year": int(world_gdp_dataset["year"].max()),
                "model_id": "world_gdp_annual",
                "model_name": "World real GDP only",
                "method": "OLS with intercept",
                "equation": (
                    "refined_usage_growth = intercept + "
                    "world_real_gdp_growth + error"
                ),
                "predictors": "world_real_gdp_growth",
                "r_squared": world_gdp_r_squared,
                "intercept": world_gdp_coefficients["intercept"],
                "key_coefficient_label": "World GDP coefficient",
                "key_coefficient": world_gdp_coefficients["world_real_gdp_growth"],
                "gdp_per_capita_coefficient": np.nan,
                "world_real_gdp_coefficient": world_gdp_coefficients[
                    "world_real_gdp_growth"
                ],
                "gdp_per_capita_standardized_beta": np.nan,
            },
            {
                "dependent_variable": "refined_usage_growth",
                "window_years": 1,
                "observations": len(world_gdp_dataset),
                "sample_start_year": int(world_gdp_dataset["year"].min()),
                "sample_end_year": int(world_gdp_dataset["year"].max()),
                "model_id": "world_gdp_annual_no_intercept",
                "model_name": "World GDP rule-of-thumb",
                "method": "OLS through origin; no intercept",
                "equation": "refined_usage_growth = world_real_gdp_growth + error",
                "predictors": "world_real_gdp_growth",
                "r_squared": world_gdp_no_intercept_r_squared,
                "intercept": world_gdp_no_intercept_coefficients["intercept"],
                "key_coefficient_label": "World GDP coefficient",
                "key_coefficient": world_gdp_no_intercept_coefficients[
                    "world_real_gdp_growth"
                ],
                "gdp_per_capita_coefficient": np.nan,
                "world_real_gdp_coefficient": world_gdp_no_intercept_coefficients[
                    "world_real_gdp_growth"
                ],
                "gdp_per_capita_standardized_beta": np.nan,
            },
            {
                "dependent_variable": "refined_usage_growth",
                "window_years": 5,
                "observations": len(world_gdp_5y_dataset),
                "sample_start_year": int(world_gdp_5y_dataset["year"].min()),
                "sample_end_year": int(world_gdp_5y_dataset["year"].max()),
                "model_id": "world_gdp_5y_cagr",
                "model_name": "World GDP, 5-year CAGR",
                "method": "OLS with intercept on 5-year CAGRs",
                "equation": (
                    "refined_usage_growth = intercept + "
                    "world_real_gdp_growth + error"
                ),
                "predictors": "world_real_gdp_growth",
                "r_squared": world_gdp_5y_r_squared,
                "intercept": world_gdp_5y_coefficients["intercept"],
                "key_coefficient_label": "World GDP coefficient",
                "key_coefficient": world_gdp_5y_coefficients[
                    "world_real_gdp_growth"
                ],
                "gdp_per_capita_coefficient": np.nan,
                "world_real_gdp_coefficient": world_gdp_5y_coefficients[
                    "world_real_gdp_growth"
                ],
                "gdp_per_capita_standardized_beta": np.nan,
            },
            {
                "dependent_variable": "refined_usage_growth_change",
                "window_years": 1,
                "observations": len(world_gdp_change_dataset),
                "sample_start_year": int(world_gdp_change_dataset["year"].min()),
                "sample_end_year": int(world_gdp_change_dataset["year"].max()),
                "model_id": "world_gdp_growth_change",
                "model_name": "GDP slowdown test",
                "method": "OLS with intercept on annual growth-rate changes",
                "equation": (
                    "refined_usage_growth_change = intercept + "
                    "world_real_gdp_growth_change + error"
                ),
                "predictors": "world_real_gdp_growth_change",
                "r_squared": world_gdp_change_r_squared,
                "intercept": world_gdp_change_coefficients["intercept"],
                "key_coefficient_label": "GDP slowdown coefficient",
                "key_coefficient": world_gdp_change_coefficients[
                    "world_real_gdp_growth_change"
                ],
                "gdp_per_capita_coefficient": np.nan,
                "world_real_gdp_coefficient": world_gdp_change_coefficients[
                    "world_real_gdp_growth_change"
                ],
                "gdp_per_capita_standardized_beta": np.nan,
            },
        ]
    )
    plot_points = _build_regression_plot_points(
        dataset=dataset,
        world_gdp_dataset=world_gdp_dataset,
        world_gdp_5y_dataset=world_gdp_5y_dataset,
        world_gdp_change_dataset=world_gdp_change_dataset,
        coefficients=coefficients,
        gdp_only_coefficients=gdp_only_coefficients,
        world_gdp_coefficients=world_gdp_coefficients,
        world_gdp_no_intercept_coefficients=world_gdp_no_intercept_coefficients,
        world_gdp_5y_coefficients=world_gdp_5y_coefficients,
        world_gdp_change_coefficients=world_gdp_change_coefficients,
    )
    relationship_diagnostics = _build_relationship_diagnostics(
        data_dir=data_dir,
        macro=macro,
        world_gdp_dataset=world_gdp_dataset,
        world_gdp_5y_dataset=world_gdp_5y_dataset,
        world_gdp_change_dataset=world_gdp_change_dataset,
        world_gdp_coefficients=world_gdp_coefficients,
        world_gdp_r_squared=world_gdp_r_squared,
        world_gdp_no_intercept_coefficients=world_gdp_no_intercept_coefficients,
        world_gdp_no_intercept_r_squared=world_gdp_no_intercept_r_squared,
        world_gdp_5y_coefficients=world_gdp_5y_coefficients,
        world_gdp_5y_r_squared=world_gdp_5y_r_squared,
        world_gdp_change_coefficients=world_gdp_change_coefficients,
        world_gdp_change_r_squared=world_gdp_change_r_squared,
    )

    return RegressionOutputs(
        dataset=dataset,
        gdp_dataset=world_gdp_dataset,
        plot_points=plot_points,
        relationship_diagnostics=relationship_diagnostics,
        summary=pd.DataFrame(rows),
        fit=fit,
    )


def write_regression_outputs(outputs: RegressionOutputs, output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        output_dir / "demand_driver_regression_dataset.csv",
        output_dir / "demand_world_gdp_regression_dataset.csv",
        output_dir / "demand_regression_plot_points.csv",
        output_dir / "copper_gdp_relationship_diagnostics.csv",
        output_dir / "demand_driver_regression_summary.csv",
        output_dir / "demand_driver_regression_fit.csv",
    ]
    outputs.dataset.to_csv(paths[0], index=False)
    outputs.gdp_dataset.to_csv(paths[1], index=False)
    outputs.plot_points.to_csv(paths[2], index=False)
    outputs.relationship_diagnostics.to_csv(paths[3], index=False)
    outputs.summary.to_csv(paths[4], index=False)
    outputs.fit.to_csv(paths[5], index=False)
    return paths


def _build_relationship_diagnostics(
    data_dir: Path,
    macro: pd.DataFrame | None,
    world_gdp_dataset: pd.DataFrame,
    world_gdp_5y_dataset: pd.DataFrame,
    world_gdp_change_dataset: pd.DataFrame,
    world_gdp_coefficients: dict[str, float],
    world_gdp_r_squared: float,
    world_gdp_no_intercept_coefficients: dict[str, float],
    world_gdp_no_intercept_r_squared: float,
    world_gdp_5y_coefficients: dict[str, float],
    world_gdp_5y_r_squared: float,
    world_gdp_change_coefficients: dict[str, float],
    world_gdp_change_r_squared: float,
) -> pd.DataFrame:
    """Summarize the GDP/copper tests behind the dashboard explanation."""

    rows: list[dict[str, float | int | str]] = []

    def append_row(
        *,
        test_id: str,
        test_name: str,
        data: pd.DataFrame,
        x_variable: str,
        y_variable: str,
        coefficients: dict[str, float],
        r_squared: float,
        method: str,
        readthrough: str,
    ) -> None:
        rows.append(
            {
                "test_id": test_id,
                "test_name": test_name,
                "sample_start_year": int(data["year"].min()),
                "sample_end_year": int(data["year"].max()),
                "observations": len(data),
                "x_variable": x_variable,
                "y_variable": y_variable,
                "method": method,
                "coefficient": coefficients[x_variable],
                "intercept": coefficients["intercept"],
                "r_squared": r_squared,
                "correlation": float(data[[x_variable, y_variable]].corr().iloc[0, 1]),
                "readthrough": readthrough,
            }
        )

    levels = _prepare_world_gdp_level_dataset(data_dir, macro)
    level_coefficients, level_r_squared = _ols(
        levels, ["log_world_real_gdp"], target="log_refined_usage"
    )
    append_row(
        test_id="log_levels",
        test_name="Long-run scale relationship",
        data=levels,
        x_variable="log_world_real_gdp",
        y_variable="log_refined_usage",
        coefficients=level_coefficients,
        r_squared=level_r_squared,
        method="OLS with intercept on log levels",
        readthrough=(
            "Very strong relationship because both copper use and real GDP trend "
            "up over decades; useful for scale, not proof of annual forecast power."
        ),
    )
    append_row(
        test_id="annual_growth",
        test_name="Annual growth with intercept",
        data=world_gdp_dataset,
        x_variable="world_real_gdp_growth",
        y_variable="refined_usage_growth",
        coefficients=world_gdp_coefficients,
        r_squared=world_gdp_r_squared,
        method="OLS with intercept on annual growth rates",
        readthrough=(
            "GDP matters, but copper-specific cycles and measurement noise leave "
            "large annual residuals."
        ),
    )
    append_row(
        test_id="annual_growth_no_intercept",
        test_name="Rule-of-thumb annual growth",
        data=world_gdp_dataset,
        x_variable="world_real_gdp_growth",
        y_variable="refined_usage_growth",
        coefficients=world_gdp_no_intercept_coefficients,
        r_squared=world_gdp_no_intercept_r_squared,
        method="OLS through origin on annual growth rates",
        readthrough=(
            "Closest public-data test of the Goldman-style rule: the slope is near "
            "0.9 copper-demand percentage points per 1 GDP percentage point."
        ),
    )
    append_row(
        test_id="five_year_cagr",
        test_name="Five-year growth smoothing",
        data=world_gdp_5y_dataset,
        x_variable="world_real_gdp_growth",
        y_variable="refined_usage_growth",
        coefficients=world_gdp_5y_coefficients,
        r_squared=world_gdp_5y_r_squared,
        method="OLS with intercept on overlapping 5-year CAGRs",
        readthrough=(
            "Smoothing improves the fit, so the GDP link is clearer over cycles "
            "than in single-year moves."
        ),
    )
    append_row(
        test_id="growth_rate_change",
        test_name="GDP slowdown test",
        data=world_gdp_change_dataset,
        x_variable="world_real_gdp_growth_change",
        y_variable="refined_usage_growth_change",
        coefficients=world_gdp_change_coefficients,
        r_squared=world_gdp_change_r_squared,
        method="OLS with intercept on changes in annual growth rates",
        readthrough=(
            "Direct slowdown test: changes in GDP growth explain some, but not most, "
            "of changes in copper usage growth."
        ),
    )

    pre_1990 = world_gdp_dataset[world_gdp_dataset["year"] <= 1989]
    pre_coefficients, pre_r_squared = _ols(pre_1990, WORLD_GDP_ONLY)
    append_row(
        test_id="pre_1990_annual_growth",
        test_name="Annual growth, 1961-1989",
        data=pre_1990,
        x_variable="world_real_gdp_growth",
        y_variable="refined_usage_growth",
        coefficients=pre_coefficients,
        r_squared=pre_r_squared,
        method="OLS with intercept on annual growth rates",
        readthrough=(
            "The old industrial-cycle sample has a much stronger fit; this is one "
            "reason a broad GDP rule can look intuitive."
        ),
    )

    post_1990 = world_gdp_dataset[world_gdp_dataset["year"] >= 1990]
    post_coefficients, post_r_squared = _ols(post_1990, WORLD_GDP_ONLY)
    append_row(
        test_id="post_1990_annual_growth",
        test_name="Annual growth, 1990-2024",
        data=post_1990,
        x_variable="world_real_gdp_growth",
        y_variable="refined_usage_growth",
        coefficients=post_coefficients,
        r_squared=post_r_squared,
        method="OLS with intercept on annual growth rates",
        readthrough=(
            "Fit weakens after 1990 as China, sector mix, inventory swings, "
            "substitution, and policy become more important."
        ),
    )

    ex_covid = world_gdp_dataset[~world_gdp_dataset["year"].isin([2020, 2021])]
    ex_covid_coefficients, ex_covid_r_squared = _ols(ex_covid, WORLD_GDP_ONLY)
    append_row(
        test_id="exclude_2020_2021",
        test_name="Annual growth excluding 2020-2021",
        data=ex_covid,
        x_variable="world_real_gdp_growth",
        y_variable="refined_usage_growth",
        coefficients=ex_covid_coefficients,
        r_squared=ex_covid_r_squared,
        method="OLS with intercept excluding pandemic/reopening years",
        readthrough=(
            "Removing the pandemic/reopening years improves fit materially, showing "
            "that a few copper-specific outliers pull annual R-squared down."
        ),
    )

    lag_rows: list[dict[str, float | int]] = []
    for shift in [-2, -1, 0, 1, 2]:
        shifted = world_gdp_dataset[
            ["year", "refined_usage_growth", "world_real_gdp_growth"]
        ].copy()
        shifted["world_real_gdp_growth"] = shifted["world_real_gdp_growth"].shift(
            shift
        )
        shifted = shifted.dropna()
        coefficients, r_squared = _ols(shifted, WORLD_GDP_ONLY)
        lag_rows.append(
            {
                "shift": shift,
                "coefficient": coefficients["world_real_gdp_growth"],
                "r_squared": r_squared,
            }
        )
    best_lag = max(lag_rows, key=lambda row: float(row["r_squared"]))
    rows.append(
        {
            "test_id": "lag_check",
            "test_name": "GDP lead/lag check",
            "sample_start_year": int(world_gdp_dataset["year"].min()),
            "sample_end_year": int(world_gdp_dataset["year"].max()),
            "observations": len(world_gdp_dataset),
            "x_variable": "world_real_gdp_growth",
            "y_variable": "refined_usage_growth",
            "method": "OLS with intercept, GDP shifted -2 to +2 years",
            "coefficient": float(best_lag["coefficient"]),
            "intercept": np.nan,
            "r_squared": float(best_lag["r_squared"]),
            "correlation": np.nan,
            "readthrough": (
                f"Current-year GDP growth is the best lag test in this public annual "
                f"sample; best shift = {int(best_lag['shift'])} years."
            ),
        }
    )

    return pd.DataFrame(rows)


def _prepare_world_gdp_level_dataset(
    data_dir: Path,
    macro: pd.DataFrame | None = None,
) -> pd.DataFrame:
    balance = pd.read_csv(data_dir / "seed" / "icsg_world_copper_balance_1960_2024.csv")
    macro_data = load_public_data(data_dir) if macro is None else macro
    if macro_data is None or macro_data.empty:
        raise ValueError("World Bank macro data is required for GDP level diagnostics.")

    world_macro = macro_data[macro_data["country_code"] == "WLD"].pivot_table(
        index="year",
        columns="indicator",
        values="value",
        aggfunc="first",
    )
    world_macro = world_macro.reset_index()

    joined = balance.merge(world_macro[["year", GDP]], on="year", how="inner")
    joined = joined.sort_values("year")
    joined = joined[(joined["refined_usage_kt"] > 0) & (joined[GDP] > 0)].copy()
    joined["log_refined_usage"] = np.log(joined["refined_usage_kt"])
    joined["log_world_real_gdp"] = np.log(joined[GDP])
    if joined.empty:
        raise ValueError("No overlapping ICSG/World Bank GDP level observations.")
    return joined[
        [
            "year",
            "refined_usage_kt",
            GDP,
            "log_refined_usage",
            "log_world_real_gdp",
        ]
    ]


def _build_regression_plot_points(
    dataset: pd.DataFrame,
    world_gdp_dataset: pd.DataFrame,
    world_gdp_5y_dataset: pd.DataFrame,
    world_gdp_change_dataset: pd.DataFrame,
    coefficients: dict[str, float],
    gdp_only_coefficients: dict[str, float],
    world_gdp_coefficients: dict[str, float],
    world_gdp_no_intercept_coefficients: dict[str, float],
    world_gdp_5y_coefficients: dict[str, float],
    world_gdp_change_coefficients: dict[str, float],
) -> pd.DataFrame:
    """Build standardized scatterplot rows for dashboard regression diagnostics."""

    rows: list[dict[str, float | int | str]] = []

    def add_univariate(
        model_id: str,
        model_name: str,
        data: pd.DataFrame,
        x_column: str,
        y_column: str,
        coefficients_for_model: dict[str, float],
        x_label: str,
        y_label: str,
        plot_note: str,
    ) -> None:
        for point in data.itertuples(index=False):
            x_value = float(getattr(point, x_column))
            y_value = float(getattr(point, y_column))
            rows.append(
                {
                    "model_id": model_id,
                    "model_name": model_name,
                    "plot_type": "driver_vs_usage",
                    "year": int(point.year),
                    "x_label": x_label,
                    "y_label": y_label,
                    "x_value": x_value,
                    "y_value": y_value,
                    "fitted_value": coefficients_for_model["intercept"]
                    + coefficients_for_model[x_column] * x_value,
                    "line_type": "regression",
                    "plot_note": plot_note,
                }
            )

    add_univariate(
        model_id="gdp_per_capita_only",
        model_name="GDP per capita only",
        data=dataset,
        x_column="gdp_per_capita_growth",
        y_column="refined_usage_growth",
        coefficients_for_model=gdp_only_coefficients,
        x_label="GDP per capita growth",
        y_label="Refined usage growth",
        plot_note="Annual 1992-2024 sample.",
    )
    add_univariate(
        model_id="world_gdp_annual",
        model_name="World real GDP only",
        data=world_gdp_dataset,
        x_column="world_real_gdp_growth",
        y_column="refined_usage_growth",
        coefficients_for_model=world_gdp_coefficients,
        x_label="World real GDP growth",
        y_label="Refined usage growth",
        plot_note="Annual 1961-2024 sample with intercept.",
    )
    add_univariate(
        model_id="world_gdp_annual_no_intercept",
        model_name="World GDP rule-of-thumb",
        data=world_gdp_dataset,
        x_column="world_real_gdp_growth",
        y_column="refined_usage_growth",
        coefficients_for_model=world_gdp_no_intercept_coefficients,
        x_label="World real GDP growth",
        y_label="Refined usage growth",
        plot_note="Annual 1961-2024 sample; line forced through zero.",
    )
    add_univariate(
        model_id="world_gdp_5y_cagr",
        model_name="World GDP, 5-year CAGR",
        data=world_gdp_5y_dataset,
        x_column="world_real_gdp_growth",
        y_column="refined_usage_growth",
        coefficients_for_model=world_gdp_5y_coefficients,
        x_label="World real GDP 5-year CAGR",
        y_label="Refined usage 5-year CAGR",
        plot_note="5-year overlapping CAGRs from 1965-2024.",
    )
    add_univariate(
        model_id="world_gdp_growth_change",
        model_name="GDP slowdown test",
        data=world_gdp_change_dataset,
        x_column="world_real_gdp_growth_change",
        y_column="refined_usage_growth_change",
        coefficients_for_model=world_gdp_change_coefficients,
        x_label="Change in world real GDP growth",
        y_label="Change in refined usage growth",
        plot_note="Year-on-year changes in annual growth rates.",
    )

    for point in dataset.itertuples(index=False):
        fitted_value = coefficients["intercept"] + sum(
            coefficients[predictor] * float(getattr(point, predictor))
            for predictor in PREDICTORS
        )
        rows.append(
            {
                "model_id": "multivariate_macro",
                "model_name": "Multivariate macro diagnostic",
                "plot_type": "actual_vs_fitted",
                "year": int(point.year),
                "x_label": "Fitted refined usage growth",
                "y_label": "Actual refined usage growth",
                "x_value": fitted_value,
                "y_value": float(point.refined_usage_growth),
                "fitted_value": fitted_value,
                "line_type": "actual_equals_fitted",
                "plot_note": (
                    "Multivariate model shown as actual versus fitted because "
                    "there is no single x-axis driver."
                ),
            }
        )

    return pd.DataFrame(rows)


def _ols(
    data: pd.DataFrame,
    predictors: Iterable[str],
    target: str = "refined_usage_growth",
    include_intercept: bool = True,
) -> tuple[dict[str, float], float]:
    predictor_list = list(predictors)
    y = data[target].to_numpy()
    x = data[predictor_list].to_numpy()
    if include_intercept:
        x_model = np.column_stack([np.ones(len(x)), x])
        beta = np.linalg.lstsq(x_model, y, rcond=None)[0]
        prediction = x_model @ beta
        coefficients = {"intercept": float(beta[0])}
        predictor_coefficients = beta[1:]
    else:
        beta = np.linalg.lstsq(x, y, rcond=None)[0]
        prediction = x @ beta
        coefficients = {"intercept": 0.0}
        predictor_coefficients = beta
    r_squared = _r_squared(y, prediction)
    coefficients.update(
        {
            predictor: float(value)
            for predictor, value in zip(predictor_list, predictor_coefficients)
        }
    )
    return coefficients, r_squared


def _standardized_coefficients(
    data: pd.DataFrame, predictors: Iterable[str]
) -> dict[str, float]:
    predictor_list = list(predictors)
    z = data[["refined_usage_growth", *predictor_list]].copy()
    z = (z - z.mean()) / z.std(ddof=0)
    coefficients, _ = _ols(z, predictor_list)
    return {predictor: coefficients[predictor] for predictor in predictor_list}


def _fit_r_squared(data: pd.DataFrame, predictors: tuple[str, ...]) -> float:
    y = data["refined_usage_growth"].to_numpy()
    if not predictors:
        prediction = np.repeat(y.mean(), len(y))
    else:
        x = data[list(predictors)].to_numpy()
        x_with_intercept = np.column_stack([np.ones(len(x)), x])
        beta = np.linalg.lstsq(x_with_intercept, y, rcond=None)[0]
        prediction = x_with_intercept @ beta
    return _r_squared(y, prediction)


def _lmg_relative_importance(
    data: pd.DataFrame, predictors: Iterable[str]
) -> dict[str, float]:
    predictor_list = list(predictors)
    contributions = {predictor: 0.0 for predictor in predictor_list}
    predictor_orders = list(permutations(predictor_list))

    for order in predictor_orders:
        previous: tuple[str, ...] = ()
        previous_r2 = _fit_r_squared(data, previous)
        for predictor in order:
            current = (*previous, predictor)
            current_r2 = _fit_r_squared(data, current)
            contributions[predictor] += current_r2 - previous_r2
            previous = current
            previous_r2 = current_r2

    return {
        predictor: float(value / len(predictor_orders))
        for predictor, value in contributions.items()
    }


def _r_squared(actual: np.ndarray, prediction: np.ndarray) -> float:
    residual_sum_squares = float(((actual - prediction) ** 2).sum())
    total_sum_squares = float(((actual - actual.mean()) ** 2).sum())
    if total_sum_squares == 0:
        return 0.0
    return 1.0 - residual_sum_squares / total_sum_squares
