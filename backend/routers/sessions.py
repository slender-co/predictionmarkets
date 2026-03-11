from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DbSession
from database import get_db
from models import Session, MarketTerm, BaseRate, CalibrationLog, ModelSettings
from schemas import (
    SessionCreate, SessionUpdate, SessionSummary, SessionDetail,
    TermCreate, TermResponse, ResolutionPayload, CalibrationLogResponse,
)
from routers.helpers import get_all_settings, run_term_analysis

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _build_summary(session: Session) -> SessionSummary:
    terms = session.terms or []
    best = None
    best_edge = None
    for t in terms:
        if t.edge_pp is not None:
            if best_edge is None or abs(t.edge_pp) > abs(best_edge):
                best_edge = t.edge_pp
                best = t.signal
    return SessionSummary(
        id=session.id,
        subject_name=session.subject_name,
        event_name=session.event_name,
        show_name=session.show_name,
        network=session.network,
        event_date=session.event_date,
        status=session.status,
        created_at=session.created_at,
        term_count=len(terms),
        top_signal=best,
        best_edge=best_edge,
    )


@router.get("", response_model=list[SessionSummary])
def list_sessions(
    status: str | None = Query(None),
    subject: str | None = Query(None),
    db: DbSession = Depends(get_db),
):
    q = db.query(Session)
    if status:
        q = q.filter(Session.status == status)
    if subject:
        q = q.filter(Session.subject_name.ilike(f"%{subject}%"))
    sessions = q.order_by(Session.created_at.desc()).all()
    return [_build_summary(s) for s in sessions]


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: int, db: DbSession = Depends(get_db)):
    session = db.get(Session, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.post("", response_model=SessionDetail, status_code=201)
def create_session(payload: SessionCreate, db: DbSession = Depends(get_db)):
    session = Session(
        subject_name=payload.subject_name,
        event_name=payload.event_name,
        show_name=payload.show_name,
        network=payload.network,
        event_date=payload.event_date,
        event_time=payload.event_time,
        notes=payload.notes,
        event_type=payload.event_type,
    )
    db.add(session)
    db.flush()

    settings = get_all_settings(db)
    for t in payload.terms:
        term = MarketTerm(
            session_id=session.id,
            term=t.term,
            yes_price=t.yes_price,
            no_price=t.no_price,
            s1_score=t.s1_score,
            s2_score=t.s2_score,
            s3_score=t.s3_score,
            tweet_within_6h=t.tweet_within_6h,
            notes=t.notes,
            # V2 fields
            s4_score=t.s4_score,
            s5_score=t.s5_score,
            s6_score=t.s6_score,
            s7_score=t.s7_score,
            event_type=t.event_type or payload.event_type,
            controversy_score=t.controversy_score,
            breaking_news_count=t.breaking_news_count,
            social_posts_count=t.social_posts_count,
            source_hours_ago=t.source_hours_ago,
        )
        run_term_analysis(term, settings, db=db, speaker=session.subject_name)
        db.add(term)

    db.commit()
    db.refresh(session)
    return session


@router.put("/{session_id}", response_model=SessionDetail)
def update_session(session_id: int, payload: SessionUpdate, db: DbSession = Depends(get_db)):
    session = db.get(Session, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(session, field, value)

    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, db: DbSession = Depends(get_db)):
    session = db.get(Session, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    db.delete(session)
    db.commit()


@router.post("/{session_id}/resolve", response_model=SessionDetail)
def resolve_session(session_id: int, payload: ResolutionPayload, db: DbSession = Depends(get_db)):
    session = db.get(Session, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    for res in payload.resolutions:
        term = db.get(MarketTerm, res.term_id)
        if not term or term.session_id != session_id:
            raise HTTPException(400, f"Term {res.term_id} not found in session {session_id}")

        term.resolved = True
        term.resolution = res.resolution

        # Auto-create base rate entry
        base_rate = BaseRate(
            speaker=session.subject_name.strip().lower(),
            show=session.show_name.strip().lower() if session.show_name else None,
            term=term.term.strip().lower(),
            mentioned=(res.resolution == "YES"),
            event_date=session.event_date,
            source="session",
            session_id=session.id,
            term_id=term.id,
        )
        db.add(base_rate)

    session.status = "resolved"
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/calibrate", response_model=CalibrationLogResponse)
def calibrate_session(session_id: int, db: DbSession = Depends(get_db)):
    """Compute calibration metrics after resolution. Updates calibration factor."""
    session = db.get(Session, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != "resolved":
        raise HTTPException(400, "Session must be resolved before calibration")

    resolved_terms = [t for t in session.terms if t.resolved and t.resolution and t.p_model is not None]
    if not resolved_terms:
        raise HTTPException(400, "No resolved terms with model predictions")

    # Compute Brier score: mean((p_model - actual)^2)
    brier_sum = 0.0
    correct = 0
    for t in resolved_terms:
        actual = 1.0 if t.resolution == "YES" else 0.0
        brier_sum += (t.p_model - actual) ** 2
        # Count "correct" if model agreed with outcome (p > 0.5 and YES, or p < 0.5 and NO)
        if (t.p_model >= 0.5 and t.resolution == "YES") or (t.p_model < 0.5 and t.resolution == "NO"):
            correct += 1

    brier_score = brier_sum / len(resolved_terms)
    total = len(resolved_terms)

    # Update calibration factor: blend toward 1.0 if well-calibrated, reduce if overconfident
    # Perfect Brier = 0.0, random = 0.25, worst = 1.0
    settings = db.get(ModelSettings, 1)
    old_cal = settings.calibration_factor
    # Exponential moving average: new = old * 0.8 + accuracy_signal * 0.2
    accuracy_rate = correct / total
    new_cal = old_cal * 0.8 + accuracy_rate * 0.2
    new_cal = max(0.5, min(1.0, new_cal))

    log = CalibrationLog(
        session_id=session_id,
        predicted_correct=correct,
        predicted_total=total,
        brier_score=round(brier_score, 6),
        calibration_factor_before=old_cal,
        calibration_factor_after=new_cal,
    )
    db.add(log)

    settings.calibration_factor = new_cal
    session.calibration_factor = new_cal

    db.commit()
    db.refresh(log)
    return log
