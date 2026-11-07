"""designPRD 4.6: route by the highest-risk issue that still needs a person."""

import pytest

from app.routing import decide_route, highest_open_risk, needs_authority
from app.schemas import Issue, IssueState, Risk, SourceRef


def issue(risk: Risk, state: IssueState = IssueState.OPEN, kind: str = "guideline") -> Issue:
    return Issue(
        id=f"{risk}-{state}-{kind}",
        risk=risk,
        type="t",
        location=None,
        finding="f",
        explanation="e",
        source=SourceRef(kind=kind, label="l"),
        suggested_fix="x",
        state=state,
    )


def test_no_issues_needs_nobody():
    r = decide_route([])
    assert (r.target, r.hold, r.highest_risk) == ("none", False, None)


def test_low_applied_needs_nobody():
    assert decide_route([issue(Risk.LOW, IssueState.APPLIED)]).target == "none"


def test_low_still_open_waits_for_creator():
    assert decide_route([issue(Risk.LOW)]).target == "creator"


@pytest.mark.parametrize("state", [IssueState.OPEN, IssueState.ACCEPTED, IssueState.REJECTED])
def test_medium_needs_a_permitted_person(state):
    assert decide_route([issue(Risk.MEDIUM, state)]).target == "manager"


def test_medium_auto_applied_needs_nobody():
    assert decide_route([issue(Risk.MEDIUM, IssueState.APPLIED)]).target == "none"


@pytest.mark.parametrize("state", [IssueState.OPEN, IssueState.APPLIED, IssueState.ACCEPTED, IssueState.REJECTED])
def test_high_always_needs_a_reviewer_until_cleared(state):
    r = decide_route([issue(Risk.HIGH, state)])
    assert r.target == "reviewer" and r.hold is False


def test_embargo_is_high_and_holds_publishing():
    r = decide_route([issue(Risk.HIGH, kind="embargo")])
    assert (r.target, r.hold) == ("reviewer", True)
    assert "Restricted information" in r.reason


def test_cleared_embargo_releases_the_hold():
    r = decide_route([issue(Risk.HIGH, IssueState.CLEARED, kind="embargo"), issue(Risk.MEDIUM)])
    assert (r.target, r.hold) == ("manager", False)


def test_high_beats_medium_beats_low():
    mixed = [issue(Risk.LOW), issue(Risk.MEDIUM), issue(Risk.HIGH)]
    assert decide_route(mixed).target == "reviewer"
    assert decide_route(mixed[:2]).target == "manager"


def test_highest_open_risk_ignores_cleared():
    assert highest_open_risk([issue(Risk.HIGH, IssueState.CLEARED), issue(Risk.MEDIUM)]) is Risk.MEDIUM
    assert highest_open_risk([]) is None


def test_low_never_needs_authority():
    assert not needs_authority(issue(Risk.LOW))
