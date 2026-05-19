"""
Tuco Service — integração com Claude para respostas com personalidade
e interpretação de mensagens do WhatsApp.
"""
import json
import re
import anthropic
from sqlalchemy.orm import Session
from app.config import settings
from app.models.models import User, TucoSettings, MainAccount, AccountType


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_client():
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def _get_tuco_settings(db: Session, user_id: str) -> TucoSettings:
    s = db.query(TucoSettings).filter(TucoSettings.user_id == user_id).first()
    if not s:
        s = TucoSettings(user_id=user_id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


TONE_DESCRIPTIONS = {
    "AMOROSO": "carinhoso, afetuoso e encorajador. Trata o usuário com muito carinho e comemotra cada conquista.",
    "NEUTRO": "amigável, direto e levemente bem-humorado. Equilibrado entre seriedade e humor.",
    "AGRESSIVO": "sarcástico, sem papas na língua e direto ao ponto. Fala a verdade sem rodeios.",
}

ZOEIRA_DESCRIPTIONS = {
    1: "Faça um comentário gentil e suave, sem exageros.",
    2: "Adicione uma observação engraçada ou leve piada contextual.",
    3: "Seja bem zoeiro e sarcástico! Como um amigo muito sem-filtro.",
}

CATEGORY_ZOEIRA = {
    "cerveja": ["Tá bebendo demais não? 🍺", "O fígado agradece... não. 🍻", "Cervejeiro raiz!"],
    "bar": ["Mais um happy hour né? 🥃", "Bar te ama mais que você imagina. 💸"],
    "delivery": ["Rei/Rainha do iFood! 📱", "O motoboy já sabe seu endereço de cor. 🛵"],
    "ifood": ["Cozinhar é para os fortes né? 😂", "O app de delivery fica feliz toda vez que você abre. 📱"],
    "farmácia": ["Tá fraco? 💊", "Saúde em dia... ou remédio de ressaca? 🤔"],
    "academia": ["Academia E delivery? Filosofia única! 💪🍕", "O personal vai ficar orgulhoso... talvez. 🏋️"],
    "roupa": ["Mais roupa? O guarda-roupa pediu socorro! 👗", "Armário cheio, carteira vazia. 😅"],
    "supermercado": ["Mercado todo mês mesmo, né? 🛒", "Básico da vida!"],
    "gasolina": ["O carro agradece! ⛽", "Tá rodando muito ou em círculos? 🚗"],
    "luz": ["Deixou a luz acesa de novo? 💡", "Energia elétrica: o básico civilizado. ⚡"],
    "aluguel": ["O senhorio mais feliz do Brasil! 🏠", "Casa é vida!"],
    "internet": ["Internet: necessidade básica moderna. 📡", "Sem internet não dá né? 🌐"],
}


# ─── Interpret WhatsApp message with Claude ──────────────────────────────────

async def interpret_message(message: str, user: User, db: Session) -> dict:
    accounts = db.query(MainAccount).filter(MainAccount.user_id == user.id).all()
    accounts_list = "\n".join([
        f"- {a.account_name} ({a.account_type.value})"
        for a in accounts
    ])

    prompt = f"""Você é um assistente financeiro. Analise esta mensagem e extraia a intenção.

Mensagem do usuário: "{message}"

Contas cadastradas do usuário:
{accounts_list if accounts_list else "Nenhuma conta cadastrada ainda."}

Identifique:
1. NOVO_GASTO: usuário registrou um gasto avulso (ex: "Mercado: 150", "gastei 85 no uber", "cerveja 30")
2. PAGAMENTO: usuário quer pagar/registrar pagamento de uma conta existente (ex: "pagar aluguel", "registrar pagamento aluguel - PIX", "paguei a luz no débito")
3. CONSULTA: usuário quer saber algo (ex: "quanto gastei hoje?", "qual meu saldo?", "resumo do mês")
4. DESCONHECIDO: não conseguiu identificar

Responda APENAS com JSON válido (sem markdown, sem explicações):
{{
  "intent": "NOVO_GASTO" | "PAGAMENTO" | "CONSULTA" | "DESCONHECIDO",
  "expense": {{
    "category": "nome da categoria/conta",
    "amount": 0.00,
    "description": "descrição opcional"
  }},
  "payment": {{
    "account_name": "nome da conta a pagar (use o nome exato da lista acima)",
    "payment_method": "PIX" | "Boleto" | "Débito" | "Crédito" | "Dinheiro" | null
  }},
  "query": {{
    "type": "HOJE" | "SEMANA" | "MES" | "CATEGORIA" | "SALDO" | "LISTA",
    "category": null
  }}
}}"""

    try:
        client = _get_client()
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text.strip()
        # Extrai JSON caso venha com markdown
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(text)
    except Exception as e:
        import logging
        logging.getLogger("tuco").error(f"[interpret_message] erro: {e}", exc_info=True)
        return {"intent": "DESCONHECIDO", "expense": None, "query": None}


# ─── Generate Tuco personality response ──────────────────────────────────────

async def generate_tuco_response(
    action: str,
    result_data: dict,
    user: User,
    db: Session,
    error: bool = False
) -> str:
    tuco_cfg = _get_tuco_settings(db, user.id)
    tone_desc = TONE_DESCRIPTIONS.get(tuco_cfg.tone.value, TONE_DESCRIPTIONS["NEUTRO"])
    zoeira_desc = ZOEIRA_DESCRIPTIONS.get(tuco_cfg.zoeira_level, ZOEIRA_DESCRIPTIONS[2])
    name = tuco_cfg.tuco_name

    prompt = f"""Você é {name}, um assistente financeiro pessoal.
Personalidade: {tone_desc}
Nível de zoeira: {tuco_cfg.zoeira_level}/3 — {zoeira_desc}

Ação realizada: {action}
Dados: {json.dumps(result_data, ensure_ascii=False)}
Erro: {"Sim" if error else "Não"}

Regras:
- Resposta CURTA (máximo 4 linhas)
- Português brasileiro informal
- Use emojis de forma adequada ao tom
- Se for gasto de lazer/bar/delivery, faça comentário contextual zoeiro
- Não mencione "Claude", "IA" ou "assistente"
- Se for erro, seja empático mas direto

Responda apenas com o texto da mensagem, sem aspas:"""

    try:
        client = _get_client()
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()
    except Exception as e:
        import logging
        logging.getLogger("tuco").error(f"[generate_tuco_response] erro: {e}", exc_info=True)
        return "Opa, registrado! 💰 Tô de olho nas suas finanças! 😎"


# ─── Generate query response ─────────────────────────────────────────────────

async def generate_query_response(query_type: str, data: dict, user: User, db: Session) -> str:
    tuco_cfg = _get_tuco_settings(db, user.id)
    tone_desc = TONE_DESCRIPTIONS.get(tuco_cfg.tone.value, TONE_DESCRIPTIONS["NEUTRO"])
    name = tuco_cfg.tuco_name

    prompt = f"""Você é {name}, assistente financeiro pessoal.
Personalidade: {tone_desc}
Nível de zoeira: {tuco_cfg.zoeira_level}/3

O usuário perguntou sobre suas finanças.
Tipo de consulta: {query_type}
Dados encontrados: {json.dumps(data, ensure_ascii=False, default=str)}

Gere uma resposta informativa e na sua personalidade.
Use tabela simples quando tiver múltiplos dados.
Máximo 8 linhas. Português brasileiro. Use emojis:"""

    try:
        client = _get_client()
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()
    except Exception as e:
        import logging
        logging.getLogger("tuco").error(f"[generate_query_response] erro: {e}", exc_info=True)
        return "Deixa eu procurar aqui... 🔍\n" + "\n".join([f"{k}: {v}" for k, v in data.items()])
