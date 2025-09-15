const stats = require('./stats');
const logs = require('./logs');

function handleConnection(ws, req) {
	const url = new URL(req.url, `http://${req.headers.host}`);
	if (url.pathname === '/ws/stats') {
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

module.exports = { handleConnection };
