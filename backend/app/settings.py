"""Application settings and configuration."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Application
    app_name: str = "Founder Autopilot"
    app_version: str = "0.1.0"
    debug: bool = False
    
    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8001
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # OpenAI / vLLM Configuration
    # Supports both OpenAI API and vLLM with OpenAI-compatible endpoint
    openai_api_key: str = "EMPTY"  # Use "EMPTY" for vLLM
    openai_api_base: str = "http://localhost:8000/v1"  # vLLM endpoint
    openai_model: str = "Qwen/Qwen2.5-7B-Instruct"  # Model name
    openai_temperature: float = 0.7
    openai_max_tokens: int = 4096
    
    # Alternative: Use OpenAI directly by setting these in .env:
    # OPENAI_API_KEY=sk-...
    # OPENAI_API_BASE=https://api.openai.com/v1
    # OPENAI_MODEL=gpt-4-turbo-preview
    
    # Stripe Configuration
    stripe_api_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    
    # Google Cloud Configuration
    gcloud_project_id: Optional[str] = None
    gcloud_credentials_path: Optional[str] = None
    
    # Email Configuration
    email_provider: str = "smtp"  # smtp, sendgrid, postmark
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    
    # Database
    database_url: str = "sqlite:///./data/runs.db"
    
    # Security
    secret_key: str = "change-this-in-production-use-secrets-manager"
    vault_encryption_key: Optional[str] = None  # For encrypting stored credentials
    
    # Paths
    workspace_path: str = "./data/workspace"
    artifacts_path: str = "./data/artifacts"
    prompts_path: str = "./app/prompts"
    
    # Agent Configuration
    max_agent_iterations: int = 50
    agent_timeout_seconds: int = 300
    enable_human_in_loop: bool = True
    
    # Browser Automation
    playwright_headless: bool = True
    playwright_timeout: int = 30000


# Global settings instance
settings = Settings()
