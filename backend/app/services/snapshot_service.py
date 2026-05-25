import logging
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from app.database import SessionLocal, MetricSnapshot, WeeklyTrend, ReviewerHistory, StoryPointHistory
from app.config import PROJECT_CONFIG
from app.services import jira_service, github_service

logger = logging.getLogger(__name__)


# Bug-metrics snapshot keys. Stored per (project, quarter) in MetricSnapshot.
# Read by dx_service._get_executive_bug_metrics for the leadership dashboard.
BUG_METRIC_TYPES = ("total_bugs", "resolved_bugs", "open_bugs_canonical", "critical_bugs_canonical", "resolution_rate", "qa_fixed_count")


async def snapshot_qa_bug_metrics_for_quarter(quarter: str) -> None:
    """Refresh QA-team bug metrics for one quarter, every project + ALL.

    Uses Jira API directly (canonical query: creator OR reporter in QA,
    completed_at via resolutiondate, priority in (Highest, High) for critical).
    Hits all 17+ projects so the leadership dashboard can read instantly from
    MetricSnapshot regardless of which project is selected.
    """
    db = SessionLocal()
    try:
        today = date.today()
        projects: list[str | None] = [None] + list(PROJECT_CONFIG.keys())  # None = ALL

        for project in projects:
            label = project or "ALL"
            try:
                metrics = await jira_service.get_qa_bug_metrics(quarter=quarter, project=project)
                qa_fixed = await jira_service.get_qa_fixed_count(quarter=quarter, project=project)
                _upsert_metric(db, today, project, quarter, "total_bugs", metrics["total"])
                _upsert_metric(db, today, project, quarter, "resolved_bugs", metrics["resolved"])
                _upsert_metric(db, today, project, quarter, "open_bugs_canonical", metrics["open"])
                _upsert_metric(db, today, project, quarter, "critical_bugs_canonical", metrics["critical_open"])
                _upsert_metric(db, today, project, quarter, "resolution_rate", metrics["resolution_rate"])
                _upsert_metric(db, today, project, quarter, "qa_fixed_count", qa_fixed)
                db.commit()
                logger.info(f"Bug snapshot {quarter}/{label}: total={metrics['total']} resolved={metrics['resolved']} qa_fixed={qa_fixed} rate={metrics['resolution_rate']}%")
            except Exception as e:
                logger.error(f"Bug snapshot failed for {quarter}/{label}: {e}")
                db.rollback()
    finally:
        db.close()


def get_latest_bug_metrics(db: Session, project: str | None, quarter: str) -> dict | None:
    """Return the latest snapshot of bug metrics for (project, quarter), or None.

    Caller should treat None as 'snapshot missing — fall back to a live query'.
    """
    rows = db.query(MetricSnapshot).filter(
        MetricSnapshot.project == project,
        MetricSnapshot.quarter == quarter,
        MetricSnapshot.metric_type.in_(BUG_METRIC_TYPES),
    ).order_by(MetricSnapshot.snapshot_date.desc(), MetricSnapshot.created_at.desc()).all()

    if not rows:
        return None

    # Take the most recent value for each metric_type
    out: dict[str, float] = {}
    seen: set[str] = set()
    for r in rows:
        if r.metric_type in seen:
            continue
        seen.add(r.metric_type)
        out[r.metric_type] = r.value
        if len(seen) == len(BUG_METRIC_TYPES):
            break

    # Need at least total + resolution_rate to be useful
    if "total_bugs" not in out or "resolution_rate" not in out:
        return None

    latest_date = rows[0].snapshot_date
    return {
        "total_bugs": int(out.get("total_bugs", 0)),
        "resolved_bugs": int(out.get("resolved_bugs", 0)),
        "open_bugs": int(out.get("open_bugs_canonical", 0)),
        "critical_bugs": int(out.get("critical_bugs_canonical", 0)),
        "resolution_rate": float(out.get("resolution_rate", 0)),
        "qa_fixed_count": int(out.get("qa_fixed_count", 0)),
        "snapshot_date": latest_date.isoformat() if latest_date else None,
    }


