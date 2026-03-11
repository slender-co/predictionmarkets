from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession
from database import get_db
from models import ModelSettings
from schemas import ModelSettingsResponse, ModelSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=ModelSettingsResponse)
def get_settings(db: DbSession = Depends(get_db)):
    settings = db.get(ModelSettings, 1)
    return settings


@router.put("", response_model=ModelSettingsResponse)
def update_settings(payload: ModelSettingsUpdate, db: DbSession = Depends(get_db)):
    settings = db.get(ModelSettings, 1)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings
