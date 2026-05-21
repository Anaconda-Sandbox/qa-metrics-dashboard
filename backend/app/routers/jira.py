import logging

from fastapi import APIRouter, Query

from app.models.metrics import (
    AutomationCoverageResponse,
    BugListResponse,
    BugPriorityBreakdown,
    BugStatusBreakdown,
    DefectDensityResponse,
    QAReportedBugsResponse,
    StoryPointsResponse,
)
from app.services import jira_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/jira", tags=["jira"])


@router.get("/qa-reported-bugs", response_model=QAReportedBugsResponse)
async def qa_reported_bugs(
    quarter: str | None = Query(default=None, description="Quarter in format YYYY-QN, e.g., 2026-Q2. Defaults to current quarter."),
    project: str | None = Query(default=None, description="Optional Jira project key (e.g., 'DESK'). 'ALL' or omitted = no filter."),
):
    """Bugs reported by the QA team in the given quarter, with a high-priority sub-count.

    Source: Jira (`reporter in membersOf(\"QA\")`). When `project` is set, results
    narrow to that single project; otherwise the count is team-wide.
    """
    return await jira_service.get_qa_reported_bugs(quarter=quarter, project=project)


@router.get("/defect-density", response_model=DefectDensityResponse)
async def defect_density(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
    quarter: str | None = Query(default=None, description="Quarter in format YYYY-QN, e.g., 2026-Q2"),
):
    try:
        return await jira_service.get_defect_density(squad=squad, project=project, quarter=quarter)
    except Exception as e:
        logger.error(f"Error fetching defect density: {e}")
        return {"error": str(e), "data": None}


@router.get("/open-bugs", response_model=BugListResponse)
async def open_bugs(
    limit: int = Query(default=1000, le=2000),
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
    quarter: str | None = Query(default=None, description="Quarter in format YYYY-QN, e.g., 2026-Q2"),
):
    try:
        return await jira_service.get_open_bugs(limit=limit, squad=squad, project=project, quarter=quarter)
    except Exception as e:
        logger.error(f"Error fetching open bugs: {e}")
        return {"error": str(e), "data": None}


@router.get("/bug-priority-breakdown", response_model=BugPriorityBreakdown)
async def bug_priority_breakdown(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
):
    try:
        return await jira_service.get_bug_priority_breakdown(squad=squad, project=project)
    except Exception as e:
        logger.error(f"Error fetching bug priority breakdown: {e}")
        return {"error": str(e), "data": None}


@router.get("/bug-status-breakdown", response_model=BugStatusBreakdown)
async def bug_status_breakdown(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
):
    try:
        return await jira_service.get_bug_status_breakdown(squad=squad, project=project)
    except Exception as e:
        logger.error(f"Error fetching bug status breakdown: {e}")
        return {"error": str(e), "data": None}


@router.get("/automation-coverage", response_model=AutomationCoverageResponse)
async def automation_coverage(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
    quarter: str | None = Query(default=None, description="Quarter in format YYYY-QN, e.g., 2026-Q2"),
):
    try:
        return await jira_service.get_automation_coverage(squad=squad, project=project, quarter=quarter)
    except Exception as e:
        logger.error(f"Error fetching automation coverage: {e}")
        return {"error": str(e), "data": None}


@router.get("/bugs", response_model=BugListResponse)
async def bugs_list(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
    limit: int = Query(default=1000, le=2000),
):
    try:
        return await jira_service.get_bugs_list(squad=squad, project=project, limit=limit)
    except Exception as e:
        logger.error(f"Error fetching bugs list: {e}")
        return {"error": str(e), "data": None}


@router.get("/story-points", response_model=StoryPointsResponse)
async def story_points(
    squad: str | None = Query(default=None),
    project: str | None = Query(default=None),
    quarter: str | None = Query(default=None, description="Quarter in format YYYY-QN, e.g., 2026-Q2"),
):
    """Get story points metrics including velocity trend and per-member breakdown"""
    try:
        return await jira_service.get_story_points(squad=squad, project=project, quarter=quarter)
    except Exception as e:
        logger.error(f"Error fetching story points: {e}")
        return {"error": str(e), "data": None}
