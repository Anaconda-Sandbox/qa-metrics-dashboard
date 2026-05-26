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
    """Build auth headers for RP. Behind Cloudflare Zero Trust we also need
    CF-Access-Client-Id / CF-Access-Client-Secret service-token headers.
    Both are sent on every request; CF strips them before passing to RP."""
    settings = get_settings()
    h = {
        "Authorization": f"Bearer {settings.reportportal_api_token}",
        "Accept": "application/json",
    }
    if settings.cf_access_client_id and settings.cf_access_client_secret:
        h["CF-Access-Client-Id"] = settings.cf_access_client_id
        h["CF-Access-Client-Secret"] = settings.cf_access_client_secret
    return h


def _base_url(project: str | None = None) -> str:
    settings = get_settings()
    p = project or settings.reportportal_project
    return f"{settings.reportportal_base_url}/api/v1/{p}"


def _projects_list() -> list[str]:
    """Return the list of RP project names to aggregate over.

    Reads REPORTPORTAL_PROJECTS (comma-separated) from settings; falls back
    to the single REPORTPORTAL_PROJECT setting if the list is empty.
    """
    settings = get_settings()
    raw = (settings.reportportal_projects or "").strip()
    if raw:
        return [p.strip() for p in raw.split(",") if p.strip()]
    return [settings.reportportal_project] if settings.reportportal_project else []


def _quarter_iso_bounds(quarter: str) -> tuple[str, str]:
    """Return (start_iso, end_iso) ISO-8601 strings for a quarter like '2026-Q2'.

    RP launch filter expects millisecond epochs *or* ISO; we use ISO Z form.
    """
    from datetime import datetime
    year_str, q_str = quarter.split("-Q")
    year, q = int(year_str), int(q_str)
    start_month = (q - 1) * 3 + 1
    start = datetime(year, start_month, 1)
    end = datetime(year + 1, 1, 1) if q == 4 else datetime(year, start_month + 3, 1)
    return start.strftime("%Y-%m-%dT00:00:00.000Z"), end.strftime("%Y-%m-%dT00:00:00.000Z")


async def _fetch_launches_for_quarter(client: httpx.AsyncClient, project: str, start_iso: str, end_iso: str) -> list[dict]:
    """Fetch all main-branch launches for a project that started in the quarter.

    Anaconda's repos tag launches inconsistently: most use `branch:main`, but
    anaconda-desktop uses `current_branch:main`. We run both filtered queries
    and merge by launch id so neither convention is missed.

    Pages through results; capped at 500 launches per project per attribute key.
    """
    from datetime import datetime
    start_ms = int(datetime.strptime(start_iso, "%Y-%m-%dT%H:%M:%S.%fZ").timestamp() * 1000)
    end_ms = int(datetime.strptime(end_iso, "%Y-%m-%dT%H:%M:%S.%fZ").timestamp() * 1000)

    merged: dict[int, dict] = {}
    for attr_key in ("branch", "current_branch"):
        page = 1
        page_size = 100
        fetched = 0
        while fetched < 500:
            params = {
                "filter.btw.startTime": f"{start_ms},{end_ms}",
                "filter.has.compositeAttribute": f"{attr_key}:main",
                "page.size": page_size,
                "page.page": page,
                "page.sort": "startTime,DESC",
            }
            try:
                resp = await client.get(f"{_base_url(project)}/launch", headers=_headers(), params=params)
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPError as e:
                logger.warning(f"RP fetch failed for {project} attr={attr_key} page {page}: {e}")
                break
            content = data.get("content", []) or []
            for L in content:
                lid = L.get("id")
                if lid is not None:
                    merged[lid] = L  # dedupe across attribute keys
            fetched += len(content)
            total_pages = (data.get("page") or {}).get("totalPages", 1)
            if page >= total_pages or not content:
                break
            page += 1

    return list(merged.values())


def _project_metrics_from_launches(project: str, launches: list[dict]) -> dict:
    """Compute pass_rate, avg_duration_sec, totals for one project's launches."""
    total_tests = 0
    total_passed = 0
    total_failed = 0
    total_skipped = 0
    durations: list[float] = []
    for L in launches:
        stats = ((L.get("statistics") or {}).get("executions") or {})
        total_tests += int(stats.get("total") or 0)
        total_passed += int(stats.get("passed") or 0)
        total_failed += int(stats.get("failed") or 0)
        total_skipped += int(stats.get("skipped") or 0)
        # approximateDuration is in seconds (float). Fallback to end-start if missing.
        d = L.get("approximateDuration")
        if d is None:
            try:
                from datetime import datetime
                s = datetime.strptime(L.get("startTime", ""), "%Y-%m-%dT%H:%M:%S.%fZ")
                e = datetime.strptime(L.get("endTime", ""), "%Y-%m-%dT%H:%M:%S.%fZ")
                d = (e - s).total_seconds()
            except (ValueError, TypeError):
                d = None
        if d is not None and d >= 0:
            durations.append(float(d))
    pass_rate = round((total_passed / total_tests) * 100, 2) if total_tests else 0.0
    avg_dur = round(sum(durations) / len(durations), 1) if durations else 0.0
    return {
        "project": project,
        "launches": len(launches),
        "total_tests": total_tests,
        "total_passed": total_passed,
        "total_failed": total_failed,
        "total_skipped": total_skipped,
        "pass_rate_pct": pass_rate,
        "avg_duration_sec": avg_dur,
    }


