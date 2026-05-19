"""
DX API Router - Endpoints for Developer Experience metrics
"""
from fastapi import APIRouter, Query
from app.services import dx_service

router = APIRouter(prefix="/api/dx", tags=["dx"])


@router.get("/health")
async def dx_health():
    """Check DX API connectivity."""
    try:
        snapshots = await dx_service.get_snapshots()
        return {
            "status": "ok",
            "connected": True,
            "snapshot_count": len(snapshots),
            "latest_snapshot": snapshots[0].scheduled_for if snapshots else None
        }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "error": str(e)
        }


@router.get("/snapshots")
async def list_snapshots():
    """Get all DX survey snapshots."""
    snapshots = await dx_service.get_snapshots()
    return {
        "snapshots": [s.model_dump() for s in snapshots],
        "count": len(snapshots)
    }


@router.get("/team")
async def get_team_info():
    """Get QA team information from DX."""
    team = await dx_service.get_team_info()
    return team.model_dump() if team else {"error": "Team not found"}


@router.get("/teams")
async def list_teams():
    """Get all teams from DX."""
    teams = await dx_service.get_all_teams()
    return {"teams": teams, "count": len(teams)}


@router.get("/metrics")
async def get_quarterly_metrics(
    quarter: str = Query(..., description="Quarter in format YYYY-QN, e.g., 2026-Q2")
):
    """Get DX metrics for a specific quarter."""
    data = await dx_service.get_quarterly_dx_data(quarter)
    return {
        "quarter": quarter,
        "snapshot": data.snapshot.model_dump() if data.snapshot else None,
        "metrics": data.metrics.model_dump(),
        "pr_metrics": data.pr_metrics.model_dump() if data.pr_metrics else None,
        "team_scores_count": len(data.team_scores)
    }


@router.get("/metrics/all")
async def get_all_metrics(
    quarter: str = Query(..., description="Quarter in format YYYY-QN")
):
    """Get comprehensive DX metrics including team scores."""
    data = await dx_service.get_quarterly_dx_data(quarter)

    # Filter for QA team scores
    qa_scores = [s.model_dump() for s in data.team_scores if s.team_name == "QA"]

    return {
        "quarter": quarter,
        "snapshot": data.snapshot.model_dump() if data.snapshot else None,
        "metrics": data.metrics.model_dump(),
        "pr_metrics": data.pr_metrics.model_dump() if data.pr_metrics else None,
        "qa_scores": qa_scores,
        "all_teams_scores": [s.model_dump() for s in data.team_scores]
    }


@router.get("/dora")
async def get_dora_metrics(
    quarter: str = Query(..., description="Quarter in format YYYY-QN")
):
    """Get DORA metrics for a specific quarter."""
    dora = await dx_service.get_dora_metrics_for_quarter(quarter)
    return dora.model_dump()


@router.get("/compare")
async def compare_quarters(
    quarter1: str = Query(..., description="First quarter (current)"),
    quarter2: str = Query(..., description="Second quarter (previous)")
):
    """Compare DX metrics between two quarters."""
    comparison = await dx_service.compare_quarters(quarter1, quarter2)
    return comparison


@router.get("/benchmarks")
async def get_benchmarks(
    snapshot_id: str = Query(None, description="Specific snapshot ID, or uses latest")
):
    """Get organization benchmarks for metrics."""
    if not snapshot_id:
        snapshots = await dx_service.get_snapshots()
        if not snapshots:
            return {"error": "No snapshots available"}
        snapshot_id = snapshots[0].id

    benchmarks = await dx_service.get_org_benchmarks(snapshot_id)
    return {
        "snapshot_id": snapshot_id,
        "benchmarks": benchmarks
    }


@router.get("/scores/{snapshot_id}")
async def get_snapshot_scores(snapshot_id: str):
    """Get detailed scores for a specific snapshot."""
    scores = await dx_service.get_snapshot_scores(snapshot_id)

    # Group by team
    by_team: dict[str, list] = {}
    for score in scores:
        team = score.team_name
        if team not in by_team:
            by_team[team] = []
        by_team[team].append(score.model_dump())

    return {
        "snapshot_id": snapshot_id,
        "total_scores": len(scores),
        "teams": list(by_team.keys()),
        "scores_by_team": by_team
    }


@router.get("/dashboard")
async def get_dashboard_data(
    quarter: str = Query(..., description="Quarter in format YYYY-QN"),
    compare_quarter: str = Query(None, description="Optional quarter to compare against")
):
    """Get complete dashboard data for DX metrics page."""
    # Get current quarter data
    current_data = await dx_service.get_quarterly_dx_data(quarter)

    # Get DORA metrics
    dora = await dx_service.get_dora_metrics_for_quarter(quarter)

    # Get team info
    team = await dx_service.get_team_info()

    # Get benchmarks if snapshot exists
    benchmarks = None
    if current_data.snapshot:
        benchmarks = await dx_service.get_org_benchmarks(current_data.snapshot.id)

    response = {
        "quarter": quarter,
        "snapshot": current_data.snapshot.model_dump() if current_data.snapshot else None,
        "metrics": current_data.metrics.model_dump(),
        "dora": dora.model_dump(),
        "pr_metrics": current_data.pr_metrics.model_dump() if current_data.pr_metrics else None,
        "team": team.model_dump() if team else None,
        "benchmarks": benchmarks,
        "qa_scores": [s.model_dump() for s in current_data.team_scores if s.team_name == "QA"],
        "comparison": None
    }

    # Add comparison if requested
    if compare_quarter:
        comparison = await dx_service.compare_quarters(quarter, compare_quarter)
        response["comparison"] = comparison

    return response
