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
Usage: watchtower-agent-install.sh [options]

Options:
  --api-key VALUE         Set AGENT_API_KEY non-interactively
  --port VALUE            Set AGENT_PORT (default: 9876)
  --bind VALUE            Set AGENT_BIND (default: 127.0.0.1)
  --docker-socket PATH    Set DOCKER_SOCKET (default: /var/run/docker.sock)
  --yes                   Accept defaults without prompting
  --help                  Show this help text
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  echo "==> $*"
}

require_root() {
  [ "$(id -u)" -eq 0 ] || fail "Run this installer with sudo or as root"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but not installed"
}

validate_port() {
  case "$1" in
    ''|*[!0-9]*)
      fail "Port must be a number between 1 and 65535"
      ;;
  esac

  if [ "$1" -lt 1 ] || [ "$1" -gt 65535 ]; then
    fail "Port must be a number between 1 and 65535"
  fi
}

validate_api_key() {
  [ -n "$1" ] || fail "AGENT_API_KEY is required"
  case "$1" in
    *$'\n'*|*$'\r'*)
      fail "AGENT_API_KEY must not contain newlines"
      ;;
  esac
}

quote_env_value() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

prompt_hidden() {
  local prompt="$1"
  local value=""
  read -r -s -p "$prompt" value
  printf '\n' >&2
  printf '%s' "$value"
}

DEFAULT_PORT="9876"
DEFAULT_BIND="127.0.0.1"
DEFAULT_DOCKER_SOCKET="/var/run/docker.sock"
FLAG_YES="false"
CLI_API_KEY=""
CLI_PORT=""
CLI_BIND=""
CLI_DOCKER_SOCKET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --api-key)
      [ $# -ge 2 ] || fail "--api-key requires a value"
      CLI_API_KEY="$2"
      shift 2
      ;;
    --port)
      [ $# -ge 2 ] || fail "--port requires a value"
      CLI_PORT="$2"
      shift 2
      ;;
    --bind)
      [ $# -ge 2 ] || fail "--bind requires a value"
      CLI_BIND="$2"
      shift 2
      ;;
    --docker-socket)
      [ $# -ge 2 ] || fail "--docker-socket requires a value"
      CLI_DOCKER_SOCKET="$2"
      shift 2
      ;;
    --yes)
      FLAG_YES="true"
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

for cmd in bash install systemctl getent useradd usermod groupadd stat socat curl; do
  require_command "$cmd"
done

[ -d /run/systemd/system ] || fail "systemd is required on this host. For non-systemd environments, run watchtower-agent.sh under another supervisor or containerize it with restart=unless-stopped."

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

AGENT_API_KEY_VALUE="${CLI_API_KEY:-${AGENT_API_KEY:-}}"
AGENT_PORT_VALUE="${CLI_PORT:-${AGENT_PORT:-$DEFAULT_PORT}}"
AGENT_BIND_VALUE="${CLI_BIND:-${AGENT_BIND:-$DEFAULT_BIND}}"
DOCKER_SOCKET_VALUE="${CLI_DOCKER_SOCKET:-${DOCKER_SOCKET:-$DEFAULT_DOCKER_SOCKET}}"

validate_port "$AGENT_PORT_VALUE"
[ -S "$DOCKER_SOCKET_VALUE" ] || fail "Docker socket not found at $DOCKER_SOCKET_VALUE"

if [ -z "$AGENT_API_KEY_VALUE" ]; then
  if [ -t 0 ]; then
    AGENT_API_KEY_VALUE="$(prompt_hidden 'Enter AGENT_API_KEY: ')"
  elif [ "$FLAG_YES" = "true" ]; then
    fail "AGENT_API_KEY is required when using --yes"
  else
    fail "AGENT_API_KEY is required. Re-run with --api-key or from an interactive terminal."
  fi
fi

validate_api_key "$AGENT_API_KEY_VALUE"

SOCKET_GROUP="$(stat -c '%G' "$DOCKER_SOCKET_VALUE")"
if [ "$SOCKET_GROUP" = "UNKNOWN" ] || [ -z "$SOCKET_GROUP" ]; then
  fail "Could not determine the group that owns $DOCKER_SOCKET_VALUE"
fi

if ! getent group "$SERVICE_USER" >/dev/null 2>&1; then
  log "Creating system group ${SERVICE_USER}"
  groupadd --system "$SERVICE_USER"
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  log "Creating system user ${SERVICE_USER}"
  useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin --gid "$SERVICE_USER" "$SERVICE_USER"
fi

if [ "$SOCKET_GROUP" != "root" ]; then
  log "Granting ${SERVICE_USER} access to the Docker socket group (${SOCKET_GROUP})"
  usermod -a -G "$SOCKET_GROUP" "$SERVICE_USER"
else
  fail "$DOCKER_SOCKET_VALUE is owned by group root. Grant a non-root group access to the socket, then re-run the installer."
fi

log "Creating install directories"
install -d -m 0755 "$INSTALL_DIR"
install -d -m 0755 "$CONFIG_DIR"

