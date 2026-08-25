# Eaze API

FastAPI service on Python 3.12, backed by any Postgres-compliant database via
SQLAlchemy (async, `asyncpg`) + Alembic migrations. Stateless — safe to run
as any number of pods behind a load balancer.

## Run it locally

```
docker compose up --build
```

This starts Postgres, runs `alembic upgrade head` once via the `migrate`
service, then starts the API on `http://localhost:8000`. Re-running
`docker compose up` is safe — Alembic is idempotent, it only applies
migrations that haven't run yet.

Try it:

```
curl http://localhost:8000/healthz
curl -X POST http://localhost:8000/checkins \
  -H "Content-Type: application/json" \
  -d '{"phone":"9999999999","mood":5,"note":"feeling good"}'
curl http://localhost:8000/checkins/9999999999
```

Config is read from environment variables (see `.env.example`); copy it to
`.env` to override locally without touching `docker-compose.yml`.

## Adding a database change

1. Change `app/models.py`.
2. Generate a migration against a running local database:
   ```
   docker compose run --rm app alembic revision --autogenerate -m "add whatever"
   ```
3. Check the generated file in `migrations/versions/` — autogenerate misses
   some things (renames, some constraint changes), so review it before
   committing.
4. Commit the migration alongside the model change in the same PR.

## Kubernetes

Manifests live in `k8s/`. The API expects `DATABASE_URL` from a Secret named
`eaze-api-secrets` (see `k8s/secret.example.yaml` — never commit a filled-in
copy; create the real one with `kubectl create secret` or your cluster's
secrets manager).

`scripts/deploy.sh` is the reference deploy sequence: apply
namespace/config/service, delete-and-reapply the migration Job and wait for
it to complete, then roll out the Deployment (3 replicas by default). The
Job runs `alembic upgrade head` to completion exactly once per deploy —
Jobs are immutable in Kubernetes, so the script deletes the previous run
before creating the next one rather than trying to update it in place.

```
kubectl create secret generic eaze-api-secrets -n eaze \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/eaze'
./scripts/deploy.sh
```

Notes for running multiple pods against one database:

- Each pod opens up to `DB_POOL_SIZE + DB_MAX_OVERFLOW` connections (default
  10). Total connections against Postgres is roughly
  `replicas * (pool_size + max_overflow)` — size `max_connections` on the
  database accordingly, or lower the per-pod pool as replicas scale up.
- `GET /healthz` never touches the database (liveness — restarting a pod
  won't fix a database outage). `GET /readyz` does (readiness — a pod that
  can't reach the database is pulled out of the Service's load balancing
  until it can).
- The image tag `eaze-backend:latest` in `k8s/deployment.yaml` and
  `k8s/migration-job.yaml` is a placeholder — point it at whatever your CI
  builds and pushes (an immutable tag per release, not a floating `latest`).
