# 🔧 Troubleshooting Guide

Solutions to common issues with Docker Dashboard.

## Quick Diagnostics

Run these commands to diagnose issues:

```bash
# Check if container is running
docker ps | grep docker-dashboard

# View container logs
docker logs docker-dashboard --tail 50

# Check health status
docker inspect docker-dashboard --format='{{.State.Health.Status}}'

# Verify Docker socket access
docker exec docker-dashboard ls -la /var/run/docker.sock

# Test API endpoint
curl http://localhost:1714/api/containers
```

## Common Issues

### Container Won't Start

**Symptoms:** Container exits immediately or won't start

**Diagnosis:**
```bash
docker logs docker-dashboard
```

**Solutions:**

1. **Port already in use**
   ```bash
   # Check what's using port 1714
   sudo lsof -i :1714
   
   # Change to different port in docker-compose.yml
   ports:
     - "8080:1714"  # Use port 8080 instead
   ```

2. **Docker socket not accessible**
   ```bash
   # Check socket permissions
   ls -la /var/run/docker.sock
   
   # Fix permissions
   sudo chmod 666 /var/run/docker.sock
   
   # Or add user to docker group
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **Missing environment variables**
   ```bash
   # Check required variables
   docker inspect docker-dashboard --format='{{.Config.Env}}'
   
   # Verify USE_PORTAINER configuration
   # If true, ensure PORTAINER_URL, PORTAINER_ENDPOINT_ID, and PORTAINER_API_KEY are set
   ```

### Cannot Connect to Dashboard

**Symptoms:** Browser shows "Connection refused" or times out

**Solutions:**

1. **Check container status**
   ```bash
   docker ps | grep docker-dashboard
   # Should show "healthy" in STATUS column
   ```

2. **Verify port mapping**
   ```bash
   docker port docker-dashboard
   # Should show: 1714/tcp -> 0.0.0.0:1714
   ```

3. **Test from command line**
   ```bash
   # Test from host
   curl http://localhost:1714
   
   # Test from container
   docker exec docker-dashboard wget -O- http://localhost:1714
   ```

4. **Check firewall**
   ```bash
   # Ubuntu/Debian
   sudo ufw status
   sudo ufw allow 1714/tcp
   
   # CentOS/RHEL
   sudo firewall-cmd --add-port=1714/tcp --permanent
   sudo firewall-cmd --reload
   ```

### No Containers Shown

**Symptoms:** Dashboard loads but shows "No containers found"

**Solutions:**

1. **Verify Docker is running**
   ```bash
   docker ps
   # Should show your containers
   ```

2. **Check socket mount**
   ```bash
   # Verify socket is mounted
   docker inspect docker-dashboard --format='{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' | grep docker.sock
   
   # Should show: /var/run/docker.sock -> /var/run/docker.sock
   ```

3. **Check API response**
   ```bash
   curl http://localhost:1714/api/containers | jq
   # Should return JSON array of containers
   ```

4. **Portainer misconfiguration**
   ```bash
   # If USE_PORTAINER=true, verify settings
   docker logs docker-dashboard | grep -i portainer
   
   # Test Portainer API
   curl -k -H "X-API-Key: YOUR_KEY" https://portainer.example.com:9443/api/endpoints/1/docker/containers/json
   ```

### WebSocket Connection Fails

**Symptoms:** Stats don't update in real-time, logs don't stream

**Solutions:**

1. **Check WebSocket upgrade**
   ```bash
   # Enable debug mode
   docker compose down
   # Edit docker-compose.yml, add:
   environment:
     - DEBUG_UPGRADE=true
   docker compose up -d
   
   # Check logs for WebSocket upgrades
   docker logs -f docker-dashboard | grep upgrade
   ```

2. **Reverse proxy issues**
   
   If behind Nginx:
   ```nginx
   location /ws/ {
       proxy_pass http://dashboard:1714;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_read_timeout 86400;
   }
   ```
   
   If behind Traefik (labels):
   ```yaml
   labels:
     - "traefik.http.middlewares.ws-headers.headers.customrequestheaders.Connection=upgrade"
     - "traefik.http.middlewares.ws-headers.headers.customrequestheaders.Upgrade=websocket"
   ```

3. **Cloudflare tunnel**
   ```bash
   # Cloudflare supports WebSockets by default
   # Ensure orange cloud icon is enabled for your domain
   # Check cloudflared logs for upgrade attempts
   ```

### High CPU/Memory Usage

**Symptoms:** Dashboard container consuming excessive resources

**Solutions:**

1. **Set resource limits**
   ```yaml
   services:
     dashboard:
       deploy:
         resources:
           limits:
             cpus: '0.5'
             memory: 256M
           reservations:
             cpus: '0.25'
             memory: 128M
   ```

2. **Reduce polling frequency**
   
   In browser console:
   ```javascript
   // For WebSocket stats, send:
   ws.send(JSON.stringify({ type: 'interval', interval: 5000 }));
   // Increases update interval to 5 seconds
   ```

3. **Clear metrics history**
   ```bash
   # Restart container to clear in-memory history
   docker compose restart
   ```

### qBittorrent Integration Not Working

**Symptoms:** qBittorrent shows 0 B bandwidth or "API not available"

**Solutions:**

1. **Verify qBittorrent URL**
   ```bash
   # Test from dashboard container
   docker exec docker-dashboard wget -O- http://192.168.0.102:8081/api/v2/app/version
   
   # Should return qBittorrent version like: v4.6.0
   ```

2. **Check WebUI authentication**
   ```bash
   # Test login
   docker exec docker-dashboard wget -O- --post-data="username=admin&password=yourpass" http://192.168.0.102:8081/api/v2/auth/login
   
   # Should return: Ok.
   ```

3. **Whitelist Docker subnet**
   
   In qBittorrent WebUI:
   - Settings → Web UI → Authentication
   - Enable "Bypass authentication for clients in whitelisted IP subnets"
   - Find your Docker subnet:
     ```bash
     docker inspect docker-dashboard -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
     # Example: 192.168.16.2
     ```
   - Add to whitelist: `192.168.16.0/24` or `192.168.0.0/16`
   - Disable "Enable Host header validation" (or add dashboard IP)
   - Click Save

4. **Check environment variables**
   ```bash
   docker exec docker-dashboard env | grep QBIT
   # Should show QBITTORRENT_URL, USERNAME, PASSWORD
   ```

5. **Test transfer API**
   ```bash
   curl http://localhost:1714/api/qbittorrent/transfer
   # Should return bandwidth stats, not error
   ```

### Portainer Integration Issues

**Symptoms:** Can't connect to Portainer, authentication errors

**Solutions:**

1. **Verify API key**
   ```bash
   # Test Portainer API directly
   curl -k -H "X-API-Key: YOUR_KEY" https://portainer.example.com:9443/api/endpoints/1/docker/containers/json
   ```

2. **Check self-signed certificate**
   ```bash
   # Dashboard accepts self-signed certs (rejectUnauthorized: false)
   # But check Portainer is accessible
   curl -k https://portainer.example.com:9443/api/endpoints
   ```

3. **Verify endpoint ID**
   ```bash
   # List all endpoints
   curl -k -H "X-API-Key: YOUR_KEY" https://portainer.example.com:9443/api/endpoints
   # Find the correct endpoint ID (usually 1)
   ```

4. **Check dashboard logs**
   ```bash
   docker logs docker-dashboard | grep -i portainer
   # Look for connection errors or timeouts
   ```

### Container Stats Show Zero

**Symptoms:** Stats show 0% CPU, 0 MB RAM, 0 B/s network

**Solutions:**

1. **Check container state**
   ```bash
   docker ps -a | grep YOUR_CONTAINER
   # Ensure it's actually running (Status: Up)
   ```

2. **Verify stats API**
   ```bash
   # Test Docker stats directly
   docker stats YOUR_CONTAINER --no-stream --format "{{json .}}"
   ```

3. **Wait for second data point**
   
   Stats require two snapshots to calculate rates:
   - First request returns zeros
   - Second request (2-5 seconds later) returns actual values

4. **VPN-bound containers**
   
   If container uses `--network container:vpn`:
   - Docker stats won't show network usage
   - Use qBittorrent integration for bandwidth
   - Or monitor VPN container directly

### Disk Usage Shows Wrong Size

**Symptoms:** Disk usage doesn't match `docker system df`

**Solutions:**

1. **Understanding disk metrics**
   
   Dashboard shows `SizeRw` (container layer only):
   - Includes files written inside container
   - Excludes base image size
   - Excludes mounted volumes

2. **Check actual size**
   ```bash
   # View all size metrics
   docker inspect YOUR_CONTAINER --format='{{.SizeRw}} {{.SizeRootFs}}'
   
   # SizeRw: Writable layer size
   # SizeRootFs: Total size (base image + writable layer)
   ```

3. **Include mounted volumes**
   ```bash
   # Dashboard doesn't count mounted volumes
   # Check volume sizes separately:
   docker system df -v
   ```

## Performance Issues

### Slow Dashboard Loading

**Solutions:**

1. **Reduce history window**
   
   Edit `server/routes/containers.js`:
   ```javascript
   const METRICS_WINDOW = 150; // Reduce from 300 to 150
   ```

2. **Optimize Docker daemon**
   ```bash
   # Check Docker daemon performance
   docker info
   
   # Prune unused data
   docker system prune -a
   ```

3. **Use SSD for Docker storage**
   ```bash
   # Check Docker storage driver
   docker info | grep "Storage Driver"
   
   # Overlay2 is recommended for performance
   ```

### Stats Update Lag

**Solutions:**

1. **Increase WebSocket interval**
   ```javascript
   // In container.html or custom client
   ws.send(JSON.stringify({ type: 'interval', interval: 5000 }));
   ```

2. **Reduce concurrent connections**
   
   Don't open multiple dashboard tabs simultaneously

3. **Check network latency**
   ```bash
   # Test response time
   time curl -s http://localhost:1714/api/containers > /dev/null
   ```

## Advanced Diagnostics

### Enable Verbose Logging

```yaml
# docker-compose.yml
environment:
  - NODE_ENV=development  # Enables more logging
  - DEBUG_UPGRADE=true    # Logs WebSocket upgrades
