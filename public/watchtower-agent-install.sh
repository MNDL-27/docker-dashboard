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
  --expected-version VAL  Fail if the installed runtime version does not match this value
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
  require_command mkdir
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

extract_runtime_version() {
  local file_path="$1"
  if [ ! -f "$file_path" ]; then
    return 0
  fi

  sed -n 's/^WATCHTOWER_AGENT_VERSION="${WATCHTOWER_AGENT_VERSION:-\([^"]*\)}"$/\1/p' "$file_path" | head -1
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
CLI_EXPECTED_VERSION=""
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
    --expected-version)
      [ $# -ge 2 ] || fail "--expected-version requires a value"
      CLI_EXPECTED_VERSION="$2"
      shift 2
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

install_jq() {
  if command -v jq >/dev/null 2>&1; then
    return 0
  fi
  
  log "jq is required but not found. Attempting to install jq..."
  if command -v apk >/dev/null 2>&1; then
    apk add --no-cache jq
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -o Dir::Cache::pkgcache="" -o Dir::Cache::srcpkgcache="" -qq && apt-get install -y --no-install-recommends jq
  elif command -v yum >/dev/null 2>&1; then
    yum install -y epel-release || true
    yum install -y jq
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y jq
  else
    fail "Could not find a supported package manager (apk, apt-get, yum, dnf) to install jq. Please install jq manually and rerun the installer."
  fi
}

install_jq
require_command jq

[ -d /run/systemd/system ] || fail "systemd is required on this host. For non-systemd environments, run watchtower-agent.sh under another supervisor or containerize it with restart=unless-stopped."

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

AGENT_API_KEY_VALUE="${CLI_API_KEY:-${AGENT_API_KEY:-}}"
AGENT_PORT_VALUE="${CLI_PORT:-${AGENT_PORT:-$DEFAULT_PORT}}"
AGENT_BIND_ADDRESS_VALUE="${CLI_BIND_ADDRESS:-${AGENT_BIND_ADDRESS:-${AGENT_BIND:-$DEFAULT_BIND_ADDRESS}}}"
DOCKER_SOCKET_VALUE="${CLI_DOCKER_SOCKET:-${DOCKER_SOCKET:-$DEFAULT_DOCKER_SOCKET}}"
STATE_DIR_VALUE="${WATCHTOWER_AGENT_STATE_DIR:-/var/lib/watchtower-agent}"
EXPECTED_VERSION_VALUE="${CLI_EXPECTED_VERSION:-${WATCHTOWER_AGENT_EXPECTED_VERSION:-}}"

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

PREVIOUS_RUNTIME_VERSION="$(extract_runtime_version "${INSTALL_DIR}/watchtower-agent.sh" || true)"

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
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$STATE_DIR_VALUE"

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
  require_command jq
  require_command mkdir
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
WATCHTOWER_AGENT_STATE_DIR="${WATCHTOWER_AGENT_STATE_DIR:-/var/lib/watchtower-agent}"
WATCHTOWER_AGENT_VERSION="${WATCHTOWER_AGENT_VERSION:-1.0.4}"

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

ensure_state_dir() {
  mkdir -p "$WATCHTOWER_AGENT_STATE_DIR"
}

metrics_cache_file() {
  printf '%s/metrics-cache' "$WATCHTOWER_AGENT_STATE_DIR"
}

read_cached_metrics() {
  local cache_file
  cache_file="$(metrics_cache_file)"

  [ -f "$cache_file" ] || return 1

  IFS='|' read -r \
    cached_timestamp \
    cached_cpu_time_ns \
    cached_system_time_ns \
    cached_network_in_bytes \
    cached_network_out_bytes \
    cached_disk_read_bytes \
    cached_disk_write_bytes <"$cache_file" || return 1

  case "$cached_timestamp" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_cpu_time_ns" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_system_time_ns" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_network_in_bytes" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_network_out_bytes" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_disk_read_bytes" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_disk_write_bytes" in ''|*[!0-9]*) return 1 ;; esac

  printf '%s|%s|%s|%s|%s|%s|%s' \
    "$cached_timestamp" \
    "$cached_cpu_time_ns" \
    "$cached_system_time_ns" \
    "$cached_network_in_bytes" \
    "$cached_network_out_bytes" \
    "$cached_disk_read_bytes" \
    "$cached_disk_write_bytes"
}

