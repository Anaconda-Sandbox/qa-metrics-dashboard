import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import httpx

from app.config import get_settings, ALL_QA_MEMBERS
from app.models.metrics import (
    MemberContribution,
    PRItem,
    PRStats,
    PRTrend,
    PRTrendsResponse,
    RecentPRsResponse,
    ReviewerStats,
    TeamContributionResponse,
    TeamReviewStatsResponse,
)
from app.services import cache_service

logger = logging.getLogger(__name__)


def _headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _filter_by_members(prs: list[dict], members: list[str]) -> list[dict]:
    team = set(m.lower() for m in members)
    return [pr for pr in prs if pr.get("user", {}).get("login", "").lower() in team]


async def _fetch_prs_for_repo(client: httpx.AsyncClient, org: str, repo: str) -> list[dict]:
    prs = []
    page = 1
    while True:
        url = f"https://api.github.com/repos/{org}/{repo}/pulls"
        params = {"state": "all", "per_page": 100, "page": page}
        resp = await client.get(url, headers=_headers(), params=params)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break
        for pr in data:
            pr["_repo"] = repo
        prs.extend(data)
        if len(data) < 100:
            break
        page += 1
        if page > 5:
            break
    return prs


async def _fetch_all_prs(squad: str | None, project: str | None) -> list[dict]:
    settings = get_settings()
    repos = settings.repos_for_filter(squad, project)
    members = settings.members_for_filter(squad, project)
    all_prs: list[dict] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for i, repo in enumerate(repos):
            try:
                prs = await _fetch_prs_for_repo(client, settings.github_org, repo)
                all_prs.extend(prs)
                if i < len(repos) - 1:
                    await asyncio.sleep(1)  # Rate limit protection
            except httpx.HTTPError as e:
                logger.error(f"GitHub API error fetching PRs for {repo}: {e}")
                continue

    return _filter_by_members(all_prs, members)


async def get_pr_trends(squad: str | None = None, project: str | None = None, quarter: str | None = None, use_cache: bool = True) -> PRTrendsResponse:
    cache_key = f"pr_trends:{squad}:{project}:{quarter}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return PRTrendsResponse(**cached)

    try:
        all_prs = await _fetch_all_prs(squad, project)

        start_date, end_date, _ = _get_quarter_dates(quarter)

        weekly_opened: dict[str, int] = defaultdict(int)
        weekly_merged: dict[str, int] = defaultdict(int)

        for pr in all_prs:
            created = pr.get("created_at", "")
            if created:
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                if start_date <= created_dt <= end_date:
                    week = created_dt.strftime("%G-W%V")
                    weekly_opened[week] += 1

            merged = pr.get("merged_at")
            if merged:
                merged_dt = datetime.fromisoformat(merged.replace("Z", "+00:00"))
                if start_date <= merged_dt <= end_date:
                    week = merged_dt.strftime("%G-W%V")
                    weekly_merged[week] += 1

        all_weeks = set()
        all_weeks.update(weekly_opened.keys())
        all_weeks.update(weekly_merged.keys())

        trends = []
        for week in sorted(all_weeks):
            trends.append(PRTrend(
                week=week,
                opened=weekly_opened.get(week, 0),
                merged=weekly_merged.get(week, 0),
                reviewed=0,
            ))

        result = PRTrendsResponse(trends=trends[-12:])
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"GitHub API error in get_pr_trends: {e}")
        raise


async def get_pr_stats(squad: str | None = None, project: str | None = None, quarter: str | None = None, use_cache: bool = True) -> PRStats:
    cache_key = f"pr_stats:{squad}:{project}:{quarter}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return PRStats(**cached)

    try:
        settings = get_settings()
        all_prs = await _fetch_all_prs(squad, project)
        repos = settings.repos_for_filter(squad, project)

        start_date, end_date, _ = _get_quarter_dates(quarter)

        total_count = 0
        merged_count = 0
        review_turnarounds: list[float] = []

        for pr in all_prs:
            created = pr.get("created_at", "")
            if not created:
                continue
            created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            if not (start_date <= created_dt <= end_date):
                continue

            total_count += 1
            if pr.get("merged_at"):
                merged_count += 1
                merged_dt = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
                turnaround = (merged_dt - created_dt).total_seconds() / 3600
                review_turnarounds.append(turnaround)

        avg_turnaround = (
            round(sum(review_turnarounds) / len(review_turnarounds), 1)
            if review_turnarounds
            else 0.0
        )

        result = PRStats(
            total_prs_last_30d=total_count,
            merged_prs_last_30d=merged_count,
            avg_review_turnaround_hours=avg_turnaround,
            repos=repos,
        )
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"GitHub API error in get_pr_stats: {e}")
        raise


