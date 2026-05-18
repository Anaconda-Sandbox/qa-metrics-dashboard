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
