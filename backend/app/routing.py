"""Risk routing (designPRD 4.6). Pure functions: no I/O, easy to test.

- Low: the agent may apply the fix; nobody needs to approve it.
- Medium: the fix is prepared; a permitted person must approve it.
- High: an authorised reviewer must decide; never auto-cleared. An embargo finding also puts
  publishing on hold.

In the database only an authorised reviewer can approve content (DataBasePRD access matrix), so
this route says who must look first; the final approval is always a reviewer decision.
"""

from collections.abc import Iterable

from app.schemas import RISK_RANK, Issue, IssueState, Risk, RouteDecision


def needs_authority(issue: Issue) -> bool:
    """True if a person must act on this issue before the content can be approved."""
    if issue.state is IssueState.CLEARED:
        return False
    if issue.risk is Risk.HIGH:
        return True  # even if a fix was applied or accepted
    if issue.risk is Risk.MEDIUM:
        return issue.state is not IssueState.APPLIED
    return False


def highest_open_risk(issues: Iterable[Issue]) -> Risk | None:
    open_risks = [i.risk for i in issues if i.state is not IssueState.CLEARED]
    return max(open_risks, key=RISK_RANK.__getitem__, default=None)


def decide_route(issues: Iterable[Issue]) -> RouteDecision:
    issues = list(issues)
    highest = highest_open_risk(issues)
    pending = [i for i in issues if needs_authority(i)]
    hold = any(i.source.kind == "embargo" for i in pending)

    if any(i.risk is Risk.HIGH for i in pending):
        return RouteDecision(
            target="reviewer",
            hold=hold,
            highest_risk=highest,
            reason=(
                "Restricted information requires internal review. Publishing is on hold."
                if hold
                else "Has a high-risk issue. Only an authorised reviewer can decide."
            ),
        )
    if any(i.risk is Risk.MEDIUM for i in pending):
        return RouteDecision(
            target="manager",
            hold=False,
            highest_risk=highest,
            reason="Has a medium-risk issue. A permitted person approves the prepared fix.",
        )
    if any(i.state is IssueState.OPEN for i in issues):
        return RouteDecision(
            target="creator",
            hold=False,
            highest_risk=highest,
            reason="Low-risk fixes are waiting for the creator's decision.",
        )
    return RouteDecision(
        target="none",
        hold=False,
        highest_risk=highest,
        reason="No issue needs a person. Ready for a reviewer's sign-off.",
    )
