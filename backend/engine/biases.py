"""Bias modules for prediction adjustment.

Each bias returns a multiplicative factor (1.0 = neutral).
All biases are independently toggleable via ModelSettings.
Combined: B_total = product(all active biases)
"""

import json
import math

DEFAULT_AUDIENCE_MULTIPLIERS = {
    "rally": 1.15,
    "press_conference": 0.90,
    "interview": 0.95,
    "speech": 1.05,
    "debate": 1.10,
    "social_media": 1.00,
}


def repetition_bias(
    times_mentioned_last_n: int,
    n: int = 5,
    boost: float = 0.3,
) -> float:
    """Speakers repeat key phrases. Higher recent frequency -> higher probability.

    B_rep = 1 + boost * (times_mentioned_last_N / N)
    """
    if n <= 0:
        return 1.0
    rate = times_mentioned_last_n / n
    return 1.0 + boost * rate


def audience_bias(
    event_type: str | None,
    audience_multipliers: str | dict | None = None,
) -> float:
    """Different event types shift term probability.

    Rallies amplify catchphrases; press conferences suppress them.
    """
    if not event_type:
        return 1.0

    if isinstance(audience_multipliers, str):
        try:
            multipliers = json.loads(audience_multipliers)
        except (json.JSONDecodeError, TypeError):
            multipliers = DEFAULT_AUDIENCE_MULTIPLIERS
    elif isinstance(audience_multipliers, dict):
        multipliers = audience_multipliers
    else:
        multipliers = DEFAULT_AUDIENCE_MULTIPLIERS

    return multipliers.get(event_type.lower(), 1.0)


def escalation_bias(
    controversy_score: float,
    days_in_news_cycle: float = 1.0,
    escalation_rate: float = 0.05,
) -> float:
    """Contentious topics escalate over time in the news cycle.

    B_esc = 1 + escalation_rate * controversy_score * min(days_in_cycle, 7)
    """
    capped_days = min(days_in_news_cycle, 7.0)
    return 1.0 + escalation_rate * controversy_score * capped_days


def news_reactivity_bias(
    breaking_news_count_24h: int,
    reactivity_coefficient: float = 0.15,
    normalization: float = 5.0,
) -> float:
    """How reactive the speaker is to breaking news.

    B_news = 1 + reactivity_coefficient * (breaking_count_24h / normalization)
    """
    if normalization <= 0:
        return 1.0
    return 1.0 + reactivity_coefficient * (breaking_news_count_24h / normalization)


def platform_priming_bias(
    social_posts_count_48h: int,
    priming_boost: float = 0.1,
    cap: float = 0.4,
) -> float:
    """Social media posts prime speech content.

    B_prime = 1 + min(boost * posts_48h, cap)
    """
    return 1.0 + min(priming_boost * social_posts_count_48h, cap)


def compute_all_biases(
    event_type: str | None = None,
    controversy_score: float = 0.0,
    days_in_news_cycle: float = 1.0,
    breaking_news_count: int = 0,
    social_posts_count: int = 0,
    repetition_count: int = 0,
    repetition_window: int = 5,
    # Settings
    repetition_bias_enabled: bool = True,
    audience_bias_enabled: bool = True,
    escalation_bias_enabled: bool = True,
    news_reactivity_bias_enabled: bool = True,
    platform_priming_bias_enabled: bool = True,
    repetition_boost: float = 0.3,
    escalation_rate: float = 0.05,
    reactivity_coefficient: float = 0.15,
    priming_boost: float = 0.1,
    audience_multipliers: str | dict | None = None,
) -> dict:
    """Compute all biases and return individual values + combined total.

    Returns dict with each bias value and 'total' (product of all active).
    """
    biases = {}

    biases["repetition"] = (
        repetition_bias(repetition_count, repetition_window, repetition_boost)
        if repetition_bias_enabled else 1.0
    )

    biases["audience"] = (
        audience_bias(event_type, audience_multipliers)
        if audience_bias_enabled else 1.0
    )

    biases["escalation"] = (
        escalation_bias(controversy_score, days_in_news_cycle, escalation_rate)
        if escalation_bias_enabled else 1.0
    )

    biases["news_reactivity"] = (
        news_reactivity_bias(breaking_news_count, reactivity_coefficient)
        if news_reactivity_bias_enabled else 1.0
    )

    biases["platform_priming"] = (
        platform_priming_bias(social_posts_count, priming_boost)
        if platform_priming_bias_enabled else 1.0
    )

    total = 1.0
    for v in biases.values():
        total *= v
    biases["total"] = total

    return biases
