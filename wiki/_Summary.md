# 📚 Wiki Summary

This document provides a quick overview of all available wiki pages and their purposes.

## 📖 Getting Started (New Users)

1. **[Home](Home.md)** - Wiki homepage with navigation
2. **[Quick Start](Quick-Start.md)** - Get Docker Dashboard running in 5 minutes
3. **[Dashboard Overview](Dashboard-Overview.md)** - Understanding the interface *(Coming Soon)*
4. **[First Steps](First-Steps.md)** - Your first container monitoring experience *(Coming Soon)*

## ⚙️ Configuration & Setup

- **[Configuration](Configuration.md)** - Complete guide to all environment variables
- **[Portainer Integration](Portainer-Integration.md)** - Multi-host Docker management *(Coming Soon - migrated from INSTALL.md)*
- **[qBittorrent Integration](qBittorrent-Integration.md)** - VPN-bound container bandwidth tracking *(Coming Soon - migrated from QBITTORRENT_INTEGRATION.md)*
- **[HTTPS Configuration](HTTPS-Configuration.md)** - Secure your dashboard with SSL/TLS *(Coming Soon)*

## 🚀 Deployment Guides

- **[Docker Compose Deployment](Docker-Compose-Deployment.md)** - Recommended deployment method *(Coming Soon - migrated from DOCKER_DEPLOYMENT.md)*
- **[Docker CLI Deployment](Docker-CLI-Deployment.md)** - Manual container deployment *(Coming Soon)*
- **[Production Deployment](Production-Deployment.md)** - Best practices for production *(Coming Soon)*
- **[Reverse Proxy Setup](Reverse-Proxy.md)** - Nginx, Traefik, Caddy examples *(Coming Soon)*
- **[Docker Swarm Deployment](Docker-Swarm-Deployment.md)** - Deploy to Swarm *(Coming Soon)*
- **[Kubernetes Deployment](Kubernetes-Deployment.md)** - Deploy to K8s *(Coming Soon)*
- **[Resource Limits](Resource-Limits.md)** - Configure memory/CPU limits *(Coming Soon)*

## 📡 Features & Usage

- **[Dashboard Overview](Dashboard-Overview.md)** - Main dashboard interface *(Coming Soon)*
- **[Container Management](Container-Management.md)** - Start, stop, restart containers *(Coming Soon)*
- **[Live Monitoring](Live-Monitoring.md)** - Real-time stats and charts *(Coming Soon)*
- **[Bandwidth Tracking](Bandwidth-Tracking.md)** - Network usage monitoring *(Coming Soon)*
- **[Log Streaming](Log-Streaming.md)** - View container logs in real-time *(Coming Soon)*

## 🔧 Development & API

- **[Project Structure](Project-Structure.md)** - Codebase architecture *(Coming Soon - migrated from PROJECT_STRUCTURE.md)*
- **[API Reference](API-Reference.md)** - Complete REST and WebSocket API documentation
- **[Architecture](Architecture.md)** - Design patterns and decisions *(Coming Soon)*
- **[Contributing Guide](Contributing.md)** - Help improve the project *(Coming Soon)*

## 🆘 Help & Support

- **[Troubleshooting](Troubleshooting.md)** - Comprehensive troubleshooting guide
- **[FAQ](FAQ.md)** - Frequently asked questions *(Coming Soon)*
- **[Debug Mode](Debug-Mode.md)** - Enable verbose logging *(Coming Soon)*
- **[Performance Tuning](Performance-Tuning.md)** - Optimize for your setup *(Coming Soon)*

## 🎨 Advanced Topics

- **[Custom Themes](Custom-Themes.md)** - Customize the UI appearance *(Coming Soon)*
- **[Backup & Restore](Backup-and-Restore.md)** - Configuration backup strategies *(Coming Soon)*

---

## ✅ Completed Wiki Pages

- ✅ [Home](Home.md) - Wiki navigation hub
- ✅ [Quick Start](Quick-Start.md) - Fast deployment guide
- ✅ [Configuration](Configuration.md) - Environment variables reference
- ✅ [API Reference](API-Reference.md) - Complete API documentation
- ✅ [Troubleshooting](Troubleshooting.md) - Common issues and solutions

## 🚧 Pages To Be Created

### High Priority (Migrate from existing docs)

- [ ] **qBittorrent Integration** - Migrate from `QBITTORRENT_INTEGRATION.md`
- [ ] **Portainer Integration** - Migrate from `INSTALL.md` Portainer section
- [ ] **Docker Compose Deployment** - Migrate from `DOCKER_DEPLOYMENT.md`
- [ ] **Project Structure** - Migrate from `PROJECT_STRUCTURE.md`
- [ ] **Installation Guide** - Migrate from `INSTALL.md`

### Medium Priority (New content)

- [ ] **Dashboard Overview** - Screenshots and UI tour
- [ ] **Container Management** - Using the web interface
- [ ] **Live Monitoring** - Understanding real-time stats
- [ ] **Production Deployment** - Best practices, reverse proxy examples
- [ ] **FAQ** - Common questions and quick answers

### Low Priority (Advanced topics)

- [ ] **HTTPS Configuration** - SSL/TLS setup guide
- [ ] **Reverse Proxy Setup** - Nginx/Traefik/Caddy configs
- [ ] **Docker Swarm Deployment** - Swarm stack files
- [ ] **Kubernetes Deployment** - K8s manifests and Helm charts
- [ ] **Custom Themes** - UI customization
- [ ] **Architecture** - Technical deep-dive
- [ ] **Contributing Guide** - Development workflow

---

## 📝 Migration Notes

The following files should be **migrated** to wiki pages and then **archived** or removed:

1. **INSTALL.md** → Split into:
   - `Installation.md` (basic install)
   - `Portainer-Integration.md` (Portainer section)

2. **DOCKER_DEPLOYMENT.md** → Split into:
   - `Docker-Compose-Deployment.md`
   - `Docker-CLI-Deployment.md`
   - `Production-Deployment.md`
   - `Reverse-Proxy.md`

3. **QBITTORRENT_INTEGRATION.md** → Migrate to:
   - `qBittorrent-Integration.md`

4. **PROJECT_STRUCTURE.md** → Migrate to:
   - `Project-Structure.md`

After migration, keep original files with a notice redirecting to wiki.

---

## 🎯 Wiki Organization Principles

1. **One Topic Per Page** - Keep pages focused and concise
2. **Progressive Disclosure** - Start simple, link to advanced topics
3. **Consistent Structure** - Use standard sections across pages
4. **Code Examples** - Always include copy-paste examples
5. **Cross-Reference** - Link related pages liberally
6. **Search-Friendly** - Use clear headings and keywords

---

**Last Updated:** October 15, 2025
