const proxy = require('../docker/proxy');

async function streamLogs(ws, id) {
	let closed = false;
	ws.on('close', () => { closed = true; });
	try {
		const result = await proxy.requestDockerAPI(`/containers/${id}/logs?follow=1&stdout=1&stderr=1&tail=200`);
		if (typeof result.data === 'string') {
			result.data.split('\n').forEach(line => {
				if (!closed && line.trim()) ws.send(JSON.stringify({ log: line }));
			});
		} else {
			if (!closed) ws.send(JSON.stringify({ log: result.data }));
		}
	} catch (err) {
		if (!closed) ws.send(JSON.stringify({ error: err.message }));
	}
}

module.exports = { streamLogs };
