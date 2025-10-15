<div align="center"><div align="center"><div align="center">



  <h1>🚢 Docker Dashboard</h1>  <h1>🚢 Docker Dashboard</h1>  <h1>🚢 Docker Dashboard</h1>



  <p>A fully containerized web app to monitor, manage, and view live stats/logs for all your Docker containers.<br>  <p>A fully containerized web app to monitor, manage, and view live stats/logs for all your Docker containers.<br>  <p>A fully containerized web app to monitor, manage, and view live stats/logs for all your Docker containers.<br>

  <b>100% Docker-based | No local dependencies | Linux optimized</b></p>

  <b>100% Docker-based | No local dependencies | Linux optimized</b></p>  <b>100% Docker-based | No local dependencies | Linux optimized</b></p>

  <p>

    <img src="https://img.shields.io/badge/docker-required-2496ED?style=flat-square&logo=docker" alt="Docker">  <p>  <p>

    <img src="https://img.shields.io/badge/platform-linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux">

    <img src="https://img.shields.io/github/license/MNDL-27/docker-dashboard?style=flat-square" alt="License">    <img src="https://img.shields.io/badge/docker-required-2496ED?style=flat-square&logo=docker" alt="Docker">    <img src="https://img.shields.io/badge/docker-required-2496ED?style=flat-square&logo=docker" alt="Docker">

    <img src="https://img.shields.io/github/last-commit/MNDL-27/docker-dashboard?style=flat-square" alt="Last Commit">

  </p>    <img src="https://img.shields.io/badge/platform-linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux">    <img src="https://img.shields.io/badge/platform-linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux">



</div>    <img src="https://img.shields.io/github/license/MNDL-27/docker-dashboard?style=flat-square" alt="License">    <img src="https://img.shields.io/github/license/MNDL-27/docker-dashboard?style=flat-square" alt="License">



---    <img src="https://img.shields.io/github/last-commit/MNDL-27/docker-dashboard?style=flat-square" alt="Last Commit">    <img src="https://img.shields.io/github/last-commit/MNDL-27/docker-dashboard?style=flat-square" alt="Last Commit">



## ✨ Features  </p>  </p>



* **Live Monitoring:** Real-time CPU, RAM, Network, and Disk usage with interactive charts</div></div>

* **Bandwidth Tracking:** Monitor total data downloaded/uploaded by each container

* **qBittorrent Integration:** Accurate bandwidth tracking for VPN-bound qBittorrent containers

* **Time Range Controls:** View bandwidth stats for Last 24h, Week, Month, or All Time

* **Log Streaming:** View live container logs with WebSocket streaming------

* **Container Management:** Start, stop, and restart containers with one click

* **Modern UI:** Ultra-modern glass-morphism design with animated gradients

* **Portainer Integration:** Use Portainer as a gateway for multi-host support

* **Fully Containerized:** No Node.js, npm, or any local dependencies required## ✨ Features## ✨ Features

* **Linux Optimized:** Designed and tested for Linux servers



---

* **Live Monitoring:** Real-time CPU, RAM, Network, and Disk usage with interactive charts* **Live Monitoring:** Real-time CPU, RAM, Network, and Disk usage with interactive charts

## 🚀 Quick Start

* **Bandwidth Tracking:** Monitor total data downloaded/uploaded by each container* **Bandwidth Tracking:** Monitor total data downloaded/uploaded by each container

```bash

# Clone the repository* **qBittorrent Integration:** Accurate bandwidth tracking for VPN-bound qBittorrent containers* **qBittorrent Integration:** Accurate bandwidth tracking for VPN-bound qBittorrent containers

git clone https://github.com/MNDL-27/docker-dashboard.git

cd docker-dashboard* **Log Streaming:** View live container logs with WebSocket streaming* **Time Range Controls:** View bandwidth stats for Last 24h, Week, Month, or All Time



# Start with Docker Compose* **Container Management:** Start, stop, and restart containers with one click* **Log Streaming:** View live container logs with WebSocket streaming

docker compose up -d

* **Modern UI:** Ultra-modern glass-morphism design with animated gradients* **Container Management:** Start, stop, and restart containers with one click

# Or use the helper script

chmod +x start.sh* **Portainer Integration:** Use Portainer as a gateway for multi-host support* **Modern UI:** Ultra-modern glass-morphism design with animated gradients

./start.sh

```* **Fully Containerized:** No Node.js, npm, or any local dependencies required* **Portainer Integration:** Use Portainer as a gateway for multi-host support