async def _flaky_pct_for_project(client: httpx.AsyncClient, project: str, launches: list[dict]) -> float:
    """Compute flakiness % for one project using the test-item endpoint.

    Flaky test = same test (by name) appears as both PASSED and FAILED across
    the given launches. flakiness_pct = flaky_unique_tests / total_unique_tests * 100.

    Only meaningful when len(launches) >= 5; caller should gate.
    """
    from collections import defaultdict
    statuses_by_test: dict[str, set[str]] = defaultdict(set)

    # Sample at most 30 launches to bound the API cost
    for L in launches[:30]:
        launch_id = L.get("id")
        if launch_id is None:
            continue
        page = 1
        while True:
            params = {
                "filter.eq.launchId": launch_id,
                "filter.eq.type": "STEP",
                "page.size": 200,
                "page.page": page,
            }
            try:
                resp = await client.get(f"{_base_url(project)}/item", headers=_headers(), params=params)
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPError as e:
                logger.warning(f"RP /item fetch failed for {project} launch {launch_id} page {page}: {e}")
                break
            for item in data.get("content", []) or []:
                name = item.get("name") or ""
                status = item.get("status") or ""
                if name and status in ("PASSED", "FAILED"):
                    statuses_by_test[name].add(status)
            total_pages = (data.get("page") or {}).get("totalPages", 1)
            if page >= total_pages:
                break
            page += 1
            if page > 5:  # safety cap per launch
                break

    if not statuses_by_test:
        return 0.0
    flaky = sum(1 for statuses in statuses_by_test.values() if {"PASSED", "FAILED"}.issubset(statuses))
    total = len(statuses_by_test)
    return round((flaky / total) * 100, 2) if total else 0.0


async def get_automation_metrics_for_quarter(quarter: str, include_flaky: bool = True) -> dict:
    """Aggregate ReportPortal automation metrics for one quarter.

    Returns:
      {
        "quarter": "2026-Q2",
        "overall": {pass_rate_pct, avg_duration_sec, total_launches, total_tests, total_passed},
        "by_project": [
          {project, launches, pass_rate_pct, avg_duration_sec, flaky_pct, total_tests, ...},
          ...
        ],
      }

    Flaky % is only computed for projects with >= 5 launches (per QA-171 AC).
    """
    start_iso, end_iso = _quarter_iso_bounds(quarter)
    projects = _projects_list()
    by_project: list[dict] = []
    overall_tests = 0
    overall_passed = 0
    overall_durations: list[float] = []
    overall_launches = 0

    timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for project in projects:
            try:
                launches = await _fetch_launches_for_quarter(client, project, start_iso, end_iso)
            except Exception as e:
                logger.warning(f"RP launches fetch failed for {project}: {e}")
                launches = []

            metrics = _project_metrics_from_launches(project, launches)
            metrics["flaky_pct"] = None
            if include_flaky and metrics["launches"] >= 5:
                try:
                    metrics["flaky_pct"] = await _flaky_pct_for_project(client, project, launches)
                except Exception as e:
                    logger.warning(f"Flaky calc failed for {project}: {e}")
                    metrics["flaky_pct"] = None
            by_project.append(metrics)

            overall_tests += metrics["total_tests"]
            overall_passed += metrics["total_passed"]
            overall_launches += metrics["launches"]
            if metrics["avg_duration_sec"]:
                overall_durations.append(metrics["avg_duration_sec"])

    overall = {
        "pass_rate_pct": round((overall_passed / overall_tests) * 100, 2) if overall_tests else 0.0,
        "avg_duration_sec": round(sum(overall_durations) / len(overall_durations), 1) if overall_durations else 0.0,
        "total_launches": overall_launches,
        "total_tests": overall_tests,
        "total_passed": overall_passed,
    }
    by_project.sort(key=lambda m: m["pass_rate_pct"], reverse=True)
    return {"quarter": quarter, "overall": overall, "by_project": by_project}


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
