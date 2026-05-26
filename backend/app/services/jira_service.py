import base64
import logging
from collections import defaultdict
from datetime import datetime, timedelta

import httpx

from app.config import get_settings, GITHUB_TO_JIRA_NAME, ALL_QA_MEMBERS
from app.models.metrics import (
    AutomationCoverageResponse,
    BugItem,
    BugListResponse,
    BugPriorityBreakdown,
    BugStatusBreakdown,
    DefectDensityResponse,
    MemberStoryPoints,
    QAReportedBugsResponse,
    SprintInfo,
    SprintVelocity,
    StoryPointsResponse,
)
from app.services import cache_service

logger = logging.getLogger(__name__)

# Story Points custom field in Anaconda Jira
STORY_POINTS_FIELD = "customfield_10126"


def _auth_header() -> dict[str, str]:
    settings = get_settings()
    creds = base64.b64encode(
        f"{settings.jira_user_email}:{settings.jira_api_token}".encode()
    ).decode()
    return {
        "Authorization": f"Basic {creds}",
        "Accept": "application/json",
    }


async def _jql_search(jql: str, fields: str, max_results: int = 100) -> dict:
    settings = get_settings()
    url = f"{settings.jira_base_url}/rest/api/3/search/jql"
    all_issues: list[dict] = []
    next_page_token: str | None = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            params: dict = {
                "jql": jql,
                "fields": fields,
                "maxResults": min(max_results - len(all_issues), 100),
            }
            if next_page_token:
                params["nextPageToken"] = next_page_token

            resp = await client.get(url, headers=_auth_header(), params=params)
            resp.raise_for_status()
            data = resp.json()

            all_issues.extend(data.get("issues", []))

            if data.get("isLast", True) or len(all_issues) >= max_results:
                break
            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break

    return {"issues": all_issues, "total": len(all_issues)}


def _projects_jql(squad: str | None = None, project: str | None = None) -> str:
    settings = get_settings()
    projects = settings.jira_projects_for_filter(squad, project)
    return f"project in ({', '.join(projects)})"


