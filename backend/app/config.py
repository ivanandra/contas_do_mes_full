from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost/contas_do_mes"

    # JWT
    JWT_SECRET_KEY: str = "mude-esta-chave-em-producao"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 dias

    # Anthropic Claude
    ANTHROPIC_API_KEY: str = ""

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # WhatsApp via Twilio
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_MONTHLY_PRICE_ID: str = ""
    STRIPE_PRO_ANNUAL_PRICE_ID: str = ""

    # App
    APP_NAME: str = "Contas do Mês"
    FRONTEND_URL: str = "http://localhost:5173"
    DEBUG: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
