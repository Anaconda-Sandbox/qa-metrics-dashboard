import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import SQUAD_CONFIG, PROJECT_CONFIG, ALL_JIRA_PROJECTS, ALL_QA_MEMBERS, get_settings
from app.models.metrics import DashboardConfigResponse, SquadInfo, ProjectInfo
from app.routers import github, jira, members, reportportal
from app.services import github_service, jira_service, reportportal_service, cache_service
from app.services.scheduler_service import start_scheduler, stop_scheduler, get_scheduler_status

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting QA Metrics Dashboard API...")
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
    redis_ok = cache_service.is_redis_available()
    return {
        "status": "ok",
        "version": "2.1.0",
        "redis": "connected" if redis_ok else "unavailable",
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
