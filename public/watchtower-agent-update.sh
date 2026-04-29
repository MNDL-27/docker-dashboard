#!/usr/bin/env bash

set -euo pipefail

# watchtower-agent-update — One-command self-updater for Dockerdash agent
# Usage: sudo watchtower-agent-update

SERVICE_NAME="watchtower-agent"
INSTALL_DIR="/opt/watchtower-agent"
CONFIG_DIR="/etc/watchtower-agent"
ENV_FILE="${CONFIG_DIR}/watchtower-agent.env"
SERVICE_FILE="/etc/systemd/system/watchtower-agent.service"
UPDATE_URL="https://app.dockerdash.app/watchtower-agent.sh"
INSTALLER_URL="https://app.dockerdash.app/watchtower-agent-install.sh"
VERSION_URL="https://app.dockerdash.app/api/agent-release"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║       Dockerdash Agent Updater           ║${RESET}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${RESET}"
  echo ""
}

step() {
  echo -e "  ${CYAN}▸${RESET} $*"
}

success() {
  echo -e "  ${GREEN}✔${RESET} $*"
}

warn() {
  echo -e "  ${YELLOW}⚠${RESET} $*"
}

fail() {
  echo -e "  ${RED}✖ ERROR:${RESET} $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: watchtower-agent-update [options]

Options:
  --check       Check for updates without installing
  --force       Force update even if already on the latest version
  --quiet       Suppress banner and decorative output
  --help        Show this help text

Run without options to check for and apply any available update.
EOF
}

extract_runtime_version() {
  local file_path="$1"
  [ -f "$file_path" ] || return 0
  sed -n 's/^WATCHTOWER_AGENT_VERSION="${WATCHTOWER_AGENT_VERSION:-\([^"]*\)}"/\1/p' "$file_path" | head -1
}

repair_systemd_socket_group() {
  [ -f "$SERVICE_FILE" ] || return 0
  [ -f "$ENV_FILE" ] || return 0

  # shellcheck disable=SC1090
  . "$ENV_FILE"

  local socket_path="${DOCKER_SOCKET:-/var/run/docker.sock}"
  if [ ! -S "$socket_path" ]; then
    warn "Docker socket not found at ${socket_path}; leaving systemd unit unchanged."
    return 0
  fi

  local socket_group
  socket_group="$(stat -c '%G' "$socket_path" 2>/dev/null || true)"
  if [ -z "$socket_group" ] || [ "$socket_group" = "UNKNOWN" ] || [ "$socket_group" = "root" ]; then
    warn "Docker socket group for ${socket_path} is not usable (${socket_group:-unknown}); leaving systemd unit unchanged."
    return 0
  fi

  if grep -q "^SupplementaryGroups=${socket_group}$" "$SERVICE_FILE"; then
    return 0
  fi

  step "Repairing systemd Docker socket group..."
  if grep -q '^SupplementaryGroups=' "$SERVICE_FILE"; then
    sed -i "s/^SupplementaryGroups=.*/SupplementaryGroups=${socket_group}/" "$SERVICE_FILE"
  elif grep -q '^Group=' "$SERVICE_FILE"; then
    sed -i "/^Group=/a SupplementaryGroups=${socket_group}" "$SERVICE_FILE"
  else
    warn "Could not find Group= in ${SERVICE_FILE}; reinstall the agent from Dockerdash to repair the unit."
  fi
}

verify_local_docker_ping() {
  [ -f "$ENV_FILE" ] || return 0

  # shellcheck disable=SC1090
  . "$ENV_FILE"

  local bind_address="${AGENT_BIND_ADDRESS:-127.0.0.1}"
  local port="${AGENT_PORT:-9876}"

  case "$bind_address" in
    ""|"0.0.0.0"|"::")
      bind_address="127.0.0.1"
      ;;
  esac

  if curl -fsS "http://${bind_address}:${port}/docker/_ping" -H "X-Agent-Key: ${AGENT_API_KEY}" >/dev/null 2>&1; then
    success "Local Docker socket check passed"
  else
    warn "Agent is running, but local Docker ping failed. Inspect: sudo journalctl -u ${SERVICE_NAME} -n 50"
  fi
}

FLAG_CHECK="false"
FLAG_FORCE="false"
FLAG_QUIET="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --check)
      FLAG_CHECK="true"
      shift
      ;;
    --force)
      FLAG_FORCE="true"
      shift
      ;;
    --quiet)
      FLAG_QUIET="true"
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1. Run with --help for usage."
      ;;
  esac
done

# ── Pre-flight ──────────────────────────────────────────────────────────

[ "$(id -u)" -eq 0 ] || fail "Run this command with sudo:  sudo watchtower-agent-update"

