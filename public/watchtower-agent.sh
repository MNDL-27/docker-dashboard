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
