import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session as DbSession
from database import get_db
from models import Session as SessionModel, MarketTerm
from schemas import AnalysisPreviewRequest, AnalysisPreviewResponse, TermResponse, ImportResult
from engine.kelly import run_analysis
from routers.helpers import get_all_settings, run_term_analysis

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("/preview", response_model=AnalysisPreviewResponse)
def preview_analysis(payload: AnalysisPreviewRequest, db: DbSession = Depends(get_db)):
    """Run analysis without saving — for live preview in the UI."""
    settings = get_all_settings(db)
    result = run_analysis(
        yes_price=payload.yes_price,
        no_price=payload.no_price,
        s1=payload.s1_score,
        s2=payload.s2_score,
        s3=payload.s3_score,
        tweet_within_6h=payload.tweet_within_6h,
        # V2
        s4=payload.s4_score,
        s5=payload.s5_score,
        s6=payload.s6_score,
        s7=payload.s7_score,
        event_type=payload.event_type,
        controversy_score=payload.controversy_score or 0.0,
        breaking_news_count=payload.breaking_news_count or 0,
        social_posts_count=payload.social_posts_count or 0,
        source_hours_ago=payload.source_hours_ago,
        **settings,
    )
    return AnalysisPreviewResponse(**result)


@router.post("/recalculate/{session_id}", response_model=list[TermResponse])
def recalculate_session(session_id: int, db: DbSession = Depends(get_db)):
    """Re-run analysis for all terms in a session (e.g., after settings change)."""
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    settings = get_all_settings(db)
    for term in session.terms:
        run_term_analysis(term, settings, db=db, speaker=session.subject_name)

    db.commit()
    for term in session.terms:
        db.refresh(term)
    return session.terms


@router.get("/export/{session_id}")
def export_session(session_id: int, db: DbSession = Depends(get_db)):
    """Export session results as JSON."""
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    data = {
        "session": {
            "id": session.id,
            "subject_name": session.subject_name,
            "event_name": session.event_name,
            "show_name": session.show_name,
            "network": session.network,
            "event_date": session.event_date,
            "event_time": session.event_time,
            "status": session.status,
            "event_type": session.event_type,
        },
        "terms": [
            {
                "term": t.term,
                "yes_price": t.yes_price,
                "no_price": t.no_price,
                "p_market": t.p_market,
                "s1_score": t.s1_score,
                "s2_score": t.s2_score,
                "s3_score": t.s3_score,
                "tweet_within_6h": t.tweet_within_6h,
                "s4_score": t.s4_score,
                "s5_score": t.s5_score,
                "s6_score": t.s6_score,
                "s7_score": t.s7_score,
                "event_type": t.event_type,
                "controversy_score": t.controversy_score,
                "breaking_news_count": t.breaking_news_count,
                "social_posts_count": t.social_posts_count,
                "source_hours_ago": t.source_hours_ago,
                "r_adj": t.r_adj,
                "p_model": t.p_model,
                "edge_pp": t.edge_pp,
                "kelly_fraction": t.kelly_fraction,
                "signal": t.signal,
                "bias_total": t.bias_total,
                "confidence": t.confidence,
                "p_base_rate": t.p_base_rate,
                "resolved": t.resolved,
                "resolution": t.resolution,
            }
            for t in session.terms
        ],
    }
    return JSONResponse(content=data)


@router.post("/import", response_model=ImportResult)
async def import_sessions(file: UploadFile = File(...), db: DbSession = Depends(get_db)):
    """Import sessions from JSON file."""
    content = await file.read()
    data = json.loads(content.decode("utf-8"))

    settings = get_all_settings(db)
    created = 0
    errors = []

    sessions_data = data if isinstance(data, list) else data.get("sessions", [data])

    for i, s in enumerate(sessions_data):
        try:
            session = SessionModel(
                subject_name=s["subject_name"],
                event_name=s["event_name"],
                show_name=s.get("show_name"),
                network=s.get("network"),
                event_date=s.get("event_date"),
                event_time=s.get("event_time"),
                notes=s.get("notes"),
                event_type=s.get("event_type"),
            )
            db.add(session)
            db.flush()

            for t in s.get("terms", []):
                term = MarketTerm(
                    session_id=session.id,
                    term=t["term"],
                    yes_price=t["yes_price"],
                    no_price=t["no_price"],
                    s1_score=t.get("s1_score", 0.0),
                    s2_score=t.get("s2_score", 0.0),
                    s3_score=t.get("s3_score", 0.0),
                    tweet_within_6h=t.get("tweet_within_6h", False),
                    notes=t.get("notes"),
                    s4_score=t.get("s4_score"),
                    s5_score=t.get("s5_score"),
                    s6_score=t.get("s6_score"),
                    s7_score=t.get("s7_score"),
                    event_type=t.get("event_type"),
                    controversy_score=t.get("controversy_score"),
                    breaking_news_count=t.get("breaking_news_count"),
                    social_posts_count=t.get("social_posts_count"),
                    source_hours_ago=t.get("source_hours_ago"),
                )
                run_term_analysis(term, settings, db=db, speaker=session.subject_name)
                db.add(term)

            created += 1
        except (KeyError, ValueError) as e:
            errors.append(f"Session {i}: {str(e)}")

    db.commit()
    return ImportResult(records_created=created, errors=errors)
