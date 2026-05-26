"""
WhatsApp Webhook — suporta Twilio e Evolution API.
Fluxo: recebe mensagem → Claude interpreta (com histórico) → executa → responde com Tuco.
"""
import re
from datetime import datetime
from fastapi import APIRouter, Depends, Request, Form, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.services.auth_service import get_user_by_phone
from app.services.tuco_service import interpret_message, generate_tuco_response, generate_query_response
from app.services.whatsapp_service import send_whatsapp_message, parse_twilio_webhook, parse_evolution_webhook
from app.models.models import WhatsAppMessage, MainAccount, DynamicAccount, AccountType, DynamicShopping, Payment, Expense, PaidStatus, SubscriptionPlan
from app.config import settings

router = APIRouter(prefix="/webhook", tags=["whatsapp"])

HELP_MSG = """👋 Eu sou o *Tuco*, seu assistente financeiro!

*Pagamentos de contas:*
• `paguei o aluguel no pix`
• `registrar pagamento luz - débito`

*Compra no crédito ou fiado (acumula na conta):*
• `Mercado 150 crédito`
• `Mercado 150 conta` _(vai pra conta Mercado)_

*Gasto avulso — já saiu do bolso:*
• `Mercado 150 pix`
• `gastei 80 no uber` _(dinheiro/débito/pix)_
• `farmácia 35 dinheiro`

*Consultas:*
• `quanto gastei hoje?`
• `resumo do mês`
• `qual meu saldo?`
• `minhas contas`

*Correção de valor:*
• `errei, o Mercado na verdade foi 224`
• `corrigi o uber, era 45`

*Múltiplos gastos de uma vez:*
• `Mercado 100 e Gasolina 230`
• `iFood 45, Uber 30, Farmácia 80 pix`

*Abrir o app:*
• `Tuco, abre o app pra mim`

💡 _Fale de forma natural! "Marquei 30 no mercado", "Comprei 150 no açougue crédito", "Quanto gastei essa semana?" — eu entendo!_"""

UNKNOWN_MSG = "Hmm, não entendi bem... 🤔 Tenta assim:\n`Mercado 150` ou pergunta `quanto gastei hoje?`"


