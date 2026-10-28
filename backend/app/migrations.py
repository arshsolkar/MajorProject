"""Small, versioned, additive schema migrations for the existing SQLAlchemy app."""

from pathlib import Path
import sqlite3

from sqlalchemy import Engine, inspect, text


MIGRATIONS = {
    "0001_persistent_recruitment_workflow": {
        "analyses": {
            "total_resumes": "INTEGER NOT NULL DEFAULT 0",
            "current_phase": "VARCHAR(50)",
            "current_stage": "VARCHAR(50) NOT NULL DEFAULT 'preparing'",
            "current_resume_filename": "VARCHAR(255)",
            "current_resume_candidate_name": "VARCHAR(255)",
            "current_resume_started_at": "TIMESTAMP",
            "phase_completed": "INTEGER NOT NULL DEFAULT 0",
            "phase_total": "INTEGER NOT NULL DEFAULT 0",
            "job_id": "VARCHAR(36) REFERENCES jobs(id)",
            "owner_user_id": "VARCHAR(36) REFERENCES users(id)",
            "job_snapshot": "JSON",
        },
        "candidates": {
            "stored_filename": "VARCHAR(255)",
            "is_shortlisted": "BOOLEAN NOT NULL DEFAULT FALSE",
            "shortlist_source": "VARCHAR(20) NOT NULL DEFAULT 'automatic'",
            "email_sent": "BOOLEAN NOT NULL DEFAULT FALSE",
            "email_sent_at": "TIMESTAMP",
            "call_scheduled": "BOOLEAN NOT NULL DEFAULT FALSE",
            "call_scheduled_at": "TIMESTAMP",
            "notes": "TEXT",
        },
        "users": {
            "company_identifier": "VARCHAR(255)",
            "company_email": "VARCHAR(255)",
            "company_phone": "VARCHAR(50)",
            "company_address": "TEXT",
            "company_website": "VARCHAR(255)",
            "account_status": "VARCHAR(32) NOT NULL DEFAULT 'approved'",
            "verification_document_path": "VARCHAR(500)",
            "verification_document_name": "VARCHAR(255)",
            "verification_document_type": "VARCHAR(100)",
            "verification_document_size": "INTEGER",
            "institution_identifier": "VARCHAR(255)",
        },
    },
    "0002_job_shortlist_threshold": {
        "jobs": {
            "shortlist_threshold": "INTEGER NOT NULL DEFAULT 75",
        },
    },
    "0003_analysis_run_number": {
        "analyses": {
            "run_number": "INTEGER",
        },
    },
}


def backup_sqlite_database(engine: Engine) -> Path | None:
    """Keep one pre-migration backup beside an existing SQLite database."""
    if engine.dialect.name != "sqlite" or not engine.url.database or engine.url.database == ":memory:":
        return None
    database_path = Path(engine.url.database).expanduser().resolve()
    if not database_path.is_file() or database_path.stat().st_size == 0:
        return None
    backup_path = database_path.with_name(database_path.name + ".pre-migration.bak")
    if backup_path.exists():
        return backup_path
    with sqlite3.connect(database_path) as source, sqlite3.connect(backup_path) as backup:
        source.backup(backup)
    return backup_path


def run_migrations(engine: Engine) -> None:
    """Apply each unapplied migration once; failures are raised and never hidden."""
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ))
        applied = set(connection.execute(text("SELECT version FROM schema_migrations")).scalars())

        for version, table_changes in MIGRATIONS.items():
            if version in applied:
                continue
            inspector = inspect(connection)
            for table_name, columns in table_changes.items():
                if not inspector.has_table(table_name):
                    continue
                existing = {column["name"] for column in inspector.get_columns(table_name)}
                for column_name, definition in columns.items():
                    if column_name not in existing:
                        connection.execute(text(
                            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
                        ))
            if version == "0003_analysis_run_number" and inspect(connection).has_table("analyses"):
                rows = connection.execute(text(
                    "SELECT id, job_id, created_at FROM analyses "
                    "WHERE job_id IS NOT NULL ORDER BY job_id, created_at ASC, id ASC"
                )).all()
                run_numbers: dict[str, int] = {}
                for analysis_id, job_id, _created_at in rows:
                    run_numbers[job_id] = run_numbers.get(job_id, 0) + 1
                    connection.execute(text(
                        "UPDATE analyses SET run_number = :run_number WHERE id = :analysis_id"
                    ), {"run_number": run_numbers[job_id], "analysis_id": analysis_id})
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_analyses_job_id ON analyses (job_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_analyses_owner_user_id ON analyses (owner_user_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_candidates_shortlist_source ON candidates (shortlist_source)"))
            connection.execute(text(
                "INSERT INTO schema_migrations (version) VALUES (:version)"
            ), {"version": version})
