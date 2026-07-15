# Configuration Reference

Volum reads application settings from environment variables. Docker Compose
also uses several variables to configure host-side ports, mounts, and the
container user.

Start from:

- `.env.development.example` for local development overrides
- `.env.server.example` for authenticated server deployment

Do not commit `.env`.

## Application Variables

These variables are read by `backend/internal/config/config.go`.

| Variable | Default | Purpose and constraints |
|---|---|---|
| `VOLUM_ROOTS` | none | Comma-separated absolute public paths Volum may browse. At least one root source is required. |
| `VOLUM_HOME` | empty | Absolute home path to expose and mark as the Home root. |
| `VOLUM_INCLUDE_ROOT` | `false` | Expose `/` as a root. Requires authentication. |
| `VOLUM_DISCOVER_ROOTS` | `false` | Discover supported mounted filesystems from Linux mount information. Requires authentication. |
| `VOLUM_HOST_ROOT` | empty | Internal container prefix corresponding to the host root, normally `/host` in server mode. |
| `VOLUM_DB` | `./volum.db` | SQLite database path inside the process/container. |
| `VOLUM_PORT` | `8090` | HTTP listen port. Must be numeric. |
| `VOLUM_AUTH_REQUIRED` | `true` | Require setup/login and signed sessions. |
| `VOLUM_ALLOW_INSECURE_AUTH_DISABLED` | `false` | Explicit acknowledgement required when authentication is disabled. Development only. |
| `VOLUM_SESSION_SECRET` | none | Session signing secret. Required with authentication and at least 32 characters. |
| `VOLUM_BOOTSTRAP_TOKEN` | generated when needed | Optional fixed token for initial admin setup. Treat as a secret. |
| `VOLUM_PUBLIC_URL` | empty | Absolute `http` or `https` base URL used for public links and secure-cookie decisions. |
| `VOLUM_ALLOWED_HOSTS` | empty | Comma-separated hostnames or IP addresses accepted by host validation. Ports are removed during parsing. |

Boolean values accept `1`, `true`, `yes`, or `on` case-insensitively. Other
values are false. `VOLUM_AUTH_REQUIRED` is the exception: it defaults to true
when unset.

### Root mapping

A root has a public path shown to the browser and an internal path used by the
container.

For example, server Compose can mount the host at `/host` and set:

```text
VOLUM_HOST_ROOT=/host
VOLUM_INCLUDE_ROOT=true
```

The public path `/etc/hosts` then maps to `/host/etc/hosts` internally.
`RootGuard` performs this mapping and rejects paths that escape configured
roots.

### Authentication combinations

- Production/server: keep `VOLUM_AUTH_REQUIRED=true` and provide a strong
  `VOLUM_SESSION_SECRET`.
- Authentication may be disabled only when
  `VOLUM_ALLOW_INSECURE_AUTH_DISABLED=true`.
- Root exposure or mount discovery cannot be combined with disabled
  authentication.

## Compose-Only Variables

These variables are expanded by Compose and are not read directly by the Go
process unless the Compose file passes them through.

| Variable | Compose file | Default | Purpose |
|---|---|---|---|
| `VOLUM_BIND_ADDRESS` | quick start, server | `127.0.0.1` | Host interface used for the published port. |
| `VOLUM_DATA_DIR` | quick start | `./data` | Host directory mounted at `/data`. |
| `VOLUM_STORAGE` | quick start | `./storage` | Host directory mounted at `/storage`. |
| `VOLUM_HOST_PATH` | server | `./storage` | Host path mounted at `/host`. Use `/` only deliberately. |
| `VOLUM_UID` | server | `1000` | Host UID used to run the container. |
| `VOLUM_GID` | server | `1000` | Host GID used to run the container. |

## Development Defaults

`docker-compose.dev.yml` intentionally overrides high-risk server settings:

- Includes only `/storage`
- Disables root exposure and mount discovery
- Enables authentication
- Uses a development-only session secret unless overridden
- Allows `localhost`, `127.0.0.1`, and the internal `api` hostname
- Publishes the API on `8090` and Vite on `8342`

Run `make doctor` before starting the stack and `make dev` to start it.

## Server Deployment

For server mode:

1. Copy `.env.server.example` to `.env`.
2. Generate a session secret with `openssl rand -base64 32`.
3. Keep `VOLUM_HOST_PATH=./storage` until broader host access is required.
4. Add the access IP or reverse-proxy hostname to `VOLUM_ALLOWED_HOSTS`.
5. Set `VOLUM_PUBLIC_URL` to the externally visible URL when using shares or
   secure cookies.
6. Run the container as a UID/GID that can access only the required paths.

See [the reverse proxy guide](reverse-proxy.md) for proxy-specific settings.

## Adding a Variable

When adding application configuration:

1. Add it to `Config` and `Load()` in `backend/internal/config/config.go`.
2. Validate invalid and unsafe combinations.
3. Add tests in `backend/internal/config/config_test.go`.
4. Pass it through relevant Compose files.
5. Update the appropriate environment example and this reference.
6. Note security-sensitive defaults in the pull request.
