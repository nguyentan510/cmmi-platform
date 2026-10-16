import argparse
import json
from pathlib import Path

from app.main import app

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "shared" / "openapi.json"


def schema_text():
    return json.dumps(app.openapi(), indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def export_schema(output: Path = DEFAULT_PATH):
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(schema_text(), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Export or verify the generated CMMI API contract")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--output", type=Path, default=DEFAULT_PATH)
    args = parser.parse_args()
    if args.check:
        if not args.output.exists() or args.output.read_text(encoding="utf-8") != schema_text():
            raise SystemExit("OpenAPI is stale. Run poetry run export-schema.")
        print("OpenAPI contract is current.")
    else:
        export_schema(args.output)
        print(f"Exported {args.output}")


if __name__ == "__main__":
    main()