async def _execute_single_intent(intent_data: dict, user, db: Session) -> str:
    """Executa um único intent e retorna o texto de resposta."""
    import logging
    logger = logging.getLogger("whatsapp")
    intent = intent_data.get("intent", "DESCONHECIDO")

    # ── Pagamento de conta existente ─────────────────────────────────────────
    if intent == "PAGAMENTO":
        payment_data = intent_data.get("payment", {}) or {}
        account_name = payment_data.get("account_name", "")
        payment_method = payment_data.get("payment_method")

        accounts = db.query(MainAccount).filter(MainAccount.user_id == user.id).all()
        target = None
        if account_name:
            for acc in accounts:
                if account_name.lower() in acc.account_name.lower() or acc.account_name.lower() in account_name.lower():
                    target = acc
                    break

        if not target:
            return f"Não encontrei conta com esse nome. Suas contas: {', '.join(a.account_name for a in accounts) or 'nenhuma cadastrada'}."
        if target.paid_status == PaidStatus.PAID:
            return await generate_tuco_response(
                f"Tentou pagar {target.account_name} mas já estava paga",
                {"account": target.account_name, "ja_pago": True},
                user, db
            )

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
        return await generate_tuco_response(
            f"Registrou pagamento de {target.account_name}: R$ {valor:.2f} via {payment_method or 'não informado'}",
            {"account": target.account_name, "value": valor, "method": payment_method},
            user, db
        )

    # ── Compra que vai para uma conta dinâmica (crédito, fiado, etc.) ────────
    elif intent == "NOVO_GASTO":
        expense_data = intent_data.get("expense", {}) or {}
        amount = expense_data.get("amount", 0)
        category = expense_data.get("category", "Gasto")
        method = expense_data.get("method")

        if amount <= 0:
            return "Não consegui identificar o valor. Tenta assim: `Mercado 150` 😅"

        dynamic_accounts = db.query(MainAccount).filter(
            MainAccount.user_id == user.id,
            MainAccount.account_type == AccountType.DYNAMIC,
        ).all()
        target_account = None
        for acc in dynamic_accounts:
            if category.lower() in acc.account_name.lower() or acc.account_name.lower() in category.lower():
                target_account = acc
                break

        if not target_account:
            if method == "CREDITO":
                # Cartão/crédito: busca conta de crédito existente ou cria "Crédito"
                credit_keywords = ["crédito", "credito", "cartão", "cartao", "card", "visa", "master", "nubank", "itaú", "bradesco"]
                for acc in dynamic_accounts:
                    if any(kw in acc.account_name.lower() for kw in credit_keywords):
                        target_account = acc
                        break
                if not target_account:
                    new_main = MainAccount(
                        user_id=user.id,
                        account_name="Crédito",
                        account_type=AccountType.DYNAMIC,
                        description="Cartão de crédito (criado pelo Tuco)",
                    )
                    db.add(new_main)
                    db.flush()
                    db.add(DynamicAccount(account_id=new_main.id, limit_value=5000.0, current_value=0.0, due_date=10))
                    db.flush()
                    db.refresh(new_main)
                    target_account = new_main
            else:
                # "Marquei", "fiado", conta nomeada: cria conta com o nome da categoria
                new_main = MainAccount(
                    user_id=user.id,
                    account_name=category,
                    account_type=AccountType.DYNAMIC,
                    description=f"Conta criada pelo Tuco",
                )
                db.add(new_main)
                db.flush()
                db.add(DynamicAccount(account_id=new_main.id, limit_value=0.0, current_value=0.0, due_date=10))
                db.flush()
                db.refresh(new_main)
                target_account = new_main

        if target_account and target_account.dynamic_account:
            item = DynamicShopping(
                dynamic_account_id=target_account.dynamic_account.id,
                value=amount,
                description=category,
            )
            db.add(item)
            da = target_account.dynamic_account
            da.current_value = round(da.current_value + amount, 2)
            db.commit()

            limit_pct = (da.current_value / da.limit_value * 100) if da.limit_value else 0
            limit_warning = ""
            if limit_pct >= 90:
                limit_warning = f"\n⚠️ Você está em {limit_pct:.0f}% do limite de {target_account.account_name}!"
            elif limit_pct >= 70:
                limit_warning = f" (já em {limit_pct:.0f}% do limite)"

            resp = await generate_tuco_response(
                f"Adicionou R$ {amount:.2f} em {target_account.account_name}",
                {"category": category, "amount": amount, "account": target_account.account_name,
                 "current_value": da.current_value, "limit_value": da.limit_value},
                user, db
            )
            return resp + limit_warning

        return f"Não encontrei conta para '{category}'. Responde com o método:\n`{category} {amount:.0f} pix` · `{category} {amount:.0f} dinheiro` · `{category} {amount:.0f} crédito`"

    # ── Gasto avulso — já saiu do bolso (PIX, dinheiro, débito) ──────────────
    elif intent == "GASTO_AVULSO":
        expense_data = intent_data.get("expense", {}) or {}
        amount = expense_data.get("amount", 0)
        category = expense_data.get("category", "Gasto")
        method = expense_data.get("method")

        if amount <= 0:
            return "Não consegui identificar o valor. Tenta assim: `Mercado 150 pix` 😅"

        now = datetime.utcnow()
        expense = Expense(
            user_id=user.id,
            description=category,
            amount=amount,
            method=method,
            category=category,
            month=now.month,
            year=now.year,
        )
        db.add(expense)
        db.commit()
        return await generate_tuco_response(
            f"Registrou gasto avulso de R$ {amount:.2f} em {category}" + (f" via {method}" if method else ""),
            {"category": category, "amount": amount, "method": method or "não informado"},
            user, db
        )

    # ── Múltiplos gastos numa mensagem ────────────────────────────────────────
    elif intent == "MULTI_GASTO":
        items = intent_data.get("items", [])
        if not items:
            return UNKNOWN_MSG

        now = datetime.utcnow()
        created = []
        limit_warnings = []

        dynamic_accounts = db.query(MainAccount).filter(
            MainAccount.user_id == user.id,
            MainAccount.account_type == AccountType.DYNAMIC,
        ).all()

        for item in items:
            category = item.get("category", "Gasto")
            amount = item.get("amount", 0)
            method = item.get("method")
            if amount <= 0:
                continue

            # Decide se vai para conta dinâmica ou gasto avulso
            goes_to_account = (
                method == "CREDITO" or
                method is None or  # sem método = fiado/marquei → conta nomeada
                any(category.lower() in acc.account_name.lower() or acc.account_name.lower() in category.lower() for acc in dynamic_accounts)
            )
            is_avulso = method in ("PIX", "DINHEIRO", "DEBITO")

            if is_avulso:
                db.add(Expense(
                    user_id=user.id, description=category, amount=amount,
                    method=method, category=category, month=now.month, year=now.year,
                ))
                created.append({"category": category, "amount": amount, "dest": "avulso", "method": method})
                continue

            # Conta dinâmica: busca por nome primeiro
            target_account = None
            for acc in dynamic_accounts:
                if category.lower() in acc.account_name.lower() or acc.account_name.lower() in category.lower():
                    target_account = acc
                    break

            if not target_account:
                if method == "CREDITO":
                    # Busca conta de crédito genérica ou cria "Crédito"
                    credit_kw = ["crédito", "credito", "cartão", "cartao", "card", "visa", "master", "nubank", "itaú", "bradesco"]
                    for acc in dynamic_accounts:
                        if any(kw in acc.account_name.lower() for kw in credit_kw):
                            target_account = acc
                            break
                    if not target_account:
                        new_main = MainAccount(user_id=user.id, account_name="Crédito", account_type=AccountType.DYNAMIC, description="Cartão de crédito (criado pelo Tuco)")
                        db.add(new_main); db.flush()
                        db.add(DynamicAccount(account_id=new_main.id, limit_value=5000.0, current_value=0.0, due_date=10))
                        db.flush(); db.refresh(new_main)
                        target_account = new_main
                        dynamic_accounts.append(new_main)
                else:
                    # "Marquei", "fiado", sem método → cria conta com nome da categoria
                    new_main = MainAccount(user_id=user.id, account_name=category, account_type=AccountType.DYNAMIC, description="Conta criada pelo Tuco")
                    db.add(new_main); db.flush()
                    db.add(DynamicAccount(account_id=new_main.id, limit_value=0.0, current_value=0.0, due_date=10))
                    db.flush(); db.refresh(new_main)
                    target_account = new_main
                    dynamic_accounts.append(new_main)

            if target_account and target_account.dynamic_account:
                db.add(DynamicShopping(dynamic_account_id=target_account.dynamic_account.id, value=amount, description=category))
                da = target_account.dynamic_account
                da.current_value = round(da.current_value + amount, 2)
                limit_pct = (da.current_value / da.limit_value * 100) if da.limit_value else 0
                if limit_pct >= 90:
                    limit_warnings.append(f"⚠️ {target_account.account_name} em {limit_pct:.0f}% do limite!")
                elif limit_pct >= 70:
                    limit_warnings.append(f"{target_account.account_name} já em {limit_pct:.0f}% do limite")
                created.append({"category": category, "amount": amount, "dest": "conta", "account_name": target_account.account_name})

        db.commit()

        if not created:
            return "Não consegui identificar os valores. Tenta enviar um por vez 😅"

        total = sum(i["amount"] for i in created)
        items_desc = " + ".join([
            f"{i['category']} R${i['amount']:.2f} ({'→ ' + i['account_name'] if i['dest'] == 'conta' else i.get('method') or 'avulso'})"
            for i in created
        ])
        resp = await generate_tuco_response(
            f"Registrou {len(created)} gastos: {items_desc} — total R$ {total:.2f}",
            {"items": created, "total": total, "count": len(created)},
            user, db
        )
        if limit_warnings:
            resp += "\n" + " | ".join(limit_warnings)
        return resp

    # ── Ambíguo — sem método e sem conta dinâmica com esse nome ──────────────
    elif intent == "AMBIGUO":
        expense_data = intent_data.get("expense", {}) or {}
        amount = expense_data.get("amount", 0)
        category = expense_data.get("category", "")
        if amount > 0 and category:
            return (
                f"Entendi *{category}: R$ {amount:.2f}* — como foi?\n\n"
                f"• `{category} {amount:.0f} conta` — acumula na conta _{category}_\n"
                f"• `{category} {amount:.0f} crédito` — cartão de crédito\n"
                f"• `{category} {amount:.0f} pix` — já paguei no PIX\n"
                f"• `{category} {amount:.0f} dinheiro` — já paguei em dinheiro"
            )
        return UNKNOWN_MSG

    # ── Consulta ──────────────────────────────────────────────────────────────
    elif intent == "CONSULTA":
        query = intent_data.get("query", {}) or {}
        query_type = query.get("type", "MES")
        now = datetime.utcnow()

        if query_type == "HOJE":
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            payments = db.query(Payment).filter(Payment.user_id == user.id, Payment.payment_date >= today).all()
            avulsos = db.query(Expense).filter(Expense.user_id == user.id, Expense.expense_date >= today).all()
            _da_ids = [a.dynamic_account.id for a in db.query(MainAccount).filter(MainAccount.user_id == user.id).all() if a.dynamic_account]
            compras = db.query(DynamicShopping).filter(
                DynamicShopping.dynamic_account_id.in_(_da_ids),
                DynamicShopping.created_at >= today,
            ).all() if _da_ids else []
            total = sum(p.value_paid for p in payments) + sum(e.amount for e in avulsos) + sum(c.value for c in compras)
            detalhes = (
                [f"{p.account_name}: R$ {p.value_paid:.2f}" for p in payments] +
                [f"{e.description}: R$ {e.amount:.2f}" + (f" ({e.method})" if e.method else "") for e in avulsos] +
                [f"{c.description or 'Compra'}: R$ {c.value:.2f} (crédito)" for c in compras]
            )
            return await generate_query_response("HOJE", {
                "total_hoje": f"R$ {total:.2f}",
                "transacoes": len(payments) + len(avulsos) + len(compras),
                "detalhes": detalhes,
            }, user, db)

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
            return await generate_query_response("SALDO", {
                "total_mes": f"R$ {total:.2f}",
                "total_pago": f"R$ {paid:.2f}",
                "saldo_restante": f"R$ {max(0, total - paid):.2f}",
            }, user, db)

        elif query_type == "LISTA":
            accounts = db.query(MainAccount).filter(MainAccount.user_id == user.id).all()
            return await generate_query_response("LISTA", {
                "contas_fixas": [a.account_name for a in accounts if a.account_type == AccountType.MONTHLY],
                "contas_dinamicas": [a.account_name for a in accounts if a.account_type == AccountType.DYNAMIC],
                "parcelamentos": [a.account_name for a in accounts if a.account_type == AccountType.INSTALLMENT],
            }, user, db)

        else:  # MES
            payments = db.query(Payment).filter(
                Payment.user_id == user.id, Payment.payment_month == now.month, Payment.payment_year == now.year,
            ).all()
            avulsos = db.query(Expense).filter(
                Expense.user_id == user.id, Expense.month == now.month, Expense.year == now.year,
            ).all()
            _da_ids_mes = [a.dynamic_account.id for a in db.query(MainAccount).filter(MainAccount.user_id == user.id).all() if a.dynamic_account]
            compras_mes = db.query(DynamicShopping).filter(
                DynamicShopping.dynamic_account_id.in_(_da_ids_mes),
                DynamicShopping.created_at >= datetime(now.year, now.month, 1),
            ).all() if _da_ids_mes else []
            tp = sum(p.value_paid for p in payments)
            ta = sum(e.amount for e in avulsos)
            tc = sum(c.value for c in compras_mes)
            all_items = [(p.account_name, p.value_paid) for p in payments] + [(e.description, e.amount) for e in avulsos] + [(c.description or "Compra crédito", c.value) for c in compras_mes]
            top = sorted(all_items, key=lambda x: x[1], reverse=True)[:3]
            return await generate_query_response("MES", {
                "total_mes": f"R$ {tp + ta + tc:.2f}",
                "total_contas_pagas": f"R$ {tp:.2f}",
                "total_gastos_avulsos": f"R$ {ta:.2f}",
                "total_compras_credito": f"R$ {tc:.2f}",
                "transacoes": len(all_items),
                "maiores_gastos": [f"{nome}: R$ {valor:.2f}" for nome, valor in top],
            }, user, db)

    # ── Conteúdo inapropriado ─────────────────────────────────────────────────
    elif intent == "INAPROPRIADO":
        logger.warning(f"[WhatsApp] Mensagem inapropriada: {intent_data}")
        return (
            "🚫 Esse tipo de mensagem não passa aqui.\n"
            "Sou um assistente financeiro — foco em contas, gastos e saldo."
        )

    # ── Fora do escopo ────────────────────────────────────────────────────────
    elif intent == "FORA_DO_ESCOPO":
        return (
            "Hm, isso tá fora da minha área. 😅\n"
            "Sou especialista em finanças pessoais — contas, gastos, saldo.\n"
            "Manda um `resumo do mês` se quiser ver como tá o dinheiro!"
        )

    # ── Correção de valor ─────────────────────────────────────────────────────
    elif intent == "CORRECAO":
        correcao = intent_data.get("correcao", {}) or {}
        category = correcao.get("category", "")
        new_amount = float(correcao.get("new_amount") or 0)

        if not category or new_amount <= 0:
            return "Não entendi qual lançamento corrigir. Tenta assim: `errei, o Mercado na verdade foi 224` 🙏"

        corrected = False
        old_amount = 0.0
        label = category

        _da_ids = [a.dynamic_account.id for a in db.query(MainAccount).filter(MainAccount.user_id == user.id).all() if a.dynamic_account]
        if _da_ids:
            shopping = (
                db.query(DynamicShopping)
                .filter(DynamicShopping.dynamic_account_id.in_(_da_ids), DynamicShopping.description.ilike(f"%{category}%"))
                .order_by(DynamicShopping.created_at.desc()).first()
            )
            if not shopping:
                for acc in db.query(MainAccount).filter(MainAccount.user_id == user.id, MainAccount.account_type == AccountType.DYNAMIC).all():
                    if category.lower() in acc.account_name.lower() or acc.account_name.lower() in category.lower():
                        shopping = db.query(DynamicShopping).filter(DynamicShopping.dynamic_account_id == acc.dynamic_account.id).order_by(DynamicShopping.created_at.desc()).first()
                        if shopping:
                            break
            if shopping:
                old_amount = shopping.value
                da = db.query(DynamicAccount).filter(DynamicAccount.id == shopping.dynamic_account_id).first()
                if da:
                    da.current_value = round(da.current_value - old_amount + new_amount, 2)
                shopping.value = new_amount
                db.commit()
                corrected = True
                label = shopping.description or category

        if not corrected:
            expense = db.query(Expense).filter(
                Expense.user_id == user.id,
                Expense.category.ilike(f"%{category}%") | Expense.description.ilike(f"%{category}%"),
            ).order_by(Expense.expense_date.desc()).first()
            if expense:
                old_amount = expense.amount
                expense.amount = new_amount
                db.commit()
                corrected = True
                label = expense.description or category

        if not corrected:
            payment_rec = db.query(Payment).filter(
                Payment.user_id == user.id, Payment.account_name.ilike(f"%{category}%"),
            ).order_by(Payment.payment_date.desc()).first()
            if payment_rec:
                old_amount = payment_rec.value_paid
                payment_rec.value_paid = new_amount
                db.commit()
                corrected = True
                label = payment_rec.account_name or category

        if corrected:
            return await generate_tuco_response(
                f"Corrigiu valor de {label}: R$ {old_amount:.2f} → R$ {new_amount:.2f}",
                {"item": label, "valor_antigo": old_amount, "valor_novo": new_amount},
                user, db
            )
        return f"Não encontrei nenhum lançamento recente de *{category}* pra corrigir. Confere o nome e tenta de novo 🔍"

    return UNKNOWN_MSG