log "Installing runtime"
install -m 0755 /dev/stdin "${INSTALL_DIR}/watchtower-agent.sh" <<'RUNTIME_EOF'
#!/usr/bin/env bash

set -euo pipefail

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but not installed"
}

validate_port() {
  case "$1" in
    ''|*[!0-9]*)
      fail "AGENT_PORT must be a number between 1 and 65535"
      ;;
  esac

  if [ "$1" -lt 1 ] || [ "$1" -gt 65535 ]; then
    fail "AGENT_PORT must be a number between 1 and 65535"
  fi
}

cleanup() {
  if [ -n "${HANDLER_SCRIPT:-}" ] && [ -f "$HANDLER_SCRIPT" ]; then
    rm -f "$HANDLER_SCRIPT"
  fi
}

trap cleanup EXIT INT TERM

AGENT_API_KEY="${AGENT_API_KEY:-}"
AGENT_PORT="${AGENT_PORT:-9876}"
AGENT_BIND="${AGENT_BIND:-127.0.0.1}"
DOCKER_SOCKET="${DOCKER_SOCKET:-/var/run/docker.sock}"

[ -n "$AGENT_API_KEY" ] || fail "AGENT_API_KEY is required"
validate_port "$AGENT_PORT"
require_command socat
require_command curl
[ -S "$DOCKER_SOCKET" ] || fail "Docker socket not found at $DOCKER_SOCKET"

HANDLER_SCRIPT="$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-handler.XXXXXX")"

cat >"$HANDLER_SCRIPT" <<'HANDLER_EOF'
#!/usr/bin/env bash

set -euo pipefail

respond_json() {
  local status="$1"
  local body="$2"
  printf 'HTTP/1.1 %s\r\n' "$status"
  printf 'Content-Type: application/json\r\n'
  printf 'Access-Control-Allow-Origin: *\r\n'
  printf 'Content-Length: %s\r\n' "${#body}"
  printf '\r\n'
  printf '%s' "$body"
}

cleanup_handler() {
  rm -f "${REQUEST_BODY_FILE:-}" "${RESPONSE_BODY_FILE:-}" "${RESPONSE_HEADERS_FILE:-}" "${CURL_ERROR_FILE:-}"
}

trap cleanup_handler EXIT INT TERM

IFS= read -r REQUEST_LINE || exit 0

METHOD="$(printf '%s' "$REQUEST_LINE" | awk '{print $1}')"
PATH_RAW="$(printf '%s' "$REQUEST_LINE" | awk '{print $2}')"

if [ -z "$METHOD" ] || [ -z "$PATH_RAW" ]; then
  respond_json '400 Bad Request' '{"error":"Malformed HTTP request"}'
  exit 0
fi

if [ "$METHOD" = "OPTIONS" ]; then
  printf 'HTTP/1.1 204 No Content\r\n'
  printf 'Access-Control-Allow-Origin: *\r\n'
  printf 'Access-Control-Allow-Headers: X-Agent-Key, X-Docker-Socket, Content-Type\r\n'
  printf 'Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n'
  printf 'Content-Length: 0\r\n'
  printf '\r\n'
  exit 0
fi

AGENT_KEY=""
DOCKER_SOCK_OVERRIDE=""
CONTENT_LENGTH=0

while IFS= read -r header_line; do
  header_line="$(printf '%s' "$header_line" | tr -d '\r')"
  [ -z "$header_line" ] && break

  case "$(printf '%s' "$header_line" | tr '[:upper:]' '[:lower:]')" in
    x-agent-key:*)
      AGENT_KEY="${header_line#*: }"
      ;;
    x-docker-socket:*)
      DOCKER_SOCK_OVERRIDE="${header_line#*: }"
      ;;
    content-length:*)
      CONTENT_LENGTH="${header_line#*: }"
      ;;
  esac
done

if [ "$AGENT_KEY" != "$AGENT_API_KEY" ]; then
  respond_json '401 Unauthorized' '{"error":"Invalid API key"}'
  exit 0
fi

case "$CONTENT_LENGTH" in
  ''|*[!0-9]*)
    respond_json '400 Bad Request' '{"error":"Invalid Content-Length header"}'
    exit 0
    ;;
esac

REQUEST_BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-request-body.XXXXXX")"
RESPONSE_BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-response-body.XXXXXX")"
RESPONSE_HEADERS_FILE="$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-response-headers.XXXXXX")"
CURL_ERROR_FILE="$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-curl-error.XXXXXX")"

if [ "$CONTENT_LENGTH" -gt 0 ]; then
  dd bs=1 count="$CONTENT_LENGTH" of="$REQUEST_BODY_FILE" status=none || true
fi

DOCKER_PATH="${PATH_RAW#/docker}"
[ -n "$DOCKER_PATH" ] || DOCKER_PATH="/"

