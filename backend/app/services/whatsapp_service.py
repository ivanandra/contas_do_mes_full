"""
WhatsApp Service — suporta Twilio e Evolution API
"""
from typing import Optional
from app.config import settings


async def send_whatsapp_message(to_phone: str, message: str, provider: str = "twilio") -> bool:
    """Envia mensagem WhatsApp. Normaliza o número automaticamente."""
    phone = normalize_phone(to_phone)

    if provider == "twilio":
        return await _send_via_twilio(phone, message)
    elif provider == "evolution":
        return await _send_via_evolution(phone, message)
    return False


def normalize_phone(phone: str) -> str:
    """Normaliza número: remove whatsapp:, +, espaços, mantém só dígitos"""
    clean = phone.replace("whatsapp:", "").replace("+", "").replace(" ", "").strip()
    return clean


async def _send_via_twilio(to_phone: str, message: str) -> bool:
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            body=message,
            to=f"whatsapp:+{to_phone}"
        )
        return True
    except Exception as e:
        print(f"[Twilio Error] {e}")
        return False


async def _send_via_evolution(to_phone: str, message: str) -> bool:
    """Envio via Evolution API (self-hosted)"""
    try:
        import httpx
        # Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no .env
        api_url = settings.__dict__.get("EVOLUTION_API_URL", "")
        api_key = settings.__dict__.get("EVOLUTION_API_KEY", "")
        instance = settings.__dict__.get("EVOLUTION_INSTANCE", "default")
        if not api_url:
            return False
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{api_url}/message/sendText/{instance}",
                json={"number": to_phone, "textMessage": {"text": message}},
                headers={"apikey": api_key},
                timeout=10,
            )
        return True
    except Exception as e:
        print(f"[Evolution Error] {e}")
        return False


def parse_twilio_webhook(form_data: dict) -> dict:
    """Extrai dados relevantes do webhook Twilio"""
    return {
        "from": form_data.get("From", "").replace("whatsapp:", "").replace("+", ""),
        "body": form_data.get("Body", "").strip(),
        "provider": "twilio",
    }


def parse_evolution_webhook(body: dict) -> Optional[dict]:
    """Extrai dados relevantes do webhook Evolution API"""
    try:
        data = body.get("data", {})
        key = data.get("key", {})
        if key.get("fromMe"):
            return None
        remote_jid = key.get("remoteJid", "")
        phone = remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "")
        message = data.get("message", {})
        text = (
            message.get("conversation")
            or message.get("extendedTextMessage", {}).get("text")
            or ""
        )
        if not text:
            return None
        return {"from": phone, "body": text.strip(), "provider": "evolution"}
    except Exception:
        return None
