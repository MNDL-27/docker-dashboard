# ⚙️ Configuration Guide

Configure Docker Dashboard using environment variables in `docker-compose.yml` or via `.env` file.

## Environment Variables

### Core Settings

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `1714` | No | Port the dashboard listens on |
| `NODE_ENV` | `production` | No | Node.js environment mode |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Yes* | Path to Docker socket |

*Required when `USE_PORTAINER=false`

### Portainer Integration

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `USE_PORTAINER` | `false` | No | Enable Portainer gateway |
| `PORTAINER_URL` | - | Yes** | Portainer API URL (e.g., `https://portainer.example.com:9443`) |
| `PORTAINER_ENDPOINT_ID` | - | Yes** | Portainer endpoint ID (usually `1`) |
| `PORTAINER_API_KEY` | - | Yes** | Portainer API access key |

**Required when `USE_PORTAINER=true`

### qBittorrent Integration

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `QBITTORRENT_URL` | `http://qbittorrent:8080` | No | qBittorrent WebUI URL |
| `QBITTORRENT_USERNAME` | `admin` | No | qBittorrent username |
| `QBITTORRENT_PASSWORD` | `adminadmin` | No | qBittorrent password |

### HTTPS Configuration

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `HTTPS` | `false` | No | Enable HTTPS server |
| `SSL_KEY_PATH` | `/etc/ssl/private/key.pem` | Yes*** | Path to SSL private key |
| `SSL_CERT_PATH` | `/etc/ssl/certs/cert.pem` | Yes*** | Path to SSL certificate |

***Required when `HTTPS=true`

### Debug Options

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DEBUG_UPGRADE` | `false` | No | Log WebSocket upgrade attempts (for debugging Cloudflare Tunnel issues) |

## Configuration Methods

### Method 1: docker-compose.yml (Recommended)

Edit the `environment` section in `docker-compose.yml`:

```yaml
services:
  dashboard:
    build: .
    container_name: docker-dashboard
    ports:
      - "1714:1714"
    environment:
      - PORT=1714
      - NODE_ENV=production
      - USE_PORTAINER=false
      # Add your custom variables here
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped
```

Then restart:

```bash
docker compose up -d --force-recreate
```

### Method 2: .env File

Create a `.env` file in the project root:

```env
# Core Settings
PORT=1714
NODE_ENV=production

# Portainer (optional)
USE_PORTAINER=false
PORTAINER_URL=https://portainer.example.com:9443
PORTAINER_ENDPOINT_ID=1
PORTAINER_API_KEY=your_api_key_here

# qBittorrent (optional)
QBITTORRENT_URL=http://192.168.0.102:8081
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=your_password

# HTTPS (optional)
HTTPS=false
SSL_KEY_PATH=/path/to/key.pem
SSL_CERT_PATH=/path/to/cert.pem
```

Update `docker-compose.yml` to use the `.env` file:

```yaml
services:
  dashboard:
    env_file:
      - .env
    # ... rest of config
```

## Common Configurations

### Standard Setup (Direct Docker Socket)

```yaml
environment:
  - PORT=1714
  - NODE_ENV=production
  - DOCKER_SOCKET=/var/run/docker.sock
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

### Portainer Gateway Setup

```yaml
environment:
  - PORT=1714
  - NODE_ENV=production
  - USE_PORTAINER=true
  - PORTAINER_URL=https://portainer.example.com:9443
  - PORTAINER_ENDPOINT_ID=1
  - PORTAINER_API_KEY=ptr_xxxxxxxxxxxxxxxxxxxxxxxx
```

### qBittorrent Integration Setup

```yaml
environment:
  - PORT=1714
  - NODE_ENV=production
  - QBITTORRENT_URL=http://192.168.0.102:8081
  - QBITTORRENT_USERNAME=admin
  - QBITTORRENT_PASSWORD=mypassword
```

### HTTPS Setup

```yaml
environment:
  - PORT=1714
  - NODE_ENV=production
  - HTTPS=true
  - SSL_KEY_PATH=/certs/key.pem
  - SSL_CERT_PATH=/certs/cert.pem
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
  - ./certs:/certs:ro
```

## Port Configuration

### Change Dashboard Port

To use a different port (e.g., 8080):

```yaml
ports:
  - "8080:1714"  # Host port 8080, container port 1714
environment:
  - PORT=1714    # Keep this as 1714 (internal port)
```

Access via: `http://localhost:8080`

### Multiple Dashboards

Run multiple dashboard instances:

```yaml
# docker-compose-dashboard-1.yml
services:
  dashboard-1:
    build: .
    container_name: docker-dashboard-1
    ports:
      - "1714:1714"
    # ... rest of config

# docker-compose-dashboard-2.yml
services:
  dashboard-2:
    build: .
    container_name: docker-dashboard-2
    ports:
      - "1715:1714"  # Different host port
    # ... rest of config
```

## Advanced Configuration

### Resource Limits

Limit CPU and memory usage:

```yaml
services:
  dashboard:
    # ... other config
    deploy:
      resources:
        limits:
          cpus: '0.5'          # Max 50% of one CPU core
          memory: 256M         # Max 256MB RAM
        reservations:
          cpus: '0.25'         # Reserve 25% of one CPU core
          memory: 128M         # Reserve 128MB RAM
```

### Custom Network

Create a dedicated network:

```yaml
services:
  dashboard:
    # ... other config
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge
    name: monitoring-network
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Health Check Customization

Adjust health check parameters:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:1714"]
  interval: 30s       # Check every 30 seconds
  timeout: 10s        # Timeout after 10 seconds
  retries: 3          # Retry 3 times before marking unhealthy
  start_period: 40s   # Grace period before health checks start
```

## Validation

After making changes, validate your configuration:

```bash
# Check for syntax errors
docker compose config

# View the resolved configuration
docker compose config --quiet

# Test the configuration
docker compose up --dry-run
```

## Configuration Best Practices

1. **Use `.env` files for secrets** - Don't commit passwords to git
2. **Set resource limits** - Prevent the dashboard from consuming excessive resources
3. **Enable health checks** - Ensure automatic restarts on failures
4. **Use read-only socket** - Mount Docker socket as `:ro` for security
5. **Change default passwords** - Always change qBittorrent default credentials
6. **Use environment-specific configs** - Separate dev/staging/prod configurations

## Related Guides

- **[Portainer Integration](Portainer-Integration.md)** - Multi-host Docker management
- **[qBittorrent Integration](qBittorrent-Integration.md)** - VPN container bandwidth tracking
- **[HTTPS Configuration](HTTPS-Configuration.md)** - Secure your dashboard
- **[Production Deployment](Production-Deployment.md)** - Production best practices

## Troubleshooting

### Configuration not applied

```bash
# Force recreate containers
docker compose up -d --force-recreate

# Or rebuild from scratch
docker compose down
docker compose up -d --build
```

### Invalid configuration

```bash
# Validate docker-compose.yml
docker compose config

# Check container logs
docker logs docker-dashboard
```

### Environment variables not loaded

```bash
# Check if .env file exists
ls -la .env

# Verify docker-compose.yml references .env
grep -A 2 "env_file" docker-compose.yml

# Inspect container environment
docker inspect docker-dashboard --format='{{.Config.Env}}'
```

---

**Next**: Configure **[Portainer Integration](Portainer-Integration.md)** or **[qBittorrent Integration](qBittorrent-Integration.md)**
