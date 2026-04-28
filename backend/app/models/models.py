from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, Enum, UniqueConstraint
)
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func
import enum


class Base(DeclarativeBase):
    pass


# ── Enums ────────────────────────────────────────────────────────────────────

class PlanEnum(str, enum.Enum):
    free = "free"
    basic = "basic"
    pro = "pro"
    mentor = "mentor"

class DirectionEnum(str, enum.Enum):
    long = "long"
    short = "short"

class KillZoneEnum(str, enum.Enum):
    asia = "asia"
    london = "london"
    ny_open = "ny_open"
    ny_pm = "ny_pm"
    london_close = "london_close"

class SetupEnum(str, enum.Enum):
    fvg = "fvg"
    ob = "ob"
    breaker = "breaker"
    mss = "mss"
    displacement = "displacement"
    liquidity_sweep = "liquidity_sweep"
    rejection_block = "rejection_block"
    sibi = "sibi"
    bisi = "bisi"

class EmotionEnum(str, enum.Enum):
    calm = "calm"
    fomo = "fomo"
    revenge = "revenge"
    fear = "fear"
    confident = "confident"

class GradeEnum(str, enum.Enum):
    a_plus = "a_plus"
    a = "a"
    b = "b"
    c = "c"

class PlaybookStatusEnum(str, enum.Enum):
    active = "active"
    testing = "testing"
    retired = "retired"

class AccessLevelEnum(str, enum.Enum):
    view_stats = "view_stats"
    view_comment = "view_comment"
    full_read = "full_read"

class InviteStatusEnum(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    revoked = "revoked"


# ── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    email      = Column(String(255), unique=True, nullable=False, index=True)
    name       = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    plan       = Column(Enum(PlanEnum), default=PlanEnum.free, nullable=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    accounts   = relationship("Account", back_populates="user", cascade="all, delete")
    playbooks  = relationship("Playbook", back_populates="user", cascade="all, delete")
    notebooks  = relationship("Notebook", back_populates="user", cascade="all, delete")


class Account(Base):
    __tablename__ = "accounts"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(100), nullable=False)
    broker     = Column(String(100))
    currency   = Column(String(10), default="USD")
    balance    = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user       = relationship("User", back_populates="accounts")
    trades     = relationship("Trade", back_populates="account", cascade="all, delete")
    sessions   = relationship("Session", back_populates="account", cascade="all, delete")


class Trade(Base):
    __tablename__ = "trades"

    id          = Column(Integer, primary_key=True, index=True)
    account_id  = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    symbol      = Column(String(20), nullable=False, index=True)
    direction   = Column(Enum(DirectionEnum), nullable=False)
    entry       = Column(Float, nullable=False)
    exit        = Column(Float)
    sl          = Column(Float)
    tp          = Column(Float)
    contracts   = Column(Float, default=1.0)
    pnl         = Column(Float)
    r_multiple  = Column(Float)
    mae         = Column(Float)   # Max Adverse Excursion
    mfe         = Column(Float)   # Max Favorable Excursion
    kill_zone   = Column(Enum(KillZoneEnum))
    setup       = Column(Enum(SetupEnum))
    emotion     = Column(Enum(EmotionEnum))
    grade       = Column(Enum(GradeEnum))
    notes       = Column(Text)
    screenshot_url = Column(String(500))
    entry_time  = Column(DateTime(timezone=True), nullable=False, index=True)
    exit_time   = Column(DateTime(timezone=True))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    account     = relationship("Account", back_populates="trades")
    playbooks   = relationship("Playbook", secondary="trade_playbooks", back_populates="trades")
    comments    = relationship("MentorComment", back_populates="trade", cascade="all, delete")


class Session(Base):
    __tablename__ = "sessions"

    id           = Column(Integer, primary_key=True, index=True)
    account_id   = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    date         = Column(DateTime(timezone=True), nullable=False, index=True)
    notes_pre    = Column(Text)
    notes_post   = Column(Text)
    pnl          = Column(Float, default=0.0)
    trades_count = Column(Integer, default=0)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("account_id", "date"),)

    account = relationship("Account", back_populates="sessions")


class Playbook(Base):
    __tablename__ = "playbooks"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title       = Column(String(200), nullable=False)
    description = Column(Text)
    status      = Column(Enum(PlaybookStatusEnum), default=PlaybookStatusEnum.testing)
    is_public   = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user   = relationship("User", back_populates="playbooks")
    rules  = relationship("PlaybookRule", back_populates="playbook", cascade="all, delete", order_by="PlaybookRule.position")
    trades = relationship("Trade", secondary="trade_playbooks", back_populates="playbooks")


class PlaybookRule(Base):
    __tablename__ = "playbook_rules"

    id          = Column(Integer, primary_key=True, index=True)
    playbook_id = Column(Integer, ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False)
    rule_text   = Column(Text, nullable=False)
    position    = Column(Integer, nullable=False)

    playbook = relationship("Playbook", back_populates="rules")


class TradePlaybook(Base):
    __tablename__ = "trade_playbooks"

    trade_id    = Column(Integer, ForeignKey("trades.id", ondelete="CASCADE"), primary_key=True)
    playbook_id = Column(Integer, ForeignKey("playbooks.id", ondelete="CASCADE"), primary_key=True)


class MentorInvite(Base):
    __tablename__ = "mentor_invites"

    id           = Column(Integer, primary_key=True, index=True)
    trader_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mentor_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    access_level = Column(Enum(AccessLevelEnum), default=AccessLevelEnum.view_stats)
    status       = Column(Enum(InviteStatusEnum), default=InviteStatusEnum.pending)
    token        = Column(String(255), unique=True, nullable=False, index=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())


class MentorComment(Base):
    __tablename__ = "mentor_comments"

    id         = Column(Integer, primary_key=True, index=True)
    mentor_id  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    trade_id   = Column(Integer, ForeignKey("trades.id", ondelete="CASCADE"), nullable=False)
    body       = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    trade = relationship("Trade", back_populates="comments")


class Notebook(Base):
    __tablename__ = "notebooks"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title      = Column(String(200), nullable=False)
    content    = Column(Text)
    template   = Column(String(50))  # pre_market | post_session | weekly
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="notebooks")
