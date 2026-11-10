from fastapi.testclient import TestClient

from app.main import app
from app.mock_checks import SAMPLE_CONTENT, run_mock_checks
from app.schemas import AutonomyLevel, Channel, IssueState, Risk

client = TestClient(app)


def run(content: str, channel: Channel = Channel.INSTAGRAM, **kw):
    return run_mock_checks("sub-1", channel, content, **kw)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_sample_triggers_every_risk_level_and_holds():
    res = run(SAMPLE_CONTENT)
    assert {i.risk for i in res.issues} == set(Risk)
    assert (res.route.target, res.route.hold) == ("reviewer", True)


def test_result_is_labelled_as_a_mock():
    res = run(SAMPLE_CONTENT)
    assert res.mock is True and res.service_used == "mock-rules-v1"
    assert res.intent_confirmed is False


def test_issues_sorted_highest_risk_first():
    rank = {Risk.HIGH: 3, Risk.MEDIUM: 2, Risk.LOW: 1}
    ranks = [rank[i.risk] for i in run(SAMPLE_CONTENT).issues]
    assert ranks == sorted(ranks, reverse=True)


def test_every_issue_has_explanation_source_and_real_location():
    for i in run(SAMPLE_CONTENT).issues:
        assert i.explanation.strip() and i.source.label.strip()
        assert i.source.kind in {"guideline", "fact", "asset", "embargo"}
        assert i.location is not None and SAMPLE_CONTENT[i.location.start : i.location.end].strip()


def test_wrong_battery_claim_cites_the_approved_fact():
    # designPRD section 10 walkthrough: approved 50 hours, reel claims 60.
    (claim,) = [i for i in run("Get 60 hours of battery life.").issues if i.type == "Incorrect fact"]
    assert claim.risk is Risk.HIGH and claim.source.kind == "fact" and "50 hours" in claim.source.label
    assert run("Get 50 hours of battery life.").issues == []


def test_embargo_finding_never_echoes_the_codename():
    (nova,) = run("Sneak peek of Project Nova.").issues
    assert nova.source.kind == "embargo" and nova.suggested_fix is None
    assert "Nova" not in nova.finding and "Nova" not in nova.source.label


def test_low_risk_fixes_are_applied_by_default():
    (cheap,) = run("This is a cheap pair.").issues
    assert (cheap.risk, cheap.state, cheap.suggested_fix) == (Risk.LOW, IssueState.APPLIED, "affordable")


def test_low_risk_stays_open_when_recommend_only():
    res = run("This is a cheap pair.", autonomy={Risk.LOW: AutonomyLevel.RECOMMEND_ONLY})
    assert res.issues[0].state is IssueState.OPEN and res.route.target == "creator"


def test_medium_is_prepared_not_applied():
    (tone,) = run("OMG this is great.").issues
    assert tone.risk is Risk.MEDIUM and tone.state is IssueState.OPEN and tone.suggested_fix
    assert run("OMG this is great.").route.target == "manager"


def test_high_is_never_auto_applied_even_with_auto_fix():
    res = run(SAMPLE_CONTENT, autonomy={r: AutonomyLevel.AUTO_FIX for r in Risk})
    assert all(i.state is IssueState.OPEN for i in res.issues if i.risk is Risk.HIGH)
    assert res.route.target == "reviewer"


def test_wrong_discount_raises_high_issue_and_an_agent_question():
    res = run("Students get 25% off today.")
    assert any(i.type == "Wrong price or discount" and i.risk is Risk.HIGH for i in res.issues)
    assert res.agent_questions == ["Is the student discount 20% or 25%?"]


def test_ad_disclosure_on_social_only_and_not_when_present():
    promo = "Use code STUDENT20 for a free pair."
    assert any(i.type == "Missing ad disclosure" for i in run(promo).issues)
    assert not any(i.type == "Missing ad disclosure" for i in run(promo, Channel.BLOG).issues)
    assert not any(i.type == "Missing ad disclosure" for i in run("#ad " + promo).issues)


def test_product_name_flags_wrong_forms_only():
    flagged = lambda text: [i for i in run(text).issues if i.type == "Terminology"]  # noqa: E731
    assert flagged("The Sonic X1 is here.") == []
    assert len(flagged("SonicX 1, SonicX1, Sonic-X1 and sonic x1.")) == 4


def test_clean_content_needs_nobody():
    res = run("The Sonic X1 has 50 hours of battery. Learn more on our site.")
    assert res.issues == [] and res.route.target == "none"


def test_results_are_deterministic_and_ids_are_per_submission():
    assert run(SAMPLE_CONTENT).model_dump() == run(SAMPLE_CONTENT).model_dump()
    a = run_mock_checks("sub-1", Channel.INSTAGRAM, "cheap")
    b = run_mock_checks("sub-2", Channel.INSTAGRAM, "cheap")
    assert a.issues[0].id != b.issues[0].id


def test_intent_is_detected():
    res = run("Join the club. Use code STUDENT20 today.", Channel.EMAIL)
    assert (res.intent.goal, res.intent.audience) == ("Drive sign-ups with an offer", "Existing subscribers")
    assert res.intent.key_message == "Join the club." and res.intent.call_to_action == "Use code STUDENT20"


def test_api_contract():
    r = client.post("/api/checks/run", json={"submission_id": "s1", "channel": "instagram", "content": SAMPLE_CONTENT})
    body = r.json()
    assert r.status_code == 200 and body["mock"] is True and body["route"]["hold"] is True
    assert {"intent", "issues", "agent_questions", "route", "service_used"} <= body.keys()


def test_api_validation():
    bad = [
        {"submission_id": "s", "channel": "tiktok", "content": "x"},
        {"submission_id": "s", "channel": "blog", "content": ""},
    ]
    for body in bad:
        assert client.post("/api/checks/run", json=body).status_code == 422
    assert client.post("/api/checks/run?delay_ms=999999",
                       json={"submission_id": "s", "channel": "blog", "content": "hi"}).status_code == 422


def test_sample_endpoint():
    assert client.get("/api/checks/sample").json()["content"] == SAMPLE_CONTENT


def test_cors_allows_only_the_frontend_origin():
    def preflight(origin):
        return client.options("/api/checks/run",
                              headers={"Origin": origin, "Access-Control-Request-Method": "POST"})
    assert preflight("http://localhost:3000").headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "access-control-allow-origin" not in preflight("https://evil.example").headers


def test_every_issue_names_its_rule():
    from app.mock_checks import SAMPLE_CONTENT, run_mock_checks
    from app.schemas import Channel

    result = run_mock_checks("s-rule", Channel.INSTAGRAM, SAMPLE_CONTENT)
    assert result.issues and all(i.rule for i in result.issues)
    assert {"embargo", "battery-claim", "product-name"} <= {i.rule for i in result.issues}
