"""
Envio de email via Resend.
Se RESEND_API_KEY não estiver configurado, loga warning e segue sem quebrar.
"""
import logging
from app.config import settings

logger = logging.getLogger("email")


def _build_report_html(data: dict, zoeira_line: str) -> str:
    """Monta o HTML do relatório com tema dark alinhado ao app."""
    top_items_html = "".join([
        f"""
        <tr>
            <td style="padding:10px 14px;color:#fff;font-weight:500;">{item['name']}</td>
            <td style="padding:10px 14px;color:#9CA3AF;font-size:12px;">{item['type']}</td>
            <td style="padding:10px 14px;text-align:right;color:#7EC243;font-weight:700;font-family:monospace;">{item['value_str']}</td>
        </tr>
        """
        for item in data["top_items"]
    ]) or '<tr><td colspan="3" style="padding:14px;color:#6B7280;text-align:center;">Nenhum gasto no período. 🎉</td></tr>'

    pendentes_html = "".join([
        f"""
        <tr>
            <td style="padding:8px 14px;color:#fff;">
                {p['name']}
                {' <span style="color:#ef4444;font-size:11px;font-weight:700;">EM ATRASO</span>' if p['is_late'] else ''}
            </td>
            <td style="padding:8px 14px;text-align:right;color:#fff;font-weight:600;font-family:monospace;">{p['value_str']}</td>
        </tr>
        """
        for p in data["pendentes"]
    ]) or '<tr><td colspan="2" style="padding:14px;color:#6B7280;text-align:center;">Tudo em dia! 🎯</td></tr>'

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório do Tuco — {data['period_label']}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0a0a0a;padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#141414;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">

                    <!-- Header -->
                    <tr>
                        <td style="padding:32px 32px 24px;border-bottom:1px solid #2a2a2a;">
                            <div style="display:inline-block;background:#7EC243;color:#000;font-weight:900;font-size:24px;width:48px;height:48px;line-height:48px;text-align:center;border-radius:12px;">T</div>
                            <p style="margin:16px 0 4px;color:#9CA3AF;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Relatório {data['period_label']} do Tuco</p>
                            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Fala, {data['user_name']}! 👋</h1>
                            <p style="margin:6px 0 0;color:#9CA3AF;font-size:14px;">{data['period_desc']}</p>
                        </td>
                    </tr>

                    <!-- Total destaque -->
                    <tr>
                        <td style="padding:32px;text-align:center;">
                            <p style="margin:0 0 8px;color:#9CA3AF;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Total gasto no período</p>
                            <p style="margin:0;color:#7EC243;font-size:42px;font-weight:900;font-family:monospace;">{data['total_str']}</p>
                            <p style="margin:8px 0 0;color:#6B7280;font-size:13px;">{data['transactions']} transações</p>
                        </td>
                    </tr>

                    <!-- Breakdown -->
                    <tr>
                        <td style="padding:0 32px 24px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="padding:14px;background:#1c1c1c;border-radius:10px;text-align:center;width:33%;">
                                        <p style="margin:0;color:#9CA3AF;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Contas pagas</p>
                                        <p style="margin:6px 0 0;color:#fff;font-size:15px;font-weight:700;font-family:monospace;">{data['total_payments_str']}</p>
                                    </td>
                                    <td style="width:8px;"></td>
                                    <td style="padding:14px;background:#1c1c1c;border-radius:10px;text-align:center;width:33%;">
                                        <p style="margin:0;color:#9CA3AF;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Avulsos</p>
                                        <p style="margin:6px 0 0;color:#fff;font-size:15px;font-weight:700;font-family:monospace;">{data['total_expenses_str']}</p>
                                    </td>
                                    <td style="width:8px;"></td>
                                    <td style="padding:14px;background:#1c1c1c;border-radius:10px;text-align:center;width:33%;">
                                        <p style="margin:0;color:#9CA3AF;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Crédito</p>
                                        <p style="margin:6px 0 0;color:#fff;font-size:15px;font-weight:700;font-family:monospace;">{data['total_shoppings_str']}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Top gastos -->
                    <tr>
                        <td style="padding:0 32px 24px;">
                            <h2 style="margin:0 0 14px;color:#fff;font-size:16px;font-weight:700;">🔥 Maiores gastos</h2>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1c1c1c;border-radius:10px;overflow:hidden;">
                                {top_items_html}
                            </table>
                        </td>
                    </tr>

                    <!-- Pendentes -->
                    <tr>
                        <td style="padding:0 32px 24px;">
                            <h2 style="margin:0 0 14px;color:#fff;font-size:16px;font-weight:700;">📌 Contas pendentes ({data['pendentes_count']})</h2>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1c1c1c;border-radius:10px;overflow:hidden;">
                                {pendentes_html}
                            </table>
                        </td>
                    </tr>

                    <!-- Zoeira do Tuco -->
                    <tr>
                        <td style="padding:0 32px 24px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#7EC243;border-radius:12px;">
                                <tr>
                                    <td style="padding:18px 20px;color:#000;font-weight:600;font-size:14px;line-height:1.5;">
                                        💬 {zoeira_line}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA -->
                    <tr>
                        <td style="padding:0 32px 32px;text-align:center;">
                            <a href="{settings.FRONTEND_URL}/dashboard" style="display:inline-block;background:#7EC243;color:#000;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:14px;">
                                Ver detalhes no app →
                            </a>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:20px 32px;border-top:1px solid #2a2a2a;text-align:center;">
                            <p style="margin:0;color:#6B7280;font-size:12px;">
                                Você está recebendo este email porque ativou os relatórios do Tuco.<br>
                                <a href="{settings.FRONTEND_URL}/tuco" style="color:#7EC243;text-decoration:none;">Alterar preferências</a>
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""


async def send_report_email(to_email: str, subject: str, data: dict, zoeira_line: str) -> bool:
    """
    Envia email de relatório via Resend.
    Retorna True se enviou, False se RESEND_API_KEY não está configurado ou ocorreu erro.
    """
    if not settings.RESEND_API_KEY:
        logger.warning(f"[email] RESEND_API_KEY não configurado — email para {to_email} ignorado")
        return False

    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY

        html = _build_report_html(data, zoeira_line)

        params = {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        result = resend.Emails.send(params)
        logger.info(f"[email] Enviado para {to_email}: id={result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"[email] Erro ao enviar para {to_email}: {e}", exc_info=True)
        return False