def _get_quarter_date_range(quarter: str | None) -> tuple[str | None, str | None]:
    """Parse quarter string and return (start_date, end_date) in YYYY-MM-DD format."""
    if not quarter:
        return None, None
    try:
        year, q = quarter.split("-Q")
        year = int(year)
        q = int(q)
        quarter_starts = {1: "01-01", 2: "04-01", 3: "07-01", 4: "10-01"}
        quarter_ends = {1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31"}
        start = f"{year}-{quarter_starts[q]}"
        end = f"{year}-{quarter_ends[q]}"
        return start, end
    except (ValueError, KeyError):
        return None, None


def _quarter_created_jql(quarter: str | None) -> str:
    """Return JQL clause for filtering by quarter creation date."""
    start, end = _get_quarter_date_range(quarter)
    if start and end:
        return f" AND created >= '{start}' AND created <= '{end}'"
    return ""


def _quarter_bounds(quarter: str | None) -> tuple[str, str, str]:
    """Return (start, exclusive_end, label) for a quarter like '2026-Q2'.

    Falls back to the current quarter when input is missing/invalid.
    Exclusive end = first day of the following quarter, matching JQL `created < end`.
    """
    try:
        if quarter:
            year_str, q_str = quarter.split("-Q")
            year = int(year_str)
            q = int(q_str)
        else:
            raise ValueError
    except (ValueError, AttributeError):
        now = datetime.now()
        q = (now.month - 1) // 3 + 1
        year = now.year

    start_month = (q - 1) * 3 + 1
    start = datetime(year, start_month, 1)
    end = datetime(year + 1, 1, 1) if q == 4 else datetime(year, start_month + 3, 1)
    label = f"{year}-Q{q}"
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"), label


async def get_qa_team_roster() -> list[dict]:
    """Live list of QA team members from Jira's `QA` group.

    Single source of truth for who's on the QA team — replaces the hardcoded
    ALL_QA_MEMBERS list in config.py. Filters to active accounts only.

    Returns: [{accountId, displayName, email, github_handle?, initials, active}]
    """
    settings = get_settings()
    url = f"{settings.jira_base_url}/rest/api/3/group/member"
    members: list[dict] = []
    start_at = 0
    page_size = 50

    # Inverse map of GITHUB_TO_JIRA_NAME so we can attach a github handle
    # by display name match.
    jira_name_to_github = {v: k for k, v in GITHUB_TO_JIRA_NAME.items()}

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            params = {"groupname": "QA", "maxResults": page_size, "startAt": start_at, "includeInactiveUsers": "false"}
            resp = await client.get(url, headers=_auth_header(), params=params)
            resp.raise_for_status()
            data = resp.json()
            for u in data.get("values", []):
                if not u.get("active", True):
                    continue
                name = u.get("displayName", "")
                initials = "".join(p[0].upper() for p in name.split() if p)[:3] or "?"
                members.append({
                    "accountId": u.get("accountId"),
                    "displayName": name,
                    "email": u.get("emailAddress", ""),
                    "github_handle": jira_name_to_github.get(name),
                    "initials": initials,
                    "active": True,
                })
            if data.get("isLast", True) or len(data.get("values", [])) < page_size:
                break
            start_at += page_size
    members.sort(key=lambda m: m["displayName"].lower())
    return members


async def get_defect_density_by_project(quarter: str | None = None) -> list[dict]:
    """Per-project defect density from Jira directly.

    For every project in PROJECT_CONFIG, runs two JQLs:
      total = project = X AND created in Q
      bugs  = project = X AND issuetype = Bug AND created in Q
    density = bugs / total * 100.

    Source-of-truth Jira numbers — DX Cloud SQL undercounts because some
    projects (CLI/PREX/QA/MRKT/CASH) aren't fully ingested into DX.

    Returns a list of dicts: {key, name, total_tickets, bug_count, density_pct}.
    """
    from app.config import PROJECT_CONFIG
    start, end, _label = _quarter_bounds(quarter)
    out = []
    for key in PROJECT_CONFIG.keys():
        try:
            total_jql = f'project = "{key}" AND created >= "{start}" AND created < "{end}"'
            bug_jql = f'project = "{key}" AND issuetype = Bug AND created >= "{start}" AND created < "{end}"'
            total_data = await _jql_search(total_jql, "id", max_results=2000)
            bug_data = await _jql_search(bug_jql, "id", max_results=2000)
            total = len(total_data.get("issues", []))
            bugs = len(bug_data.get("issues", []))
            density = round((bugs / total) * 100, 2) if total else 0.0
            out.append({
                "key": key,
                "name": PROJECT_CONFIG[key].get("name", key),
                "total_tickets": total,
                "bug_count": bugs,
                "density_pct": density,
            })
        except Exception as e:
            logger.warning(f"defect density fetch failed for {key}: {e}")
    out.sort(key=lambda r: -r["density_pct"])
    return out


async def get_qa_fixed_count(quarter: str | None = None, project: str | None = None) -> int:
    """Count tickets with the `qa-fixed` label that were updated in the quarter.

    The QA team applies the `qa-fixed` label to bugs they found and fixed
    themselves (regardless of project). This counts QA-driven fixes as
    activity, distinct from `Bugs Resolved` which counts QA-reported bugs
    that were resolved in Jira.

    Time scoping uses `updated` (touched in the quarter) rather than
    `resolutiondate` so the metric reflects ongoing verification work.
    """
    start, end, _label = _quarter_bounds(quarter)
    project_clause = ""
    if project and project != "ALL":
        safe = project.replace('"', "").replace("'", "")
        project_clause = f' AND project = "{safe}"'
    jql = (
        f'labels = "qa-fixed" '
        f'AND updated >= "{start}" AND updated < "{end}"{project_clause}'
    )
    data = await _jql_search(jql, "id", max_results=2000)
    return len(data.get("issues", []))


async def get_qa_bug_metrics(quarter: str | None = None, project: str | None = None) -> dict:
    """Canonical bug metrics for the QA team, per the source-of-truth JQL.

    Bugs are scoped to the given quarter by `created` date. QA membership is
    creator OR reporter in membersOf("QA"). Resolution = `resolutiondate` is
    set (DX equivalent: completed_at IS NOT NULL). Critical = open bug with
    priority in (Highest, High).

    Returns: {total, resolved, open, critical_open, resolution_rate}.
    """
    start, end, _label = _quarter_bounds(quarter)
    project_clause = ""
    if project and project != "ALL":
        safe = project.replace('"', "").replace("'", "")
        project_clause = f' AND project = "{safe}"'

    base = (
        f'issuetype = Bug AND (reporter in membersOf("QA") OR creator in membersOf("QA")) '
        f'AND created >= "{start}" AND created < "{end}"{project_clause}'
    )

    total_jql = base
    resolved_jql = f"{base} AND resolutiondate is not EMPTY"
    critical_jql = f"{base} AND resolutiondate is EMPTY AND priority in (Highest, High)"

    fields = "id"
    total_data, resolved_data, critical_data = (
        await _jql_search(total_jql, fields, max_results=2000),
        await _jql_search(resolved_jql, fields, max_results=2000),
        await _jql_search(critical_jql, fields, max_results=2000),
    )

    total = len(total_data.get("issues", []))
    resolved = len(resolved_data.get("issues", []))
    critical_open = len(critical_data.get("issues", []))
    open_count = total - resolved
    rate = round((resolved / total) * 100, 2) if total else 0.0

    return {
        "total": total,
        "resolved": resolved,
        "open": open_count,
        "critical_open": critical_open,
        "resolution_rate": rate,
    }


async def get_qa_reported_bugs(
    quarter: str | None = None,
    project: str | None = None,
    use_cache: bool = True,
) -> QAReportedBugsResponse:
    """Bugs reported by QA team in a given quarter (total + critical count).

    Critical = priority in (Highest, High), matching the convention used in
    dx_service for the executive dashboard.

    `project` (optional Jira key like 'DESK') narrows results to that single
    project. 'ALL' or None returns the team-wide count.
    """
    start, end, label = _quarter_bounds(quarter)
    project_key = (project or "").strip()
    project_clause = ""
    if project_key and project_key != "ALL":
        # Jira keys are alphanumeric — strip quotes defensively
        safe = project_key.replace('"', "").replace("'", "")
        project_clause = f' AND project = "{safe}"'
    cache_key = f"qa_reported_bugs:{label}:{project_key or 'ALL'}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return QAReportedBugsResponse(**cached)

    try:
        fields = "priority"
        date_clause = f'created >= "{start}" AND created < "{end}"'
        total_jql = (
            f'issuetype = Bug AND reporter in membersOf("QA") AND {date_clause}{project_clause} '
            f'ORDER BY created DESC'
        )
        critical_jql = (
            f'issuetype = Bug AND reporter in membersOf("QA") AND {date_clause}{project_clause} '
            f'AND priority in (Highest, High)'
        )

        total_data = await _jql_search(total_jql, fields, max_results=2000)
        critical_data = await _jql_search(critical_jql, fields, max_results=2000)

        result = QAReportedBugsResponse(
            quarter=label,
            total=len(total_data.get("issues", [])),
            critical=len(critical_data.get("issues", [])),
        )

        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"Jira API error in get_qa_reported_bugs: {e}")
        raise


