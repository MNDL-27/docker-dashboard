# Docker Dashboard - Project Structure

## 📁 Project Layout

```
docker-dashboard/
├── 🐳 Docker Files
│   ├── Dockerfile              # Container image definition
│   ├── docker-compose.yml      # Container orchestration
│   └── .dockerignore          # Build optimization
│
├── 📚 Documentation
│   ├── README.md              # Project overview
│   ├── INSTALL.md             # Installation guide
│   ├── DOCKER_DEPLOYMENT.md   # Deployment guide
│   └── LICENSE                # AGPL-3.0 license
│
├── 🚀 Deployment
│   └── start.sh               # Interactive helper script (Linux)
│
├── 🖥️ Frontend (public/)
│   ├── index.html             # Main dashboard page
│   ├── container.html         # Container details page
│   ├── app.js                 # Frontend JavaScript
│   └── public/
│       ├── favicon.ico        # Site favicon
│       ├── placeholder.svg    # Placeholder image
│       └── robots.txt         # SEO configuration
│
├── ⚙️ Backend (server/)
│   ├── index.js               # Express server entry point
│   ├── config/
│   │   ├── defaults.js        # Default configuration
│   │   └── schema.js          # Configuration schema
│   ├── docker/
│   │   ├── engineClient.js    # Docker Engine client
│   │   ├── portainerClient.js # Portainer API client
│   │   └── proxy.js           # API proxy logic
│   ├── routes/
│   │   └── containers.js      # Container API routes
│   ├── sockets/
│   │   ├── index.js           # WebSocket setup
│   │   ├── logs.js            # Log streaming
│   │   └── stats.js           # Stats streaming
│   └── utils/
│       ├── cpu.js             # CPU calculations
│       ├── io.js              # I/O utilities
│       └── stream.js          # Stream helpers
│
└── 📦 Dependencies
    ├── package.json           # Node.js dependencies
    └── package-lock.json      # Dependency lock file
```

## 🚫 Removed Files (Clean Architecture)

The following files were **removed** to maintain a clean Docker-only architecture:

- ❌ `nginx.conf` - Not needed (Express serves static files)
- ❌ `.env` - Configuration via docker-compose.yml
- ❌ `.env.example` - Configuration documented in README
- ❌ `start.bat` - Windows support dropped (Linux-only)

## 📝 Notes

- **No local Node.js installation required** - Everything runs in Docker
- **Single container deployment** - No nginx, no separate services
- **Configuration via docker-compose.yml** - No .env files needed
- **Linux optimized** - Tested on Ubuntu, Debian, CentOS
- **Minimal dependencies** - Only 4 npm packages

## 🔄 Quick Commands

```bash
# Clone and deploy
git clone https://github.com/MNDL-27/docker-dashboard.git
cd docker-dashboard
docker compose up -d

# Access
http://localhost:1714

# Manage
./start.sh
```
