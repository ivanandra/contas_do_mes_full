from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import logging

from app.config import settings
from app.database import engine, Base
from app.models import models  # noqa — garante que os modelos sejam registrados
from app.routers import auth, accounts, payments, dashboard, whatsapp, expenses, billing
from app.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)

# Cria as tabelas no banco (em produção, use Alembic migrations)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Contas do Mês API",
    description="API do Tuco — seu assistente financeiro pessoal",
    version="2.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)


@app.on_event("startup")
async def on_startup():
    start_scheduler()


@app.on_event("shutdown")
async def on_shutdown():
    stop_scheduler()

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routes ──────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(whatsapp.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(billing.router, prefix="/api")


# ─── Health Check ────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": "2.0.0"}


# ─── Serve React Frontend (produção) ─────────────────────────────────────────
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        index_file = os.path.join(frontend_dist, "index.html")
        return FileResponse(index_file)