write_cached_metrics() {
  local cache_file tmp_file
  cache_file="$(metrics_cache_file)"
  ensure_state_dir
  tmp_file="$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-metrics-cache.XXXXXX")"

  printf '%s|%s|%s|%s|%s|%s|%s\n' \
    "$1" \
    "$2" \
    "$3" \
    "$4" \
    "$5" \
    "$6" \
    "$7" >"$tmp_file"

  mv "$tmp_file" "$cache_file"
}

calculate_rate() {
  local current="$1"
  local previous="$2"
  local elapsed_ms="$3"

  awk -v current="$current" -v previous="$previous" -v elapsed_ms="$elapsed_ms" 'BEGIN {
    if (elapsed_ms <= 0) {
      print 0
      exit
    }

    delta = current - previous
    if (delta < 0) {
      delta = 0
    }

    printf "%.2f", delta / (elapsed_ms / 1000.0)
  }'
}

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

if [ "$PATH_RAW" = "/agent/version" ]; then
  respond_json '200 OK' "{\"agent_version\":\"${WATCHTOWER_AGENT_VERSION}\",\"version\":\"${WATCHTOWER_AGENT_VERSION}\"}"
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

SOCKET_PATH="${DOCKER_SOCK_OVERRIDE:-$DOCKER_SOCKET}"

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
# Returns: { cpu_time_ns: <ns>, system_time_ns: <ns>, online_cpus: <num>, memory_used: <bytes>, memory_limit: <bytes>, network_in_bytes_per_sec: <rate>, network_out_bytes_per_sec: <rate>, disk_read_bytes_per_sec: <rate>, disk_write_bytes_per_sec: <rate> }
# Backend computes: cpu % = Σ (cpu_time_ns / system_time_ns * online_cpus) × 100
# This matches Docker's standard formula: (cpuDelta / systemDelta) * onlineCPUs * 100
  if [ "$PATH_RAW" = "/metrics" ]; then
  CONTAINERS_JSON=$(curl --silent --unix-socket "$SOCKET_PATH" "http://localhost/containers/json" 2>/dev/null)

  if [ -z "$CONTAINERS_JSON" ] || [ "$CONTAINERS_JSON" = "[]" ]; then
    write_cached_metrics "$(date +%s%3N)" 0 0 0 0 0 0
    respond_json '200 OK' '{"cpu_time_ns":0,"system_time_ns":0,"online_cpus":0,"memory_used":0,"memory_limit":0,"network_in_bytes_per_sec":null,"network_out_bytes_per_sec":null,"disk_read_bytes_per_sec":null,"disk_write_bytes_per_sec":null}'
    exit 0
  fi

  CONTAINER_IDS=$(echo "$CONTAINERS_JSON" | jq -r '.[0:20] | .[].Id // empty')

  TOTAL_CPU_TIME_NS=0
  TOTAL_SYSTEM_TIME_NS=0
  TOTAL_MEM_USED=0
  TOTAL_MEM_LIMIT=0
  TOTAL_NETWORK_IN_BYTES=0
  TOTAL_NETWORK_OUT_BYTES=0
  TOTAL_DISK_READ_BYTES=0
  TOTAL_DISK_WRITE_BYTES=0
  HOST_CORES=0
  MEASURED_SYSTEM_NS=0

  STATS_TMPDIR="$(mktemp -d "${TMPDIR:-/tmp}/wt-stats.XXXXXX")"

  for CONTAINER_ID in $CONTAINER_IDS; do
    (
      curl --silent --max-time 5 --unix-socket "$SOCKET_PATH" \
        "http://localhost/containers/${CONTAINER_ID}/stats?stream=false" \
        2>/dev/null > "${STATS_TMPDIR}/${CONTAINER_ID}.json" || true
    ) &
  done
  wait

  for CONTAINER_ID in $CONTAINER_IDS; do
    STATS_FILE="${STATS_TMPDIR}/${CONTAINER_ID}.json"
    [ -f "$STATS_FILE" ] && [ -s "$STATS_FILE" ] || continue

    CPU_USAGE=$(jq -r '.cpu_stats.cpu_usage.total_usage // empty' "$STATS_FILE")
    PREV_CPU=$(jq -r '.precpu_stats.cpu_usage.total_usage // empty' "$STATS_FILE")
    SYSTEM_USAGE=$(jq -r '.cpu_stats.system_cpu_usage // empty' "$STATS_FILE")
    PREV_SYSTEM=$(jq -r '.precpu_stats.system_cpu_usage // empty' "$STATS_FILE")
    ONLINE_CPUS=$(jq -r '.cpu_stats.online_cpus // empty' "$STATS_FILE")

    if [ -n "$ONLINE_CPUS" ] && [ "$HOST_CORES" = "0" ]; then
      HOST_CORES=$ONLINE_CPUS
    fi

    if [ -n "$SYSTEM_USAGE" ] && [ -n "$PREV_SYSTEM" ] && [ "$MEASURED_SYSTEM_NS" = "0" ]; then
      if [ "$SYSTEM_USAGE" -gt "$PREV_SYSTEM" ]; then
        MEASURED_SYSTEM_NS=$((SYSTEM_USAGE - PREV_SYSTEM))
      fi
    fi

    if [ -n "$CPU_USAGE" ] && [ -n "$PREV_CPU" ] && [ "$CPU_USAGE" -gt "$PREV_CPU" ]; then
      CPU_DELTA=$((CPU_USAGE - PREV_CPU))
      TOTAL_CPU_TIME_NS=$((TOTAL_CPU_TIME_NS + CPU_DELTA))
    fi

    MEM_USAGE=$(jq -r '.memory_stats.usage // empty' "$STATS_FILE")
    MEM_LIMIT=$(jq -r '.memory_stats.limit // empty' "$STATS_FILE")

    if [ -n "$MEM_USAGE" ] && [ -n "$MEM_LIMIT" ]; then
      TOTAL_MEM_USED=$((TOTAL_MEM_USED + MEM_USAGE))
      TOTAL_MEM_LIMIT=$((TOTAL_MEM_LIMIT + MEM_LIMIT))
    fi

    NETWORK_RX_BYTES=$(jq -r '[.networks[]?.rx_bytes] | add // 0' "$STATS_FILE")
    NETWORK_TX_BYTES=$(jq -r '[.networks[]?.tx_bytes] | add // 0' "$STATS_FILE")
    DISK_READ_BYTES=$(jq -r '[.blkio_stats.io_service_bytes_recursive[]? | select(.op == "Read") | .value] | add // 0' "$STATS_FILE")
    DISK_WRITE_BYTES=$(jq -r '[.blkio_stats.io_service_bytes_recursive[]? | select(.op == "Write") | .value] | add // 0' "$STATS_FILE")

    TOTAL_NETWORK_IN_BYTES=$((TOTAL_NETWORK_IN_BYTES + NETWORK_RX_BYTES))
    TOTAL_NETWORK_OUT_BYTES=$((TOTAL_NETWORK_OUT_BYTES + NETWORK_TX_BYTES))
    TOTAL_DISK_READ_BYTES=$((TOTAL_DISK_READ_BYTES + DISK_READ_BYTES))
    TOTAL_DISK_WRITE_BYTES=$((TOTAL_DISK_WRITE_BYTES + DISK_WRITE_BYTES))
  done

  rm -rf "$STATS_TMPDIR"


  if [ "$HOST_CORES" = "0" ]; then
    HOST_CORES=1
  fi

  CURRENT_TIMESTAMP="$(date +%s%3N)"
  PREVIOUS_SAMPLE="$(read_cached_metrics || true)"
  PREVIOUS_TIMESTAMP=""
  PREVIOUS_CPU_TIME_NS=0
  PREVIOUS_SYSTEM_TIME_NS=0
  PREVIOUS_NETWORK_IN_BYTES=0
  PREVIOUS_NETWORK_OUT_BYTES=0
  PREVIOUS_DISK_READ_BYTES=0
  PREVIOUS_DISK_WRITE_BYTES=0

  if [ -n "$PREVIOUS_SAMPLE" ]; then
    IFS='|' read -r \
      PREVIOUS_TIMESTAMP \
      PREVIOUS_CPU_TIME_NS \
      PREVIOUS_SYSTEM_TIME_NS \
      PREVIOUS_NETWORK_IN_BYTES \
      PREVIOUS_NETWORK_OUT_BYTES \
      PREVIOUS_DISK_READ_BYTES \
      PREVIOUS_DISK_WRITE_BYTES <<EOF
