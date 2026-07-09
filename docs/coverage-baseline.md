# Coverage Baseline

Recorded 2026-07-09. Informational only — no thresholds enforced.

## Backend (Go)

| Package | Coverage |
|---------|----------|
| `api` | 44.8% |
| `auth` | 73.7% |
| `config` | 76.4% |
| `desktop` | 35.8% |
| `devices` | 25.4% |
| `files` | 65.1% |
| `jobs` | 63.1% |
| `security` | 58.3% |
| `shares` | 84.3% |
| `sqlutil` | 100.0% |
| `storage` | 58.8% |
| `worker` | 51.9% |
| `version` | — (no tests) |

## Frontend (TypeScript)

| Directory | Statements |
|-----------|-----------|
| `src/api` | 52.59% |
| `src/components/input` | 92.42% |
| `src/components/layout` | 26.26% |
| `src/components/overlay` | 33.30% |
| `src/components/ui` | 31.98% |
| `src/components/window` | 0% |
| `src/contexts` | 0% |
| `src/hooks` | 35.20% |
| `src/pages` | 7.78% |
| `src/screens` | 0% |
| `src/types` | 0% |
| `src/utils` | 79.53% |

## Next Steps

- Add coverage thresholds only for critical packages (`security`, `auth`,
  `upload`, `conflict`) after the baseline is stable across several CI runs.
- Track per-package trends quarterly.
