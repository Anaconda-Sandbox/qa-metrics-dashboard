import logging

from fastapi import APIRouter, Query

from app.config import ALL_QA_MEMBERS, GITHUB_TO_JIRA_NAME
from app.models.metrics import MemberActivityResponse
from app.services import member_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("/list")
async def list_members():
    return {
        "members": [
            {"github": m, "name": GITHUB_TO_JIRA_NAME.get(m, m)}
            for m in sorted(ALL_QA_MEMBERS, key=lambda x: GITHUB_TO_JIRA_NAME.get(x, x))
        ]
    }


@router.get("/qa-team")
async def qa_team():
    """Live QA team roster from Jira group `QA`.

    Read path: latest MetricSnapshot row (refreshed hourly). Falls back to
    a live Jira call if no snapshot is available. Manager comes from DX
    team.lead — Jira's group endpoint doesn't expose a manager flag.
    """
    from app.database import SessionLocal
    from app.services import snapshot_service, jira_service
    db = SessionLocal()
    try:
        snap = snapshot_service.get_latest_qa_roster(db)
    finally:
        db.close()
    if snap:
        return {
            "manager": snap.get("manager"),
            "members": snap.get("members") or [],
            "count": snap.get("count", len(snap.get("members") or [])),
            "snapshot_date": snap.get("snapshot_date"),
            "source": "snapshot",
        }
    # Fallback: live Jira call (no manager — DX team.lead lookup failed too)
    members = await jira_service.get_qa_team_roster()
    return {"manager": None, "members": members, "count": len(members), "source": "live"}


@router.get("/activity/{username}", response_model=MemberActivityResponse)
async def member_activity(
    username: str,
    days: int = Query(default=30, le=90),
):
    try:
        return await member_service.get_member_activity(username=username, days=days)
    except Exception as e:
        logger.error(f"Error fetching member activity for {username}: {e}")
        return {"error": str(e), "data": None}
