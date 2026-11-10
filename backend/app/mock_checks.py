"""MOCK check engine: deterministic regex rules standing in for the real AI pipeline.

Labelled as a mock everywhere (response.mock, service_used = "mock-rules-v1") so it can never be
mistaken for model output (designPRD 11.6). Same input gives the same output, including issue ids.
The response shape (CheckResponse) is the contract the real pipeline must keep.

Rules cite the fictional demo brand "Sonic X Audio" and its seeded knowledge (supabase/seed.sql):
guidelines, the "50 hours battery" fact, the 20% student discount, the 2026 logo and the
Project Nova embargo (designPRD section 10).
"""

import re
import uuid
from dataclasses import dataclass

from app.routing import decide_route
from app.schemas import (
    DEFAULT_AUTONOMY,
    RISK_RANK,
    AutonomyLevel,
    Channel,
    CheckResponse,
    Intent,
    Issue,
    IssueState,
    Risk,
    SourceRef,
    TextLocation,
)

_ID_NAMESPACE = uuid.UUID("6f1c2f0e-8b0a-4c52-9a53-2f2f2f2f2f2f")


@dataclass(frozen=True)
class Rule:
    key: str
    pattern: re.Pattern[str]
    risk: Risk
    type: str
    finding: str  # may use {match}
    explanation: str
    source: SourceRef
    fix: str | None  # replacement for the matched range; None = no automatic fix
    channels: frozenset[Channel] | None = None  # None = every channel


def _re(p: str, flags: int = re.IGNORECASE) -> re.Pattern[str]:
    return re.compile(p, flags)


_SOCIAL = frozenset({Channel.INSTAGRAM, Channel.YOUTUBE, Channel.LINKEDIN})

