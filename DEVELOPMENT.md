# 🔧 Development Guide

Simple production setup with live code mounting - edit and restart!

## 🚀 Quick Start

```bash
# Start the dashboard
docker compose up -d

# Edit any file in server/ or public/

# Restart to see changes (no rebuild needed!)
docker compose restart
```

That's it! Your code is mounted, so you just edit and restart. No rebuilds! 🎉

## 📝 Development Workflow

### 1. Make Code Changes
Edit any file in `server/` or `public/` folders

### 2. Restart Container
```bash
docker compose restart
```

Changes are live! No rebuild needed because your code is mounted as a volume.

### 3. View Logs
```bash
# Watch real-time logs
docker compose logs -f
```

## 🐛 Debugging

### Check Mounted Volumes
```bash
docker exec -it docker-dashboard ls -la /app/server
docker exec -it docker-dashboard ls -la /app/public
```

### Access Container Shell
```bash
docker exec -it docker-dashboard sh
```

## 📦 Installing New Dependencies

```bash
# 1. Add dependency to package.json manually
# 2. Rebuild the container
docker compose up --build -d
```

## � When You Need to Rebuild

Only rebuild when you change:
- **package.json** (new dependencies)
- **Dockerfile** (container configuration)

Otherwise, just restart!

## 💡 Tips & Tricks

### 1. Fast Iteration
```bash
# Terminal 1: Keep logs running
docker compose logs -f

# Terminal 2: Edit code in VS Code
# Terminal 3: Quick restart command
docker compose restart
```

### 2. Browser Auto-Refresh
For frontend changes, press `Ctrl+Shift+R` to hard refresh your browser.

### 3. Environment Variables
Create a `.env` file for local overrides:
```bash
AUTH_ENABLED=true
AUTH_USERNAME=admin
AUTH_PASSWORD=yourpassword
```

## 🎯 Common Issues

### Issue: Changes Not Detected
**Solution**: Make sure you restart the container
```bash
docker compose restart
```

### Issue: "Cannot find module"
**Solution**: Rebuild with dependencies
```bash
docker compose up --build -d
```

### Issue: Port 1714 Already in Use
**Solution**: Stop the container first
```bash
docker compose down
docker compose up -d
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Volumes Guide](https://docs.docker.com/storage/volumes/)

---

## 🎉 You're Ready!

Now you can develop with just **edit → restart**. No rebuilds! Happy coding! 🚀

**Questions?** Check the [Troubleshooting Wiki](wiki/Troubleshooting.md) or open an issue.
