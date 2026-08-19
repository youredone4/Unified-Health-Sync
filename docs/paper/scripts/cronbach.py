#!/usr/bin/env python3
"""
Cronbach's alpha (overall and per ISO/IEC 25010:2023 dimension) with
bootstrap 95% CIs. Prepared in response to Reviewer 2 comment #7.

Usage:
    python cronbach.py <path/to/survey-responses.csv>

Input CSV format:
    - One row per respondent (n = 28).
    - Columns: `id`, then 26 Likert items (integers 1..5).
    - Column names for the items must begin with the ISO characteristic
      prefix followed by an underscore and item index, e.g.:
        FS_1, FS_2, ... (Functional Suitability)
        PE_1, ...       (Performance Efficiency)
        US_1, ...       (Usability)
        RE_1, ...       (Reliability)
        SE_1, ...       (Security)
        MA_1, ...       (Maintainability)
      Any other naming works — just edit `DIMENSIONS` below.

Output: a Markdown table you can paste straight into §IV-B.

Dependencies: numpy only. No external stats package required.
"""

from __future__ import annotations

import csv
import sys
from typing import Iterable

import numpy as np

DIMENSIONS: dict[str, str] = {
    "FS": "Functional Suitability",
    "PE": "Performance Efficiency",
    "US": "Usability",
    "RE": "Reliability",
    "SE": "Security",
    "MA": "Maintainability",
}

BOOTSTRAP_ITERATIONS = 5_000
RNG_SEED = 20260819  # for reproducibility


def cronbach_alpha(item_matrix: np.ndarray) -> float:
    """
    item_matrix: shape (n_respondents, k_items).

    α = (k / (k − 1)) · (1 − Σ σ²_i / σ²_total)
    """
    n, k = item_matrix.shape
    if k < 2:
        return float("nan")

    item_variances = item_matrix.var(axis=0, ddof=1)
    total_variance = item_matrix.sum(axis=1).var(ddof=1)
    if total_variance == 0:
        return float("nan")

    return (k / (k - 1)) * (1 - item_variances.sum() / total_variance)


def bootstrap_ci(item_matrix: np.ndarray, iterations: int = BOOTSTRAP_ITERATIONS,
                  seed: int = RNG_SEED) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    n = item_matrix.shape[0]
    alphas: list[float] = []
    for _ in range(iterations):
        idx = rng.integers(0, n, size=n)
        sample = item_matrix[idx]
        alpha = cronbach_alpha(sample)
        if np.isfinite(alpha):
            alphas.append(alpha)
    if not alphas:
        return (float("nan"), float("nan"))
    lo, hi = np.percentile(alphas, [2.5, 97.5])
    return float(lo), float(hi)


def load_matrix(path: str) -> tuple[list[str], np.ndarray]:
    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        rows = [row for row in reader if row]

    item_columns = [(i, name) for i, name in enumerate(header) if name != "id"]
    if not item_columns:
        raise SystemExit("no item columns found in CSV")

    values: list[list[float]] = []
    for row in rows:
        respondent_values: list[float] = []
        for i, _ in item_columns:
            respondent_values.append(float(row[i]))
        values.append(respondent_values)

    return [name for _, name in item_columns], np.asarray(values, dtype=float)


def dimension_columns(item_names: Iterable[str], prefix: str) -> list[int]:
    return [i for i, name in enumerate(item_names) if name.startswith(prefix + "_")]


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)

    csv_path = sys.argv[1]
    item_names, matrix = load_matrix(csv_path)

    rows: list[tuple[str, int, float, float, float]] = []

    for prefix, label in DIMENSIONS.items():
        col_ix = dimension_columns(item_names, prefix)
        if not col_ix:
            print(f"# WARNING: no items found for dimension {label} (prefix {prefix}_)", file=sys.stderr)
            continue
        sub = matrix[:, col_ix]
        alpha = cronbach_alpha(sub)
        lo, hi = bootstrap_ci(sub)
        rows.append((label, len(col_ix), alpha, lo, hi))

    overall_alpha = cronbach_alpha(matrix)
    overall_lo, overall_hi = bootstrap_ci(matrix)
    rows.append(("Overall (26 items)", matrix.shape[1], overall_alpha, overall_lo, overall_hi))

    print("| Dimension | Items | α | 95% CI |")
    print("|---|---|---|---|")
    for label, k, a, lo, hi in rows:
        print(f"| {label} | {k} | {a:.3f} | [{lo:.3f}, {hi:.3f}] |")


if __name__ == "__main__":
    main()