async def get_recent_prs(limit: int = 10, squad: str | None = None, project: str | None = None, use_cache: bool = True) -> RecentPRsResponse:
    cache_key = f"recent_prs:{squad}:{project}:{limit}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return RecentPRsResponse(**cached)

    try:
        settings = get_settings()
        repos = settings.repos_for_filter(squad, project)
        members = settings.members_for_filter(squad, project)
        all_prs: list[dict] = []

        async with httpx.AsyncClient(timeout=30.0) as client:
            for repo in repos:
                try:
                    url = f"https://api.github.com/repos/{settings.github_org}/{repo}/pulls"
                    params = {"state": "all", "per_page": 50, "sort": "created", "direction": "desc"}
                    resp = await client.get(url, headers=_headers(), params=params)
                    resp.raise_for_status()
                    data = resp.json()
                    for pr in data:
                        pr["_repo"] = repo
                    all_prs.extend(data)
                except httpx.HTTPError as e:
                    logger.error(f"GitHub API error fetching recent PRs for {repo}: {e}")
                    continue

        all_prs = _filter_by_members(all_prs, members)
        all_prs.sort(key=lambda p: p.get("created_at", ""), reverse=True)
        all_prs = all_prs[:limit]

        items = []
        for pr in all_prs:
            items.append(PRItem(
                title=pr.get("title", ""),
                number=pr.get("number", 0),
                state=pr.get("state", "unknown"),
                repo=pr.get("_repo", ""),
                author=pr.get("user", {}).get("login", "unknown"),
                created_at=pr.get("created_at", ""),
                merged_at=pr.get("merged_at"),
                url=pr.get("html_url", ""),
            ))

        result = RecentPRsResponse(prs=items, total=len(items))
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"GitHub API error in get_recent_prs: {e}")
        raise


async def get_team_contributions(squad: str | None = None, project: str | None = None, quarter: str | None = None, use_cache: bool = True) -> TeamContributionResponse:
    cache_key = f"team_contributions:{squad}:{project}:{quarter}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return TeamContributionResponse(**cached)

    try:
        all_prs = await _fetch_all_prs(squad, project)

        start_date, end_date, _ = _get_quarter_dates(quarter)
        all_prs = [
            pr for pr in all_prs
            if pr.get("created_at") and
               start_date <= datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00")) <= end_date
        ]

        member_data: dict[str, dict] = defaultdict(lambda: {
            "prs_opened": 0, "prs_merged": 0,
            "turnarounds": [], "repos": defaultdict(int)
        })

        for pr in all_prs:
            author = pr.get("user", {}).get("login", "unknown")
            repo = pr.get("_repo", "")
            member_data[author]["prs_opened"] += 1
            member_data[author]["repos"][repo] += 1

            if pr.get("merged_at"):
                member_data[author]["prs_merged"] += 1
                created_dt = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
                merged_dt = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
                turnaround = (merged_dt - created_dt).total_seconds() / 3600
                member_data[author]["turnarounds"].append(turnaround)

        members = []
        for username, data in member_data.items():
            avg_turnaround = (
                round(sum(data["turnarounds"]) / len(data["turnarounds"]), 1)
                if data["turnarounds"] else 0.0
            )
            members.append(MemberContribution(
                username=username,
                prs_opened=data["prs_opened"],
                prs_merged=data["prs_merged"],
                avg_turnaround_hours=avg_turnaround,
                repos=dict(data["repos"]),
            ))

        members.sort(key=lambda m: m.prs_opened, reverse=True)
        total_prs = sum(m.prs_opened for m in members)

        # Calculate period days from quarter
        period_days = (end_date - start_date).days
        result = TeamContributionResponse(
            members=members, total_prs=total_prs, period_days=period_days
        )
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"GitHub API error in get_team_contributions: {e}")
        raise


def _get_quarter_dates(quarter: str | None) -> tuple[datetime, datetime, str]:
    """Parse quarter string (e.g., '2026-Q2') and return start_date, end_date, cutoff_str."""
    now = datetime.now(timezone.utc)

    if quarter:
        try:
            year, q = quarter.split("-Q")
            year = int(year)
            q = int(q)
            quarter_starts = {
                1: (1, 1),   # Jan 1
                2: (4, 1),   # Apr 1
                3: (7, 1),   # Jul 1
                4: (10, 1),  # Oct 1
            }
            quarter_ends = {
                1: (3, 31),  # Mar 31
                2: (6, 30),  # Jun 30
                3: (9, 30),  # Sep 30
                4: (12, 31), # Dec 31
            }
            start_month, start_day = quarter_starts[q]
            end_month, end_day = quarter_ends[q]
            start_date = datetime(year, start_month, start_day, tzinfo=timezone.utc)
            end_date = datetime(year, end_month, end_day, 23, 59, 59, tzinfo=timezone.utc)
            cutoff_str = start_date.strftime("%Y-%m-%d")
            return start_date, end_date, cutoff_str
        except (ValueError, KeyError):
            pass

    # Default: last 30 days
    cutoff = now - timedelta(days=30)
    return cutoff, now, cutoff.strftime("%Y-%m-%d")


