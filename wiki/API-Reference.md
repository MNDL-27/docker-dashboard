# 📡 API Reference

Docker Dashboard provides REST and WebSocket APIs for container monitoring and management.

## Base URL

```
http://localhost:1714
```

## REST API Endpoints

### Container Operations

#### List All Containers

```http
GET /api/containers
```

Returns a list of all Docker containers (running and stopped).

**Response:**
```json
[
  {
    "Id": "abc123...",
    "Names": ["/my-container"],
    "Image": "nginx:latest",
    "State": "running",
    "Status": "Up 2 hours",
    "Ports": [
      {
        "PrivatePort": 80,
        "PublicPort": 8080,
        "Type": "tcp"
      }
    ],
    "Created": 1697376000
  }
]
```

#### Get Container Stats

```http
GET /api/containers/:id/stats
```

Returns a single snapshot of container resource usage.

**Parameters:**
- `id` (path) - Container ID (full or short)

**Response:**
```json
{
  "cpu_stats": {
    "cpu_usage": {
      "total_usage": 123456789,
      "usage_in_kernelmode": 10000000,
      "usage_in_usermode": 20000000
    },
    "system_cpu_usage": 987654321,
    "online_cpus": 4
  },
  "memory_stats": {
    "usage": 134217728,
    "limit": 2147483648,
    "stats": {
      "cache": 1048576
    }
  },
  "networks": {
    "eth0": {
      "rx_bytes": 1024000,
      "tx_bytes": 2048000
    }
  },
  "blkio_stats": {
    "io_service_bytes_recursive": []
  }
}
```

**CPU Calculation:**
```javascript
const cpuDelta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage;
const systemDelta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage;
const cpuPercent = (cpuDelta / systemDelta) * cpu_stats.online_cpus * 100;
```

#### Get Container Details

```http
GET /api/containers/:id/json
```

Returns detailed container information including disk usage.

**Parameters:**
- `id` (path) - Container ID

**Response:**
```json
{
  "Id": "abc123...",
  "Name": "/my-container",
  "State": {
    "Status": "running",
    "Running": true,
    "Paused": false,
    "Restarting": false,
    "StartedAt": "2024-10-15T10:00:00Z"
  },
  "Config": {
    "Image": "nginx:latest",
    "Env": ["PATH=/usr/local/bin"],
    "Cmd": ["nginx", "-g", "daemon off;"]
  },
  "NetworkSettings": {
    "IPAddress": "172.17.0.2"
  },
  "SizeRw": 134217728,
  "SizeRootFs": 268435456
}
```

#### Get Historical Metrics

```http
GET /api/containers/:id/history?t=150
```

Returns historical resource usage data for chart rendering.

**Parameters:**
- `id` (path) - Container ID
- `t` (query) - Number of data points to retrieve (default: 300)

**Response:**
```json
[
  {
    "time": 1697376000000,
    "cpu": 25.5,
    "ram": 0.512,
    "ramTotal": 2.0,
    "rx": 1024,
    "tx": 2048,
    "disk": 0.128
  }
]
```

**Storage:**
- In-memory ring buffer per container
- Maximum 300 data points (METRICS_WINDOW)
- Automatically pruned when limit exceeded

### qBittorrent Integration

#### Get Transfer Statistics

```http
GET /api/qbittorrent/transfer
```

Returns bandwidth statistics from qBittorrent WebUI API.

**Response:**
```json
{
  "dlInfoData": 1073741824,
  "upInfoData": 536870912,
  "dlInfoSpeed": 1048576,
  "upInfoSpeed": 524288,
  "connectionStatus": "connected"
}
```

**Fields:**
- `dlInfoData` - Total downloaded bytes
- `upInfoData` - Total uploaded bytes
- `dlInfoSpeed` - Current download speed (bytes/sec)
- `upInfoSpeed` - Current upload speed (bytes/sec)
- `connectionStatus` - Connection status

#### Get Torrents List

```http
GET /api/qbittorrent/torrents
```

Returns list of active torrents.

**Response:**
```json
[
  {
    "hash": "abc123...",
    "name": "ubuntu-22.04.iso",
    "size": 3221225472,
    "progress": 0.75,
    "dlspeed": 1048576,
    "upspeed": 524288,
    "state": "downloading"
  }
]
```

## WebSocket API

### Live Stats Stream

```
ws://localhost:1714/ws/stats?id=<containerId>
```

Streams real-time container statistics.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:1714/ws/stats?id=abc123');