async def take_daily_snapshot(quarter: str):
    """Take a daily snapshot of all metrics for all projects."""
    db = SessionLocal()
    try:
        today = date.today()
        projects = [None] + list(PROJECT_CONFIG.keys())  # None = ALL projects

        for project in projects:
            project_key = project or "ALL"
            logger.info(f"Taking snapshot for project={project_key}, quarter={quarter}")

            try:
                # Defect density / open bugs
                density = await jira_service.get_defect_density(None, project, quarter, use_cache=False)
                _upsert_metric(db, today, project, quarter, "open_bugs", density.open_bugs)
                _upsert_metric(db, today, project, quarter, "open_high_priority", density.open_high_priority)
                _upsert_metric(db, today, project, quarter, "total_bugs", density.total_bugs)
                _upsert_metric(db, today, project, quarter, "closed_bugs", density.closed_bugs)

                # Automation coverage
                coverage = await jira_service.get_automation_coverage(None, project, quarter, use_cache=False)
                _upsert_metric(db, today, project, quarter, "automation_coverage", coverage.coverage_percentage, {
                    "automated": coverage.automated_tickets,
                    "total": coverage.total_test_tickets,
                    "by_type": coverage.by_type
                })

                # PR stats
                pr_stats = await github_service.get_pr_stats(None, project, quarter, use_cache=False)
                _upsert_metric(db, today, project, quarter, "prs_opened", pr_stats.total_prs_last_30d)
                _upsert_metric(db, today, project, quarter, "prs_merged", pr_stats.merged_prs_last_30d)
                _upsert_metric(db, today, project, quarter, "pr_turnaround_hours", pr_stats.avg_review_turnaround_hours)

                # Story points
                story_points = await jira_service.get_story_points(None, project, quarter, use_cache=False)
                _upsert_metric(db, today, project, quarter, "story_points_completed", story_points.total_completed)
                _upsert_metric(db, today, project, quarter, "story_points_in_progress", story_points.total_in_progress)
                _upsert_metric(db, today, project, quarter, "avg_velocity", story_points.avg_velocity)

                # Store story points by member
                for member in story_points.by_member:
                    _upsert_story_point_history(db, quarter, project, member)

                # Review stats
                review_stats = await github_service.get_team_review_stats(None, project, quarter=quarter, use_cache=False)
                _upsert_metric(db, today, project, quarter, "total_reviews", review_stats.total_reviews)
                _upsert_metric(db, today, project, quarter, "human_reviews", review_stats.human_reviews)
                _upsert_metric(db, today, project, quarter, "copilot_reviews", review_stats.copilot_reviews)

                # Store reviewer history
                for reviewer in review_stats.reviewers:
                    _upsert_reviewer_history(db, quarter, project, reviewer)

                # Store weekly trends
                pr_trends = await github_service.get_pr_trends(None, project, quarter, use_cache=False)
                for trend in pr_trends.trends:
                    _upsert_weekly_trend(db, trend.week, project, "prs_opened", trend.opened)
                    _upsert_weekly_trend(db, trend.week, project, "prs_merged", trend.merged)

                for trend in review_stats.weekly_trend:
                    _upsert_weekly_trend(db, trend.week, project, "reviews", trend.reviewed)

                # Defect trends
                for trend in density.weekly_trend:
                    _upsert_weekly_trend(db, trend.week, project, "bugs_created", trend.created)
                    _upsert_weekly_trend(db, trend.week, project, "bugs_resolved", trend.resolved)

                db.commit()
                logger.info(f"Snapshot complete for project={project_key}")

            except Exception as e:
                logger.error(f"Error taking snapshot for {project_key}: {e}")
                db.rollback()
                continue

    finally:
        db.close()


def _upsert_metric(db: Session, snapshot_date: date, project: str | None, quarter: str, metric_type: str, value: float, extra_data: dict | None = None):
    """Insert or update a metric snapshot."""
    stmt = insert(MetricSnapshot).values(
        snapshot_date=snapshot_date,
        project=project,
        quarter=quarter,
        metric_type=metric_type,
        value=value,
        extra_data=extra_data
    ).on_conflict_do_update(
        constraint='uq_metric_snapshot',
        set_={'value': value, 'extra_data': extra_data, 'created_at': datetime.utcnow()}
    )
    db.execute(stmt)


