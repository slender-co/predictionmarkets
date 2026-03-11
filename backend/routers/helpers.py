"""Shared helpers for routers — centralized settings extraction and term analysis."""

from sqlalchemy.orm import Session as DbSession
from sqlalchemy import func
from models import ModelSettings, MarketTerm, BaseRate
from engine.kelly import run_analysis


def get_all_settings(db: DbSession) -> dict:
    """Extract all model settings into a dict suitable for run_analysis()."""
    s = db.get(ModelSettings, 1)
    return {
        "weights": (s.s1_weight, s.s2_weight, s.s3_weight),
        "k": s.k_value,
        "kelly_divisor": s.kelly_divisor,
        "edge_thresholds": (s.strong_edge_threshold, s.long_edge_threshold, s.watch_edge_threshold),
        # V2 signal weights
        "s4_weight": s.s4_weight,
        "s5_weight": s.s5_weight,
        "s6_weight": s.s6_weight,
        "s7_weight": s.s7_weight,
        # V2 Bayesian
        "k_base": s.k_base,
        "w_base": s.w_base,
        "yes_pseudo": s.yes_pseudo,
        "no_pseudo": s.no_pseudo,
        "decay_half_life": s.decay_half_life,
        "source_half_life": s.source_half_life,
        "calibration_factor": s.calibration_factor,
        # Bias toggles
        "repetition_bias_enabled": s.repetition_bias_enabled,
        "audience_bias_enabled": s.audience_bias_enabled,
        "escalation_bias_enabled": s.escalation_bias_enabled,
        "news_reactivity_bias_enabled": s.news_reactivity_bias_enabled,
        "platform_priming_bias_enabled": s.platform_priming_bias_enabled,
        # Bias params
        "repetition_boost": s.repetition_boost,
        "escalation_rate": s.escalation_rate,
        "reactivity_coefficient": s.reactivity_coefficient,
        "priming_boost": s.priming_boost,
        "audience_multipliers": s.audience_multipliers,
    }


def compute_base_rate_for_term(db: DbSession, speaker: str, term_text: str) -> float | None:
    """Look up historical base rate for a speaker + term combination."""
    speaker_lower = speaker.strip().lower()
    term_lower = term_text.strip().lower()

    total = db.query(func.count(BaseRate.id)).filter(
        BaseRate.speaker == speaker_lower,
        BaseRate.term == term_lower,
    ).scalar()

    if not total or total == 0:
        return None

    mentioned = db.query(func.count(BaseRate.id)).filter(
        BaseRate.speaker == speaker_lower,
        BaseRate.term == term_lower,
        BaseRate.mentioned == True,
    ).scalar()

    return mentioned / total


def run_term_analysis(term: MarketTerm, settings: dict, db: DbSession = None, speaker: str = None) -> None:
    """Run analysis on a MarketTerm and populate its computed fields."""
    # Auto-compute base rate (S4) if we have a db session and speaker
    base_rate = None
    if db and speaker:
        base_rate = compute_base_rate_for_term(db, speaker, term.term)

    result = run_analysis(
        yes_price=term.yes_price,
        no_price=term.no_price,
        s1=term.s1_score,
        s2=term.s2_score,
        s3=term.s3_score,
        tweet_within_6h=term.tweet_within_6h,
        # V2 signals
        s4=term.s4_score,
        s5=term.s5_score,
        s6=term.s6_score,
        s7=term.s7_score,
        # V2 bias inputs
        event_type=term.event_type,
        controversy_score=term.controversy_score or 0.0,
        breaking_news_count=term.breaking_news_count or 0,
        social_posts_count=term.social_posts_count or 0,
        source_hours_ago=term.source_hours_ago,
        # Base rate
        base_rate=base_rate,
        **settings,
    )

    # Store all computed fields
    term.p_market = result["p_market"]
    term.r_adj = result["r_adj"]
    term.p_model = result["p_model"]
    term.edge_pp = result["edge_pp"]
    term.kelly_fraction = result["kelly_fraction"]
    term.signal = result["signal"]
    # V2 computed
    term.bias_total = result["bias_total"]
    term.confidence = result["confidence"]
    term.p_base_rate = result["p_base_rate"]
    # Store auto-computed signal values
    if result["s4"] is not None:
        term.s4_score = result["s4"]
    if result["s5"] is not None:
        term.s5_score = result["s5"]
    if result["s6"] is not None:
        term.s6_score = result["s6"]
