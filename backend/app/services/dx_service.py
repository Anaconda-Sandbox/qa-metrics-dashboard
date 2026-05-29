"""
DX (Developer Experience) API Service
Integrates with DX platform to fetch developer experience metrics,
survey snapshots, team data, and DORA metrics.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from pydantic import BaseModel

from app.config import get_settings, ALL_QA_MEMBERS, GITHUB_TO_JIRA_NAME

logger = logging.getLogger(__name__)

DX_API_BASE = "https://api.getdx.com"
DX_API_TOKEN = "n39eub4M6WadMbRsQi7MtUMJywUBNhJtMrYh"
QA_TEAM_ID = "MTQyODk4"


class DXSnapshot(BaseModel):
    id: str
    scheduled_for: str
    completed_at: str | None
    completed_count: int
    total_count: int
    response_rate: float


class DXTeamScore(BaseModel):
    team_name: str
    team_id: str
    item_name: Optional[str] = None
    item_type: Optional[str] = None  # 'kpi' or 'factor'
    score: Optional[float] = None
    response_count: int = 0
    vs_prev: Optional[float] = None
    vs_org: Optional[float] = None
    vs_50th: Optional[float] = None
    vs_75th: Optional[float] = None


class DXMetrics(BaseModel):
    dex_score: float | None
    quality_score: float | None
    ease_of_delivery: float | None
    deep_work: float | None
    build_and_test: float | None
    code_maintainability: float | None
    documentation: float | None
    planning_process: float | None
    cross_team_collaboration: float | None
    incremental_delivery: float | None
    ease_of_release: float | None
    weekly_time_loss: float | None
    ai_code_quality: float | None


class DXTeamMember(BaseModel):
    id: str
    name: str
    email: str
    github_username: str | None
    is_developer: bool


class DXTeamInfo(BaseModel):
    id: str
    name: str
    manager_name: str
    manager_email: str
    contributor_count: int
    members: list[DXTeamMember]


class DORAMetrics(BaseModel):
    deployment_frequency: float | None
    lead_time_for_changes: float | None
    mean_time_to_recovery: float | None
    change_failure_rate: float | None


class PRMetrics(BaseModel):
    total_prs: int
    merged_prs: int
    avg_open_to_merge_hours: float | None
    avg_open_to_first_review_hours: float | None
    avg_review_cycles: float | None
    prs_by_week: list[dict]


class DXQuarterlyData(BaseModel):
    quarter: str
    snapshot: DXSnapshot | None
    team_scores: list[DXTeamScore]
    metrics: DXMetrics
    pr_metrics: PRMetrics | None


async def _make_dx_request(method: str, endpoint: str, params: dict = None, json_data: dict = None) -> dict:
    """Make authenticated request to DX API."""
    url = f"{DX_API_BASE}/{endpoint}"
    headers = {
        "Authorization": f"Bearer {DX_API_TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        if method == "GET":
            response = await client.get(url, headers=headers, params=params)
        else:
            response = await client.post(url, headers=headers, json=json_data)

        # Parse JSON for all responses including error codes
        try:
            data = response.json()
        except Exception:
            logger.error(f"DX API error: {response.status_code} - {response.text[:200]}")
            return {"ok": False, "error": f"HTTP {response.status_code}"}

        # 200 OK, 202 Accepted (async), or 409 Conflict (query not complete yet)
        if response.status_code in (200, 202, 409):
            return data

        logger.error(f"DX API error: {response.status_code} - {response.text[:200]}")
        return {"ok": False, "error": f"HTTP {response.status_code}"}


async def _run_sql_query(sql: str, timeout_seconds: int = 60) -> list[dict]:
    """Execute SQL query against DX Data Cloud and return results."""
    result = await _make_dx_request("POST", "studio.queryRuns.execute", json_data={"sql": sql})

    if not result.get("ok"):
        logger.error(f"Failed to execute query: {result.get('error')}")
        return []

    query_id = result["query_run"]["id"]
    logger.debug(f"Query submitted with ID: {query_id}")

    # Poll for results with longer timeout for complex queries
    wait_times = [1, 1, 2, 2, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]  # Total ~90s
    for wait_time in wait_times:
        await asyncio.sleep(wait_time)
        results = await _make_dx_request("GET", f"studio.queryRuns.results?id={query_id}")

        if results.get("ok") and results.get("results"):
            columns = results["results"]["columns"]
            rows = results["results"]["rows"]
            logger.debug(f"Query {query_id} returned {len(rows)} rows")
            return [dict(zip(columns, row)) for row in rows]

        # Still processing - continue polling
        error = results.get("error", "")
        if error in ("not_found", "execution_not_complete"):
            continue

        # Actual error
        if error:
            logger.error(f"Query error for {query_id}: {error}")
            return []

    logger.warning(f"Query {query_id} timed out after polling")
    return []


def _get_quarter_date_range(quarter: str) -> tuple[str, str]:
    """Convert quarter string to date range."""
    year, q = quarter.split("-Q")
    year = int(year)
    q = int(q)

    start_month = (q - 1) * 3 + 1
    end_month = start_month + 2

    start_date = datetime(year, start_month, 1)
    if end_month == 12:
        end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = datetime(year, end_month + 1, 1) - timedelta(days=1)

    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")


async def get_snapshots() -> list[DXSnapshot]:
    """Get all DX survey snapshots."""
    result = await _make_dx_request("GET", "snapshots.list")

    if not result.get("ok"):
        logger.error(f"Failed to fetch snapshots: {result.get('error')}")
        return []

    snapshots = []
    for s in result.get("snapshots", []):
        completed = s.get("completed_count", 0)
        total = s.get("total_count", 0)
        rate = (completed / total * 100) if total > 0 else 0

        snapshots.append(DXSnapshot(
            id=s["id"],
            scheduled_for=s["scheduled_for"],
            completed_at=s.get("completed_at"),
            completed_count=completed,
            total_count=total,
            response_rate=round(rate, 1)
        ))

    return sorted(snapshots, key=lambda x: x.scheduled_for, reverse=True)


async def get_snapshot_for_quarter(quarter: str) -> DXSnapshot | None:
    """Find the snapshot that falls within a given quarter."""
    start_date, end_date = _get_quarter_date_range(quarter)
    snapshots = await get_snapshots()

    for snapshot in snapshots:
        snapshot_date = snapshot.scheduled_for
        if start_date <= snapshot_date <= end_date:
            return snapshot

    return None


async def get_team_info() -> DXTeamInfo | None:
    """Get QA team information from DX."""
    result = await _make_dx_request("GET", f"teams.info?team_id={QA_TEAM_ID}")

    if not result.get("ok"):
        logger.error(f"Failed to fetch team info: {result.get('error')}")
        return None

    team = result.get("team", {})
    lead = team.get("lead", {})
    contributors = team.get("contributors", [])

    members = [
        DXTeamMember(
            id=c["id"],
            name=c["name"],
            email=c["email"],
            github_username=c.get("github_username"),
            is_developer=c.get("developer", False)
        )
        for c in contributors
    ]

    return DXTeamInfo(
        id=QA_TEAM_ID,
        name="QA",
        manager_name=lead.get("name", "Unknown"),
        manager_email=lead.get("email", ""),
        contributor_count=len(contributors),
        members=members
    )


async def get_snapshot_scores(snapshot_id: str) -> list[DXTeamScore]:
    """Get detailed scores from a specific snapshot."""
    result = await _make_dx_request("GET", f"snapshots.info?snapshot_id={snapshot_id}")

    if not result.get("ok"):
        logger.error(f"Failed to fetch snapshot scores: {result.get('error')}")
        return []

    scores = []
    team_scores = result.get("snapshot", {}).get("team_scores", [])

    for score in team_scores:
        team = score.get("snapshot_team", {})
        scores.append(DXTeamScore(
            team_name=team.get("name", "Unknown"),
            team_id=team.get("team_id", ""),
            item_name=score.get("item_name", ""),
            item_type=score.get("item_type", ""),
            score=score.get("score"),
            response_count=score.get("response_count", 0),
            vs_prev=score.get("vs_prev"),
            vs_org=score.get("vs_org"),
            vs_50th=score.get("vs_50th"),
            vs_75th=score.get("vs_75th")
        ))

    return scores


def _extract_qa_metrics(scores: list[DXTeamScore]) -> DXMetrics:
    """Extract QA team specific metrics from snapshot scores."""
    qa_scores = [s for s in scores if s.team_name == "QA"]

    metrics_map = {}
    for score in qa_scores:
        if score.score is not None:
            metrics_map[score.item_name.lower()] = score.score

    return DXMetrics(
        dex_score=metrics_map.get("dex"),
        quality_score=metrics_map.get("quality"),
        ease_of_delivery=metrics_map.get("ease of delivery"),
        deep_work=metrics_map.get("deep work"),
        build_and_test=metrics_map.get("build and test"),
        code_maintainability=metrics_map.get("code maintainability"),
        documentation=metrics_map.get("documentation"),
        planning_process=metrics_map.get("planning process"),
        cross_team_collaboration=metrics_map.get("cross-team collaboration"),
        incremental_delivery=metrics_map.get("incremental delivery"),
        ease_of_release=metrics_map.get("ease of release"),
        weekly_time_loss=metrics_map.get("weekly time loss"),
        ai_code_quality=metrics_map.get("ai code quality")
    )


async def get_pr_metrics_for_quarter(quarter: str) -> PRMetrics | None:
    """Get PR metrics from DX Data Cloud for a specific quarter."""
    start_date, end_date = _get_quarter_date_range(quarter)

    # Query for PR statistics
    sql = f"""
    SELECT
        COUNT(*) as total_prs,
        SUM(CASE WHEN merged IS NOT NULL THEN 1 ELSE 0 END) as merged_prs,
        AVG(CASE WHEN open_to_merge IS NOT NULL THEN CAST(open_to_merge AS FLOAT) / 60 ELSE NULL END) as avg_hours_to_merge,
        AVG(CASE WHEN open_to_first_review IS NOT NULL THEN CAST(open_to_first_review AS FLOAT) / 60 ELSE NULL END) as avg_hours_to_first_review,
        AVG(review_count) as avg_reviews
    FROM github_pulls
    WHERE created >= '{start_date}'
      AND created <= '{end_date}'
    """

    results = await _run_sql_query(sql)

    if not results:
        return None

    row = results[0]

    # Get weekly breakdown
    weekly_sql = f"""
    SELECT
        DATE_TRUNC('week', created) as week,
        COUNT(*) as pr_count,
        SUM(CASE WHEN merged IS NOT NULL THEN 1 ELSE 0 END) as merged_count
    FROM github_pulls
    WHERE created >= '{start_date}'
      AND created <= '{end_date}'
    GROUP BY DATE_TRUNC('week', created)
    ORDER BY week
    """

    weekly_results = await _run_sql_query(weekly_sql)
    prs_by_week = [
        {"week": r.get("week", ""), "count": int(r.get("pr_count", 0)), "merged": int(r.get("merged_count", 0))}
        for r in weekly_results
    ]

    return PRMetrics(
        total_prs=int(row.get("total_prs", 0) or 0),
        merged_prs=int(row.get("merged_prs", 0) or 0),
        avg_open_to_merge_hours=float(row.get("avg_hours_to_merge") or 0) if row.get("avg_hours_to_merge") else None,
        avg_open_to_first_review_hours=float(row.get("avg_hours_to_first_review") or 0) if row.get("avg_hours_to_first_review") else None,
        avg_review_cycles=float(row.get("avg_reviews") or 0) if row.get("avg_reviews") else None,
        prs_by_week=prs_by_week
    )


class AIToolUsage(BaseModel):
    """AI tool usage per user."""
    user_name: str
    email: str
    ai_tool: str
    active_days: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_spend_dollars: float = 0
    last_active_date: str | None = None


class PRReviewStats(BaseModel):
    """PR review stats per user."""
    user_name: str
    email: str
    prs_authored: int = 0
    reviews_done: int = 0
    review_comments: int = 0


class DefectDensityByProject(BaseModel):
    """Defect density per project."""
    project_name: str
    total_issues: int = 0
    bug_count: int = 0
    defect_density_pct: float = 0


class QADataCloudMetrics(BaseModel):
    """QA metrics pulled from DX Data Cloud."""
    # Quality metrics
    defect_density: float | None = None
    bug_count_by_priority: dict[str, int] = {}
    bug_resolution_rate: float | None = None
    reopen_rate: float | None = None

    # Velocity metrics
    tickets_completed: int = 0
    cycle_time_avg_hours: float | None = None
    sprint_completion_rate: float | None = None
    backlog_size: int = 0

    # Pipeline metrics
    pipeline_pass_rate: float | None = None
    pipeline_fail_rate: float | None = None
    total_pipeline_runs: int = 0
    avg_pipeline_duration_minutes: float | None = None

    # AI Adoption
    copilot_active_users: int = 0
    copilot_acceptance_rate: float | None = None
    copilot_loc_suggested: int = 0
    copilot_loc_accepted: int = 0
    cursor_active_users: int = 0

    # AI Tool Usage Details
    ai_tool_usage: list[AIToolUsage] = []

    # PR Review Stats
    pr_review_stats: list[PRReviewStats] = []

    # Defect Density by Project
    defect_density_by_project: list[DefectDensityByProject] = []


async def _get_pr_review_stats(start_date: str, end_date: str) -> list[dict]:
    """Get PR authoring and review stats for QA team."""
    sql = f"""
    WITH qa_users AS (
      SELECT du.id AS dx_user_id, du.name, du.email
      FROM dx_users du
      JOIN dx_teams dt ON du.team_id = dt.id
      WHERE dt.source_id = '{QA_TEAM_ID}'
        AND du.deleted_at IS NULL
    ),
    prs AS (
      SELECT pr.dx_user_id, COUNT(DISTINCT pr.id) AS prs_authored
      FROM pull_requests pr
      WHERE pr.merged >= '{start_date}' AND pr.merged < '{end_date}'
        AND pr.dx_user_id IN (SELECT dx_user_id FROM qa_users)
        AND pr.bot_authored = false
      GROUP BY pr.dx_user_id
    ),
    reviews AS (
      SELECT prr.dx_user_id,
        COUNT(DISTINCT prr.pull_request_id) AS reviews_done,
        SUM(prr.comment_count) AS total_comments
      FROM pull_request_reviews prr
      WHERE prr.created >= '{start_date}' AND prr.created < '{end_date}'
        AND prr.dx_user_id IN (SELECT dx_user_id FROM qa_users)
        AND prr.bot_authored = false
      GROUP BY prr.dx_user_id
    )
    SELECT
      qu.name AS user_name,
      qu.email,
      COALESCE(p.prs_authored, 0) AS prs_authored,
      COALESCE(r.reviews_done, 0) AS reviews_done,
      COALESCE(r.total_comments, 0) AS review_comments
    FROM qa_users qu
    LEFT JOIN prs p ON qu.dx_user_id = p.dx_user_id
    LEFT JOIN reviews r ON qu.dx_user_id = r.dx_user_id
    WHERE COALESCE(p.prs_authored, 0) > 0 OR COALESCE(r.reviews_done, 0) > 0
    ORDER BY reviews_done DESC, prs_authored DESC
    """
    return await _run_sql_query(sql)


async def _get_defect_density_by_project(start_date: str, end_date: str) -> list[dict]:
    """Get defect density per project for QA team's work."""
    sql = f"""
    SELECT
      jp.name AS project_name,
      COUNT(ji.id) AS total_issues,
      SUM(CASE WHEN jit.name ILIKE '%bug%' THEN 1 ELSE 0 END) AS bug_count,
      ROUND(
        (SUM(CASE WHEN jit.name ILIKE '%bug%' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(ji.id), 0)) * 100,
        2
      ) AS defect_density_pct
    FROM jira_issues ji
    JOIN jira_projects jp ON ji.project_id = jp.id
    JOIN jira_issue_types jit ON ji.issue_type_id = jit.id
    JOIN jira_users ju ON ji.user_id = ju.id
    JOIN dx_users du ON du.email = ju.email
    JOIN dx_teams dt ON du.team_id = dt.id
    WHERE dt.source_id = '{QA_TEAM_ID}'
      AND ji.deleted_at IS NULL
      AND ji.created_at >= '{start_date}'
      AND ji.created_at < '{end_date}'
    GROUP BY jp.name
    HAVING COUNT(ji.id) > 0
    ORDER BY defect_density_pct DESC
    """
    return await _run_sql_query(sql)


