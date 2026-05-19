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
    item_name: str
    item_type: str  # 'kpi' or 'factor'
    score: float | None
    response_count: int
    vs_prev: float | None
    vs_org: float | None
    vs_50th: float | None
    vs_75th: float | None


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

        if response.status_code != 200:
            logger.error(f"DX API error: {response.status_code} - {response.text[:200]}")
            return {"ok": False, "error": f"HTTP {response.status_code}"}

        return response.json()


async def _run_sql_query(sql: str, timeout_seconds: int = 30) -> list[dict]:
    """Execute SQL query against DX Data Cloud and return results."""
    result = await _make_dx_request("POST", "studio.queryRuns.execute", json_data={"sql": sql})

    if not result.get("ok"):
        logger.error(f"Failed to execute query: {result.get('error')}")
        return []

    query_id = result["query_run"]["id"]

    # Poll for results
    for _ in range(timeout_seconds):
        await asyncio.sleep(1)
        results = await _make_dx_request("GET", f"studio.queryRuns.results?id={query_id}")

        if results.get("ok") and results.get("results"):
            columns = results["results"]["columns"]
            rows = results["results"]["rows"]
            return [dict(zip(columns, row)) for row in rows]

        if results.get("error") == "not_found":
            continue  # Still processing

        if results.get("error"):
            logger.error(f"Query error: {results.get('error')}")
            return []

    logger.warning(f"Query timed out after {timeout_seconds}s")
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
