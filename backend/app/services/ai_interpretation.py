"""Local rule-based analytics interpretation (no external AI dependency)."""
from __future__ import annotations

from typing import Any

def _pct(v: float) -> str:
    return f"{v:.1f}%"


def _php(v: float) -> str:
    return f"PHP {v:,.2f}"


def generate_expense_interpretation(
    *,
    context_year: int,
    quarter: int,
    quarter_label: str,
    total_php: float,
    categories: list[dict[str, Any]],
    largest: dict[str, Any],
    smallest: dict[str, Any],
    concentration: str,
) -> str:
    if total_php <= 0 or not categories:
        return "No data available yet."

    ranked = sorted(categories, key=lambda x: float(x.get("percentage") or 0), reverse=True)
    dominant = [c for c in ranked if float(c.get("percentage") or 0) >= 20.0]
    top_two_share = sum(float(c.get("percentage") or 0) for c in ranked[:2])
    non_zero = [float(c.get("percentage") or 0) for c in ranked if float(c.get("percentage") or 0) > 0]
    spread = (max(non_zero) - min(non_zero)) if len(non_zero) >= 2 else 0.0

    if top_two_share >= 85 or float(largest["percentage"]) >= 70:
        unusual = "This is an unusual cost spread because spending is heavily concentrated in very few categories."
    elif spread <= 12 and len(non_zero) >= 3:
        unusual = "This quarter shows an unusually even spread, with costs distributed across categories rather than concentrated in one item."
    else:
        unusual = "The distribution is within expected operating variance, with no extreme category skew."

    if concentration == "highly concentrated":
        impact = (
            f"Because spending is highly concentrated, controlling {largest['label']} will have the largest impact on total expenses."
        )
    elif concentration == "moderately concentrated":
        impact = (
            f"Costs are moderately concentrated, so improving {largest['label']} and the next major category can materially lower total expenses."
        )
    else:
        impact = "Costs are relatively balanced, so savings will likely come from multiple smaller controls instead of one single action."

    dominant_text = (
        ", ".join(f"{c['label']} ({_pct(float(c['percentage']))})" for c in dominant[:3]) if dominant else "none"
    )

    lines = [
        f"For {quarter_label} {context_year}, total operational expense is {_php(total_php)}.",
        (
            f"The highest contributor is {largest['label']} at {_pct(float(largest['percentage']))} "
            f"({_php(float(largest['amount_php']))}), while the lowest is {smallest['label']} at "
            f"{_pct(float(smallest['percentage']))} ({_php(float(smallest['amount_php']))})."
        ),
        f"Dominant contributors (20% and above): {dominant_text}.",
        unusual,
        impact,
    ]
    return " ".join(lines)

