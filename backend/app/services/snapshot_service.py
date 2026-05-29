import logging
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from app.database import SessionLocal, MetricSnapshot, WeeklyTrend, ReviewerHistory, StoryPointHistory
from app.config import PROJECT_CONFIG
from app.services import jira_service, github_service, reportportal_service

logger = logging.getLogger(__name__)


# Bug-metrics snapshot keys. Stored per (project, quarter) in MetricSnapshot.
# Read by dx_service._get_executive_bug_metrics for the leadership dashboard.
BUG_METRIC_TYPES = ("total_bugs", "resolved_bugs", "open_bugs_canonical", "critical_bugs_canonical", "resolution_rate", "qa_fixed_count")

# ReportPortal automation metrics — stored as a single MetricSnapshot row
# per (None, quarter) carrying the overall numbers, with the per-project
# breakdown serialized into extra_data. RP project namespace differs from
# Jira's, so we don't put RP project keys into the `project` column.
RP_METRIC_TYPE = "rp_automation_health"

# Jira-sourced per-project defect density. Single (None, quarter) row
# carrying the full breakdown in extra_data.
DEFECT_DENSITY_METRIC_TYPE = "defect_density_by_project"

# Live QA roster from Jira's `QA` group. One row at (project=null,
# quarter='ALL') because the roster is org-state, not quarter-scoped.
QA_ROSTER_METRIC_TYPE = "qa_team_roster"

# Full executive-dashboard payload for /api/dx/executive — one row per
# (project, quarter). project=None means ALL. Read path returns sub-100ms
# vs ~7s for the live 9-SQL-per-request path. Refreshed hourly.
EXECUTIVE_METRIC_TYPE = "executive_dashboard_payload"


async def snapshot_executive_metrics_for_quarter(quarter: str) -> None:
    """Refresh the full ExecutiveMetrics payload for ALL + every project.

    The live path runs 9 DX Cloud SQL queries per request (≈7 s). This job
    runs them in the background and stores the JSON payload in
    MetricSnapshot.extra_data so the dashboard read path becomes a single
    Postgres lookup.
    """
    from app.services import dx_service
    from app.config import PROJECT_CONFIG

    db = SessionLocal()
    try:
        today = date.today()
        projects: list[str | None] = [None] + list(PROJECT_CONFIG.keys())  # None = ALL
        for project in projects:
            label = project or "ALL"
            try:
                # Compute live (the function reads from snapshot first; we set
                # use_snapshot=False explicitly to force a fresh compute here).
                metrics = await dx_service.get_executive_dashboard_metrics(
                    quarter, project=project, use_snapshot=False
                )
                _upsert_metric(
                    db, today, project, quarter, EXECUTIVE_METRIC_TYPE,
                    float(metrics.bug_resolution_rate or 0),  # store rate as scalar value
                    extra_data=metrics.model_dump(),
                )
                db.commit()
                logger.info(f"Executive snapshot {quarter}/{label}: open_bugs={metrics.open_bugs} pass_rate={metrics.bug_resolution_rate}")
            except Exception as e:
                logger.error(f"Executive snapshot failed for {quarter}/{label}: {e}")
                db.rollback()
    finally:
        db.close()


def get_latest_executive_metrics(db: Session, project: str | None, quarter: str) -> dict | None:
    """Return latest cached ExecutiveMetrics payload for (project, quarter)."""
    row = db.query(MetricSnapshot).filter(
        MetricSnapshot.project.is_(None) if project is None else MetricSnapshot.project == project,
        MetricSnapshot.quarter == quarter,
        MetricSnapshot.metric_type == EXECUTIVE_METRIC_TYPE,
    ).order_by(MetricSnapshot.snapshot_date.desc(), MetricSnapshot.created_at.desc()).first()
    if not row or not row.extra_data:
        return None
    return row.extra_data


async def snapshot_qa_roster() -> None:
    """Refresh the QA team roster from Jira (active members of the 'QA' group)."""
    db = SessionLocal()
    try:
        today = date.today()
        members = await jira_service.get_qa_team_roster()
        manager = None
        try:
            from app.services import dx_service
            ti = await dx_service.get_team_info()
            if ti:
                manager = {"name": ti.manager_name, "email": ti.manager_email}
        except Exception as e:
            logger.warning(f"Could not fetch DX team lead while snapshotting roster: {e}")
        _upsert_metric(
            db, today, None, "ALL", QA_ROSTER_METRIC_TYPE,
            float(len(members)),
            extra_data={"members": members, "manager": manager},
        )
        db.commit()
        logger.info(f"QA roster snapshot: {len(members)} members from Jira group, manager={(manager or {}).get('name','?')}")
    except Exception as e:
        logger.error(f"QA roster snapshot failed: {e}")
        db.rollback()
    finally:
        db.close()


def get_latest_qa_roster(db: Session) -> dict | None:
    row = db.query(MetricSnapshot).filter(
        MetricSnapshot.project.is_(None),
        MetricSnapshot.quarter == "ALL",
        MetricSnapshot.metric_type == QA_ROSTER_METRIC_TYPE,
    ).order_by(MetricSnapshot.snapshot_date.desc(), MetricSnapshot.created_at.desc()).first()
    if not row or not row.extra_data:
        return None
    return {
        "members": (row.extra_data or {}).get("members") or [],
        "manager": (row.extra_data or {}).get("manager"),
        "count": int(row.value or 0),
        "snapshot_date": row.snapshot_date.isoformat() if row.snapshot_date else None,
    }


