"""
Gera os dados do relatório financeiro para envio por email.
Suporta período semanal e mensal.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import (
    User, MainAccount, AccountType, PaidStatus,
    Payment, Expense, DynamicShopping,
)


def _format_brl(value: float) -> str:
    """Formata número como moeda brasileira: 1234.5 → 'R$ 1.234,50'"""
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def generate_report_data(user: User, db: Session, period: str) -> dict:
    """
    period: 'WEEKLY' ou 'MONTHLY'.
    Retorna dict com dados para o template de email.
    """
    now = datetime.utcnow()

    if period == "WEEKLY":
        start = now - timedelta(days=7)
        period_label = "Semana"
        period_desc = f"últimos 7 dias ({start.strftime('%d/%m')} → {now.strftime('%d/%m')})"
    else:  # MONTHLY
        start = datetime(now.year, now.month, 1)
        period_label = "Mês"
        period_desc = f"{start.strftime('%B/%Y').capitalize()}"

    # Pagamentos de contas
    payments = db.query(Payment).filter(
        Payment.user_id == user.id,
        Payment.payment_date >= start,
    ).all()
    total_payments = sum(p.value_paid for p in payments)

    # Gastos avulsos
    expenses = db.query(Expense).filter(
        Expense.user_id == user.id,
        Expense.expense_date >= start,
    ).all()
    total_expenses = sum(e.amount for e in expenses)

    # Compras em conta dinâmica (crédito/fiado)
    da_ids = [
        a.dynamic_account.id for a in
        db.query(MainAccount).filter(MainAccount.user_id == user.id).all()
        if a.dynamic_account
    ]
    shoppings = db.query(DynamicShopping).filter(
        DynamicShopping.dynamic_account_id.in_(da_ids),
        DynamicShopping.created_at >= start,
    ).all() if da_ids else []
    total_shoppings = sum(s.value for s in shoppings)

    total = total_payments + total_expenses + total_shoppings

    # Top 5 maiores gastos
    all_items = (
        [(p.account_name or "Conta", p.value_paid, "Pagamento") for p in payments] +
        [(e.description, e.amount, e.method or "Avulso") for e in expenses] +
        [(s.description or "Compra", s.value, "Crédito/Fiado") for s in shoppings]
    )
    top_items = sorted(all_items, key=lambda x: x[1], reverse=True)[:5]

    # Contas pendentes
    accounts = db.query(MainAccount).filter(MainAccount.user_id == user.id).all()
    pendentes = []
    for a in accounts:
        if a.paid_status == PaidStatus.PAID:
            continue
        if a.monthly_account:
            valor = a.monthly_account.value
        elif a.dynamic_account:
            valor = a.dynamic_account.current_value
        elif a.installment_account:
            valor = a.installment_account.installment_value
        else:
            valor = 0
        if valor > 0:
            pendentes.append({"name": a.account_name, "value": valor, "is_late": a.is_late})

    return {
        "user_name": user.name.split(" ")[0] if user.name else "amigo",
        "period_label": period_label,
        "period_desc": period_desc,
        "total": total,
        "total_str": _format_brl(total),
        "total_payments_str": _format_brl(total_payments),
        "total_expenses_str": _format_brl(total_expenses),
        "total_shoppings_str": _format_brl(total_shoppings),
        "transactions": len(all_items),
        "top_items": [
            {"name": name, "value": val, "value_str": _format_brl(val), "type": tipo}
            for name, val, tipo in top_items
        ],
        "pendentes": [
            {"name": p["name"], "value_str": _format_brl(p["value"]), "is_late": p["is_late"]}
            for p in pendentes[:5]
        ],
        "pendentes_count": len(pendentes),
        "late_count": sum(1 for p in pendentes if p["is_late"]),
    }
