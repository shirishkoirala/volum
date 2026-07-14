#!/usr/bin/env bash
# Smoke test for Volum.
# Stops any running container, starts fresh, runs checks, then cleans up.
# Usage: ./scripts/smoke.sh [port] [admin_password]
set -euo pipefail

PORT="${1:-8091}"
ADMIN_PASS="${2:-smoke-test-password}"
ADMIN_USER="admin"
COMPOSE="docker-compose.smoke.yml"
TEST_DIR="$(mktemp -d)"
COOKIE_JAR="${TEST_DIR}/cookies.txt"

cleanup() {
  rm -rf "${TEST_DIR}"
  docker compose -f "${COMPOSE}" down -v 2>/dev/null || true
  rm -f "${COMPOSE}"
}
trap cleanup EXIT

echo "==> Smoke test starting on port ${PORT}"

# Write a minimal compose with auth enabled
cat > "${COMPOSE}" <<YAML
services:
  volum-smoke:
    build: .
    container_name: volum-smoke
    ports:
      - "${PORT}:8090"
    volumes:
      - "${TEST_DIR}/data:/data"
      - "${TEST_DIR}/storage:/storage"
    environment:
      - VOLUM_ROOTS=/storage
      - VOLUM_DB=/data/volum.db
      - VOLUM_PORT=8090
      - VOLUM_AUTH_REQUIRED=true
      - VOLUM_SESSION_SECRET=smoke-test-secret-do-not-use-in-prod
YAML

echo "  - Starting container..."
docker compose -f "${COMPOSE}" up --build -d 2>&1 | tail -1

BASE="http://localhost:${PORT}"

# Wait for the service to be ready
for _ in $(seq 1 30); do
  if curl -sf "${BASE}/healthz" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo ""
echo "  1/5  Health check"
RESP=$(curl -s "${BASE}/healthz")
echo "       ${RESP}"
echo "${RESP}" | grep -q '"status":"ok"' || { echo "FAIL: health check"; exit 1; }

echo "  2/5  Public version endpoint"
RESP=$(curl -s "${BASE}/api/version")
echo "       ${RESP}"
echo "${RESP}" | grep -q '"version"' || { echo "FAIL: version endpoint"; exit 1; }

echo "  3/5  Auth required for protected endpoints"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/roots")
if [ "${HTTP_CODE}" != "401" ]; then
  echo "FAIL: expected 401 for /api/roots without auth, got ${HTTP_CODE}"; exit 1
fi
echo "       Got 401 -- OK"

echo "  4/5  Initial admin setup"
curl -s -c "${COOKIE_JAR}" "${BASE}/api/setup" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" > /dev/null
if ! grep -q "volum_session" "${COOKIE_JAR}" 2>/dev/null; then
  echo "FAIL: no volum_session cookie after setup"
  cat "${COOKIE_JAR}"
  exit 1
fi
echo "       Session obtained"

echo "  5/5  Browse with auth"
RESP=$(curl -s -b "${COOKIE_JAR}" "${BASE}/api/files?path=/storage")
echo "       ${RESP:0:200}"
echo "${RESP}" | grep -q '"entries"' || { echo "FAIL: /api/files response missing 'entries' key"; exit 1; }

echo ""
echo "==> All smoke tests passed!"
