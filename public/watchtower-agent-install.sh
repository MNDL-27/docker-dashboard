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
  --check                 Validate the current or provided configuration without installing
  --port VALUE            Set AGENT_PORT (default: 9876)
  --bind-address VALUE    Set AGENT_BIND_ADDRESS (default: 0.0.0.0)
  --bind VALUE            Alias for --bind-address
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

check_config() {
  [ -n "$AGENT_API_KEY" ] || fail "AGENT_API_KEY is required. Set it in /etc/watchtower-agent/watchtower-agent.env or export it before starting."
  validate_port "$AGENT_PORT"
  [ -n "$AGENT_BIND_ADDRESS" ] || fail "AGENT_BIND_ADDRESS must not be empty."
  require_command socat
  require_command curl
  require_command awk
  require_command tr
  require_command sed
  [ -S "$DOCKER_SOCKET" ] || fail "Docker socket not found at $DOCKER_SOCKET. Confirm Docker is running or update DOCKER_SOCKET in /etc/watchtower-agent/watchtower-agent.env."
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

validate_bind_address() {
  [ -n "$1" ] || fail "AGENT_BIND_ADDRESS must not be empty"
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
DEFAULT_BIND_ADDRESS="127.0.0.1"
DEFAULT_DOCKER_SOCKET="/var/run/docker.sock"
FLAG_YES="false"
FLAG_CHECK="false"
CLI_API_KEY=""
CLI_PORT=""
CLI_BIND_ADDRESS=""
CLI_DOCKER_SOCKET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --api-key)
      [ $# -ge 2 ] || fail "--api-key requires a value"
      CLI_API_KEY="$2"
      shift 2
      ;;
    --check)
      FLAG_CHECK="true"
      shift
      ;;
    --port)
      [ $# -ge 2 ] || fail "--port requires a value"
      CLI_PORT="$2"
      shift 2
      ;;
    --bind-address|--bind)
      [ $# -ge 2 ] || fail "$1 requires a value"
      CLI_BIND_ADDRESS="$2"
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

for cmd in bash install systemctl getent useradd groupadd stat socat curl sed awk tr; do
  require_command "$cmd"
done

[ -d /run/systemd/system ] || fail "systemd is required on this host. For non-systemd environments, run watchtower-agent.sh under another supervisor or containerize it with restart=unless-stopped."

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

AGENT_API_KEY_VALUE="${CLI_API_KEY:-${AGENT_API_KEY:-}}"
AGENT_PORT_VALUE="${CLI_PORT:-${AGENT_PORT:-$DEFAULT_PORT}}"
AGENT_BIND_ADDRESS_VALUE="${CLI_BIND_ADDRESS:-${AGENT_BIND_ADDRESS:-${AGENT_BIND:-$DEFAULT_BIND_ADDRESS}}}"
DOCKER_SOCKET_VALUE="${CLI_DOCKER_SOCKET:-${DOCKER_SOCKET:-$DEFAULT_DOCKER_SOCKET}}"

validate_port "$AGENT_PORT_VALUE"
validate_bind_address "$AGENT_BIND_ADDRESS_VALUE"
[ -S "$DOCKER_SOCKET_VALUE" ] || fail "Docker socket not found at $DOCKER_SOCKET_VALUE. Ensure Docker is running or rerun with --docker-socket PATH."

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
if [ "$SOCKET_GROUP" = "UNKNOWN" ] || [ -z "$SOCKET_GROUP" ] || [ "$SOCKET_GROUP" = "root" ]; then
  fail "The Docker socket group for $DOCKER_SOCKET_VALUE must be a non-root group before installing the agent. Grant the socket to a group such as docker, or rerun with --docker-socket PATH."
fi

if [ "$FLAG_CHECK" = "true" ]; then
  cat <<EOF
watchtower-agent install preflight OK
  AGENT_PORT=${AGENT_PORT_VALUE}
  AGENT_BIND_ADDRESS=${AGENT_BIND_ADDRESS_VALUE}
  DOCKER_SOCKET=${DOCKER_SOCKET_VALUE}
  SOCKET_GROUP=${SOCKET_GROUP}
EOF
  exit 0
fi

if [ -f "$SERVICE_FILE" ] || [ -f "$ENV_FILE" ] || [ -f "${INSTALL_DIR}/watchtower-agent.sh" ]; then
  log "Existing watchtower-agent install detected; updating files and restarting the service"
else
  log "No existing watchtower-agent install detected; performing a fresh install"
fi

if ! getent group "$SERVICE_USER" >/dev/null 2>&1; then
  log "Creating system group ${SERVICE_USER}"
  groupadd --system "$SERVICE_USER"
else
  log "Reusing existing system group ${SERVICE_USER}"
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  NOLOGIN_SHELL="$(command -v nologin || true)"
  if [ -z "$NOLOGIN_SHELL" ]; then
    NOLOGIN_SHELL="/usr/sbin/nologin"
  fi
  if [ ! -x "$NOLOGIN_SHELL" ]; then
    NOLOGIN_SHELL="/bin/false"
  fi
  log "Creating system user ${SERVICE_USER}"
  useradd --system --home-dir "$INSTALL_DIR" --shell "$NOLOGIN_SHELL" --gid "$SERVICE_USER" "$SERVICE_USER"
else
  log "Reusing existing system user ${SERVICE_USER}"
fi

log "Creating install directories"
install -d -m 0755 "$INSTALL_DIR"
install -d -m 0750 "$CONFIG_DIR"
chown root:root "$INSTALL_DIR" "$CONFIG_DIR"

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

check_config() {
  [ -n "$AGENT_API_KEY" ] || fail "AGENT_API_KEY is required. Set it in /etc/watchtower-agent/watchtower-agent.env or export it before starting."
  validate_port "$AGENT_PORT"
  [ -n "$AGENT_BIND_ADDRESS" ] || fail "AGENT_BIND_ADDRESS must not be empty"
  require_command socat
  require_command curl
  require_command awk
  require_command tr
  require_command sed
  [ -S "$DOCKER_SOCKET" ] || fail "Docker socket not found at $DOCKER_SOCKET. Ensure Docker is running or update DOCKER_SOCKET."
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
AGENT_BIND_ADDRESS="${AGENT_BIND_ADDRESS:-${AGENT_BIND:-0.0.0.0}}"
DOCKER_SOCKET="${DOCKER_SOCKET:-/var/run/docker.sock}"

if [ "${1:-}" = "--check" ]; then
  check_config
  echo "watchtower-agent configuration is valid."
  exit 0
fi

check_config

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
  printf 'Access-Control-Allow-Methods: GET, POST, DELETE, PUT, PATCH, OPTIONS\r\n'
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

  header_name="$(printf '%s' "$header_line" | cut -d: -f1 | tr '[:upper:]' '[:lower:]')"
  header_value="$(printf '%s' "${header_line#*:}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  case "$header_name" in
    x-agent-key)
      AGENT_KEY="$header_value"
      ;;
    x-docker-socket)
      DOCKER_SOCK_OVERRIDE="$header_value"
      ;;
    content-length)
      CONTENT_LENGTH="$header_value"
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

