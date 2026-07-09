# ADR 0003: SQLite Uses One Open Connection

Status: accepted

## Context

The API, worker, SSE stream, auth, and health checker share one SQLite database.
Multiple pooled connections increased lock contention and produced
`database is locked` failures.

## Decision

`storage.Open()` configures `SetMaxOpenConns(1)`, enables foreign keys, and uses
a five-second SQLite busy timeout.

## Consequences

- Database access is serialized within the process.
- Transactions remain important for multi-statement state changes.
- Long-running work must not hold a database transaction while performing
  filesystem or network I/O.
- Changes to connection pooling require explicit concurrency tests and
  operational evidence.
