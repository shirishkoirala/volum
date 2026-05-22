# Linux Server Deployment

Volum server mode is for a private Linux server on a LAN, Tailscale, or WireGuard network. Do not publish it directly to the public internet.

## Docker Compose

Create `/opt/docker/volum/.env`:

```txt
VOLUM_ADMIN_PASSWORD=change-me
VOLUM_SESSION_SECRET=replace-with-a-long-random-string
VOLUM_PORT=8090
```

Generate the session secret with:

```sh
openssl rand -base64 32
```

Run from the repository:

```sh
docker compose --env-file /opt/docker/volum/.env -f docker-compose.server.yml up --build -d
```

This mounts host `/` at `/host` inside the container with `rslave` propagation, but Volum shows host paths in the UI. The root entry appears as `/`, and discovered drives appear as their host mount paths such as `/mnt/media`.

## Native systemd

Build and install the backend binary and frontend assets, then run the service with equivalent environment variables:

```ini
[Service]
Environment=VOLUM_AUTH_REQUIRED=true
Environment=VOLUM_ADMIN_PASSWORD=change-me
Environment=VOLUM_SESSION_SECRET=replace-with-a-long-random-string
Environment=VOLUM_INCLUDE_ROOT=true
Environment=VOLUM_DISCOVER_ROOTS=true
Environment=VOLUM_DB=/opt/docker/volum/volum.db
Environment=VOLUM_PORT=8090
ExecStart=/opt/volum/volum
```

Do not set `VOLUM_HOST_ROOT` for native deployment. Native mode already sees the host filesystem directly.
