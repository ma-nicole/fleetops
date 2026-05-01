from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import (
    admin,
    analytics_predict,
    analytics_prescribe,
    auth,
    bookings,
    clerk_auth,
    completion,
    dispatch,
    driver,
    feedback,
    manager,
    payments,
    ratings,
    reports,
    schedule,
    workflow,
)
from app.core.config import settings
from app.db import engine, get_db
from app.models.base import Base
from app.models import erd_entities  # noqa: F401 - ensure ERD tables are registered
from app.models import entities  # noqa: F401 - ensure new entities are registered


def require_db(db=Depends(get_db)) -> None:
    db.execute(text("SELECT 1"))


app = FastAPI(title=settings.app_name, dependencies=[Depends(require_db)])

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# Core
app.include_router(auth.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(dispatch.router, prefix="/api")
app.include_router(driver.router, prefix="/api")
app.include_router(manager.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(ratings.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(clerk_auth.router, prefix="/api")
app.include_router(workflow.router, prefix="/api")

# Paper §3.2 / §3.5 additions
app.include_router(payments.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(completion.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(analytics_predict.router, prefix="/api")
app.include_router(analytics_prescribe.router, prefix="/api")
