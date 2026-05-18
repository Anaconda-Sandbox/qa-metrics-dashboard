import base64
import logging
from collections import defaultdict

import httpx

from app.config import get_settings
from app.config import GITHUB_TO_JIRA_NAME, ALL_QA_MEMBERS
from app.models.metrics import (
    AutomationCoverageResponse,
    BugItem,
    BugListResponse,
    BugPriorityBreakdown,
    BugStatusBreakdown,
    DefectDensityResponse,
    MemberStoryPoints,
    SprintInfo,
    SprintVelocity,
    StoryPointsResponse,
)
from app.services import cache_service

logger = logging.getLogger(__name__)


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


async def get_defect_density(squad: str | None = None, project: str | None = None, use_cache: bool = True) -> DefectDensityResponse:
    cache_key = f"defect_density:{squad}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return DefectDensityResponse(**cached)

    try:
        base = _projects_jql(squad, project)
        fields = "status,priority,project,created,resolutiondate"

        all_bugs_jql = f"{base} AND issuetype = Bug ORDER BY created DESC"
        open_bugs_jql = f"{base} AND issuetype = Bug AND statusCategory != Done ORDER BY priority ASC"
        high_prio_jql = f"{base} AND issuetype = Bug AND priority in (High, Highest) AND statusCategory != Done"
        weekly_jql = f"{base} AND issuetype = Bug AND created >= -7d"
        monthly_jql = f"{base} AND issuetype = Bug AND created >= -30d"

        all_data = await _jql_search(all_bugs_jql, fields, max_results=500)
        open_data = await _jql_search(open_bugs_jql, fields, max_results=500)
        high_data = await _jql_search(high_prio_jql, fields)
        weekly_data = await _jql_search(weekly_jql, fields)
        monthly_data = await _jql_search(monthly_jql, fields)

        total_bugs = all_data.get("total", 0)
        open_bugs = open_data.get("total", 0)
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

        result = DefectDensityResponse(
            total_bugs=total_bugs,
            open_bugs=open_bugs,
            closed_bugs=closed_bugs,
            by_project=dict(by_project),
            by_priority=dict(by_priority),
            by_status=dict(by_status),
            open_high_priority=high_data.get("total", 0),
            weekly_inflow=weekly_data.get("total", 0),
            monthly_inflow=monthly_data.get("total", 0),
        )

        cache_service.cache_set(cache_key, result.model_dump(), ttl=900)
        return result

    except httpx.HTTPError as e:
        logger.error(f"Jira API error in get_defect_density: {e}")
        raise


async def get_bugs_list(squad: str | None = None, project: str | None = None, limit: int = 50, use_cache: bool = True) -> BugListResponse:
    cache_key = f"bugs_list:{squad}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return BugListResponse(**cached)

    try:
        base = _projects_jql(squad, project)
        jql = f"{base} AND issuetype = Bug AND statusCategory != Done ORDER BY priority ASC"
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


async def get_open_bugs(limit: int = 20, squad: str | None = None, project: str | None = None) -> BugListResponse:
    return await get_bugs_list(squad=squad, project=project, limit=limit)


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


async def get_automation_coverage(squad: str | None = None, project: str | None = None, use_cache: bool = True) -> AutomationCoverageResponse:
    cache_key = f"automation_coverage:{squad}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return AutomationCoverageResponse(**cached)

    try:
        base = _projects_jql(squad, project)
        fields = "labels,summary"

        automated_jql = (
            f'{base} AND issuetype = Test AND labels in ("Automated", "automation", "qa-automation")'
        )
        not_automated_jql = (
            f'{base} AND issuetype = Test AND (labels not in ("Automated", "automation", "qa-automation") OR labels is EMPTY)'
        )

        automated_data = await _jql_search(automated_jql, fields)
        not_automated_data = await _jql_search(not_automated_jql, fields)

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


async def get_story_points(squad: str | None = None, project: str | None = None, use_cache: bool = True) -> StoryPointsResponse:
    """Get story points metrics including velocity trend and per-member breakdown"""
    cache_key = f"story_points:{squad}"

    if use_cache:
        cached = cache_service.cache_get(cache_key)
        if cached:
            return StoryPointsResponse(**cached)

    try:
        settings = get_settings()
        base = _projects_jql(squad, project)

        # Get active and recent sprints
        sprints = await _get_sprints(squad, project)
        current_sprint = None
        for s in sprints:
            if s.state == "active":
                current_sprint = s
                break

        # Get velocity trend from last 6 sprints
        velocity_trend = []
        closed_sprints = [s for s in sprints if s.state == "closed"][-6:]

        for sprint in closed_sprints:
            sprint_velocity = await _get_sprint_velocity(sprint, squad, project)
            velocity_trend.append(sprint_velocity)

        # Get current sprint velocity if active
        if current_sprint:
            current_velocity = await _get_sprint_velocity(current_sprint, squad, project)
            velocity_trend.append(current_velocity)

        # Calculate totals from current/active sprint
        total_completed = 0.0
        total_in_progress = 0.0
        total_committed = 0.0

        if velocity_trend:
            latest = velocity_trend[-1]
            total_completed = latest.completed_points
            total_committed = latest.committed_points
            total_in_progress = total_committed - total_completed

        # Calculate average velocity from closed sprints
        completed_velocities = [v.completed_points for v in velocity_trend if v.completed_points > 0]
        avg_velocity = sum(completed_velocities) / len(completed_velocities) if completed_velocities else 0

        # Get story points by team member
        by_member = await _get_story_points_by_member(squad, project)

        result = StoryPointsResponse(
            total_completed=total_completed,
            total_in_progress=total_in_progress,
            total_committed=total_committed,
            velocity_trend=velocity_trend,
            by_member=by_member,
            current_sprint=current_sprint,
            avg_velocity=round(avg_velocity, 1),
        )

        cache_service.cache_set(cache_key, result.model_dump(), ttl=1800)  # 30 min cache
        return result

    except httpx.HTTPError as e:
        logger.error(f"Jira API error in get_story_points: {e}")
        raise