RULES: tuple[Rule, ...] = (
    # ---------------------------------------------------------------- LOW
    Rule(
        key="product-name",
        # Wrong forms of the product name; the approved "Sonic X1" itself never matches.
        pattern=_re(r"\bSonicX\s?1\b|\bSonic-X1\b|\bsonic x1\b", 0),
        risk=Risk.LOW,
        type="Terminology",
        finding='"{match}" is not the approved product name.',
        explanation='The product is always written "Sonic X1".',
        source=SourceRef(kind="guideline", label="Terminology", section="Product names"),
        fix="Sonic X1",
    ),
    Rule(
        key="banned-word",
        pattern=_re(r"\bcheap\b"),
        risk=Risk.LOW,
        type="Banned word",
        finding='"{match}" is on the banned words list.',
        explanation="The brand positions itself as good value, never as cheap.",
        source=SourceRef(kind="guideline", label="Terminology", section="Banned words"),
        fix="affordable",
    ),
    Rule(
        key="hashtag",
        pattern=_re(r"#SonicSummer\b", 0),
        risk=Risk.LOW,
        type="Wrong hashtag",
        finding='"{match}" is not the campaign hashtag.',
        explanation="The Summer Sound campaign uses #SummerSound.",
        source=SourceRef(kind="guideline", label="Social playbook", section="Hashtags"),
        fix="#SummerSound",
        channels=_SOCIAL,
    ),
    Rule(
        key="alt-text",
        pattern=_re(r"\[image\]"),
        risk=Risk.LOW,
        type="Accessibility",
        finding="An image is included without alt text.",
        explanation="Every image needs a short description for people using screen readers.",
        source=SourceRef(kind="guideline", label="Accessibility", section="Images and video"),
        fix='[image alt="Describe the image"]',
    ),
    # ------------------------------------------------------------- MEDIUM
    Rule(
        key="tone",
        pattern=_re(r"\b(?:omg|literally the best|insane(?:ly)?|you guys)\b"),
        risk=Risk.MEDIUM,
        type="Tone mismatch",
        finding='"{match}" is more casual than the brand voice allows.',
        explanation="Sonic X sounds confident and clear, not hyped.",
        source=SourceRef(kind="guideline", label="Brand voice", section="Confident, not hyped"),
        fix="a great choice",
    ),
    Rule(
        key="logo",
        pattern=_re(r"\[logo:\s*(?:old|2022)\]"),
        risk=Risk.MEDIUM,
        type="Outdated logo",
        finding="The retired 2022 logo is used.",
        explanation="Only the 2026 logo may appear in new content.",
        source=SourceRef(kind="asset", label="Sonic X logo 2026 (approved)"),
        fix="[logo: 2026]",
    ),
    # --------------------------------------------------------------- HIGH
    Rule(
        key="battery-claim",
        pattern=_re(r"\b(?!50\b)\d{2,3}\s?(?:hours|hrs)\s+(?:of\s+)?battery(?:\s+life)?"),
        risk=Risk.HIGH,
        type="Incorrect fact",
        finding='"{match}" does not match the approved battery life.',
        explanation="The approved figure is 50 hours. A wrong product claim is misleading advertising.",
        source=SourceRef(kind="fact", label="Fact: Sonic X1 battery life is 50 hours"),
        fix="50 hours of battery",
    ),
    Rule(
        key="health-claim",
        pattern=_re(
            r"\bfall asleep faster\b|\bimproves?\s+(?:your\s+)?hearing\b|\bclinically proven\b"
            r"|\b(?:cures?|treats?|prevents?)\s+[a-z]+|\bboosts?\s+(?:your\s+)?(?:focus|immunity)\b"
        ),
        risk=Risk.HIGH,
        type="Health claim",
        finding='"{match}" makes a health claim.',
        explanation="No health or medical claims about listening, hearing or sleep are allowed.",
        source=SourceRef(kind="guideline", label="Claims policy", section="No health claims"),
        fix="sounds great",
    ),
    Rule(
        key="discount-mismatch",
        pattern=_re(r"\b25\s?%\s*(?:off|discount|student discount)\b"),
        risk=Risk.HIGH,
        type="Wrong price or discount",
        finding='"{match}" does not match the approved student discount.',
        explanation="The approved student discount is 20%. A wrong offer is a financial claim.",
        source=SourceRef(kind="fact", label="Fact: student discount is 20%"),
        fix="20% off",
    ),
    Rule(
        key="ad-disclosure",
        pattern=_re(r"\b(?:use code|discount code|gifted|free pair)\b"),
        risk=Risk.HIGH,
        type="Missing ad disclosure",
        finding="Promotional content has no ad disclosure.",
        explanation="Posts that promote a code or a gifted product must be labelled as advertising (#ad).",
        source=SourceRef(kind="guideline", label="Disclosure", section="Label paid content"),
        fix=None,  # handled specially: an instruction, not a range replacement
        channels=_SOCIAL,
    ),
    # --------------------------------------------- HIGH + HOLD (embargo)
    Rule(
        key="embargo",
        pattern=_re(r"\bProject Nova\b|\bNova headphones\b"),
        risk=Risk.HIGH,
        type="Embargoed item",
        finding="Restricted information requires internal review.",  # never echo the codename
        explanation="This content mentions an item under embargo. Publishing is held until an authorised reviewer acts.",
        source=SourceRef(kind="embargo", label="Embargo"),
        fix=None,
    ),
)

_DISCLOSURE_TAGS = re.compile(r"#ad\b|#sponsored\b|paid partnership", re.IGNORECASE)

SAMPLE_CONTENT = (
    "OMG you guys, the new SonicX 1 is the cheap way to get 60 hours of battery! "
    "It helps you fall asleep faster. "
    "Students get 25% off with our discount code STUDENT20. "
    "Sneak peek of Project Nova coming soon. #SonicSummer [image] [logo: old]"
)


def _issue_id(submission_id: str, rule_key: str, start: int) -> str:
    return str(uuid.uuid5(_ID_NAMESPACE, f"{submission_id}:{rule_key}:{start}"))


