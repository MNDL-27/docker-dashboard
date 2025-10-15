# 🔧 Development Guide

This guide explains how to develop the Docker Dashboard with **hot-reloading** - no container rebuilds needed!

## 🚀 Quick Start (Development Mode)

### First Time Setup
```bash
# Build the container once
docker-compose -f docker-compose.dev.yml build

# Start in development mode
docker-compose -f docker-compose.dev.yml up
```

### Daily Development
```bash
# Just start the container (no rebuild needed)
docker-compose -f docker-compose.dev.yml up

# Or run in background
docker-compose -f docker-compose.dev.yml up -d
```

## ✨ Hot-Reloading Features

### What Changes Are Detected Automatically?
- ✅ **Server code** (`server/*.js`) - Auto-restarts via nodemon
- ✅ **Public files** (`public/*.html`, `public/*.js`) - Refresh browser
- ✅ **Package.json** - Auto-detected (may need restart for new deps)

### What Requires Container Restart?
- ❌ **Dependencies** - Run `docker-compose -f docker-compose.dev.yml restart`
- ❌ **Dockerfile changes** - Run `docker-compose -f docker-compose.dev.yml up --build`
- ❌ **Environment variables** - Edit `.env` and restart

## 📝 Development Workflow

### 1. Make Code Changes
Edit any file in `server/` or `public/` - changes reflect **immediately**!

```javascript
// server/index.js
app.get('/test', (req, res) => {
  res.json({ message: 'Hot reload works!' }); // Save and it's live!
});
```

### 2. View Logs
```bash
# Watch real-time logs
docker-compose -f docker-compose.dev.yml logs -f

# Just nodemon output
docker-compose -f docker-compose.dev.yml logs -f dashboard
```

### 3. Restart if Needed
```bash
# Restart without rebuilding
docker-compose -f docker-compose.dev.yml restart

# Stop and remove
docker-compose -f docker-compose.dev.yml down
```

## 🐛 Debugging

### Check if Nodemon is Running
```bash
docker exec -it docker-dashboard-dev ps aux | grep nodemon
```

### Check Mounted Volumes
```bash
docker exec -it docker-dashboard-dev ls -la /app/server
docker exec -it docker-dashboard-dev ls -la /app/public
```

### Access Container Shell
```bash
docker exec -it docker-dashboard-dev sh
```

## 📦 Installing New Dependencies

### Option 1: Install and Restart (Recommended)
```bash
# Add dependency to package.json manually
# Then restart container
docker-compose -f docker-compose.dev.yml restart
```

### Option 2: Install in Container
```bash
# Install in running container
docker exec -it docker-dashboard-dev npm install <package-name>

# Then add to package.json manually
```

### Option 3: Rebuild
```bash
# Nuclear option - full rebuild
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up --build
```

## 🏭 Production vs Development

### Development Mode (`docker-compose.dev.yml`)
- ✅ Hot-reloading enabled
- ✅ Volume mounts for live code sync
- ✅ Nodemon auto-restart
- ✅ NODE_ENV=development
- ⚠️ Don't use in production!

### Production Mode (`docker-compose.yml`)
- ✅ Optimized build
- ✅ No volume mounts (code in image)
- ✅ Production dependencies only
- ✅ NODE_ENV=production
- ✅ Health checks enabled

## 🔄 Switching Between Modes

### Development → Production
```bash
# Stop dev
docker-compose -f docker-compose.dev.yml down

# Start production
docker-compose up -d
```

### Production → Development
```bash
# Stop production
docker-compose down

# Start dev
docker-compose -f docker-compose.dev.yml up
```

## 💡 Tips & Tricks

### 1. Fast Iteration
```bash
# Terminal 1: Keep logs running
docker-compose -f docker-compose.dev.yml logs -f

# Terminal 2: Edit code in VS Code
# Changes appear in Terminal 1 instantly!
```

### 2. Browser Auto-Refresh
For frontend changes, use a browser extension like "Live Reload" or press `Ctrl+Shift+R` to hard refresh.

### 3. Environment Variables
Create a `.env` file for local overrides:
```bash
AUTH_ENABLED=true
AUTH_USERNAME=devuser
AUTH_PASSWORD=devpass
```

### 4. Network Issues
If you can't access localhost:1714:
```bash
# Check if port is bound
docker-compose -f docker-compose.dev.yml ps
netstat -ano | findstr 1714

# Restart Docker Desktop (Windows)
# Or restart Docker daemon (Linux)
```

## 🎯 Common Issues

### Issue: Changes Not Detected
**Solution**: Check volume mounts are working
```bash
# Verify mounts
docker inspect docker-dashboard-dev | grep -A 10 Mounts

# Restart container
docker-compose -f docker-compose.dev.yml restart
```

### Issue: "Cannot find module"
**Solution**: Rebuild with dependencies
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Issue: Port 1714 Already in Use
**Solution**: Stop the other container
```bash
# Find what's using the port
docker ps
netstat -ano | findstr 1714

# Stop all dashboard containers
docker stop docker-dashboard docker-dashboard-dev
```

### Issue: Nodemon Not Restarting
**Solution**: Check nodemon is installed
```bash
docker exec -it docker-dashboard-dev npm list nodemon
docker-compose -f docker-compose.dev.yml up --build
```

## 📚 Additional Resources

- [Nodemon Documentation](https://nodemon.io/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Volumes Guide](https://docs.docker.com/storage/volumes/)

---

## 🎉 You're Ready!

Now you can develop without rebuilding containers. Happy coding! 🚀

**Questions?** Check the [Troubleshooting Wiki](wiki/Troubleshooting.md) or open an issue.
