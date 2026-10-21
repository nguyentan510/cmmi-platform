import io
import os
from pathlib import Path
import zipfile

from fastapi import HTTPException, Response

from app.api.router import Router

router = Router(prefix="/tools", tags=["Agent Tools"])


def get_agent_kit_dir() -> Path:
    """Find the agent-kit directory relative to repo root."""
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        candidate = parent / "agent-kit"
        if candidate.exists() and candidate.is_dir():
            return candidate
    return Path("agent-kit").resolve()



@router.get(
    "/agent-kit.zip",
    summary="Download the complete CMMI Agent Toolkit (.zip)",
    response_description="A ready-to-use zip bundle containing MCP server, instructions and configuration templates.",
)
async def download_agent_kit():
    """Generates and serves a ZIP archive containing the CMMI MCP server, dependencies,

    quickstart README, and client configuration templates for Claude, ChatGPT, and Cursor.
    """
    agent_kit_dir = get_agent_kit_dir()
    repo_root = agent_kit_dir.parent
    openapi_file = repo_root / "shared" / "openapi.json"

    if not agent_kit_dir.exists():
        raise HTTPException(404, "Agent toolkit directory not found on server")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # Include all files in agent-kit
        for root, _, files in os.walk(agent_kit_dir):
            for file in files:
                file_path = Path(root) / file
                archive_name = "cmmi-agent-kit/" + file_path.relative_to(agent_kit_dir).as_posix()
                zip_file.write(file_path, archive_name)

        # Include shared/openapi.json
        if openapi_file.exists():
            zip_file.write(openapi_file, "cmmi-agent-kit/shared/openapi.json")

    buffer.seek(0)
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="cmmi-agent-kit.zip"',
            "Cache-Control": "no-cache",
        },
    )
