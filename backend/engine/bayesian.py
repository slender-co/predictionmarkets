"""Multi-layer Bayesian inference engine.

Stage 1: Combined prior from base rate + market price
Stage 2: Signal update with confidence weighting
Stage 3: Time decay on signal strength
Stage 4: Calibration correction
"""

import math


def bayesian_update(
    p_market: float,
    r_adj: float,
    k: int = 10,
) -> float:
    """Legacy single-layer Beta-Binomial Bayesian posterior update.

    Kept for backward compatibility when no base rate data is available.
    """
    alpha = p_market * k
    beta = (1.0 - p_market) * k
    delta_yes = r_adj * 5.0
    delta_no = max((1.0 - r_adj) * 2.0, 0.0)
    denominator = alpha + beta + delta_yes + delta_no
    if denominator == 0:
        return 0.5
    return (alpha + delta_yes) / denominator


def bayesian_update_v2(
    p_market: float,
    r_adj: float,
    # Base rate prior
    base_rate: float | None = None,
    k_base: int = 5,
    w_base: float = 0.3,
    # Market prior
    k_market: int = 10,
    # Pseudo-observation strengths
    yes_pseudo: float = 5.0,
    no_pseudo: float = 2.0,
    # Time decay
    hours_since_signals: float = 0.0,
    decay_half_life: float = 24.0,
    # Calibration
    calibration_factor: float = 1.0,
) -> dict:
    """Multi-layer Bayesian update with base rate prior, confidence, decay, and calibration.

    Stage 1 - Combined Prior:
      alpha = w_base*(base_rate*k_base) + w_market*(p_market*k_market)
      beta  = w_base*((1-base_rate)*k_base) + w_market*((1-p_market)*k_market)

    Stage 2 - Signal Update (confidence-weighted):
      confidence = min(r_adj, 1.0) — higher signal = more confident update
      delta_yes = r_adj * confidence * yes_pseudo
      delta_no  = max((1-r_adj) * no_pseudo, 0)

    Stage 3 - Time Decay:
      decay = exp(-ln(2) * hours / half_life)
      delta_yes *= decay, delta_no *= decay

    Stage 4 - Calibration:
      P_model = P_raw * calibration + (1 - calibration) * 0.5

    Returns dict with p_model, confidence, p_base_rate, debug info.
    """
    # Stage 1: Combined prior
    if base_rate is not None and w_base > 0:
        w_market = 1.0 - w_base
        alpha = w_base * (base_rate * k_base) + w_market * (p_market * k_market)
        beta = w_base * ((1.0 - base_rate) * k_base) + w_market * ((1.0 - p_market) * k_market)
        p_base_used = base_rate
    else:
        # No base rate data — pure market prior (legacy behavior)
        alpha = p_market * k_market
        beta = (1.0 - p_market) * k_market
        p_base_used = None

    # Stage 2: Signal update with confidence
    confidence = min(r_adj, 1.0)  # Clamp confidence to [0, 1]
    delta_yes = r_adj * confidence * yes_pseudo
    delta_no = max((1.0 - r_adj) * no_pseudo, 0.0)

    # Stage 3: Time decay
    if hours_since_signals > 0 and decay_half_life > 0:
        decay = math.exp(-math.log(2) * hours_since_signals / decay_half_life)
        delta_yes *= decay
        delta_no *= decay
    else:
        decay = 1.0

    # Posterior
    denominator = alpha + beta + delta_yes + delta_no
    if denominator == 0:
        p_raw = 0.5
    else:
        p_raw = (alpha + delta_yes) / denominator

    # Stage 4: Calibration correction
    # Pulls extreme probabilities toward 0.5 based on historical accuracy
    if calibration_factor < 1.0:
        p_model = p_raw * calibration_factor + (1.0 - calibration_factor) * 0.5
    else:
        p_model = p_raw

    return {
        "p_model": p_model,
        "confidence": round(confidence, 4),
        "p_base_rate": p_base_used,
        "decay_applied": round(decay, 4),
    }
