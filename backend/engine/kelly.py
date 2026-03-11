from dataclasses import dataclass
from enum import Enum


class Signal(str, Enum):
    STRONG_LONG = "STRONG_LONG"
    LONG = "LONG"
    WATCH = "WATCH"
    PASS = "PASS"
    SHORT = "SHORT"


@dataclass
class KellyResult:
    kelly_fraction: float
    edge_pp: float
    signal: Signal
    direction: str  # "YES" or "NO" or "NONE"


def compute_kelly(
    p_model: float,
    yes_price: float,
    no_price: float,
    kelly_divisor: float = 1.0,
    edge_thresholds: tuple[float, float, float] = (25.0, 12.0, 8.0),
) -> KellyResult:
    """Kelly Criterion position sizing with signal classification.

    f* = (b * p - q) / b
    where b = net decimal odds, p = model probability, q = 1 - p

    Returns KellyResult with fraction, edge in percentage points, and signal.
    """
    price_sum = yes_price + no_price
    if price_sum == 0:
        return KellyResult(0.0, 0.0, Signal.PASS, "NONE")

    p_market = yes_price / price_sum
    edge_pp = (p_model - p_market) * 100.0

    # Kelly for YES side
    f_yes = 0.0
    if 0 < yes_price < 1:
        b_yes = (1.0 - yes_price) / yes_price
        f_yes = (b_yes * p_model - (1.0 - p_model)) / b_yes

    # Kelly for NO side
    f_no = 0.0
    if 0 < no_price < 1:
        b_no = (1.0 - no_price) / no_price
        p_no = 1.0 - p_model
        f_no = (b_no * p_no - p_model) / b_no

    # Apply Kelly divisor (fractional Kelly)
    f_yes_adj = max(f_yes / kelly_divisor, 0.0)
    f_no_adj = max(f_no / kelly_divisor, 0.0)

    strong_th, long_th, watch_th = edge_thresholds

    # SHORT: model favors NO and there's positive Kelly on the No side
    if f_no_adj > 0 and edge_pp < -watch_th:
        return KellyResult(
            kelly_fraction=f_no_adj,
            edge_pp=edge_pp,
            signal=Signal.SHORT,
            direction="NO",
        )

    # LONG signals
    if edge_pp >= strong_th:
        return KellyResult(f_yes_adj, edge_pp, Signal.STRONG_LONG, "YES")
    elif edge_pp >= long_th:
        return KellyResult(f_yes_adj, edge_pp, Signal.LONG, "YES")
    elif edge_pp >= watch_th:
        return KellyResult(f_yes_adj, edge_pp, Signal.WATCH, "YES")
    else:
        return KellyResult(f_yes_adj, edge_pp, Signal.PASS, "NONE")


