from pathlib import Path

import pandas as pd

from copper_model.model import estimate_regional_demand_growth, load_config, run_model


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


def test_all_dashboard_scenarios_run():
    for scenario_name in ["base_case", "bull_case", "bear_case"]:
        config = load_config(Path("config") / f"{scenario_name}.json")
        outputs = run_model(config, Path("data"), macro=_macro_rows())

        assert outputs.forecast["scenario"].eq(scenario_name).all()
        assert outputs.forecast["year"].max() == 2035
        assert outputs.forecast["market_balance_kt"].notna().all()
        assert "ending_stocks_kt" not in outputs.forecast.columns
        assert "implied_price_usd_per_t" not in outputs.forecast.columns
