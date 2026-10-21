import io
import json
import os
from pathlib import Path
import zipfile

from fastapi import HTTPException, Request, Response

from app.api.router import Router

router = Router(prefix="/tools", tags=["Agent Tools"])


def get_agent_kit_dir() -> Path:
    """Find the agent-kit directory, prioritizing app/agent_kit then repo root."""
    # Priority 1: Inside backend/app/agent_kit (guaranteed in Docker and Render)
    app_dir = Path(__file__).resolve().parent.parent / "agent_kit"
    if app_dir.exists() and app_dir.is_dir():
        return app_dir

    # Priority 2: Traverse parents to find repo root agent-kit
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        candidate = parent / "agent-kit"
        if candidate.exists() and candidate.is_dir():
            return candidate
        candidate_app = parent / "app" / "agent_kit"
        if candidate_app.exists() and candidate_app.is_dir():
            return candidate_app

    return app_dir


@router.get(
    "/agent-kit.zip",
    summary="Download the complete CMMI Agent Toolkit (.zip)",
    response_description="A ready-to-use zip bundle containing MCP server, instructions and configuration templates.",
)
async def download_agent_kit(request: Request):
    """Generates and serves a ZIP archive containing the CMMI MCP server, dependencies,

    quickstart README, and client configuration templates for Claude, ChatGPT, and Cursor.
    """
    agent_kit_dir = get_agent_kit_dir()

    if not agent_kit_dir.exists():
        raise HTTPException(404, "Agent toolkit directory not found on server")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # Include all files in agent-kit at root of archive (strictly required by Claude Skill uploader)
        for root, _, files in os.walk(agent_kit_dir):
            for file in files:
                file_path = Path(root) / file
                archive_name = file_path.relative_to(agent_kit_dir).as_posix()
                zip_file.write(file_path, archive_name)

        # Include dynamically generated OpenAPI 3.1 JSON directly from current app
        try:
            openapi_data = request.app.openapi()
            zip_file.writestr(
                "shared/openapi.json",
                json.dumps(openapi_data, indent=2),
            )
        except Exception:
            pass

    buffer.seek(0)
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="cmmi-agent-kit.zip"',
            "Cache-Control": "no-cache",
        },
    )

