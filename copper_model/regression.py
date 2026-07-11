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

    return RegressionOutputs(
        dataset=dataset,
        gdp_dataset=world_gdp_dataset,
        summary=pd.DataFrame(rows),
        fit=fit,
    )


def write_regression_outputs(outputs: RegressionOutputs, output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        output_dir / "demand_driver_regression_dataset.csv",
        output_dir / "demand_world_gdp_regression_dataset.csv",
        output_dir / "demand_driver_regression_summary.csv",
        output_dir / "demand_driver_regression_fit.csv",
    ]
    outputs.dataset.to_csv(paths[0], index=False)
    outputs.gdp_dataset.to_csv(paths[1], index=False)
    outputs.summary.to_csv(paths[2], index=False)
    outputs.fit.to_csv(paths[3], index=False)
    return paths


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
