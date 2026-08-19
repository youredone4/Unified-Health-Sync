#!/usr/bin/env python3
"""
Wilson score 95% confidence interval for the KYC accuracy estimate
(Reviewer 2 comment #4). Reproduces the interval quoted in §V-F.

    python wilson_ci.py [correct] [total]

Defaults: 55 correct of 60 (TP=44 + TN=11 from Table III).
"""

import math
import sys


def wilson_ci(x: int, n: int, z: float = 1.959964) -> tuple[float, float]:
    p = x / n
    denom = 1 + z * z / n
    center = p + z * z / (2 * n)
    spread = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (center - spread) / denom, (center + spread) / denom


def main() -> None:
    x = int(sys.argv[1]) if len(sys.argv) > 1 else 55
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    lo, hi = wilson_ci(x, n)
    print(f"x = {x}, n = {n}, p-hat = {x / n:.4f}")
    print(f"Wilson 95% CI = [{lo:.4f}, {hi:.4f}]  ->  [{lo * 100:.1f}%, {hi * 100:.1f}%]")


if __name__ == "__main__":
    main()
