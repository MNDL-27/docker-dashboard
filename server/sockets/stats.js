const proxy = require('../docker/proxy');

async function streamStats(ws, id) {
	let closed = false;
	ws.on('close', () => { closed = true; });
	try {
		const result = await proxy.requestDockerAPI(`/containers/${id}/stats?stream=1`);
		if (typeof result.data === 'string') {
			result.data.split('\n').forEach(line => {
				if (!closed && line.trim()) ws.send(line);
			});
		} else {
			if (!closed) ws.send(JSON.stringify(result.data));
		}
	} catch (err) {
		if (!closed) ws.send(JSON.stringify({ error: err.message }));
	}
}

module.exports = { streamStats };
