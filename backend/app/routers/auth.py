from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import UserRegister, UserLogin, UserUpdate, UserOut, Token
from app.services.auth_service import (
    get_user_by_email, create_user, verify_password, create_access_token
)
from app.middleware.auth import get_current_user
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


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
    db.commit()
    db.refresh(current_user)
    return current_user
