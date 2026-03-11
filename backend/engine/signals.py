"""Signal computation module — expanded from 3 to 7 signals.

S1: Social Media Sentiment (manual, 0-1)
S2: Transcript Pattern (manual, 0-1)
S3: News Cycle Momentum (manual, 0-1)
S4: Base Rate Prior (auto-computed from historical data)
S5: Source Proximity / Recency (continuous decay replacing binary tweet flag)
S6: Cross-Term Correlation Boost (auto-computed from correlated terms)
S7: Contrarian / Market Inefficiency (manual conviction score)
"""

import math

DEFAULT_WEIGHTS_3 = (0.40, 0.35, 0.25)
DEFAULT_WEIGHTS_7 = (0.25, 0.20, 0.15, 0.15, 0.10, 0.08, 0.07)


def compute_composite(
    s1: float,
    s2: float,
    s3: float,
    tweet_within_6h: bool,
    weights: tuple[float, float, float] = DEFAULT_WEIGHTS_3,
) -> float:
    """Legacy 3-signal composite. Kept for backward compatibility.

    R = (S1 * w1) + (S2 * w2) + (S3 * w3)
    R_adj = R * 1.5 if tweet posted within 6 hours, else R
    """
    w1, w2, w3 = weights
    r = (s1 * w1) + (s2 * w2) + (s3 * w3)
    r_adj = r * 1.5 if tweet_within_6h else r
    return max(r_adj, 0.0)


def compute_s4_base_rate(
    mention_rate: float,
    days_since_last_mention: float | None = None,
    lookback_days: float = 90.0,
    decay_factor: float = 0.8,
) -> float:
    """S4: Base Rate Prior signal.

    S4 = mention_rate * recency_weight
    recency_weight = clamp(1.0 - decay_factor * days_since / lookback, 0.2, 1.0)

    If no mention data, returns 0.5 (uninformative).
    """
    if mention_rate is None:
        return 0.5

    if days_since_last_mention is not None and lookback_days > 0:
        recency = 1.0 - decay_factor * (days_since_last_mention / lookback_days)
        recency = max(0.2, min(1.0, recency))
    else:
        recency = 1.0

    return mention_rate * recency


def compute_s5_source_proximity(
    source_hours_ago: float | None = None,
    source_relevance: float = 1.0,
    half_life_hours: float = 6.0,
    tweet_within_6h: bool = False,
) -> float:
    """S5: Source Proximity / Recency signal.

    S5 = source_relevance * exp(-ln(2) / half_life * hours_ago)

    Falls back to legacy binary: tweet_within_6h=True -> 1.0, False -> 0.0
    """
    if source_hours_ago is not None:
        if half_life_hours <= 0:
            return source_relevance
        lam = math.log(2) / half_life_hours
        return source_relevance * math.exp(-lam * source_hours_ago)

    # Legacy fallback
    return 1.0 if tweet_within_6h else 0.0


def compute_composite_v2(
    s1: float,
    s2: float,
    s3: float,
    s4: float | None = None,
    s5: float | None = None,
    s6: float | None = None,
    s7: float | None = None,
    weights: tuple = DEFAULT_WEIGHTS_7,
    bias_total: float = 1.0,
) -> float:
    """Enhanced 7-signal composite with bias multiplication.

    R_raw = sum(S_i * w_i) for active signals
    R_adj = R_raw * B_total
    Floor at 0.0

    When S4-S7 are None, their weight redistributes proportionally to S1-S3.
    """
    signals = [s1, s2, s3, s4, s5, s6, s7]

    # Ensure we have exactly 7 weights (pad with defaults if 3 provided)
    if len(weights) == 3:
        w = list(DEFAULT_WEIGHTS_7)
        w[0], w[1], w[2] = weights[0], weights[1], weights[2]
        # Redistribute remaining weight proportionally
        remaining = 1.0 - sum(weights)
        if remaining > 0:
            for i in range(3, 7):
                w[i] = DEFAULT_WEIGHTS_7[i] * (remaining / sum(DEFAULT_WEIGHTS_7[3:]))
        weights = tuple(w)

    w = list(weights[:7])

    # Find which signals are active vs None
    active_weight = 0.0
    inactive_weight = 0.0
    for i in range(7):
        if signals[i] is not None:
            active_weight += w[i]
        else:
            inactive_weight += w[i]

    if active_weight == 0:
        return 0.0

    # Redistribute inactive weight proportionally among active signals
    scale = 1.0
    if inactive_weight > 0 and active_weight > 0:
        scale = (active_weight + inactive_weight) / active_weight

    r_raw = 0.0
    for i in range(7):
        if signals[i] is not None:
            r_raw += signals[i] * w[i] * scale

    r_adj = r_raw * bias_total
    return max(r_adj, 0.0)
