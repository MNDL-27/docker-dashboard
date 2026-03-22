#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="watchtower-agent"
SERVICE_USER="watchtower-agent"
INSTALL_DIR="/opt/watchtower-agent"
CONFIG_DIR="/etc/watchtower-agent"
ENV_FILE="${CONFIG_DIR}/watchtower-agent.env"
SERVICE_FILE="/etc/systemd/system/watchtower-agent.service"
UNINSTALL_BIN="/usr/local/bin/watchtower-agent-uninstall"

usage() {
  cat <<'EOF'
Usage: watchtower-agent-uninstall.sh [options]

Options:
  --delete-config   Remove /etc/watchtower-agent and stored secrets
  --keep-config     Preserve /etc/watchtower-agent for reinstall
  --help            Show this help text
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_root() {
  [ "$(id -u)" -eq 0 ] || fail "Run this uninstaller with sudo or as root"
}

DELETE_CONFIG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --delete-config)
      DELETE_CONFIG="true"
      shift
      ;;
    --keep-config)
      DELETE_CONFIG="false"
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

require_root

if [ -z "$DELETE_CONFIG" ]; then
  if [ -t 0 ]; then
    read -r -p "Delete stored config and secrets in ${CONFIG_DIR}? [y/N]: " reply
    case "$reply" in
      y|Y|yes|YES)
        DELETE_CONFIG="true"
        ;;
      *)
        DELETE_CONFIG="false"
        ;;
    esac
  else
    DELETE_CONFIG="false"
  fi
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl stop "${SERVICE_NAME}.service" 2>/dev/null || true
  systemctl disable "${SERVICE_NAME}.service" 2>/dev/null || true
fi

rm -f "$SERVICE_FILE"

if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload 2>/dev/null || true
  systemctl reset-failed "${SERVICE_NAME}.service" 2>/dev/null || true
fi

rm -f "$UNINSTALL_BIN"
rm -rf "$INSTALL_DIR"

if [ "$DELETE_CONFIG" = "true" ]; then
  rm -rf "$CONFIG_DIR"
else
  echo "Preserved config at $ENV_FILE"
fi

if id "$SERVICE_USER" >/dev/null 2>&1; then
  userdel "$SERVICE_USER" 2>/dev/null || true
fi

if getent group "$SERVICE_USER" >/dev/null 2>&1; then
  groupdel "$SERVICE_USER" 2>/dev/null || true
fi

echo "watchtower-agent has been removed."
