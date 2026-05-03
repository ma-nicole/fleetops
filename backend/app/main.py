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
from app.db import apply_runtime_schema_fixes, engine, get_db
from app.models.base import Base
from app.models import erd_entities  # noqa: F401 - ensure ERD tables are registered
from app.models import entities  # noqa: F401 - ensure new entities are registered


def require_db(db=Depends(get_db)) -> None:
    db.execute(text("SELECT 1"))


app = FastAPI(title=settings.app_name)

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
    apply_runtime_schema_fixes()


@app.api_route("/health", methods=["GET", "HEAD"])
def health() -> dict:
    """Liveness only — does not open a DB session (so dev proxies can detect uvicorn is up).

    HEAD is allowed so `wait-on` and other probes that use HEAD succeed (GET-only routes return 405).
    """
    return {"status": "ok"}


_api_deps = [Depends(require_db)]

# Core
app.include_router(auth.router, prefix="/api", dependencies=_api_deps)
app.include_router(bookings.router, prefix="/api", dependencies=_api_deps)
app.include_router(dispatch.router, prefix="/api", dependencies=_api_deps)
app.include_router(driver.router, prefix="/api", dependencies=_api_deps)
app.include_router(manager.router, prefix="/api", dependencies=_api_deps)
app.include_router(admin.router, prefix="/api", dependencies=_api_deps)
app.include_router(ratings.router, prefix="/api", dependencies=_api_deps)
app.include_router(reports.router, prefix="/api", dependencies=_api_deps)
app.include_router(clerk_auth.router, prefix="/api", dependencies=_api_deps)
app.include_router(workflow.router, prefix="/api", dependencies=_api_deps)

# Paper §3.2 / §3.5 additions
app.include_router(payments.router, prefix="/api", dependencies=_api_deps)
app.include_router(feedback.router, prefix="/api", dependencies=_api_deps)
app.include_router(completion.router, prefix="/api", dependencies=_api_deps)
app.include_router(schedule.router, prefix="/api", dependencies=_api_deps)
app.include_router(analytics_predict.router, prefix="/api", dependencies=_api_deps)
app.include_router(analytics_prescribe.router, prefix="/api", dependencies=_api_deps)
