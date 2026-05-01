import os
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    app_name: str = "FleetOpt API"
    app_env: str = Field(default="development", description="Environment: development, staging, production")
    
    # ⚠️ SECURITY: Secret key MUST be set in .env for production
    secret_key: str = Field(
        default="dev-key-change-in-production",
        description="JWT secret key - must be 32+ chars in production"
    )
    access_token_expire_minutes: int = 60 * 24

    # Database configuration
    database_url: str = Field(
        default="mysql+pymysql://fleetopt:fleetopt@db:3306/fleetopt",
        description="Database connection URL"
    )

    # Frontend URL for CORS
    frontend_url: str = Field(
        default="http://localhost:3000",
        description="Frontend URL for CORS configuration"
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
    # Cloud SQL flags (optional)
    use_cloud_sql: bool = False
    gcp_project_id: str | None = None
    cloud_sql_region: str | None = None
    cloud_sql_instance: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        """Validate secret key security in production."""
        env = info.data.get("app_env", "development")
        if env == "production":
            if len(v) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters long in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
                )
            if v == "dev-key-change-in-production":
                raise ValueError(
                    "SECRET_KEY has not been changed from default! "
                    "Set a strong SECRET_KEY in your .env file for production."
                )
        return v

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate database URL is configured."""
        if not v:
            raise ValueError("DATABASE_URL must be configured")
        return v


settings = Settings()
