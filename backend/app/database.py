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
