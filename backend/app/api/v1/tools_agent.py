import io
import json
import os
from pathlib import Path
from typing import Optional
import zipfile

from fastapi import HTTPException, Query, Request, Response

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
async def download_agent_kit(
    request: Request,
    base_url: Optional[str] = Query(None, description="Optional custom base URL to pre-configure inside the zip"),
    api_key: Optional[str] = Query(None, description="Optional API key to pre-configure inside the zip"),
):
    """Generates and serves a dynamically tailored ZIP archive containing the CMMI MCP server,

    dependencies, quickstart README, and client configuration templates customized to the current domain.
    """
    agent_kit_dir = get_agent_kit_dir()

    if not agent_kit_dir.exists():
        raise HTTPException(404, "Agent toolkit directory not found on server")

    # Determine target URL dynamically
    target_url = (base_url or "").strip().rstrip("/")
    if not target_url:
        forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        forwarded_host = request.headers.get("x-forwarded-host", request.url.netloc)
        target_url = f"{forwarded_proto}://{forwarded_host}".rstrip("/")
        if "0.0.0.0" in target_url:
            target_url = target_url.replace("0.0.0.0", "localhost")

    target_api_key = (api_key or "").strip()

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # Include all files in agent-kit at root of archive with dynamic customizations
        for root, _, files in os.walk(agent_kit_dir):
            for file in files:
                file_path = Path(root) / file
                archive_name = file_path.relative_to(agent_kit_dir).as_posix()

                if file == "claude_desktop_config.json":
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            cfg = json.load(f)
                        if "mcpServers" in cfg and "cmmi" in cfg["mcpServers"]:
                            cfg["mcpServers"]["cmmi"]["env"]["CMMI_BASE_URL"] = target_url
                            cfg["mcpServers"]["cmmi"]["env"]["CMMI_API_KEY"] = target_api_key
                        zip_file.writestr(archive_name, json.dumps(cfg, indent=2))
                        continue
                    except Exception:
                        pass

                elif file == "custom_gpt_instructions.md":
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                        content = content.replace("https://<ten-domain-cmmi-cua-ban>", target_url)
                        clean_host = target_url.replace("https://", "").replace("http://", "")
                        content = content.replace("<ten-domain-cmmi-cua-ban>", clean_host)
                        if target_api_key:
                            content = content.replace("<Dán API Key của bạn (bắt đầu bằng cmmi_live_...)>", target_api_key)
                        zip_file.writestr(archive_name, content)
                        continue
                    except Exception:
                        pass

                elif file == ".env.example":
                    env_ex = f"""# CMMI Platform Agent Toolkit Configuration

# Base URL of your CMMI Platform instance (auto-tailored for: {target_url})
# - Sử dụng "{target_url}" để kết nối tới server này.
# - Hoặc điền "{{BASE_URL}}" / "auto" để tự động dò tìm giữa localhost và cloud.
CMMI_BASE_URL={target_url}

# Your CMMI API Key (starts with cmmi_live_...)
CMMI_API_KEY={target_api_key}
"""
                    zip_file.writestr(archive_name, env_ex)
                    continue

                elif file == "README.md":
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            readme = f.read()
                        readme = readme.replace("http://localhost:8000", target_url)
                        readme = readme.replace("https://<ten-domain-cmmi-cua-ban>", target_url)
                        if target_api_key:
                            readme = readme.replace("cmmi_live_your_key_here", target_api_key)
                        zip_file.writestr(archive_name, readme)
                        continue
                    except Exception:
                        pass

                # Default: write file directly
                zip_file.write(file_path, archive_name)

        # Inject pre-configured .env directly into the ZIP archive
        env_content = f"""# CMMI Platform Agent Toolkit Configuration
# Tự động tối ưu hóa theo domain: {target_url}

CMMI_BASE_URL={target_url}
CMMI_API_KEY={target_api_key}
"""
        zip_file.writestr(".env", env_content)

        # Include dynamically generated OpenAPI 3.1 JSON customized with target server URL
        try:
            openapi_data = request.app.openapi()
            openapi_data["servers"] = [
                {"url": target_url, "description": "Current CMMI server"}
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
