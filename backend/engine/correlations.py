"""Correlation engine — computes S6 (Cross-Term Correlation Boost).

Supports positive, negative, and conditional correlation types.
Also provides portfolio diversity scoring.
"""


def check_tweet_cooccurrence(term1: str, term2: str, tweet_text: str) -> bool:
    """Check if both terms appear in the same tweet text."""
    t1 = term1.lower()
    t2 = term2.lower()
    text = tweet_text.lower()
    return t1 in text and t2 in text


def compute_correlation_boost(
    term_id: int,
    session_terms: list,
    correlated_pairs: list,
) -> float:
    """Compute S6 for a term based on correlated terms' composite scores.

    For positive correlations: if correlated term is strong, boost this term.
    For negative correlations: if anti-correlated term is strong, reduce this term.
    For conditional: use conditional_probability as direct boost.

    S6 = 0.5 + mean(adjustments)  -- centered at 0.5 (neutral)
    Clamped to [0, 1].
    """
    adjustments = []

    for pair in correlated_pairs:
        if pair.term1_id == term_id:
            other_id = pair.term2_id
        elif pair.term2_id == term_id:
            other_id = pair.term1_id
        else:
            continue

        other_term = None
        for t in session_terms:
            if t.id == other_id:
                other_term = t
                break

        if other_term is None or other_term.r_adj is None:
            continue

        strength = getattr(pair, "correlation_strength", 0.5) or 0.5
        corr_type = getattr(pair, "correlation_type", "positive") or "positive"

        if corr_type == "negative":
            # Anti-correlation: strong other term reduces this term
            adjustments.append(-strength * other_term.r_adj)
        elif corr_type == "conditional":
            # Use conditional probability directly if available
            cond_p = getattr(pair, "conditional_probability", None)
            if cond_p is not None:
                adjustments.append(strength * cond_p)
            else:
                adjustments.append(strength * other_term.r_adj)
        else:
            # Positive correlation: strong other term boosts this term
            adjustments.append(strength * other_term.r_adj)

    if not adjustments:
        return 0.5  # Neutral — no correlation data

    mean_adj = sum(adjustments) / len(adjustments)
    return max(0.0, min(1.0, 0.5 + mean_adj))


def compute_portfolio_diversity(session_terms: list) -> float:
    """Score how diversified the bet portfolio is.

    Returns diversity score [0, 1] based on signal distribution.
    Higher = more diversified, lower = concentrated in similar bets.
    """
    if not session_terms:
        return 0.0

    signals = []
    for t in session_terms:
        sig = getattr(t, "signal", None)
        if sig and sig != "PASS":
            signals.append(sig)

    if len(signals) <= 1:
        return 1.0  # Single bet is maximally "diversified" (no overlap)

    # Count unique signal types as fraction of total
    unique = len(set(signals))
    return unique / len(signals)