async def get_defect_density(squad: str | None = None, project: str | None = None, quarter: str | None = None, use_cache: bool = True) -> DefectDensityResponse:
    cache_key = f"defect_density:{squad}:{project}:{quarter}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return DefectDensityResponse(**cached)

    try:
        fields = "status,priority,project,created,resolutiondate"

        # Build project filter based on squad/project selection
        project_filter = _projects_jql(squad, project)
        quarter_filter = _quarter_created_jql(quarter)

        # Use membersOf(QA) filter for all bug queries
        qa_filter = "reporter in membersOf(QA)"
        status_filter = 'status != Done AND status != "Closed: No Action"'

        all_bugs_jql = f"{project_filter} AND type = Bug AND {qa_filter}{quarter_filter} ORDER BY created DESC"
        open_bugs_jql = f"{project_filter} AND type = Bug AND {qa_filter} AND {status_filter}{quarter_filter} ORDER BY priority ASC"
        high_prio_jql = f"{project_filter} AND type = Bug AND {qa_filter} AND priority in (High, Highest) AND {status_filter}{quarter_filter}"
        weekly_jql = f"{project_filter} AND type = Bug AND {qa_filter} AND created >= -7d"
        monthly_jql = f"{project_filter} AND type = Bug AND {qa_filter} AND created >= -30d"

        all_data = await _jql_search(all_bugs_jql, fields, max_results=2000)
        open_data = await _jql_search(open_bugs_jql, fields, max_results=2000)
        high_data = await _jql_search(high_prio_jql, fields, max_results=500)
        weekly_data = await _jql_search(weekly_jql, fields, max_results=500)
        monthly_data = await _jql_search(monthly_jql, fields, max_results=500)

        # Count from actual issues returned (since total may not be accurate with new API)
        total_bugs = len(all_data.get("issues", []))
        open_bugs = len(open_data.get("issues", []))
        closed_bugs = total_bugs - open_bugs

        by_project: dict[str, int] = defaultdict(int)
        by_priority: dict[str, int] = defaultdict(int)
        by_status: dict[str, int] = defaultdict(int)

        for issue in open_data.get("issues", []):
            f = issue.get("fields", {})
            proj = f.get("project", {}).get("key", "Unknown")
            priority = f.get("priority", {}).get("name", "Unknown") if f.get("priority") else "Unknown"
            status = f.get("status", {}).get("name", "Unknown")
            by_project[proj] += 1
            by_priority[priority] += 1
            by_status[status] += 1

        # Count high priority from actual issues
        open_high_priority = len(high_data.get("issues", []))

        result = DefectDensityResponse(
            total_bugs=total_bugs,
            open_bugs=open_bugs,
            closed_bugs=closed_bugs,
            by_project=dict(by_project),
            by_priority=dict(by_priority),
            by_status=dict(by_status),
            open_high_priority=open_high_priority,
            weekly_inflow=len(weekly_data.get("issues", [])),
            monthly_inflow=len(monthly_data.get("issues", [])),
        )

        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"Jira API error in get_defect_density: {e}")
        raise


