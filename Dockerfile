# Dockerfile na raiz — Railway/Render acham automaticamente sem configurar nada
FROM python:3.11-slim

WORKDIR /app

# Dependências de sistema (psycopg2, ssl, curl pra healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Copia apenas o backend (frontend será deployado separado no Vercel)
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/

EXPOSE 8000

# Migração + uvicorn. Railway define $PORT automaticamente
CMD ["sh", "-c", "python migrate.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
