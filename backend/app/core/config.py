import os

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    app_name: str = "FleetOpt API"
    app_env: str = Field(default="development", description="Environment: development, staging, production")

    # JWT secret — must be 32+ chars in production
    secret_key: str = Field(
        default="dev-key-change-in-production",
        description="JWT secret key — must be 32+ chars in production",
    )
    access_token_expire_minutes: int = 60 * 24  # 24 h

    # ----------------------------------------------------------------
    # MySQL / XAMPP database  (NO SQLite support)
    # XAMPP default: root user, empty password, port 3306
    # ----------------------------------------------------------------
    database_url: str = Field(
        default="mysql+pymysql://root:@localhost:3306/fleetopt",
        description=(
            "MySQL connection string.\n"
            "XAMPP default: mysql+pymysql://root:@localhost:3306/fleetopt\n"
            "With password:  mysql+pymysql://root:yourpassword@localhost:3306/fleetopt"
        ),
    )

    # Frontend URL for CORS
    frontend_url: str = Field(
        default="http://localhost:3000",
        description="Frontend URL for CORS",
    )

    # Clerk authentication (optional)
    use_clerk_auth: bool = False
    clerk_api_key: str | None = None
    clerk_frontend_api: str | None = None

    # Email notifications (optional)
    resend_api_key: str | None = None

    # SMS notifications (optional)
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @field_validator("database_url")
    @classmethod
    def must_be_mysql(cls, v: str) -> str:
        if not v:
            raise ValueError("DATABASE_URL must be set")
        if v.startswith("sqlite"):
            raise ValueError(
                "SQLite is not supported. Use MySQL (XAMPP).\n"
                "Set DATABASE_URL=mysql+pymysql://root:@localhost:3306/fleetopt in your .env file."
            )
        return v

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        env = info.data.get("app_env", "development")
        if env == "production":
            if len(v) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
                )
            if v == "dev-key-change-in-production":
                raise ValueError("Set a strong SECRET_KEY in .env for production.")
        return v


settings = Settings()