async def get_qa_data_cloud_metrics(quarter: str) -> QADataCloudMetrics:
    """Get QA metrics from DX Data Cloud tables."""
    start_date, end_date = _get_quarter_date_range(quarter)

    # Run all queries in parallel
    results = await asyncio.gather(
        _get_bug_metrics(start_date, end_date),
        _get_cycle_time_metrics(start_date, end_date),
        _get_pipeline_metrics(start_date, end_date),
        _get_ai_adoption_metrics(start_date, end_date),
        _get_pr_review_stats(start_date, end_date),
        _get_defect_density_by_project(start_date, end_date),
        return_exceptions=True
    )

    bug_metrics = results[0] if not isinstance(results[0], Exception) else {}
    cycle_metrics = results[1] if not isinstance(results[1], Exception) else {}
    pipeline_metrics = results[2] if not isinstance(results[2], Exception) else {}
    ai_metrics = results[3] if not isinstance(results[3], Exception) else {}
    pr_review_results = results[4] if not isinstance(results[4], Exception) else []
    defect_by_project_results = results[5] if not isinstance(results[5], Exception) else []

    # Override resolution_rate AND defect_density_by_project with the
    # Jira-sourced snapshots used by the leadership Dashboard so both views
    # show the same numbers. DX Cloud SQL undercounts because some projects
    # (CLI/PREX/QA/MRKT and parts of CASH) aren't fully ingested into DX.
    try:
        from app.database import SessionLocal
        from app.services import snapshot_service
        db = SessionLocal()
        try:
            bug_snap = snapshot_service.get_latest_bug_metrics(db, None, quarter)
            density_snap = snapshot_service.get_latest_defect_density(db, quarter)
        finally:
            db.close()
        if bug_snap and "resolution_rate" in bug_snap:
            bug_metrics["resolution_rate"] = bug_snap["resolution_rate"]
        if density_snap and density_snap.get("by_project"):
            # Replace DX-sourced list with Jira-sourced list (truth)
            defect_by_project_results = [
                {
                    "project_name": r["name"],
                    "total_issues": r["total_tickets"],
                    "bug_count": r["bug_count"],
                    "defect_density_pct": r["density_pct"],
                }
                for r in density_snap["by_project"]
            ]
            bug_metrics["defect_density"] = density_snap["overall_pct"]
    except Exception as e:
        logger.warning(f"Could not override DX qa-metrics from snapshot: {e}")

    # Parse AI tool usage
    ai_tool_usage_list = [
        AIToolUsage(**item) for item in ai_metrics.get("ai_tool_usage", [])
    ]

    # Parse PR review stats
    pr_review_stats_list = [
        PRReviewStats(
            user_name=r.get("user_name", "Unknown"),
            email=r.get("email", ""),
            prs_authored=int(r.get("prs_authored", 0) or 0),
            reviews_done=int(r.get("reviews_done", 0) or 0),
            review_comments=int(r.get("review_comments", 0) or 0)
        ) for r in pr_review_results
    ]

    # Parse defect density by project
    defect_by_project_list = [
        DefectDensityByProject(
            project_name=r.get("project_name", "Unknown"),
            total_issues=int(r.get("total_issues", 0) or 0),
            bug_count=int(r.get("bug_count", 0) or 0),
            defect_density_pct=float(r.get("defect_density_pct", 0) or 0)
        ) for r in defect_by_project_results
    ]

    return QADataCloudMetrics(
        # Quality
        defect_density=bug_metrics.get("defect_density"),
        bug_count_by_priority=bug_metrics.get("by_priority", {}),
        bug_resolution_rate=bug_metrics.get("resolution_rate"),
        reopen_rate=bug_metrics.get("reopen_rate"),

        # Velocity
        tickets_completed=cycle_metrics.get("completed", 0),
        cycle_time_avg_hours=cycle_metrics.get("avg_cycle_time"),
        sprint_completion_rate=cycle_metrics.get("sprint_completion"),
        backlog_size=cycle_metrics.get("backlog", 0),

        # Pipeline
        pipeline_pass_rate=pipeline_metrics.get("pass_rate"),
        pipeline_fail_rate=pipeline_metrics.get("fail_rate"),
        total_pipeline_runs=pipeline_metrics.get("total_runs", 0),
        avg_pipeline_duration_minutes=pipeline_metrics.get("avg_duration"),

        # AI
        copilot_active_users=ai_metrics.get("copilot_users", 0),
        copilot_acceptance_rate=ai_metrics.get("copilot_acceptance"),
        copilot_loc_suggested=ai_metrics.get("copilot_loc_suggested", 0),
        copilot_loc_accepted=ai_metrics.get("copilot_loc_accepted", 0),
        cursor_active_users=ai_metrics.get("cursor_users", 0),
        ai_tool_usage=ai_tool_usage_list,
        pr_review_stats=pr_review_stats_list,
        defect_density_by_project=defect_by_project_list
    )


