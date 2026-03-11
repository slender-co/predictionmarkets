import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    DB_DIR = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(DB_DIR, exist_ok=True)
    DATABASE_URL = f"sqlite:///{os.path.join(DB_DIR, 'prediction_market.db')}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
