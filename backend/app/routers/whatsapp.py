"""
WhatsApp Webhook — suporta Twilio e Evolution API.
Fluxo: recebe mensagem → interpreta com Claude → age → responde com Tuco.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Request, Form, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.services.auth_service import get_user_by_phone
from app.services.tuco_service import interpret_message, generate_tuco_response, generate_query_response
from app.services.whatsapp_service import send_whatsapp_message, parse_twilio_webhook, parse_evolution_webhook
from app.models.models import WhatsAppMessage, MainAccount, AccountType, DynamicShopping, Payment, PaidStatus
from app.config import settings

router = APIRouter(prefix="/webhook", tags=["whatsapp"])

HELP_MSG = """👋 Olá! Eu sou o *Tuco*, seu assistente financeiro!

*Como usar:*
• Registrar gasto: `Mercado: 150` ou `gastei 80 no uber`
• Ver gastos hoje: `quanto gastei hoje?`
• Ver gastos do mês: `resumo do mês`
• Ver saldo: `qual meu saldo?`
• Listar contas: `minhas contas`
• Registrar pagamento: `registrar pagamento aluguel - PIX` ou `paguei o aluguel no pix`

Manda lá! Tô de olho no seu dinheiro! 💰"""

UNKNOWN_MSG = "Hmm, não entendi bem... 🤔 Tenta assim:\n`Mercado: 150` ou pergunta `quanto gastei hoje?`"


async def process_whatsapp_message(phone: str, body: str, db: Session, provider: str = "twilio"):
    """Processa mensagem recebida e responde via WhatsApp"""
    import logging
    logger = logging.getLogger("whatsapp")

    # Log mensagem recebida — salva imediatamente para não perder em caso de erro
    log = WhatsAppMessage(phone_number=phone, direction="INBOUND", content=body)
    db.add(log)
    db.commit()
    db.refresh(log)

    try:
        # Busca usuário pelo telefone
        user = get_user_by_phone(db, phone)
        if not user:
            log.intent = "USER_NOT_FOUND"
            db.commit()
            msg = (
                f"❌ Número não cadastrado.\n\n"
                f"Acesse {settings.FRONTEND_URL} para criar sua conta e "
                f"vincular seu WhatsApp nas configurações!"
            )
            await send_whatsapp_message(phone, msg, provider)
            return

        log.user_id = user.id
        db.commit()

        # Comando de ajuda
        if body.lower().strip() in ["help", "ajuda", "/ajuda", "oi", "olá", "ola", "inicio"]:
            log.intent = "HELP"
            log.processed = True
            db.commit()
            await send_whatsapp_message(phone, HELP_MSG, provider)
            return

        # Interpreta mensagem com Claude
        interpretation = await interpret_message(body, user, db)
        intent = interpretation.get("intent", "DESCONHECIDO")
        log.intent = intent
        db.commit()

        response_text = ""

        # ── Pagamento de conta existente ─────────────────────────────────────
        if intent == "PAGAMENTO":
            payment_data = interpretation.get("payment", {}) or {}
            account_name = payment_data.get("account_name", "")
            payment_method = payment_data.get("payment_method")

            # Busca conta pelo nome (fuzzy)
            accounts = db.query(MainAccount).filter(MainAccount.user_id == user.id).all()
            target = None
            if account_name:
                for acc in accounts:
                    if account_name.lower() in acc.account_name.lower() or acc.account_name.lower() in account_name.lower():
                        target = acc
                        break

            if not target:
                response_text = f"Não encontrei nenhuma conta com esse nome. Suas contas: {', '.join(a.account_name for a in accounts) or 'nenhuma cadastrada'}."
            elif target.paid_status == PaidStatus.PAID:
                response_text = await generate_tuco_response(
                    f"Tentou pagar {target.account_name} mas já estava paga",
                    {"account": target.account_name, "ja_pago": True},
                    user, db
                )
            else:
                # Determina o valor da conta
                if target.monthly_account:
                    valor = target.monthly_account.value
                elif target.installment_account:
                    valor = target.installment_account.installment_value
                elif target.dynamic_account:
                    valor = target.dynamic_account.current_value
                else:
                    valor = 0.0

                now = datetime.utcnow()
                pay = Payment(
                    account_id=target.id,
                    user_id=user.id,
                    value_paid=valor,
                    payment_month=now.month,
                    payment_year=now.year,
                    payment_method=payment_method,
                    account_name=target.account_name,
                    account_total_value=valor,
                    is_partial=False,
                )
                db.add(pay)
                target.paid_status = PaidStatus.PAID
                db.commit()
                response_text = await generate_tuco_response(
                    f"Registrou pagamento de {target.account_name}: R$ {valor:.2f} via {payment_method or 'não informado'}",
                    {"account": target.account_name, "value": valor, "method": payment_method},
                    user, db
                )

        # ── Novo gasto ──────────────────────────────────────────────────────────
        elif intent == "NOVO_GASTO":
            expense = interpretation.get("expense", {}) or {}
            amount = expense.get("amount", 0)
            category = expense.get("category", "Gasto")
            description = expense.get("description", body)

            if amount <= 0:
                response_text = "Não consegui identificar o valor. Tenta assim: `Mercado: 150` 😅"
            else:
                # Tenta associar à conta dinâmica existente
                accounts = db.query(MainAccount).filter(
                    MainAccount.user_id == user.id,
                    MainAccount.account_type == AccountType.DYNAMIC
                ).all()
                target_account = None
                for acc in accounts:
                    if category.lower() in acc.account_name.lower() or acc.account_name.lower() in category.lower():
                        target_account = acc
                        break

                if target_account and target_account.dynamic_account:
                    # Adiciona ao carrinho da conta dinâmica
                    item = DynamicShopping(
                        dynamic_account_id=target_account.dynamic_account.id,
                        value=amount,
                        description=description or category,
                    )
                    db.add(item)
                    target_account.dynamic_account.current_value = round(
                        target_account.dynamic_account.current_value + amount, 2
                    )
                    db.commit()
                    response_text = await generate_tuco_response(
                        f"Adicionou R$ {amount:.2f} em {target_account.account_name}",
                        {"category": category, "amount": amount, "account": target_account.account_name},
                        user, db
                    )
                else:
                    # Registra como pagamento avulso
                    now = datetime.utcnow()
                    payment = Payment(
                        user_id=user.id,
                        value_paid=amount,
                        payment_month=now.month,
                        payment_year=now.year,
                        account_name=category,
                        account_total_value=amount,
                        is_partial=False,
                    )
                    db.add(payment)
                    db.commit()
                    response_text = await generate_tuco_response(
                        f"Registrou gasto de R$ {amount:.2f} em {category} via WhatsApp",
                        {"category": category, "amount": amount, "via_whatsapp": True},
                        user, db
                    )

        # ── Consulta ─────────────────────────────────────────────────────────
        elif intent == "CONSULTA":
            query = interpretation.get("query", {}) or {}
            query_type = query.get("type", "MES")
            now = datetime.utcnow()

            if query_type in ("HOJE",):
                payments = db.query(Payment).filter(
                    Payment.user_id == user.id,
                    Payment.payment_date >= now.replace(hour=0, minute=0, second=0),
                ).all()
                total = sum(p.value_paid for p in payments)
                data = {
                    "total_hoje": f"R$ {total:.2f}",
                    "transacoes": len(payments),
                    "detalhes": [f"{p.account_name}: R$ {p.value_paid:.2f}" for p in payments],
                }
                response_text = await generate_query_response("HOJE", data, user, db)

            elif query_type == "SALDO":
                accounts = db.query(MainAccount).filter(MainAccount.user_id == user.id).all()
                total = sum(
                    (a.monthly_account.value if a.monthly_account else 0) +
                    (a.dynamic_account.current_value if a.dynamic_account else 0) +
                    (a.installment_account.installment_value if a.installment_account else 0)
                    for a in accounts
                )
                paid = sum(
                    (a.monthly_account.value if a.monthly_account and a.paid_status == PaidStatus.PAID else 0) +
                    (a.dynamic_account.current_value if a.dynamic_account and a.paid_status == PaidStatus.PAID else 0)
                    for a in accounts
                )
                data = {
                    "total_mes": f"R$ {total:.2f}",
                    "total_pago": f"R$ {paid:.2f}",
                    "saldo_restante": f"R$ {max(0, total - paid):.2f}",
                }
                response_text = await generate_query_response("SALDO", data, user, db)

            elif query_type == "LISTA":
                accounts = db.query(MainAccount).filter(MainAccount.user_id == user.id).all()
                data = {
                    "contas_fixas": [a.account_name for a in accounts if a.account_type == AccountType.MONTHLY],
                    "contas_dinamicas": [a.account_name for a in accounts if a.account_type == AccountType.DYNAMIC],
                    "parcelamentos": [a.account_name for a in accounts if a.account_type == AccountType.INSTALLMENT],
                }
                response_text = await generate_query_response("LISTA", data, user, db)

            else:  # MES / SEMANA
                payments = db.query(Payment).filter(
                    Payment.user_id == user.id,
                    Payment.payment_month == now.month,
                    Payment.payment_year == now.year,
                ).all()
                total = sum(p.value_paid for p in payments)
                top = sorted(payments, key=lambda p: p.value_paid, reverse=True)[:3]
                data = {
                    "total_mes": f"R$ {total:.2f}",
                    "transacoes": len(payments),
                    "maiores_gastos": [
                        f"{p.account_name}: R$ {p.value_paid:.2f}" for p in top
                    ],
                }
                response_text = await generate_query_response("MES", data, user, db)

        else:
            response_text = UNKNOWN_MSG

        # Salva log e envia resposta
        log.processed = True
        db.commit()

        if response_text:
            await send_whatsapp_message(phone, response_text, provider)
            db.add(WhatsAppMessage(
                user_id=user.id,
                phone_number=phone,
                direction="OUTBOUND",
                content=response_text,
                processed=True,
            ))
            db.commit()

    except Exception as e:
        logger.error(f"[WhatsApp] Erro ao processar mensagem de {phone}: {e}", exc_info=True)
        try:
            db.rollback()
            log.intent = "ERRO"
            db.add(log)
            db.commit()
        except Exception:
            pass


async def _run_with_new_db(phone: str, body: str, provider: str):
    """Cria sessão própria para o background task (não reutiliza a do request)."""
    db = SessionLocal()
    try:
        await process_whatsapp_message(phone, body, db, provider)
    finally:
        db.close()


# ─── Twilio Webhook ──────────────────────────────────────────────────────────

@router.post("/twilio")
async def twilio_webhook(background_tasks: BackgroundTasks, request: Request):
    form = await request.form()
    parsed = parse_twilio_webhook(dict(form))
    if parsed["body"]:
        background_tasks.add_task(_run_with_new_db, parsed["from"], parsed["body"], "twilio")
    return {"status": "ok"}


# ─── Evolution API Webhook ───────────────────────────────────────────────────

@router.post("/evolution")
async def evolution_webhook(background_tasks: BackgroundTasks, request: Request):
    body = await request.json()
    parsed = parse_evolution_webhook(body)
    if parsed:
        background_tasks.add_task(_run_with_new_db, parsed["from"], parsed["body"], "evolution")
    return {"status": "ok"}
