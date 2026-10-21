import io
import json
import os
from pathlib import Path
from typing import Optional
import zipfile

from fastapi import HTTPException, Query, Request, Response
from fastapi.responses import PlainTextResponse

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


def resolve_request_base_url(request: Request, custom_url: Optional[str] = None) -> str:
    """Dynamically determine the backend base URL from incoming request headers."""
    target_url = (custom_url or "").strip().rstrip("/")
    placeholder_values = {
        "",
        "auto",
        "{base-url}",
        "{base_url}",
        "${base-url}",
        "${base_url}",
        "<base-url>",
        "<base_url>",
    }
    if target_url.lower() in placeholder_values:
        forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        forwarded_host = request.headers.get("x-forwarded-host", request.url.netloc)
        target_url = f"{forwarded_proto}://{forwarded_host}".rstrip("/")
        if "0.0.0.0" in target_url:
            target_url = target_url.replace("0.0.0.0", "localhost")
    return target_url


def inject_dynamic_variables(content: str, target_url: str, target_api_key: str) -> str:
    """Dynamically injects active server URL and API key into templates containing {BASE-URL}."""
    for p in ("{BASE-URL}", "{BASE_URL}", "https://cmmi-backend.onrender.com", "http://localhost:8000"):
        content = content.replace(p, target_url)

    clean_host = target_url.replace("https://", "").replace("http://", "")
    content = content.replace("<ten-domain-cmmi-cua-ban>", clean_host)
    content = content.replace("https://<ten-domain-cmmi-cua-ban>", target_url)

    if target_api_key:
        for k in (
            "{CMMI-API-KEY}",
            "<Dán API Key của bạn (bắt đầu bằng cmmi_live_...)>",
            "cmmi_live_your_key_here",
            "cmmi_live_your_api_key_here",
        ):
            content = content.replace(k, target_api_key)

    return content


@router.get(
    "/config",
    summary="Get active server connectivity info for AI Agents and Frontend",
    response_description="Returns dynamic base_url and host information for the agent.",
)
async def get_server_config(request: Request):
    """Returns the dynamic base URL of the currently running backend instance."""
    base_url = resolve_request_base_url(request)
    return {
        "base_url": base_url,
        "placeholder": "{BASE-URL}",
        "health_url": f"{base_url}/health",
        "openapi_url": f"{base_url}/openapi.json",
        "llms_url": f"{base_url}/llms.txt",
        "skill_url": f"{base_url}/api/v1/tools/skill",
        "status": "ok",
    }


@router.get(
    "/skill",
    summary="Get dynamic CMMI Agent Skill (SKILL.md)",
    response_description="Plain text markdown SKILL.md dynamically tailored to the active backend server URL.",
    response_class=PlainTextResponse,
)
@router.get(
    "/SKILL.md",
    include_in_schema=False,
    response_class=PlainTextResponse,
)
async def get_dynamic_skill(
    request: Request,
    base_url: Optional[str] = Query(None, description="Optional custom base URL to inject into SKILL.md"),
    api_key: Optional[str] = Query(None, description="Optional API key to inject into SKILL.md"),
):
    """Returns SKILL.md dynamically tailored with the active server base URL and optional API key."""
    target_url = resolve_request_base_url(request, base_url)
    target_api_key = (api_key or "").strip() or "cmmi_live_your_api_key_here"

    agent_kit_dir = get_agent_kit_dir()
    skill_file = agent_kit_dir / "SKILL.md"
    if not skill_file.exists():
        raise HTTPException(404, "SKILL.md not found on server")

    with open(skill_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Dynamically inject the active backend URL and API key
    content = inject_dynamic_variables(content, target_url, target_api_key)

    return PlainTextResponse(content, media_type="text/markdown; charset=utf-8")


@router.get(
    "/agent-kit.zip",
    summary="Download the complete CMMI Agent Toolkit (.zip)",
    response_description="A ready-to-use zip bundle containing MCP server, instructions and configuration templates.",
)
async def download_agent_kit(
    request: Request,
    base_url: Optional[str] = Query(None, description="Optional custom base URL to pre-configure inside the zip"),
    api_key: Optional[str] = Query(None, description="Optional API key to pre-configure inside the zip"),
):
    """Generates and serves a dynamically tailored ZIP archive customized to the current domain."""
    agent_kit_dir = get_agent_kit_dir()

    if not agent_kit_dir.exists():
        raise HTTPException(404, "Agent toolkit directory not found on server")

    target_url = resolve_request_base_url(request, base_url)
    target_api_key = (api_key or "").strip()

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, _, files in os.walk(agent_kit_dir):
            for file in files:
                file_path = Path(root) / file
                archive_name = file_path.relative_to(agent_kit_dir).as_posix()

                if file == "claude_desktop_config.json":
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            cfg = json.load(f)
                        if "mcpServers" in cfg and "cmmi" in cfg["mcpServers"]:
                            if "env" not in cfg["mcpServers"]["cmmi"]:
                                cfg["mcpServers"]["cmmi"]["env"] = {}
                            cfg["mcpServers"]["cmmi"]["env"]["CMMI_BASE_URL"] = target_url
                            cfg["mcpServers"]["cmmi"]["env"]["CMMI_API_KEY"] = target_api_key or "{CMMI-API-KEY}"
                        zip_file.writestr(archive_name, json.dumps(cfg, indent=2))
                        continue
                    except Exception:
                        pass

                elif file == "SKILL.md":
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            skill_text = f.read()
                        skill_text = inject_dynamic_variables(skill_text, target_url, target_api_key)
                        zip_file.writestr(archive_name, skill_text)
                        continue
                    except Exception:
                        pass

                elif file == "custom_gpt_instructions.md":
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                        content = inject_dynamic_variables(content, target_url, target_api_key)
                        zip_file.writestr(archive_name, content)
                        continue
                    except Exception:
                        pass

                elif file == ".env.example":
                    env_ex = f"""# CMMI Platform Agent Skill Configuration
# - Base URL tự động đồng bộ theo backend server: {target_url}
# - Hoặc điền biến động {{BASE-URL}} / "auto" để tự phát hiện server
CMMI_BASE_URL={target_url}
CMMI_API_KEY={target_api_key or "{CMMI-API-KEY}"}
"""
                    zip_file.writestr(archive_name, env_ex)
                    continue

                elif file == "README.md":
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            readme = f.read()
                        readme = inject_dynamic_variables(readme, target_url, target_api_key)
                        zip_file.writestr(archive_name, readme)
                        continue
                    except Exception:
                        pass

                # Default: write file directly
                zip_file.write(file_path, archive_name)

        # Inject pre-configured .env directly into the ZIP archive
        env_content = f"""# CMMI Platform Agent Skill Configuration
# Tự động đồng bộ theo Backend Server: {target_url}

CMMI_BASE_URL={target_url}
CMMI_API_KEY={target_api_key or "{CMMI-API-KEY}"}
"""
        zip_file.writestr(".env", env_content)

        # Include dynamically generated OpenAPI 3.1 JSON customized with target server URL
        try:
            openapi_data = request.app.openapi()
            openapi_data["servers"] = [
                {"url": target_url, "description": "Active CMMI Server"}
            ]
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
