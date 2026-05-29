from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import UserRegister, UserLogin, UserUpdate, UserOut, Token, GoogleLogin
from app.services.auth_service import (
    get_user_by_email, create_user, verify_password, create_access_token
)
from app.middleware.auth import get_current_user
from app.models.models import User
from app.config import settings
import secrets

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google/config")
def google_config():
    """Retorna o Google Client ID público (frontend precisa pra abrir o Sign-In)."""
    return {"client_id": settings.GOOGLE_CLIENT_ID, "enabled": bool(settings.GOOGLE_CLIENT_ID)}


@router.post("/register", response_model=Token, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if get_user_by_email(db, data.email):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    user = create_user(db, data.email, data.password, data.name)
    token = create_access_token({"sub": user.id})
    return {"access_token": token, "user": user}


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    token = create_access_token({"sub": user.id})
    return {"access_token": token, "user": user}


@router.post("/google", response_model=Token)
def google_login(data: GoogleLogin, db: Session = Depends(get_db)):
    """
    Aceita 'credential' como:
    - id_token (JWT) — do <GoogleLogin /> component
    - access_token — do useGoogleLogin hook (popup customizado)
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Login com Google não está configurado")

    google_email = None
    google_name = "Usuário"

    # Tenta primeiro como id_token (JWT)
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as g_requests
        info = id_token.verify_oauth2_token(
            data.credential, g_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
        google_email = info.get("email")
        google_name = info.get("name") or info.get("given_name") or "Usuário"
    except Exception:
        # Não é id_token — tenta como access_token via userinfo
        try:
            import httpx
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {data.credential}"},
                )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Token Google inválido")
            info = resp.json()
            google_email = info.get("email")
            google_name = info.get("name") or info.get("given_name") or "Usuário"
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Token Google inválido")

    if not google_email:
        raise HTTPException(status_code=400, detail="Não foi possível obter o email do Google")

    user = get_user_by_email(db, google_email)
    if not user:
        random_pwd = secrets.token_urlsafe(32)
        user = create_user(db, google_email, random_pwd, google_name)

    token = create_access_token({"sub": user.id})
    return {"access_token": token, "user": user}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name is not None:
        current_user.name = data.name
    if data.whatsapp_phone is not None:
        # Verifica se o número já está em uso por outro usuário
        from app.services.auth_service import get_user_by_phone
        existing = get_user_by_phone(db, data.whatsapp_phone)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Este número WhatsApp já está em uso")
        current_user.whatsapp_phone = data.whatsapp_phone
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    if data.monthly_income is not None:
        current_user.monthly_income = data.monthly_income if data.monthly_income > 0 else None
    if data.tour_completed is not None:
        current_user.tour_completed = data.tour_completed
    db.commit()
    db.refresh(current_user)
    return current_user