async def process_whatsapp_message(phone: str, body: str, db: Session, provider: str = "twilio"):
    """Processa mensagem recebida e responde via WhatsApp."""
    import logging
    logger = logging.getLogger("whatsapp")

    log = WhatsAppMessage(phone_number=phone, direction="INBOUND", content=body)
    db.add(log)
    db.commit()
    db.refresh(log)

    try:
        user = get_user_by_phone(db, phone)
        if not user:
            log.intent = "USER_NOT_FOUND"
            db.commit()
            await send_whatsapp_message(
                phone,
                f"❌ Número não cadastrado.\n\nAcesse {settings.FRONTEND_URL} para criar sua conta e vincular seu WhatsApp nas configurações!",
                provider,
            )
            return

        log.user_id = user.id
        db.commit()

        _body = re.sub(r'[\s?!.,;:]+$', '', body.lower().strip())

        # ── HELP (sem chamar Claude) ──────────────────────────────────────────
        _greetings = [
            "help", "ajuda", "/ajuda", "oi", "olá", "ola", "inicio", "menu", "start",
            "e aí", "eai", "eaí", "oi tuco", "bom dia", "boa tarde", "boa noite",
            "tudo bem", "tudo bom", "salve", "fala tuco", "opa",
        ]
        if _body in _greetings or any(_body.startswith(g) for g in _greetings):
            log.intent = "HELP"
            log.processed = True
            db.commit()
            await send_whatsapp_message(phone, HELP_MSG, provider)
            return

        # ── OPEN APP (sem chamar Claude) ──────────────────────────────────────
        _app_triggers = [
            "abre o app", "abrir o app", "link do app", "link do aplicativo",
            "abre o aplicativo", "quero entrar no app", "acessa o app",
            "me manda o link", "link do sistema",
        ]
        if any(t in _body for t in _app_triggers):
            log.intent = "OPEN_APP"
            log.processed = True
            db.commit()
            await send_whatsapp_message(phone, f"Aqui está o link do app 👇\n{settings.FRONTEND_URL}", provider)
            return

        # ── Limite Free ───────────────────────────────────────────────────────
        _now = datetime.utcnow()
        if user.plan == SubscriptionPlan.FREE:
            if (user.tuco_interactions_reset_at is None or
                    (user.tuco_interactions_reset_at.year, user.tuco_interactions_reset_at.month) !=
                    (_now.year, _now.month)):
                user.tuco_monthly_interactions = 0
                user.tuco_interactions_reset_at = _now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                db.commit()
            if (user.tuco_monthly_interactions or 0) >= 5:
                log.intent = "LIMIT_REACHED"
                log.processed = True
                db.commit()
                await send_whatsapp_message(
                    phone,
                    f"🚫 Você usou suas 5 interações gratuitas do Tuco este mês.\n\n"
                    f"Assine o Pro por R$19,90/mês e use sem limite:\n{settings.FRONTEND_URL}/planos\n\n"
                    f"Seu limite reseta no início do próximo mês. 📅",
                    provider,
                )
                return

        # ── Claude interpreta TUDO (com histórico de conversa) ───────────────
        interpretation = await interpret_message(body, user, db)

        # ── Multi-intent: Claude pode retornar mais de uma ação ───────────────
        if "intents" in interpretation:
            intents_list = interpretation["intents"]
            responses = []
            log.intent = " + ".join(d.get("intent", "?") for d in intents_list)
            db.commit()
            for intent_data in intents_list:
                r = await _execute_single_intent(intent_data, user, db)
                if r:
                    responses.append(r)
            response_text = "\n\n—\n\n".join(responses) if responses else UNKNOWN_MSG
        else:
            log.intent = interpretation.get("intent", "DESCONHECIDO")
            db.commit()
            response_text = await _execute_single_intent(interpretation, user, db)

        # ── Incrementa contador Free ──────────────────────────────────────────
        if user.plan == SubscriptionPlan.FREE:
            user.tuco_monthly_interactions = (user.tuco_monthly_interactions or 0) + 1
            db.commit()

        log.processed = True
        db.commit()

        if response_text:
            await send_whatsapp_message(phone, response_text, provider)
            db.add(WhatsAppMessage(
                user_id=user.id, phone_number=phone, direction="OUTBOUND",
                content=response_text, processed=True,
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
        try:
            await send_whatsapp_message(phone, "Opa, deu um problema aqui. 🔧 Tenta de novo em instantes!", provider)
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
