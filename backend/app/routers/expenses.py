from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Expense, User
from app.schemas.schemas import ExpenseCreate, ExpenseUpdate, ExpenseOut

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=List[ExpenseOut])
def list_expenses(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Expense).filter(Expense.user_id == current_user.id)
    if month:
        q = q.filter(Expense.month == month)
    if year:
        q = q.filter(Expense.year == year)
    return q.order_by(Expense.expense_date.desc()).all()


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    expense = Expense(
        user_id=current_user.id,
        description=data.description,
        amount=data.amount,
        method=data.method,
        category=data.category,
        notes=data.notes,
        month=now.month,
        year=now.year,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: str,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.id,
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto não encontrado")

    if data.description is not None:
        expense.description = data.description
    if data.amount is not None:
        expense.amount = data.amount
    if data.method is not None:
        expense.method = data.method or None
    if data.category is not None:
        expense.category = data.category or None
    if data.notes is not None:
        expense.notes = data.notes or None

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.id,
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto não encontrado")
    db.delete(expense)
    db.commit()
