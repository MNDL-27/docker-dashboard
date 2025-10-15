# 🔐 Authentication Added!

Authentication has been successfully added to Docker Dashboard!

## ✨ What's New

### Features Added:
- ✅ **Session-based authentication** with secure cookie storage
- ✅ **Modern login page** with gradient design
- ✅ **Password hashing** support (bcrypt)
- ✅ **Protected APIs** - all `/api/` routes require authentication
- ✅ **WebSocket protection** - secure real-time connections
- ✅ **24-hour sessions** - stay logged in
- ✅ **Optional** - disabled by default, no breaking changes

### Files Created:
- `server/middleware/auth.js` - Authentication middleware
- `server/routes/auth.js` - Login/logout endpoints
- `public/login.html` - Beautiful login page
- `AUTHENTICATION.md` - Complete setup guide

### Files Modified:
- `server/index.js` - Added session & auth middleware
- `server/sockets/index.js` - Added WebSocket auth
- `docker-compose.yml` - Added auth environment variables
- `package.json` - Added `express-session` and `bcrypt`

## 🚀 Quick Start

### Enable Authentication:

1. **Edit docker-compose.yml:**
   ```yaml
   environment:
     - AUTH_ENABLED=true
     - AUTH_USERNAME=admin
     - AUTH_PASSWORD=YourSecurePassword123!
     - SESSION_SECRET=your-random-secret-key-here
   ```

2. **Restart container:**
   ```bash
   docker compose down
   docker compose up -d
   ```

3. **Access dashboard:**
   - Visit: http://localhost:1714
   - Login with your credentials
   - Done! 🎉

### Disable Authentication (Default):

Authentication is **disabled by default**. Your existing setup works as before.

To explicitly disable:
```yaml
environment:
  - AUTH_ENABLED=false
```

## 🔒 Security Features

- ✅ Bcrypt password hashing support
- ✅ Secure session cookies (httpOnly)
- ✅ HTTPS-ready (secure cookies when HTTPS enabled)
- ✅ Session expiration (24 hours)
- ✅ Protected WebSocket connections
- ✅ No authentication on login endpoints (prevents lockout)

## 📖 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ENABLED` | `false` | Enable/disable authentication |
| `AUTH_USERNAME` | `admin` | Login username |
| `AUTH_PASSWORD` | `admin` | Login password (plain or bcrypt) |
| `SESSION_SECRET` | `docker-dashboard-secret-change-in-production` | Session encryption key |

## 🎨 Login Page Features

- Modern gradient background
- Glass-morphism design
- Loading animations
- Error handling
- Auto-redirect if already logged in
- Mobile responsive
- Shows default credentials

## 📚 Documentation

Full guide available in: **[AUTHENTICATION.md](AUTHENTICATION.md)**

Covers:
- Setup instructions
- Security best practices
- Bcrypt password generation
- Troubleshooting
- Example configurations
- Testing endpoints

## 🧪 Testing

### Check Auth Status:
```bash
curl http://localhost:1714/api/auth/status
```

### Login:
```bash
curl -X POST http://localhost:1714/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c cookies.txt
```

### Access Protected API:
```bash
curl http://localhost:1714/api/containers -b cookies.txt
```

## ⚠️ Important Notes

1. **Change default password** - Default is `admin:admin`
2. **Use strong session secret** - Generate random string
3. **Use HTTPS in production** - Authentication over HTTP is insecure
4. **Consider bcrypt hashes** - More secure than plain passwords

## 🔧 Advanced Configuration

### Generate Bcrypt Hash:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your_password', 10).then(console.log);"
```

### Generate Session Secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📊 Backward Compatibility

✅ **100% backward compatible**
- Existing deployments work as-is
- Authentication disabled by default
- No breaking changes
- Optional feature

## 🎯 Next Steps

1. ✅ Install dependencies: `npm install` (already done)
2. ✅ Enable authentication in docker-compose.yml
3. ✅ Build and restart: `docker compose up -d --build`
4. ✅ Access and login: http://localhost:1714
5. ✅ Read full guide: [AUTHENTICATION.md](AUTHENTICATION.md)

---

**Commit:** `c637059`  
**Push Status:** ✅ Pushed to GitHub  
**Files Changed:** 8 files, +692 lines

🎉 **Authentication system is ready to use!**
