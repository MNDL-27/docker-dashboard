# Authentication Setup

Docker Dashboard now supports optional authentication to protect your dashboard from unauthorized access.

## Quick Start

### Enable Authentication

Edit your `docker-compose.yml` and set:

```yaml
environment:
  - AUTH_ENABLED=true
  - AUTH_USERNAME=admin
  - AUTH_PASSWORD=your_secure_password_here
  - SESSION_SECRET=random_secret_key_here
```

Then restart:

```bash
docker compose down
docker compose up -d
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ENABLED` | `false` | Set to `true` to enable authentication |
| `AUTH_USERNAME` | `admin` | Username for login |
| `AUTH_PASSWORD` | `admin` | Password for login (plain text or bcrypt hash) |
| `SESSION_SECRET` | `docker-dashboard-secret-change-in-production` | Secret key for session encryption |

## Security Best Practices

### 1. Use Strong Passwords

❌ **Bad:**
```yaml
- AUTH_PASSWORD=admin
- AUTH_PASSWORD=password123
```

✅ **Good:**
```yaml
- AUTH_PASSWORD=MyS3cur3P@ssw0rd!2024
```

### 2. Use Bcrypt Hashed Passwords (Recommended)

Generate a bcrypt hash:

```bash
# Using Node.js
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your_password', 10).then(console.log);"
```

Then use the hash:

```yaml
environment:
  - AUTH_PASSWORD=$2b$10$abcdefghijklmnopqrstuvwxyz1234567890
```

### 3. Change Session Secret

Generate a random session secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use any random string:

```yaml
- SESSION_SECRET=8f7a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
```

### 4. Use HTTPS in Production

Authentication over HTTP is insecure. Use a reverse proxy with SSL:

```yaml
# Behind Nginx/Traefik with HTTPS
environment:
  - AUTH_ENABLED=true
  - HTTPS=true  # If using built-in HTTPS
```

## Login Page

Once authentication is enabled:
- Navigate to `http://localhost:1714`
- You'll be redirected to the login page
- Enter your credentials
- Session lasts 24 hours

Default credentials (if not changed):
- **Username:** `admin`
- **Password:** `admin`

## Testing

### Check Authentication Status

```bash
curl http://localhost:1714/api/auth/status
```

Response when auth is disabled:
```json
{
  "authEnabled": false,
  "authenticated": false,
  "username": null
}
```

Response when auth is enabled:
```json
{
  "authEnabled": true,
  "authenticated": true,
  "username": "admin"
}
```

### Manual Login

```bash
curl -X POST http://localhost:1714/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c cookies.txt
```

### Use Session Cookie

```bash
curl http://localhost:1714/api/containers \
  -b cookies.txt
```

## Disable Authentication

To disable authentication:

```yaml
environment:
  - AUTH_ENABLED=false
```

Or simply remove/comment out the `AUTH_ENABLED` variable.

## Troubleshooting

### Can't Log In

1. **Check credentials** - Verify `AUTH_USERNAME` and `AUTH_PASSWORD` in docker-compose.yml
2. **Check logs** - `docker logs docker-dashboard`
3. **Reset** - Set `AUTH_ENABLED=false` temporarily to regain access

### Session Expires Too Quickly

Sessions last 24 hours by default. To change:

1. Edit `server/index.js`
2. Find `maxAge: 24 * 60 * 60 * 1000`
3. Change to desired duration (in milliseconds)

### WebSocket Connection Fails

- Ensure your reverse proxy passes WebSocket headers
- Check browser console for errors
- Verify session cookie is being sent

## Example Configurations

### Basic Setup

```yaml
environment:
  - AUTH_ENABLED=true
  - AUTH_USERNAME=admin
  - AUTH_PASSWORD=MySecurePassword123!
  - SESSION_SECRET=change-this-to-random-string
```

### Production Setup with Bcrypt

```yaml
environment:
  - AUTH_ENABLED=true
  - AUTH_USERNAME=dockeradmin
  - AUTH_PASSWORD=$2b$10$xYz...  # bcrypt hash
  - SESSION_SECRET=8f7a9b2c1d4e5f6a7b8c9d0e1f2a3b4c
  - NODE_ENV=production
```

### Behind Reverse Proxy

```yaml
environment:
  - AUTH_ENABLED=true
  - AUTH_USERNAME=admin
  - AUTH_PASSWORD=$2b$10$xYz...
  - SESSION_SECRET=random-secret-key
  # Proxy handles HTTPS
```

## Additional Security

Consider adding these layers:

1. **Reverse Proxy Authentication** - Use Nginx, Traefik, or Caddy with additional auth
2. **Fail2ban** - Block repeated failed login attempts
3. **VPN** - Only accessible through VPN
4. **IP Whitelist** - Restrict access to known IPs
5. **2FA** - Use external auth provider (Authelia, Keycloak)

## Support

For issues or questions:
- [GitHub Issues](https://github.com/MNDL-27/docker-dashboard/issues)
- [Discussions](https://github.com/MNDL-27/docker-dashboard/discussions)
