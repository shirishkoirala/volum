#!/bin/sh
set -eu

errors=0

pass() {
  printf '  [ok] %s\n' "$1"
}

warn() {
  printf '  [warn] %s\n' "$1"
}

fail() {
  printf '  [error] %s\n' "$1" >&2
  errors=$((errors + 1))
}

printf 'Checking Volum development prerequisites...\n'

if ! command -v docker >/dev/null 2>&1; then
  fail 'Docker is not installed or is not on PATH.'
else
  pass "Docker found: $(docker --version)"

  if docker info >/dev/null 2>&1; then
    pass 'Docker daemon is running.'
  else
    fail 'Docker daemon is not reachable. Start Docker and run make doctor again.'
  fi

  if compose_version=$(docker compose version 2>/dev/null); then
    pass "Docker Compose v2 found: ${compose_version}"
  else
    fail 'Docker Compose v2 is unavailable. Install the Docker Compose plugin.'
  fi
fi

machine=$(uname -m)
case "$machine" in
  x86_64 | amd64 | arm64 | aarch64)
    pass "Supported CPU architecture: ${machine}"
    ;;
  *)
    warn "CPU architecture ${machine} is not covered by the release pipeline."
    ;;
esac

for directory in data storage; do
  if [ ! -d "$directory" ]; then
    fail "${directory}/ is missing. Run make setup to create it."
  elif [ ! -w "$directory" ]; then
    fail "${directory}/ is not writable by the current user."
  else
    pass "${directory}/ is writable."
  fi
done

if command -v nc >/dev/null 2>&1; then
  for port in 8342 8090; do
    if nc -z localhost "$port" >/dev/null 2>&1; then
      warn "Port ${port} is already in use. Stop the existing service before make dev."
    else
      pass "Port ${port} is available."
    fi
  done
else
  warn 'netcat is unavailable; skipped checks for ports 8342 and 8090.'
fi

if [ "$errors" -ne 0 ]; then
  printf '\nFound %s blocking problem(s).\n' "$errors" >&2
  exit 1
fi

printf '\nDevelopment prerequisites are ready.\n'
