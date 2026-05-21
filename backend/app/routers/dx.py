"""
DX API Router - Endpoints for Developer Experience metrics
"""
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from app.services import dx_service
from app.database import get_db

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
    quarter: str = Query(..., description="Quarter in format YYYY-QN, e.g., 2026-Q2"),
    refresh: bool = Query(False, description="Force refresh from DX API"),
    db: Session = Depends(get_db)
):
    """Get DX metrics for a specific quarter (uses DB cache)."""
    data = await dx_service.sync_dx_data_for_quarter(db, quarter, force=refresh)
    return data


@router.get("/metrics/all")
async def get_all_metrics(
    quarter: str = Query(..., description="Quarter in format YYYY-QN"),
    db: Session = Depends(get_db)
):
    """Get comprehensive DX metrics including team scores."""
    data = await dx_service.sync_dx_data_for_quarter(db, quarter)
    return data


@router.get("/dora")
async def get_dora_metrics(
    quarter: str = Query(..., description="Quarter in format YYYY-QN")
):
    """Get DORA metrics for a specific quarter."""
    dora = await dx_service.get_dora_metrics_for_quarter(quarter)
    return dora.model_dump()


@router.get("/qa-metrics")
async def get_qa_data_cloud_metrics(
    quarter: str = Query(..., description="Quarter in format YYYY-QN"),
    refresh: bool = Query(False, description="Force refresh from DX Data Cloud"),
    db: Session = Depends(get_db)
):
    """Get QA metrics from DX Data Cloud (uses DB cache, 6hr TTL)."""
    metrics = await dx_service.sync_qa_cloud_metrics(db, quarter, force=refresh)
    return metrics.model_dump()


@router.get("/executive")
async def get_executive_dashboard(
    quarter: str = Query(..., description="Quarter in format YYYY-QN")
):
    """
    Get executive dashboard metrics from DX Data Cloud.
    This is the single-source-of-truth endpoint for the main dashboard.
    All data comes from DX Data Cloud (no direct GitHub/Jira API calls).
    """
    metrics = await dx_service.get_executive_dashboard_metrics(quarter)
    return metrics.model_dump()


@router.get("/compare")
async def compare_quarters(
    quarter1: str = Query(..., description="First quarter (current)"),
    quarter2: str = Query(..., description="Second quarter (previous)"),
    db: Session = Depends(get_db)
):
    """Compare DX metrics between two quarters (uses DB cache)."""
    # Sync both quarters to DB first
    await dx_service.sync_dx_data_for_quarter(db, quarter1)
    await dx_service.sync_dx_data_for_quarter(db, quarter2)

    # Then compare
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
    compare_quarter: str = Query(None, description="Optional quarter to compare against"),
    refresh: bool = Query(False, description="Force refresh from DX API"),
    db: Session = Depends(get_db)
):
    """Get complete dashboard data for DX metrics page (uses DB cache)."""
    # All data is now cached in DB - should be instant after first load

    # Get current quarter data from DB (with sync if needed)
    cached_data = await dx_service.sync_dx_data_for_quarter(db, quarter, force=refresh)

    # Get DORA metrics (cached in DB, 6hr TTL)
    dora = await dx_service.get_cached_dora_metrics(db, quarter, force=refresh)

    # Get team info (cached in DB, 24hr TTL)
    team = await dx_service.get_cached_team_info(db, force=refresh)

    # Get benchmarks if snapshot exists (cached in DB, 24hr TTL)
    benchmarks = None
    if cached_data.get("snapshot"):
        benchmarks = await dx_service.get_cached_benchmarks(db, cached_data["snapshot"]["id"], force=refresh)

    # QA Data Cloud metrics are fetched separately via /api/dx/qa-metrics endpoint
    # to avoid blocking the dashboard load (those queries take 60+ seconds)

    response = {
        "quarter": quarter,
        "snapshot": cached_data.get("snapshot"),
        "metrics": cached_data.get("metrics"),
        "dora": dora.model_dump(),
        "qa_cloud_metrics": None,  # Fetched separately via /api/dx/qa-metrics
        "pr_metrics": None,  # Can be added later from DB
        "team": team.model_dump() if team else None,
        "benchmarks": benchmarks,
        "qa_scores": cached_data.get("qa_scores", []),
        "comparison": None,
        "from_cache": cached_data.get("from_cache", False),
        "last_updated": cached_data.get("last_updated")
    }

    # Add comparison if requested
    if compare_quarter:
        await dx_service.sync_dx_data_for_quarter(db, compare_quarter)
        comparison = await dx_service.compare_quarters(quarter, compare_quarter)
        response["comparison"] = comparison

    return response


@router.post("/sync")
async def sync_dx_data(
    quarter: str = Query(..., description="Quarter to sync"),
    db: Session = Depends(get_db)
):
    """Force sync DX data from API to database."""
    result = await dx_service.sync_dx_data_for_quarter(db, quarter, force=True)
    return {
        "status": "synced",
        "quarter": quarter,
        "from_cache": result.get("from_cache", False),
        "last_updated": result.get("last_updated")
    }