# Handle /metrics endpoint for fleet dashboard
# Returns RAW values for proper fleet-wide aggregation
# Returns: { cpu_time_ns: <ns>, cpu_cores: <num>, memory_used: <bytes>, memory_limit: <bytes> }
# Backend computes fleet CPU % = sum(cpu_time_ns) / sum(cpu_cores * interval_ns) * 100
if [ "$PATH_RAW" = "/metrics" ]; then
  CONTAINERS_JSON=$(curl --silent --unix-socket "$SOCKET_PATH" "http://localhost/containers/json" 2>/dev/null)
  
  if [ -z "$CONTAINERS_JSON" ] || [ "$CONTAINERS_JSON" = "[]" ]; then
    respond_json '200 OK' '{"cpu_time_ns":0,"cpu_cores":0,"memory_used":0,"memory_limit":0}'
    exit 0
  fi
  
  CONTAINER_IDS=$(echo "$CONTAINERS_JSON" | grep -oE '"Id":"[a-f0-9]+"' | head -20 | cut -d'"' -f4)
  
  TOTAL_CPU_TIME_NS=0
  TOTAL_MEM_USED=0
  TOTAL_MEM_LIMIT=0
  HOST_CORES=0
  
  for CONTAINER_ID in $CONTAINER_IDS; do
    STATS_JSON=$(curl --silent --unix-socket "$SOCKET_PATH" "http://localhost/containers/${CONTAINER_ID}/stats?stream=false" 2>/dev/null)
    
    if [ -n "$STATS_JSON" ]; then
      CPU_USAGE=$(echo "$STATS_JSON" | grep -oE '"cpu_usage":{"total_usage":[0-9]+' | head -1 | sed 's/.*total_usage://' | tr -d '}')
      PREV_CPU=$(echo "$STATS_JSON" | grep -oE '"precpu_stats":{"cpu_usage":{"total_usage":[0-9]+' | head -1 | sed 's/.*total_usage://' | tr -d '}')
      ONLINE_CPUS=$(echo "$STATS_JSON" | grep -oE '"online_cpus":[0-9]+' | head -1 | sed 's/.*://' | tr -d '}')
      
      if [ -n "$ONLINE_CPUS" ] && [ "$HOST_CORES" = "0" ]; then
        HOST_CORES=$ONLINE_CPUS
      fi
      
      if [ -n "$CPU_USAGE" ] && [ -n "$PREV_CPU" ] && [ "$CPU_USAGE" -gt "$PREV_CPU" ]; then
        CPU_DELTA=$((CPU_USAGE - PREV_CPU))
        TOTAL_CPU_TIME_NS=$((TOTAL_CPU_TIME_NS + CPU_DELTA))
      fi
      
      MEM_USAGE=$(echo "$STATS_JSON" | grep -oE '"usage":[0-9]+' | head -1 | cut -d':' -f2)
      MEM_LIMIT=$(echo "$STATS_JSON" | grep -oE '"limit":[0-9]+' | head -1 | cut -d':' -f2)
      
      if [ -n "$MEM_USAGE" ] && [ -n "$MEM_LIMIT" ]; then
        TOTAL_MEM_USED=$((TOTAL_MEM_USED + MEM_USAGE))
        TOTAL_MEM_LIMIT=$((TOTAL_MEM_LIMIT + MEM_LIMIT))
      fi
    fi
  done
  
  if [ "$HOST_CORES" = "0" ]; then
    HOST_CORES=1
  fi
  
  METRICS_JSON="{\"cpu_time_ns\":${TOTAL_CPU_TIME_NS},\"cpu_cores\":${HOST_CORES},\"memory_used\":${TOTAL_MEM_USED},\"memory_limit\":${TOTAL_MEM_LIMIT}}"
  respond_json '200 OK' "$METRICS_JSON"
  exit 0
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

  header_name="$(printf '%s' "$header_line" | cut -d: -f1 | tr '[:upper:]' '[:lower:]')"

  case "$header_name" in
    content-length|transfer-encoding|connection|access-control-allow-origin)
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

