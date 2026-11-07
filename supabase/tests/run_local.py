"""Run migrations + seed + behavioural tests on a throwaway local Postgres.

    pip install pgserver psycopg2-binary
    python supabase/tests/run_local.py

This does NOT talk to Supabase. It boots a disposable Postgres, stubs the few Supabase pieces
the SQL depends on (auth schema, roles, auth.uid()), applies the real migrations and seed,
then runs rls_test.sql. Exit code 0 means every expectation passed.

What it cannot prove: that GoTrue accepts the rows seed.sql writes into auth.users /
auth.identities (and the password hashing, if this Postgres lacks pgcrypto), or anything about
Storage. Check those on a real Supabase project.
"""

import re
import sys
import tempfile
from pathlib import Path

import pgserver
import psycopg2

ROOT = Path(__file__).resolve().parents[1]  # supabase/


class StepFailed(Exception):
    pass


def run(conn, label: str, sql: str) -> list[str]:
    """Execute a script; return the NOTICE lines it produced."""
    print(f"-- {label}")
    conn.notices.clear()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
    except psycopg2.Error as e:
        raise StepFailed(f"{label}\n{(e.pgerror or str(e)).strip()}") from None
    return [re.sub(r"^NOTICE:\s*", "", n).strip() for n in conn.notices]


def main() -> int:
    migrations = sorted((ROOT / "migrations").glob("*.sql"))
    # ignore_cleanup_errors: on Windows Postgres can hold a log file a moment after stopping.
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        server = pgserver.get_server(Path(tmp) / "pgdata", cleanup_mode="stop")
        conn = None
        try:
            conn = psycopg2.connect(server.get_uri())
            conn.autocommit = True

            for note in run(conn, "stub: auth schema and roles", (ROOT / "tests" / "00_local_stub.sql").read_text(encoding="utf-8")):
                print("   " + note)
            for m in migrations:
                run(conn, f"migration: {m.name}", m.read_text(encoding="utf-8"))
            run(conn, "seed.sql", (ROOT / "seed.sql").read_text(encoding="utf-8"))

            # psycopg2 keeps only the last 50 NOTICEs, so run the test file one section at a time
            # (split at its "-- ====" headers). BEGIN in the first chunk keeps the transaction
            # open across chunks; the last chunk ends with ROLLBACK.
            test_sql = (ROOT / "tests" / "rls_test.sql").read_text(encoding="utf-8")
            results: list[str] = []
            for i, chunk in enumerate(re.split(r"(?m)^-- =+.*$", test_sql)):
                results += run(conn, f"tests: rls_test.sql (part {i})", chunk)
            for r in results:
                print("   " + r)
            print(f"\n{sum(r.startswith('PASS') for r in results)} expectations passed")
            return 0
        except StepFailed as e:
            for n in conn.notices if conn else []:
                print("   " + n.strip())
            print(f"\nFAILED in {e}")
            return 1
        finally:
            if conn is not None:
                conn.close()
            server.cleanup()  # stop Postgres before the temp dir is removed


if __name__ == "__main__":
    sys.exit(main())
