import asyncio

from fastapi import APIRouter, Query

from app.mock_checks import SAMPLE_CONTENT, run_mock_checks
from app.schemas import CheckRequest, CheckResponse

router = APIRouter(prefix="/api/checks", tags=["checks"])


@router.post("/run", response_model=CheckResponse)
async def run_checks(
    body: CheckRequest,
    delay_ms: int = Query(
        default=0,
        ge=0,
        le=3000,
        description="Simulated processing time, so the UI can show its Processing state.",
    ),
) -> CheckResponse:
    """MOCK. Returns deterministic, rule-based results shaped like the real pipeline's output.

    NOTE: unauthenticated in Phase 1. Add Supabase JWT verification before this
    endpoint reads or writes real submission data.
    """
    if delay_ms:
        await asyncio.sleep(delay_ms / 1000)
    return run_mock_checks(body.submission_id, body.channel, body.content, body.autonomy)


@router.get("/sample")
def sample_content() -> dict[str, str]:
    """A draft that triggers every risk level. Paste it into a submission to demo the flow."""
    return {"channel": "instagram", "content": SAMPLE_CONTENT}
