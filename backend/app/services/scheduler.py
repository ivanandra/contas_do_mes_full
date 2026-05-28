"""
Scheduler para envio de relatórios por email.
- WEEKLY: toda segunda-feira às 9h (horário Brasília)
- MONTHLY: todo dia 1 às 9h (horário Brasília)
"""
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

from app.database import SessionLocal
from app.models.models import TucoSettings, User, EmailReportFrequency
from app.services.report_generator import generate_report_data
from app.services.email_service import send_report_email
from app.services.tuco_service import generate_report_zoeira

logger = logging.getLogger("scheduler")
BRT = pytz.timezone("America/Sao_Paulo")

scheduler: AsyncIOScheduler | None = None


async def _send_reports_for_period(period: str):
    """Envia relatórios para todos os usuários configurados para o período."""
    logger.info(f"[scheduler] Iniciando envio de relatórios {period}")
    db = SessionLocal()
    try:
        target_freq = EmailReportFrequency.WEEKLY if period == "WEEKLY" else EmailReportFrequency.MONTHLY
        settings_list = db.query(TucoSettings).filter(
            TucoSettings.email_report_frequency == target_freq
        ).all()

        sent = 0
        for s in settings_list:
            user = db.query(User).filter(User.id == s.user_id).first()
            if not user or not user.email:
                continue

            try:
                data = generate_report_data(user, db, period)

                # Se não houve nenhuma atividade, ainda envia (mas com mensagem leve)
                zoeira = await generate_report_zoeira(data, user, db)

                subject_period = "semanal" if period == "WEEKLY" else "mensal"
                subject = f"📊 Seu relatório {subject_period} do Tuco — {data['total_str']}"

                ok = await send_report_email(user.email, subject, data, zoeira)
                if ok:
                    s.email_report_last_sent_at = datetime.utcnow()
                    db.commit()
                    sent += 1
            except Exception as e:
                logger.error(f"[scheduler] Erro no envio para user {user.id}: {e}", exc_info=True)

        logger.info(f"[scheduler] Envio {period} concluído: {sent}/{len(settings_list)}")
    finally:
        db.close()


async def send_weekly_reports():
    await _send_reports_for_period("WEEKLY")


async def send_monthly_reports():
    await _send_reports_for_period("MONTHLY")


def start_scheduler():
    """Inicia o scheduler no startup do FastAPI."""
    global scheduler
    if scheduler is not None:
        return scheduler

    scheduler = AsyncIOScheduler(timezone=BRT)

    # Toda segunda às 9h Brasília
    scheduler.add_job(
        send_weekly_reports,
        CronTrigger(day_of_week="mon", hour=9, minute=0, timezone=BRT),
        id="weekly_reports",
        replace_existing=True,
    )

    # Todo dia 1 às 9h Brasília
    scheduler.add_job(
        send_monthly_reports,
        CronTrigger(day=1, hour=9, minute=0, timezone=BRT),
        id="monthly_reports",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("[scheduler] Scheduler iniciado — WEEKLY=segunda 9h, MONTHLY=dia 1 9h (BRT)")
    return scheduler


def stop_scheduler():
    """Para o scheduler no shutdown do FastAPI."""
    global scheduler
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        scheduler = None
        logger.info("[scheduler] Scheduler parado")