ws.onmessage = (event) => {
  const stats = JSON.parse(event.data);
  console.log('CPU:', stats.cpu_stats);
  console.log('Memory:', stats.memory_stats);
  console.log('Network:', stats.networks);
};
```

**Configure Update Interval:**

Send a message to change the polling interval (1-10 seconds):

```javascript
ws.send(JSON.stringify({
  type: 'interval',
  interval: 2000  // Update every 2 seconds
}));
```

**Default interval:** 1000ms (1 second)  
**Min interval:** 1000ms  
**Max interval:** 10000ms (10 seconds)

### Live Log Stream

```
ws://localhost:1714/ws/logs?id=<containerId>
```

Streams container logs in real-time.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:1714/ws/logs?id=abc123');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.log) {
    console.log(data.log);
  }
  if (data.error) {
    console.error('Error:', data.error);
  }
  if (data.info) {
    console.info(data.info);
  }
};
```

**Log Format:**
```json
{
  "log": "2024-10-15 10:00:00 [INFO] Server started on port 3000"
}
```

**Events:**
- `log` - Log line from container
- `error` - Error message (connection issues, etc.)
- `info` - Informational message (stream ended, etc.)

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message here",
  "details": "Additional context (optional)"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad Request - Invalid parameters |
| `404` | Not Found - Container doesn't exist |
| `500` | Internal Server Error - Docker API failure |

### Error Examples

**Container not found:**
```json
{
  "error": "Container not found"
}
```

**Docker daemon unavailable:**
```json
{
  "error": "Cannot connect to Docker daemon"
}
```

**Invalid container ID:**
```json
{
  "error": "Missing container id"
}
```

## Code Examples

### Fetch Container List

```javascript
async function getContainers() {
  const response = await fetch('http://localhost:1714/api/containers');
  const containers = await response.json();
  return containers;
}
```

### Get Container Stats

```javascript
async function getContainerStats(containerId) {
  const response = await fetch(`http://localhost:1714/api/containers/${containerId}/stats`);
  const stats = await response.json();
  return stats;
}
```

### WebSocket Stats Monitoring

```javascript
function monitorContainer(containerId) {
  const ws = new WebSocket(`ws://localhost:1714/ws/stats?id=${containerId}`);
  
  ws.onopen = () => {
    console.log('Connected to stats stream');
    // Set update interval to 2 seconds
    ws.send(JSON.stringify({ type: 'interval', interval: 2000 }));
  };
  
  ws.onmessage = (event) => {
    const stats = JSON.parse(event.data);
    
    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - 
                        stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
    
    // Get memory usage
    const memUsage = stats.memory_stats.usage;
    const memLimit = stats.memory_stats.limit;
    const memPercent = (memUsage / memLimit) * 100;
    
    console.log(`CPU: ${cpuPercent.toFixed(1)}%`);
    console.log(`Memory: ${memPercent.toFixed(1)}%`);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('Disconnected from stats stream');
  };
  
  return ws;
}
```

### WebSocket Log Monitoring

```javascript
function monitorLogs(containerId) {
  const ws = new WebSocket(`ws://localhost:1714/ws/logs?id=${containerId}`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.log) {
      // Display log line
      console.log(data.log);
    } else if (data.error) {
      console.error('Error:', data.error);
    } else if (data.info) {
      console.info(data.info);
    }
  };
  
  return ws;
}
```

## Rate Limiting

Currently, there is **no rate limiting** implemented. Use WebSocket intervals responsibly:

- Recommended: 2-5 seconds for production
- Development: 1 second is acceptable
- Don't set intervals below 1 second

## CORS

CORS is **not configured** by default. To enable:

1. Add `cors` middleware to `server/index.js`
2. Configure allowed origins
3. Rebuild the container

## Authentication

The API has **no built-in authentication**. For production:

- Use a reverse proxy (Nginx, Traefik, Caddy)
- Add authentication middleware (Basic Auth, OAuth, etc.)
- Implement API keys if needed

See **[Reverse Proxy Setup](Reverse-Proxy.md)** for examples.

## API Versioning

Current API version: **v1** (implicit, no version in URL)

Future versions may be introduced as `/api/v2/...` if breaking changes are needed.

## Related Documentation

- **[Container Management](Container-Management.md)** - Using the web interface
- **[Live Monitoring](Live-Monitoring.md)** - Understanding real-time stats
- **[Architecture](Architecture.md)** - How the API is structured

---

**Need help?** Check the [Troubleshooting Guide](Troubleshooting.md) or [open an issue](https://github.com/MNDL-27/docker-dashboard/issues).