$PREVIOUS_SAMPLE
EOF
  fi

  ELAPSED_MS=0
  if [ -n "$PREVIOUS_TIMESTAMP" ] && [ "$CURRENT_TIMESTAMP" -gt "$PREVIOUS_TIMESTAMP" ]; then
    ELAPSED_MS=$((CURRENT_TIMESTAMP - PREVIOUS_TIMESTAMP))
  fi

  NETWORK_IN_RATE=null
  NETWORK_OUT_RATE=null
  DISK_READ_RATE=null
  DISK_WRITE_RATE=null

  if [ -n "$PREVIOUS_TIMESTAMP" ] && [ "$ELAPSED_MS" -gt 0 ]; then
    NETWORK_IN_RATE="$(calculate_rate "$TOTAL_NETWORK_IN_BYTES" "$PREVIOUS_NETWORK_IN_BYTES" "$ELAPSED_MS")"
    NETWORK_OUT_RATE="$(calculate_rate "$TOTAL_NETWORK_OUT_BYTES" "$PREVIOUS_NETWORK_OUT_BYTES" "$ELAPSED_MS")"
    DISK_READ_RATE="$(calculate_rate "$TOTAL_DISK_READ_BYTES" "$PREVIOUS_DISK_READ_BYTES" "$ELAPSED_MS")"
    DISK_WRITE_RATE="$(calculate_rate "$TOTAL_DISK_WRITE_BYTES" "$PREVIOUS_DISK_WRITE_BYTES" "$ELAPSED_MS")"
  fi

  if [ "$MEASURED_SYSTEM_NS" = "0" ]; then
    MEASURED_SYSTEM_NS="$PREVIOUS_SYSTEM_TIME_NS"
  fi

  write_cached_metrics \
    "$CURRENT_TIMESTAMP" \
    "$TOTAL_CPU_TIME_NS" \
    "$MEASURED_SYSTEM_NS" \
    "$TOTAL_NETWORK_IN_BYTES" \
    "$TOTAL_NETWORK_OUT_BYTES" \
    "$TOTAL_DISK_READ_BYTES" \
    "$TOTAL_DISK_WRITE_BYTES"

  METRICS_JSON="{\"cpu_time_ns\":${TOTAL_CPU_TIME_NS},\"system_time_ns\":${MEASURED_SYSTEM_NS},\"online_cpus\":${HOST_CORES},\"memory_used\":${TOTAL_MEM_USED},\"memory_limit\":${TOTAL_MEM_LIMIT},\"network_in_bytes_per_sec\":${NETWORK_IN_RATE},\"network_out_bytes_per_sec\":${NETWORK_OUT_RATE},\"disk_read_bytes_per_sec\":${DISK_READ_RATE},\"disk_write_bytes_per_sec\":${DISK_WRITE_RATE}}"
  respond_json '200 OK' "$METRICS_JSON"
  exit 0
