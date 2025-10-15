// server/index.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const compression = require('compression');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const containersRoute = require('./routes/containers');
const qbittorrentRoute = require('./routes/qbittorrent');
const authRoute = require('./routes/auth');
const { requireAuth, isAuthEnabled } = require('./middleware/auth');
const wsHandlers = require('./sockets');
const path = require('path');
const config = require('./config/defaults');
const { validateEnv } = require('./config/schema');
try {
	validateEnv(config);
} catch (err) {
	console.error(err.message);
	process.exit(1);
}
const app = express();

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Trust proxy if behind reverse proxy (for rate limiting)
if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip X-Forwarded-For validation if not behind a proxy
    validate: false
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'docker-dashboard-secret-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.HTTPS === 'true',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(compression());
app.use(express.json());

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Basic request logging with request ID
app.use((req, res, next) => {
    req.id = require('crypto').randomUUID();
    res.setHeader('X-Request-ID', req.id);
    console.log(`[${req.id}] [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('../package.json').version
    });
});

// Auth routes (no auth required for these)
app.use('/api/auth', authRoute);

// Protected API routes
app.use('/api/containers', requireAuth, containersRoute);
app.use('/api/qbittorrent', requireAuth, qbittorrentRoute);

// Serve static files with cache control
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    // Disable caching for HTML files to always get fresh content
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Protect all pages except login
app.use((req, res, next) => {
    // Allow login page and static assets
    if (req.path === '/login.html' || req.path.startsWith('/api/auth')) {
        return next();
    }
    requireAuth(req, res, next);
});

const server = http.createServer(app);
// Log raw upgrade attempts to help debug WebSocket handshakes (Cloudflared/tunnel visibility)
// Optional raw upgrade logging to help debug WebSocket handshakes (Cloudflared/tunnel visibility)
// Controlled by env var DEBUG_UPGRADE (set to 'true' to enable).
server.on('upgrade', (req, socket, head) => {
    if (process.env.DEBUG_UPGRADE === 'true') {
        console.log(`[${new Date().toISOString()}] HTTP upgrade attempt: ${req.url}`);
        // log a few headers that matter for WebSocket
        console.log('  upgrade headers:', {
            connection: req.headers['connection'],
            upgrade: req.headers['upgrade'],
            host: req.headers['host'],
            origin: req.headers['origin']
        });
    }
});
let httpsServer;
if (process.env.HTTPS === 'true') {
    const fs = require('fs');
    const https = require('https');
    const sslOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/ssl/private/key.pem'),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/ssl/certs/cert.pem'),
    };
    httpsServer = https.createServer(sslOptions, app);
}
const wssStats = new WebSocket.Server({ server: process.env.HTTPS === 'true' ? httpsServer : server, path: '/ws/stats' });
const wssLogs = new WebSocket.Server({ server: process.env.HTTPS === 'true' ? httpsServer : server, path: '/ws/logs' });
wssStats.on('connection', (ws, req) => {
    console.log(`[${new Date().toISOString()}] WS connection: ${req.url}`);
    wsHandlers.handleConnection(ws, req);
});
wssLogs.on('connection', (ws, req) => {
    console.log(`[${new Date().toISOString()}] WS connection: ${req.url}`);
    wsHandlers.handleConnection(ws, req);
});
const PORT = config.PORT;
if (process.env.HTTPS === 'true') {
    httpsServer.listen(PORT, () => {
        console.log(`HTTPS server listening on port ${PORT}`);
    });
    httpsServer.on('upgrade', (req, socket, head) => {
        if (process.env.DEBUG_UPGRADE === 'true') {
            console.log(`[${new Date().toISOString()}] HTTPS upgrade attempt: ${req.url}`);
            console.log('  upgrade headers:', {
                connection: req.headers['connection'],
                upgrade: req.headers['upgrade'],
                host: req.headers['host'],
                origin: req.headers['origin']
            });
        }
    });
} else {
    server.listen(PORT, () => {
        console.log(`HTTP server listening on port ${PORT}`);
    });
}
// Basic error logging
process.on('uncaughtException', err => {
	console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', err => {
	console.error('Unhandled Rejection:', err);
});