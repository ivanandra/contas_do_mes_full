from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.models.models import AccountType, PaidStatus, TucoTone, SubscriptionPlan, EmailReportFrequency


# ─── Auth ────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    whatsapp_phone: Optional[str]
    avatar_url: Optional[str]
    plan: SubscriptionPlan = SubscriptionPlan.FREE
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── Tuco Settings ───────────────────────────────────────────────────────────

class TucoSettingsUpdate(BaseModel):
    tone: Optional[TucoTone] = None
    zoeira_level: Optional[int] = Field(None, ge=1, le=3)
    tuco_name: Optional[str] = Field(None, max_length=50)
    active: Optional[bool] = None
    email_report_frequency: Optional[EmailReportFrequency] = None


class TucoSettingsOut(BaseModel):
    id: str
    tone: TucoTone
    zoeira_level: int
    tuco_name: str
    active: bool
    email_report_frequency: EmailReportFrequency = EmailReportFrequency.NONE

    class Config:
        from_attributes = True


# ─── Accounts ────────────────────────────────────────────────────────────────

class MonthlyAccountData(BaseModel):
    value: float = Field(..., gt=0)
    due_date: int = Field(..., ge=1, le=31)


class DynamicAccountData(BaseModel):
    limit_value: float = Field(..., gt=0)
    due_date: int = Field(..., ge=1, le=31)


class InstallmentAccountData(BaseModel):
    total_value: float = Field(..., gt=0)
    number_of_installments: int = Field(..., ge=1)
    due_date: int = Field(..., ge=1, le=31)


class AccountCreate(BaseModel):
    account_name: str = Field(..., min_length=1, max_length=255)
    account_type: AccountType
    description: Optional[str] = None
    monthly_data: Optional[MonthlyAccountData] = None
    dynamic_data: Optional[DynamicAccountData] = None
    installment_data: Optional[InstallmentAccountData] = None


class AccountUpdate(BaseModel):
    account_name: Optional[str] = None
    description: Optional[str] = None
    monthly_data: Optional[MonthlyAccountData] = None
    dynamic_data: Optional[DynamicAccountData] = None
    installment_data: Optional[InstallmentAccountData] = None


class MonthlyAccountOut(BaseModel):
    id: str
    value: float
    due_date: int

    class Config:
        from_attributes = True


class DynamicAccountOut(BaseModel):
    id: str
    limit_value: float
    current_value: float
    due_date: int

    class Config:
        from_attributes = True


class InstallmentAccountOut(BaseModel):
    id: str
    total_value: float
    number_of_installments: int
    installments_paid: int
    installment_value: float
    due_date: int

    class Config:
        from_attributes = True


class AccountOut(BaseModel):
    id: str
    account_name: str
    account_type: AccountType
    description: Optional[str]
    paid_status: PaidStatus
    resting_value: float
    is_late: bool
    created_at: datetime
    monthly_account: Optional[MonthlyAccountOut]
    dynamic_account: Optional[DynamicAccountOut]
    installment_account: Optional[InstallmentAccountOut]

    class Config:
        from_attributes = True


class AccountsGrouped(BaseModel):
    monthly: List[AccountOut] = []
    dynamic: List[AccountOut] = []
    installment: List[AccountOut] = []


# ─── Shopping ────────────────────────────────────────────────────────────────

class ShoppingAdd(BaseModel):
    value: float = Field(..., gt=0)
    description: Optional[str] = None


class ShoppingOut(BaseModel):
    id: str
    value: float
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Payments ────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    value_paid: float = Field(..., gt=0)
    payment_method: Optional[str] = None
    is_partial: bool = False


class PaymentOut(BaseModel):
    id: str
    value_paid: float
    payment_month: int
    payment_year: int
    payment_date: datetime
    payment_method: Optional[str]
    is_partial: bool
    account_name: Optional[str]
    account_total_value: Optional[float]
    receipt_image_url: Optional[str]

    class Config:
        from_attributes = True


# ─── Expenses (Gastos Avulsos) ───────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    amount: float = Field(..., gt=0)
    method: Optional[str] = None       # PIX | DINHEIRO | DEBITO
    category: Optional[str] = None
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=255)
    amount: Optional[float] = Field(None, gt=0)
    method: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None


class ExpenseOut(BaseModel):
    id: str
    description: str
    amount: float
    method: Optional[str]
    category: Optional[str]
    expense_date: datetime
    month: int
    year: int
    notes: Optional[str]

    class Config:
        from_attributes = True


# ─── Billing / Planos ────────────────────────────────────────────────────────

class CheckoutCreate(BaseModel):
    plan: str  # "PRO" | "PRO_ANUAL"


class CheckoutResponse(BaseModel):
    url: str


class BillingStatus(BaseModel):
    plan: SubscriptionPlan
    plan_expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Dashboard / Resume ──────────────────────────────────────────────────────

class AccountsSummary(BaseModel):
    total_monthly: float
    total_dynamic: float
    total_installment: float
    total_value: float
    total_paid: float
    resting_value: float
    late_count: int
    total_expenses: float = 0.0


class ResumeOut(BaseModel):
    id: str
    month: int
    year: int
    total_monthly: float
    total_dynamic: float
    total_installment: float
    total_value: float
    total_paid: float
    resting_value: float
    created_at: datetime

    class Config:
        from_attributes = True
