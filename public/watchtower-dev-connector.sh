#!/usr/bin/env bash
# =============================================================================
# ⚠️  DEV-ONLY CONNECTOR — NOT FOR PRODUCTION USE
# =============================================================================
#
# This is a lightweight socat-based shim for LOCAL DEVELOPMENT AND TESTING ONLY.
# It mimics the Watchtower Agent HTTP interface so you can test the dashboard
# against a local Docker socket without building/running the real agent.
#
# ┌─────────────────────────────────────────────────────────────────┐
# │  DO NOT USE IN PRODUCTION.                                      │
# │  This script has NO request sanitization, NO TLS, NO audit log. │
# │  A hardened Go-based production agent is planned.               │
# └─────────────────────────────────────────────────────────────────┘
#
# It:
#   1. Listens on a port (default 9876) over plain HTTP
#   2. Authenticates requests via X-Agent-Key header
#   3. Proxies /docker/* requests to the local Docker Unix socket
#
# REQUIREMENTS:
#   - socat (apt install socat / yum install socat)
#   - curl
#   - Docker installed and socket accessible
#
# USAGE:
#   chmod +x watchtower-dev-connector.sh
#   AGENT_API_KEY="your-secret-key" ./watchtower-dev-connector.sh
#
# ENVIRONMENT VARIABLES:
#   AGENT_API_KEY   (required) Shared secret for authentication
#   AGENT_PORT      (optional) Port to listen on (default: 9876)
#   DOCKER_SOCKET   (optional) Docker socket path (default: /var/run/docker.sock)
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
