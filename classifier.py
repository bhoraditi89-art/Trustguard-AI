"""Explainable TrustGuard heuristics for identifying deceptive UX copy."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Pattern:
    category: str
    reason: str
    score: int
    patterns: tuple[re.Pattern[str], ...]


PATTERNS: tuple[Pattern, ...] = (
    Pattern(
        category="False Urgency",
        reason="Creates pressure to act immediately with a countdown or scarcity claim.",
        score=38,
        patterns=(
            re.compile(r"\b(?:only|just)\s+\d+\s+(?:left|remaining)\b", re.I),
            re.compile(r"\b(?:ends?|expires?|sale)\s+(?:in|today|soon)\b", re.I),
            re.compile(r"\b(?:hurry|act\s+now|last\s+chance|don't\s+miss)\b", re.I),
            re.compile(r"\b\d{1,2}\s*:\s*\d{2}(?::\s*\d{2})?\b", re.I),
            re.compile(r"\b(?:limited|exclusive)\s+(?:time|offer|stock)\b", re.I),
        ),
    ),
    Pattern(
        category="Hidden Cost",
        reason="Introduces an unexpected fee or obscures the true price until later.",
        score=42,
        patterns=(
            re.compile(r"\b(?:processing|service|convenience|handling|booking)\s+fee\b", re.I),
            re.compile(r"\b(?:additional|extra|plus)\s+(?:fee|charge|cost)s?\b", re.I),
            re.compile(r"\b(?:taxes?|fees?)\s+(?:may\s+)?(?:apply|added)\b", re.I),
            re.compile(r"\b(?:from|starting)\s+\$?\d+(?:\.\d{2})?\b", re.I),
            re.compile(r"\b(?:free|no[-\s]?cost)\b.{0,45}\b(?:shipping|trial)\b", re.I),
        ),
    ),
    Pattern(
        category="Confirmshaming",
        reason="Uses guilt, shame, or a demeaning refusal choice to push acceptance.",
        score=45,
        patterns=(
            re.compile(r"\b(?:no|not)\b.{0,25}\b(?:thanks?|thank you)\b", re.I),
            re.compile(r"\b(?:i\s+don't|i\s+do\s+not)\s+(?:want|like|need)\b", re.I),
            re.compile(r"\b(?:skip|decline|continue)\b.{0,25}\b(?:miss|lose|regret|stay)\b", re.I),
            re.compile(r"\b(?:don't|do\s+not)\s+(?:be|become)\s+(?:cheap|selfish|behind|left\s+out)\b", re.I),
            re.compile(r"\b(?:yes|claim|keep)\b.{0,30}\b(?:smart|savvy|deserve)\b", re.I),
        ),
    ),
)


def _fallback_tokens(text: str) -> list[str]:
    """Small NLP-like fallback for copy that is phrased differently."""
    normalized = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    tokens = set(normalized.split())
    signals: list[str] = []
    urgency = {"urgent", "immediately", "hurry", "today", "now", "limited", "remaining"}
    cost = {"fee", "fees", "charge", "charges", "tax", "taxes", "shipping", "subscription"}
    shame = {"regret", "miss", "selfish", "cheap", "behind", "foolish"}
    if len(tokens & urgency) >= 2:
        signals.append("language cluster: pressure")
    if len(tokens & cost) >= 2:
        signals.append("language cluster: price ambiguity")
    if len(tokens & shame) >= 1 and {"no", "not", "skip", "decline"} & tokens:
        signals.append("language cluster: guilt")
    return signals


def classify_text(text: str) -> list[dict[str, object]]:
    """Return all flagged categories for one snippet, with explainable scores."""
    cleaned = " ".join(text.split())
    if not cleaned:
        return []

    results: list[dict[str, object]] = []
    fallback_signals = _fallback_tokens(cleaned)
    for pattern in PATTERNS:
        signals = [match.group(0) for regex in pattern.patterns if (match := regex.search(cleaned))]
        if not signals and fallback_signals:
            if pattern.category == "False Urgency" and "language cluster: pressure" in fallback_signals:
                signals = ["NLP fallback: pressure language"]
            elif pattern.category == "Hidden Cost" and "language cluster: price ambiguity" in fallback_signals:
                signals = ["NLP fallback: price ambiguity"]
            elif pattern.category == "Confirmshaming" and "language cluster: guilt" in fallback_signals:
                signals = ["NLP fallback: guilt language"]
        if signals:
            threat_score = min(99, pattern.score + max(0, len(signals) - 1) * 11)
            results.append(
                {
                    "text": cleaned,
                    "category": pattern.category,
                    "reason": pattern.reason,
                    "threatScore": threat_score,
                    "signals": signals,
                }
            )
    return results


def analyze_items(items: list[str]) -> list[dict[str, object]]:
    """Classify a list and flatten results in source order."""
    flagged: list[dict[str, object]] = []
    for item in items:
        flagged.extend(classify_text(item))
    return flagged