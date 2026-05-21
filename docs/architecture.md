# Architecture

Volum separates browser interaction from filesystem work.

```txt
React UI -> Go API -> SQLite job store -> Background worker -> Filesystem
```

The frontend creates jobs and subscribes to progress. It does not own long-running operations. The backend persists job state in SQLite and continues work independently of the browser lifecycle.

## Boundaries

- `internal/api`: HTTP routes and response shaping
- `internal/config`: environment-based configuration
- `internal/security`: root validation and path safety
- `internal/files`: file browsing and metadata
- `internal/storage`: SQLite connection and migrations
- `internal/jobs`: persistent job records
- `internal/worker`: background job execution

## Recovery

On startup, Volum opens the SQLite database, applies migrations, and asks the worker to inspect unfinished jobs. Running jobs from a previous process are not assumed safe; they are marked failed or recoverable after validation.
