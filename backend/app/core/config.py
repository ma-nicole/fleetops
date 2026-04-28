from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FleetOpt API"
    app_env: str = "development"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60 * 24

    # Database configuration for local or Cloud SQL
    use_cloud_sql: bool = False
    database_url: str = "sqlite:///./fleetopt.db"

    # Google Cloud SQL settings (when use_cloud_sql=True)
    gcp_project_id: str | None = None
    cloud_sql_instance: str | None = None  # Format: PROJECT:REGION:INSTANCE
    cloud_sql_db_user: str = "fleetopt"
    cloud_sql_db_password: str | None = None
    cloud_sql_db_name: str = "fleetopt"

    # Clerk authentication
    clerk_api_key: str | None = None
    clerk_frontend_api: str | None = None
    use_clerk_auth: bool = False

    frontend_url: str = "http://localhost:3000"

    resend_api_key: str | None = None
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
