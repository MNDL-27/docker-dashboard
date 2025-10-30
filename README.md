<div align="center">

# 🚢 Docker Dashboard

![GitHub stars](https://img.shields.io/github/stars/MNDL-27/docker-dashboard?style=flat-square)
![GitHub forks](https://img.shields.io/github/forks/MNDL-27/docker-dashboard?style=flat-square)
![GitHub watchers](https://img.shields.io/github/watchers/MNDL-27/docker-dashboard?style=flat-square)

<a href="https://github.com/MNDL-27/docker-dashboard/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=MNDL-27/docker-dashboard" alt="Contributors" />
</a>

<p>
A fully containerized web app to monitor, manage, and view live stats/logs for all your Docker containers.
<br>
<b>100% Docker-based | No local dependencies | Linux optimized</b>
</p>

<p>
  <img src="https://img.shields.io/badge/docker-required-2496ED?style=flat-square&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/platform-linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux">
  <img src="https://img.shields.io/github/license/MNDL-27/docker-dashboard?style=flat-square" alt="License">
  <img src="https://img.shields.io/github/last-commit/MNDL-27/docker-dashboard?style=flat-square" alt="Last Commit">
</p>

</div>

---

## ✨ Features

* 📊 **Live Monitoring:** Real-time CPU, RAM, Network, and Disk usage with interactive charts
* 📡 **Bandwidth Tracking:** Monitor total data downloaded/uploaded by each container
* 🔗 **qBittorrent Integration:** Accurate bandwidth tracking for VPN-bound qBittorrent containers
* ⏱️ **Time Range Controls:** View bandwidth stats for Last 24h, Week, Month, or All Time
* 📝 **Log Streaming:** View live container logs with WebSocket streaming
* 🎛️ **Container Management:** Start, stop, and restart containers with one click
* 🎨 **Modern UI:** Ultra-modern glass-morphism design with animated gradients
* 🔐 **Authentication:** Optional login system with bcrypt password hashing
* 🐳 **Portainer Integration:** Use Portainer as a gateway for multi-host support
* 📦 **Fully Containerized:** No Node.js, npm, or any local dependencies required
* 🐧 **Linux Optimized:** Designed and tested for Linux servers

---

## 📸 Screenshots

<div align="center">

### Dashboard Overview
![Dashboard Overview](.github/screenshots/dashboard.png)
*Monitor all your containers at a glance with real-time stats*

### Container Details & Live Charts
![Container Details](.github/screenshots/container-details.png)
*Detailed metrics with interactive charts and live updates*

### CPU Usage Breakdown
![CPU Breakdown](.github/screenshots/cpu-breakdown.png)
*See which containers are using the most CPU*

### Data Usage Analytics
![Data Usage](.github/screenshots/data-usage.png)
*Track download and upload for each container*

</div>

---

## 🚀 Quick Start (Docker Only)

```bash
# Clone the repository
git clone https://github.com/MNDL-27/docker-dashboard.git
cd docker-dashboard

# Copy the example compose file
cp docker-compose.example.yml docker-compose.yml

# Edit docker-compose.yml if needed (optional authentication, port changes, etc.)
nano docker-compose.yml

# Build and start
docker compose up -d --build
```

That's it! 🎉 Access the dashboard at [http://localhost:3002](http://localhost:3002)

---

## ⚙️ Configuration

### Authentication (Optional)

By default, authentication is **disabled**. To enable it:

1. Set `AUTH_ENABLED=true` in `docker-compose.yml`
2. Add user credentials:
   ```yaml
   environment:
     - AUTH_ENABLED=true
     - AUTH_USER=admin
     - AUTH_PASSWORD=yourpassword
   ```
3. Restart: `docker compose restart dashboard`

### qBittorrent Integration

For accurate bandwidth tracking of VPN-bound qBittorrent containers:

1. Ensure your qBittorrent WebUI is accessible from the Dashboard container
2. Add these environment variables to `docker-compose.yml`:
   ```yaml
   environment:
     - QBITTORRENT_URL=http://qbittorrent:8080
     - QBITTORRENT_USERNAME=admin
     - QBITTORRENT_PASSWORD=adminpass
   ```
3. Restart: `docker compose restart dashboard`

### Portainer Integration (Optional)

To manage containers across multiple Docker hosts:

1. Ensure you have Portainer running
2. Add these environment variables:
   ```yaml
   environment:
     - PORTAINER_ENABLED=true
     - PORTAINER_URL=http://portainer:9000
     - PORTAINER_API_KEY=your_api_key
   ```
3. Restart: `docker compose restart dashboard`

---

## 🛠️ How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│         Docker Dashboard Container       │
│  ┌─────────────────────────────────┐    │
│  │     Node.js Backend (Express)    │    │
│  │  - WebSocket for live updates    │    │
│  │  - Docker API integration        │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │     Frontend (HTML/CSS/JS)       │    │
│  │  - Chart.js for visualizations   │    │
│  │  - Modern glass-morphism UI      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
         ↓ Docker Socket (Mounted)
┌─────────────────────────────────────────┐
│          Host Docker Daemon              │
│    (monitors all containers)             │
└─────────────────────────────────────────┘
```

### Data Collection

1. **Container Stats**: Fetched via Docker API using `/var/run/docker.sock`
2. **Network Bandwidth**: Calculated from container network interface stats
3. **qBittorrent Stats**: Retrieved from qBittorrent WebUI API (if configured)
4. **Real-time Updates**: Pushed to frontend via WebSocket every second

---

## 📋 Requirements

- 🐳 **Docker** with Compose V2
- 🐧 **Linux host** (Ubuntu, Debian, etc.)
- 💾 **50MB disk space**
- 🔌 **Port 3002** available (or customizable)

> **Note:** This dashboard is designed for Linux servers. Some features may not work correctly on macOS or Windows due to Docker networking differences.

---

## 🔧 Advanced Usage

### Custom Port

Edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3002"  # Access at localhost:8080
```

### Data Persistence

Bandwidth stats are stored in `/app/data/bandwidth.db` (SQLite). Mount a volume to persist data:

```yaml
volumes:
  - ./data:/app/data
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

### Reverse Proxy (Nginx/Caddy)

For WebSocket support, ensure your proxy passes upgrade headers:

**Nginx:**
```nginx
location / {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**Caddy:**
```
dashboard.example.com {
    reverse_proxy localhost:3002
}
```

---

## 🐛 Troubleshooting

### Container stats not updating
- Ensure `/var/run/docker.sock` is mounted correctly
- Check container logs: `docker compose logs dashboard`

### qBittorrent stats not showing
- Verify WebUI is accessible from the Dashboard container
- Test: `docker exec dashboard curl http://qbittorrent:8080`
- Check credentials in environment variables

### WebSocket connection fails
- If behind a reverse proxy, ensure WebSocket upgrade headers are passed
- Check firewall rules

---

## 📚 Project Structure

```
docker-dashboard/
├── src/
│   ├── server.js           # Main Express server
│   ├── public/             # Frontend files
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── script.js
│   └── utils/
│       ├── dockerStats.js  # Docker API wrapper
│       └── bandwidthDB.js  # SQLite database handler
├── docker-compose.example.yml
├── Dockerfile
└── README.md
```

---

## 📦 Related Files

- [docker-compose.example.yml](docker-compose.example.yml) - Example Docker Compose configuration
- [Dockerfile](Dockerfile) - Container build instructions
- [start.sh](start.sh) - Interactive helper script

---

## 🙌 Contributing

Contributions are welcome! We'd love your help to make Docker Dashboard even better.

### How to Contribute

- 🐛 **Report bugs** using our [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml)
- ✨ **Suggest features** using our [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml)
- 💻 **Submit pull requests** following our [PR template](.github/PULL_REQUEST_TEMPLATE.md)
- 📚 **Improve documentation** in the wiki or README

### Getting Started

1. Fork the repository
2. Read our [Contributing Guide](CONTRIBUTING.md)
3. Create a feature branch
4. Make your changes
5. Test thoroughly
6. Submit a pull request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## 📄 License

This project is licensed under the **Apache 2.0 License with Commons Clause**.

- ✅ **Free to use** for personal and educational purposes
- ✅ **Open source** - view, modify, and contribute to the code
- ✅ **Share and redistribute** with proper attribution
- ❌ **Cannot be sold** or offered as a commercial service

**What is Commons Clause?**  
Commons Clause prevents companies from selling this software as a product or service without contributing back. You can use it freely, but you cannot monetize it commercially.

See [LICENSE](LICENSE) for full details.

---

<div align="center">

<p>Made with ❤️ for the Docker community</p>

<p>
  <a href="https://github.com/MNDL-27/docker-dashboard">⭐ Star this repo</a> •
  <a href="https://github.com/MNDL-27/docker-dashboard/issues">🐛 Report Bug</a> •
  <a href="https://github.com/MNDL-27/docker-dashboard/issues">💡 Request Feature</a>
</p>

</div>
