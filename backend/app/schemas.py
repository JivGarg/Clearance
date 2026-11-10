"""API models. Keep enums in sync with frontend/src/lib/domain.ts and supabase/migrations (DataBasePRD.md)."""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class Risk(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


RISK_RANK: dict[Risk, int] = {Risk.LOW: 1, Risk.MEDIUM: 2, Risk.HIGH: 3}


class Channel(StrEnum):
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"
    LINKEDIN = "linkedin"
    BLOG = "blog"
    EMAIL = "email"
    OTHER = "other"


class IssueState(StrEnum):
    OPEN = "open"
    APPLIED = "applied"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CLEARED = "cleared"


class SubmissionStatus(StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    CHANGES_REQUESTED = "changes_requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    RELEASED = "released"


class AutonomyLevel(StrEnum):
    AUTO_FIX = "auto_fix"
    ASK_FIRST = "ask_first"
    RECOMMEND_ONLY = "recommend_only"


# PRD 5.2 defaults.
DEFAULT_AUTONOMY: dict[Risk, AutonomyLevel] = {
    Risk.LOW: AutonomyLevel.AUTO_FIX,
    Risk.MEDIUM: AutonomyLevel.ASK_FIRST,
    Risk.HIGH: AutonomyLevel.RECOMMEND_ONLY,
}


class SourceRef(BaseModel):
    """What a flag is based on. The label is denormalised so roles without table access still see it."""

    # Matches issues.source_type in the database.
    kind: Literal["guideline", "fact", "asset", "embargo"]
    label: str
    section: str | None = None


class TextLocation(BaseModel):
    kind: Literal["text"] = "text"
    start: int = Field(ge=0)
    end: int = Field(ge=0)


class Issue(BaseModel):
    id: str
    risk: Risk
    type: str
    location: TextLocation | None
    finding: str
    explanation: str
    source: SourceRef
    # Replacement text for the flagged range. None when no automatic fix exists (e.g. blockers).
    suggested_fix: str | None
    state: IssueState
    # Which rule produced this finding, so callers can link it to the company's own knowledge row.
    rule: str | None = None


class Intent(BaseModel):
    goal: str
    audience: str
    key_message: str
    call_to_action: str


class RouteDecision(BaseModel):
    target: Literal["creator", "manager", "reviewer", "none"]
    # True when an active embargo is involved: publishing is held until an authorised reviewer acts.
    hold: bool
    highest_risk: Risk | None
    reason: str


class CheckRequest(BaseModel):
    submission_id: str = Field(min_length=1, max_length=64)
    channel: Channel
    content: str = Field(min_length=1, max_length=50_000)
    autonomy: dict[Risk, AutonomyLevel] | None = None


class CheckResponse(BaseModel):
    submission_id: str
    # The creator must confirm the intent before the result is final (designPRD 4.3).
    intent_confirmed: Literal[False] = False
    intent: Intent
    issues: list[Issue]
    agent_questions: list[str]
    route: RouteDecision
    # Never disguise a mock as a model (designPRD 11.6). Matches ai_checks.service_used.
    mock: Literal[True] = True
    service_used: Literal["mock-rules-v1"] = "mock-rules-v1"
