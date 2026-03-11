from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession
from database import get_db
from models import MarketTerm, Session as SessionModel
from schemas import TermCreate, TermUpdate, TermResponse
from routers.helpers import get_all_settings, run_term_analysis

router = APIRouter(prefix="/api", tags=["terms"])


@router.post("/sessions/{session_id}/terms", response_model=TermResponse, status_code=201)
def create_term(session_id: int, payload: TermCreate, db: DbSession = Depends(get_db)):
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    term = MarketTerm(
        session_id=session_id,
        term=payload.term,
        yes_price=payload.yes_price,
        no_price=payload.no_price,
        s1_score=payload.s1_score,
        s2_score=payload.s2_score,
        s3_score=payload.s3_score,
        tweet_within_6h=payload.tweet_within_6h,
        notes=payload.notes,
        # V2
        s4_score=payload.s4_score,
        s5_score=payload.s5_score,
        s6_score=payload.s6_score,
        s7_score=payload.s7_score,
        event_type=payload.event_type or session.event_type,
        controversy_score=payload.controversy_score,
        breaking_news_count=payload.breaking_news_count,
        social_posts_count=payload.social_posts_count,
        source_hours_ago=payload.source_hours_ago,
    )

    settings = get_all_settings(db)
    run_term_analysis(term, settings, db=db, speaker=session.subject_name)

    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@router.post("/sessions/{session_id}/terms/batch", response_model=list[TermResponse], status_code=201)
def create_terms_batch(session_id: int, payload: list[TermCreate], db: DbSession = Depends(get_db)):
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    settings = get_all_settings(db)
    terms = []
    for t in payload:
        term = MarketTerm(
            session_id=session_id,
            term=t.term,
            yes_price=t.yes_price,
            no_price=t.no_price,
            s1_score=t.s1_score,
            s2_score=t.s2_score,
            s3_score=t.s3_score,
            tweet_within_6h=t.tweet_within_6h,
            notes=t.notes,
            # V2
            s4_score=t.s4_score,
            s5_score=t.s5_score,
            s6_score=t.s6_score,
            s7_score=t.s7_score,
            event_type=t.event_type or session.event_type,
            controversy_score=t.controversy_score,
            breaking_news_count=t.breaking_news_count,
            social_posts_count=t.social_posts_count,
            source_hours_ago=t.source_hours_ago,
        )
        run_term_analysis(term, settings, db=db, speaker=session.subject_name)
        db.add(term)
        terms.append(term)

    db.commit()
    for t in terms:
        db.refresh(t)
    return terms


@router.put("/terms/{term_id}", response_model=TermResponse)
def update_term(term_id: int, payload: TermUpdate, db: DbSession = Depends(get_db)):
    term = db.get(MarketTerm, term_id)
    if not term:
        raise HTTPException(404, "Term not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(term, field, value)

    session = db.get(SessionModel, term.session_id)
    settings = get_all_settings(db)
    run_term_analysis(term, settings, db=db, speaker=session.subject_name if session else None)

    db.commit()
    db.refresh(term)
    return term


@router.delete("/terms/{term_id}", status_code=204)
def delete_term(term_id: int, db: DbSession = Depends(get_db)):
    term = db.get(MarketTerm, term_id)
    if not term:
        raise HTTPException(404, "Term not found")
    db.delete(term)
    db.commit()