async def _get_bug_metrics(start_date: str, end_date: str) -> dict:
    """Get bug/defect metrics from jira_issues table with proper JOINs."""
    # Bug count by priority (with JOINs to lookup tables)
    priority_sql = f"""
    SELECT
        p.name as priority,
        COUNT(*) as count
    FROM jira_issues i
    LEFT JOIN jira_issue_types it ON i.issue_type_id = it.id
    LEFT JOIN jira_priorities p ON i.priority_id = p.id
    WHERE it.name IN ('Bug', 'Defect')
      AND i.created_at >= '{start_date}'
      AND i.created_at <= '{end_date}'
    GROUP BY p.name
    """

    # Resolution rate (resolved = has resolution_date)
    resolution_sql = f"""
    SELECT
        COUNT(*) as total_bugs,
        SUM(CASE WHEN i.resolution_date IS NOT NULL THEN 1 ELSE 0 END) as resolved_bugs,
        SUM(CASE WHEN r.name ILIKE '%reopen%' THEN 1 ELSE 0 END) as reopened
    FROM jira_issues i
    LEFT JOIN jira_issue_types it ON i.issue_type_id = it.id
    LEFT JOIN jira_resolutions r ON i.resolution_id = r.id
    WHERE it.name IN ('Bug', 'Defect')
      AND i.created_at >= '{start_date}'
      AND i.created_at <= '{end_date}'
    """

    # Total tickets for defect density calculation
    total_sql = f"""
    SELECT COUNT(*) as total_tickets
    FROM jira_issues i
    WHERE i.created_at >= '{start_date}'
      AND i.created_at <= '{end_date}'
    """

    priority_results, resolution_results, total_results = await asyncio.gather(
        _run_sql_query(priority_sql),
        _run_sql_query(resolution_sql),
        _run_sql_query(total_sql)
    )

    by_priority = {}
    total_bugs = 0
    for row in priority_results:
        pname = row.get("priority", "Unknown") or "Unknown"
        count = int(row.get("count", 0) or 0)
        by_priority[pname] = count
        total_bugs += count

    result = {"by_priority": by_priority}

    if resolution_results:
        r = resolution_results[0]
        total = int(r.get("total_bugs", 0) or 0)
        resolved = int(r.get("resolved_bugs", 0) or 0)
        reopened = int(r.get("reopened", 0) or 0)

        if total > 0:
            result["resolution_rate"] = round((resolved / total) * 100, 1)
            result["reopen_rate"] = round((reopened / total) * 100, 1)

    if total_results:
        total_tickets = int(total_results[0].get("total_tickets", 0) or 0)
        if total_tickets > 0:
            result["defect_density"] = round((total_bugs / total_tickets) * 100, 1)

    return result


async def _get_cycle_time_metrics(start_date: str, end_date: str) -> dict:
    """Get cycle time and velocity metrics using proper table structure."""
    # Completed issues (have resolution_date in the quarter)
    cycle_sql = f"""
    SELECT
        COUNT(*) as completed,
        AVG(i.cycle_time) as avg_cycle_hours,
        SUM(i.story_points) as total_points
    FROM jira_issues i
    WHERE i.resolution_date IS NOT NULL
      AND i.resolution_date >= '{start_date}'
      AND i.resolution_date <= '{end_date}'
    """

    # Backlog (no resolution_date, created before end of quarter)
    backlog_sql = f"""
    SELECT COUNT(*) as backlog
    FROM jira_issues i
    WHERE i.resolution_date IS NULL
      AND i.created_at <= '{end_date}'
    """

    cycle_results, backlog_results = await asyncio.gather(
        _run_sql_query(cycle_sql),
        _run_sql_query(backlog_sql)
    )

    result = {}

    if cycle_results:
        r = cycle_results[0]
        result["completed"] = int(r.get("completed", 0) or 0)
        if r.get("avg_cycle_hours"):
            # cycle_time is in seconds, convert to hours
            avg_seconds = float(r["avg_cycle_hours"])
            result["avg_cycle_time"] = round(avg_seconds / 3600, 1)

    if backlog_results:
        result["backlog"] = int(backlog_results[0].get("backlog", 0) or 0)

    return result


async def _get_pipeline_metrics(start_date: str, end_date: str) -> dict:
    """Get CI/CD pipeline metrics from github_pull_deployments if available."""
    # Use github_pull_deployments as a proxy for CI/CD pipeline data
    pipeline_sql = f"""
    SELECT
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failed
    FROM github_pull_deployments
    WHERE created_at >= '{start_date}'
      AND created_at <= '{end_date}'
    """

    results = await _run_sql_query(pipeline_sql)

    if not results:
        return {}

    r = results[0]
    total = int(r.get("total_runs", 0) or 0)
    passed = int(r.get("passed", 0) or 0)
    failed = int(r.get("failed", 0) or 0)

    result = {"total_runs": total}

    if total > 0:
        result["pass_rate"] = round((passed / total) * 100, 1)
        result["fail_rate"] = round((failed / total) * 100, 1)

    return result


async def _get_ai_adoption_metrics(start_date: str, end_date: str) -> dict:
    """Get AI tool adoption metrics from DX Data Cloud."""
    # AI Tool usage per user for QA team
    ai_tool_sql = f"""
    SELECT
        du.name AS user_name,
        du.email,
        at.name AS ai_tool,
        COUNT(DISTINCT atdm.date) AS active_days,
        SUM(atdm.input_tokens) AS total_input_tokens,
        SUM(atdm.output_tokens) AS total_output_tokens,
        ROUND(SUM(atdm.spend_cents)::numeric / 100, 2) AS total_spend_dollars,
        MAX(atdm.date) AS last_active_date
    FROM ai_tool_daily_metrics atdm
    JOIN ai_tools at ON at.id = atdm.ai_tool_id
    JOIN dx_users du ON du.id = atdm.dx_user_id
    JOIN dx_teams dt ON dt.id = du.team_id
    WHERE dt.source_id = '{QA_TEAM_ID}'
      AND atdm.date >= '{start_date}'
      AND atdm.date <= '{end_date}'
    GROUP BY du.name, du.email, at.name
    ORDER BY total_spend_dollars DESC, active_days DESC
    """

    # Also get Copilot metrics
    copilot_sql = f"""
    SELECT
        SUM(total_active_users) as active_users,
        SUM(total_acceptances_count) as accepted,
        SUM(total_suggestions_count) as shown,
        SUM(total_lines_suggested) as loc_suggested,
        SUM(total_lines_accepted) as loc_accepted
    FROM github_copilot_usages
    WHERE day >= '{start_date}'
      AND day <= '{end_date}'
    """

    ai_tool_results, copilot_results = await asyncio.gather(
        _run_sql_query(ai_tool_sql),
        _run_sql_query(copilot_sql)
    )

    result = {"ai_tool_usage": []}

    # Process AI tool usage
    if ai_tool_results:
        for row in ai_tool_results:
            result["ai_tool_usage"].append({
                "user_name": row.get("user_name", "Unknown"),
                "email": row.get("email", ""),
                "ai_tool": row.get("ai_tool", "Unknown"),
                "active_days": int(row.get("active_days", 0) or 0),
                "total_input_tokens": int(row.get("total_input_tokens", 0) or 0),
                "total_output_tokens": int(row.get("total_output_tokens", 0) or 0),
                "total_spend_dollars": float(row.get("total_spend_dollars", 0) or 0),
                "last_active_date": row.get("last_active_date")
            })

    # Process Copilot metrics
    if copilot_results:
        r = copilot_results[0]
        result["copilot_users"] = int(r.get("active_users", 0) or 0)
        result["copilot_loc_suggested"] = int(r.get("loc_suggested", 0) or 0)
        result["copilot_loc_accepted"] = int(r.get("loc_accepted", 0) or 0)

        shown = int(r.get("shown", 0) or 0)
        accepted = int(r.get("accepted", 0) or 0)
        if shown > 0:
            result["copilot_acceptance"] = round((accepted / shown) * 100, 1)

    return result


async def get_dora_metrics_for_quarter(quarter: str) -> DORAMetrics:
    """Get DORA metrics from DX for a quarter."""
    start_date, end_date = _get_quarter_date_range(quarter)

    # Query deployment frequency
    deploy_sql = f"""
    SELECT
        COUNT(*) as deploy_count,
        COUNT(DISTINCT DATE(created)) as deploy_days
    FROM github_deployments
    WHERE created >= '{start_date}'
      AND created <= '{end_date}'
    """

    # Query lead time for changes (from commit to deploy)
    lead_time_sql = f"""
    SELECT
        AVG(CASE WHEN open_to_merge IS NOT NULL THEN CAST(open_to_merge AS FLOAT) / 60 / 24 ELSE NULL END) as avg_lead_time_days
    FROM github_pulls
    WHERE merged >= '{start_date}'
      AND merged <= '{end_date}'
    """

    deploy_results, lead_time_results = await asyncio.gather(
        _run_sql_query(deploy_sql),
        _run_sql_query(lead_time_sql)
    )

    # Calculate deployment frequency (deploys per week)
    deployment_frequency = None
    if deploy_results:
        deploy_count = int(deploy_results[0].get("deploy_count", 0) or 0)
        # Approximate weeks in quarter
        deployment_frequency = deploy_count / 13 if deploy_count > 0 else 0

    # Lead time in days
    lead_time = None
    if lead_time_results and lead_time_results[0].get("avg_lead_time_days"):
        lead_time = round(float(lead_time_results[0]["avg_lead_time_days"]), 2)

    return DORAMetrics(
        deployment_frequency=round(deployment_frequency, 2) if deployment_frequency else None,
        lead_time_for_changes=lead_time,
        mean_time_to_recovery=None,  # Would need incident data
        change_failure_rate=None  # Would need incident data
    )


