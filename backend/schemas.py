from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Literal


# ── Model Settings ──────────────────────────────────────────────────────────

class ModelSettingsResponse(BaseModel):
    # Signal weights
    s1_weight: float
    s2_weight: float
    s3_weight: float
    s4_weight: float
    s5_weight: float
    s6_weight: float
    s7_weight: float
    # Bayesian
    k_value: int
    kelly_divisor: float
    strong_edge_threshold: float
    long_edge_threshold: float
    watch_edge_threshold: float
    # V2 Bayesian
    k_base: int
    w_base: float
    yes_pseudo: float
    no_pseudo: float
    decay_half_life: float
    source_half_life: float
    # Bias toggles
    repetition_bias_enabled: bool
    audience_bias_enabled: bool
    escalation_bias_enabled: bool
    news_reactivity_bias_enabled: bool
    platform_priming_bias_enabled: bool
    # Bias params
    repetition_boost: float
    escalation_rate: float
    reactivity_coefficient: float
    priming_boost: float
    audience_multipliers: str
    # Calibration
    calibration_factor: float

    model_config = {"from_attributes": True}


class ModelSettingsUpdate(BaseModel):
    s1_weight: float | None = None
    s2_weight: float | None = None
    s3_weight: float | None = None
    s4_weight: float | None = None
    s5_weight: float | None = None
    s6_weight: float | None = None
    s7_weight: float | None = None
    k_value: int | None = None
    kelly_divisor: float | None = None
    strong_edge_threshold: float | None = None
    long_edge_threshold: float | None = None
    watch_edge_threshold: float | None = None
    k_base: int | None = None
    w_base: float | None = None
    yes_pseudo: float | None = None
    no_pseudo: float | None = None
    decay_half_life: float | None = None
    source_half_life: float | None = None
    repetition_bias_enabled: bool | None = None
    audience_bias_enabled: bool | None = None
    escalation_bias_enabled: bool | None = None
    news_reactivity_bias_enabled: bool | None = None
    platform_priming_bias_enabled: bool | None = None
    repetition_boost: float | None = None
    escalation_rate: float | None = None
    reactivity_coefficient: float | None = None
    priming_boost: float | None = None
    audience_multipliers: str | None = None
    calibration_factor: float | None = None


# ── Market Terms ────────────────────────────────────────────────────────────

class TermCreate(BaseModel):
    term: str
    yes_price: float = Field(ge=0.0, le=1.0)
    no_price: float = Field(ge=0.0, le=1.0)
    s1_score: float = Field(ge=0.0, le=1.0, default=0.0)
    s2_score: float = Field(ge=0.0, le=1.0, default=0.0)
    s3_score: float = Field(ge=0.0, le=1.0, default=0.0)
    tweet_within_6h: bool = False
    notes: str | None = None
    # V2 signals
    s4_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s5_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s6_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s7_score: float | None = Field(ge=0.0, le=1.0, default=None)
    # V2 bias inputs
    event_type: str | None = None
    controversy_score: float | None = Field(ge=0.0, le=1.0, default=None)
    breaking_news_count: int | None = Field(ge=0, default=None)
    social_posts_count: int | None = Field(ge=0, default=None)
    source_hours_ago: float | None = Field(ge=0.0, default=None)


class TermUpdate(BaseModel):
    term: str | None = None
    yes_price: float | None = Field(ge=0.0, le=1.0, default=None)
    no_price: float | None = Field(ge=0.0, le=1.0, default=None)
    s1_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s2_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s3_score: float | None = Field(ge=0.0, le=1.0, default=None)
    tweet_within_6h: bool | None = None
    notes: str | None = None
    # V2 signals
    s4_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s5_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s6_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s7_score: float | None = Field(ge=0.0, le=1.0, default=None)
    # V2 bias inputs
    event_type: str | None = None
    controversy_score: float | None = Field(ge=0.0, le=1.0, default=None)
    breaking_news_count: int | None = Field(ge=0, default=None)
    social_posts_count: int | None = Field(ge=0, default=None)
    source_hours_ago: float | None = Field(ge=0.0, default=None)


class TermResponse(BaseModel):
    id: int
    session_id: int
    term: str
    yes_price: float
    no_price: float
    p_market: float | None
    s1_score: float
    s2_score: float
    s3_score: float
    tweet_within_6h: bool
    # V2 signals
    s4_score: float | None = None
    s5_score: float | None = None
    s6_score: float | None = None
    s7_score: float | None = None
    # V2 bias inputs
    event_type: str | None = None
    controversy_score: float | None = None
    breaking_news_count: int | None = None
    social_posts_count: int | None = None
    source_hours_ago: float | None = None
    # Computed
    r_adj: float | None
    p_model: float | None
    edge_pp: float | None
    kelly_fraction: float | None
    signal: str | None
    # V2 computed
    bias_total: float | None = None
    p_base_rate: float | None = None
    confidence: float | None = None
    # Resolution
    resolved: bool
    resolution: str | None
    notes: str | None

    model_config = {"from_attributes": True}


# ── Sessions ────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    subject_name: str
    event_name: str
    show_name: str | None = None
    network: str | None = None
    event_date: str | None = None
    event_time: str | None = None
    notes: str | None = None
    event_type: str | None = None
    terms: list[TermCreate] = []


