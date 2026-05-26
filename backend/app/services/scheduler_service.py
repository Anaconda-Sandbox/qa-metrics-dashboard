import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import SQUAD_CONFIG, ALL_QA_MEMBERS
from app.services import cache_service

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()
_refresh_in_progress = False
_initial_refresh_done = False

# Cache TTLs (in seconds)
JIRA_CACHE_TTL = 1800       # 30 minutes - Jira data updates less frequently
GITHUB_CACHE_TTL = 3600     # 1 hour - PR stats
REVIEW_CACHE_TTL = 7200     # 2 hours - Review stats (expensive to fetch)
REPORTPORTAL_CACHE_TTL = 1800  # 30 minutes
MEMBER_CACHE_TTL = 3600     # 1 hour


async def refresh_all_metrics():
    global _refresh_in_progress, _initial_refresh_done
    if _refresh_in_progress:
        logger.info("Refresh already in progress, skipping")
        return

    _refresh_in_progress = True
    start_time = datetime.now()
    logger.info("Starting background metrics refresh...")

    try:
        from app.services import github_service, jira_service, reportportal_service

        # Refresh global metrics (ALL squads first, then individual squads)
        squads = [None] + list(SQUAD_CONFIG.keys())

        for squad in squads:
            squad_label = squad or "ALL"
            logger.info(f"Refreshing metrics for squad: {squad_label}")

            try:
                # Jira metrics
                density = await jira_service.get_defect_density(squad=squad, use_cache=False)
                cache_service.cache_set(f"defect_density:{squad}", density.model_dump(), ttl=JIRA_CACHE_TTL)

                coverage = await jira_service.get_automation_coverage(squad=squad, use_cache=False)
                cache_service.cache_set(f"automation_coverage:{squad}", coverage.model_dump(), ttl=JIRA_CACHE_TTL)

                bugs = await jira_service.get_bugs_list(squad=squad, use_cache=False)
                cache_service.cache_set(f"bugs_list:{squad}", bugs.model_dump(), ttl=JIRA_CACHE_TTL)

            except Exception as e:
                logger.error(f"Error refreshing Jira metrics for {squad_label}: {e}")

            try:
                # GitHub metrics (with delays to avoid rate limiting)
                pr_stats = await github_service.get_pr_stats(squad=squad, use_cache=False)
                cache_service.cache_set(f"pr_stats:{squad}", pr_stats.model_dump(), ttl=GITHUB_CACHE_TTL)
                await asyncio.sleep(2)  # Rate limit protection

                pr_trends = await github_service.get_pr_trends(squad=squad, use_cache=False)
                cache_service.cache_set(f"pr_trends:{squad}", pr_trends.model_dump(), ttl=GITHUB_CACHE_TTL)
                await asyncio.sleep(2)

                contributions = await github_service.get_team_contributions(squad=squad, use_cache=False)
                cache_service.cache_set(f"team_contributions:{squad}", contributions.model_dump(), ttl=GITHUB_CACHE_TTL)
                await asyncio.sleep(2)

            except Exception as e:
                logger.error(f"Error refreshing GitHub metrics for {squad_label}: {e}")

            # Delay between squads
            await asyncio.sleep(3)

        # Review stats - only fetch for ALL (None) since it's expensive
        # Individual squad review stats will be calculated on-demand
        logger.info("Refreshing team review stats (ALL squads)...")
        try:
            review_stats = await github_service.get_team_review_stats(squad=None, use_cache=False)
            cache_service.cache_set("team_review_stats:None", review_stats.model_dump(), ttl=REVIEW_CACHE_TTL)
        except Exception as e:
            logger.error(f"Error refreshing team review stats: {e}")

        # ReportPortal metrics (not squad-specific)
        try:
            rp_stats = await reportportal_service.get_stats(use_cache=False)
            cache_service.cache_set("reportportal_stats", rp_stats.model_dump(), ttl=REPORTPORTAL_CACHE_TTL)

            flaky_tests = await reportportal_service.get_flaky_tests(use_cache=False)
            cache_service.cache_set("flaky_tests", flaky_tests.model_dump(), ttl=REPORTPORTAL_CACHE_TTL)

            launches = await reportportal_service.get_launches(use_cache=False)
            cache_service.cache_set("launches", launches.model_dump(), ttl=REPORTPORTAL_CACHE_TTL)

        except Exception as e:
            logger.error(f"Error refreshing ReportPortal metrics: {e}")

        # Refresh individual member activity (for Individual View)
        logger.info("Refreshing individual member activity...")
        from app.services import member_service
        for member in ALL_QA_MEMBERS:
            try:
                activity = await member_service.get_member_activity(member, days=30, use_cache=False)
                cache_service.cache_set(f"member_activity:{member}:30", activity.model_dump(), ttl=MEMBER_CACHE_TTL)
                await asyncio.sleep(3)  # Longer delay to avoid rate limiting
            except Exception as e:
                logger.error(f"Error refreshing activity for {member}: {e}")

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"Background refresh completed in {elapsed:.1f}s")

        # Store last refresh timestamp
        cache_service.cache_set("last_refresh", {"timestamp": datetime.now().isoformat()}, ttl=86400)
        _initial_refresh_done = True

    except Exception as e:
        logger.error(f"Background refresh failed: {e}")
    finally:
        _refresh_in_progress = False


