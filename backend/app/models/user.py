"""User and scan history models."""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    github_token = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    scans = relationship("ScanHistory", back_populates="user", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scan_type = Column(String(50), nullable=False)  # discover, search, scan, autoscan
    query = Column(String(500), nullable=True)
    repos_scanned = Column(Integer, default=0)
    issues_found = Column(Integer, default=0)
    issues_passed = Column(Integer, default=0)
    profile = Column(String(50), default="pr_writer")
    language = Column(String(50), default="Python")
    duration_sec = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="scans")
    results = relationship("ScanResult", back_populates="scan", cascade="all, delete-orphan")


class ScanResult(Base):
    __tablename__ = "scan_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(Integer, ForeignKey("scan_history.id"), nullable=False)
    repo = Column(String(255), nullable=False)
    repo_stars = Column(Integer, default=0)
    issue_number = Column(Integer, nullable=False)
    issue_title = Column(String(500), nullable=False)
    issue_url = Column(String(500), nullable=False)
    pr_number = Column(Integer, nullable=True)
    pr_url = Column(String(500), nullable=True)
    score = Column(Float, default=0.0)
    code_files_changed = Column(Integer, default=0)
    total_additions = Column(Integer, default=0)
    total_deletions = Column(Integer, default=0)
    complexity_hint = Column(String(100), nullable=True)
    reasons = Column(Text, nullable=True)  # JSON array
    base_sha = Column(String(64), nullable=True)
    passes = Column(Boolean, default=False)

    scan = relationship("ScanHistory", back_populates="results")


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    repo = Column(String(255), nullable=False)
    issue_number = Column(Integer, nullable=False)
    issue_title = Column(String(500), nullable=False)
    issue_url = Column(String(500), nullable=False)
    score = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="saved")  # saved, working, done, skipped
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="bookmarks")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    repo = Column(String(255), nullable=False)
    issue_number = Column(Integer, nullable=True)
    issue_title = Column(String(500), nullable=True)
    issue_url = Column(String(500), nullable=True)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notifications")
