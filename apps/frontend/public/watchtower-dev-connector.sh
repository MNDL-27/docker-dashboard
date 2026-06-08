#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEXT_SCRIPT="${SCRIPT_DIR}/watchtower-agent.sh"

cat >&2 <<'EOF'
WARNING: watchtower-dev-connector.sh is deprecated.
Use watchtower-agent-install.sh for new installs:
  curl -fsSLO https://your-watchtower-host/watchtower-agent-install.sh
  chmod +x watchtower-agent-install.sh
  sudo ./watchtower-agent-install.sh
EOF

if [ -x "$NEXT_SCRIPT" ]; then
  exec "$NEXT_SCRIPT" "$@"
fi

echo "watchtower-agent.sh was not found next to this legacy shim." >&2
echo "Download watchtower-agent-install.sh or watchtower-agent.sh instead." >&2
exit 1