**Access Dashboard:** Open [http://localhost:1714](http://localhost:1714)* **Linux Optimized:** Designed and tested for Linux servers* **Fully Containerized:** No Node.js, npm, or any local dependencies required



> **⚠️ Prerequisites:** Docker and Docker Compose must be installed on your Linux system.  * **Linux Optimized:** Designed and tested for Linux servers

> No other dependencies required!

---

---

---

## 📚 Documentation

## 🚀 Quick Start

### 📖 **[Visit the Wiki →](wiki/Home.md)**

## 🚀 Quick Start (Docker Only)

Our comprehensive wiki includes:

```bash

- **[Quick Start Guide](wiki/Quick-Start.md)** - Get running in 5 minutes

- **[Configuration](wiki/Configuration.md)** - Environment variables and settings# Clone the repository```bash

- **[API Reference](wiki/API-Reference.md)** - REST and WebSocket endpoints

- **[Troubleshooting](wiki/Troubleshooting.md)** - Common issues and solutionsgit clone https://github.com/MNDL-27/docker-dashboard.git# Clone the repository

- **[Summary](wiki/Summary.md)** - Complete wiki overview

cd docker-dashboardgit clone https://github.com/MNDL-27/docker-dashboard.git

---

cd docker-dashboard

## ⚙️ Configuration

# Start with Docker Compose

Configure via environment variables in `docker-compose.yml`:

docker compose up -d# Start with Docker Compose

```yaml

environment:```docker compose up -d

  - PORT=1714                    # Dashboard port

  - NODE_ENV=production          # Production mode

  - USE_PORTAINER=false          # Use Portainer gateway

  - PORTAINER_URL=               # Portainer instance URL**Access Dashboard:** Open [http://localhost:1714](http://localhost:1714)# Or use the helper script

  - PORTAINER_ENDPOINT_ID=1      # Portainer endpoint ID

  - PORTAINER_API_KEY=           # Portainer API keychmod +x start.sh

  # qBittorrent integration (optional)

  - QBITTORRENT_URL=http://192.168.0.102:8081  # qBittorrent WebUI URL> **⚠️ Prerequisites:** Docker and Docker Compose must be installed on your Linux system../start.sh

  - QBITTORRENT_USERNAME=admin                  # qBittorrent username

  - QBITTORRENT_PASSWORD=adminadmin             # qBittorrent password```

```

**📖 Detailed guide:** See **[Quick Start Wiki](wiki/Quick-Start.md)**

**📖 Full configuration guide:** See **[Configuration Wiki](wiki/Configuration.md)**

**Access Dashboard:** Open [http://localhost:1714](http://localhost:1714)

---

---

## 🛠 Management Commands

> **⚠️ Prerequisites:** Docker and Docker Compose must be installed on your Linux system.  

```bash

# Start dashboard## 📚 Documentation> No other dependencies required!

docker compose up -d



# Stop dashboard

docker compose down### 📖 **[Visit the Wiki →](wiki/Home.md)**---



# View logs

docker logs -f docker-dashboard

Our comprehensive wiki includes:## 🐳 Deployment

# Restart dashboard

docker compose restart



# Update to latest version- **[Quick Start Guide](wiki/Quick-Start.md)** - Get running in 5 minutes### Method 1: Docker Compose (Recommended)

git pull && docker compose up -d --build

- **[Configuration](wiki/Configuration.md)** - Environment variables and settings

# Check health status

docker inspect docker-dashboard --format='{{.State.Health.Status}}'- **[API Reference](wiki/API-Reference.md)** - REST and WebSocket endpoints```bash

```

- **[qBittorrent Integration](wiki/qBittorrent-Integration.md)** - VPN-bound container bandwidthdocker compose up -d

---

- **[Portainer Integration](wiki/Portainer-Integration.md)** - Multi-host management```

## 🛡️ Security Features

- **[Troubleshooting](wiki/Troubleshooting.md)** - Common issues and solutions

✅ **Read-only Docker socket** - Container cannot modify Docker  

✅ **Minimal privileges** - Runs as non-root when possible  - **[Production Deployment](wiki/Production-Deployment.md)** - Best practices### Method 2: Docker CLI

✅ **Health checks** - Automatic health monitoring every 30s  

✅ **Auto-restart** - Container restarts on failure  

✅ **Network isolation** - Custom bridge network  

---```bash

> **⚠️ Important:** Add authentication (Nginx, Traefik, Authelia) before exposing publicly!

docker build -t docker-dashboard .

---

## 🐳 Quick Deploy Optionsdocker run -d \

## 🔗 Quick Links

  --name docker-dashboard \

- **[📖 Full Documentation (Wiki)](wiki/Home.md)** - Complete guides and references

- **[🚀 Quick Start](wiki/Quick-Start.md)** - Get started in 5 minutes### Docker Compose (Recommended)  -p 1714:1714 \

- **[⚙️ Configuration](wiki/Configuration.md)** - Customize your setup

- **[🔧 Troubleshooting](wiki/Troubleshooting.md)** - Solve common issues  -v /var/run/docker.sock:/var/run/docker.sock:ro \

- **[📡 API Reference](wiki/API-Reference.md)** - Developer documentation

- **[🐛 Report Issues](https://github.com/MNDL-27/docker-dashboard/issues)** - Bug reports```bash  --restart unless-stopped \

- **[💬 Discussions](https://github.com/MNDL-27/docker-dashboard/discussions)** - Community support

docker compose up -d  docker-dashboard

---

``````

## 🙌 Contributing



Contributions are welcome! Please feel free to submit issues and pull requests.

### Docker CLI### Method 3: Helper Script

---



## 📄 License

```bash```bash

This project is licensed under the AGPL-3.0 License. See [LICENSE](LICENSE) for details.

docker run -d \chmod +x start.sh

---

  --name docker-dashboard \./start.sh

<div align="center">

  <p>Made with ❤️ for the Docker community</p>  -p 1714:1714 \```

  <p>

    <a href="https://github.com/MNDL-27/docker-dashboard">⭐ Star this repo</a> •  -v /var/run/docker.sock:/var/run/docker.sock:ro \

    <a href="https://github.com/MNDL-27/docker-dashboard/issues">🐛 Report Bug</a> •

    <a href="https://github.com/MNDL-27/docker-dashboard/issues">💡 Request Feature</a>  --restart unless-stopped \**📖 Advanced configuration:** See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)

  </p>

</div>  ghcr.io/mndl-27/docker-dashboard:latest


```---



### Helper Script## ⚙️ Configuration



```bashConfigure via environment variables in `docker-compose.yml`:

chmod +x start.sh

./start.sh```yaml

```environment:

  - PORT=1714                    # Dashboard port

---  - NODE_ENV=production          # Production mode

  - USE_PORTAINER=false          # Use Portainer gateway

## ⚙️ Basic Configuration  - PORTAINER_URL=               # Portainer instance URL

  - PORTAINER_ENDPOINT_ID=1      # Portainer endpoint ID

Configure via environment variables in `docker-compose.yml`:  - PORTAINER_API_KEY=           # Portainer API key

  # qBittorrent integration (optional)

```yaml  - QBITTORRENT_URL=http://192.168.0.102:8081  # qBittorrent WebUI URL

environment:  - QBITTORRENT_USERNAME=admin                  # qBittorrent username

  - PORT=1714                    # Dashboard port  - QBITTORRENT_PASSWORD=adminadmin             # qBittorrent password

  - NODE_ENV=production          # Production mode```

  - USE_PORTAINER=false          # Use Portainer gateway

  # Optional: qBittorrent integration### 🌐 qBittorrent Integration Setup

  - QBITTORRENT_URL=http://192.168.0.102:8081

  - QBITTORRENT_USERNAME=adminIf your qBittorrent container uses a VPN (like WireGuard) and shows 0 B bandwidth in Docker stats, you can enable direct API integration:

  - QBITTORRENT_PASSWORD=your_password

```1. **Create a `.env` file** in the project root:

   ```env

**📖 Full configuration guide:** See **[Configuration Wiki](wiki/Configuration.md)**   QBITTORRENT_URL=http://192.168.0.102:8081

   QBITTORRENT_USERNAME=your_username

---   QBITTORRENT_PASSWORD=your_password

   ```

## 🛠 Management Commands

2. **Configure qBittorrent WebUI Security:**

```bash   - Open qBittorrent WebUI → Settings (⚙️) → Web UI

# Start dashboard   - Find **"Bypass authentication for clients in whitelisted IP subnets"**

docker compose up -d   - Add your Docker network subnet (e.g., `192.168.16.0/24` or `192.168.0.0/16`)

   - **Disable** "Enable Host header validation" (or add your dashboard IP to allowed hosts)

# Stop dashboard   - Click **Save**

docker compose down

3. **Find your Docker network subnet:**

# View logs   ```bash

docker logs -f docker-dashboard   docker inspect docker-dashboard -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

   # Example output: 192.168.16.2

# Restart dashboard   # Subnet: 192.168.16.0/24

docker compose restart   ```



# Update to latest version4. **Restart the dashboard:**

git pull && docker compose up -d --build   ```bash

```   docker compose restart

   ```

---

5. **Verify the integration:**

## 🛡️ Security   ```bash

   # Test API connection

✅ Read-only Docker socket     docker exec docker-dashboard wget -qO- http://192.168.0.102:8081/api/v2/app/version

✅ Minimal privileges     

✅ Health checks & auto-restart     # Check logs for any errors

✅ Network isolation     docker logs docker-dashboard --tail 20

   ```

> **⚠️ Important:** Add authentication (Nginx, Traefik, Authelia) before exposing publicly!

**✅ Features:**

**📖 Security guide:** See **[Production Deployment Wiki](wiki/Production-Deployment.md)**- Automatic detection when viewing qBittorrent containers

- Real-time bandwidth stats (updates every 2 seconds)

---- Total downloaded/uploaded data from qBittorrent's session

- Bypasses Docker network stats limitations for VPN-bound containers

## 🔗 Quick Links

**📖 Detailed guide:** See [QBITTORRENT_INTEGRATION.md](QBITTORRENT_INTEGRATION.md)

- **[📖 Full Documentation (Wiki)](wiki/Home.md)** - Complete guides and references

- **[🚀 Quick Start](wiki/Quick-Start.md)** - Get started in 5 minutes**📖 Full configuration guide:** See [INSTALL.md](INSTALL.md)

- **[⚙️ Configuration](wiki/Configuration.md)** - Customize your setup

- **[🔧 Troubleshooting](wiki/Troubleshooting.md)** - Solve common issues---

- **[📡 API Reference](wiki/API-Reference.md)** - Developer documentation

- **[🐛 Report Issues](https://github.com/MNDL-27/docker-dashboard/issues)** - Bug reports## � Management Commands

- **[💬 Discussions](https://github.com/MNDL-27/docker-dashboard/discussions)** - Community support

```bash

---# Start dashboard

docker compose up -d

## 🙌 Contributing

# Stop dashboard

Contributions are welcome! Please see our **[Contributing Guide](wiki/Contributing.md)** for details.docker compose down



---# View logs

docker logs -f docker-dashboard

## 📄 License

# Restart dashboard

This project is licensed under the AGPL-3.0 License. See [LICENSE](LICENSE) for details.docker compose restart



---# Update to latest version

git pull && docker compose up -d --build

<div align="center">

  <p>Made with ❤️ for the Docker community</p># Check health status

  <p>docker inspect docker-dashboard --format='{{.State.Health.Status}}'

    <a href="https://github.com/MNDL-27/docker-dashboard">⭐ Star this repo</a> •```

    <a href="https://github.com/MNDL-27/docker-dashboard/issues">🐛 Report Bug</a> •

    <a href="https://github.com/MNDL-27/docker-dashboard/issues">💡 Request Feature</a>---

  </p>

</div>## 🛡️ Security Features


✅ **Read-only Docker socket** - Container cannot modify Docker  
✅ **Minimal privileges** - Runs as non-root when possible  
✅ **Health checks** - Automatic health monitoring every 30s  
✅ **Auto-restart** - Container restarts on failure  
✅ **Network isolation** - Custom bridge network  

> **⚠️ Important:** Add authentication (Nginx, Traefik, Authelia) before exposing publicly!

---

## 🔗 Portainer Gateway

Use Portainer to manage multiple Docker hosts with RBAC:

1. Set up Portainer and create an API key
2. Edit `docker-compose.yml`:
   ```yaml
   environment:
     - USE_PORTAINER=true
     - PORTAINER_URL=https://portainer.example.com:9443
     - PORTAINER_ENDPOINT_ID=1
     - PORTAINER_API_KEY=your_api_key_here
   ```
3. Restart: `docker compose up -d --force-recreate`

---

## 📚 Documentation

- [INSTALL.md](INSTALL.md) - Detailed installation guide
- [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) - Advanced deployment options
- [QBITTORRENT_INTEGRATION.md](QBITTORRENT_INTEGRATION.md) - qBittorrent API integration guide
- [start.sh](start.sh) - Interactive helper script

---

## 🙌 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

## 📄 License

This project is licensed under the AGPL-3.0 License. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Made with ❤️ for the Docker community</p>
  <p>
    <a href="https://github.com/MNDL-27/docker-dashboard">⭐ Star this repo</a> •
    <a href="https://github.com/MNDL-27/docker-dashboard/issues">🐛 Report Bug</a> •
    <a href="https://github.com/MNDL-27/docker-dashboard/issues">💡 Request Feature</a>
  </p>
</div>
