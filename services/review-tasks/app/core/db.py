from contextlib import contextmanager

from sqlmodel import Session, SQLModel, create_engine

from ..core.config import settings

_db_url = settings.db_url
connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}
engine = create_engine(_db_url, echo=False, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session():
    with Session(engine) as session:
        yield session
