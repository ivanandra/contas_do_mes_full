FROM python:3.11-slim

WORKDIR /app

# Dependências de sistema (psycopg2, ssl, etc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Healthcheck (Railway usa)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-8000}/api/health || exit 1

EXPOSE 8000

# Roda migração antes de subir (idempotente)
CMD ["sh", "-c", "python migrate.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