async def get_quarterly_dx_data(quarter: str) -> DXQuarterlyData:
    """Get all DX data for a specific quarter."""
    # Get snapshot for quarter
    snapshot = await get_snapshot_for_quarter(quarter)

    # Get scores if snapshot exists
    scores = []
    if snapshot:
        scores = await get_snapshot_scores(snapshot.id)

    # Extract QA-specific metrics
    metrics = _extract_qa_metrics(scores)

    # Get PR metrics
    pr_metrics = await get_pr_metrics_for_quarter(quarter)

    return DXQuarterlyData(
        quarter=quarter,
        snapshot=snapshot,
        team_scores=scores,
        metrics=metrics,
        pr_metrics=pr_metrics
    )


async def get_all_teams() -> list[dict]:
    """Get all teams from DX."""
    result = await _make_dx_request("GET", "teams.list")

    if not result.get("ok"):
        return []

    return [
        {
            "id": t["id"],
            "name": t["name"],
            "parent_id": t.get("parent_id"),
            "manager_id": t.get("manager_id"),
            "contributor_count": t.get("contributors", 0)
        }
        for t in result.get("teams", [])
    ]


async def compare_quarters(quarter1: str, quarter2: str) -> dict:
    """Compare DX metrics between two quarters."""
    data1, data2 = await asyncio.gather(
        get_quarterly_dx_data(quarter1),
        get_quarterly_dx_data(quarter2)
    )

    def calc_change(v1: float | None, v2: float | None) -> float | None:
        if v1 is None or v2 is None or v2 == 0:
            return None
        return round((v1 - v2) / v2 * 100, 1)

    metrics1 = data1.metrics
    metrics2 = data2.metrics

    comparison = {
        "quarters": {"current": quarter1, "previous": quarter2},
        "metrics": {
            "dex_score": {
                "current": metrics1.dex_score,
                "previous": metrics2.dex_score,
                "change": calc_change(metrics1.dex_score, metrics2.dex_score)
            },
            "quality_score": {
                "current": metrics1.quality_score,
                "previous": metrics2.quality_score,
                "change": calc_change(metrics1.quality_score, metrics2.quality_score)
            },
            "ease_of_delivery": {
                "current": metrics1.ease_of_delivery,
                "previous": metrics2.ease_of_delivery,
                "change": calc_change(metrics1.ease_of_delivery, metrics2.ease_of_delivery)
            },
            "deep_work": {
                "current": metrics1.deep_work,
                "previous": metrics2.deep_work,
                "change": calc_change(metrics1.deep_work, metrics2.deep_work)
            },
            "build_and_test": {
                "current": metrics1.build_and_test,
                "previous": metrics2.build_and_test,
                "change": calc_change(metrics1.build_and_test, metrics2.build_and_test)
            },
        },
        "snapshots": {
            "current": data1.snapshot.model_dump() if data1.snapshot else None,
            "previous": data2.snapshot.model_dump() if data2.snapshot else None,
        },
        "pr_metrics": {
            "current": data1.pr_metrics.model_dump() if data1.pr_metrics else None,
            "previous": data2.pr_metrics.model_dump() if data2.pr_metrics else None,
        }
    }

    return comparison


async def get_org_benchmarks(snapshot_id: str) -> dict:
    """Get organization-wide benchmarks from a snapshot."""
    scores = await get_snapshot_scores(snapshot_id)

    # Group by metric and calculate org averages
    metrics_by_name: dict[str, list[float]] = {}
    for score in scores:
        if score.score is not None:
            key = score.item_name
            if key not in metrics_by_name:
                metrics_by_name[key] = []
            metrics_by_name[key].append(score.score)

    benchmarks = {}
    for name, values in metrics_by_name.items():
        if values:
            benchmarks[name] = {
                "avg": round(sum(values) / len(values), 1),
                "min": min(values),
                "max": max(values),
                "count": len(values)
            }

    return benchmarks


# ============ DATABASE FUNCTIONS ============

def save_dx_metrics_to_db(db, quarter: str, snapshot: DXSnapshot | None, metrics: DXMetrics, scores: list[DXTeamScore]):
    """Save DX metrics to database for historical tracking."""
    from app.database import DXSnapshot as DBSnapshot, DXMetrics as DBMetrics, DXTeamScore as DBTeamScore

    # Save snapshot metadata
    if snapshot:
        existing_snapshot = db.query(DBSnapshot).filter(DBSnapshot.dx_snapshot_id == snapshot.id).first()
        if not existing_snapshot:
            db_snapshot = DBSnapshot(
                dx_snapshot_id=snapshot.id,
                quarter=quarter,
                scheduled_for=datetime.strptime(snapshot.scheduled_for, "%Y-%m-%d").date(),
                completed_at=datetime.fromisoformat(snapshot.completed_at.replace("Z", "+00:00")) if snapshot.completed_at else None,
                completed_count=snapshot.completed_count,
                total_count=snapshot.total_count,
                response_rate=snapshot.response_rate
            )
            db.add(db_snapshot)

    # Save or update metrics
    existing_metrics = db.query(DBMetrics).filter(DBMetrics.quarter == quarter).first()
    if existing_metrics:
        existing_metrics.snapshot_id = snapshot.id if snapshot else None
        existing_metrics.dex_score = metrics.dex_score
        existing_metrics.quality_score = metrics.quality_score
        existing_metrics.ease_of_delivery = metrics.ease_of_delivery
        existing_metrics.deep_work = metrics.deep_work
        existing_metrics.build_and_test = metrics.build_and_test
        existing_metrics.code_maintainability = metrics.code_maintainability
        existing_metrics.documentation = metrics.documentation
        existing_metrics.planning_process = metrics.planning_process
        existing_metrics.cross_team_collaboration = metrics.cross_team_collaboration
        existing_metrics.incremental_delivery = metrics.incremental_delivery
        existing_metrics.ease_of_release = metrics.ease_of_release
        existing_metrics.weekly_time_loss = metrics.weekly_time_loss
        existing_metrics.ai_code_quality = metrics.ai_code_quality
        existing_metrics.updated_at = datetime.utcnow()
    else:
        db_metrics = DBMetrics(
            quarter=quarter,
            snapshot_id=snapshot.id if snapshot else None,
            dex_score=metrics.dex_score,
            quality_score=metrics.quality_score,
            ease_of_delivery=metrics.ease_of_delivery,
            deep_work=metrics.deep_work,
            build_and_test=metrics.build_and_test,
            code_maintainability=metrics.code_maintainability,
            documentation=metrics.documentation,
            planning_process=metrics.planning_process,
            cross_team_collaboration=metrics.cross_team_collaboration,
            incremental_delivery=metrics.incremental_delivery,
            ease_of_release=metrics.ease_of_release,
            weekly_time_loss=metrics.weekly_time_loss,
            ai_code_quality=metrics.ai_code_quality
        )
        db.add(db_metrics)

    # Save QA team scores (delete old ones first for this quarter)
    db.query(DBTeamScore).filter(
        DBTeamScore.quarter == quarter,
        DBTeamScore.team_name == "QA"
    ).delete()

    qa_scores = [s for s in scores if s.team_name == "QA"]
    for score in qa_scores:
        db_score = DBTeamScore(
            quarter=quarter,
            snapshot_id=snapshot.id if snapshot else None,
            team_name=score.team_name,
            team_id=score.team_id,
            item_name=score.item_name,
            item_type=score.item_type,
            score=score.score,
            response_count=score.response_count,
            vs_prev=score.vs_prev,
            vs_org=score.vs_org,
            vs_50th=score.vs_50th,
            vs_75th=score.vs_75th
        )
        db.add(db_score)

    db.commit()
    logger.info(f"Saved DX metrics for {quarter} to database")


def get_dx_metrics_from_db(db, quarter: str) -> dict | None:
    """Get DX metrics from database if available."""
    from app.database import DXSnapshot as DBSnapshot, DXMetrics as DBMetrics, DXTeamScore as DBTeamScore

    db_metrics = db.query(DBMetrics).filter(DBMetrics.quarter == quarter).first()
    if not db_metrics:
        return None

    # Get snapshot
    snapshot = None
    if db_metrics.snapshot_id:
        db_snapshot = db.query(DBSnapshot).filter(DBSnapshot.dx_snapshot_id == db_metrics.snapshot_id).first()
        if db_snapshot:
            snapshot = {
                "id": db_snapshot.dx_snapshot_id,
                "scheduled_for": db_snapshot.scheduled_for.isoformat(),
                "completed_at": db_snapshot.completed_at.isoformat() if db_snapshot.completed_at else None,
                "completed_count": db_snapshot.completed_count,
                "total_count": db_snapshot.total_count,
                "response_rate": db_snapshot.response_rate
            }

    # Get QA team scores
    db_scores = db.query(DBTeamScore).filter(
        DBTeamScore.quarter == quarter,
        DBTeamScore.team_name == "QA"
    ).all()

    qa_scores = [
        {
            "team_name": s.team_name,
            "team_id": s.team_id,
            "item_name": s.item_name,
            "item_type": s.item_type,
            "score": s.score,
            "response_count": s.response_count,
            "vs_prev": s.vs_prev,
            "vs_org": s.vs_org,
            "vs_50th": s.vs_50th,
            "vs_75th": s.vs_75th
        }
        for s in db_scores
    ]

    return {
        "quarter": quarter,
        "snapshot": snapshot,
        "metrics": {
            "dex_score": db_metrics.dex_score,
            "quality_score": db_metrics.quality_score,
            "ease_of_delivery": db_metrics.ease_of_delivery,
            "deep_work": db_metrics.deep_work,
            "build_and_test": db_metrics.build_and_test,
            "code_maintainability": db_metrics.code_maintainability,
            "documentation": db_metrics.documentation,
            "planning_process": db_metrics.planning_process,
            "cross_team_collaboration": db_metrics.cross_team_collaboration,
            "incremental_delivery": db_metrics.incremental_delivery,
            "ease_of_release": db_metrics.ease_of_release,
            "weekly_time_loss": db_metrics.weekly_time_loss,
            "ai_code_quality": db_metrics.ai_code_quality
        },
        "qa_scores": qa_scores,
        "from_cache": True,
        "last_updated": db_metrics.updated_at.isoformat() if db_metrics.updated_at else None
    }


