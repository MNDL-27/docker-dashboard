# qBittorrent Integration

The Docker Dashboard includes special integration for qBittorrent containers to show accurate bandwidth statistics even when the container is bound to a VPN.

## Why is this needed?

When qBittorrent is bound to a VPN container using `--network container:vpn`, Docker cannot track its network statistics because all traffic goes through the VPN container's network namespace. This causes the dashboard to show `0 B` for download/upload.

## How it works

The dashboard automatically detects qBittorrent containers (by image or container name) and uses the qBittorrent WebUI API to fetch real bandwidth statistics directly from qBittorrent itself.

## Configuration

### Environment Variables

Add these to your `docker-compose.yml`:

```yaml
environment:
  - QBITTORRENT_URL=http://qbittorrent:8080  # or your qBittorrent WebUI URL
  - QBITTORRENT_USERNAME=admin                # WebUI username
  - QBITTORRENT_PASSWORD=adminadmin           # WebUI password
```

### Example Setup

If your qBittorrent container is named `qbittorrent` and running on the default port:

```yaml
services:
  dashboard:
    environment:
      - QBITTORRENT_URL=http://qbittorrent:8080
      - QBITTORRENT_USERNAME=admin
      - QBITTORRENT_PASSWORD=your_password_here
    networks:
      - vpn_network  # Same network as qBittorrent

  qbittorrent:
    image: linuxserver/qbittorrent
    container_name: qbittorrent
    network_mode: "container:wireguard"  # Bound to VPN
    environment:
      - WEBUI_PORT=8080
    # ... other config
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
   curl http://qbittorrent:8080/api/v2/app/version
   ```

2. **Verify credentials** - Make sure `QBITTORRENT_USERNAME` and `QBITTORRENT_PASSWORD` are correct

3. **Check network connectivity** - Dashboard and qBittorrent must be on the same Docker network (or use host IP)

4. **Check logs:**
   ```bash
   docker logs docker-dashboard | grep qBittorrent
   ```

### Authentication errors

If you see "403 Forbidden" errors:
- Verify WebUI credentials are correct
- Check if WebUI is enabled in qBittorrent settings
- Ensure bypass authentication for localhost is disabled (dashboard needs to auth)

### Cannot connect to qBittorrent

If qBittorrent is bound to VPN:
- Use the container name as the URL: `http://qbittorrent:8080`
- Make sure dashboard is on the same Docker network
- Or use host IP if on different networks: `http://192.168.1.10:8080`

## Security Notes

- Store credentials securely (use Docker secrets or `.env` file)
- Don't commit credentials to Git
- Use strong passwords for qBittorrent WebUI
- Consider network segmentation for production deployments
