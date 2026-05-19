import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import SQUAD_CONFIG, PROJECT_CONFIG, ALL_JIRA_PROJECTS, ALL_QA_MEMBERS, get_settings
from app.models.metrics import DashboardConfigResponse, SquadInfo, ProjectInfo
from app.routers import github, jira, members, reportportal
from app.services import github_service, jira_service, reportportal_service, cache_service
from app.services.scheduler_service import start_scheduler, stop_scheduler, get_scheduler_status
from app.database import init_db, get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting QA Metrics Dashboard API...")

    # Initialize database
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

    if cache_service.is_redis_available():
        logger.info("Redis connected successfully")
        start_scheduler()
    else:
        logger.warning("Redis not available - running without background refresh")
    yield
    # Shutdown
    stop_scheduler()
    logger.info("Shutting down QA Metrics Dashboard API")


app = FastAPI(title="QA Metrics Dashboard API", version="2.1.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jira.router)
app.include_router(reportportal.router)
app.include_router(github.router)
app.include_router(members.router)


@app.get("/health")
async def health():
    from sqlalchemy import text
    redis_ok = cache_service.is_redis_available()
    db_ok = False
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db_ok = True
        db.close()
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
    return {
        "status": "ok",
        "version": "2.2.0",
        "redis": "connected" if redis_ok else "unavailable",
        "database": "connected" if db_ok else "unavailable",
    }


@app.get("/api/status")
async def status():
    scheduler = get_scheduler_status()
    return {
        "redis": cache_service.is_redis_available(),
        "scheduler": scheduler,
        "cache_keys": len(cache_service.cache_keys("*")),
    }


@app.get("/api/config", response_model=DashboardConfigResponse)
async def get_config():
    squads = [
        SquadInfo(
            key=key,
            name=cfg["name"],
            jira_projects=cfg["jira_projects"],
            repos=cfg["repos"],
            members=cfg["members"],
        )
        for key, cfg in SQUAD_CONFIG.items()
    ]
    projects = [
        ProjectInfo(
            key=key,
            name=cfg["name"],
            repos=cfg["repos"],
        )
        for key, cfg in PROJECT_CONFIG.items()
    ]
    return DashboardConfigResponse(squads=squads, projects=projects, all_jira_projects=ALL_JIRA_PROJECTS, all_members=ALL_QA_MEMBERS)


@app.get("/api/metrics/all")
async def metrics_all(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
):
    errors: dict[str, str] = {}
    jira_data = None
    rp_data = None
    gh_data = None

    async def fetch_jira():
        nonlocal jira_data
        try:
            density = await jira_service.get_defect_density(squad=squad, project=project)
            coverage = await jira_service.get_automation_coverage(squad=squad, project=project)
            jira_data = {
                "defect_density": density.model_dump(),
                "automation_coverage": coverage.model_dump(),
            }
        except Exception as e:
            errors["jira"] = str(e)

    async def fetch_reportportal():
        nonlocal rp_data
        try:
            stats = await reportportal_service.get_stats()
            rp_data = {"stats": stats.model_dump()}
        except Exception as e:
            errors["reportportal"] = str(e)

    async def fetch_github():
        nonlocal gh_data
        try:
            pr_stats = await github_service.get_pr_stats(squad=squad, project=project)
            contributions = await github_service.get_team_contributions(squad=squad, project=project)
            gh_data = {
                "pr_stats": pr_stats.model_dump(),
                "team_contributions": contributions.model_dump(),
            }
        except Exception as e:
            errors["github"] = str(e)

    await asyncio.gather(fetch_jira(), fetch_reportportal(), fetch_github())

    return {
        "jira": jira_data,
        "reportportal": rp_data,
        "github": gh_data,
        "errors": errors,
    }


@app.post("/api/refresh")
async def trigger_refresh():
    from app.services.scheduler_service import refresh_all_metrics
    asyncio.create_task(refresh_all_metrics())
    return {"status": "refresh triggered"}


@app.post("/api/snapshot")
async def trigger_snapshot(quarter: str = Query(default=None)):
    """Manually trigger a metrics snapshot."""
    from app.services.snapshot_service import take_daily_snapshot
    from app.services.jira_service import _get_quarter_date_range

    if not quarter:
        from datetime import datetime
        now = datetime.now()
        quarter = f"{now.year}-Q{(now.month - 1) // 3 + 1}"

    asyncio.create_task(take_daily_snapshot(quarter))
    return {"status": "snapshot triggered", "quarter": quarter}


@app.get("/api/history/metric")
async def get_metric_history(
    metric_type: str = Query(...),
    project: str | None = Query(default=None),
    quarter: str | None = Query(default=None),
    days: int = Query(default=30),
    db: Session = Depends(get_db)
):
    """Get historical values for a metric."""
    from app.services.snapshot_service import get_metric_history as fetch_history
    from app.database import MetricSnapshot

    query = db.query(MetricSnapshot).filter(MetricSnapshot.metric_type == metric_type)
    if project:
        query = query.filter(MetricSnapshot.project == project)
    if quarter:
        query = query.filter(MetricSnapshot.quarter == quarter)

    results = query.order_by(MetricSnapshot.snapshot_date.desc()).limit(days).all()
    return [
        {
            "date": r.snapshot_date.isoformat(),
            "value": r.value,
            "extra_data": r.extra_data,
            "quarter": r.quarter
        }
        for r in results
    ]


@app.get("/api/history/compare")
async def compare_quarters(
    metric_type: str = Query(...),
    quarter1: str = Query(...),
    quarter2: str = Query(...),
    project: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    """Compare a metric between two quarters using stored snapshots."""
    from app.services.snapshot_service import get_quarter_comparison
    return get_quarter_comparison(db, project, metric_type, quarter1, quarter2)


@app.get("/api/history/trends")
async def get_weekly_trends_history(
    metric_type: str = Query(...),
    project: str | None = Query(default=None),
    weeks: int = Query(default=12),
    db: Session = Depends(get_db)
):
    """Get weekly trend data from database."""
    from app.database import WeeklyTrend

    query = db.query(WeeklyTrend).filter(WeeklyTrend.metric_type == metric_type)
    if project:
        query = query.filter(WeeklyTrend.project == project)
    else:
        query = query.filter(WeeklyTrend.project.is_(None))

    results = query.order_by(WeeklyTrend.week.desc()).limit(weeks).all()
    return [{"week": r.week, "value": r.value} for r in reversed(results)]
