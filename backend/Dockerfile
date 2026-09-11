# Build context is the repo root (not backend/) — this image bundles the
# frontend's static files alongside the API so both are served from the
# same origin (see app/main.py's StaticFiles mount). See
# backend/docker-compose.yml for the matching local context/dockerfile
# settings.
FROM python:3.12-slim

RUN groupadd --system --gid 1000 app && useradd --system --uid 1000 --gid app --home /app --create-home app

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./
COPY backend/scripts ./scripts

# The static frontend — no build step, just the plain files as-is.
COPY index.html ./static/index.html
COPY app.js ./static/app.js
COPY styles.css ./static/styles.css
COPY assets ./static/assets

RUN chown -R app:app /app
USER app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
