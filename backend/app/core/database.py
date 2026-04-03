"""Database setup with SQLAlchemy async engine."""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# Use SQLite for local demo (no Postgres needed)
_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "flowsecure.db")
db_url = f"sqlite+aiosqlite:///{_db_path}"

engine = create_async_engine(db_url, echo=False, connect_args={"check_same_thread": False})
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency that provides a database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
