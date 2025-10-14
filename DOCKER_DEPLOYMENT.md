# 🐳 Docker Deployment Guide

## Quick Start with Docker Compose

### 1. Build and Start
```bash
docker-compose up -d
```

### 2. View Logs
```bash
docker-compose logs -f dashboard
```

### 3. Stop
```bash
docker-compose down
```

## Manual Docker Commands

### Build Image
```bash
docker build -t docker-dashboard .
```

### Run Container
```bash
docker run -d \
  --name docker-dashboard \
  -p 1714:1714 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --restart unless-stopped \
  docker-dashboard
```

## Access Dashboard
Open your browser and navigate to:
```
http://localhost:1714
```

## Environment Variables

Configure via `.env` file or docker-compose environment section:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `1714` | Server port |
| `NODE_ENV` | `production` | Node environment |
| `USE_PORTAINER` | `false` | Enable Portainer integration |
| `PORTAINER_URL` | - | Portainer API URL |
| `PORTAINER_ENDPOINT_ID` | - | Portainer endpoint ID |
| `PORTAINER_API_KEY` | - | Portainer API key |

## Health Check

The container includes a health check that runs every 30 seconds:
```bash
docker ps  # Check HEALTHY status
```

## Troubleshooting

### Container won't start
```bash
docker logs docker-dashboard
```

### Can't connect to Docker socket
Ensure the Docker socket is accessible:
```bash
# Linux/Mac
ls -l /var/run/docker.sock

# Windows (Docker Desktop)
# Make sure "Expose daemon on tcp://localhost:2375 without TLS" is enabled
```

### Permission issues (Linux)
```bash
# Add user to docker group
sudo usermod -aG docker $USER
```

## Production Deployment

### Using Docker Compose (Recommended)
1. Copy `docker-compose.yml` to your server
2. Create `.env` file with your settings
3. Run: `docker-compose up -d`

### Using Docker Swarm
```bash
docker stack deploy -c docker-compose.yml docker-dashboard
```

### Using Kubernetes
Generate Kubernetes manifests:
```bash
kompose convert -f docker-compose.yml
kubectl apply -f .
```

## Network Configuration

The dashboard creates a bridge network called `docker-dashboard-network`. To connect other containers:

```yaml
services:
  your-app:
    networks:
      - docker-dashboard-network

networks:
  docker-dashboard-network:
    external: true
```

## Security Considerations

1. **Docker Socket Access**: The dashboard needs read-only access to `/var/run/docker.sock`. This is required to monitor containers but gives significant privileges.

2. **Reverse Proxy**: For production, use a reverse proxy (nginx, Traefik, Caddy) with HTTPS:
   ```yaml
   labels:
     - "traefik.enable=true"
     - "traefik.http.routers.dashboard.rule=Host(`dashboard.yourdomain.com`)"
     - "traefik.http.routers.dashboard.tls=true"
   ```

3. **Authentication**: Consider adding authentication layer via reverse proxy or custom middleware.

## Updates

### Pull Latest Image
```bash
docker-compose pull
docker-compose up -d
```

### Rebuild from Source
```bash
docker-compose build --no-cache
docker-compose up -d
```

## Resource Limits

Add resource constraints in docker-compose.yml:
```yaml
services:
  dashboard:
    # ... other config
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
```

## Backup

The dashboard is stateless, but to backup your configuration:
```bash
docker-compose config > backup-compose.yml
cp .env backup.env
```
