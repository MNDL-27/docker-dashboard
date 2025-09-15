const proxy = require('../docker/proxy');

async function streamStats(ws, id) {
	let closed = false;
	let intervalMs = 1000; // default 1s
	ws.on('close', () => { closed = true; });
	ws.on('message', (msg) => {
		try {
			const data = JSON.parse(msg.toString());
			if (data.type === 'interval') {
				const requested = Number(data.interval) || 1000;
				// clamp between 1000 and 10000
				intervalMs = Math.min(10000, Math.max(1000, requested));
			}
		} catch (e) {
			// ignore bad messages
		}
	});

	try {
		while (!closed) {
			try {
				// request a single snapshot instead of streaming
				const result = await proxy.requestDockerAPI(`/containers/${id}/stats?stream=0`);
				const payload = (result && result.data) ? result.data : { error: 'No data' };
				if (!closed) ws.send(JSON.stringify(payload));
			} catch (err) {
				if (!closed) ws.send(JSON.stringify({ error: err.message }));
			}
			// wait for interval
			await new Promise(res => setTimeout(res, intervalMs));
		}
	} catch (e) {
		// ws closed or other
	}
}

module.exports = { streamStats };