def run_analysis(
    yes_price: float,
    no_price: float,
    s1: float,
    s2: float,
    s3: float,
    tweet_within_6h: bool = False,
    weights: tuple = (0.40, 0.35, 0.25),
    k: int = 10,
    kelly_divisor: float = 1.0,
    edge_thresholds: tuple[float, float, float] = (25.0, 12.0, 8.0),
    # ── V2 signals (all optional for backward compat) ──
    s4: float | None = None,
    s5: float | None = None,
    s6: float | None = None,
    s7: float | None = None,
    # ── V2 bias inputs ──
    event_type: str | None = None,
    controversy_score: float = 0.0,
    days_in_news_cycle: float = 1.0,
    breaking_news_count: int = 0,
    social_posts_count: int = 0,
    repetition_count: int = 0,
    repetition_window: int = 5,
    source_hours_ago: float | None = None,
    # ── V2 base rate ──
    base_rate: float | None = None,
    # ── V2 Bayesian params ──
    k_base: int = 5,
    w_base: float = 0.3,
    yes_pseudo: float = 5.0,
    no_pseudo: float = 2.0,
    decay_half_life: float = 24.0,
    hours_since_signals: float = 0.0,
    calibration_factor: float = 1.0,
    # ── V2 extended weights (7-signal) ──
    s4_weight: float = 0.15,
    s5_weight: float = 0.10,
    s6_weight: float = 0.08,
    s7_weight: float = 0.07,
    # ── V2 bias settings ──
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
    source_half_life: float = 6.0,
) -> dict:
    """Run the full analysis pipeline.

    V1 path: When s4-s7 are all None and no bias inputs, uses legacy 3-signal
              composite + single-layer Bayesian. Produces identical results.
    V2 path: Uses expanded 7-signal composite, bias modules, multi-layer Bayesian.

    Returns a dict with all computed fields ready for storage.
    """
    from engine.signals import compute_composite, compute_composite_v2, compute_s5_source_proximity
    from engine.bayesian import bayesian_update, bayesian_update_v2
    from engine.biases import compute_all_biases

    price_sum = yes_price + no_price
    p_market = yes_price / price_sum if price_sum > 0 else 0.5

    # Determine if we're in V2 mode
    v2_mode = any([
        s4 is not None, s5 is not None, s6 is not None, s7 is not None,
        event_type is not None, controversy_score > 0, breaking_news_count > 0,
        social_posts_count > 0, source_hours_ago is not None, base_rate is not None,
    ])

    if v2_mode:
        # ── V2 Pipeline ──

        # Compute S5 from source proximity if not directly provided
        if s5 is None and source_hours_ago is not None:
            s5 = compute_s5_source_proximity(
                source_hours_ago=source_hours_ago,
                half_life_hours=source_half_life,
            )
        elif s5 is None and tweet_within_6h:
            s5 = 1.0

        # Compute biases
        bias_result = compute_all_biases(
            event_type=event_type,
            controversy_score=controversy_score,
            days_in_news_cycle=days_in_news_cycle,
            breaking_news_count=breaking_news_count,
            social_posts_count=social_posts_count,
            repetition_count=repetition_count,
            repetition_window=repetition_window,
            repetition_bias_enabled=repetition_bias_enabled,
            audience_bias_enabled=audience_bias_enabled,
            escalation_bias_enabled=escalation_bias_enabled,
            news_reactivity_bias_enabled=news_reactivity_bias_enabled,
            platform_priming_bias_enabled=platform_priming_bias_enabled,
            repetition_boost=repetition_boost,
            escalation_rate=escalation_rate,
            reactivity_coefficient=reactivity_coefficient,
            priming_boost=priming_boost,
            audience_multipliers=audience_multipliers,
        )
        bias_total = bias_result["total"]

        # Build 7-signal weights
        if len(weights) >= 3:
            w1, w2, w3 = weights[0], weights[1], weights[2]
        else:
            w1, w2, w3 = 0.40, 0.35, 0.25
        full_weights = (w1, w2, w3, s4_weight, s5_weight, s6_weight, s7_weight)

        # Composite with all signals + biases
        r_adj = compute_composite_v2(
            s1=s1, s2=s2, s3=s3,
            s4=s4, s5=s5, s6=s6, s7=s7,
            weights=full_weights,
            bias_total=bias_total,
        )

        # Multi-layer Bayesian
        bayes_result = bayesian_update_v2(
            p_market=p_market,
            r_adj=r_adj,
            base_rate=base_rate,
            k_base=k_base,
            w_base=w_base,
            k_market=k,
            yes_pseudo=yes_pseudo,
            no_pseudo=no_pseudo,
            hours_since_signals=hours_since_signals,
            decay_half_life=decay_half_life,
            calibration_factor=calibration_factor,
        )
        p_model = bayes_result["p_model"]
        confidence = bayes_result["confidence"]
        p_base_rate = bayes_result["p_base_rate"]

    else:
        # ── V1 Pipeline (legacy — identical output) ──
        r_adj = compute_composite(s1, s2, s3, tweet_within_6h, weights[:3])
        p_model = bayesian_update(p_market, r_adj, k)
        bias_total = 1.0
        confidence = round(min(r_adj, 1.0), 4)
        p_base_rate = None
        bias_result = None

    # Kelly criterion (same for both paths)
    result = compute_kelly(p_model, yes_price, no_price, kelly_divisor, edge_thresholds)

    return {
        "p_market": round(p_market, 4),
        "r_adj": round(r_adj, 4),
        "p_model": round(p_model, 4),
        "edge_pp": round(result.edge_pp, 2),
        "kelly_fraction": round(result.kelly_fraction, 4),
        "signal": result.signal.value,
        # V2 fields
        "bias_total": round(bias_total, 4),
        "confidence": confidence,
        "p_base_rate": round(p_base_rate, 4) if p_base_rate is not None else None,
        "s4": round(s4, 4) if s4 is not None else None,
        "s5": round(s5, 4) if s5 is not None else None,
        "s6": round(s6, 4) if s6 is not None else None,
        "s7": round(s7, 4) if s7 is not None else None,
    }