```

### Inspect Network Traffic

```bash
# Monitor HTTP requests
docker exec docker-dashboard tcpdump -i eth0 -A 'tcp port 1714'

# Monitor WebSocket traffic
docker exec docker-dashboard tcpdump -i eth0 -A 'tcp port 1714 and (tcp[((tcp[12:1] & 0xf0) >> 2):1] = 0x47)'
```

### Check Docker Daemon Logs

```bash
# Ubuntu/Debian
sudo journalctl -u docker -f

# View daemon logs
sudo tail -f /var/log/docker.log
```

### Database/State Issues

Dashboard is **stateless** (no database). To reset:

```bash
# Simply restart
docker compose restart

# Or recreate
docker compose down
docker compose up -d
```

## Getting Help

If none of these solutions work:

1. **Gather diagnostic information**
   ```bash
   # Save logs
   docker logs docker-dashboard > dashboard-logs.txt
   
   # Save configuration
   docker inspect docker-dashboard > dashboard-config.json
   
   # Save environment
   docker exec docker-dashboard env > dashboard-env.txt
   ```

2. **Check existing issues**
   - Search [GitHub Issues](https://github.com/MNDL-27/docker-dashboard/issues)
   - Look for similar problems and solutions

3. **Create a new issue**
   - Include logs and configuration
   - Describe steps to reproduce
   - Mention your environment (OS, Docker version, etc.)

4. **Ask in Discussions**
   - [GitHub Discussions](https://github.com/MNDL-27/docker-dashboard/discussions)
   - Community support and questions

## Related Documentation

- **[Configuration Guide](Configuration.md)** - Proper configuration
- **[API Reference](API-Reference.md)** - Understanding API responses
- **[FAQ](FAQ.md)** - Frequently asked questions

---

**Still stuck?** [Open an issue](https://github.com/MNDL-27/docker-dashboard/issues) with your diagnostic information.
