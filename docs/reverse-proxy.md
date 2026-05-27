# Reverse Proxy Setup

Volum runs on a single port (default `8090`). These examples assume your Volum instance is at `http://192.168.1.50:8090` and you want to serve it at `https://volum.example.com`.

## Configuration

Set `VOLUM_PUBLIC_URL` so share links and redirects resolve correctly:

```env
VOLUM_PUBLIC_URL=https://volum.example.com
```

---

## Nginx

```nginx
server {
    listen 443 ssl;
    server_name volum.example.com;

    # SSL certificates
    ssl_certificate     /etc/letsencrypt/live/volum.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/volum.example.com/privkey.pem;

    client_max_body_size 0;           # no upload limit
    proxy_request_buffering off;      # stream uploads directly
    proxy_buffering off;              # stream downloads (SSE, previews)

    location / {
        proxy_pass http://192.168.1.50:8090;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";

        # SSE / long-lived connections
        proxy_read_timeout 86400s;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name volum.example.com;
    return 301 https://$host$request_uri;
}
```

---

## Traefik (Docker provider)

```yml
services:
  volum:
    build:
      context: ..
      dockerfile: Dockerfile
    expose:
      - "8090"
    environment:
      - VOLUM_PUBLIC_URL=https://volum.example.com
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.volum.rule=Host(`volum.example.com`)"
      - "traefik.http.routers.volum.entrypoints=websecure"
      - "traefik.http.services.volum.loadbalancer.server.port=8090"
```

---

## Tailscale (no proxy needed)

If you use Tailscale, you can skip the reverse proxy entirely. Access Volum directly on its Tailscale IP:

```
http://100.x.x.x:8090
```

For a Tailscale Funnel:

```sh
tailscale serve --bg --https 443 http://localhost:8090
```

See `docker-compose.server.yml` for the host-mount config needed for drive discovery.

---

## Common Issues

| Symptom | Fix |
|---------|-----|
| Broken share links | Set `VOLUM_PUBLIC_URL` to match your external URL |
| WebSocket/SSE disconnects | Ensure `proxy_read_timeout` or equivalent is high (86400s) |
| Upload timed out | Set `client_max_body_size 0` and `proxy_request_buffering off` |
| IP shows as 127.0.0.1 | Check `X-Forwarded-For` headers are passed correctly |
