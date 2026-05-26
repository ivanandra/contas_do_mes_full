"""
Billing — Stripe checkout, portal e webhook.
"""
import stripe
from fastapi import APIRouter, Depends, Request, HTTPException, Header
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User, SubscriptionPlan
from app.schemas.schemas import CheckoutCreate, CheckoutResponse, BillingStatus

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["billing"])

_PRICE_IDS = {
    "PRO": settings.STRIPE_PRO_MONTHLY_PRICE_ID,
    "PRO_ANUAL": settings.STRIPE_PRO_ANNUAL_PRICE_ID,
}


@router.get("/status", response_model=BillingStatus)
def billing_status(user: User = Depends(get_current_user)):
    return user


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    data: CheckoutCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Pagamentos não configurados ainda. Em breve!")

    price_id = _PRICE_IDS.get(data.plan)
    if not price_id:
        raise HTTPException(400, "Plano inválido")

    customer_id = user.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": user.id},
        )
        customer_id = customer.id
        user.stripe_customer_id = customer_id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/planos?success=true",
        cancel_url=f"{settings.FRONTEND_URL}/planos",
        metadata={"user_id": user.id, "plan": data.plan},
        locale="pt-BR",
    )
    return {"url": session.url}


@router.get("/portal", response_model=CheckoutResponse)
def customer_portal(user: User = Depends(get_current_user)):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Pagamentos não configurados ainda. Em breve!")
    if not user.stripe_customer_id:
        raise HTTPException(400, "Sem assinatura ativa para gerenciar")

    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/planos",
    )
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook não configurado")

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Assinatura inválida")

    event_type = event["type"]
    data_obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = data_obj.get("metadata", {}).get("user_id")
        plan_str = data_obj.get("metadata", {}).get("plan")
        if user_id and plan_str:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.plan = SubscriptionPlan(plan_str)
                user.stripe_subscription_id = data_obj.get("subscription")
                user.tuco_monthly_interactions = 0
                db.commit()

    elif event_type in ("customer.subscription.deleted", "customer.subscription.paused"):
        customer_id = data_obj.get("customer")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.plan = SubscriptionPlan.FREE
            user.stripe_subscription_id = None
            user.plan_expires_at = None
            db.commit()

    return {"status": "ok"}