echo "Starting watchtower-agent on ${AGENT_BIND_ADDRESS}:${AGENT_PORT}"
echo "Docker socket: ${DOCKER_SOCKET}"

exec socat "TCP-LISTEN:${AGENT_PORT},bind=${AGENT_BIND_ADDRESS},reuseaddr,fork" "EXEC:${HANDLER_SCRIPT}"
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
  --purge           Remove /etc/watchtower-agent and stored secrets
  --delete-config   Same as --purge
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

HAD_INSTALL="false"
DELETE_CONFIG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --purge|--delete-config)
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

if [ -f "$SERVICE_FILE" ] || [ -f "$UNINSTALL_BIN" ] || [ -d "$INSTALL_DIR" ] || [ -d "$CONFIG_DIR" ]; then
  HAD_INSTALL="true"
fi

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
  echo "Deleted config in $CONFIG_DIR"
else
  echo "Preserved config at $ENV_FILE"
fi

if [ "$DELETE_CONFIG" = "true" ] && id "$SERVICE_USER" >/dev/null 2>&1; then
  userdel "$SERVICE_USER" 2>/dev/null || true
fi

if [ "$DELETE_CONFIG" = "true" ] && getent group "$SERVICE_USER" >/dev/null 2>&1; then
  groupdel "$SERVICE_USER" 2>/dev/null || true
