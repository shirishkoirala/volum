#!/bin/sh
set -eu

lockfile=package-lock.json
marker=node_modules/.volum-package-lock.sha256

if [ ! -f "$lockfile" ]; then
  printf 'Missing %s; cannot install frontend dependencies.\n' "$lockfile" >&2
  exit 1
fi

lock_hash=$(sha256sum "$lockfile" | awk '{print $1}')
installed_hash=

if [ -f "$marker" ]; then
  installed_hash=$(cat "$marker")
fi

if [ "$lock_hash" = "$installed_hash" ] && [ -x node_modules/.bin/vite ]; then
  printf 'Frontend dependencies match package-lock.json.\n'
  exit 0
fi

printf 'Installing frontend dependencies from package-lock.json...\n'
npm ci
printf '%s\n' "$lock_hash" > "$marker"
