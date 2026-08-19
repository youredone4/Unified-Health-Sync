#!/usr/bin/env python3
"""
Mann–Whitney rank-biserial effect size for the six ISO/IEC 25010 dimensions
plus overall. Prepared in response to Reviewer 2 comment #8.

Uses the U values already reported in Table II of the paper. The Mann–Whitney
rank-biserial correlation is:

    r = 1 − (2U) / (n1 · n2)

Cohen thresholds: |r| < 0.10 negligible, 0.10–0.30 small, 0.30–0.50 medium,
≥ 0.50 large.

Output is a Markdown table you can paste straight into Table II.
"""

from dataclasses import dataclass

N_HEALTH = 23
N_IT = 5
PRODUCT = N_HEALTH * N_IT


@dataclass(frozen=True)
class Row:
    label: str
    u_value: float
    p_value: float


TABLE_II = [
    Row("Functional Suitability", 39.5, 0.280),
    Row("Performance Efficiency", 47.0, 0.528),
    Row("Usability",              56.6, 0.975),  # printed as 56.6 in submission
    Row("Reliability",            48.0, 0.570),
    Row("Security",               50.0, 0.659),
    Row("Maintainability",        54.0, 0.848),
    Row("Overall",                41.0, 0.330),
]


def magnitude(r: float) -> str:
    a = abs(r)
    if a < 0.10:
        return "negligible"
    if a < 0.30:
        return "small"
    if a < 0.50:
        return "medium"
    return "large"


def main() -> None:
    print("| Characteristic | HP MR | IT MR | U | p | r (rank-biserial) | Magnitude |")
    print("|---|---|---|---|---|---|---|")
    # HP/IT mean ranks copied from Table II for convenience:
    ranks = {
        "Functional Suitability": (14.9, 13.5),
        "Performance Efficiency": (14.6, 14.7),
        "Usability":              (15.1, 12.4),
        "Reliability":            (14.8, 13.9),
        "Security":               (14.3, 16.2),
        "Maintainability":        (14.7, 14.3),
        "Overall":                (14.8, 14.0),
    }
    for row in TABLE_II:
        r = 1 - (2 * row.u_value) / PRODUCT
        hp_mr, it_mr = ranks[row.label]
        print(f"| {row.label} | {hp_mr} | {it_mr} | {row.u_value} | {row.p_value:.3f} "
              f"| {r:+.3f} | {magnitude(r)} |")


if __name__ == "__main__":
    main()
