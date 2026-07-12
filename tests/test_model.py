from pathlib import Path

import pandas as pd

from copper_model.model import (
    _macro_growth_for_code,
    _pivot_macro,
    estimate_regional_demand_growth,
    load_config,
    run_model,
)
from copper_model.regression import (
    estimate_driver_weights,
    prepare_regression_dataset,
    prepare_world_gdp_regression_dataset,
)


def _macro_rows() -> pd.DataFrame:
    rows = []
    codes = {
        "WLD": (1000.0, 300.0, 100.0),
        "CHN": (180.0, 90.0, 18.0),
        "USA": (250.0, 55.0, 8.0),
        "EUU": (220.0, 50.0, 12.0),
    }
    for year in [2014, 2024]:
        scale = 1.0 if year == 2014 else 1.2
        for code, values in codes.items():
            for indicator, value in zip(
                [
                    "gdp_constant_usd",
                    "industry_value_added_constant_usd",
                    "population",
                ],
                values,
            ):
                rows.append(
                    {
                        "country": code,
                        "country_code": code,
                        "indicator": indicator,
                        "indicator_code": indicator,
                        "year": year,
                        "value": value * scale,
                    }
                )
    return pd.DataFrame(rows)


def test_estimate_regional_demand_growth_includes_rest_of_world():
    config = load_config(Path("config/base_case.json"))
    growth = estimate_regional_demand_growth(config, _macro_rows())

    assert set(growth["region"]) == {
        "China",
        "United States",
        "European Union",
        "Rest of World",
    }
    assert growth["demand_growth"].between(-0.015, 0.055).all()


def test_gdp_per_capita_growth_uses_exact_per_person_cagr():
    macro = pd.DataFrame(
        [
            {
                "country": "China",
                "country_code": "CHN",
                "indicator": "gdp_constant_usd",
                "indicator_code": "NY.GDP.MKTP.KD",
                "year": 2020,
                "value": 100.0,
            },
            {
                "country": "China",
                "country_code": "CHN",
                "indicator": "industry_value_added_constant_usd",
                "indicator_code": "industry_value_added_constant_usd",
                "year": 2020,
                "value": 40.0,
            },
            {
                "country": "China",
                "country_code": "CHN",
                "indicator": "population",
                "indicator_code": "SP.POP.TOTL",
                "year": 2020,
                "value": 100.0,
            },
            {
                "country": "China",
                "country_code": "CHN",
                "indicator": "gdp_constant_usd",
                "indicator_code": "NY.GDP.MKTP.KD",
                "year": 2021,
                "value": 121.0,
            },
            {
                "country": "China",
                "country_code": "CHN",
                "indicator": "industry_value_added_constant_usd",
                "indicator_code": "industry_value_added_constant_usd",
                "year": 2021,
                "value": 44.0,
            },
            {
                "country": "China",
                "country_code": "CHN",
                "indicator": "population",
                "indicator_code": "SP.POP.TOTL",
                "year": 2021,
                "value": 110.0,
            },
        ]
    )
    growth = _macro_growth_for_code(_pivot_macro(macro), "CHN", 1)

    assert round(growth["gdp_per_capita"], 6) == 0.1


def test_run_model_produces_full_forecast():
    config = load_config(Path("config/base_case.json"))
    outputs = run_model(config, Path("data"), macro=_macro_rows())

    assert outputs.forecast["year"].min() == 2024
    assert outputs.forecast["year"].max() == 2035
    assert {"demand_kt", "refined_supply_kt", "market_balance_kt"}.issubset(
        outputs.forecast.columns
    )
    assert not outputs.regional_demand.empty
    assert not outputs.mine_supply_by_country.empty
    assert not outputs.supply_asset_forecast.empty
    assert not outputs.supply_summary.empty
    assert not outputs.supply_conversion_bridge.empty
    assert {"primary_refined_supply_kt", "smelter_refinery_constraint_kt"}.issubset(
        outputs.supply_summary.columns
    )
    assert {
        "Risk-adjusted mine supply",
        "Total refined supply",
    }.issubset(set(outputs.supply_conversion_bridge["step"]))


