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
    email_from: str = "FleetOpt <notifications@fleetopt.com>"
    # Inbox for customer feedback (e.g. FleetOps Gmail). Uses Resend when RESEND_API_KEY is set.
    feedback_inbox_email: str | None = Field(default=None, description="Recipient for customer feedback emails")
    password_reset_token_expire_minutes: int = 30

    # SMS notifications (optional)
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None

    # Geocoding — Google (paid API key) optional; if unset, OSM Nominatim is used (no API key; rate-limited).
    google_maps_geocoding_api_key: str | None = Field(
        default=None,
        description=(
            "Google Geocoding API key for backend pin resolution. Enable Geocoding API; for uvicorn calls avoid HTTP-referrer-only "
            "restriction (use IP / none in dev) or backend requests will fail and Nominatim is used."
        ),
    )
    geocoding_user_agent: str = Field(
        default="FleetOpt/1.0 (+https://localhost)",
        description='HTTP User-Agent sent to Nominatim (must identify your app; include contact URL or email).',
    )

    # Road km — Google Directions (closest to Google Maps driving distance) when key available.
    google_maps_directions_api_key: str | None = Field(
        default=None,
        description=(
            "Optional dedicated Google Directions API key. If empty and GOOGLE_DIRECTIONS_FALLBACK_TO_GEOCODING_KEY=true, "
            "reuses GOOGLE_MAPS_GEOCODING_API_KEY (enable Directions API on that key)."
        ),
    )
    google_directions_fallback_to_geocoding_key: bool = Field(
        default=True,
        description="If no dedicated directions key, use GOOGLE_MAPS_GEOCODING_API_KEY for Directions API calls.",
    )
    use_google_directions_for_routing: bool = Field(
        default=True,
        description="When a directions-capable key is available, call Google Directions before ORS/OSRM for road km.",
    )

    # Driving distance (road km) after geocoding — OSRM / OpenRouteService (OpenStreetMap-based).
    openrouteservice_api_key: str | None = Field(
        default=None,
        description="Optional OpenRouteService API key (free tier). Tried before OSRM when set.",
    )
    use_truck_route_profile: bool = Field(
        default=True,
        description=(
            "If true, OpenRouteService uses driving-hgv (heavy goods / truck-friendly restrictions). "
            "If false, uses driving-car. Public OSRM demo has no HGV profile — see OSRM_ROUTE_PROFILE."
        ),
    )
    osrm_route_base_url: str = Field(
        default="https://router.project-osrm.org",
        description="OSRM route endpoint base (no trailing path). Public demo or self-hosted.",
    )
    osrm_route_profile: str = Field(
        default="driving",
        description=(
            "OSRM profile segment in /route/v1/{profile}/… Default 'driving' matches public demo (car-oriented). "
            "Self-hosted OSRM with a truck/HGV profile: set to that profile name."
        ),
    )
    use_osrm_driving_distance: bool = Field(
        default=True,
        description="If true, request OSRM driving distance when ORS key is unset or fails.",
    )
    require_routed_distance: bool = Field(
        default=True,
        description="If true, refuse heuristics / straight-line km — only Google Directions / OSRM / ORS road km (or same-location zero).",
    )

    # Booking freight knobs persisted in DB — admin UI only edits these two (.env seeds first row).
    diesel_price_php_per_liter: float = Field(
        default=74.75,
        ge=1.0,
        le=500.0,
        description="Retail diesel ₱/L for the fuel deduction (road km / 4 × ₱/L in the business formula).",
    )
    toll_fees_php_per_trip: float = Field(
        default=0.0,
        ge=0.0,
        le=500_000.0,
        description="Toll deduction ₱ per booking leg (admin Calculations tab).",
    )

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
