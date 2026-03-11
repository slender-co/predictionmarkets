import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import func, Integer, case
from sqlalchemy.orm import Session as DbSession
from database import get_db
from models import BaseRate
from schemas import BaseRateCreate, BaseRateResponse, BaseRateSummary, TrendPoint, ImportResult

router = APIRouter(prefix="/api/base-rates", tags=["base_rates"])


@router.get("", response_model=list[BaseRateResponse])
def list_base_rates(
    speaker: str | None = Query(None),
    show: str | None = Query(None),
    term: str | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: DbSession = Depends(get_db),
):
    q = db.query(BaseRate)
    if speaker:
        q = q.filter(BaseRate.speaker == speaker.strip().lower())
    if show:
        q = q.filter(BaseRate.show == show.strip().lower())
    if term:
        q = q.filter(BaseRate.term.ilike(f"%{term.strip().lower()}%"))
    return q.order_by(BaseRate.event_date.desc()).offset(offset).limit(limit).all()


@router.get("/summary", response_model=list[BaseRateSummary])
def base_rate_summary(
    speaker: str | None = Query(None),
    show: str | None = Query(None),
    term: str | None = Query(None),
    db: DbSession = Depends(get_db),
):
    q = db.query(
        BaseRate.speaker,
        BaseRate.term,
        BaseRate.show,
        func.count().label("total_appearances"),
        func.sum(case((BaseRate.mentioned == True, 1), else_=0)).label("times_mentioned"),
    ).group_by(BaseRate.speaker, BaseRate.term, BaseRate.show)

    if speaker:
        q = q.filter(BaseRate.speaker == speaker.strip().lower())
    if show:
        q = q.filter(BaseRate.show == show.strip().lower())
    if term:
        q = q.filter(BaseRate.term.ilike(f"%{term.strip().lower()}%"))

    rows = q.order_by(func.count().desc()).all()
    results = []
    for row in rows:
        total = row.total_appearances
        mentioned = row.times_mentioned or 0
        results.append(BaseRateSummary(
            speaker=row.speaker,
            term=row.term,
            show=row.show,
            total_appearances=total,
            times_mentioned=mentioned,
            mention_rate=round(mentioned / total, 4) if total > 0 else 0.0,
        ))
    return results


@router.get("/trends", response_model=list[TrendPoint])
def base_rate_trends(
    speaker: str = Query(...),
    term: str = Query(...),
    show: str | None = Query(None),
    db: DbSession = Depends(get_db),
):
    q = db.query(
        func.substr(BaseRate.event_date, 1, 7).label("period"),
        func.count().label("total"),
        func.sum(case((BaseRate.mentioned == True, 1), else_=0)).label("mentioned"),
    ).filter(
        BaseRate.speaker == speaker.strip().lower(),
        BaseRate.term == term.strip().lower(),
        BaseRate.event_date.isnot(None),
    ).group_by("period").order_by("period")

    if show:
        q = q.filter(BaseRate.show == show.strip().lower())

    rows = q.all()
    results = []
    for row in rows:
        total = row.total
        mentioned = row.mentioned or 0
        results.append(TrendPoint(
            period=row.period,
            total=total,
            mentioned=mentioned,
            rate=round(mentioned / total, 4) if total > 0 else 0.0,
        ))
    return results


@router.post("", response_model=BaseRateResponse, status_code=201)
def create_base_rate(payload: BaseRateCreate, db: DbSession = Depends(get_db)):
    entry = BaseRate(
        speaker=payload.speaker,
        show=payload.show,
        term=payload.term,
        mentioned=payload.mentioned,
        event_date=payload.event_date,
        source="manual",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/import", response_model=ImportResult)
async def import_base_rates(file: UploadFile = File(...), db: DbSession = Depends(get_db)):
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    errors = []
    for i, row in enumerate(reader, start=2):
        try:
            entry = BaseRate(
                speaker=row["speaker"].strip().lower(),
                show=row.get("show", "").strip().lower() or None,
                term=row["term"].strip().lower(),
                mentioned=row["mentioned"].strip() in ("1", "true", "yes", "True", "Yes"),
                event_date=row.get("event_date", "").strip() or None,
                source="import",
            )
            db.add(entry)
            created += 1
        except (KeyError, ValueError) as e:
            errors.append(f"Row {i}: {str(e)}")

    db.commit()
    return ImportResult(records_created=created, errors=errors)