def _get_qa_members_reporter_or_assignee_jql() -> str:
    """Build JQL clause to filter by QA team members as reporter OR assignee"""
    jira_names = [GITHUB_TO_JIRA_NAME.get(m, m) for m in ALL_QA_MEMBERS]
    quoted_names = [f'"{name}"' for name in jira_names]
    names_list = ', '.join(quoted_names)
    return f"(reporter in ({names_list}) OR assignee in ({names_list}))"


async def get_bugs_list(squad: str | None = None, project: str | None = None, limit: int = 1000, quarter: str | None = None, use_cache: bool = True) -> BugListResponse:
    cache_key = f"bugs_list:{squad}:{project}:{quarter}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return BugListResponse(**cached)

    try:
        # Build project filter based on squad/project selection
        project_filter = _projects_jql(squad, project)
        quarter_filter = _quarter_created_jql(quarter)

        # Use membersOf(QA) for reporter filter and explicit status exclusion
        jql = f'{project_filter} AND type = Bug AND reporter in membersOf(QA) AND status != Done AND status != "Closed: No Action"{quarter_filter} ORDER BY created DESC'
        fields = "summary,status,priority,created,project,reporter"
        data = await _jql_search(jql, fields, max_results=limit)

        bugs = []
        for issue in data.get("issues", []):
            f = issue.get("fields", {})
            reporter = f.get("reporter", {})
            bugs.append(BugItem(
                key=issue["key"],
                summary=f.get("summary", ""),
                status=f.get("status", {}).get("name", "Unknown"),
                priority=f.get("priority", {}).get("name", "Unknown") if f.get("priority") else "Unknown",
                created=f.get("created", ""),
                project=f.get("project", {}).get("key", "Unknown"),
                reporter=reporter.get("displayName", "") if reporter else "",
            ))

        result = BugListResponse(bugs=bugs, total=data.get("total", 0))
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"Jira API error in get_bugs_list: {e}")
        raise


