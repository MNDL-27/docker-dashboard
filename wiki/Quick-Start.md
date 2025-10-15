# 🚀 Quick Start Guide

Get Docker Dashboard running in less than 5 minutes!

## Prerequisites

Before you begin, ensure you have:

- ✅ **Docker** (version 20.10 or higher)
- ✅ **Docker Compose** (version 2.0 or higher)
- ✅ **Linux OS** (Ubuntu 20.04+, Debian 11+, CentOS 8+)
- ✅ Access to `/var/run/docker.sock`

> **Note**: This dashboard is optimized for Linux. Windows and macOS support is limited.

## Quick Deploy

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/MNDL-27/docker-dashboard.git
cd docker-dashboard

# Start the dashboard
docker compose up -d

# Check status
docker ps | grep docker-dashboard
```

**Access the dashboard**: Open [http://localhost:1714](http://localhost:1714) in your browser

### Option 2: Helper Script

```bash
# Clone the repository
git clone https://github.com/MNDL-27/docker-dashboard.git
cd docker-dashboard

# Make script executable and run
chmod +x start.sh
./start.sh
```

The interactive menu provides options for:
1. Start containers
2. Stop containers
3. View logs
4. Restart containers
5. Rebuild images
6. Cleanup

### Option 3: Docker CLI

```bash
# Build the image
docker build -t docker-dashboard https://github.com/MNDL-27/docker-dashboard.git

# Run the container
docker run -d \
  --name docker-dashboard \
  -p 1714:1714 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --restart unless-stopped \
  docker-dashboard
```

## Verify Installation

### Check Container Status

```bash
# View container logs
docker logs -f docker-dashboard

# Check health status
docker inspect docker-dashboard --format='{{.State.Health.Status}}'
```

Expected output: `healthy`

### Access the Dashboard

1. Open your browser to [http://localhost:1714](http://localhost:1714)
2. You should see your Docker containers listed
3. Click on any container to view detailed stats

## What's Next?

Now that your dashboard is running:

- 📖 Read the **[Dashboard Overview](Dashboard-Overview.md)** to understand the interface
- ⚙️ Review **[Configuration](Configuration.md)** to customize settings
- 🔧 Set up **[qBittorrent Integration](qBittorrent-Integration.md)** for VPN-bound containers
- 🌐 Configure **[Portainer Integration](Portainer-Integration.md)** for multi-host support
- 🔒 Set up **[HTTPS](HTTPS-Configuration.md)** for secure access

## Common Commands

```bash
# Start dashboard
docker compose up -d

# Stop dashboard
docker compose down

# View logs (follow mode)
docker logs -f docker-dashboard

# Restart dashboard
docker compose restart

# Update to latest version
git pull
docker compose up -d --build

# Remove everything (including volumes)
docker compose down -v
```

## Troubleshooting

If you encounter issues:

1. **Container won't start**
   ```bash
   docker logs docker-dashboard
   ```

2. **Port already in use**
   - Edit `docker-compose.yml` and change `1714:1714` to `8080:1714`

3. **Permission denied on docker.sock**
   ```bash
   sudo chmod 666 /var/run/docker.sock
   # OR
   sudo usermod -aG docker $USER
   newgrp docker
   ```

4. **Cannot connect to Docker daemon**
   ```bash
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

For more help, see the **[Troubleshooting Guide](Troubleshooting.md)**.

## Remote Access

To access the dashboard from another machine:

```bash
# Replace localhost with your server IP
http://your-server-ip:1714
```

> ⚠️ **Security Warning**: For production use, always put the dashboard behind a reverse proxy with authentication (Nginx, Traefik, Authelia).

## Next Steps

- **[Configuration Guide](Configuration.md)** - Customize your dashboard
- **[Production Deployment](Production-Deployment.md)** - Best practices for production
- **[Reverse Proxy Setup](Reverse-Proxy.md)** - Secure your dashboard

---

**Need help?** Check the [FAQ](FAQ.md) or [open an issue](https://github.com/MNDL-27/docker-dashboard/issues).
