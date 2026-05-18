import logging

from fastapi import APIRouter, Query

from app.models.metrics import (
    FlakyTestsResponse,
    LaunchListResponse,
    LaunchStats,
    PassRateTrendResponse,
)
from app.services import reportportal_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reportportal", tags=["reportportal"])


@router.get("/launches", response_model=LaunchListResponse)
async def launches(limit: int = Query(default=10, le=50)):
    try:
        return await reportportal_service.get_launches(limit=limit)
    except Exception as e:
        logger.error(f"Error fetching launches: {e}")
        return {"error": str(e), "data": None}


@router.get("/stats", response_model=LaunchStats)
async def stats():
    try:
        return await reportportal_service.get_stats()
    except Exception as e:
        logger.error(f"Error fetching ReportPortal stats: {e}")
        return {"error": str(e), "data": None}


@router.get("/flaky-tests", response_model=FlakyTestsResponse)
async def flaky_tests(limit: int = Query(default=20, le=50)):
    try:
        return await reportportal_service.get_flaky_tests(limit=limit)
    except Exception as e:
        logger.error(f"Error fetching flaky tests: {e}")
        return {"error": str(e), "data": None}


@router.get("/pass-rate-trend", response_model=PassRateTrendResponse)
async def pass_rate_trend():
    try:
        return await reportportal_service.get_pass_rate_trend()
    except Exception as e:
        logger.error(f"Error fetching pass rate trend: {e}")
        return {"error": str(e), "data": None}