def _upsert_weekly_trend(db: Session, week: str, project: str | None, metric_type: str, value: int):
    """Insert or update a weekly trend."""
    stmt = insert(WeeklyTrend).values(
        week=week,
        project=project,
        metric_type=metric_type,
        value=value
    ).on_conflict_do_update(
        constraint='uq_weekly_trend',
        set_={'value': value, 'updated_at': datetime.utcnow()}
    )
    db.execute(stmt)


def _upsert_reviewer_history(db: Session, quarter: str, project: str | None, reviewer):
    """Insert or update reviewer history."""
    stmt = insert(ReviewerHistory).values(
        quarter=quarter,
        project=project,
        username=reviewer.username,
        reviews_given=reviewer.reviews_given,
        approvals=reviewer.approvals,
        changes_requested=reviewer.changes_requested,
        comments=reviewer.comments
    ).on_conflict_do_update(
        constraint='uq_reviewer_quarter',
        set_={
            'reviews_given': reviewer.reviews_given,
            'approvals': reviewer.approvals,
            'changes_requested': reviewer.changes_requested,
            'comments': reviewer.comments,
            'updated_at': datetime.utcnow()
        }
    )
    db.execute(stmt)


def _upsert_story_point_history(db: Session, quarter: str, project: str | None, member):
    """Insert or update story point history."""
    stmt = insert(StoryPointHistory).values(
        quarter=quarter,
        project=project,
        username=member.username,
        completed_points=member.completed_points,
        in_progress_points=member.in_progress_points,
        total_issues=member.total_issues,
        issues_completed=member.issues_completed
    ).on_conflict_do_update(
        constraint='uq_storypoint_quarter',
        set_={
            'completed_points': member.completed_points,
            'in_progress_points': member.in_progress_points,
            'total_issues': member.total_issues,
            'issues_completed': member.issues_completed,
            'updated_at': datetime.utcnow()
        }
    )
    db.execute(stmt)


def get_metric_history(db: Session, project: str | None, quarter: str, metric_type: str, days: int = 30):
    """Get historical metric values for trend analysis."""
    return db.query(MetricSnapshot).filter(
        MetricSnapshot.project == project,
        MetricSnapshot.quarter == quarter,
        MetricSnapshot.metric_type == metric_type
    ).order_by(MetricSnapshot.snapshot_date.desc()).limit(days).all()


def get_weekly_trends(db: Session, project: str | None, metric_type: str, weeks: int = 12):
    """Get weekly trend data from database."""
    return db.query(WeeklyTrend).filter(
        WeeklyTrend.project == project,
        WeeklyTrend.metric_type == metric_type
    ).order_by(WeeklyTrend.week.desc()).limit(weeks).all()


def get_quarter_comparison(db: Session, project: str | None, metric_type: str, quarter1: str, quarter2: str):
    """Compare a metric between two quarters."""
    q1 = db.query(MetricSnapshot).filter(
        MetricSnapshot.project == project,
        MetricSnapshot.quarter == quarter1,
        MetricSnapshot.metric_type == metric_type
    ).order_by(MetricSnapshot.snapshot_date.desc()).first()

    q2 = db.query(MetricSnapshot).filter(
        MetricSnapshot.project == project,
        MetricSnapshot.quarter == quarter2,
        MetricSnapshot.metric_type == metric_type
    ).order_by(MetricSnapshot.snapshot_date.desc()).first()

    return {
        "quarter1": {"quarter": quarter1, "value": q1.value if q1 else None},
        "quarter2": {"quarter": quarter2, "value": q2.value if q2 else None},
        "change": (q1.value - q2.value) if (q1 and q2) else None,
        "change_percent": ((q1.value - q2.value) / q2.value * 100) if (q1 and q2 and q2.value != 0) else None
    }
