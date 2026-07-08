#!/usr/bin/env bash
# Smoke test chunked uploads through a reverse proxy subpath.
# Starts Volum behind nginx at /volum/, uploads through the prefixed route,
# verifies the stored file, then cleans up.
# Usage: ./scripts/smoke-reverse-proxy-upload.sh [port]
set -euo pipefail

PORT="${1:-18092}"
COMPOSE="docker-compose.reverse-proxy-smoke.yml"
PROJECT="volum-rp-smoke-$$"
TEST_DIR="$(mktemp -d)"
UPLOAD_NAME="proxy upload % check.txt"
UPLOAD_BODY="Volum reverse proxy upload smoke"
ENCODED_UPLOAD_NAME="proxy+upload+%25+check.txt"
BASE="http://localhost:${PORT}/volum"

cleanup() {
  docker compose -p "${PROJECT}" -f "${COMPOSE}" down -v 2>/dev/null || true
  rm -f "${COMPOSE}"
  rm -rf "${TEST_DIR}"
}
trap cleanup EXIT

mkdir -p "${TEST_DIR}/data" "${TEST_DIR}/storage" "${TEST_DIR}/nginx"
printf "%s" "${UPLOAD_BODY}" > "${TEST_DIR}/chunk.bin"

cat > "${TEST_DIR}/nginx/default.conf" <<'NGINX'
server {
  listen 80;

  location /volum/ {
    proxy_pass http://volum:8090/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    client_max_body_size 0;
  }
}
NGINX

cat > "${COMPOSE}" <<YAML
services:
  volum:
    build:
      context: .
      args:
        VITE_PUBLIC_PATH: /volum/
    volumes:
      - "${TEST_DIR}/data:/data"
      - "${TEST_DIR}/storage:/storage"
    environment:
      - VOLUM_ROOTS=/storage
      - VOLUM_DB=/data/volum.db
      - VOLUM_PORT=8090
      - VOLUM_AUTH_REQUIRED=false
      - VOLUM_ALLOW_INSECURE_AUTH_DISABLED=true
      - VOLUM_ALLOWED_HOSTS=localhost,127.0.0.1,volum,reverse-proxy

  reverse-proxy:
    image: nginx:1.27-alpine
    ports:
      - "${PORT}:80"
    volumes:
      - "${TEST_DIR}/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro"
    depends_on:
      - volum
YAML

echo "==> Reverse-proxy upload smoke starting on port ${PORT}"
docker compose -p "${PROJECT}" -f "${COMPOSE}" up --build -d

READY=false
for _ in $(seq 1 60); do
  if curl -sf "${BASE}/healthz" >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
done

if [ "${READY}" != "true" ]; then
  echo "FAIL: reverse proxy did not become ready"
  docker compose -p "${PROJECT}" -f "${COMPOSE}" ps
  docker compose -p "${PROJECT}" -f "${COMPOSE}" logs --tail=80
  exit 1
fi

echo "  1/4  Health check through /volum/"
RESP="$(curl -sf "${BASE}/healthz")"
echo "       ${RESP}"
echo "${RESP}" | grep -q '"status":"ok"' || { echo "FAIL: health check"; exit 1; }

echo "  2/4  Upload status through prefixed API route"
RESP="$(curl -sf "${BASE}/api/files/upload-status?path=%2Fstorage&filename=${ENCODED_UPLOAD_NAME}")"
echo "       ${RESP}"
echo "${RESP}" | grep -q '"received":0' || { echo "FAIL: unexpected upload status"; exit 1; }

echo "  3/4  Chunk upload through prefixed API route"
SIZE="$(wc -c < "${TEST_DIR}/chunk.bin" | tr -d ' ')"
RESP="$(curl -sf -X POST \
  -H "X-Volum-Request: fetch" \
  --data-binary @"${TEST_DIR}/chunk.bin" \
  "${BASE}/api/files/upload-chunk?path=%2Fstorage&filename=${ENCODED_UPLOAD_NAME}&offset=0&totalSize=${SIZE}")"
echo "       ${RESP}"
echo "${RESP}" | grep -q '"complete":true' || { echo "FAIL: upload did not complete"; exit 1; }

echo "  4/4  Stored file content"
if [ "$(cat "${TEST_DIR}/storage/${UPLOAD_NAME}")" != "${UPLOAD_BODY}" ]; then
  echo "FAIL: uploaded file content mismatch"
  exit 1
fi
echo "       ${UPLOAD_NAME} verified"

echo ""
echo "==> Reverse-proxy upload smoke passed!"
