FROM python:3.12-slim AS builder
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 POETRY_VIRTUALENVS_IN_PROJECT=true
WORKDIR /app
RUN pip install --no-cache-dir poetry==2.5.1
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root --no-interaction

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
RUN useradd --create-home --uid 10001 cmmi
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --chown=cmmi:cmmi app ./app
COPY --chown=cmmi:cmmi alembic ./alembic
COPY --chown=cmmi:cmmi alembic.ini ./
USER cmmi
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