[ -f "${INSTALL_DIR}/watchtower-agent.sh" ] || fail "Watchtower agent is not installed at ${INSTALL_DIR}. Run the install command from your Dockerdash dashboard first."

[ -f "$ENV_FILE" ] || fail "Agent config not found at ${ENV_FILE}. The agent may not be installed properly."

command -v curl >/dev/null 2>&1 || fail "curl is required but not installed."
command -v systemctl >/dev/null 2>&1 || fail "systemd is required for this updater."
command -v stat >/dev/null 2>&1 || fail "stat is required but not installed."
command -v sed >/dev/null 2>&1 || fail "sed is required but not installed."
command -v grep >/dev/null 2>&1 || fail "grep is required but not installed."

# ── Gather info ─────────────────────────────────────────────────────────

CURRENT_VERSION="$(extract_runtime_version "${INSTALL_DIR}/watchtower-agent.sh" || echo "unknown")"

if [ "$FLAG_QUIET" != "true" ]; then
  banner
  step "Current agent version: ${BOLD}${CURRENT_VERSION}${RESET}"
fi

# ── Check latest version ────────────────────────────────────────────────

step "Checking for updates..."

LATEST_SCRIPT=$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-latest.XXXXXX")
trap 'rm -f "$LATEST_SCRIPT"' EXIT INT TERM

if ! curl -fsSL "$UPDATE_URL" -o "$LATEST_SCRIPT" 2>/dev/null; then
  fail "Failed to download latest agent from ${UPDATE_URL}. Check your network connection."
fi

LATEST_VERSION="$(extract_runtime_version "$LATEST_SCRIPT" || echo "unknown")"

if [ "$LATEST_VERSION" = "unknown" ]; then
  fail "Could not determine the version of the downloaded agent. The download may be corrupt."
fi

if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ] && [ "$FLAG_FORCE" != "true" ]; then
  success "Already on the latest version: ${BOLD}${CURRENT_VERSION}${RESET}"
  if [ "$FLAG_CHECK" = "true" ]; then
    echo ""
    echo -e "  ${DIM}No update needed.${RESET}"
  fi
  echo ""
  exit 0
fi

if [ "$FLAG_CHECK" = "true" ]; then
  echo ""
  echo -e "  ${YELLOW}Update available:${RESET} ${CURRENT_VERSION} → ${BOLD}${GREEN}${LATEST_VERSION}${RESET}"
  echo -e "  ${DIM}Run ${BOLD}sudo watchtower-agent-update${RESET}${DIM} to apply.${RESET}"
  echo ""
  exit 0
fi

# ── Apply update ────────────────────────────────────────────────────────

echo ""
echo -e "  ${YELLOW}Updating:${RESET} ${CURRENT_VERSION} → ${BOLD}${GREEN}${LATEST_VERSION}${RESET}"
echo ""

step "Stopping service..."
systemctl stop "${SERVICE_NAME}.service" 2>/dev/null || true

step "Installing new agent runtime..."
install -m 0755 "$LATEST_SCRIPT" "${INSTALL_DIR}/watchtower-agent.sh"

repair_systemd_socket_group

step "Verifying agent config..."
if ! "${INSTALL_DIR}/watchtower-agent.sh" --check >/dev/null 2>&1; then
  warn "Config verification failed after update. Attempting rollback is not supported."
  warn "Inspect: sudo journalctl -u ${SERVICE_NAME} -n 50"
fi

step "Restarting service..."
systemctl daemon-reload
systemctl restart "${SERVICE_NAME}.service" 2>/dev/null || systemctl start "${SERVICE_NAME}.service"

# Give it a moment to start
sleep 2

if systemctl --quiet is-active "${SERVICE_NAME}.service"; then
  INSTALLED_VERSION="$(extract_runtime_version "${INSTALL_DIR}/watchtower-agent.sh" || echo "unknown")"
  echo ""
  success "Agent updated successfully: ${BOLD}${INSTALLED_VERSION}${RESET}"
  verify_local_docker_ping
  echo ""
  echo -e "  ${DIM}Service status:${RESET}  sudo systemctl status ${SERVICE_NAME}"
  echo -e "  ${DIM}Service logs:${RESET}    sudo journalctl -u ${SERVICE_NAME} -f"
  echo ""
else
  echo ""
  warn "Service may not have started cleanly."
  echo -e "  ${DIM}Check status:${RESET}  sudo systemctl status ${SERVICE_NAME}"
  echo -e "  ${DIM}Check logs:${RESET}    sudo journalctl -u ${SERVICE_NAME} -n 50"
  echo ""
  exit 1
fi
