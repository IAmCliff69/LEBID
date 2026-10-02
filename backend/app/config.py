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

        # AI
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"

    # App environment
    app_env: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Single shared instance — import this throughout the app
settings = Settings()