async def get_open_bugs(limit: int = 20, squad: str | None = None, project: str | None = None, quarter: str | None = None) -> BugListResponse:
    return await get_bugs_list(squad=squad, project=project, limit=limit, quarter=quarter)


async def get_bug_priority_breakdown(squad: str | None = None, project: str | None = None, use_cache: bool = True) -> BugPriorityBreakdown:
    cache_key = f"bug_priority:{squad}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return BugPriorityBreakdown(**cached)

    try:
        base = _projects_jql(squad, project)
        jql = f"{base} AND issuetype = Bug AND statusCategory != Done ORDER BY priority ASC"
        fields = "priority"
        data = await _jql_search(jql, fields)

        by_priority: dict[str, int] = defaultdict(int)
        for issue in data.get("issues", []):
            f = issue.get("fields", {})
            priority = f.get("priority", {}).get("name", "Unknown") if f.get("priority") else "Unknown"
            by_priority[priority] += 1

        result = BugPriorityBreakdown(by_priority=dict(by_priority), total=data.get("total", 0))
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"Jira API error in get_bug_priority_breakdown: {e}")
        raise


async def get_bug_status_breakdown(squad: str | None = None, project: str | None = None, use_cache: bool = True) -> BugStatusBreakdown:
    cache_key = f"bug_status:{squad}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return BugStatusBreakdown(**cached)

    try:
        base = _projects_jql(squad, project)
        jql = f"{base} AND issuetype = Bug AND statusCategory != Done ORDER BY status ASC"
        fields = "status"
        data = await _jql_search(jql, fields)

        by_status: dict[str, int] = defaultdict(int)
        for issue in data.get("issues", []):
            f = issue.get("fields", {})
            status = f.get("status", {}).get("name", "Unknown")
            by_status[status] += 1

        result = BugStatusBreakdown(by_status=dict(by_status), total=data.get("total", 0))
        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"Jira API error in get_bug_status_breakdown: {e}")
        raise


async def get_automation_coverage(squad: str | None = None, project: str | None = None, quarter: str | None = None, use_cache: bool = True) -> AutomationCoverageResponse:
    cache_key = f"automation_coverage:{squad}:{project}:{quarter}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return AutomationCoverageResponse(**cached)

    try:
        base = _projects_jql(squad, project)
        quarter_filter = _quarter_created_jql(quarter)
        fields = "labels,summary"

        automated_jql = (
            f'{base} AND issuetype = Test AND labels in ("Automated", "automation", "qa-automation"){quarter_filter}'
        )
        not_automated_jql = (
            f'{base} AND issuetype = Test AND (labels not in ("Automated", "automation", "qa-automation") OR labels is EMPTY){quarter_filter}'
        )

        automated_data = await _jql_search(automated_jql, fields, max_results=2000)
        not_automated_data = await _jql_search(not_automated_jql, fields, max_results=2000)

        automated = automated_data.get("total", 0)
        not_automated = not_automated_data.get("total", 0)
        total = automated + not_automated
        coverage = (automated / total * 100) if total > 0 else 0.0

        by_type: dict[str, int] = defaultdict(int)
        for issue in automated_data.get("issues", []):
            f = issue.get("fields", {})
            labels = f.get("labels", [])
            categorized = False
            for label in labels:
                lower = label.lower()
                if "cli" in lower:
                    by_type["CLI"] += 1
                    categorized = True
                    break
                elif "api" in lower:
                    by_type["API"] += 1
                    categorized = True
                    break
                elif "ui" in lower or "gui" in lower:
                    by_type["UI"] += 1
                    categorized = True
                    break
                elif "gha" in lower or "github-action" in lower:
                    by_type["GHA"] += 1
                    categorized = True
                    break
            if not categorized:
                by_type["Other"] += 1

        result = AutomationCoverageResponse(
            total_test_tickets=total,
            automated_tickets=automated,
            not_automated_tickets=not_automated,
            coverage_percentage=round(coverage, 1),
            by_type=dict(by_type),
        )

        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"Jira API error in get_automation_coverage: {e}")
        raise


