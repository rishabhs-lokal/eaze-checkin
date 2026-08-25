#!/usr/bin/env sh
# Runs all pending Alembic migrations against DATABASE_URL, then exits.
# Used as the entrypoint for both the docker-compose "migrate" service and
# the Kubernetes migration Job — the same command, run to completion once
# per deploy, never as a long-lived process.
set -eu

echo "Running migrations against ${DATABASE_URL:-<unset>}..."
alembic upgrade head
echo "Migrations complete."
