#!/bin/sh
# Ensures node_modules in Docker is usable.
#
# Root /app/node_modules is a named Docker volume; workspace package
# node_modules (apps/*, lib/*, …) live on the bind-mounted host tree.
# Clearing only the volume leaves stale symlinks in apps/*/node_modules.
set -e

corepack enable

clean_node_modules() {
  echo "[docker-ensure-deps] cleaning node_modules trees..."
  if [ -d node_modules ]; then
    rm -rf node_modules/* node_modules/.[!.]* node_modules/..?* 2>/dev/null || true
  fi
  find apps artifacts lib packages scripts -type d -name node_modules 2>/dev/null | while read -r dir; do
    rm -rf "$dir"/* "$dir"/.[!.]* "$dir"/..?* 2>/dev/null || true
  done
}

vite_store_ok() {
  find node_modules/.pnpm -path '*/vite@*/node_modules/vite/bin/vite.js' 2>/dev/null | grep -q .
}

workspace_vite_ok() {
  pnpm --filter @workspace/admin-app exec vite --version >/dev/null 2>&1
}

deps_ok() {
  vite_store_ok && workspace_vite_ok
}

pnpm install --ignore-scripts --no-frozen-lockfile

if deps_ok; then
  echo "[docker-ensure-deps] dependencies OK"
  exit 0
fi

echo "[docker-ensure-deps] broken symlinks detected — clean reinstall..."
clean_node_modules
pnpm install --ignore-scripts --no-frozen-lockfile

if ! deps_ok; then
  echo "[docker-ensure-deps] ERROR: dependencies still broken after clean install" >&2
  exit 1
fi

echo "[docker-ensure-deps] dependencies OK"
