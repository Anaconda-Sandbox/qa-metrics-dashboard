import asyncio
import base64
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.config import GITHUB_TO_JIRA_NAME, ALL_QA_MEMBERS, get_settings
from app.models.metrics import (
    GitHubActivityItem,
    JiraActivityItem,
    MemberActivityResponse,
    PRReviewItem,
)
from app.services import cache_service

logger = logging.getLogger(__name__)


def _jira_auth_header() -> dict[str, str]:
    settings = get_settings()
    creds = base64.b64encode(
        f"{settings.jira_user_email}:{settings.jira_api_token}".encode()
    ).decode()
    return {
        "Authorization": f"Basic {creds}",
        "Accept": "application/json",
    }


def _github_headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def get_member_activity(username: str, days: int = 30, use_cache: bool = True) -> MemberActivityResponse:
    cache_key = f"member_activity:{username}:{days}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return MemberActivityResponse(**cached)

    settings = get_settings()
    jira_name = GITHUB_TO_JIRA_NAME.get(username, username)

    jira_items: list[JiraActivityItem] = []
    jira_total = 0
    github_prs: list[GitHubActivityItem] = []
    github_total = 0
    pr_reviews: list[PRReviewItem] = []
    pr_reviews_total = 0
    stats: dict = {}

    # Fetch Jira activity
    try:
        jql = f'assignee = "{jira_name}" AND updated >= -{days}d ORDER BY updated DESC'
        url = f"{settings.jira_base_url}/rest/api/3/search/jql"
        params = {
            "jql": jql,
            "fields": "summary,status,issuetype,priority,updated,project",
            "maxResults": 50,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=_jira_auth_header(), params=params)
            resp.raise_for_status()
            data = resp.json()

            for issue in data.get("issues", []):
                f = issue.get("fields", {})
                jira_items.append(JiraActivityItem(
                    key=issue["key"],
                    summary=f.get("summary", ""),
                    status=f.get("status", {}).get("name", "Unknown"),
                    issue_type=f.get("issuetype", {}).get("name", "Unknown"),
                    priority=f.get("priority", {}).get("name", "Unknown") if f.get("priority") else "Unknown",
                    updated=f.get("updated", ""),
                    project=f.get("project", {}).get("key", "Unknown"),
                ))

            jira_total = len(jira_items)

    except httpx.HTTPError as e:
        logger.error(f"Jira API error for member {username}: {e}")

    # Fetch GitHub PRs using Search API - finds ALL PRs in anaconda org
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days)
        cutoff_str = cutoff.strftime("%Y-%m-%d")

        search_query = f"is:pr author:{username} org:{settings.github_org} created:>={cutoff_str}"
        search_url = "https://api.github.com/search/issues"

        async with httpx.AsyncClient(timeout=60.0) as client:
            page = 1
            while True:
                params = {"q": search_query, "per_page": 100, "page": page, "sort": "created", "order": "desc"}
                resp = await client.get(search_url, headers=_github_headers(), params=params)

                # Handle rate limiting with retry
                if resp.status_code == 403:
                    logger.warning(f"Rate limited on GitHub PR search for {username}, waiting 60s...")
                    await asyncio.sleep(60)
                    resp = await client.get(search_url, headers=_github_headers(), params=params)

                if resp.status_code != 200:
                    logger.warning(f"GitHub PR search failed for {username}: {resp.status_code}")
                    break

                data = resp.json()

                items = data.get("items", [])
                if not items:
                    break

                for pr in items:
                    repo_url = pr.get("repository_url", "")
                    repo_name = repo_url.split("/")[-1] if repo_url else "unknown"

                    created = pr.get("created_at", "")
                    merged_at = None

                    pr_data = pr.get("pull_request", {})
                    if pr_data.get("merged_at"):
                        merged_at = pr_data["merged_at"]

                    state = pr.get("state", "unknown")
                    if merged_at:
                        state = "merged"

                    github_prs.append(GitHubActivityItem(
                        title=pr.get("title", ""),
                        number=pr.get("number", 0),
                        state=state,
                        repo=repo_name,
                        created_at=created,
                        merged_at=merged_at,
                        url=pr.get("html_url", ""),
                    ))

                if len(items) < 100:
                    break
                page += 1

        github_prs.sort(key=lambda p: p.created_at, reverse=True)
        github_total = len(github_prs)

    except Exception as e:
        logger.error(f"GitHub API error for member {username}: {e}")

    # Fetch PR Reviews - count unique PRs reviewed (not individual review events)
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days)
        cutoff_str = cutoff.strftime("%Y-%m-%d")

        search_query = f"is:pr reviewed-by:{username} org:{settings.github_org} updated:>={cutoff_str}"
        search_url = "https://api.github.com/search/issues"
        prs_reviewed_keys: set[str] = set()

        async with httpx.AsyncClient(timeout=60.0) as client:
            page = 1
            while True:
                params = {"q": search_query, "per_page": 100, "page": page, "sort": "updated", "order": "desc"}
                resp = await client.get(search_url, headers=_github_headers(), params=params)

                # Handle rate limiting with retry
                if resp.status_code == 403:
                    logger.warning(f"Rate limited on PR review search for {username}, waiting 60s...")
                    await asyncio.sleep(60)
                    resp = await client.get(search_url, headers=_github_headers(), params=params)

                if resp.status_code != 200:
                    logger.warning(f"PR review search failed for {username}: {resp.status_code}")
                    break

                data = resp.json()

                items = data.get("items", [])
                if not items:
                    break

                for pr in items:
                    pr_author = pr.get("user", {}).get("login", "")
                    if pr_author.lower() == username.lower():
                        continue

                    repo_url = pr.get("repository_url", "")
                    repo_name = repo_url.split("/")[-1] if repo_url else "unknown"
                    pr_number = pr.get("number", 0)
                    pr_key = f"{repo_name}:{pr_number}"

                    if pr_key in prs_reviewed_keys:
                        continue

                    reviews_url = f"https://api.github.com/repos/{settings.github_org}/{repo_name}/pulls/{pr_number}/reviews"
                    try:
                        reviews_resp = await client.get(reviews_url, headers=_github_headers())
                        if reviews_resp.status_code != 200:
                            continue
                        reviews = reviews_resp.json()

                        # Find best review state for this user on this PR
                        best_state = None
                        best_submitted = None
                        state_priority = {"APPROVED": 3, "CHANGES_REQUESTED": 2, "COMMENTED": 1}

                        for review in reviews:
                            reviewer = review.get("user", {}).get("login", "")
                            if reviewer.lower() != username.lower():
                                continue
                            submitted_at = review.get("submitted_at", "")
                            if not submitted_at:
                                continue
                            submitted_dt = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
                            if submitted_dt < cutoff:
                                continue

                            state = review.get("state", "COMMENTED")
                            if not best_state or state_priority.get(state, 0) > state_priority.get(best_state, 0):
                                best_state = state
                                best_submitted = submitted_at

                        if best_state:
                            prs_reviewed_keys.add(pr_key)
                            pr_reviews.append(PRReviewItem(
                                pr_title=pr.get("title", ""),
                                pr_number=pr_number,
                                repo=repo_name,
                                state=best_state,
                                submitted_at=best_submitted,
                                pr_author=pr_author,
                                url=pr.get("html_url", ""),
                            ))
                    except httpx.HTTPError:
                        continue

                if len(items) < 100:
                    break
                page += 1

        pr_reviews.sort(key=lambda r: r.submitted_at, reverse=True)
        pr_reviews_total = len(pr_reviews)

    except Exception as e:
        logger.error(f"GitHub API error fetching reviews for {username}: {e}")

    # Compute stats
    merged_prs = [p for p in github_prs if p.state == "merged"]
    jira_by_type: dict[str, int] = {}
    for item in jira_items:
        jira_by_type[item.issue_type] = jira_by_type.get(item.issue_type, 0) + 1

    reviews_by_state: dict[str, int] = {}
    for review in pr_reviews:
        reviews_by_state[review.state] = reviews_by_state.get(review.state, 0) + 1

    stats = {
        "prs_opened": github_total,
        "prs_merged": len(merged_prs),
        "prs_reviewed": pr_reviews_total,
        "reviews_by_state": reviews_by_state,
        "jira_tickets_active": jira_total,
        "jira_by_type": jira_by_type,
        "jira_name": jira_name,
    }

    result = MemberActivityResponse(
        username=username,
        jira_items=jira_items,
        jira_total=jira_total,
        github_prs=github_prs,
        github_total=github_total,
        pr_reviews=pr_reviews,
        pr_reviews_total=pr_reviews_total,
        stats=stats,
    )

    # Cache for 15 minutes
    cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
    return result


async def refresh_all_members_activity(days: int = 30):
    """Background task to refresh all member activity data"""
    logger.info("Starting background refresh of all member activity...")
    for member in ALL_QA_MEMBERS:
        try:
            await get_member_activity(member, days=days, use_cache=False)
            logger.info(f"Refreshed activity for {member}")
        except Exception as e:
            logger.error(f"Error refreshing activity for {member}: {e}")
    logger.info("Completed background refresh of all member activity")
