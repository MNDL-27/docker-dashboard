# 🐳 Installation Guide

## Docker-Only Installation (Recommended)

This project is **fully containerized** and designed to run exclusively via Docker.  
**No local Node.js, npm, or dependencies are required!**

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Linux OS (Ubuntu 20.04+, Debian 11+, CentOS 8+, etc.)

### Installation Steps

#### 1. Install Docker (if not already installed)

```bash
# Update package index
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional, to avoid sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

#### 2. Deploy Docker Dashboard

```bash
# Clone repository
git clone https://github.com/MNDL-27/docker-dashboard.git
cd docker-dashboard

# Deploy with Docker Compose
docker compose up -d

# Check status
docker ps | grep docker-dashboard

# View logs
docker logs -f docker-dashboard
```

#### 3. Access Dashboard

Open your browser:
- **Local:** http://localhost:1714
- **Remote:** http://your-server-ip:1714

### Quick Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Restart
docker compose restart

# View logs
docker logs -f docker-dashboard

# Update to latest version
git pull
docker compose down
docker compose up -d --build

# Remove everything
docker compose down -v
```

### Using Helper Script

```bash
chmod +x start.sh
./start.sh
```

The interactive menu provides:
1. Start containers
2. Stop containers  
3. View logs
4. Restart containers
5. Rebuild images
6. Cleanup
7. Exit

---

## ❌ Local Development (Not Recommended)

If you really need to run without Docker for development:

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm install

# Start server
npm start
```

**Note:** This defeats the purpose of containerization and is not recommended for production or regular use.

---

## 🔒 Security Notes

- Docker socket is mounted as **read-only** (`:ro`)
- Container runs with minimal privileges
- Health checks ensure container stability
- Auto-restart policy for high availability

## 🆘 Troubleshooting

### Container won't start
```bash
docker logs docker-dashboard
```

### Port already in use
Edit `docker-compose.yml` and change `1714:1714` to another port like `8080:1714`

### Permission denied on docker.sock
```bash
sudo chmod 666 /var/run/docker.sock
# OR
sudo usermod -aG docker $USER
newgrp docker
```

### Cannot connect to Docker daemon
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

---

## 📚 Additional Resources

- [Docker Installation Guide](https://docs.docker.com/engine/install/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) - Advanced deployment options