SOCKET_PATH="${DOCKER_SOCK_OVERRIDE:-$DOCKER_SOCKET}"
[ -S "$SOCKET_PATH" ] || {
  respond_json '500 Internal Server Error' "{\"error\":\"Docker socket not found at $SOCKET_PATH\"}"
  exit 0
}

CURL_ARGS=(
  --silent
  --show-error
  --unix-socket "$SOCKET_PATH"
  --request "$METHOD"
  --output "$RESPONSE_BODY_FILE"
  --dump-header "$RESPONSE_HEADERS_FILE"
  "http://localhost${DOCKER_PATH}"
)

if [ "$CONTENT_LENGTH" -gt 0 ]; then
  CURL_ARGS+=(--data-binary "@$REQUEST_BODY_FILE")
fi

if ! curl "${CURL_ARGS[@]}" 2>"$CURL_ERROR_FILE"; then
  ERROR_MESSAGE="$(tr -d '\r' <"$CURL_ERROR_FILE" | sed 's/"/\\"/g')"
  respond_json '502 Bad Gateway' "{\"error\":\"Docker API request failed\",\"details\":\"${ERROR_MESSAGE}\"}"
  exit 0
fi

STATUS_LINE="$(head -n 1 "$RESPONSE_HEADERS_FILE" | tr -d '\r')"
STATUS_CODE="$(printf '%s' "$STATUS_LINE" | awk '{print $2}')"
STATUS_TEXT="$(printf '%s' "$STATUS_LINE" | cut -d' ' -f3-)"
BODY_LENGTH="$(wc -c <"$RESPONSE_BODY_FILE" | tr -d ' ')"

[ -n "$STATUS_CODE" ] || STATUS_CODE="502"
[ -n "$STATUS_TEXT" ] || STATUS_TEXT="Bad Gateway"

printf 'HTTP/1.1 %s %s\r\n' "$STATUS_CODE" "$STATUS_TEXT"

tail -n +2 "$RESPONSE_HEADERS_FILE" | while IFS= read -r header_line; do
  header_line="$(printf '%s' "$header_line" | tr -d '\r')"
  [ -z "$header_line" ] && continue

  case "$(printf '%s' "$header_line" | tr '[:upper:]' '[:lower:]')" in
    content-length:*|transfer-encoding:*|connection:*|access-control-allow-origin:*)
      continue
      ;;
  esac

  printf '%s\r\n' "$header_line"
done

printf 'Access-Control-Allow-Origin: *\r\n'
printf 'Content-Length: %s\r\n' "$BODY_LENGTH"
printf '\r\n'
cat "$RESPONSE_BODY_FILE"
HANDLER_EOF

chmod 0755 "$HANDLER_SCRIPT"
export AGENT_API_KEY DOCKER_SOCKET

echo "Starting watchtower-agent on ${AGENT_BIND}:${AGENT_PORT}"
echo "Docker socket: ${DOCKER_SOCKET}"

exec socat "TCP-LISTEN:${AGENT_PORT},bind=${AGENT_BIND},reuseaddr,fork" "EXEC:${HANDLER_SCRIPT}"
RUNTIME_EOF

log "Installing uninstall helper"
install -m 0755 /dev/stdin "${INSTALL_DIR}/watchtower-agent-uninstall.sh" <<'UNINSTALL_EOF'
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
UNINSTALL_EOF

install -m 0755 "${INSTALL_DIR}/watchtower-agent-uninstall.sh" "$UNINSTALL_BIN"

log "Writing protected environment file"
umask 077
cat >"$ENV_FILE" <<EOF
AGENT_API_KEY=$(quote_env_value "$AGENT_API_KEY_VALUE")
AGENT_PORT=$(quote_env_value "$AGENT_PORT_VALUE")
AGENT_BIND=$(quote_env_value "$AGENT_BIND_VALUE")
DOCKER_SOCKET=$(quote_env_value "$DOCKER_SOCKET_VALUE")
EOF
chown root:root "$ENV_FILE"
chmod 0600 "$ENV_FILE"

log "Installing systemd unit"
cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Watchtower Agent
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/watchtower-agent.sh
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "$SERVICE_FILE"

log "Reloading systemd"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service" >/dev/null
systemctl restart "${SERVICE_NAME}.service" 2>/dev/null || systemctl start "${SERVICE_NAME}.service"

log "watchtower-agent installed"
cat <<EOF

Service name: ${SERVICE_NAME}
Runtime path: ${INSTALL_DIR}/watchtower-agent.sh
Config file:  ${ENV_FILE}

Next commands:
  sudo systemctl status ${SERVICE_NAME}
  sudo journalctl -u ${SERVICE_NAME} -f
  sudo systemctl restart ${SERVICE_NAME}
  sudo ${UNINSTALL_BIN}

Notes:
  - The agent listens on ${AGENT_BIND_VALUE}:${AGENT_PORT_VALUE}.
  - Direct mode should stay behind HTTPS via a reverse proxy.
  - Cloudflare Tunnel mode should target http://${AGENT_BIND_VALUE}:${AGENT_PORT_VALUE}.
EOF
