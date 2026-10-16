import json
from pathlib import Path
import subprocess


def test_compose_keeps_production_ingress_inside_tunnel():
    root = Path(__file__).resolve().parents[2]
    assert (root / "docker-compose.yml").exists(), "Tunnel deployment configuration is missing"
    result = subprocess.run(
        ["docker", "compose", "--env-file", ".env.example", "config", "--format", "json"],
        cwd=root,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    services = json.loads(result.stdout)["services"]
    assert {"backend", "frontend", "cloudflared"} == set(services)
    assert all(not service.get("ports") for service in services.values())
    assert services["backend"]["environment"]["ENVIRONMENT"] == "production"
    assert services["cloudflared"]["depends_on"]["frontend"]["condition"] == "service_healthy"


def test_development_compose_ports_bind_loopback_only():
    root = Path(__file__).resolve().parents[2]
    assert (root / "docker-compose.dev.yml").exists(), "Local Docker override is missing"
    result = subprocess.run(
        [
            "docker",
            "compose",
            "--env-file",
            ".env.example",
            "-f",
            "docker-compose.yml",
            "-f",
            "docker-compose.dev.yml",
            "config",
            "--format",
            "json",
        ],
        cwd=root,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    for service in json.loads(result.stdout)["services"].values():
        for port in service.get("ports", []):
            assert port["host_ip"] == "127.0.0.1"