class SessionUpdate(BaseModel):
    subject_name: str | None = None
    event_name: str | None = None
    show_name: str | None = None
    network: str | None = None
    event_date: str | None = None
    event_time: str | None = None
    notes: str | None = None
    status: str | None = None
    event_type: str | None = None


class SessionSummary(BaseModel):
    id: int
    subject_name: str
    event_name: str
    show_name: str | None
    network: str | None
    event_date: str | None
    status: str
    created_at: str
    term_count: int = 0
    top_signal: str | None = None
    best_edge: float | None = None

    model_config = {"from_attributes": True}


class SessionDetail(BaseModel):
    id: int
    subject_name: str
    event_name: str
    show_name: str | None
    network: str | None
    event_date: str | None
    event_time: str | None
    status: str
    notes: str | None
    event_type: str | None = None
    calibration_factor: float = 1.0
    created_at: str
    updated_at: str
    terms: list[TermResponse] = []
    correlated_pairs: list[CorrelatedPairResponse] = []

    model_config = {"from_attributes": True}


# ── Resolution ──────────────────────────────────────────────────────────────

class TermResolution(BaseModel):
    term_id: int
    resolution: Literal["YES", "NO"]


class ResolutionPayload(BaseModel):
    resolutions: list[TermResolution]


# ── Base Rates ──────────────────────────────────────────────────────────────

class BaseRateCreate(BaseModel):
    speaker: str
    show: str | None = None
    term: str
    mentioned: bool
    event_date: str | None = None

    @field_validator("speaker", "term", mode="before")
    @classmethod
    def normalize_text(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("show", mode="before")
    @classmethod
    def normalize_show(cls, v: str | None) -> str | None:
        return v.strip().lower() if v else None


class BaseRateResponse(BaseModel):
    id: int
    speaker: str
    show: str | None
    term: str
    mentioned: bool
    event_date: str | None
    source: str
    session_id: int | None
    term_id: int | None
    created_at: str

    model_config = {"from_attributes": True}


class BaseRateSummary(BaseModel):
    speaker: str
    term: str
    show: str | None
    total_appearances: int
    times_mentioned: int
    mention_rate: float


class TrendPoint(BaseModel):
    period: str
    total: int
    mentioned: int
    rate: float


# ── Correlated Pairs ────────────────────────────────────────────────────────

class CorrelatedPairCreate(BaseModel):
    term1_id: int
    term2_id: int
    correlation_reason: str | None = None
    correlation_strength: float = 0.5
    correlation_type: str = "positive"
    conditional_probability: float | None = None


class CorrelatedPairResponse(BaseModel):
    id: int
    session_id: int
    term1_id: int
    term2_id: int
    correlation_reason: str | None
    correlation_strength: float = 0.5
    correlation_type: str = "positive"
    conditional_probability: float | None = None
    created_at: str

    model_config = {"from_attributes": True}


# ── Analysis ────────────────────────────────────────────────────────────────

class AnalysisPreviewRequest(BaseModel):
    yes_price: float = Field(ge=0.0, le=1.0)
    no_price: float = Field(ge=0.0, le=1.0)
    s1_score: float = Field(ge=0.0, le=1.0, default=0.0)
    s2_score: float = Field(ge=0.0, le=1.0, default=0.0)
    s3_score: float = Field(ge=0.0, le=1.0, default=0.0)
    tweet_within_6h: bool = False
    # V2
    s4_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s5_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s6_score: float | None = Field(ge=0.0, le=1.0, default=None)
    s7_score: float | None = Field(ge=0.0, le=1.0, default=None)
    event_type: str | None = None
    controversy_score: float | None = Field(ge=0.0, le=1.0, default=None)
    breaking_news_count: int | None = Field(ge=0, default=None)
    social_posts_count: int | None = Field(ge=0, default=None)
    source_hours_ago: float | None = Field(ge=0.0, default=None)


class AnalysisPreviewResponse(BaseModel):
    p_market: float
    r_adj: float
    p_model: float
    edge_pp: float
    kelly_fraction: float
    signal: str
    # V2
    bias_total: float = 1.0
    confidence: float = 0.0
    p_base_rate: float | None = None


class ImportResult(BaseModel):
    records_created: int
    errors: list[str] = []


# ── Source Events ───────────────────────────────────────────────────────────

class SourceEventCreate(BaseModel):
    speaker: str
    source_type: str
    content_summary: str | None = None
    terms_mentioned: str | None = None
    relevance_score: float = Field(ge=0.0, le=1.0, default=1.0)
    event_timestamp: str

    @field_validator("speaker", mode="before")
    @classmethod
    def normalize_speaker(cls, v: str) -> str:
        return v.strip().lower()


class SourceEventResponse(BaseModel):
    id: int
    speaker: str
    source_type: str
    content_summary: str | None
    terms_mentioned: str | None
    relevance_score: float
    event_timestamp: str
    created_at: str

    model_config = {"from_attributes": True}


# ── Calibration ─────────────────────────────────────────────────────────────

class CalibrationLogResponse(BaseModel):
    id: int
    session_id: int
    predicted_correct: int
    predicted_total: int
    brier_score: float
    calibration_factor_before: float
    calibration_factor_after: float
    created_at: str

    model_config = {"from_attributes": True}
