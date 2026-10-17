#!/usr/bin/env bash
# Installs forgejo-mcp and registers it with Claude Code (user scope) inside a
# Claude Code cloud environment. Paste into the environment's "Setup script",
# or run it as: curl -fsSL <raw url>/scripts/cloud-setup.sh | FORGEJO_URL=... bash
#
# Required: FORGEJO_URL
# Optional: FORGEJO_READ_ONLY (default true), FORGEJO_MCP_DIR (default /opt/forgejo-mcp),
#           FORGEJO_MCP_REPO (default https://github.com/jerdog/forgejo-mcp)
#
# No Forgejo token is configured here: when the environment's proxy injects
# credentials for the Forgejo host, requests made with NODE_USE_ENV_PROXY=1
# are authenticated by the proxy. Set FORGEJO_TOKEN only if it does not.
set -euo pipefail

: "${FORGEJO_URL:?set FORGEJO_URL, e.g. https://git.example.com}"
READ_ONLY="${FORGEJO_READ_ONLY:-true}"
DIR="${FORGEJO_MCP_DIR:-/opt/forgejo-mcp}"
REPO="${FORGEJO_MCP_REPO:-https://github.com/jerdog/forgejo-mcp}"

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone --depth 1 "$REPO" "$DIR"
fi
(cd "$DIR" && npm ci)   # `prepare` builds dist/

env_args=(-e "FORGEJO_URL=$FORGEJO_URL" -e "FORGEJO_READ_ONLY=$READ_ONLY" -e NODE_USE_ENV_PROXY=1)
[ -n "${FORGEJO_TOKEN:-}" ] && env_args+=(-e "FORGEJO_TOKEN=$FORGEJO_TOKEN")

claude mcp remove forgejo --scope user >/dev/null 2>&1 || true
claude mcp add forgejo --scope user "${env_args[@]}" -- node "$DIR/dist/stdio.js"

# Smoke test: fails the script (and shows why) if the host or auth is wrong.
NODE_USE_ENV_PROXY=1 node "$DIR/dist/stdio.js" --check