async def snapshot_defect_density_for_quarter(quarter: str) -> None:
    """Refresh per-project defect density (Jira API direct).

    Writes a single MetricSnapshot row at (project=None, metric_type=
    'defect_density_by_project'); extra_data carries the full per-project
    list. The DX qa-metrics endpoint reads this and overrides DX Cloud's
    undercount.
    """
    db = SessionLocal()
    try:
        today = date.today()
        rows = await jira_service.get_defect_density_by_project(quarter=quarter)
        # Aggregate: weighted density across all projects
        total_tickets = sum(r["total_tickets"] for r in rows)
        total_bugs = sum(r["bug_count"] for r in rows)
        overall = round((total_bugs / total_tickets) * 100, 2) if total_tickets else 0.0
        _upsert_metric(
            db, today, None, quarter, DEFECT_DENSITY_METRIC_TYPE,
            float(overall),
            extra_data={
                "overall_pct": overall,
                "total_tickets": total_tickets,
                "total_bugs": total_bugs,
                "by_project": rows,
            },
        )
        db.commit()
        logger.info(f"Defect density snapshot {quarter}: overall={overall}% ({total_bugs}/{total_tickets} across {len(rows)} projects)")
    except Exception as e:
        logger.error(f"Defect density snapshot failed for {quarter}: {e}")
        db.rollback()
    finally:
        db.close()


def get_latest_defect_density(db: Session, quarter: str) -> dict | None:
    """Read latest Jira-sourced defect density snapshot for the quarter."""
    row = db.query(MetricSnapshot).filter(
        MetricSnapshot.project.is_(None),
        MetricSnapshot.quarter == quarter,
        MetricSnapshot.metric_type == DEFECT_DENSITY_METRIC_TYPE,
    ).order_by(MetricSnapshot.snapshot_date.desc(), MetricSnapshot.created_at.desc()).first()
    if not row or not row.extra_data:
        return None
    return {
        "overall_pct": (row.extra_data or {}).get("overall_pct", 0.0),
        "total_tickets": (row.extra_data or {}).get("total_tickets", 0),
        "total_bugs": (row.extra_data or {}).get("total_bugs", 0),
        "by_project": (row.extra_data or {}).get("by_project") or [],
        "snapshot_date": row.snapshot_date.isoformat() if row.snapshot_date else None,
    }


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


async def snapshot_automation_metrics_for_quarter(quarter: str) -> None:
    """Refresh ReportPortal automation metrics for one quarter.

    Aggregates pass-rate / duration / flaky% across every RP project listed
    in REPORTPORTAL_PROJECTS, writes one MetricSnapshot row carrying the
    overall pass_rate as `value` and the full per-project breakdown in
    `extra_data`. Read path goes through get_latest_automation_metrics().

    Slow operation (RP API is paged, flaky calc walks /test-item) — keep
    this on the hourly scheduler, not in the request path.
    """
    db = SessionLocal()
    try:
        today = date.today()
        try:
            data = await reportportal_service.get_automation_metrics_for_quarter(quarter, include_flaky=True)
        except Exception as e:
            logger.error(f"RP automation snapshot failed for {quarter}: {e}")
            return

        overall = data.get("overall") or {}
        # value = overall pass rate (the single number used by the KPI tile)
        # extra_data = full payload (overall + by_project) for the chart panels
        _upsert_metric(
            db, today, None, quarter, RP_METRIC_TYPE,
            float(overall.get("pass_rate_pct") or 0.0),
            extra_data={
                "overall": overall,
                "by_project": data.get("by_project") or [],
            },
        )
        db.commit()
        logger.info(
            f"RP automation snapshot {quarter}: overall pass={overall.get('pass_rate_pct')}% "
            f"projects={len(data.get('by_project') or [])} launches={overall.get('total_launches')}"
        )
    finally:
        db.close()


def get_latest_automation_metrics(db: Session, quarter: str) -> dict | None:
    """Return the latest snapshot of RP automation metrics for the given quarter.

    Returns None if no snapshot exists yet (caller should fall back to a live
    fetch). Returns a dict matching reportportal_service.get_automation_metrics
    shape: {quarter, overall, by_project}.
    """
    row = db.query(MetricSnapshot).filter(
        MetricSnapshot.project.is_(None),
        MetricSnapshot.quarter == quarter,
        MetricSnapshot.metric_type == RP_METRIC_TYPE,
    ).order_by(MetricSnapshot.snapshot_date.desc(), MetricSnapshot.created_at.desc()).first()
    if not row or not row.extra_data:
        return None
    return {
        "quarter": quarter,
        "overall": (row.extra_data or {}).get("overall") or {},
        "by_project": (row.extra_data or {}).get("by_project") or [],
        "snapshot_date": row.snapshot_date.isoformat() if row.snapshot_date else None,
    }


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
