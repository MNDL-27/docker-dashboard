const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const compression = require('compression');
const containersRoute = require('./routes/containers');
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
app.use(compression());
app.use(express.json());

// Basic request logging
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
	next();
});

app.use('/api/containers', containersRoute);
app.use(express.static(path.join(__dirname, '../public')));

const server = http.createServer(app);
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
