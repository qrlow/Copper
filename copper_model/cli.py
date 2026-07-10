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
        f"{int(latest['year'])}: balance={latest['market_balance_kt']:.0f} kt, "
        f"cover={latest['inventory_cover_days']:.1f} days, "
        f"price=${latest['implied_price_usd_per_t']:.0f}/t"
    )
    return 0


def plot_command(args: argparse.Namespace) -> int:
    from copper_model.plotting import plot_balance

    output = plot_balance(args.forecast, args.output)
    print(f"wrote {output}")
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

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
