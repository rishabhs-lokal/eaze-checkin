#!/usr/bin/env python3
"""Runs `alembic upgrade head`, serialized across concurrent invocations via
a Postgres advisory lock. Safe to run from every replica's initContainer on
every rollout (not just a single dedicated migration Job) — whichever pod
doesn't acquire the lock first just waits, then finds the database already
at head and exits immediately, instead of racing another pod to apply the
same migration twice.
"""
import asyncio
import os
import subprocess
import sys

import asyncpg

# Arbitrary fixed key for this app's migration lock — any int64 works, it
# only has to stay the same across every invocation, forever.
MIGRATION_LOCK_KEY = 851972364


def _to_asyncpg_dsn(url: str) -> str:
    for prefix in ("postgresql+asyncpg://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql://" + url[len(prefix) :]
    return url


async def main() -> None:
    dsn = _to_asyncpg_dsn(os.environ["DATABASE_URL"])
    conn = await asyncpg.connect(dsn)
    try:
        print("Waiting for migration lock...", flush=True)
        await conn.execute("SELECT pg_advisory_lock($1)", MIGRATION_LOCK_KEY)
        print("Lock acquired — running migrations...", flush=True)
        result = subprocess.run(["alembic", "upgrade", "head"])
        if result.returncode != 0:
            sys.exit(result.returncode)
        print("Migrations complete.", flush=True)
    finally:
        # Session-scoped lock releases automatically when the connection
        # closes anyway — explicit unlock just does it a moment sooner.
        await conn.execute("SELECT pg_advisory_unlock($1)", MIGRATION_LOCK_KEY)
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