async def take_daily_db_snapshot():
    """Take a daily snapshot of metrics to the database."""
    from app.services.snapshot_service import take_daily_snapshot
    now = datetime.now()
    quarter = f"{now.year}-Q{(now.month - 1) // 3 + 1}"
    logger.info(f"Taking daily database snapshot for {quarter}")
    await take_daily_snapshot(quarter)


async def refresh_bug_metrics_snapshot():
    """Hourly: refresh QA bug metrics in MetricSnapshot for the current quarter, every project.

    The leadership dashboard reads bug counts and resolution rate from
    MetricSnapshot. Keeping this fresh (~hourly) means the dashboard read
    path is a Postgres lookup, not a Jira API call per request.
    """
    from app.services.snapshot_service import snapshot_qa_bug_metrics_for_quarter, snapshot_defect_density_for_quarter
    now = datetime.now()
    quarter = f"{now.year}-Q{(now.month - 1) // 3 + 1}"
    logger.info(f"Refreshing bug-metrics snapshot for {quarter}")
    await snapshot_qa_bug_metrics_for_quarter(quarter)
    logger.info(f"Refreshing defect-density-by-project snapshot for {quarter}")
    await snapshot_defect_density_for_quarter(quarter)
    logger.info("Refreshing QA roster snapshot from Jira group")
    from app.services.snapshot_service import snapshot_qa_roster
    await snapshot_qa_roster()


async def refresh_automation_metrics_snapshot():
    """Hourly: refresh ReportPortal automation metrics for the current quarter.

    Aggregates pass rate / avg duration / flaky % across all RP projects.
    RP API is slow (paged + per-launch /item lookups for flakiness), so this
    must run in the background; the dashboard reads from MetricSnapshot.
    """
    from app.services.snapshot_service import snapshot_automation_metrics_for_quarter
    now = datetime.now()
    quarter = f"{now.year}-Q{(now.month - 1) // 3 + 1}"
    logger.info(f"Refreshing RP automation-metrics snapshot for {quarter}")
    await snapshot_automation_metrics_for_quarter(quarter)


def start_scheduler():
    if not scheduler.running:
        # Run initial refresh after 30 seconds (let services initialize)
        from apscheduler.triggers.date import DateTrigger
        from apscheduler.triggers.cron import CronTrigger
        from datetime import timedelta

        scheduler.add_job(
            refresh_all_metrics,
            trigger=DateTrigger(run_date=datetime.now() + timedelta(seconds=30)),
            id="initial_refresh",
            max_instances=1,
            replace_existing=True,
        )

        # Schedule regular refresh every 30 minutes
        scheduler.add_job(
            refresh_all_metrics,
            trigger=IntervalTrigger(minutes=30),
            id="periodic_refresh",
            max_instances=1,
            replace_existing=True,
        )

        # Schedule daily database snapshot at 6 AM
        scheduler.add_job(
            take_daily_db_snapshot,
            trigger=CronTrigger(hour=6, minute=0),
            id="daily_snapshot",
            max_instances=1,
            replace_existing=True,
        )

        # Bug-metrics snapshot: warm the cache 60s after startup, then every hour.
        # The leadership dashboard reads from MetricSnapshot (no per-request Jira call).
        scheduler.add_job(
            refresh_bug_metrics_snapshot,
            trigger=DateTrigger(run_date=datetime.now() + timedelta(seconds=60)),
            id="initial_bug_metrics_snapshot",
            max_instances=1,
            replace_existing=True,
        )
        scheduler.add_job(
            refresh_bug_metrics_snapshot,
            trigger=IntervalTrigger(hours=1),
            id="hourly_bug_metrics_snapshot",
            max_instances=1,
            replace_existing=True,
        )

        # ReportPortal automation-metrics snapshot: warm 90s after startup,
        # then hourly. Slower than the bug snapshot — paginates RP launches
        # across 12 projects and walks /test-item for flaky detection.
        scheduler.add_job(
            refresh_automation_metrics_snapshot,
            trigger=DateTrigger(run_date=datetime.now() + timedelta(seconds=90)),
            id="initial_automation_metrics_snapshot",
            max_instances=1,
            replace_existing=True,
        )
        scheduler.add_job(
            refresh_automation_metrics_snapshot,
            trigger=IntervalTrigger(hours=1),
            id="hourly_automation_metrics_snapshot",
            max_instances=1,
            replace_existing=True,
        )

        scheduler.start()
        logger.info("Background scheduler started (refresh every 30 min, bug-metrics snapshot hourly, daily DB snapshot at 6 AM)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Background scheduler stopped")


def get_scheduler_status() -> dict:
    jobs = []
    if scheduler.running:
        for job in scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            })

    last_refresh = cache_service.cache_get("last_refresh")

    return {
        "running": scheduler.running,
        "jobs": jobs,
        "last_refresh": last_refresh.get("timestamp") if last_refresh else None,
        "refresh_in_progress": _refresh_in_progress,
        "initial_refresh_done": _initial_refresh_done,
    }


def is_cache_ready() -> bool:
    """Check if initial cache has been populated"""
    return _initial_refresh_done or cache_service.cache_get("last_refresh") is not None
