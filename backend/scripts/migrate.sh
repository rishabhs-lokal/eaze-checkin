#!/usr/bin/env sh
# Runs all pending Alembic migrations against DATABASE_URL, then exits.
# Used as the entrypoint for the docker-compose "migrate" service and as
# every pod's initContainer in Kubernetes — migrate.py wraps the actual
# `alembic upgrade head` in a Postgres advisory lock, so it's safe for
# several replicas to run this at once on every rollout, not just a single
# dedicated Job.
set -eu

python3 scripts/migrate.py