def _initial_state(rule: Rule, autonomy: dict[Risk, AutonomyLevel]) -> IssueState:
    """Auto-fix applies the fix now, but only for Low and Medium.

    High is never auto-applied whatever the admin sets: high-risk decisions need an
    authorised reviewer and must never auto-clear (designPRD 4.6).
    """
    if (
        rule.risk in (Risk.LOW, Risk.MEDIUM)
        and autonomy[rule.risk] is AutonomyLevel.AUTO_FIX
        and rule.fix is not None
    ):
        return IssueState.APPLIED
    return IssueState.OPEN


def _find_issues(
    submission_id: str, channel: Channel, content: str, autonomy: dict[Risk, AutonomyLevel]
) -> list[Issue]:
    issues: list[Issue] = []
    for rule in RULES:
        if rule.channels is not None and channel not in rule.channels:
            continue

        if rule.key == "ad-disclosure":
            if _DISCLOSURE_TAGS.search(content):
                continue
            match = rule.pattern.search(content)
            if not match:
                continue
            issues.append(
                Issue(
                    id=_issue_id(submission_id, rule.key, match.start()),
                    risk=rule.risk,
                    type=rule.type,
                    location=TextLocation(start=match.start(), end=match.end()),
                    finding=rule.finding,
                    explanation=rule.explanation,
                    source=rule.source,
                    suggested_fix="Add #ad at the start of the caption.",
                    state=IssueState.OPEN,
                    rule=rule.key,
                )
            )
            continue

        for match in rule.pattern.finditer(content):
            issues.append(
                Issue(
                    id=_issue_id(submission_id, rule.key, match.start()),
                    risk=rule.risk,
                    type=rule.type,
                    location=TextLocation(start=match.start(), end=match.end()),
                    finding=rule.finding.format(match=match.group(0)),
                    explanation=rule.explanation,
                    source=rule.source,
                    suggested_fix=rule.fix,
                    state=_initial_state(rule, autonomy),
                    rule=rule.key,
                )
            )

    # Highest risk first, then reading order.
    issues.sort(key=lambda i: (-RISK_RANK[i.risk], i.location.start if i.location else 0))
    return issues


_AUDIENCE: dict[Channel, str] = {
    Channel.INSTAGRAM: "Young adults following the brand on Instagram",
    Channel.YOUTUBE: "Viewers who watch audio gear reviews",
    Channel.LINKEDIN: "Professionals, partners and retailers",
    Channel.BLOG: "Readers researching headphones",
    Channel.EMAIL: "Existing subscribers",
    Channel.OTHER: "General audience",
}

_CTA = re.compile(
    r"(?:use code\s+\w+|link in bio|shop now|learn more|subscribe|sign up|read more)", re.IGNORECASE
)


def _detect_intent(channel: Channel, content: str) -> Intent:
    first_sentence = re.split(r"(?<=[.!?])\s", content.strip(), maxsplit=1)[0]
    key_message = first_sentence if len(first_sentence) <= 140 else first_sentence[:137].rstrip() + "..."
    cta = _CTA.search(content)
    offer = bool(re.search(r"\b(?:discount|code|offer|% off|free)\b", content, re.IGNORECASE))
    return Intent(
        goal="Drive sign-ups with an offer" if offer else "Build awareness of the product",
        audience=_AUDIENCE[channel],
        key_message=key_message,
        call_to_action=cta.group(0) if cta else "None detected",
    )


def _agent_questions(content: str) -> list[str]:
    """A claim that cannot be matched to one approved fact becomes a question for an admin."""
    if re.search(r"\b25\s?%\s*(?:off|discount|student discount)\b", content, re.IGNORECASE):
        return ["Is the student discount 20% or 25%?"]
    return []


def run_mock_checks(
    submission_id: str,
    channel: Channel,
    content: str,
    autonomy: dict[Risk, AutonomyLevel] | None = None,
) -> CheckResponse:
    # Merge over defaults so a partial map from the client cannot drop a level.
    effective = {**DEFAULT_AUTONOMY, **(autonomy or {})}
    issues = _find_issues(submission_id, channel, content, effective)
    return CheckResponse(
        submission_id=submission_id,
        intent=_detect_intent(channel, content),
        issues=issues,
        agent_questions=_agent_questions(content),
        route=decide_route(issues),
    )
