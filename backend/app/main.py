from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, auth, bookings, clerk_auth, dispatch, driver, manager, ratings, reports
from app.core.config import settings
from app.db import engine
from app.models.base import Base


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"⚠️ Database connection failed on startup: {str(e)}")
        print("⚠️ API will run but database operations will fail")
        print("⚠️ Please start MySQL or use Docker: docker compose up -d")
        pass


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(dispatch.router, prefix="/api")
app.include_router(driver.router, prefix="/api")
app.include_router(manager.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(ratings.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(clerk_auth.router, prefix="/api")
