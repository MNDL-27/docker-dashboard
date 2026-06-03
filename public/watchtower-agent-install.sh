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
  --enrollment-token VAL  Exchange a one-time enrollment token for the real AGENT_API_KEY
  --enroll-url URL        Enrollment exchange endpoint
  --check                 Validate the current or provided configuration without installing
  --expected-version VAL  Fail if the installed runtime version does not match this value
  --port VALUE            Set AGENT_PORT (default: 9876)
  --bind-address VALUE    Set AGENT_BIND_ADDRESS (default: 0.0.0.0)
  --bind VALUE            Alias for --bind-address
  --docker-socket PATH    Set DOCKER_SOCKET (default: /var/run/docker.sock)
  --connection-mode MODE  Set connection mode for user-facing output (agent or cloudflare_tunnel)
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

install_package() {
  local package_name="$1"

  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update >/dev/null 2>&1 || fail "Failed to update apt package metadata while installing ${package_name}"
    apt-get install -y "$package_name" >/dev/null 2>&1 || fail "Failed to install ${package_name} with apt-get"
    return 0
  fi

  if command -v dnf >/dev/null 2>&1; then
    dnf install -y "$package_name" >/dev/null 2>&1 || fail "Failed to install ${package_name} with dnf"
    return 0
  fi

  if command -v yum >/dev/null 2>&1; then
    yum install -y "$package_name" >/dev/null 2>&1 || fail "Failed to install ${package_name} with yum"
    return 0
  fi

  if command -v apk >/dev/null 2>&1; then
    apk add --no-cache "$package_name" >/dev/null 2>&1 || fail "Failed to install ${package_name} with apk"
    return 0
  fi

  if command -v zypper >/dev/null 2>&1; then
    zypper --non-interactive install "$package_name" >/dev/null 2>&1 || fail "Failed to install ${package_name} with zypper"
    return 0
  fi

  fail "${package_name} is required but no supported package manager was found. Install ${package_name} manually and rerun the installer."
}

require_jq() {
  command -v jq >/dev/null 2>&1 || fail "jq is required but not installed. Install jq with your distro package manager, then rerun the installer."
}

ensure_jq() {
  if command -v jq >/dev/null 2>&1; then
    return 0
  fi

  log "Installing jq automatically"
  install_package jq
  require_jq
}

ensure_socat() {
  if command -v socat >/dev/null 2>&1; then
    return 0
  fi

  log "Installing socat automatically"
  install_package socat
  command -v socat >/dev/null 2>&1 || fail "socat is required but not installed"
}

print_preflight_ok() {
  echo "OK: $1"
}

check_config() {
  [ -n "$AGENT_API_KEY" ] || fail "AGENT_API_KEY is required. Set it in /etc/watchtower-agent/watchtower-agent.env or export it before starting."
  validate_port "$AGENT_PORT"
  [ -n "$AGENT_BIND_ADDRESS" ] || fail "AGENT_BIND_ADDRESS must not be empty."
  require_command socat
  require_command curl
  require_command awk
  require_jq
  require_command df
  require_command mkdir
  require_command tr
  require_command sed
  [ -S "$DOCKER_SOCKET" ] || fail "Docker socket not found at $DOCKER_SOCKET. Confirm Docker is running or update DOCKER_SOCKET in /etc/watchtower-agent/watchtower-agent.env."
}