fi

if [ "$HAD_INSTALL" = "true" ]; then
  echo "watchtower-agent has been removed."
else
  echo "watchtower-agent was not installed; nothing needed removal."
fi
UNINSTALL_EOF

install -m 0755 "${INSTALL_DIR}/watchtower-agent-uninstall.sh" "$UNINSTALL_BIN"

log "Writing protected environment file"
ENV_FILE_TMP="$(mktemp "${CONFIG_DIR}/watchtower-agent.env.XXXXXX")"
chmod 0600 "$ENV_FILE_TMP"
cat >"$ENV_FILE_TMP" <<EOF
AGENT_API_KEY=$(quote_env_value "$AGENT_API_KEY_VALUE")
AGENT_PORT=$(quote_env_value "$AGENT_PORT_VALUE")
AGENT_BIND_ADDRESS=$(quote_env_value "$AGENT_BIND_ADDRESS_VALUE")
DOCKER_SOCKET=$(quote_env_value "$DOCKER_SOCKET_VALUE")
EOF
chown root:root "$ENV_FILE_TMP"
mv "$ENV_FILE_TMP" "$ENV_FILE"
chmod 0600 "$ENV_FILE"

log "Installing systemd unit"
cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Watchtower Agent
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5
ConditionPathExists=${ENV_FILE}

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
SupplementaryGroups=${SOCKET_GROUP}
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${INSTALL_DIR}
ExecStartPre=${INSTALL_DIR}/watchtower-agent.sh --check
ExecStart=${INSTALL_DIR}/watchtower-agent.sh
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "$SERVICE_FILE"

log "Reloading systemd"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service" >/dev/null
systemctl restart "${SERVICE_NAME}.service" 2>/dev/null || systemctl start "${SERVICE_NAME}.service"
if ! systemctl --quiet is-active "${SERVICE_NAME}.service"; then
  fail "watchtower-agent.service did not start cleanly. Inspect: sudo systemctl status ${SERVICE_NAME} && sudo journalctl -u ${SERVICE_NAME} -n 50"
fi

log "watchtower-agent installed"
cat <<EOF

Service name: ${SERVICE_NAME}
Runtime path: ${INSTALL_DIR}/watchtower-agent.sh
Config file:  ${ENV_FILE}
Validation:   ${INSTALL_DIR}/watchtower-agent.sh --check

Next commands:
  sudo systemctl status ${SERVICE_NAME}
  sudo journalctl -u ${SERVICE_NAME} -f
  sudo systemctl restart ${SERVICE_NAME}
  sudo ${UNINSTALL_BIN}
  sudo ${UNINSTALL_BIN} --purge

Notes:
  - The agent listens on ${AGENT_BIND_ADDRESS_VALUE}:${AGENT_PORT_VALUE}.
  - Direct mode should stay behind HTTPS via a reverse proxy.
  - Cloudflare Tunnel mode should target http://${AGENT_BIND_ADDRESS_VALUE}:${AGENT_PORT_VALUE}.
EOF
