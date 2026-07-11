"""Command-line interface for the copper model."""

from __future__ import annotations

import argparse
from pathlib import Path

from copper_model.model import load_config, run_model, write_outputs


def _default_root() -> Path:
    return Path.cwd()


def fetch_command(args: argparse.Namespace) -> int:
    from copper_model.sources import fetch_all

    results = fetch_all(args.data_dir)
    for result in results:
        print(f"fetched {result.name}: {result.rows} rows -> {result.path}")
    return 0


def forecast_command(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    outputs = run_model(config, args.data_dir)
    paths = write_outputs(outputs, args.output_dir, config["scenario_name"])
    for path in paths:
        print(f"wrote {path}")
    latest = outputs.forecast.iloc[-1]
    print(
        "final year "
        f"{int(latest['year'])}: demand={latest['demand_kt']:.0f} kt, "
        f"supply={latest['refined_supply_kt']:.0f} kt, "
        f"balance={latest['market_balance_kt']:.0f} kt"
    )
    return 0


def forecast_all_command(args: argparse.Namespace) -> int:
    for config_path in args.config:
        config = load_config(config_path)
        outputs = run_model(config, args.data_dir)
        paths = write_outputs(outputs, args.output_dir, config["scenario_name"])
        print(f"scenario {config['scenario_name']}")
        for path in paths:
            print(f"  wrote {path}")
    return 0


def plot_command(args: argparse.Namespace) -> int:
    from copper_model.plotting import plot_balance

    output = plot_balance(args.forecast, args.output)
    print(f"wrote {output}")
    return 0


def estimate_weights_command(args: argparse.Namespace) -> int:
    from copper_model.regression import estimate_driver_weights, write_regression_outputs

    outputs = estimate_driver_weights(args.data_dir, args.window_years)
    paths = write_regression_outputs(outputs, args.output_dir)
    for path in paths:
        print(f"wrote {path}")

    fit = outputs.fit.iloc[0]
    print(
        "driver-weight regression "
        f"{int(fit['sample_start_year'])}-{int(fit['sample_end_year'])}, "
        f"observations={int(fit['observations'])}, "
        f"r_squared={fit['r_squared']:.3f}"
    )
    for row in outputs.summary.itertuples(index=False):
        print(f"  {row.model_field}: {row.recommended_weight:.3f}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    root = _default_root()
    parser = argparse.ArgumentParser(
        prog="copper-model",
        description="Global copper supply-demand model using public data.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch = subparsers.add_parser("fetch", help="Download public data feeds")
    fetch.add_argument("--data-dir", type=Path, default=root / "data")
    fetch.set_defaults(func=fetch_command)

    forecast = subparsers.add_parser("forecast", help="Run the forecast model")
    forecast.add_argument(
        "--config", type=Path, default=root / "config" / "base_case.json"
    )
    forecast.add_argument("--data-dir", type=Path, default=root / "data")
    forecast.add_argument("--output-dir", type=Path, default=root / "outputs")
    forecast.set_defaults(func=forecast_command)

    forecast_all = subparsers.add_parser(
        "forecast-all", help="Run all dashboard scenario forecasts"
    )
    forecast_all.add_argument(
        "--config",
        type=Path,
        nargs="+",
        default=[
            root / "config" / "base_case.json",
            root / "config" / "bull_case.json",
            root / "config" / "bear_case.json",
        ],
    )
    forecast_all.add_argument("--data-dir", type=Path, default=root / "data")
    forecast_all.add_argument("--output-dir", type=Path, default=root / "outputs")
    forecast_all.set_defaults(func=forecast_all_command)

    plot = subparsers.add_parser("plot", help="Plot a forecast CSV")
    plot.add_argument(
        "--forecast",
        type=Path,
        default=root / "outputs" / "base_case_forecast.csv",
    )
    plot.add_argument(
        "--output",
        type=Path,
        default=root / "outputs" / "base_case_balance.png",
    )
    plot.set_defaults(func=plot_command)

    estimate_weights = subparsers.add_parser(
        "estimate-weights",
        help="Estimate demand driver weights from public historical data",
    )
    estimate_weights.add_argument("--data-dir", type=Path, default=root / "data")
    estimate_weights.add_argument("--output-dir", type=Path, default=root / "outputs")
    estimate_weights.add_argument(
        "--window-years",
        type=int,
        default=1,
        help="Growth window for the regression observations",
    )
    estimate_weights.set_defaults(func=estimate_weights_command)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
