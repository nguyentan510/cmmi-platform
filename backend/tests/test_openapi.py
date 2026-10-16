import importlib

from httpx import ASGITransport, AsyncClient


async def test_api_docs_machine_guide_and_operation_metadata():
    from app.main import create_app
    from app.core.config import Settings

    app = create_app(Settings(scheduler_enabled=False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for path in ["/health", "/docs", "/redoc", "/llms.txt", "/llms-full.txt", "/openapi.json"]:
            response = await client.get(path)
            assert response.status_code == 200, path
        guide = (await client.get("/llms-full.txt")).text
        for requirement in [
            "X-API-Key",
            "SCHEDULED",
            "fb_post_id",
            "tiktok_post_id",
            "youtube_post_id",
            "/confirm",
        ]:
            assert requirement in guide
        schema = (await client.get("/openapi.json")).json()
        assert schema["openapi"].startswith("3.1")
        assert schema["components"]["securitySchemes"]["APIKeyHeader"]["name"] == "X-API-Key"
        for path, methods in schema["paths"].items():
            for method, operation in methods.items():
                assert operation["summary"] and operation["description"], (path, method)
                assert operation["responses"][
                    "200" if "200" in operation["responses"] else next(iter(operation["responses"]))
                ]["description"]
    await app.state.engine.dispose()


def test_export_schema_is_deterministic(tmp_path):
    try:
        exporter = importlib.import_module("app.export_schema")
    except ModuleNotFoundError:
        assert False, "Schema export command is missing"
    output = tmp_path / "openapi.json"
    exporter.export_schema(output)
    first = output.read_bytes()
    exporter.export_schema(output)
    assert first == output.read_bytes()
