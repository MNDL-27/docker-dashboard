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
