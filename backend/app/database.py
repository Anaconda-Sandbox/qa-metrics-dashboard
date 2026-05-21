import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Date, JSON, UniqueConstraint, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://qa_dashboard:qa_dashboard_pass@localhost:5432/qa_metrics")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class MetricSnapshot(Base):
    """Stores daily snapshots of key metrics for historical tracking."""
    __tablename__ = "metric_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_date = Column(Date, nullable=False, index=True)
    project = Column(String(50), nullable=True, index=True)  # NULL means ALL projects
    quarter = Column(String(10), nullable=False, index=True)  # e.g., "2026-Q2"
    metric_type = Column(String(50), nullable=False, index=True)
    value = Column(Float, nullable=False)
    extra_data = Column(JSON, nullable=True)  # Extra data like breakdown by type
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('snapshot_date', 'project', 'quarter', 'metric_type', name='uq_metric_snapshot'),
        Index('ix_metric_lookup', 'project', 'quarter', 'metric_type'),
    )


class WeeklyTrend(Base):
    """Stores weekly trend data for charts."""
    __tablename__ = "weekly_trends"

    id = Column(Integer, primary_key=True, index=True)
    week = Column(String(10), nullable=False, index=True)  # e.g., "2026-W20"
    project = Column(String(50), nullable=True, index=True)
    metric_type = Column(String(50), nullable=False, index=True)  # prs_opened, prs_merged, bugs_created, etc.
    value = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('week', 'project', 'metric_type', name='uq_weekly_trend'),
        Index('ix_weekly_lookup', 'project', 'metric_type', 'week'),
    )


class ReviewerHistory(Base):
    """Stores reviewer stats per quarter for comparisons."""
    __tablename__ = "reviewer_history"

    id = Column(Integer, primary_key=True, index=True)
    quarter = Column(String(10), nullable=False, index=True)
    project = Column(String(50), nullable=True, index=True)
    username = Column(String(100), nullable=False, index=True)
    reviews_given = Column(Integer, default=0)
    approvals = Column(Integer, default=0)
    changes_requested = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('quarter', 'project', 'username', name='uq_reviewer_quarter'),
    )


class StoryPointHistory(Base):
    """Stores story point stats per member per quarter."""
    __tablename__ = "story_point_history"

    id = Column(Integer, primary_key=True, index=True)
    quarter = Column(String(10), nullable=False, index=True)
    project = Column(String(50), nullable=True, index=True)
    username = Column(String(100), nullable=False, index=True)
    completed_points = Column(Float, default=0)
    in_progress_points = Column(Float, default=0)
    total_issues = Column(Integer, default=0)
    issues_completed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('quarter', 'project', 'username', name='uq_storypoint_quarter'),
    )


class DXSnapshot(Base):
    """Stores DX survey snapshot metadata."""
    __tablename__ = "dx_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    dx_snapshot_id = Column(String(50), nullable=False, unique=True, index=True)
    quarter = Column(String(10), nullable=False, index=True)
    scheduled_for = Column(Date, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    completed_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    response_rate = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DXMetrics(Base):
    """Stores DX metrics per quarter."""
    __tablename__ = "dx_metrics"

    id = Column(Integer, primary_key=True, index=True)
    quarter = Column(String(10), nullable=False, index=True)
    snapshot_id = Column(String(50), nullable=True, index=True)

    # KPIs
    dex_score = Column(Float, nullable=True)
    quality_score = Column(Float, nullable=True)
    ease_of_delivery = Column(Float, nullable=True)
    weekly_time_loss = Column(Float, nullable=True)

    # Factors
    deep_work = Column(Float, nullable=True)
    build_and_test = Column(Float, nullable=True)
    code_maintainability = Column(Float, nullable=True)
    documentation = Column(Float, nullable=True)
    planning_process = Column(Float, nullable=True)
    cross_team_collaboration = Column(Float, nullable=True)
    incremental_delivery = Column(Float, nullable=True)
    ease_of_release = Column(Float, nullable=True)
    incident_handling = Column(Float, nullable=True)
    ai_code_quality = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('quarter', name='uq_dx_metrics_quarter'),
    )


class DXTeamScore(Base):
    """Stores individual DX team scores for detailed breakdown."""
    __tablename__ = "dx_team_scores"

    id = Column(Integer, primary_key=True, index=True)
    quarter = Column(String(10), nullable=False, index=True)
    snapshot_id = Column(String(50), nullable=True, index=True)
    team_name = Column(String(100), nullable=False, index=True)
    team_id = Column(String(50), nullable=True)
    item_name = Column(String(100), nullable=True)
    item_type = Column(String(20), nullable=True)  # 'kpi' or 'factor'
    score = Column(Float, nullable=True)
    response_count = Column(Integer, default=0)
    vs_prev = Column(Float, nullable=True)
    vs_org = Column(Float, nullable=True)
    vs_50th = Column(Float, nullable=True)
    vs_75th = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('ix_dx_team_scores_lookup', 'quarter', 'team_name', 'item_name'),
    )


class DXDORAMetrics(Base):
    """Stores DORA metrics per quarter (cached)."""
    __tablename__ = "dx_dora_metrics"

    id = Column(Integer, primary_key=True, index=True)
    quarter = Column(String(10), nullable=False, unique=True, index=True)
    deployment_frequency = Column(Float, nullable=True)
    lead_time_for_changes = Column(Float, nullable=True)
    mean_time_to_recovery = Column(Float, nullable=True)
    change_failure_rate = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DXTeamInfo(Base):
    """Stores team info (cached)."""
    __tablename__ = "dx_team_info"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    manager_name = Column(String(100), nullable=True)
    manager_email = Column(String(200), nullable=True)
    contributor_count = Column(Integer, default=0)
    members = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DXBenchmarks(Base):
    """Stores org benchmarks per snapshot (cached)."""
    __tablename__ = "dx_benchmarks"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(String(50), nullable=False, unique=True, index=True)
    benchmarks = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DXQACloudMetrics(Base):
    """Stores QA metrics from DX Data Cloud (cached for fast retrieval)."""
    __tablename__ = "dx_qa_cloud_metrics"

    id = Column(Integer, primary_key=True, index=True)
    quarter = Column(String(10), nullable=False, unique=True, index=True)

    # Quality metrics
    defect_density = Column(Float, nullable=True)
    bug_count_by_priority = Column(JSON, nullable=True)
    bug_resolution_rate = Column(Float, nullable=True)
    reopen_rate = Column(Float, nullable=True)

    # Velocity metrics
    tickets_completed = Column(Integer, default=0)
    cycle_time_avg_hours = Column(Float, nullable=True)
    sprint_completion_rate = Column(Float, nullable=True)
    backlog_size = Column(Integer, default=0)

    # Pipeline metrics
    pipeline_pass_rate = Column(Float, nullable=True)
    pipeline_fail_rate = Column(Float, nullable=True)
    total_pipeline_runs = Column(Integer, default=0)
    avg_pipeline_duration_minutes = Column(Float, nullable=True)

    # AI Adoption
    copilot_active_users = Column(Integer, default=0)
    copilot_acceptance_rate = Column(Float, nullable=True)
    copilot_loc_suggested = Column(Integer, default=0)
    copilot_loc_accepted = Column(Integer, default=0)
    cursor_active_users = Column(Integer, default=0)
    ai_tool_usage = Column(JSON, nullable=True)
    pr_review_stats = Column(JSON, nullable=True)
    defect_density_by_project = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
