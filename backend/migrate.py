"""
Migration script — adiciona colunas de planos e limite do Tuco.
Execute uma vez: python migrate.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from app.config import settings

engine = create_engine(settings.DATABASE_URL)

migrations = [
    # Cria o tipo enum no PostgreSQL (ignora se já existir)
    """
    DO $$ BEGIN
        CREATE TYPE subscriptionplan AS ENUM ('FREE', 'PRO', 'PRO_ANUAL');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    """,
    """
    DO $$ BEGIN
        CREATE TYPE emailreportfrequency AS ENUM ('NONE', 'WEEKLY', 'MONTHLY');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    """,
    # Adiciona as colunas na tabela users (IF NOT EXISTS é seguro para reexecutar)
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan subscriptionplan NOT NULL DEFAULT 'FREE'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100) UNIQUE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tuco_monthly_interactions INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tuco_interactions_reset_at TIMESTAMP",
    # Relatório por email no Tuco
    "ALTER TABLE tuco_settings ADD COLUMN IF NOT EXISTS email_report_frequency emailreportfrequency NOT NULL DEFAULT 'NONE'",
    "ALTER TABLE tuco_settings ADD COLUMN IF NOT EXISTS email_report_last_sent_at TIMESTAMP",
    # Renda mensal
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_income FLOAT",
    # Onboarding
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT false",
]

with engine.connect() as conn:
    for sql in migrations:
        conn.execute(text(sql.strip()))
    conn.commit()

print("Migration concluida! Colunas de planos adicionadas a tabela users.")
