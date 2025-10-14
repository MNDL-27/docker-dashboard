# qBittorrent Integration

The Docker Dashboard includes special integration for qBittorrent containers to show accurate bandwidth statistics even when the container is bound to a VPN.

## Why is this needed?

When qBittorrent is bound to a VPN container using `--network container:vpn`, Docker cannot track its network statistics because all traffic goes through the VPN container's network namespace. This causes the dashboard to show `0 B` for download/upload.

## How it works

The dashboard automatically detects qBittorrent containers (by image or container name) and uses the qBittorrent WebUI API to fetch real bandwidth statistics directly from qBittorrent itself.

## Configuration

### Step 1: Set Environment Variables

Create a `.env` file in the project root or add these to your `docker-compose.yml`:

```env
QBITTORRENT_URL=http://192.168.0.102:8081  # Use your qBittorrent IP:PORT
QBITTORRENT_USERNAME=your_username
QBITTORRENT_PASSWORD=your_password
```

**Finding the correct URL:**
- If qBittorrent is bound to a VPN, use the host IP where qBittorrent WebUI is accessible
- Example: `http://192.168.0.102:8081` (check your browser's address bar)
- Or use hostname: `http://optiplex.lan:8081`
- Avoid using `http://qbittorrent:8080` if the container has no direct network access

### Step 2: Configure qBittorrent WebUI Security

Since the dashboard needs to access qBittorrent's API, you must whitelist the Docker network:

1. **Open qBittorrent WebUI** (e.g., `http://192.168.0.102:8081`)

2. **Go to Settings (⚙️ gear icon) → Web UI tab**

3. **Find "Authentication" section** and configure:
   - Enable **"Bypass authentication for clients in whitelisted IP subnets"**
   - Add your Docker network subnet to the whitelist

4. **Find your Docker network subnet:**
   ```bash
   docker inspect docker-dashboard -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
   # Example output: 192.168.16.2
   # Add to whitelist: 192.168.16.0/24 or 192.168.0.0/16 for full range
   ```

5. **Additional security settings:**
   - **Disable** "Enable Host header validation" (recommended)
   - Or add your dashboard IP (e.g., `192.168.16.2`) and qBittorrent IP (e.g., `192.168.0.102`) to allowed hosts

6. **Click "Save"** at the bottom

### Step 3: Restart Dashboard

```bash
cd ~/software/docker-dashboard
docker compose restart
```

### Step 4: Verify Connection

Test if the dashboard can reach qBittorrent:

```bash
# Test API connection (replace IP with your qBittorrent IP)
docker exec docker-dashboard wget -qO- http://192.168.0.102:8081/api/v2/app/version

# Should return qBittorrent version like: v4.6.0

# Check transfer info endpoint
docker exec docker-dashboard wget -qO- http://192.168.0.102:8081/api/v2/transfer/info

# Should return JSON with bandwidth stats

# Check dashboard logs
docker logs docker-dashboard --tail 20
```

### Example docker-compose.yml

```yaml
services:
  dashboard:
    build: .
    container_name: docker-dashboard
    ports:
      - "1714:1714"
    environment:
      - NODE_ENV=production
      - PORT=1714
      - QBITTORRENT_URL=http://192.168.0.102:8081
      - QBITTORRENT_USERNAME=admin
      - QBITTORRENT_PASSWORD=your_password
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"  # For host network access
```

## Features

- ✅ **Automatic detection** - Detects qBittorrent by image or container name
- ✅ **Real bandwidth stats** - Shows actual download/upload from qBittorrent API
- ✅ **Live speed monitoring** - Updates download/upload speeds every 2 seconds
- ✅ **Connection status** - Shows if qBittorrent is connected to trackers
- ✅ **Fallback support** - Falls back to Docker stats if API is unavailable

## API Endpoints

The dashboard provides these endpoints for qBittorrent:

- `GET /api/qbittorrent/transfer` - Get transfer statistics
- `GET /api/qbittorrent/torrents` - Get list of torrents

## Troubleshooting

### Dashboard shows 0 B for qBittorrent

1. **Check if qBittorrent WebUI is accessible:**
   ```bash
   # Test from dashboard container
   docker exec docker-dashboard wget -O- http://192.168.0.102:8081/api/v2/app/version
   ```

2. **Verify credentials in `.env` file:**
   ```bash
   cat ~/software/docker-dashboard/.env
   # Should show:
   # QBITTORRENT_URL=http://192.168.0.102:8081
   # QBITTORRENT_USERNAME=your_username
   # QBITTORRENT_PASSWORD=your_password
   ```

3. **Check if qBittorrent whitelist is configured:**
   - Open qBittorrent WebUI → Settings → Web UI
   - Verify your Docker subnet (e.g., `192.168.16.0/24`) is in the IP whitelist
   - Verify "Enable Host header validation" is disabled

4. **Check dashboard logs:**
   ```bash
   docker logs docker-dashboard --tail 50 | grep -i qbit
   ```

5. **Verify dashboard container IP is in whitelist:**
   ```bash
   docker inspect docker-dashboard -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
   # Example: 192.168.16.2
   # Make sure 192.168.16.0/24 is whitelisted in qBittorrent
   ```

### 403 Forbidden errors

This means qBittorrent is blocking the dashboard's API requests:

**Solution:**
1. Open qBittorrent WebUI → Settings (⚙️) → Web UI
2. Find **"Bypass authentication for clients in whitelisted IP subnets"**
3. Add your Docker network subnet:
   - Find it: `docker inspect docker-dashboard -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'`
   - If output is `192.168.16.2`, add `192.168.16.0/24` to whitelist
   - Or use broader range: `192.168.0.0/16`
4. **Disable** "Enable Host header validation"
5. Click **Save** and restart dashboard: `docker compose restart`

### Authentication errors

If you see "Unauthorized" or "Login failed" errors:
- Verify WebUI credentials match your `.env` file
- Check if WebUI is enabled in qBittorrent settings
- Try logging into WebUI manually with same credentials
- Check qBittorrent logs for failed login attempts

### Cannot connect to qBittorrent

**If qBittorrent is bound to a VPN:**
- ❌ Don't use: `http://qbittorrent:8080` (container name won't work)
- ✅ Use host IP: `http://192.168.0.102:8081` (check your browser URL)
- ✅ Or hostname: `http://optiplex.lan:8081`

**Find the correct IP:**
```bash
# Check what URL you use in browser to access qBittorrent
# Use that same URL in QBITTORRENT_URL

# Or find your server's LAN IP
hostname -I | awk '{print $1}'
```

**Test connection:**
```bash
# From dashboard container
docker exec docker-dashboard wget -qO- http://192.168.0.102:8081/api/v2/app/version

# Should return version, not 403 or connection error
```

### Still showing 0 B after configuration

1. **Hard refresh browser** (Ctrl+Shift+R or Ctrl+F5)
2. **Clear browser cache**
3. **Open browser console** (F12) and check for errors
4. **Check if qBittorrent is actually downloading:**
   - Open qBittorrent WebUI
   - Verify torrents are active and showing speed
5. **Restart dashboard:** `docker compose restart`

## Security Notes

- Store credentials securely (use Docker secrets or `.env` file)
- Don't commit credentials to Git
- Use strong passwords for qBittorrent WebUI
- Consider network segmentation for production deployments
