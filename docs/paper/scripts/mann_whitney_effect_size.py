#!/usr/bin/env python3
"""
Mann–Whitney rank-biserial effect size for the six ISO/IEC 25010 dimensions
plus overall. Prepared in response to Reviewer 2 comment #8.

Uses the U values already reported in Table II of the paper. The Mann–Whitney
rank-biserial correlation magnitude is:

    |r| = 1 − (2·U_min) / (n1 · n2)

IMPORTANT — sign convention. The U reported in the submission follows the
SPSS convention of reporting U_min = min(U1, U2), which discards direction.
The magnitude above is therefore unsigned; the *direction* is recovered from
the group mean ranks: r is signed positive when Health Personnel (HP) ranked
higher on average, negative when IT Experts (IT) ranked higher. Two
characteristics — Performance Efficiency and Security — have IT MR > HP MR
and therefore carry a negative HP-referenced sign.

Cohen thresholds on |r|: < 0.10 negligible, 0.10–0.30 small,
0.30–0.50 medium, ≥ 0.50 large.

Output is a Markdown table you can paste straight into Table II.
"""

from dataclasses import dataclass

N_HEALTH = 23
N_IT = 5
PRODUCT = N_HEALTH * N_IT


@dataclass(frozen=True)
class Row:
    label: str
    hp_mean_rank: float
    it_mean_rank: float
    u_value: float   # U_min as reported in the submission (SPSS convention)
    p_value: float


TABLE_II = [
    Row("Functional Suitability", 14.9, 13.5, 39.5, 0.280),
    Row("Performance Efficiency", 14.6, 14.7, 47.0, 0.528),
    Row("Usability",              15.1, 12.4, 56.6, 0.975),  # printed as 56.6 in submission
    Row("Reliability",            14.8, 13.9, 48.0, 0.570),
    Row("Security",               14.3, 16.2, 50.0, 0.659),
    Row("Maintainability",        14.7, 14.3, 54.0, 0.848),
    Row("Overall",                14.8, 14.0, 41.0, 0.330),
]


def magnitude(r_abs: float) -> str:
    if r_abs < 0.10:
        return "negligible"
    if r_abs < 0.30:
        return "small"
    if r_abs < 0.50:
        return "medium"
    return "large"


def main() -> None:
    print("| Characteristic | HP MR | IT MR | U | p | r (rank-biserial) | Magnitude |")
    print("|---|---|---|---|---|---|---|")
    for row in TABLE_II:
        r_abs = 1 - (2 * row.u_value) / PRODUCT
        # Sign is HP-referenced: positive when HP ranked higher on average.
        sign = 1 if row.hp_mean_rank >= row.it_mean_rank else -1
        r_signed = sign * r_abs
        print(
            f"| {row.label} | {row.hp_mean_rank} | {row.it_mean_rank} "
            f"| {row.u_value} | {row.p_value:.3f} | {r_signed:+.3f} "
            f"| {magnitude(r_abs)} |"
        )
    print()
    print("Sign convention: r > 0 → Health Personnel ranked higher on average;")
    print("r < 0 → IT Experts ranked higher. Magnitude from |r| (Cohen bands).")


if __name__ == "__main__":
    main()
