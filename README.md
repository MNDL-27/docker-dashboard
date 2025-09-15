<div align="center">
  <h1>🚢 Docker Dashboard</h1>
  <p>A modern web app to monitor, manage, and view live stats/logs for all your Docker containers.<br>
  <b>Node.js backend + SPA frontend + Portainer gateway support</b></p>
  <p>
    <img src="https://img.shields.io/github/license/MNDL-27/docker-dashboard?style=flat-square" alt="License">
    <img src="https://img.shields.io/github/languages/top/MNDL-27/docker-dashboard?style=flat-square" alt="Top Language">
    <img src="https://img.shields.io/github/last-commit/MNDL-27/docker-dashboard?style=flat-square" alt="Last Commit">
  </p>
</div>

---

## Features

- 🚀 **Live container stats** (CPU, memory, network, IO)
- 📜 **Real-time logs** (search, tail, multiplexed)
- 🖥️ **Single-page dashboard UI** (responsive, dark theme)
- 🔌 **REST API & WebSocket streaming**
- 🛡️ **Portainer gateway support** (multi-host, API key)
- 🐳 **Dockerized deployment** (compose, Dockerfile)

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/MNDL-27/docker-dashboard.git
cd docker-dashboard

# Copy and edit environment variables
cp .env.example .env

# Start with Docker Compose
# (edit .env to use Portainer gateway if needed)
docker compose up -d

# Access the dashboard
http://localhost:8088
```

---

## Configuration

Edit `.env` for your environment:

```env
USE_PORTAINER=false
PORT=8088
DOCKER_SOCKET=/var/run/docker.sock
PORTAINER_URL=https://portainer.example.com:9443
PORTAINER_ENDPOINT_ID=1
PORTAINER_API_KEY=replace_me
```

- Set `USE_PORTAINER=true` to use Portainer gateway (multi-host, API key required)
- Otherwise, direct Docker Engine access via socket

---

## Security Notes

- **API keys**: Keep your Portainer API key secret. Do not commit `.env` with real keys.
- **Socket access**: Only mount Docker socket for trusted users.
- **HTTPS**: Use HTTPS for Portainer and dashboard in production.
- **Authentication**: Add authentication if exposing dashboard publicly.

---

## Portainer Gateway How-To

1. Set up Portainer and create an API key.
2. Set `USE_PORTAINER=true` in `.env`.
3. Fill in `PORTAINER_URL`, `PORTAINER_ENDPOINT_ID`, and `PORTAINER_API_KEY`.
4. Restart the dashboard.
5. All API calls will route through Portainer for multi-host and RBAC support.

---

## Limitations

- No built-in authentication (add reverse proxy or middleware for public use)
- Stats/logs streaming is best-effort; may need tuning for large clusters
- Portainer gateway requires valid API key and endpoint ID

---

## Contributing

Pull requests and issues welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

This project is licensed under the AGPL-3.0. See [LICENSE](LICENSE) for details.