async def get_team_review_stats(squad: str | None = None, project: str | None = None, days: int = 30, quarter: str | None = None, use_cache: bool = True) -> TeamReviewStatsResponse:
    cache_key = f"team_review_stats:{squad}:{project}:{quarter}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return TeamReviewStatsResponse(**cached)

    try:
        settings = get_settings()
        start_date, end_date, cutoff_str = _get_quarter_dates(quarter)

        repos = settings.repos_for_filter(squad, project)
        members_set = set(m.lower() for m in ALL_QA_MEMBERS)

        reviewer_data: dict[str, dict] = defaultdict(lambda: {
            "reviews_given": 0, "approvals": 0, "changes_requested": 0, "comments": 0, "prs_reviewed": set()
        })
        weekly_reviews: dict[str, int] = defaultdict(int)

        async with httpx.AsyncClient(timeout=60.0) as client:
            # Fetch PRs from project repos and get their reviews directly (avoids search API rate limits)
            for repo in repos:
                try:
                    # Fetch recent PRs from repo
                    page = 1
                    while page <= 3:  # Limit to 3 pages per repo
                        url = f"https://api.github.com/repos/{settings.github_org}/{repo}/pulls"
                        params = {"state": "all", "per_page": 100, "page": page, "sort": "updated", "direction": "desc"}
                        resp = await client.get(url, headers=_headers(), params=params)
                        if resp.status_code != 200:
                            break
                        prs = resp.json()
                        if not prs:
                            break

                        for pr in prs:
                            pr_number = pr.get("number", 0)
                            pr_updated = pr.get("updated_at", "")
                            if pr_updated:
                                updated_dt = datetime.fromisoformat(pr_updated.replace("Z", "+00:00"))
                                if updated_dt < start_date:
                                    continue  # Skip PRs updated before quarter start

                            # Fetch reviews for this PR
                            reviews_url = f"https://api.github.com/repos/{settings.github_org}/{repo}/pulls/{pr_number}/reviews"
                            try:
                                reviews_resp = await client.get(reviews_url, headers=_headers())
                                if reviews_resp.status_code != 200:
                                    continue
                                reviews = reviews_resp.json()

                                for review in reviews:
                                    reviewer = review.get("user", {}).get("login", "")
                                    reviewer_lower = reviewer.lower()
                                    submitted_at = review.get("submitted_at", "")
                                    state = review.get("state", "COMMENTED")

                                    if not submitted_at:
                                        continue

                                    submitted_dt = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
                                    if submitted_dt < start_date or submitted_dt > end_date:
                                        continue

                                    # Include QA members and bots
                                    is_qa = reviewer_lower in members_set
                                    is_bot = "copilot" in reviewer_lower or "claude" in reviewer_lower or "[bot]" in reviewer_lower
                                    if not is_qa and not is_bot:
                                        continue

                                    pr_key = f"{repo}:{pr_number}:{reviewer}"
                                    if pr_key in reviewer_data[reviewer]["prs_reviewed"]:
                                        continue

                                    reviewer_data[reviewer]["prs_reviewed"].add(pr_key)
                                    reviewer_data[reviewer]["reviews_given"] += 1
                                    if state == "APPROVED":
                                        reviewer_data[reviewer]["approvals"] += 1
                                    elif state == "CHANGES_REQUESTED":
                                        reviewer_data[reviewer]["changes_requested"] += 1
                                    else:
                                        reviewer_data[reviewer]["comments"] += 1

                                    week = submitted_dt.strftime("%G-W%V")
                                    weekly_reviews[week] += 1

                            except httpx.HTTPError:
                                continue

                        if len(prs) < 100:
                            break
                        page += 1
                        await asyncio.sleep(0.5)

                except httpx.HTTPError as e:
                    logger.error(f"GitHub API error fetching PRs for {repo}: {e}")
                    continue

                await asyncio.sleep(0.5)

        reviewers = []
        total_reviews = 0
        copilot_reviews = 0

        for username, data in reviewer_data.items():
            if data["reviews_given"] == 0:
                continue

            username_lower = username.lower()
            is_ai = "copilot" in username_lower or "claude" in username_lower or "[bot]" in username_lower

            reviewers.append(ReviewerStats(
                username=username,
                reviews_given=data["reviews_given"],
                approvals=data["approvals"],
                changes_requested=data["changes_requested"],
                comments=data["comments"],
            ))
            total_reviews += data["reviews_given"]
            if is_ai:
                copilot_reviews += data["reviews_given"]

        reviewers.sort(key=lambda r: r.reviews_given, reverse=True)

        weekly_trend = []
        for week in sorted(weekly_reviews.keys()):
            weekly_trend.append(PRTrend(
                week=week,
                opened=0,
                merged=0,
                reviewed=weekly_reviews[week],
            ))

        result = TeamReviewStatsResponse(
            total_reviews=total_reviews,
            copilot_reviews=copilot_reviews,
            human_reviews=total_reviews - copilot_reviews,
            reviewers=reviewers[:20],
            weekly_trend=weekly_trend[-12:],
        )
        # Cache for 2 hours to reduce API calls (review stats don't change frequently)
        cache_service.cache_set(cache_key, result.model_dump(), ttl=7200)
        return result

    except httpx.HTTPError as e:
        logger.error(f"GitHub API error in get_team_review_stats: {e}")
        raise