async def sync_dx_data_for_quarter(db, quarter: str, force: bool = False) -> dict:
    """
    Sync DX data from API to database.
    Returns cached data if available and not forcing refresh.
    """
    # Check if we have recent data (less than 1 hour old)
    if not force:
        cached = get_dx_metrics_from_db(db, quarter)
        if cached and cached.get("last_updated"):
            last_updated = datetime.fromisoformat(cached["last_updated"])
            if datetime.utcnow() - last_updated < timedelta(hours=1):
                logger.info(f"Using cached DX data for {quarter}")
                return cached

    # Fetch fresh data from DX API
    logger.info(f"Fetching fresh DX data for {quarter} from API")
    data = await get_quarterly_dx_data(quarter)

    # Save to database
    save_dx_metrics_to_db(db, quarter, data.snapshot, data.metrics, data.team_scores)

    # Return the data
    return {
        "quarter": quarter,
        "snapshot": data.snapshot.model_dump() if data.snapshot else None,
        "metrics": data.metrics.model_dump(),
        "qa_scores": [s.model_dump() for s in data.team_scores if s.team_name == "QA"],
        "from_cache": False,
        "last_updated": datetime.utcnow().isoformat()
    }


# ============ DORA, TEAM, BENCHMARKS CACHING ============

def get_dora_from_db(db, quarter: str):
    """Get cached DORA metrics."""
    from app.database import DXDORAMetrics
    return db.query(DXDORAMetrics).filter(DXDORAMetrics.quarter == quarter).first()


def save_dora_to_db(db, quarter: str, dora: DORAMetrics):
    """Save DORA metrics to DB."""
    from app.database import DXDORAMetrics
    existing = get_dora_from_db(db, quarter)
    if existing:
        existing.deployment_frequency = dora.deployment_frequency
        existing.lead_time_for_changes = dora.lead_time_for_changes
        existing.mean_time_to_recovery = dora.mean_time_to_recovery
        existing.change_failure_rate = dora.change_failure_rate
        existing.updated_at = datetime.utcnow()
    else:
        db.add(DXDORAMetrics(
            quarter=quarter,
            deployment_frequency=dora.deployment_frequency,
            lead_time_for_changes=dora.lead_time_for_changes,
            mean_time_to_recovery=dora.mean_time_to_recovery,
            change_failure_rate=dora.change_failure_rate
        ))
    db.commit()


async def get_cached_dora_metrics(db, quarter: str, force: bool = False) -> DORAMetrics:
    """Get DORA metrics with DB caching (6hr TTL)."""
    if not force:
        cached = get_dora_from_db(db, quarter)
        if cached and cached.updated_at:
            if datetime.utcnow() - cached.updated_at < timedelta(hours=6):
                return DORAMetrics(
                    deployment_frequency=cached.deployment_frequency,
                    lead_time_for_changes=cached.lead_time_for_changes,
                    mean_time_to_recovery=cached.mean_time_to_recovery,
                    change_failure_rate=cached.change_failure_rate
                )

    dora = await get_dora_metrics_for_quarter(quarter)
    save_dora_to_db(db, quarter, dora)
    return dora


def get_team_from_db(db, team_id: str):
    """Get cached team info."""
    from app.database import DXTeamInfo
    return db.query(DXTeamInfo).filter(DXTeamInfo.team_id == team_id).first()


def save_team_to_db(db, team: DXTeamInfo):
    """Save team info to DB."""
    from app.database import DXTeamInfo as DBTeamInfo
    existing = get_team_from_db(db, team.id)
    members_data = [m.model_dump() for m in team.members]
    if existing:
        existing.name = team.name
        existing.manager_name = team.manager_name
        existing.manager_email = team.manager_email
        existing.contributor_count = team.contributor_count
        existing.members = members_data
        existing.updated_at = datetime.utcnow()
    else:
        db.add(DBTeamInfo(
            team_id=team.id,
            name=team.name,
            manager_name=team.manager_name,
            manager_email=team.manager_email,
            contributor_count=team.contributor_count,
            members=members_data
        ))
    db.commit()


async def get_cached_team_info(db, force: bool = False) -> DXTeamInfo | None:
    """Get team info with DB caching (24hr TTL)."""
    if not force:
        cached = get_team_from_db(db, QA_TEAM_ID)
        if cached and cached.updated_at:
            if datetime.utcnow() - cached.updated_at < timedelta(hours=24):
                members = [DXTeamMember(**m) for m in (cached.members or [])]
                return DXTeamInfo(
                    id=cached.team_id,
                    name=cached.name,
                    manager_name=cached.manager_name,
                    manager_email=cached.manager_email,
                    contributor_count=cached.contributor_count,
                    members=members
                )

    team = await get_team_info()
    if team:
        save_team_to_db(db, team)
    return team


def get_benchmarks_from_db(db, snapshot_id: str):
    """Get cached benchmarks."""
    from app.database import DXBenchmarks
    return db.query(DXBenchmarks).filter(DXBenchmarks.snapshot_id == snapshot_id).first()


def save_benchmarks_to_db(db, snapshot_id: str, benchmarks: dict):
    """Save benchmarks to DB."""
    from app.database import DXBenchmarks
    existing = get_benchmarks_from_db(db, snapshot_id)
    if existing:
        existing.benchmarks = benchmarks
        existing.updated_at = datetime.utcnow()
    else:
        db.add(DXBenchmarks(snapshot_id=snapshot_id, benchmarks=benchmarks))
    db.commit()


async def get_cached_benchmarks(db, snapshot_id: str, force: bool = False) -> dict | None:
    """Get benchmarks with DB caching (24hr TTL)."""
    if not force:
        cached = get_benchmarks_from_db(db, snapshot_id)
        if cached and cached.updated_at:
            if datetime.utcnow() - cached.updated_at < timedelta(hours=24):
                return cached.benchmarks

    benchmarks = await get_org_benchmarks(snapshot_id)
    save_benchmarks_to_db(db, snapshot_id, benchmarks)
    return benchmarks


# ============ QA CLOUD METRICS DATABASE FUNCTIONS ============

def save_qa_cloud_metrics_to_db(db, quarter: str, metrics: QADataCloudMetrics):
    """Save QA Cloud metrics to database for caching."""
    from app.database import DXQACloudMetrics

    existing = db.query(DXQACloudMetrics).filter(DXQACloudMetrics.quarter == quarter).first()

    if existing:
        existing.defect_density = metrics.defect_density
        existing.bug_count_by_priority = metrics.bug_count_by_priority
        existing.bug_resolution_rate = metrics.bug_resolution_rate
        existing.reopen_rate = metrics.reopen_rate
        existing.tickets_completed = metrics.tickets_completed
        existing.cycle_time_avg_hours = metrics.cycle_time_avg_hours
        existing.sprint_completion_rate = metrics.sprint_completion_rate
        existing.backlog_size = metrics.backlog_size
        existing.pipeline_pass_rate = metrics.pipeline_pass_rate
        existing.pipeline_fail_rate = metrics.pipeline_fail_rate
        existing.total_pipeline_runs = metrics.total_pipeline_runs
        existing.avg_pipeline_duration_minutes = metrics.avg_pipeline_duration_minutes
        existing.copilot_active_users = metrics.copilot_active_users
        existing.copilot_acceptance_rate = metrics.copilot_acceptance_rate
        existing.copilot_loc_suggested = metrics.copilot_loc_suggested
        existing.copilot_loc_accepted = metrics.copilot_loc_accepted
        existing.cursor_active_users = metrics.cursor_active_users
        existing.ai_tool_usage = [u.model_dump() for u in metrics.ai_tool_usage]
        existing.pr_review_stats = [s.model_dump() for s in metrics.pr_review_stats]
        existing.defect_density_by_project = [d.model_dump() for d in metrics.defect_density_by_project]
        existing.updated_at = datetime.utcnow()
    else:
        db_metrics = DXQACloudMetrics(
            quarter=quarter,
            defect_density=metrics.defect_density,
            bug_count_by_priority=metrics.bug_count_by_priority,
            bug_resolution_rate=metrics.bug_resolution_rate,
            reopen_rate=metrics.reopen_rate,
            tickets_completed=metrics.tickets_completed,
            cycle_time_avg_hours=metrics.cycle_time_avg_hours,
            sprint_completion_rate=metrics.sprint_completion_rate,
            backlog_size=metrics.backlog_size,
            pipeline_pass_rate=metrics.pipeline_pass_rate,
            pipeline_fail_rate=metrics.pipeline_fail_rate,
            total_pipeline_runs=metrics.total_pipeline_runs,
            avg_pipeline_duration_minutes=metrics.avg_pipeline_duration_minutes,
            copilot_active_users=metrics.copilot_active_users,
            copilot_acceptance_rate=metrics.copilot_acceptance_rate,
            copilot_loc_suggested=metrics.copilot_loc_suggested,
            copilot_loc_accepted=metrics.copilot_loc_accepted,
            cursor_active_users=metrics.cursor_active_users,
            ai_tool_usage=[u.model_dump() for u in metrics.ai_tool_usage],
            pr_review_stats=[s.model_dump() for s in metrics.pr_review_stats],
            defect_density_by_project=[d.model_dump() for d in metrics.defect_density_by_project]
        )
        db.add(db_metrics)

    db.commit()
    logger.info(f"Saved QA Cloud metrics for {quarter} to database")


