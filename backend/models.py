from datetime import datetime, timezone
from sqlalchemy import (
    Integer, String, Float, Boolean, Text, ForeignKey, CheckConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subject_name: Mapped[str] = mapped_column(String, nullable=False)
    event_name: Mapped[str] = mapped_column(String, nullable=False)
    show_name: Mapped[str | None] = mapped_column(String, nullable=True)
    network: Mapped[str | None] = mapped_column(String, nullable=True)
    event_date: Mapped[str | None] = mapped_column(String, nullable=True)
    event_time: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # V2 fields
    event_type: Mapped[str | None] = mapped_column(String, nullable=True)
    calibration_factor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    created_at: Mapped[str] = mapped_column(String, nullable=False, default=utcnow)
    updated_at: Mapped[str] = mapped_column(String, nullable=False, default=utcnow, onupdate=utcnow)

    terms: Mapped[list["MarketTerm"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    correlated_pairs: Mapped[list["CorrelatedPair"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class MarketTerm(Base):
    __tablename__ = "market_terms"
    __table_args__ = (
        CheckConstraint("yes_price >= 0 AND yes_price <= 1", name="ck_yes_price"),
        CheckConstraint("no_price >= 0 AND no_price <= 1", name="ck_no_price"),
        CheckConstraint("s1_score >= 0 AND s1_score <= 1", name="ck_s1"),
        CheckConstraint("s2_score >= 0 AND s2_score <= 1", name="ck_s2"),
        CheckConstraint("s3_score >= 0 AND s3_score <= 1", name="ck_s3"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    term: Mapped[str] = mapped_column(String, nullable=False)
    yes_price: Mapped[float] = mapped_column(Float, nullable=False)
    no_price: Mapped[float] = mapped_column(Float, nullable=False)

    # Signal inputs (S1-S3 original)
    s1_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    s2_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    s3_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tweet_within_6h: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # V2 signal inputs (S4-S7)
    s4_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    s5_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    s6_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    s7_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # V2 bias inputs
    event_type: Mapped[str | None] = mapped_column(String, nullable=True)
    controversy_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    breaking_news_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    social_posts_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_hours_ago: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Computed fields (populated by analysis engine)
    p_market: Mapped[float | None] = mapped_column(Float, nullable=True)
    r_adj: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_model: Mapped[float | None] = mapped_column(Float, nullable=True)
    edge_pp: Mapped[float | None] = mapped_column(Float, nullable=True)
    kelly_fraction: Mapped[float | None] = mapped_column(Float, nullable=True)
    signal: Mapped[str | None] = mapped_column(String, nullable=True)

    # V2 computed fields
    bias_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_base_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Resolution
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    resolution: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=utcnow)

    session: Mapped["Session"] = relationship(back_populates="terms")


class BaseRate(Base):
    __tablename__ = "base_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    speaker: Mapped[str] = mapped_column(String, nullable=False)
    show: Mapped[str | None] = mapped_column(String, nullable=True)
    term: Mapped[str] = mapped_column(String, nullable=False)
    mentioned: Mapped[bool] = mapped_column(Boolean, nullable=False)
    event_date: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="manual")
    session_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sessions.id"), nullable=True)
    term_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("market_terms.id"), nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=utcnow)


class CorrelatedPair(Base):
    __tablename__ = "correlated_pairs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    term1_id: Mapped[int] = mapped_column(Integer, ForeignKey("market_terms.id"), nullable=False)
    term2_id: Mapped[int] = mapped_column(Integer, ForeignKey("market_terms.id"), nullable=False)
    correlation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # V2 fields
    correlation_strength: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    correlation_type: Mapped[str] = mapped_column(String, nullable=False, default="positive")
    conditional_probability: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[str] = mapped_column(String, nullable=False, default=utcnow)

    session: Mapped["Session"] = relationship(back_populates="correlated_pairs")
    term1: Mapped["MarketTerm"] = relationship(foreign_keys=[term1_id])
    term2: Mapped["MarketTerm"] = relationship(foreign_keys=[term2_id])


class ModelSettings(Base):
    __tablename__ = "model_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_singleton"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    # Signal weights (S1-S3 original)
    s1_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.25)
    s2_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.20)
    s3_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.15)

    # V2 signal weights (S4-S7)
    s4_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.15)
    s5_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.10)
    s6_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.08)
    s7_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.07)

    # Bayesian parameters
    k_value: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    kelly_divisor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    strong_edge_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=25.0)
    long_edge_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=12.0)
    watch_edge_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=8.0)

    # V2 Bayesian parameters
    k_base: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    w_base: Mapped[float] = mapped_column(Float, nullable=False, default=0.3)
    yes_pseudo: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)
    no_pseudo: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    decay_half_life: Mapped[float] = mapped_column(Float, nullable=False, default=24.0)
    source_half_life: Mapped[float] = mapped_column(Float, nullable=False, default=6.0)

    # Bias toggles
    repetition_bias_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    audience_bias_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    escalation_bias_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    news_reactivity_bias_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    platform_priming_bias_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Bias parameters
    repetition_boost: Mapped[float] = mapped_column(Float, nullable=False, default=0.3)
    escalation_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)
    reactivity_coefficient: Mapped[float] = mapped_column(Float, nullable=False, default=0.15)
    priming_boost: Mapped[float] = mapped_column(Float, nullable=False, default=0.1)
    audience_multipliers: Mapped[str] = mapped_column(
        Text, nullable=False,
        default='{"rally":1.15,"press_conference":0.90,"interview":0.95,"speech":1.05,"debate":1.10}'
    )

    # Calibration
    calibration_factor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    updated_at: Mapped[str] = mapped_column(String, nullable=False, default=utcnow, onupdate=utcnow)


class SourceEvent(Base):
    __tablename__ = "source_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    speaker: Mapped[str] = mapped_column(String, nullable=False)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    content_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms_mentioned: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    relevance_score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    event_timestamp: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=utcnow)


class CalibrationLog(Base):
    __tablename__ = "calibration_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("sessions.id"), nullable=False)
    predicted_correct: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_total: Mapped[int] = mapped_column(Integer, nullable=False)
    brier_score: Mapped[float] = mapped_column(Float, nullable=False)
    calibration_factor_before: Mapped[float] = mapped_column(Float, nullable=False)
    calibration_factor_after: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=utcnow)
