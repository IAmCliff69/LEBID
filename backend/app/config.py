from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Pydantic-settings automatically reads from the .env file.
    """

    # Database
    database_url: str

    # JWT Authentication
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    # CORS
    cors_origins: str = "http://localhost:5173"

        # Key used to encrypt secrets stored in the database (e.g. Gemini API keys)
    encryption_key: str
        # AI        
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"

    # How many proxies sit in front of the server. 0 = none (local development).
    # On Railway set TRUSTED_PROXY_COUNT=1 so limits use the visitor's real IP.
    trusted_proxy_count: int = 0

    # App environment
    app_env: str = "development"
        # Logging: LOG_LEVEL (DEBUG, INFO, WARNING...) and LOG_FORMAT ("text" or "json")
    log_level: str = "INFO"
    log_format: str = "text"

    # Error reporting with Sentry. Leave empty to keep it off.
    sentry_dsn: str = ""

    # Where the web app lives (used to build the links in emails)
    frontend_url: str = "http://localhost:5173"

    # How emails are sent: "console" (prints in the server terminal, for
    # development) or "memory" (tests). A real provider comes later.
    email_backend: str = "console"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Single shared instance — import this throughout the app
settings = Settings()