def get_qa_cloud_metrics_from_db(db, quarter: str) -> QADataCloudMetrics | None:
    """Get QA Cloud metrics from database if available."""
    from app.database import DXQACloudMetrics

    cached = db.query(DXQACloudMetrics).filter(DXQACloudMetrics.quarter == quarter).first()
    if not cached:
        return None

    # Parse AI tool usage from JSON
    ai_tool_usage = [AIToolUsage(**item) for item in (cached.ai_tool_usage or [])]

    # Parse PR review stats from JSON
    pr_review_stats = [PRReviewStats(**item) for item in (cached.pr_review_stats or [])]

    # Parse defect density by project from JSON
    defect_density_by_project = [DefectDensityByProject(**item) for item in (cached.defect_density_by_project or [])]

    return QADataCloudMetrics(
        defect_density=cached.defect_density,
        bug_count_by_priority=cached.bug_count_by_priority or {},
        bug_resolution_rate=cached.bug_resolution_rate,
        reopen_rate=cached.reopen_rate,
        tickets_completed=cached.tickets_completed,
        cycle_time_avg_hours=cached.cycle_time_avg_hours,
        sprint_completion_rate=cached.sprint_completion_rate,
        backlog_size=cached.backlog_size,
        pipeline_pass_rate=cached.pipeline_pass_rate,
        pipeline_fail_rate=cached.pipeline_fail_rate,
        total_pipeline_runs=cached.total_pipeline_runs,
        avg_pipeline_duration_minutes=cached.avg_pipeline_duration_minutes,
        copilot_active_users=cached.copilot_active_users,
        copilot_acceptance_rate=cached.copilot_acceptance_rate,
        copilot_loc_suggested=cached.copilot_loc_suggested,
        copilot_loc_accepted=cached.copilot_loc_accepted,
        cursor_active_users=cached.cursor_active_users,
        ai_tool_usage=ai_tool_usage,
        pr_review_stats=pr_review_stats,
        defect_density_by_project=defect_density_by_project
    ), cached.updated_at


async def sync_qa_cloud_metrics(db, quarter: str, force: bool = False) -> QADataCloudMetrics:
    """
    Sync QA Cloud metrics from DX Data Cloud to database.
    Returns cached data if available and not forcing refresh (cache TTL: 6 hours).
    """
    # Check for cached data (6 hour TTL since these queries are slow)
    if not force:
        result = get_qa_cloud_metrics_from_db(db, quarter)
        if result:
            cached_metrics, last_updated = result
            if last_updated and datetime.utcnow() - last_updated < timedelta(hours=6):
                logger.info(f"Using cached QA Cloud metrics for {quarter}")
                return cached_metrics

    # Fetch fresh data from DX Data Cloud
    logger.info(f"Fetching fresh QA Cloud metrics for {quarter} from DX Data Cloud")
    metrics = await get_qa_data_cloud_metrics(quarter)

    # Save to database
    save_qa_cloud_metrics_to_db(db, quarter, metrics)

    return metrics


# ============ EXECUTIVE DASHBOARD (DX Data Cloud Only) ============

class ExecutiveMetrics(BaseModel):
    """Executive dashboard metrics from DX Data Cloud."""
    # Quality KPIs
    open_bugs: int = 0
    resolved_bugs: int = 0
    bugs_fixed_by_qa: int = 0
    critical_bugs: int = 0
    bug_resolution_rate: float | None = None
    defect_density: float | None = None

    # Velocity KPIs
    story_points_completed: float = 0
    story_points_in_progress: float = 0
    tickets_completed: int = 0
    avg_cycle_time_hours: float | None = None

    # PR & Review KPIs
    prs_merged: int = 0
    prs_opened: int = 0
    total_reviews: int = 0
    avg_pr_merge_time_hours: float | None = None

    # Weekly trends
    defect_trend: list[dict] = []
    pr_trend: list[dict] = []
    velocity_trend: list[dict] = []
    review_trend: list[dict] = []

    # Automation health (ReportPortal-sourced, snapshotted hourly)
    automation_health: dict | None = None

    # Team breakdown
    team_contributions: list[dict] = []
    story_points_by_member: list[dict] = []
    top_reviewers: list[dict] = []


def _project_clause(project: str | None, alias: str = "ji", join_alias: str = "jproj") -> tuple[str, str]:
    """Return (extra_join_sql, where_filter_sql) to scope a Jira query to a single project.

    Returns ('', '') when project is None or 'ALL' — caller adds nothing to the SQL.
    Otherwise returns a JOIN onto jira_projects + an `AND jproj.key = '...'` clause.
    """
    if not project or project == "ALL":
        return "", ""
    safe = project.replace("'", "")
    join = f" JOIN jira_projects {join_alias} ON {alias}.project_id = {join_alias}.id"
    where = f" AND {join_alias}.key = '{safe}'"
    return join, where


def _repo_clause(project: str | None, repo_id_expr: str, join_alias: str = "rep") -> tuple[str, str]:
    """Return (extra_join_sql, where_filter_sql) to scope a PR/review query to repos for a project.

    Maps Jira project key → list of repo names via PROJECT_CONFIG. Returns ('', '')
    when project is None / 'ALL' / unknown / has no repos.
    `repo_id_expr` is the SQL expression for the row's repo id (e.g. 'pr.repo_id').
    """
    if not project or project == "ALL":
        return "", ""
    from app.config import PROJECT_CONFIG
    cfg = PROJECT_CONFIG.get(project)
    if not cfg or not cfg.get("repos"):
        return "", ""
    safe_names = [r.replace("'", "") for r in cfg["repos"]]
    in_list = ", ".join(f"'{n}'" for n in safe_names)
    join = f" JOIN repos {join_alias} ON {repo_id_expr} = {join_alias}.id"
    where = f" AND {join_alias}.name IN ({in_list})"
    return join, where


async def _get_executive_bug_metrics(start_date: str, end_date: str, project: str | None = None, quarter: str | None = None) -> dict:
    """Get bug metrics for the leadership dashboard.

    Source of truth is Jira (not DX Cloud). Reads from MetricSnapshot first
    (refreshed hourly by the scheduler) so the read path is sub-millisecond;
    falls back to a live Jira API call if no recent snapshot exists.

    Why not DX Cloud SQL: ~4 of Anaconda's Jira projects (CLI, PREX, QA,
    MRKT) aren't allowlisted in DX, so a DX-sourced bug count silently
    misses ~38% of QA-reported bugs.

    Resolution signal: `resolutiondate is not EMPTY` in JQL, which corresponds
    to `completed_at IS NOT NULL` in DX — they're equivalent in the source data.
    Critical = open bug with priority in (Highest, High).
    """
    from app.database import SessionLocal
    from app.services import snapshot_service

    # We need the quarter label to look up snapshots. If the caller didn't
    # pass it, derive from the dates.
    if not quarter:
        try:
            year, month = int(start_date[:4]), int(start_date[5:7])
            quarter = f"{year}-Q{(month - 1) // 3 + 1}"
        except (ValueError, IndexError):
            quarter = None

    project_key = project if (project and project != "ALL") else None

    # Read path: MetricSnapshot
    if quarter:
        db = SessionLocal()
        try:
            snap = snapshot_service.get_latest_bug_metrics(db, project_key, quarter)
        finally:
            db.close()
        if snap:
            return {
                "open_bugs": snap["open_bugs"],
                "resolved_bugs": snap["resolved_bugs"],
                "bugs_fixed_by_qa": snap.get("qa_fixed_count", 0),
                "critical_bugs": snap["critical_bugs"],
                "resolution_rate": snap["resolution_rate"],
            }

    # Fallback: live Jira call (will populate the snapshot on the next scheduler tick)
    logger.info(f"Bug metrics snapshot missing for project={project_key} quarter={quarter}; falling back to live Jira call")
    try:
        from app.services import jira_service
        m = await jira_service.get_qa_bug_metrics(quarter=quarter, project=project_key)
        qa_fixed = await jira_service.get_qa_fixed_count(quarter=quarter, project=project_key)
        return {
            "open_bugs": m["open"],
            "resolved_bugs": m["resolved"],
            "bugs_fixed_by_qa": qa_fixed,
            "critical_bugs": m["critical_open"],
            "resolution_rate": m["resolution_rate"],
        }
    except Exception as e:
        logger.error(f"Live Jira fallback for bug metrics failed: {e}")
        return {"open_bugs": 0, "resolved_bugs": 0, "bugs_fixed_by_qa": 0, "critical_bugs": 0, "resolution_rate": 0}


async def _get_executive_velocity_metrics(start_date: str, end_date: str, project: str | None = None) -> dict:
    """Get velocity metrics for executive dashboard."""
    proj_join, proj_where = _project_clause(project, alias="i", join_alias="jproj")
    velocity_sql = f"""
    SELECT
        COALESCE(SUM(CASE WHEN js.name = 'Done' THEN i.story_points ELSE 0 END), 0) as completed_points,
        COALESCE(SUM(CASE WHEN js.name NOT IN ('Done', 'Closed') AND i.story_points > 0 THEN i.story_points ELSE 0 END), 0) as in_progress_points,
        COUNT(CASE WHEN i.resolution_date IS NOT NULL THEN 1 END) as tickets_completed,
        AVG(CASE WHEN i.resolution_date IS NOT NULL THEN i.cycle_time END) as avg_cycle_seconds
    FROM jira_issues i
    JOIN jira_users ju ON i.user_id = ju.id
    JOIN dx_users du ON du.email = ju.email
    JOIN dx_teams dt ON du.team_id = dt.id
    LEFT JOIN jira_statuses js ON i.status_id = js.id{proj_join}
    WHERE dt.source_id = '{QA_TEAM_ID}'
      AND i.deleted_at IS NULL
      AND (
        (i.resolution_date >= '{start_date}' AND i.resolution_date < '{end_date}')
        OR (i.resolution_date IS NULL AND i.created_at < '{end_date}')
      ){proj_where}
    """

    results = await _run_sql_query(velocity_sql)

    result = {}
    if results:
        r = results[0]
        result["completed_points"] = float(r.get("completed_points", 0) or 0)
        result["in_progress_points"] = float(r.get("in_progress_points", 0) or 0)
        result["tickets_completed"] = int(r.get("tickets_completed", 0) or 0)
        if r.get("avg_cycle_seconds"):
            result["avg_cycle_time_hours"] = round(float(r["avg_cycle_seconds"]) / 3600, 1)

    return result


