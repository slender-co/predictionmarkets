from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DbSession
from database import get_db
from models import SourceEvent
from schemas import SourceEventCreate, SourceEventResponse

router = APIRouter(prefix="/api/source-events", tags=["source-events"])


@router.get("", response_model=list[SourceEventResponse])
def list_source_events(
    speaker: str | None = Query(None),
    source_type: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: DbSession = Depends(get_db),
):
    q = db.query(SourceEvent)
    if speaker:
        q = q.filter(SourceEvent.speaker == speaker.strip().lower())
    if source_type:
        q = q.filter(SourceEvent.source_type == source_type)
    return q.order_by(SourceEvent.event_timestamp.desc()).limit(limit).all()


@router.post("", response_model=SourceEventResponse, status_code=201)
def create_source_event(payload: SourceEventCreate, db: DbSession = Depends(get_db)):
    event = SourceEvent(
        speaker=payload.speaker,
        source_type=payload.source_type,
        content_summary=payload.content_summary,
        terms_mentioned=payload.terms_mentioned,
        relevance_score=payload.relevance_score,
        event_timestamp=payload.event_timestamp,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.post("/batch", response_model=list[SourceEventResponse], status_code=201)
def create_source_events_batch(payload: list[SourceEventCreate], db: DbSession = Depends(get_db)):
    events = []
    for p in payload:
        event = SourceEvent(
            speaker=p.speaker,
            source_type=p.source_type,
            content_summary=p.content_summary,
            terms_mentioned=p.terms_mentioned,
            relevance_score=p.relevance_score,
            event_timestamp=p.event_timestamp,
        )
        db.add(event)
        events.append(event)
    db.commit()
    for e in events:
        db.refresh(e)
    return events


@router.delete("/{event_id}", status_code=204)
def delete_source_event(event_id: int, db: DbSession = Depends(get_db)):
    event = db.get(SourceEvent, event_id)
    if event:
        db.delete(event)
        db.commit()