def test_all_dashboard_scenarios_run():
    for scenario_name in ["base_case", "bull_case", "bear_case"]:
        config = load_config(Path("config") / f"{scenario_name}.json")
        outputs = run_model(config, Path("data"), macro=_macro_rows())

        assert outputs.forecast["scenario"].eq(scenario_name).all()
        assert outputs.forecast["year"].max() == 2035
        assert outputs.forecast["market_balance_kt"].notna().all()
        assert "ending_stocks_kt" not in outputs.forecast.columns
        assert "implied_price_usd_per_t" not in outputs.forecast.columns


def test_regression_dataset_uses_public_history():
    dataset = prepare_regression_dataset(Path("data"))

    assert dataset["year"].min() == 1992
    assert dataset["year"].max() == 2024
    assert len(dataset) == 33
    assert {
        "refined_usage_growth",
        "industry_activity_growth",
        "gdp_per_capita_growth",
        "population_growth",
    }.issubset(dataset.columns)


def test_world_gdp_regression_dataset_uses_long_public_history():
    dataset = prepare_world_gdp_regression_dataset(Path("data"))

    assert dataset["year"].min() == 1961
    assert dataset["year"].max() == 2024
    assert len(dataset) == 64
    assert {
        "refined_usage_growth",
        "world_real_gdp_growth",
    }.issubset(dataset.columns)


def test_regression_weights_are_normalized():
    outputs = estimate_driver_weights(Path("data"))
    weights = outputs.weights

    assert round(sum(weights.values()), 6) == 1.0
    assert round(weights["industry_value_added"], 3) == 0.383
    assert round(weights["gdp_per_capita"], 3) == 0.302
    assert round(weights["population"], 3) == 0.315
    gdp_only = outputs.fit[outputs.fit["model_id"] == "gdp_per_capita_only"].iloc[0]

    assert round(gdp_only["r_squared"], 3) == 0.098
    assert round(gdp_only["gdp_per_capita_coefficient"], 3) == 0.466
    world_gdp_rule = outputs.fit[
        outputs.fit["model_id"] == "world_gdp_annual_no_intercept"
    ].iloc[0]
    world_gdp_5y = outputs.fit[outputs.fit["model_id"] == "world_gdp_5y_cagr"].iloc[
        0
    ]

    assert round(world_gdp_rule["key_coefficient"], 3) == 0.931
    assert round(world_gdp_rule["r_squared"], 3) == 0.279
    assert round(world_gdp_5y["key_coefficient"], 3) == 0.941
    assert round(world_gdp_5y["r_squared"], 3) == 0.395
    relationship = outputs.relationship_diagnostics
    log_levels = relationship[relationship["test_id"] == "log_levels"].iloc[0]
    rule = relationship[
        relationship["test_id"] == "annual_growth_no_intercept"
    ].iloc[0]
    ex_covid = relationship[relationship["test_id"] == "exclude_2020_2021"].iloc[0]

    assert round(log_levels["coefficient"], 3) == 0.786
    assert round(log_levels["r_squared"], 3) == 0.986
    assert (
        log_levels["equation"]
        == "log_refined_usage = intercept + beta * log_world_real_gdp + error"
    )
    assert round(rule["coefficient"], 3) == 0.931
    assert (
        rule["equation"]
        == "refined_usage_growth = beta * world_real_gdp_growth + error"
    )
    assert round(ex_covid["r_squared"], 3) == 0.453


def test_regression_plot_points_cover_all_models():
    outputs = estimate_driver_weights(Path("data"))
    plot_points = outputs.plot_points

    assert set(outputs.fit["model_id"]).issubset(set(plot_points["model_id"]))
    assert len(plot_points[plot_points["model_id"] == "world_gdp_annual_no_intercept"]) == 64
    assert len(plot_points[plot_points["model_id"] == "log_levels"]) == 65
    assert len(plot_points[plot_points["model_id"] == "pre_1990_annual_growth"]) == 29
    assert len(plot_points[plot_points["model_id"] == "exclude_2020_2021"]) == 62
    assert len(plot_points[plot_points["model_id"] == "world_gdp_5y_cagr"]) == 60
    assert {
        "model_id",
        "x_value",
        "y_value",
        "fitted_value",
        "line_type",
        "value_format",
    }.issubset(plot_points.columns)
