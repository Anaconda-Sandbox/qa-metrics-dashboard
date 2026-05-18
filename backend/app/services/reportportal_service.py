import logging
from collections import defaultdict

import httpx

from app.config import get_settings
from app.models.metrics import (
    FlakyTest,
    FlakyTestsResponse,
    LaunchItem,
    LaunchListResponse,
    LaunchStats,
    PassRateTrendItem,
    PassRateTrendResponse,
)
from app.services import cache_service

logger = logging.getLogger(__name__)


def _headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "Authorization": f"Bearer {settings.reportportal_api_token}",
        "Accept": "application/json",
    }


def _base_url() -> str:
    settings = get_settings()
    return f"{settings.reportportal_base_url}/api/v1/{settings.reportportal_project}"


async def get_launches(limit: int = 10, use_cache: bool = True) -> LaunchListResponse:
    cache_key = "launches"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return LaunchListResponse(**cached)

    try:
        url = f"{_base_url()}/launch"
        params = {"page.size": limit, "page.sort": "startTime,DESC"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=_headers(), params=params)
            resp.raise_for_status()
            data = resp.json()

        launches = []
        for item in data.get("content", []):
            stats = item.get("statistics", {}).get("executions", {})
            launches.append(LaunchItem(
                name=item.get("name", "Unknown"),
                status=item.get("status", "UNKNOWN"),
                start_time=item.get("startTime", ""),
                total=int(stats.get("total", 0)),
                passed=int(stats.get("passed", 0)),
                failed=int(stats.get("failed", 0)),
                skipped=int(stats.get("skipped", 0)),
            ))

        result = LaunchListResponse(launches=launches)
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"ReportPortal API error in get_launches: {e}")
        raise


async def get_stats(use_cache: bool = True) -> LaunchStats:
    cache_key = "reportportal_stats"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return LaunchStats(**cached)

    try:
        launches_resp = await get_launches(limit=10, use_cache=False)
        launches = launches_resp.launches

        if not launches:
            return LaunchStats()

        total_tests = sum(l.total for l in launches)
        total_passed = sum(l.passed for l in launches)
        total_failed = sum(l.failed for l in launches)
        total_skipped = sum(l.skipped for l in launches)
        avg_pass_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0.0

        result = LaunchStats(
            total_launches=len(launches),
            last_launch_status=launches[0].status if launches else "UNKNOWN",
            avg_pass_rate=round(avg_pass_rate, 1),
            total_tests_run=total_tests,
            total_failed=total_failed,
            total_passed=total_passed,
            total_skipped=total_skipped,
        )
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"ReportPortal API error in get_stats: {e}")
        raise


async def get_flaky_tests(limit: int = 20, use_cache: bool = True) -> FlakyTestsResponse:
    cache_key = "flaky_tests"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return FlakyTestsResponse(**cached)

    try:
        launches_resp = await get_launches(limit=5, use_cache=False)
        launches = launches_resp.launches

        if not launches:
            return FlakyTestsResponse()

        test_results: dict[str, dict] = defaultdict(lambda: {"failures": 0, "runs": 0, "last_seen": ""})

        async with httpx.AsyncClient(timeout=30.0) as client:
            for launch in launches:
                url = f"{_base_url()}/item"
                params = {
                    "filter.eq.launchId": launch.name,
                    "filter.eq.type": "STEP",
                    "filter.eq.status": "FAILED",
                    "page.size": 100,
                }
                try:
                    resp = await client.get(url, headers=_headers(), params=params)
                    resp.raise_for_status()
                    data = resp.json()

                    for item in data.get("content", []):
                        name = item.get("name", "Unknown test")
                        test_results[name]["failures"] += 1
                        test_results[name]["runs"] += 1
                        end_time = item.get("endTime", launch.start_time)
                        if end_time > test_results[name]["last_seen"]:
                            test_results[name]["last_seen"] = end_time
                except httpx.HTTPError:
                    continue

            for launch in launches:
                url = f"{_base_url()}/item"
                params = {
                    "filter.eq.launchId": launch.name,
                    "filter.eq.type": "STEP",
                    "filter.eq.status": "PASSED",
                    "page.size": 100,
                }
                try:
                    resp = await client.get(url, headers=_headers(), params=params)
                    resp.raise_for_status()
                    data = resp.json()

                    for item in data.get("content", []):
                        name = item.get("name", "Unknown test")
                        if name in test_results:
                            test_results[name]["runs"] += 1
                except httpx.HTTPError:
                    continue

        flaky_tests = []
        for name, stats in test_results.items():
            if stats["failures"] >= 2:
                rate = (stats["failures"] / stats["runs"] * 100) if stats["runs"] > 0 else 0
                flaky_tests.append(FlakyTest(
                    name=name,
                    failure_count=stats["failures"],
                    total_runs=stats["runs"],
                    flakiness_rate=round(rate, 1),
                    last_seen=stats["last_seen"],
                ))

        flaky_tests.sort(key=lambda t: t.flakiness_rate, reverse=True)
        flaky_tests = flaky_tests[:limit]

        result = FlakyTestsResponse(tests=flaky_tests, total=len(flaky_tests))
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"ReportPortal API error in get_flaky_tests: {e}")
        raise


async def get_pass_rate_trend(use_cache: bool = True) -> PassRateTrendResponse:
    cache_key = "pass_rate_trend"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return PassRateTrendResponse(**cached)

    try:
        launches_resp = await get_launches(limit=10, use_cache=False)
        launches = launches_resp.launches

        trend = []
        for launch in reversed(launches):
            pass_rate = (launch.passed / launch.total * 100) if launch.total > 0 else 0
            trend.append(PassRateTrendItem(
                name=launch.name,
                date=launch.start_time[:10] if launch.start_time else "",
                pass_rate=round(pass_rate, 1),
                total=launch.total,
            ))

        result = PassRateTrendResponse(launches=trend)
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"ReportPortal API error in get_pass_rate_trend: {e}")
        raise