async def _get_sprints(squad: str | None = None, project: str | None = None) -> list[SprintInfo]:
    """Get sprints from Jira boards"""
    settings = get_settings()
    sprints = []

    # Get board IDs for the projects
    projects = settings.jira_projects_for_filter(squad, project)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get boards for projects
        boards_url = f"{settings.jira_base_url}/rest/agile/1.0/board"
        params = {"projectKeyOrId": projects[0]} if projects else {}

        try:
            resp = await client.get(boards_url, headers=_auth_header(), params=params)
            resp.raise_for_status()
            boards_data = resp.json()

            for board in boards_data.get("values", [])[:3]:  # Limit to first 3 boards
                board_id = board.get("id")
                if not board_id:
                    continue

                # Get sprints for this board
                sprints_url = f"{settings.jira_base_url}/rest/agile/1.0/board/{board_id}/sprint"
                sprint_resp = await client.get(sprints_url, headers=_auth_header(), params={"state": "active,closed"})

                if sprint_resp.status_code == 200:
                    sprint_data = sprint_resp.json()
                    for s in sprint_data.get("values", []):
                        sprints.append(SprintInfo(
                            id=s.get("id"),
                            name=s.get("name", ""),
                            state=s.get("state", ""),
                            start_date=s.get("startDate"),
                            end_date=s.get("endDate"),
                        ))
        except Exception as e:
            logger.warning(f"Could not fetch sprints: {e}")

    # Remove duplicates and sort by id
    seen = set()
    unique_sprints = []
    for s in sorted(sprints, key=lambda x: x.id, reverse=True):
        if s.id not in seen:
            seen.add(s.id)
            unique_sprints.append(s)

    return unique_sprints[:10]  # Return last 10 sprints


async def _get_sprint_velocity(sprint: SprintInfo, squad: str | None = None, project: str | None = None) -> SprintVelocity:
    """Get velocity for a specific sprint"""
    base = _projects_jql(squad, project)

    # Story points field - common custom field names
    story_points_field = "customfield_10016"  # Adjust based on your Jira instance

    # Get all issues in sprint
    jql = f'{base} AND sprint = {sprint.id}'
    fields = f"status,{story_points_field},assignee"

    data = await _jql_search(jql, fields, max_results=200)

    committed_points = 0.0
    completed_points = 0.0

    for issue in data.get("issues", []):
        f = issue.get("fields", {})
        points = f.get(story_points_field) or 0
        committed_points += float(points)

        status_category = f.get("status", {}).get("statusCategory", {}).get("key", "")
        if status_category == "done":
            completed_points += float(points)

    completion_rate = (completed_points / committed_points * 100) if committed_points > 0 else 0

    return SprintVelocity(
        sprint_name=sprint.name,
        sprint_id=sprint.id,
        committed_points=committed_points,
        completed_points=completed_points,
        completion_rate=round(completion_rate, 1),
        start_date=sprint.start_date,
        end_date=sprint.end_date,
    )


async def _get_story_points_by_member(squad: str | None = None, project: str | None = None) -> list[MemberStoryPoints]:
    """Get story points breakdown by QA team member"""
    base = _projects_jql(squad, project)
    story_points_field = "customfield_10016"

    members_points: dict[str, MemberStoryPoints] = {}

    # Initialize for all QA members
    for github_name in ALL_QA_MEMBERS:
        jira_name = GITHUB_TO_JIRA_NAME.get(github_name, github_name)
        members_points[jira_name.lower()] = MemberStoryPoints(
            username=github_name,
            jira_name=jira_name,
        )

    # Get issues assigned to QA members in last 30 days
    jql = f'{base} AND assignee is not EMPTY AND updated >= -30d'
    fields = f"status,{story_points_field},assignee"

    data = await _jql_search(jql, fields, max_results=500)

    for issue in data.get("issues", []):
        f = issue.get("fields", {})
        assignee = f.get("assignee", {})
        if not assignee:
            continue

        assignee_name = assignee.get("displayName", "")
        assignee_key = assignee_name.lower()

        if assignee_key not in members_points:
            continue

        points = float(f.get(story_points_field) or 0)
        status_category = f.get("status", {}).get("statusCategory", {}).get("key", "")

        member = members_points[assignee_key]
        member.total_issues += 1

        if status_category == "done":
            member.completed_points += points
            member.issues_completed += 1
        elif status_category == "indeterminate":  # In Progress
            member.in_progress_points += points

    # Filter out members with no activity and sort by completed points
    active_members = [m for m in members_points.values() if m.total_issues > 0]
    active_members.sort(key=lambda x: x.completed_points, reverse=True)

    return active_members
