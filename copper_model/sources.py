"""Public data-source fetchers for the copper model."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import time
from typing import Mapping

import pandas as pd
import requests

FRED_COPPER_PRICE_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PCOPPUSDM"
WORLD_BANK_ENDPOINT = (
    "https://api.worldbank.org/v2/country/{country}/indicator/{indicator}"
)

WORLD_BANK_COUNTRIES: Mapping[str, str] = {
    "World": "WLD",
    "China": "CHN",
    "United States": "USA",
    "European Union": "EUU",
}

WORLD_BANK_INDICATORS: Mapping[str, str] = {
    "gdp_constant_usd": "NY.GDP.MKTP.KD",
    "industry_value_added_share_of_gdp": "NV.IND.TOTL.ZS",
    "population": "SP.POP.TOTL",
}


@dataclass(frozen=True)
class FetchResult:
    name: str
    rows: int
    path: Path


def _get_json(url: str, params: Mapping[str, object]) -> object:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = requests.get(url, params=params, timeout=120)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as error:
            last_error = error
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Request failed after retries: {url}") from last_error


def fetch_fred_copper_price(output_path: Path) -> FetchResult:
    """Fetch monthly IMF/FRED copper prices."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    price = pd.read_csv(FRED_COPPER_PRICE_CSV)
    price = price.rename(
        columns={
            "DATE": "date",
            "observation_date": "date",
            "PCOPPUSDM": "price_usd_per_t",
        }
    )
    missing = {"date", "price_usd_per_t"} - set(price.columns)
    if missing:
        raise ValueError(f"FRED response missing columns: {sorted(missing)}")
    price["date"] = pd.to_datetime(price["date"], errors="coerce")
    price["price_usd_per_t"] = pd.to_numeric(price["price_usd_per_t"], errors="coerce")
    price = price.dropna(subset=["date", "price_usd_per_t"])
    price.to_csv(output_path, index=False)
    return FetchResult("fred_copper_price", len(price), output_path)


def fetch_world_bank_indicators(output_path: Path) -> FetchResult:
    """Fetch World Bank macro drivers for configured aggregate regions."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, object]] = []
    countries = ";".join(WORLD_BANK_COUNTRIES.values())
    country_names_by_code = {code: name for name, code in WORLD_BANK_COUNTRIES.items()}

    for indicator_name, indicator_code in WORLD_BANK_INDICATORS.items():
        url = WORLD_BANK_ENDPOINT.format(country=countries, indicator=indicator_code)
        payload = _get_json(url, {"format": "json", "per_page": 20000})
        if not isinstance(payload, list) or len(payload) < 2:
            raise ValueError(f"Unexpected World Bank response for {indicator_code}")
        observations = payload[1] or []
        for item in observations:
            value = item.get("value")
            country_code = item.get("countryiso3code")
            if value is None or country_code not in country_names_by_code:
                continue
            rows.append(
                {
                    "country": country_names_by_code[country_code],
                    "country_code": country_code,
                    "indicator": indicator_name,
                    "indicator_code": indicator_code,
                    "year": int(item["date"]),
                    "value": float(value),
                }
            )

    data = pd.DataFrame(rows)
    data = data.sort_values(["country_code", "indicator", "year"])
    data.to_csv(output_path, index=False)
    return FetchResult("world_bank_indicators", len(data), output_path)


def fetch_all(data_dir: Path) -> list[FetchResult]:
    """Fetch all public data feeds used by the model."""

    raw_dir = data_dir / "raw"
    return [
        fetch_fred_copper_price(raw_dir / "copper_price_fred.csv"),
        fetch_world_bank_indicators(raw_dir / "world_bank_indicators.csv"),
    ]
