#!/usr/bin/env bash
set -euo pipefail

echo "watchtower-dev-connector.sh is deprecated. Use watchtower-agent.sh or watchtower-agent-install.sh." >&2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -x "${SCRIPT_DIR}/watchtower-agent.sh" ]; then
  exec "${SCRIPT_DIR}/watchtower-agent.sh" "$@"
fi

echo "ERROR: watchtower-agent.sh was not found next to this compatibility shim." >&2
echo "Download the production installer instead:" >&2
echo "  curl -fsSL <your-watchtower-url>/watchtower-agent-install.sh -o watchtower-agent-install.sh" >&2
exit 1