fi

DOCKER_PATH="${PATH_RAW#/docker}"
[ -n "$DOCKER_PATH" ] || DOCKER_PATH="/"

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
export AGENT_API_KEY DOCKER_SOCKET WATCHTOWER_AGENT_VERSION WATCHTOWER_AGENT_STATE_DIR

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
WATCHTOWER_AGENT_STATE_DIR=$(quote_env_value "$STATE_DIR_VALUE")
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

INSTALLED_RUNTIME_VERSION="$(extract_runtime_version "${INSTALL_DIR}/watchtower-agent.sh" || true)"
if [ -n "$EXPECTED_VERSION_VALUE" ] && [ "$INSTALLED_RUNTIME_VERSION" != "$EXPECTED_VERSION_VALUE" ]; then
  fail "Installed runtime version ${INSTALLED_RUNTIME_VERSION:-unknown} does not match expected version ${EXPECTED_VERSION_VALUE}"
fi

if [ -n "$PREVIOUS_RUNTIME_VERSION" ] && [ "$PREVIOUS_RUNTIME_VERSION" != "$INSTALLED_RUNTIME_VERSION" ]; then
  log "watchtower-agent upgraded from ${PREVIOUS_RUNTIME_VERSION} to ${INSTALLED_RUNTIME_VERSION}"
else
  log "watchtower-agent installed (${INSTALLED_RUNTIME_VERSION:-unknown})"
fi
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
