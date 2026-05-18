from pydantic import BaseModel


class SquadInfo(BaseModel):
    key: str
    name: str
    jira_projects: list[str]
    repos: list[str]
    members: list[str]


class ProjectInfo(BaseModel):
    key: str
    name: str
    repos: list[str]


class DashboardConfigResponse(BaseModel):
    squads: list[SquadInfo] = []
    projects: list[ProjectInfo] = []
    all_jira_projects: list[str] = []
    all_members: list[str] = []


class JiraActivityItem(BaseModel):
    key: str
    summary: str
    status: str
    issue_type: str
    priority: str
    updated: str
    project: str


class GitHubActivityItem(BaseModel):
    title: str
    number: int
    state: str
    repo: str
    created_at: str
    merged_at: str | None = None
    url: str


class PRReviewItem(BaseModel):
    pr_title: str
    pr_number: int
    repo: str
    state: str  # APPROVED, CHANGES_REQUESTED, COMMENTED
    submitted_at: str
    pr_author: str
    url: str


class MemberActivityResponse(BaseModel):
    username: str
    jira_items: list[JiraActivityItem] = []
    jira_total: int = 0
    github_prs: list[GitHubActivityItem] = []
    github_total: int = 0
    pr_reviews: list[PRReviewItem] = []
    pr_reviews_total: int = 0
    stats: dict = {}


class MemberContribution(BaseModel):
    username: str
    prs_opened: int = 0
    prs_merged: int = 0
    avg_turnaround_hours: float = 0.0
    repos: dict[str, int] = {}


class TeamContributionResponse(BaseModel):
    members: list[MemberContribution] = []
    total_prs: int = 0
    period_days: int = 30


class DefectDensityResponse(BaseModel):
    total_bugs: int = 0
    open_bugs: int = 0
    closed_bugs: int = 0
    by_project: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    by_status: dict[str, int] = {}
    open_high_priority: int = 0
    weekly_inflow: int = 0
    monthly_inflow: int = 0


class AutomationCoverageResponse(BaseModel):
    total_test_tickets: int = 0
    automated_tickets: int = 0
    not_automated_tickets: int = 0
    coverage_percentage: float = 0.0
    by_type: dict[str, int] = {}


class BugItem(BaseModel):
    key: str
    summary: str
    status: str
    priority: str
    created: str
    project: str
    reporter: str = ""


class BugListResponse(BaseModel):
    bugs: list[BugItem] = []
    total: int = 0


class BugPriorityBreakdown(BaseModel):
    by_priority: dict[str, int] = {}
    total: int = 0


class BugStatusBreakdown(BaseModel):
    by_status: dict[str, int] = {}
    total: int = 0


class LaunchStats(BaseModel):
    total_launches: int = 0
    last_launch_status: str = "UNKNOWN"
    avg_pass_rate: float = 0.0
    total_tests_run: int = 0
    total_failed: int = 0
    total_passed: int = 0
    total_skipped: int = 0


class FlakyTest(BaseModel):
    name: str
    failure_count: int
    total_runs: int
    flakiness_rate: float
    last_seen: str


class FlakyTestsResponse(BaseModel):
    tests: list[FlakyTest] = []
    total: int = 0


class LaunchItem(BaseModel):
    name: str
    status: str
    start_time: str
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0


class LaunchListResponse(BaseModel):
    launches: list[LaunchItem] = []


class PassRateTrendItem(BaseModel):
    name: str
    date: str
    pass_rate: float
    total: int


class PassRateTrendResponse(BaseModel):
    launches: list[PassRateTrendItem] = []


class PRTrend(BaseModel):
    week: str
    opened: int = 0
    merged: int = 0
    reviewed: int = 0


class PRTrendsResponse(BaseModel):
    trends: list[PRTrend] = []


class ReviewerStats(BaseModel):
    username: str
    reviews_given: int = 0
    approvals: int = 0
    changes_requested: int = 0
    comments: int = 0


class TeamReviewStatsResponse(BaseModel):
    total_reviews: int = 0
    copilot_reviews: int = 0
    human_reviews: int = 0
    reviewers: list[ReviewerStats] = []
    weekly_trend: list[PRTrend] = []


class PRStats(BaseModel):
    total_prs_last_30d: int = 0
    merged_prs_last_30d: int = 0
    avg_review_turnaround_hours: float = 0.0
    repos: list[str] = []


class PRItem(BaseModel):
    title: str
    number: int
    state: str
    repo: str
    author: str
    created_at: str
    merged_at: str | None = None
    url: str


class RecentPRsResponse(BaseModel):
    prs: list[PRItem] = []
    total: int = 0


class MetricsSummary(BaseModel):
    jira: dict | None = None
    reportportal: dict | None = None
    github: dict | None = None
    errors: dict[str, str] = {}


# Story Points Models
class SprintInfo(BaseModel):
    id: int
    name: str
    state: str  # active, closed, future
    start_date: str | None = None
    end_date: str | None = None


class SprintVelocity(BaseModel):
    sprint_name: str
    sprint_id: int
    committed_points: float = 0
    completed_points: float = 0
    completion_rate: float = 0
    start_date: str | None = None
    end_date: str | None = None


class MemberStoryPoints(BaseModel):
    username: str
    jira_name: str
    completed_points: float = 0
    in_progress_points: float = 0
    total_issues: int = 0
    issues_completed: int = 0


class StoryPointsResponse(BaseModel):
    total_completed: float = 0
    total_in_progress: float = 0
    total_committed: float = 0
    velocity_trend: list[SprintVelocity] = []
    by_member: list[MemberStoryPoints] = []
    current_sprint: SprintInfo | None = None
    avg_velocity: float = 0
