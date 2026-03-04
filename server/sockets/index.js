const stats = require('./stats');
const logs = require('./logs');
const statsHub = require('../statsHub');
const { isAuthEnabled } = require('../middleware/auth');

function handleConnection(ws, req) {
	// Check authentication for WebSocket connections
	// Parse cookies manually for WebSocket connections
	if (isAuthEnabled()) {
		const cookies = parseCookies(req.headers.cookie || '');
		const sessionId = cookies['connect.sid'];
		
		if (!sessionId) {
			ws.send(JSON.stringify({ error: 'Authentication required' }));
			ws.close();
			return;
		}
		// Note: Full session validation would require session store access
		// For now, we check if session cookie exists
	}

	const url = new URL(req.url, `http://${req.headers.host}`);
	if (url.pathname === '/ws/containers') {
		// New endpoint: stream stats for ALL containers
		handleContainersWS(ws);
	} else if (url.pathname === '/ws/stats') {
		const id = url.searchParams.get('id');
		if (!id) {
			ws.send(JSON.stringify({ error: 'Missing container id' }));
			ws.close();
			return;
		}
		stats.streamStats(ws, id);
	} else if (url.pathname === '/ws/logs') {
		const id = url.searchParams.get('id');
		if (!id) {
			ws.send(JSON.stringify({ error: 'Missing container id' }));
			ws.close();
			return;
		}
		logs.streamLogs(ws, id);
	} else {
		ws.send(JSON.stringify({ error: 'Unknown WS path' }));
		ws.close();
	}
}

function parseCookies(cookieHeader) {
	const cookies = {};
	if (cookieHeader) {
		cookieHeader.split(';').forEach(cookie => {
			const parts = cookie.trim().split('=');
			const key = decodeURIComponent(parts[0]);
			const value = decodeURIComponent(parts.slice(1).join('='));
			cookies[key] = value;
		});
	}
	return cookies;
}

/**
 * Handle WebSocket connection for all-container stats streaming
 */
function handleContainersWS(ws) {
	console.log('[WS] Client connected to /ws/containers');
	
	// Register client with statsHub
	statsHub.addClient(ws);
	
	// Handle client messages (for future configuration)
	ws.on('message', (msg) => {
		try {
			const data = JSON.parse(msg.toString());
			// Could handle: { type: 'setInterval', value: 5000 }
			// For now, we just log it
			console.log('[WS] Received message:', data);
		} catch (err) {
			// Ignore bad messages
		}
	});
	
	// Clean up on close
	ws.on('close', () => {
		console.log('[WS] Client disconnected from /ws/containers');
		statsHub.removeClient(ws);
	});
	
	ws.on('error', (err) => {
		console.error('[WS] Error:', err.message);
		statsHub.removeClient(ws);
	});
}

module.exports = { handleConnection };
