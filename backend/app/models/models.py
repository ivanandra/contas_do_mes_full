import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, Enum as SAEnum,
    DateTime, Text, ForeignKey, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


# ─── Enums ──────────────────────────────────────────────────────────────────

class AccountType(str, enum.Enum):
    MONTHLY = "MONTHLY"
    DYNAMIC = "DYNAMIC"
    INSTALLMENT = "INSTALLMENT"


class PaidStatus(str, enum.Enum):
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    NOTPAID = "NOTPAID"


class TucoTone(str, enum.Enum):
    AMOROSO = "AMOROSO"
    NEUTRO = "NEUTRO"
    AGRESSIVO = "AGRESSIVO"


class SubscriptionPlan(str, enum.Enum):
    FREE = "FREE"
    PRO = "PRO"
    PRO_ANUAL = "PRO_ANUAL"


class EmailReportFrequency(str, enum.Enum):
    NONE = "NONE"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"


# ─── User ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    whatsapp_phone = Column(String(30), nullable=True, unique=True)
    avatar_url = Column(Text, nullable=True)
    plan = Column(SAEnum(SubscriptionPlan), default=SubscriptionPlan.FREE, nullable=False)
    stripe_customer_id = Column(String(100), nullable=True, unique=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    plan_expires_at = Column(DateTime, nullable=True)
    tuco_monthly_interactions = Column(Integer, default=0)
    tuco_interactions_reset_at = Column(DateTime, nullable=True)
    monthly_income = Column(Float, nullable=True)  # Renda mensal informada pelo usuário
    tour_completed = Column(Boolean, default=False, nullable=False)  # Onboarding visto?
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    accounts = relationship("MainAccount", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    tuco_settings = relationship("TucoSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    accounts_resume = relationship("AccountsResume", back_populates="user", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    whatsapp_messages = relationship("WhatsAppMessage", back_populates="user", cascade="all, delete-orphan")


# ─── Tuco Settings ──────────────────────────────────────────────────────────

class TucoSettings(Base):
    __tablename__ = "tuco_settings"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    tone = Column(SAEnum(TucoTone), default=TucoTone.NEUTRO)
    zoeira_level = Column(Integer, default=2)  # 1=Leve, 2=Médio, 3=Pesado
    tuco_name = Column(String(50), default="chefe")
    active = Column(Boolean, default=True)
    email_report_frequency = Column(SAEnum(EmailReportFrequency), default=EmailReportFrequency.NONE, nullable=False)
    email_report_last_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tuco_settings")


# ─── Main Account ────────────────────────────────────────────────────────────

class MainAccount(Base):
    __tablename__ = "main_accounts"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    account_name = Column(String(255), nullable=False)
    account_type = Column(SAEnum(AccountType), nullable=False)
    description = Column(Text, nullable=True)
    paid_status = Column(SAEnum(PaidStatus), default=PaidStatus.NOTPAID)
    resting_value = Column(Float, default=0.0)
    is_late = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="accounts")
    monthly_account = relationship("MonthlyAccount", back_populates="main_account", uselist=False, cascade="all, delete-orphan")
    dynamic_account = relationship("DynamicAccount", back_populates="main_account", uselist=False, cascade="all, delete-orphan")
    installment_account = relationship("InstallmentAccount", back_populates="main_account", uselist=False, cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="account")


# ─── Monthly Account (Contas Fixas) ─────────────────────────────────────────

class MonthlyAccount(Base):
    __tablename__ = "monthly_accounts"

    id = Column(String, primary_key=True, default=gen_uuid)
    account_id = Column(String, ForeignKey("main_accounts.id"), unique=True, nullable=False)
    value = Column(Float, nullable=False)
    due_date = Column(Integer, nullable=False)  # dia do mês

    main_account = relationship("MainAccount", back_populates="monthly_account")


# ─── Dynamic Account (Contas Dinâmicas) ──────────────────────────────────────

class DynamicAccount(Base):
    __tablename__ = "dynamic_accounts"

    id = Column(String, primary_key=True, default=gen_uuid)
    account_id = Column(String, ForeignKey("main_accounts.id"), unique=True, nullable=False)
    limit_value = Column(Float, nullable=False)
    current_value = Column(Float, default=0.0)
    due_date = Column(Integer, nullable=False)

    main_account = relationship("MainAccount", back_populates="dynamic_account")
    shopping_items = relationship("DynamicShopping", back_populates="dynamic_account", cascade="all, delete-orphan")


# ─── Dynamic Shopping Items ──────────────────────────────────────────────────

class DynamicShopping(Base):
    __tablename__ = "dynamic_shopping"

    id = Column(String, primary_key=True, default=gen_uuid)
    dynamic_account_id = Column(String, ForeignKey("dynamic_accounts.id"), nullable=False)
    value = Column(Float, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    dynamic_account = relationship("DynamicAccount", back_populates="shopping_items")


# ─── Installment Account (Parcelamentos) ─────────────────────────────────────

class InstallmentAccount(Base):
    __tablename__ = "installment_accounts"

    id = Column(String, primary_key=True, default=gen_uuid)
    account_id = Column(String, ForeignKey("main_accounts.id"), unique=True, nullable=False)
    total_value = Column(Float, nullable=False)
    number_of_installments = Column(Integer, nullable=False)
    installments_paid = Column(Integer, default=0)
    installment_value = Column(Float, nullable=False)  # total / parcelas
    due_date = Column(Integer, nullable=False)

    main_account = relationship("MainAccount", back_populates="installment_account")


# ─── Payment ─────────────────────────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=gen_uuid)
    account_id = Column(String, ForeignKey("main_accounts.id"), nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    value_paid = Column(Float, nullable=False)
    payment_month = Column(Integer, nullable=False)
    payment_year = Column(Integer, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    payment_method = Column(String(50), nullable=True)
    is_partial = Column(Boolean, default=False)
    account_name = Column(String(255), nullable=True)
    account_total_value = Column(Float, nullable=True)
    receipt_image_url = Column(Text, nullable=True)
    receipt_public_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="payments")
    account = relationship("MainAccount", back_populates="payments")


# ─── Accounts Resume (Fechamento Mensal) ─────────────────────────────────────

class AccountsResume(Base):
    __tablename__ = "accounts_resume"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    total_monthly = Column(Float, default=0.0)
    total_dynamic = Column(Float, default=0.0)
    total_installment = Column(Float, default=0.0)
    total_value = Column(Float, default=0.0)
    total_paid = Column(Float, default=0.0)
    resting_value = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "month", "year", name="uq_user_month_year"),)

    user = relationship("User", back_populates="accounts_resume")


# ─── WhatsApp Message Log ─────────────────────────────────────────────────────

class Expense(Base):
    """Gastos avulsos já pagos na hora (PIX, dinheiro, débito)."""
    __tablename__ = "expenses"

    id           = Column(String, primary_key=True, default=gen_uuid)
    user_id      = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    description  = Column(String(255), nullable=False)
    amount       = Column(Float, nullable=False)
    method       = Column(String(30), nullable=True)   # PIX | DINHEIRO | DEBITO
    category     = Column(String(50), nullable=True)   # ALIMENTACAO | TRANSPORTE...
    expense_date = Column(DateTime, default=datetime.utcnow)
    month        = Column(Integer, nullable=False)
    year         = Column(Integer, nullable=False)
    notes        = Column(Text, nullable=True)

    user = relationship("User", back_populates="expenses")


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    phone_number = Column(String(30), nullable=False)
    direction = Column(String(10), nullable=False)  # INBOUND / OUTBOUND
    content = Column(Text, nullable=False)
    intent = Column(String(50), nullable=True)
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="whatsapp_messages")