async def _get_executive_pr_metrics(start_date: str, end_date: str, project: str | None = None) -> dict:
    """Get PR metrics for executive dashboard."""
    pr_repo_join, pr_repo_where = _repo_clause(project, "pr.repo_id", join_alias="rep")
    # For reviews: filter via the parent PR's repo
    rev_repo_join, rev_repo_where = _repo_clause(project, "rev_pr.repo_id", join_alias="rep")
    if rev_repo_join:
        rev_repo_join = " JOIN pull_requests rev_pr ON prr.pull_request_id = rev_pr.id" + rev_repo_join

    pr_sql = f"""
    SELECT
        COUNT(*) as total_prs,
        SUM(CASE WHEN pr.merged IS NOT NULL THEN 1 ELSE 0 END) as merged_prs,
        AVG(CASE WHEN pr.merged IS NOT NULL THEN pr.open_to_merge END) as avg_merge_seconds
    FROM pull_requests pr
    JOIN dx_users du ON pr.dx_user_id = du.id
    JOIN dx_teams dt ON du.team_id = dt.id{pr_repo_join}
    WHERE dt.source_id = '{QA_TEAM_ID}'
      AND pr.created >= '{start_date}'
      AND pr.created < '{end_date}'
      AND pr.bot_authored = false{pr_repo_where}
    """

    # Count distinct (PR, reviewer) pairs rather than every review event.
    # Otherwise multiple COMMENT actions by the same reviewer on the same PR
    # each inflate the count — this conflates "left a comment" with "reviewed a PR".
    review_sql = f"""
    SELECT COUNT(*) as total_reviews
    FROM (
      SELECT DISTINCT prr.pull_request_id, prr.dx_user_id
      FROM pull_request_reviews prr
      JOIN dx_users du ON prr.dx_user_id = du.id
      JOIN dx_teams dt ON du.team_id = dt.id{rev_repo_join}
      WHERE dt.source_id = '{QA_TEAM_ID}'
        AND prr.created >= '{start_date}'
        AND prr.created < '{end_date}'
        AND prr.bot_authored = false{rev_repo_where}
    ) AS distinct_reviews
    """

    pr_results, review_results = await asyncio.gather(
        _run_sql_query(pr_sql),
        _run_sql_query(review_sql)
    )

    result = {}
    if pr_results:
        r = pr_results[0]
        result["prs_opened"] = int(r.get("total_prs", 0) or 0)
        result["prs_merged"] = int(r.get("merged_prs", 0) or 0)
        if r.get("avg_merge_seconds"):
            result["avg_pr_merge_time_hours"] = round(float(r["avg_merge_seconds"]) / 3600, 1)

    if review_results:
        result["total_reviews"] = int(review_results[0].get("total_reviews", 0) or 0)

    return result


async def _get_executive_defect_trend(start_date: str, end_date: str, project: str | None = None) -> list[dict]:
    """Get weekly defect trend."""
    proj_join, proj_where = _project_clause(project, alias="i", join_alias="jproj")
    sql = f"""
    SELECT
        DATE_TRUNC('week', i.created_at)::date as week,
        COUNT(*) as created,
        SUM(CASE WHEN i.resolution_date IS NOT NULL
            AND DATE_TRUNC('week', i.resolution_date) = DATE_TRUNC('week', i.created_at)
            THEN 1 ELSE 0 END) as resolved_same_week
    FROM jira_issues i
    JOIN jira_issue_types it ON i.issue_type_id = it.id
    JOIN jira_users ju ON i.user_id = ju.id
    JOIN dx_users du ON du.email = ju.email
    JOIN dx_teams dt ON du.team_id = dt.id{proj_join}
    WHERE dt.source_id = '{QA_TEAM_ID}'
      AND it.name IN ('Bug', 'Defect')
      AND i.created_at >= '{start_date}'
      AND i.created_at < '{end_date}'
      AND i.deleted_at IS NULL{proj_where}
    GROUP BY DATE_TRUNC('week', i.created_at)
    ORDER BY week
    """

    results = await _run_sql_query(sql)
    return [
        {
            "week": str(r.get("week", ""))[:10],
            "created": int(r.get("created", 0) or 0),
            "resolved": int(r.get("resolved_same_week", 0) or 0)
        }
        for r in results
    ]


async def _get_executive_pr_trend(start_date: str, end_date: str, project: str | None = None) -> list[dict]:
    """Get weekly PR trend."""
    repo_join, repo_where = _repo_clause(project, "pr.repo_id", join_alias="rep")
    sql = f"""
    SELECT
        DATE_TRUNC('week', pr.created)::date as week,
        COUNT(*) as opened,
        SUM(CASE WHEN pr.merged IS NOT NULL THEN 1 ELSE 0 END) as merged
    FROM pull_requests pr
    JOIN dx_users du ON pr.dx_user_id = du.id
    JOIN dx_teams dt ON du.team_id = dt.id{repo_join}
    WHERE dt.source_id = '{QA_TEAM_ID}'
      AND pr.created >= '{start_date}'
      AND pr.created < '{end_date}'
      AND pr.bot_authored = false{repo_where}
    GROUP BY DATE_TRUNC('week', pr.created)
    ORDER BY week
    """

    results = await _run_sql_query(sql)
    return [
        {
            "week": str(r.get("week", ""))[:10],
            "opened": int(r.get("opened", 0) or 0),
            "merged": int(r.get("merged", 0) or 0)
        }
        for r in results
    ]


async def _get_executive_velocity_trend(start_date: str, end_date: str, project: str | None = None) -> list[dict]:
    """Get weekly velocity trend (story points completed)."""
    proj_join, proj_where = _project_clause(project, alias="i", join_alias="jproj")
    sql = f"""
    SELECT
        DATE_TRUNC('week', i.resolution_date)::date as week,
        COALESCE(SUM(i.story_points), 0) as completed_points,
        COUNT(*) as tickets_completed
    FROM jira_issues i
    JOIN jira_users ju ON i.user_id = ju.id
    JOIN dx_users du ON du.email = ju.email
    JOIN dx_teams dt ON du.team_id = dt.id{proj_join}
    WHERE dt.source_id = '{QA_TEAM_ID}'
      AND i.resolution_date >= '{start_date}'
      AND i.resolution_date < '{end_date}'
      AND i.deleted_at IS NULL{proj_where}
    GROUP BY DATE_TRUNC('week', i.resolution_date)
    ORDER BY week
    """

    results = await _run_sql_query(sql)
    return [
        {
            "week": str(r.get("week", ""))[:10],
            "completed_points": float(r.get("completed_points", 0) or 0),
            "tickets_completed": int(r.get("tickets_completed", 0) or 0)
        }
        for r in results
    ]


async def _get_executive_team_contributions(start_date: str, end_date: str, project: str | None = None) -> list[dict]:
    """Get team contributions breakdown."""
    repo_join, repo_where = _repo_clause(project, "pr.repo_id", join_alias="rep")
    sql = f"""
    SELECT
        du.name as user_name,
        COUNT(*) as prs_opened,
        SUM(CASE WHEN pr.merged IS NOT NULL THEN 1 ELSE 0 END) as prs_merged
    FROM pull_requests pr
    JOIN dx_users du ON pr.dx_user_id = du.id
    JOIN dx_teams dt ON du.team_id = dt.id{repo_join}
    WHERE dt.source_id = '{QA_TEAM_ID}'
      AND pr.created >= '{start_date}'
      AND pr.created < '{end_date}'
      AND pr.bot_authored = false{repo_where}
    GROUP BY du.name
    HAVING COUNT(*) > 0
    ORDER BY prs_merged DESC, prs_opened DESC
    """

    results = await _run_sql_query(sql)
    return [
        {
            "user_name": r.get("user_name", "Unknown"),
            "prs_opened": int(r.get("prs_opened", 0) or 0),
            "prs_merged": int(r.get("prs_merged", 0) or 0)
        }
        for r in results
    ]


async def _get_executive_story_points_by_member(start_date: str, end_date: str, project: str | None = None) -> list[dict]:
    """Get story points breakdown by member."""
    proj_join, proj_where = _project_clause(project, alias="i", join_alias="jproj")
    sql = f"""
    SELECT
        du.name as user_name,
        COALESCE(SUM(CASE WHEN js.name = 'Done' THEN i.story_points ELSE 0 END), 0) as completed_points,
        COALESCE(SUM(CASE WHEN js.name NOT IN ('Done', 'Closed') THEN i.story_points ELSE 0 END), 0) as in_progress_points,
        COUNT(*) as total_issues,
        COUNT(CASE WHEN i.resolution_date IS NOT NULL THEN 1 END) as issues_completed
    FROM jira_issues i
    JOIN jira_users ju ON i.user_id = ju.id
    JOIN dx_users du ON du.email = ju.email
    JOIN dx_teams dt ON du.team_id = dt.id
    LEFT JOIN jira_statuses js ON i.status_id = js.id{proj_join}
    WHERE dt.source_id = '{QA_TEAM_ID}'
      AND i.deleted_at IS NULL
      AND (
        i.created_at >= '{start_date}' AND i.created_at < '{end_date}'
        OR i.resolution_date >= '{start_date}' AND i.resolution_date < '{end_date}'
      ){proj_where}
    GROUP BY du.name
    HAVING SUM(i.story_points) > 0 OR COUNT(*) > 0
    ORDER BY completed_points DESC
    """

    results = await _run_sql_query(sql)
    return [
        {
            "user_name": r.get("user_name", "Unknown"),
            "completed_points": float(r.get("completed_points", 0) or 0),
            "in_progress_points": float(r.get("in_progress_points", 0) or 0),
            "total_issues": int(r.get("total_issues", 0) or 0),
            "issues_completed": int(r.get("issues_completed", 0) or 0)
        }
        for r in results
    ]


