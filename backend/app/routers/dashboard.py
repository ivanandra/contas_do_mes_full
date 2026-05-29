from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User, MainAccount, AccountType, PaidStatus, AccountsResume, Payment, Expense
from app.schemas.schemas import AccountsSummary, ResumeOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=AccountsSummary)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accounts = db.query(MainAccount).filter(MainAccount.user_id == current_user.id).all()

    total_monthly = sum(
        a.monthly_account.value for a in accounts
        if a.account_type == AccountType.MONTHLY and a.monthly_account
    )
    total_dynamic = sum(
        a.dynamic_account.current_value for a in accounts
        if a.account_type == AccountType.DYNAMIC and a.dynamic_account
    )
    total_installment = sum(
        a.installment_account.installment_value for a in accounts
        if a.account_type == AccountType.INSTALLMENT and a.installment_account
    )
    total_value = total_monthly + total_dynamic + total_installment

    total_paid = 0.0
    for a in accounts:
        if a.paid_status == PaidStatus.PAID:
            if a.monthly_account:
                total_paid += a.monthly_account.value
            elif a.dynamic_account:
                total_paid += a.dynamic_account.current_value
            elif a.installment_account:
                total_paid += a.installment_account.installment_value

    late_count = sum(1 for a in accounts if a.is_late)

    now = datetime.utcnow()
    total_expenses = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.month == now.month,
        Expense.year == now.year,
    ).with_entities(__import__('sqlalchemy').func.sum(Expense.amount)).scalar() or 0.0

    monthly_income = current_user.monthly_income
    saldo_disponivel = None
    if monthly_income is not None and monthly_income > 0:
        saldo_disponivel = round(monthly_income - total_value - float(total_expenses), 2)

    return AccountsSummary(
        total_monthly=round(total_monthly, 2),
        total_dynamic=round(total_dynamic, 2),
        total_installment=round(total_installment, 2),
        total_value=round(total_value, 2),
        total_paid=round(total_paid, 2),
        resting_value=round(max(0.0, total_value - total_paid), 2),
        late_count=late_count,
        total_expenses=round(float(total_expenses), 2),
        monthly_income=monthly_income,
        saldo_disponivel=saldo_disponivel,
    )


@router.get("/resume", response_model=List[ResumeOut])
def list_resumes(
    year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AccountsResume).filter(AccountsResume.user_id == current_user.id)
    if year:
        query = query.filter(AccountsResume.year == year)
    return query.order_by(AccountsResume.year.desc(), AccountsResume.month.desc()).all()


@router.get("/tuco-settings")
def get_tuco_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.models import TucoSettings
    settings_obj = db.query(TucoSettings).filter(TucoSettings.user_id == current_user.id).first()
    if not settings_obj:
        settings_obj = TucoSettings(user_id=current_user.id)
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
    return settings_obj


@router.put("/tuco-settings")
def update_tuco_settings(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.models import TucoSettings
    from app.schemas.schemas import TucoSettingsUpdate
    settings_obj = db.query(TucoSettings).filter(TucoSettings.user_id == current_user.id).first()
    if not settings_obj:
        settings_obj = TucoSettings(user_id=current_user.id)
        db.add(settings_obj)

    update = TucoSettingsUpdate(**data)
    if update.tone is not None:
        settings_obj.tone = update.tone
    if update.zoeira_level is not None:
        settings_obj.zoeira_level = update.zoeira_level
    if update.tuco_name is not None:
        settings_obj.tuco_name = update.tuco_name
    if update.active is not None:
        settings_obj.active = update.active
    if update.email_report_frequency is not None:
        settings_obj.email_report_frequency = update.email_report_frequency

    db.commit()
    db.refresh(settings_obj)
    return settings_obj