def _get_quarter_dates() -> tuple[datetime, datetime, str]:
    """Get current quarter start/end dates and label"""
    now = datetime.now()
    quarter = (now.month - 1) // 3 + 1
    quarter_start_month = (quarter - 1) * 3 + 1
    quarter_start = datetime(now.year, quarter_start_month, 1)

    if quarter == 4:
        quarter_end = datetime(now.year + 1, 1, 1) - timedelta(days=1)
    else:
        quarter_end = datetime(now.year, quarter_start_month + 3, 1) - timedelta(days=1)

    quarter_label = f"Q{quarter} {now.year}"
    return quarter_start, quarter_end, quarter_label


def _get_qa_members_jql() -> str:
    """Build JQL clause to filter by QA team members"""
    jira_names = [GITHUB_TO_JIRA_NAME.get(m, m) for m in ALL_QA_MEMBERS]
    quoted_names = [f'"{name}"' for name in jira_names]
    return f"assignee in ({', '.join(quoted_names)})"


async def get_story_points(squad: str | None = None, project: str | None = None, quarter: str | None = None, use_cache: bool = True) -> StoryPointsResponse:
    """Get story points metrics on quarterly basis - committed, completed, in progress (QA team only)"""
    cache_key = f"story_points:{squad}:{project}:{quarter}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return StoryPointsResponse(**cached)

    try:
        base = _projects_jql(squad, project)
        qa_filter = _get_qa_members_jql()
        fields = f"status,{STORY_POINTS_FIELD},assignee,resolutiondate,created"

        # Use provided quarter or default to current quarter
        if quarter:
            start_str, end_str = _get_quarter_date_range(quarter)
            if start_str and end_str:
                quarter_start_str = start_str
                quarter_end_str = end_str
                year, q = quarter.split("-Q")
                quarter_label = f"Q{q} {year}"
                # Also create datetime objects for velocity trend calculation
                quarter_start = datetime.strptime(start_str, "%Y-%m-%d")
                quarter_end = datetime.strptime(end_str, "%Y-%m-%d")
            else:
                quarter_start, quarter_end, quarter_label = _get_quarter_dates()
                quarter_start_str = quarter_start.strftime("%Y-%m-%d")
                quarter_end_str = quarter_end.strftime("%Y-%m-%d")
        else:
            quarter_start, quarter_end, quarter_label = _get_quarter_dates()
            quarter_start_str = quarter_start.strftime("%Y-%m-%d")
            quarter_end_str = quarter_end.strftime("%Y-%m-%d")

        # Committed = tickets assigned to QA team, created this quarter with story points
        jql_committed = f'{base} AND {qa_filter} AND "{STORY_POINTS_FIELD}" is not EMPTY AND created >= "{quarter_start_str}" AND created <= "{quarter_end_str}"'
        committed_data = await _jql_search(jql_committed, fields, max_results=2000)

        # Completed = tickets assigned to QA team, resolved this quarter
        jql_completed = f'{base} AND {qa_filter} AND "{STORY_POINTS_FIELD}" is not EMPTY AND resolved >= "{quarter_start_str}" AND resolved <= "{quarter_end_str}"'
        completed_data = await _jql_search(jql_completed, fields, max_results=2000)

        # In Progress = tickets assigned to QA team, currently in progress
        jql_in_progress = f'{base} AND {qa_filter} AND "{STORY_POINTS_FIELD}" is not EMPTY AND statusCategory = "In Progress"'
        in_progress_data = await _jql_search(jql_in_progress, fields, max_results=2000)

        # Calculate totals
        total_committed = sum(
            float(issue.get("fields", {}).get(STORY_POINTS_FIELD) or 0)
            for issue in committed_data.get("issues", [])
        )
        total_completed = sum(
            float(issue.get("fields", {}).get(STORY_POINTS_FIELD) or 0)
            for issue in completed_data.get("issues", [])
        )
        total_in_progress = sum(
            float(issue.get("fields", {}).get(STORY_POINTS_FIELD) or 0)
            for issue in in_progress_data.get("issues", [])
        )

        # Weekly velocity tracking for the quarter
        weekly_completed: dict[str, float] = defaultdict(float)
        weekly_committed: dict[str, float] = defaultdict(float)

        for issue in committed_data.get("issues", []):
            f = issue.get("fields", {})
            points = float(f.get(STORY_POINTS_FIELD) or 0)
            created = f.get("created", "")
            if created and points > 0:
                try:
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    week_key = dt.strftime("%Y-W%W")
                    weekly_committed[week_key] += points
                except:
                    pass

        for issue in completed_data.get("issues", []):
            f = issue.get("fields", {})
            points = float(f.get(STORY_POINTS_FIELD) or 0)
            resolution_date = f.get("resolutiondate", "")
            if resolution_date and points > 0:
                try:
                    dt = datetime.fromisoformat(resolution_date.replace("Z", "+00:00"))
                    week_key = dt.strftime("%Y-W%W")
                    weekly_completed[week_key] += points
                except:
                    pass

        # Per-member tracking (this quarter's completed work)
        members_points: dict[str, MemberStoryPoints] = {}
        for github_name in ALL_QA_MEMBERS:
            jira_name = GITHUB_TO_JIRA_NAME.get(github_name, github_name)
            members_points[jira_name.lower()] = MemberStoryPoints(
                username=github_name,
                jira_name=jira_name,
            )

        # Track completed points per member
        for issue in completed_data.get("issues", []):
            f = issue.get("fields", {})
            points = float(f.get(STORY_POINTS_FIELD) or 0)
            if points == 0:
                continue
            assignee = f.get("assignee", {})
            if assignee:
                assignee_name = assignee.get("displayName", "").lower()
                if assignee_name in members_points:
                    member = members_points[assignee_name]
                    member.completed_points += points
                    member.issues_completed += 1
                    member.total_issues += 1

        # Track in-progress points per member
        for issue in in_progress_data.get("issues", []):
            f = issue.get("fields", {})
            points = float(f.get(STORY_POINTS_FIELD) or 0)
            if points == 0:
                continue
            assignee = f.get("assignee", {})
            if assignee:
                assignee_name = assignee.get("displayName", "").lower()
                if assignee_name in members_points:
                    member = members_points[assignee_name]
                    member.in_progress_points += points
                    member.total_issues += 1

        # Build velocity trend (weeks in current quarter)
        velocity_trend = []
        now = datetime.now()
        weeks_in_quarter = int((now - quarter_start).days / 7) + 1
        for i in range(min(weeks_in_quarter, 13)):
            week_start = quarter_start + timedelta(weeks=i)
            if week_start > now:
                break
            week_key = week_start.strftime("%Y-W%W")
            committed = weekly_committed.get(week_key, 0)
            completed = weekly_completed.get(week_key, 0)
            velocity_trend.append(SprintVelocity(
                sprint_name=week_key,
                sprint_id=i,
                committed_points=committed,
                completed_points=completed,
                completion_rate=round((completed / committed * 100) if committed > 0 else 0, 1),
                start_date=week_start.isoformat(),
                end_date=(week_start + timedelta(days=7)).isoformat(),
            ))

        # Calculate average velocity (completed points per week)
        completed_weeks = [v.completed_points for v in velocity_trend if v.completed_points > 0]
        avg_velocity = sum(completed_weeks) / len(completed_weeks) if completed_weeks else 0

        # Filter active members and sort
        active_members = [m for m in members_points.values() if m.total_issues > 0]
        active_members.sort(key=lambda x: x.completed_points, reverse=True)

        # Create current quarter info
        current_quarter = SprintInfo(
            id=0,
            name=quarter_label,
            state="active",
            start_date=quarter_start.isoformat(),
            end_date=quarter_end.isoformat(),
        )

        result = StoryPointsResponse(
            total_completed=total_completed,
            total_in_progress=total_in_progress,
            total_committed=total_committed,
            velocity_trend=velocity_trend,
            by_member=active_members,
            current_sprint=current_quarter,
            avg_velocity=round(avg_velocity, 1),
        )

        cache_service.cache_set(cache_key, result.model_dump(), ttl=1800)
        return result

    except httpx.HTTPError as e:
        logger.error(f"Jira API error in get_story_points: {e}")
        raise
