import logging

from fastapi import APIRouter, Query

from app.models.metrics import (
    PRStats,
    PRTrendsResponse,
    RecentPRsResponse,
    TeamContributionResponse,
    TeamReviewStatsResponse,
)
from app.services import github_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/github", tags=["github"])


@router.get("/pr-trends", response_model=PRTrendsResponse)
async def pr_trends(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
):
    try:
        return await github_service.get_pr_trends(squad=squad, project=project)
    except Exception as e:
        logger.error(f"Error fetching PR trends: {e}")
        return {"error": str(e), "data": None}


@router.get("/pr-stats", response_model=PRStats)
async def pr_stats(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
):
    try:
        return await github_service.get_pr_stats(squad=squad, project=project)
    except Exception as e:
        logger.error(f"Error fetching PR stats: {e}")
        return {"error": str(e), "data": None}


@router.get("/recent-prs", response_model=RecentPRsResponse)
async def recent_prs(
    limit: int = Query(default=10, le=50),
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
):
    try:
        return await github_service.get_recent_prs(limit=limit, squad=squad, project=project)
    except Exception as e:
        logger.error(f"Error fetching recent PRs: {e}")
        return {"error": str(e), "data": None}


@router.get("/team-contributions", response_model=TeamContributionResponse)
async def team_contributions(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
    days: int = Query(default=30, le=90),
):
    try:
        return await github_service.get_team_contributions(squad=squad, project=project, days=days)
    except Exception as e:
        logger.error(f"Error fetching team contributions: {e}")
        return {"error": str(e), "data": None}


@router.get("/team-review-stats", response_model=TeamReviewStatsResponse)
async def team_review_stats(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
    days: int = Query(default=30, le=90),
):
    try:
        return await github_service.get_team_review_stats(squad=squad, project=project, days=days)
    except Exception as e:
        logger.error(f"Error fetching team review stats: {e}")
        return {"error": str(e), "data": None}
