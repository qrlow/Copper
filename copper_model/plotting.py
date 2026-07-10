"""Plotting helpers for model outputs."""

from __future__ import annotations

import os
from pathlib import Path
import tempfile

os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "copper-model-mpl"))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd


def plot_balance(forecast_path: Path, output_path: Path) -> Path:
    forecast = pd.read_csv(forecast_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fig, axes = plt.subplots(2, 1, figsize=(11, 8), sharex=True)
    ax = axes[0]
    ax.plot(forecast["year"], forecast["demand_kt"], label="Demand", linewidth=2.2)
    ax.plot(
        forecast["year"],
        forecast["refined_supply_kt"],
        label="Refined supply",
        linewidth=2.2,
    )
    ax.set_ylabel("Thousand metric tons")
    ax.set_title("Global refined copper supply-demand balance")
    ax.grid(True, alpha=0.25)
    ax.legend()

    ax2 = axes[1]
    ax2.bar(
        forecast["year"],
        forecast["market_balance_kt"],
        label="Market balance",
        color="#5b8db8",
    )
    ax2.axhline(0, color="#333333", linewidth=1)
    ax2.set_ylabel("Balance, kt")
    ax2.grid(True, axis="y", alpha=0.25)
    ax2.legend(loc="upper left")
    ax2.set_xlabel("Year")

    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return output_path
