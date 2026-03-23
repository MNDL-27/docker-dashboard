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

# Handle /metrics endpoint for fleet dashboard
if [ "$PATH_RAW" = "/metrics" ]; then
  # Get all containers and aggregate their CPU/memory
  CONTAINERS_JSON=$(curl --silent --unix-socket "$SOCKET_PATH" "http://localhost/containers/json" 2>/dev/null)
  
  if [ -z "$CONTAINERS_JSON" ] || [ "$CONTAINERS_JSON" = "[]" ]; then
    respond_json '200 OK' '{"cpu":0,"memory":0}'
    exit 0
  fi
  
  # Parse container IDs
  CONTAINER_IDS=$(echo "$CONTAINERS_JSON" | grep -oE '"Id":"[a-f0-9]+"' | head -20 | cut -d'"' -f4)
  
  TOTAL_CPU=0
  TOTAL_MEM=0
  CONTAINER_COUNT=0
  
  for CONTAINER_ID in $CONTAINER_IDS; do
    # Get stats for each container (stream=false for single shot)
    STATS_JSON=$(curl --silent --unix-socket "$SOCKET_PATH" "http://localhost/containers/${CONTAINER_ID}/stats?stream=false" 2>/dev/null)
    
    if [ -n "$STATS_JSON" ]; then
      # Calculate CPU percentage from stats
      # CPU delta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage  
      # System delta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage
      CPU_DELTA=$(echo "$STATS_JSON" | grep -oE '"cpu_usage":{"total_usage":[0-9]+' | head -1 | cut -d':' -f2)
      SYSTEM_DELTA=$(echo "$STATS_JSON" | grep -oE '"system_cpu_usage":[0-9]+' | head -1 | cut -d':' -f2)
      
      # Get memory usage
      MEM_USAGE=$(echo "$STATS_JSON" | grep -oE '"usage":[0-9]+' | head -1 | cut -d':' -f2)
      MEM_LIMIT=$(echo "$STATS_JSON" | grep -oE '"limit":[0-9]+' | head -1 | cut -d':' -f2)
      
      if [ -n "$CPU_DELTA" ] && [ -n "$SYSTEM_DELTA" ] && [ "$SYSTEM_DELTA" -gt 0 ]; then
        CPU_PERCENT=$(echo "scale=2; ($CPU_DELTA / $SYSTEM_DELTA) * 100" | bc 2>/dev/null || echo 0)
        TOTAL_CPU=$(echo "$TOTAL_CPU + $CPU_PERCENT" | bc 2>/dev/null || echo "$TOTAL_CPU")
      fi
      
      if [ -n "$MEM_USAGE" ] && [ -n "$MEM_LIMIT" ] && [ "$MEM_LIMIT" -gt 0 ]; then
        MEM_PERCENT=$(echo "scale=2; ($MEM_USAGE / $MEM_LIMIT) * 100" | bc 2>/dev/null || echo 0)
        TOTAL_MEM=$(echo "$TOTAL_MEM + $MEM_PERCENT" | bc 2>/dev/null || echo "$TOTAL_MEM")
        CONTAINER_COUNT=$((CONTAINER_COUNT + 1))
      fi
    fi
  done
  
  # If no valid stats, return 0
  if [ -z "$TOTAL_CPU" ] || [ "$TOTAL_CPU" = "0" ]; then
    TOTAL_CPU=0
  fi
  if [ -z "$TOTAL_MEM" ] || [ "$TOTAL_MEM" = "0" ]; then
    TOTAL_MEM=0
  fi
  
  TOTAL_CPU_INT=$(printf "%.0f" "$TOTAL_CPU" 2>/dev/null || echo 0)
  TOTAL_MEM_INT=$(printf "%.0f" "$TOTAL_MEM" 2>/dev/null || echo 0)
  
  METRICS_JSON="{\"cpu\":${TOTAL_CPU_INT},\"memory\":${TOTAL_MEM_INT}}"
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

echo "Starting watchtower-agent on ${AGENT_BIND_ADDRESS}:${AGENT_PORT}"
echo "Docker socket: ${DOCKER_SOCKET}"

exec socat "TCP-LISTEN:${AGENT_PORT},bind=${AGENT_BIND_ADDRESS},reuseaddr,fork" "EXEC:${HANDLER_SCRIPT}"