async def _get_executive_review_trend(start_date: str, end_date: str, project: str | None = None) -> list[dict]:
    """Get weekly review trend."""
    repo_join_inner, repo_where = _repo_clause(project, "rev_pr.repo_id", join_alias="rep")
    repo_join = ""
    if repo_join_inner:
        repo_join = " JOIN pull_requests rev_pr ON prr.pull_request_id = rev_pr.id" + repo_join_inner
    # Same DISTINCT (PR, reviewer) treatment as total_reviews — count one
    # review per (PR, reviewer) pair per week, not every comment event.
    sql = f"""
    SELECT week, COUNT(*) AS reviews
    FROM (
      SELECT DISTINCT
        DATE_TRUNC('week', prr.created)::date AS week,
        prr.pull_request_id,
        prr.dx_user_id
      FROM pull_request_reviews prr
      JOIN dx_users du ON prr.dx_user_id = du.id
      JOIN dx_teams dt ON du.team_id = dt.id{repo_join}
      WHERE dt.source_id = '{QA_TEAM_ID}'
        AND prr.created >= '{start_date}'
        AND prr.created < '{end_date}'
        AND prr.bot_authored = false{repo_where}
    ) AS distinct_reviews
    GROUP BY week
    ORDER BY week
    """

    results = await _run_sql_query(sql)
    return [
        {
            "week": str(r.get("week", ""))[:10],
            "reviews": int(r.get("reviews", 0) or 0)
        }
        for r in results
    ]


async def _get_executive_top_reviewers(start_date: str, end_date: str, project: str | None = None) -> list[dict]:
    """Get top reviewers with breakdown - same query pattern as _get_pr_review_stats but sorted by reviews."""
    repo_join_inner, repo_where = _repo_clause(project, "rev_pr.repo_id", join_alias="rep")
    repo_join = ""
    if repo_join_inner:
        repo_join = " JOIN pull_requests rev_pr ON prr.pull_request_id = rev_pr.id" + repo_join_inner
    # DX's pull_request_reviews.review_type values are APPROVAL / CHANGES_REQUESTED /
    # COMMENT / UNKNOWN — count each as a separate metric so the Top Reviewers
    # table can show the breakdown instead of all-zero columns.
    sql = f"""
    WITH qa_users AS (
      SELECT du.id AS dx_user_id, du.name, du.email
      FROM dx_users du
      JOIN dx_teams dt ON du.team_id = dt.id
      WHERE dt.source_id = '{QA_TEAM_ID}'
        AND du.deleted_at IS NULL
    ),
    reviews AS (
      SELECT prr.dx_user_id,
        COUNT(DISTINCT prr.pull_request_id) AS reviews_done,
        SUM(prr.comment_count) AS total_comments,
        COUNT(*) FILTER (WHERE prr.review_type = 'APPROVAL') AS approvals,
        COUNT(*) FILTER (WHERE prr.review_type = 'CHANGES_REQUESTED') AS changes_requested
      FROM pull_request_reviews prr{repo_join}
      WHERE prr.created >= '{start_date}' AND prr.created < '{end_date}'
        AND prr.dx_user_id IN (SELECT dx_user_id FROM qa_users)
        AND prr.bot_authored = false{repo_where}
      GROUP BY prr.dx_user_id
    )
    SELECT
      qu.name AS user_name,
      COALESCE(r.reviews_done, 0) AS reviews_given,
      COALESCE(r.total_comments, 0) AS comments,
      COALESCE(r.approvals, 0) AS approvals,
      COALESCE(r.changes_requested, 0) AS changes_requested
    FROM qa_users qu
    LEFT JOIN reviews r ON qu.dx_user_id = r.dx_user_id
    WHERE COALESCE(r.reviews_done, 0) > 0
    ORDER BY reviews_given DESC
    """

    results = await _run_sql_query(sql)
    return [
        {
            "user_name": r.get("user_name", "Unknown"),
            "reviews_given": int(r.get("reviews_given", 0) or 0),
            "approvals": int(r.get("approvals", 0) or 0),
            "changes_requested": int(r.get("changes_requested", 0) or 0),
            "comments": int(r.get("comments", 0) or 0)
        }
        for r in results
    ]


async def _get_automation_health(quarter: str, project: str | None = None) -> dict | None:
    """Return RP automation metrics for the leadership dashboard.

    Read path: latest snapshot in MetricSnapshot (refreshed hourly by the
    scheduler). Falls back to a live RP fetch with `include_flaky=False`
    so the dashboard doesn't pay the slow flaky-detection cost on a cold
    cache; the next scheduler tick will fill in flaky_pct.

    When `project` is set, filters the cached per-project list to the
    `rp_projects` mapping defined in PROJECT_CONFIG and recomputes the
    overall aggregate. If the Jira project has no RP mapping (e.g. PA,
    INST, HUB), returns a snapshot with empty by_project so the UI can
    render a "not tracked" message.
    """
    from app.database import SessionLocal
    from app.services import snapshot_service

    db = SessionLocal()
    try:
        snap = snapshot_service.get_latest_automation_metrics(db, quarter)
    finally:
        db.close()

    if not snap:
        logger.info(f"RP automation snapshot missing for {quarter}; falling back to live RP fetch (no flaky)")
        try:
            from app.services import reportportal_service
            snap = await reportportal_service.get_automation_metrics_for_quarter(quarter, include_flaky=False)
        except Exception as e:
            logger.error(f"Live RP fallback for automation metrics failed: {e}")
            return None

    if not project or project == "ALL":
        return snap

    # Filter snapshot to the RP projects mapped to this Jira project key.
    from app.config import PROJECT_CONFIG
    cfg = PROJECT_CONFIG.get(project) or {}
    rp_keys = set(cfg.get("rp_projects") or [])
    by_project = [p for p in (snap.get("by_project") or []) if p.get("project") in rp_keys]

    # Recompute aggregate over the filtered subset
    total_tests = sum(int(p.get("total_tests") or 0) for p in by_project)
    total_passed = sum(int(p.get("total_passed") or 0) for p in by_project)
    total_launches = sum(int(p.get("launches") or 0) for p in by_project)
    durations = [float(p.get("avg_duration_sec") or 0) for p in by_project if p.get("avg_duration_sec")]
    overall = {
        "pass_rate_pct": round((total_passed / total_tests) * 100, 2) if total_tests else 0.0,
        "avg_duration_sec": round(sum(durations) / len(durations), 1) if durations else 0.0,
        "total_launches": total_launches,
        "total_tests": total_tests,
        "total_passed": total_passed,
    }
    return {
        "quarter": snap.get("quarter", quarter),
        "overall": overall,
        "by_project": by_project,
        "snapshot_date": snap.get("snapshot_date"),
    }


async def get_executive_dashboard_metrics(quarter: str, project: str | None = None) -> ExecutiveMetrics:
    """Get all executive dashboard metrics from DX Data Cloud.

    `project` (optional Jira key like 'DESK') narrows results to that single project:
    Jira-sourced metrics filter via `jira_projects.key`; PR/review metrics filter via
    the repos mapped in PROJECT_CONFIG[project].repos. The QA-team join is always
    enforced — selection narrows scope, never widens it beyond the QA team.
    """
    start_date, end_date = _get_quarter_date_range(quarter)

    results = await asyncio.gather(
        _get_executive_bug_metrics(start_date, end_date, project, quarter=quarter),
        _get_executive_velocity_metrics(start_date, end_date, project),
        _get_executive_pr_metrics(start_date, end_date, project),
        _get_executive_defect_trend(start_date, end_date, project),
        _get_executive_pr_trend(start_date, end_date, project),
        _get_executive_velocity_trend(start_date, end_date, project),
        _get_executive_team_contributions(start_date, end_date, project),
        _get_executive_story_points_by_member(start_date, end_date, project),
        _get_executive_review_trend(start_date, end_date, project),
        _get_executive_top_reviewers(start_date, end_date, project),
        return_exceptions=True
    )

    bug_metrics = results[0] if not isinstance(results[0], Exception) else {}
    velocity_metrics = results[1] if not isinstance(results[1], Exception) else {}
    pr_metrics = results[2] if not isinstance(results[2], Exception) else {}
    defect_trend = results[3] if not isinstance(results[3], Exception) else []
    pr_trend = results[4] if not isinstance(results[4], Exception) else []
    velocity_trend = results[5] if not isinstance(results[5], Exception) else []
    team_contributions = results[6] if not isinstance(results[6], Exception) else []
    story_points_by_member = results[7] if not isinstance(results[7], Exception) else []
    review_trend = results[8] if not isinstance(results[8], Exception) else []
    top_reviewers = results[9] if not isinstance(results[9], Exception) else []

    # ReportPortal automation health — read from snapshot, fall back live.
    automation_health = await _get_automation_health(quarter, project)

    return ExecutiveMetrics(
        # Quality
        open_bugs=bug_metrics.get("open_bugs", 0),
        resolved_bugs=bug_metrics.get("resolved_bugs", 0),
        bugs_fixed_by_qa=bug_metrics.get("bugs_fixed_by_qa", 0),
        critical_bugs=bug_metrics.get("critical_bugs", 0),
        bug_resolution_rate=bug_metrics.get("resolution_rate"),
        defect_density=None,  # Calculated elsewhere if needed

        # Velocity
        story_points_completed=velocity_metrics.get("completed_points", 0),
        story_points_in_progress=velocity_metrics.get("in_progress_points", 0),
        tickets_completed=velocity_metrics.get("tickets_completed", 0),
        avg_cycle_time_hours=velocity_metrics.get("avg_cycle_time_hours"),

        # PR & Reviews
        prs_merged=pr_metrics.get("prs_merged", 0),
        prs_opened=pr_metrics.get("prs_opened", 0),
        total_reviews=pr_metrics.get("total_reviews", 0),
        avg_pr_merge_time_hours=pr_metrics.get("avg_pr_merge_time_hours"),

        # Trends
        defect_trend=defect_trend,
        pr_trend=pr_trend,
        velocity_trend=velocity_trend,
        review_trend=review_trend,
        automation_health=automation_health,

        # Breakdowns
        team_contributions=team_contributions,
        story_points_by_member=story_points_by_member,
        top_reviewers=top_reviewers
    )
