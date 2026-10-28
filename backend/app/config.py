from pathlib import Path
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    database_url: str = "sqlite:///./recruitai.db"
    upload_dir: Path = Path("./data/uploads")
    max_resumes_per_analysis: int = 60
    max_file_size_bytes: int = 5 * 1024 * 1024
    cors_origins: str = "http://localhost:5173,http://localhost:8443"
    frontend_base_url: str | None = None
    api_title: str = "HireSense AI API"
    api_version: str = "1.0.0"
    embedding_model: str = "all-MiniLM-L6-v2"
    ocr_dpi: int = 200
    tesseract_cmd: str | None = None
    # Ollama settings for local LLM-based resume parsing
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_timeout: float = 15.0
    enable_ollama_parser: bool = False
    enable_fuzzy_skill_matching: bool = False
    # Worker pool configuration for extraction and analysis
    extraction_max_workers: int | None = None
    analysis_max_workers: int | None = None
    # Email settings
    smtp_server: str = Field(default="smtp.gmail.com", validation_alias=AliasChoices("SMTP_SERVER", "SMTP_HOST"))
    smtp_port: int = 587
    smtp_use_tls: bool = True
    smtp_user: str = ""
    smtp_password: str = ""
    sender_email: str = ""
    sender_name: str = "HireSense AI"
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""

    model_config = SettingsConfigDict(
        env_file=(REPO_DIR / ".env", BACKEND_DIR / ".env"),
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