run_preflight_checks() {
  echo "watchtower-agent preflight"
  [ "$(id -u)" -eq 0 ] || fail "Run this installer with sudo or as root"
  print_preflight_ok "running as root"

  validate_port "$AGENT_PORT"
  print_preflight_ok "port ${AGENT_PORT} is valid"

  [ -n "$AGENT_BIND_ADDRESS" ] || fail "AGENT_BIND_ADDRESS must not be empty."
  print_preflight_ok "bind address ${AGENT_BIND_ADDRESS} is set"

  [ -n "$AGENT_API_KEY" ] || fail "AGENT_API_KEY is required. Set it in /etc/watchtower-agent/watchtower-agent.env or export it before starting."
  print_preflight_ok "agent API key is present"

  require_command socat
  print_preflight_ok "socat found"

  require_command curl
  print_preflight_ok "curl found"

  require_command awk
  print_preflight_ok "awk found"

  require_jq
  print_preflight_ok "jq found"

  require_command df
  print_preflight_ok "df found"

  require_command mkdir
  print_preflight_ok "mkdir found"

  require_command tr
  print_preflight_ok "tr found"

  require_command sed
  print_preflight_ok "sed found"

  [ -d /run/systemd/system ] || fail "systemd is required on this host. For non-systemd environments, run watchtower-agent.sh under another supervisor or containerize it with restart=unless-stopped."
  print_preflight_ok "systemd detected"

  [ -S "$DOCKER_SOCKET" ] || fail "Docker socket not found at $DOCKER_SOCKET. Confirm Docker is running or update DOCKER_SOCKET in /etc/watchtower-agent/watchtower-agent.env."
  print_preflight_ok "Docker socket found at $DOCKER_SOCKET"

  local_socket_group="$(stat -c '%G' "$DOCKER_SOCKET")"
  if [ "$local_socket_group" = "UNKNOWN" ] || [ -z "$local_socket_group" ] || [ "$local_socket_group" = "root" ]; then
    fail "The Docker socket group for $DOCKER_SOCKET must be a non-root group before installing the agent. Grant the socket to a group such as docker, or rerun with --docker-socket PATH."
  fi
  print_preflight_ok "Docker socket group ${local_socket_group} is usable"

  if [ -n "$EXPECTED_VERSION_VALUE" ]; then
    if [ "$WATCHTOWER_AGENT_VERSION" = "$EXPECTED_VERSION_VALUE" ]; then
      print_preflight_ok "installer version ${WATCHTOWER_AGENT_VERSION} matches expected ${EXPECTED_VERSION_VALUE}"
    else
      fail "Expected installer version ${EXPECTED_VERSION_VALUE}, but this script reports ${WATCHTOWER_AGENT_VERSION}"
    fi
  else
    print_preflight_ok "installer version ${WATCHTOWER_AGENT_VERSION}"
  fi

  print_preflight_ok "all checks passed"
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

exchange_enrollment_token() {
  [ -n "$ENROLLMENT_TOKEN_VALUE" ] || fail "--enrollment-token requires a value"
  [ -n "$ENROLL_URL_VALUE" ] || fail "--enroll-url is required when using --enrollment-token"
  require_jq

  local response
  response="$(curl -fsSL -X POST "$ENROLL_URL_VALUE" \
    -H 'Content-Type: application/json' \
    -d "{\"enrollment_token\":\"$ENROLLMENT_TOKEN_VALUE\"}")" || fail "Enrollment token exchange failed. Re-generate the install command in Dockerdash and try again."

  AGENT_API_KEY_VALUE="$(printf '%s' "$response" | jq -r '.agent_api_key // empty')"
  AGENT_PORT_VALUE="$(printf '%s' "$response" | jq -r '.port // empty')"
  AGENT_BIND_ADDRESS_VALUE="$(printf '%s' "$response" | jq -r '.bind_address // empty')"
  DOCKER_SOCKET_VALUE="$(printf '%s' "$response" | jq -r '.docker_socket_path // empty')"
  CONNECTION_MODE_VALUE="$(printf '%s' "$response" | jq -r '.connection_mode // empty')"

  [ -n "$AGENT_API_KEY_VALUE" ] || fail "Enrollment exchange succeeded, but no AGENT_API_KEY was returned."
  [ -n "$AGENT_PORT_VALUE" ] || AGENT_PORT_VALUE="$DEFAULT_PORT"
  [ -n "$AGENT_BIND_ADDRESS_VALUE" ] || AGENT_BIND_ADDRESS_VALUE="$DEFAULT_BIND_ADDRESS"
  [ -n "$DOCKER_SOCKET_VALUE" ] || DOCKER_SOCKET_VALUE="$DEFAULT_DOCKER_SOCKET"
}

DEFAULT_PORT="9876"
DEFAULT_BIND_ADDRESS="0.0.0.0"
DEFAULT_DOCKER_SOCKET="/var/run/docker.sock"
FLAG_YES="false"
FLAG_CHECK="false"
CLI_API_KEY=""
CLI_ENROLLMENT_TOKEN=""
CLI_ENROLL_URL=""
CLI_EXPECTED_VERSION=""
CLI_PORT=""
CLI_BIND_ADDRESS=""
CLI_DOCKER_SOCKET=""
CLI_CONNECTION_MODE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --api-key)
      [ $# -ge 2 ] || fail "--api-key requires a value"
      CLI_API_KEY="$2"
      shift 2
      ;;
    --enrollment-token)
      [ $# -ge 2 ] || fail "--enrollment-token requires a value"
      CLI_ENROLLMENT_TOKEN="$2"
      shift 2
      ;;
    --enroll-url)
      [ $# -ge 2 ] || fail "--enroll-url requires a value"
      CLI_ENROLL_URL="$2"
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
    --connection-mode)
      [ $# -ge 2 ] || fail "--connection-mode requires a value"
      CLI_CONNECTION_MODE="$2"
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

for cmd in bash install systemctl getent useradd groupadd stat curl sed awk tr; do
  require_command "$cmd"
done

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
ENROLLMENT_TOKEN_VALUE="${CLI_ENROLLMENT_TOKEN:-}"
ENROLL_URL_VALUE="${CLI_ENROLL_URL:-}"
CONNECTION_MODE_VALUE="${CLI_CONNECTION_MODE:-agent}"

if [ "$FLAG_CHECK" != "true" ]; then
  ensure_jq
  ensure_socat
fi

if [ -n "$ENROLLMENT_TOKEN_VALUE" ]; then
  log "Checking enrollment token"
  exchange_enrollment_token
fi

AGENT_API_KEY="${AGENT_API_KEY_VALUE:-}"
AGENT_PORT="${AGENT_PORT_VALUE:-$DEFAULT_PORT}"
AGENT_BIND_ADDRESS="${AGENT_BIND_ADDRESS_VALUE:-$DEFAULT_BIND_ADDRESS}"
DOCKER_SOCKET="${DOCKER_SOCKET_VALUE:-$DEFAULT_DOCKER_SOCKET}"

validate_port "$AGENT_PORT_VALUE"
validate_bind_address "$AGENT_BIND_ADDRESS_VALUE"
[ -S "$DOCKER_SOCKET_VALUE" ] || fail "Docker socket not found at $DOCKER_SOCKET_VALUE. Ensure Docker is running or rerun with --docker-socket PATH."
SOCKET_GROUP="$(stat -c '%G' "$DOCKER_SOCKET_VALUE")"
[ "$SOCKET_GROUP" != "UNKNOWN" ] && [ -n "$SOCKET_GROUP" ] && [ "$SOCKET_GROUP" != "root" ] || fail "The Docker socket group for $DOCKER_SOCKET_VALUE must be a non-root group such as docker."

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

if [ "$FLAG_CHECK" = "true" ]; then
  run_preflight_checks
  exit 0
fi

log "Checking host"
check_config

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

log "Installing agent runtime"
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
  require_command df
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
WATCHTOWER_AGENT_VERSION="${WATCHTOWER_AGENT_VERSION:-1.0.9}"

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

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

validate_docker_path() {
  local path="$1"

  [ -n "$path" ] || return 1

  case "$path" in
    /*) ;;
    *) return 1 ;;
  esac

  # Split path and query string so `&` and `=` can be used as query separators
  # without enabling shell-metacharacter injection in the path portion. The
  # entire URL is later passed to curl as a quoted argument, so neither
  # portion is eval'd by the shell.
  local route="${path%%\?*}"
  local query=""
  case "$path" in
    *\?*) query="${path#*\?}" ;;
  esac

  case "$route" in
    *$'\r'*|*$'\n'*|*' '*|*'\t'*|*'\\'*|*'"'*|*"'"*|*'`'*|*';'*|*'|'*|*'&'*|*'<'*|*'>'*|*'('*|*')'*|*'{'*|*'}'*|*'['*|*']'*)
      return 1
      ;;
  esac

  case "$route" in
    *'..'*)
      return 1
      ;;
  esac

  if [ -n "$query" ]; then
    case "$query" in
      *$'\r'*|*$'\n'*|*' '*|*'\t'*|*'\\'*|*'"'*|*"'"*|*'`'*|*';'*|*'|'*|*'<'*|*'>'*|*'('*|*')'*|*'{'*|*'}'*|*'['*|*']'*)
        return 1
        ;;
    esac

    case "$query" in
      *'..'*)
        return 1
        ;;
    esac
  fi

  return 0
}

cleanup_handler() {
  rm -f "${REQUEST_BODY_FILE:-}" "${RESPONSE_BODY_FILE:-}" "${RESPONSE_HEADERS_FILE:-}" "${CURL_ERROR_FILE:-}" "${FORWARD_HEADERS_FILE:-}"
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
    cached_disk_write_bytes \
    cached_disk_snapshots <"$cache_file" || return 1

  case "$cached_timestamp" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_cpu_time_ns" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_system_time_ns" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_network_in_bytes" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_network_out_bytes" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_disk_read_bytes" in ''|*[!0-9]*) return 1 ;; esac
  case "$cached_disk_write_bytes" in ''|*[!0-9]*) return 1 ;; esac

  printf '%s|%s|%s|%s|%s|%s|%s|%s' \
    "$cached_timestamp" \
    "$cached_cpu_time_ns" \
    "$cached_system_time_ns" \
    "$cached_network_in_bytes" \
    "$cached_network_out_bytes" \
    "$cached_disk_read_bytes" \
    "$cached_disk_write_bytes" \
    "${cached_disk_snapshots:-}"
}

write_cached_metrics() {
  local cache_file tmp_file
  cache_file="$(metrics_cache_file)"
  ensure_state_dir
  tmp_file="$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-metrics-cache.XXXXXX")"

  printf '%s|%s|%s|%s|%s|%s|%s|%s\n' \
    "$1" \
    "$2" \
    "$3" \
    "$4" \
    "$5" \
    "$6" \
    "$7" \
    "${8:-}" >"$tmp_file"

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

lookup_cached_disk_totals() {
  local snapshot="$1"
  local device="$2"

  [ -n "$snapshot" ] || return 1
  [ -n "$device" ] || return 1

  printf '%s' "$snapshot" | awk -F';' -v device="$device" '{
    for (i = 1; i <= NF; i++) {
      split($i, parts, ":")
      if (parts[1] == device) {
        printf "%s|%s", parts[2], parts[3]
        exit
      }
    }
  }'
}

derive_parent_disk_device() {
  local device="$1"

  if [[ "$device" =~ ^((sd|vd|xvd)[a-z]+)[0-9]+$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi

  if [[ "$device" =~ ^(nvme[0-9]+n[0-9]+|mmcblk[0-9]+)p[0-9]+$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi

  return 1
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
CONTENT_TYPE=""
IS_UPGRADE="false"
FORWARD_HEADERS_FILE="$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-forward-headers.XXXXXX")"

while IFS= read -r header_line; do
  header_line_stripped="$(printf '%s' "$header_line" | tr -d '\r')"
  [ -z "$header_line_stripped" ] && break

  header_name="$(printf '%s' "$header_line_stripped" | cut -d: -f1 | tr '[:upper:]' '[:lower:]')"
  header_value="$(printf '%s' "${header_line_stripped#*:}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  case "$header_name" in
    x-agent-key)
      AGENT_KEY="$header_value"
      ;;
    x-docker-socket)
      DOCKER_SOCK_OVERRIDE="$header_value"
      ;;
    content-length)
      CONTENT_LENGTH="$header_value"
      printf '%s\r\n' "$header_line_stripped" >> "$FORWARD_HEADERS_FILE"
      ;;
    content-type)
      CONTENT_TYPE="$header_value"
      printf '%s\r\n' "$header_line_stripped" >> "$FORWARD_HEADERS_FILE"
      ;;
    upgrade)
      IS_UPGRADE="true"
      printf '%s\r\n' "$header_line_stripped" >> "$FORWARD_HEADERS_FILE"
      ;;
    connection)
      case "$header_value" in
        *[Uu][Pp][Gg][Rr][Aa][Dd][Ee]*)
          IS_UPGRADE="true"
          ;;
      esac
      printf '%s\r\n' "$header_line_stripped" >> "$FORWARD_HEADERS_FILE"
      ;;
    *)
      printf '%s\r\n' "$header_line_stripped" >> "$FORWARD_HEADERS_FILE"
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
# Returns: { cpu_time_ns: <ns>, system_time_ns: <ns>, online_cpus: <num>, memory_used: <bytes>, memory_limit: <bytes> }
# cpu_time_ns = container CPU usage delta
# system_time_ns = system CPU time delta (aggregate across cores)
# Backend computes: cpu % = Σ (cpu_time_ns / system_time_ns * online_cpus) × 100
# This matches Docker's standard formula: (cpuDelta / systemDelta) * onlineCPUs * 100
if [ "$PATH_RAW" = "/metrics" ]; then
  [ -S "$SOCKET_PATH" ] || {
    ESCAPED_SOCKET_PATH="$(json_escape "$SOCKET_PATH")"
    respond_json '500 Internal Server Error' "{\"error\":\"Docker socket not found at ${ESCAPED_SOCKET_PATH}\",\"code\":\"docker_socket_unavailable\",\"socket_path\":\"${ESCAPED_SOCKET_PATH}\"}"
    exit 0
  }

  HOST_CORES=$(nproc 2>/dev/null || echo 1)
  UPTIME_SECONDS=null
  if [ -f /proc/uptime ]; then
    UPTIME_SECONDS="$(awk '{printf "%d", $1}' /proc/uptime 2>/dev/null || true)"
    if [ -z "$UPTIME_SECONDS" ]; then
      UPTIME_SECONDS=null
    fi
  fi

    TOTAL_CPU_TICKS=0
    ACTIVE_CPU_TICKS=0
    if [ -f /proc/stat ]; then
      read -r cpu user nice system idle iowait irq softirq steal _ < /proc/stat
      user=${user:-0}; nice=${nice:-0}; system=${system:-0}; idle=${idle:-0}; iowait=${iowait:-0}; irq=${irq:-0}; softirq=${softirq:-0}; steal=${steal:-0}
      TOTAL_CPU_TICKS=$((user + nice + system + idle + iowait + irq + softirq + steal))
      IDLE_ALL_TICKS=$((idle + iowait))
      ACTIVE_CPU_TICKS=$((TOTAL_CPU_TICKS - IDLE_ALL_TICKS))
    fi

    MemTotal=0; MemFree=0; Buffers=0; Cached=0; SReclaimable=0; Shmem=0
    if [ -f /proc/meminfo ]; then
      meminfo=$(cat /proc/meminfo)
      get_mem() { echo "$meminfo" | awk -v key="^$1:" '$0 ~ key {print $2; exit}' || echo 0; }
      MemTotal=$(get_mem MemTotal)
      MemFree=$(get_mem MemFree)
      Buffers=$(get_mem Buffers)
      Cached=$(get_mem Cached)
      SReclaimable=$(get_mem SReclaimable)
      Shmem=$(get_mem Shmem)
    fi

    TOTAL_MEM_LIMIT=$((MemTotal * 1024))
    USED_KB=$((MemTotal - MemFree - Buffers - (Cached + SReclaimable - Shmem)))
    if [ "$USED_KB" -lt 0 ]; then USED_KB=0; fi
    TOTAL_MEM_USED=$((USED_KB * 1024))

    TOTAL_NETWORK_IN_BYTES=0
    TOTAL_NETWORK_OUT_BYTES=0
    if [ -f /proc/net/dev ]; then
      read -r TOTAL_NETWORK_IN_BYTES TOTAL_NETWORK_OUT_BYTES <<< "$(awk '
        $1 ~ /:/ { 
          sub(/:/, "", $1); 
          if ($1 !~ /^(lo|veth|docker|br-)/) { 
            rx+=$2; tx+=$10 
          } 
        } END {print rx+0, tx+0}' /proc/net/dev)"
    fi

    TOTAL_DISK_READ_BYTES=0
    TOTAL_DISK_WRITE_BYTES=0
    CURRENT_DISK_SNAPSHOT=""
    if [ -f /proc/diskstats ]; then
      read -r DISK_SECTORS_READ DISK_SECTORS_WRITE <<< "$(awk '
        $3 ~ /^(sd[a-z]+|vd[a-z]+|xvd[a-z]+|nvme[0-9]+n[0-9]+|mmcblk[0-9]+)$/ { 
          r+=$6; w+=$10 
        } END {print r+0, w+0}' /proc/diskstats)"
      CURRENT_DISK_SNAPSHOT="$(awk '
        $3 ~ /^(sd[a-z]+([0-9]+)?|vd[a-z]+([0-9]+)?|xvd[a-z]+([0-9]+)?|nvme[0-9]+n[0-9]+(p[0-9]+)?|mmcblk[0-9]+(p[0-9]+)?)$/ {
          printf "%s%s:%d:%d", sep, $3, $6 * 512, $10 * 512
          sep=";"
        }' /proc/diskstats)"
      TOTAL_DISK_READ_BYTES=$((DISK_SECTORS_READ * 512))
      TOTAL_DISK_WRITE_BYTES=$((DISK_SECTORS_WRITE * 512))
    fi

    CURRENT_TIMESTAMP="$(date +%s%3N)"
    PREVIOUS_SAMPLE="$(read_cached_metrics || true)"
    PREVIOUS_TIMESTAMP=""
    PREVIOUS_ACTIVE=0
    PREVIOUS_TOTAL=0
    PREVIOUS_NETWORK_IN_BYTES=0
    PREVIOUS_NETWORK_OUT_BYTES=0
    PREVIOUS_DISK_READ_BYTES=0
    PREVIOUS_DISK_WRITE_BYTES=0
    PREVIOUS_DISK_SNAPSHOT=""

    if [ -n "$PREVIOUS_SAMPLE" ]; then
      IFS='|' read -r \
        PREVIOUS_TIMESTAMP \
        PREVIOUS_ACTIVE \
        PREVIOUS_TOTAL \
        PREVIOUS_NETWORK_IN_BYTES \
        PREVIOUS_NETWORK_OUT_BYTES \
        PREVIOUS_DISK_READ_BYTES \
        PREVIOUS_DISK_WRITE_BYTES \
        PREVIOUS_DISK_SNAPSHOT <<EOF
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
    DELTA_ACTIVE=0
    DELTA_TOTAL=0
    DISK_ROWS=""

    if [ -n "$PREVIOUS_TIMESTAMP" ] && [ "$ELAPSED_MS" -gt 0 ]; then
      NETWORK_IN_RATE="$(calculate_rate "$TOTAL_NETWORK_IN_BYTES" "$PREVIOUS_NETWORK_IN_BYTES" "$ELAPSED_MS")"
      NETWORK_OUT_RATE="$(calculate_rate "$TOTAL_NETWORK_OUT_BYTES" "$PREVIOUS_NETWORK_OUT_BYTES" "$ELAPSED_MS")"
      DISK_READ_RATE="$(calculate_rate "$TOTAL_DISK_READ_BYTES" "$PREVIOUS_DISK_READ_BYTES" "$ELAPSED_MS")"
      DISK_WRITE_RATE="$(calculate_rate "$TOTAL_DISK_WRITE_BYTES" "$PREVIOUS_DISK_WRITE_BYTES" "$ELAPSED_MS")"
      
      DELTA_ACTIVE=$((ACTIVE_CPU_TICKS - PREVIOUS_ACTIVE))
      DELTA_TOTAL=$((TOTAL_CPU_TICKS - PREVIOUS_TOTAL))
      if [ "$DELTA_ACTIVE" -lt 0 ]; then DELTA_ACTIVE=0; fi
      if [ "$DELTA_TOTAL" -lt 0 ]; then DELTA_TOTAL=0; fi
    fi

    while IFS=$'\t' read -r DISK_SOURCE DISK_USED_BYTES DISK_TOTAL_BYTES DISK_MOUNT; do
      [ -n "$DISK_SOURCE" ] || continue

      DISK_DEVICE_NAME="${DISK_SOURCE#/dev/}"
      RATE_DEVICE="$DISK_DEVICE_NAME"
      DISK_READ_DEVICE_RATE=null
      DISK_WRITE_DEVICE_RATE=null

      if ! lookup_cached_disk_totals "$CURRENT_DISK_SNAPSHOT" "$RATE_DEVICE" >/dev/null 2>&1; then
        PARENT_DEVICE="$(derive_parent_disk_device "$DISK_DEVICE_NAME" || true)"
        if [ -n "$PARENT_DEVICE" ] && lookup_cached_disk_totals "$CURRENT_DISK_SNAPSHOT" "$PARENT_DEVICE" >/dev/null 2>&1; then
          RATE_DEVICE="$PARENT_DEVICE"
        else
          RATE_DEVICE=""
        fi
      fi

      if [ -n "$RATE_DEVICE" ] && [ "$ELAPSED_MS" -gt 0 ]; then
        CURRENT_DEVICE_TOTALS="$(lookup_cached_disk_totals "$CURRENT_DISK_SNAPSHOT" "$RATE_DEVICE" || true)"
        PREVIOUS_DEVICE_TOTALS="$(lookup_cached_disk_totals "$PREVIOUS_DISK_SNAPSHOT" "$RATE_DEVICE" || true)"

        if [ -n "$CURRENT_DEVICE_TOTALS" ] && [ -n "$PREVIOUS_DEVICE_TOTALS" ]; then
          IFS='|' read -r CURRENT_DEVICE_READ_BYTES CURRENT_DEVICE_WRITE_BYTES <<EOF
$CURRENT_DEVICE_TOTALS
EOF
          IFS='|' read -r PREVIOUS_DEVICE_READ_BYTES PREVIOUS_DEVICE_WRITE_BYTES <<EOF
$PREVIOUS_DEVICE_TOTALS
EOF
          DISK_READ_DEVICE_RATE="$(calculate_rate "$CURRENT_DEVICE_READ_BYTES" "$PREVIOUS_DEVICE_READ_BYTES" "$ELAPSED_MS")"
          DISK_WRITE_DEVICE_RATE="$(calculate_rate "$CURRENT_DEVICE_WRITE_BYTES" "$PREVIOUS_DEVICE_WRITE_BYTES" "$ELAPSED_MS")"
        fi
      fi

      DISK_ROWS+="${DISK_SOURCE}"$'\t'"${DISK_MOUNT}"$'\t'"${DISK_USED_BYTES}"$'\t'"${DISK_TOTAL_BYTES}"$'\t'"${DISK_READ_DEVICE_RATE}"$'\t'"${DISK_WRITE_DEVICE_RATE}"$'\n'
    done < <(df -P -B1 2>/dev/null | awk 'NR > 1 && $1 ~ "^/dev/" && $2 ~ /^[0-9]+$/ && $3 ~ /^[0-9]+$/ {print $1 "\t" $3 "\t" $2 "\t" $6}')

    if [ -n "$DISK_ROWS" ]; then
      DISKS_JSON="$(printf '%s' "$DISK_ROWS" | jq -Rsc '
        split("\n")
        | map(select(length > 0) | split("\t"))
        | map({
            device: .[0],
            mount: .[1],
            used_bytes: (.[2] | tonumber),
            total_bytes: (.[3] | tonumber),
            read_bytes_per_sec: (if .[4] == "null" or .[4] == "" then null else (.[4] | tonumber) end),
            write_bytes_per_sec: (if .[5] == "null" or .[5] == "" then null else (.[5] | tonumber) end)
          })
      ')"
    else
      DISKS_JSON='[]'
    fi

    write_cached_metrics \
      "$CURRENT_TIMESTAMP" \
      "$ACTIVE_CPU_TICKS" \
      "$TOTAL_CPU_TICKS" \
      "$TOTAL_NETWORK_IN_BYTES" \
      "$TOTAL_NETWORK_OUT_BYTES" \
      "$TOTAL_DISK_READ_BYTES" \
      "$TOTAL_DISK_WRITE_BYTES" \
      "$CURRENT_DISK_SNAPSHOT"

    METRICS_JSON="$(jq -n \
      --argjson cpu_time_ns "$DELTA_ACTIVE" \
      --argjson system_time_ns "$DELTA_TOTAL" \
      --argjson online_cpus "$HOST_CORES" \
      --argjson memory_used "$TOTAL_MEM_USED" \
      --argjson memory_limit "$TOTAL_MEM_LIMIT" \
      --argjson network_in_bytes_per_sec "$NETWORK_IN_RATE" \
      --argjson network_out_bytes_per_sec "$NETWORK_OUT_RATE" \
      --argjson network_rx_total "$TOTAL_NETWORK_IN_BYTES" \
      --argjson network_tx_total "$TOTAL_NETWORK_OUT_BYTES" \
      --argjson disk_read_bytes_per_sec "$DISK_READ_RATE" \
      --argjson disk_write_bytes_per_sec "$DISK_WRITE_RATE" \
      --argjson uptime_seconds "$UPTIME_SECONDS" \
      --argjson disks "$DISKS_JSON" \
      '{
        cpu_time_ns: $cpu_time_ns,
        system_time_ns: $system_time_ns,
        online_cpus: $online_cpus,
        memory_used: $memory_used,
        memory_limit: $memory_limit,
        network_in_bytes_per_sec: $network_in_bytes_per_sec,
        network_out_bytes_per_sec: $network_out_bytes_per_sec,
        network_rx_total: $network_rx_total,
        network_tx_total: $network_tx_total,
        disk_read_bytes_per_sec: $disk_read_bytes_per_sec,
        disk_write_bytes_per_sec: $disk_write_bytes_per_sec,
        uptime_seconds: $uptime_seconds,
        disks: $disks
      }')"
    respond_json '200 OK' "$METRICS_JSON"
    exit 0
  fi

DOCKER_PATH="${PATH_RAW#/docker}"
[ -n "$DOCKER_PATH" ] || DOCKER_PATH="/"

if ! validate_docker_path "$DOCKER_PATH"; then
  respond_json '400 Bad Request' '{"error":"Invalid Docker API path"}'
  exit 0
fi

[ -S "$SOCKET_PATH" ] || {
  ESCAPED_SOCKET_PATH="$(json_escape "$SOCKET_PATH")"
  respond_json '500 Internal Server Error' "{\"error\":\"Docker socket not found at ${ESCAPED_SOCKET_PATH}\",\"code\":\"docker_socket_unavailable\",\"socket_path\":\"${ESCAPED_SOCKET_PATH}\"}"
  exit 0
}

if [ "$IS_UPGRADE" = "true" ]; then
  {
    printf '%s %s HTTP/1.1\r\n' "$METHOD" "$DOCKER_PATH"
    if [ -f "$FORWARD_HEADERS_FILE" ]; then
      cat "$FORWARD_HEADERS_FILE"
    fi
    printf '\r\n'
    cat
  } | socat -t 3600 - "UNIX-CONNECT:$SOCKET_PATH"
  exit 0
fi

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
  if [ -n "$CONTENT_TYPE" ]; then
    CURL_ARGS+=(--header "Content-Type: $CONTENT_TYPE")
  fi
fi

if ! curl "${CURL_ARGS[@]}" 2>"$CURL_ERROR_FILE"; then
  ERROR_MESSAGE="$(tr -d '\r' <"$CURL_ERROR_FILE" | sed 's/"/\\"/g')"
  ESCAPED_SOCKET_PATH="$(json_escape "$SOCKET_PATH")"
  respond_json '502 Bad Gateway' "{\"error\":\"Docker API request failed\",\"code\":\"docker_socket_unavailable\",\"details\":\"${ERROR_MESSAGE}\",\"socket_path\":\"${ESCAPED_SOCKET_PATH}\"}"
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

log "Installing update helper"
UPDATE_BIN="/usr/local/bin/watchtower-agent-update"
cat > "${INSTALL_DIR}/watchtower-agent-update.sh" <<'UPDATE_HELPER_EOF'
#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="/opt/watchtower-agent"
UPDATE_URL="https://app.dockerdash.app/watchtower-agent-update.sh"
TMP_FILE="$(mktemp "${TMPDIR:-/tmp}/watchtower-agent-update.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT INT TERM
curl -fsSL "$UPDATE_URL" -o "$TMP_FILE" || { echo "ERROR: Failed to download updater from ${UPDATE_URL}" >&2; exit 1; }
chmod +x "$TMP_FILE"
exec "$TMP_FILE" "$@"
UPDATE_HELPER_EOF
chmod 0755 "${INSTALL_DIR}/watchtower-agent-update.sh"
install -m 0755 "${INSTALL_DIR}/watchtower-agent-update.sh" "$UPDATE_BIN"

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
log "Starting service"
systemctl restart "${SERVICE_NAME}.service" 2>/dev/null || systemctl start "${SERVICE_NAME}.service"
if ! systemctl --quiet is-active "${SERVICE_NAME}.service"; then
  fail "watchtower-agent.service did not start cleanly. Inspect: sudo systemctl status ${SERVICE_NAME} && sudo journalctl -u ${SERVICE_NAME} -n 50"
fi

log "Verifying local health"
if ! "${INSTALL_DIR}/watchtower-agent.sh" --check; then
  fail "Local agent verification failed after install. Inspect: sudo journalctl -u ${SERVICE_NAME} -n 50"
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
  sudo watchtower-agent-update
  sudo ${UNINSTALL_BIN}
  sudo ${UNINSTALL_BIN} --purge

Notes:
  - The agent listens on ${AGENT_BIND_ADDRESS_VALUE}:${AGENT_PORT_VALUE}.
  - Direct mode should stay behind HTTPS via a reverse proxy.
  - Cloudflare Tunnel mode should target http://${AGENT_BIND_ADDRESS_VALUE}:${AGENT_PORT_VALUE}.
  - Connection mode for this install: ${CONNECTION_MODE_VALUE}

Next in Dockerdash:
  - Run the local verify command shown in the setup flow.
  - Return to Dockerdash and click Finish setup.
EOF
