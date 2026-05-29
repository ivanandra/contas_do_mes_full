"""
Migration script — cria tabelas (se nao existem) e adiciona colunas novas.
Execute uma vez: python migrate.py

Roda automaticamente no startup do container Railway.
Idempotente: pode rodar quantas vezes quiser.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from app.config import settings
from app.database import Base
from app.models import models  # noqa — registra os modelos

engine = create_engine(settings.DATABASE_URL)

# 1. Cria todas as tabelas que ainda nao existem (banco novo)
print("[migrate] Criando tabelas que nao existem (Base.metadata.create_all)...")
Base.metadata.create_all(bind=engine)
print("[migrate] Tabelas OK.")

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

print(f"[migrate] Rodando {len(migrations)} migracoes ALTER/CREATE...")
ok, fail = 0, 0
with engine.connect() as conn:
    for i, sql in enumerate(migrations, 1):
        try:
            conn.execute(text(sql.strip()))
            conn.commit()
            ok += 1
        except Exception as e:
            fail += 1
            print(f"[migrate]  ! Migracao #{i} falhou (continuando): {type(e).__name__}: {str(e)[:120]}")
            # Faz rollback pra nao travar a proxima
            try:
                conn.rollback()
            except Exception:
                pass

print(f"[migrate] Concluido: {ok} OK, {fail} falhas (idempotentes).")
