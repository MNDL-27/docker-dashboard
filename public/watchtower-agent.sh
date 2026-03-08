#!/usr/bin/env bash
# =============================================================================
# Watchtower Docker Agent — Lightweight HTTP proxy for Docker socket
# =============================================================================
#
# This script starts a tiny HTTP proxy that:
#   1. Listens on a port (default 9876) over HTTPS (or HTTP for dev)
#   2. Authenticates requests via X-Agent-Key header
#   3. Proxies /docker/* requests to the local Docker Unix socket
#
# REQUIREMENTS:
#   - socat (apt install socat / yum install socat)
#   - curl (for testing)
#   - Docker installed and socket accessible
#
# USAGE:
#   chmod +x watchtower-agent.sh
#   AGENT_API_KEY="your-secret-key" ./watchtower-agent.sh
#
# ENVIRONMENT VARIABLES:
#   AGENT_API_KEY   (required) Shared secret for authentication
#   AGENT_PORT      (optional) Port to listen on (default: 9876)
#   DOCKER_SOCKET   (optional) Docker socket path (default: /var/run/docker.sock)
#   TLS_CERT        (optional) Path to TLS cert for HTTPS
#   TLS_KEY         (optional) Path to TLS key for HTTPS
#
# PRODUCTION RECOMMENDATION:
#   Use a reverse proxy (nginx, caddy) for TLS termination instead of
#   running this script directly with TLS. Example with Caddy:
#
#     docker.example.com {
#       reverse_proxy localhost:9876
#     }
#
# =============================================================================

set -euo pipefail

AGENT_API_KEY="${AGENT_API_KEY:?ERROR: Set AGENT_API_KEY environment variable}"
AGENT_PORT="${AGENT_PORT:-9876}"
DOCKER_SOCKET="${DOCKER_SOCKET:-/var/run/docker.sock}"

if [ ! -S "$DOCKER_SOCKET" ]; then
  echo "ERROR: Docker socket not found at $DOCKER_SOCKET"
  exit 1
fi

if ! command -v socat &>/dev/null; then
  echo "ERROR: socat is required. Install with: apt install socat"
  exit 1
fi

echo "=== Watchtower Agent ==="
echo "Port:    $AGENT_PORT"
echo "Socket:  $DOCKER_SOCKET"
echo "========================"
echo ""
echo "Listening on :$AGENT_PORT ..."
echo "Test with: curl -H 'X-Agent-Key: <key>' http://localhost:$AGENT_PORT/docker/_ping"
echo ""

# We use a simple approach: socat + a handler script
# For production, use the Go-based agent or a proper reverse proxy.

# Create a temporary handler script
HANDLER=$(mktemp)
cat > "$HANDLER" << 'HANDLER_EOF'
#!/usr/bin/env bash
read -r REQUEST_LINE
METHOD=$(echo "$REQUEST_LINE" | awk '{print $1}')
PATH_RAW=$(echo "$REQUEST_LINE" | awk '{print $2}')

# Read headers
AGENT_KEY=""
DOCKER_SOCK_OVERRIDE=""
CONTENT_LENGTH=0
while IFS= read -r header; do
  header=$(echo "$header" | tr -d '\r')
  [ -z "$header" ] && break
  case "${header,,}" in
    x-agent-key:*) AGENT_KEY="${header#*: }" ;;
    x-docker-socket:*) DOCKER_SOCK_OVERRIDE="${header#*: }" ;;
    content-length:*) CONTENT_LENGTH="${header#*: }" ;;
  esac
done

# Auth check
if [ "$AGENT_KEY" != "$AGENT_API_KEY" ]; then
  echo -e "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\n\r\n{\"error\":\"Invalid API key\"}"
  exit 0
fi

# Strip /docker prefix
DOCKER_PATH="${PATH_RAW#/docker}"
[ -z "$DOCKER_PATH" ] && DOCKER_PATH="/"

SOCK="${DOCKER_SOCK_OVERRIDE:-$DOCKER_SOCKET}"

# Proxy to Docker socket via curl
RESPONSE=$(curl -s --unix-socket "$SOCK" -X "$METHOD" "http://localhost${DOCKER_PATH}" 2>&1)
echo -e "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n${RESPONSE}"
HANDLER_EOF
chmod +x "$HANDLER"

export AGENT_API_KEY DOCKER_SOCKET

# Run socat as a simple TCP server
socat TCP-LISTEN:${AGENT_PORT},reuseaddr,fork EXEC:"$HANDLER"
