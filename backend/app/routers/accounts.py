from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import (
    User, MainAccount, MonthlyAccount, DynamicAccount,
    InstallmentAccount, DynamicShopping, AccountType, PaidStatus
)
from app.schemas.schemas import (
    AccountCreate, AccountUpdate, AccountOut, AccountsGrouped,
    ShoppingAdd, ShoppingOut
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _build_account_out(account: MainAccount) -> dict:
    return AccountOut.model_validate(account)


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=AccountsGrouped)
def list_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accounts = (
        db.query(MainAccount)
        .filter(MainAccount.user_id == current_user.id)
        .order_by(MainAccount.created_at.asc())
        .all()
    )
    grouped = AccountsGrouped()
    for a in accounts:
        out = AccountOut.model_validate(a)
        if a.account_type == AccountType.MONTHLY:
            grouped.monthly.append(out)
        elif a.account_type == AccountType.DYNAMIC:
            grouped.dynamic.append(out)
        elif a.account_type == AccountType.INSTALLMENT:
            grouped.installment.append(out)
    return grouped


@router.get("/{account_id}", response_model=AccountOut)
def get_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.query(MainAccount).filter(
        MainAccount.id == account_id,
        MainAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    return account


# ─── Create ──────────────────────────────────────────────────────────────────

@router.post("", response_model=AccountOut, status_code=201)
def create_account(
    data: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = MainAccount(
        user_id=current_user.id,
        account_name=data.account_name,
        account_type=data.account_type,
        description=data.description,
    )
    db.add(account)
    db.flush()

    if data.account_type == AccountType.MONTHLY:
        if not data.monthly_data:
            raise HTTPException(status_code=400, detail="Dados da conta fixa são obrigatórios")
        db.add(MonthlyAccount(
            account_id=account.id,
            value=data.monthly_data.value,
            due_date=data.monthly_data.due_date,
        ))
    elif data.account_type == AccountType.DYNAMIC:
        if not data.dynamic_data:
            raise HTTPException(status_code=400, detail="Dados da conta dinâmica são obrigatórios")
        db.add(DynamicAccount(
            account_id=account.id,
            limit_value=data.dynamic_data.limit_value,
            due_date=data.dynamic_data.due_date,
        ))
    elif data.account_type == AccountType.INSTALLMENT:
        if not data.installment_data:
            raise HTTPException(status_code=400, detail="Dados do parcelamento são obrigatórios")
        inst = data.installment_data
        installment_value = round(inst.total_value / inst.number_of_installments, 2)
        db.add(InstallmentAccount(
            account_id=account.id,
            total_value=inst.total_value,
            number_of_installments=inst.number_of_installments,
            installment_value=installment_value,
            due_date=inst.due_date,
        ))

    db.commit()
    db.refresh(account)
    return account


# ─── Update ──────────────────────────────────────────────────────────────────

@router.put("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: str,
    data: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.query(MainAccount).filter(
        MainAccount.id == account_id, MainAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada")

    if data.account_name:
        account.account_name = data.account_name
    if data.description is not None:
        account.description = data.description

    if data.monthly_data and account.monthly_account:
        account.monthly_account.value = data.monthly_data.value
        account.monthly_account.due_date = data.monthly_data.due_date

    if data.dynamic_data and account.dynamic_account:
        account.dynamic_account.limit_value = data.dynamic_data.limit_value
        account.dynamic_account.due_date = data.dynamic_data.due_date

    if data.installment_data and account.installment_account:
        inst = data.installment_data
        account.installment_account.total_value = inst.total_value
        account.installment_account.number_of_installments = inst.number_of_installments
        account.installment_account.installment_value = round(inst.total_value / inst.number_of_installments, 2)
        account.installment_account.due_date = inst.due_date

    db.commit()
    db.refresh(account)
    return account


# ─── Delete ──────────────────────────────────────────────────────────────────

@router.delete("/{account_id}", status_code=204)
def delete_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.query(MainAccount).filter(
        MainAccount.id == account_id, MainAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    db.delete(account)
    db.commit()


# ─── Pay Account ─────────────────────────────────────────────────────────────

@router.post("/{account_id}/pay", status_code=200)
def pay_account(
    account_id: str,
    value_paid: float,
    payment_method: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.models import Payment
    account = db.query(MainAccount).filter(
        MainAccount.id == account_id, MainAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada")

    # Calcula valor total da conta
    total_value = 0.0
    if account.monthly_account:
        total_value = account.monthly_account.value
    elif account.dynamic_account:
        total_value = account.dynamic_account.current_value
    elif account.installment_account:
        total_value = account.installment_account.installment_value

    # Atualiza status de pagamento
    resting = max(0.0, total_value - value_paid)
    if resting == 0:
        account.paid_status = PaidStatus.PAID
        account.resting_value = 0.0
        if account.installment_account:
            account.installment_account.installments_paid += 1
    else:
        account.paid_status = PaidStatus.PARTIAL
        account.resting_value = resting
    account.is_late = False

    now = datetime.utcnow()
    payment = Payment(
        account_id=account_id,
        user_id=current_user.id,
        value_paid=value_paid,
        payment_month=now.month,
        payment_year=now.year,
        payment_method=payment_method,
        is_partial=(resting > 0),
        account_name=account.account_name,
        account_total_value=total_value,
    )
    db.add(payment)
    db.commit()
    db.refresh(account)
    return {"message": "Pagamento registrado!", "account": AccountOut.model_validate(account)}


# ─── Dynamic Shopping ─────────────────────────────────────────────────────────

@router.post("/{account_id}/shopping", response_model=ShoppingOut, status_code=201)
def add_shopping(
    account_id: str,
    data: ShoppingAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.query(MainAccount).filter(
        MainAccount.id == account_id, MainAccount.user_id == current_user.id
    ).first()
    if not account or not account.dynamic_account:
        raise HTTPException(status_code=404, detail="Conta dinâmica não encontrada")

    item = DynamicShopping(
        dynamic_account_id=account.dynamic_account.id,
        value=data.value,
        description=data.description,
    )
    db.add(item)
    account.dynamic_account.current_value = round(
        account.dynamic_account.current_value + data.value, 2
    )
    db.commit()
    db.refresh(item)
    return item


@router.get("/{account_id}/shopping", response_model=List[ShoppingOut])
def list_shopping(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.query(MainAccount).filter(
        MainAccount.id == account_id, MainAccount.user_id == current_user.id
    ).first()
    if not account or not account.dynamic_account:
        raise HTTPException(status_code=404, detail="Conta dinâmica não encontrada")
    return account.dynamic_account.shopping_items


@router.delete("/{account_id}/shopping/{item_id}", status_code=204)
def delete_shopping(
    account_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.query(MainAccount).filter(
        MainAccount.id == account_id, MainAccount.user_id == current_user.id
    ).first()
    if not account or not account.dynamic_account:
        raise HTTPException(status_code=404, detail="Conta dinâmica não encontrada")

    item = db.query(DynamicShopping).filter(
        DynamicShopping.id == item_id,
        DynamicShopping.dynamic_account_id == account.dynamic_account.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    account.dynamic_account.current_value = max(
        0.0, round(account.dynamic_account.current_value - item.value, 2)
    )
    db.delete(item)
    db.commit()


# ─── Mark Late ───────────────────────────────────────────────────────────────

@router.post("/check-late", status_code=200)
def check_late_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = datetime.utcnow()
    accounts = db.query(MainAccount).filter(
        MainAccount.user_id == current_user.id,
        MainAccount.paid_status != PaidStatus.PAID,
    ).all()
    late_count = 0
    for a in accounts:
        due = None
        if a.monthly_account:
            due = a.monthly_account.due_date
        elif a.dynamic_account:
            due = a.dynamic_account.due_date
        elif a.installment_account:
            due = a.installment_account.due_date
        if due and today.day > due:
            a.is_late = True
            late_count += 1
    db.commit()
    return {"late_count": late_count}


# ─── Reset Month ─────────────────────────────────────────────────────────────

@router.post("/reset-month", status_code=200)
def reset_month(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.models import AccountsResume
    today = datetime.utcnow()
    accounts = db.query(MainAccount).filter(MainAccount.user_id == current_user.id).all()

    total_monthly = total_dynamic = total_installment = total_paid = 0.0
    for a in accounts:
        if a.monthly_account:
            total_monthly += a.monthly_account.value
        elif a.dynamic_account:
            total_dynamic += a.dynamic_account.current_value
            a.dynamic_account.current_value = 0.0
        elif a.installment_account:
            total_installment += a.installment_account.installment_value

        if a.paid_status == PaidStatus.PAID:
            if a.monthly_account:
                total_paid += a.monthly_account.value
            elif a.dynamic_account:
                total_paid += a.dynamic_account.current_value
            elif a.installment_account:
                total_paid += a.installment_account.installment_value

        a.paid_status = PaidStatus.NOTPAID
        a.resting_value = 0.0
        a.is_late = False

    total_value = total_monthly + total_dynamic + total_installment
    resume = AccountsResume(
        user_id=current_user.id,
        month=today.month,
        year=today.year,
        total_monthly=total_monthly,
        total_dynamic=total_dynamic,
        total_installment=total_installment,
        total_value=total_value,
        total_paid=total_paid,
        resting_value=max(0.0, total_value - total_paid),
    )
    db.add(resume)
    db.commit()
    return {"message": "Mês fechado com sucesso! 🎉"}
