from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.services.news_collector import KST, collect_policy_news_for_date

_scheduler: BackgroundScheduler | None = None


def previous_kst_date(now: datetime | None = None):
    current = now.astimezone(KST) if now else datetime.now(KST)
    return (current - timedelta(days=1)).date()


def collect_yesterday_policy_news() -> None:
    collect_policy_news_for_date(previous_kst_date(), trigger_type="scheduled")


def start_news_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = BackgroundScheduler(timezone=KST)
    _scheduler.add_job(
        collect_yesterday_policy_news,
        CronTrigger(hour=9, minute=0, timezone=KST),
        id="daily_policy_news_collect",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()


def shutdown_news_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
