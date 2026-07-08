# Reverse Proxy Setup

Volum can be placed behind a reverse proxy for production deployments. All HTTP traffic (API + SPA) goes through a single port (default 8090), making configuration straightforward.

## Path Prefix / Subpath Deployment

To serve Volum under a subpath (e.g., `https://example.com/volum/`):

1. Set the `VITE_PUBLIC_PATH` environment variable to the subpath when building:
   ```bash
   VITE_PUBLIC_PATH=/volum/ npm run build
   ```
   This ensures all asset URLs and API calls are prefixed correctly.

2. Configure your reverse proxy to strip the prefix before forwarding to Volum (recommended):

### Nginx

```nginx
# Subpath deployment
location /volum/ {
  proxy_pass http://localhost:8090/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # Increase timeouts for large uploads
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;

  # Allow large upload bodies
  client_max_body_size 0;
}
```

### Root-level deployment

```nginx
server {
  listen 443 ssl;
  server_name volum.example.com;

  location / {
    proxy_pass http://localhost:8090;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    client_max_body_size 0;
  }
}
```

### Caddy

```caddyfile
volum.example.com {
  reverse_proxy localhost:8090
}
```

### Traefik

```yaml
# Docker Compose labels
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.volum.rule=Host(`volum.example.com`)"
  - "traefik.http.services.volum.loadbalancer.server.port=8090"
```

## Large Upload Tuning

Chunked uploads send 1 MB chunks sequentially. For large files (100+ MB), tune your proxy:

- **Increase proxy timeouts** (`proxy_read_timeout`, `proxy_send_timeout` above 300s)
- **Set `client_max_body_size 0`** (nginx) to disable body size checking (chunks are small, but the proxy should not impose its own limit)
- **WebSocket** is not used by uploads — only SSE (Server-Sent Events) for job progress, which uses standard HTTP

## Upload Smoke Test

To verify chunked uploads through a subpath reverse proxy, run:

```bash
./scripts/smoke-reverse-proxy-upload.sh
```

The smoke test starts Volum behind nginx at `/volum/`, uploads a file with spaces and `%` in the filename through the prefixed API route, and verifies the stored file content.
