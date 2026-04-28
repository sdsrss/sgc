---
intent: migrate per-task state from YAML files to SQLite
category: data
---

Schema: tasks(id PRIMARY KEY, level TEXT, created_at TEXT, motivation TEXT,
body TEXT). Indexes on level + created_at.

Migration path: read all YAML files under .sgc/decisions/, parse, INSERT
into SQLite. YAML files preserved on disk for rollback (delete only after
2 successful runs of `sgc plan` against the new SQLite path).

Edge: malformed YAML during migration → log + skip + warning emitted via
events.ndjson (do not crash the migration). Rollback: drop SQLite file,
re-read YAML — zero data loss.
