const proxy = require('../docker/proxy');
const engine = require('../docker/engineClient');

function streamLogs(ws, id) {
	let closed = false;
	let reqHandle = null;
	ws.on('close', () => { closed = true; if (reqHandle && reqHandle.abort) try { reqHandle.abort(); } catch (e) {} });

	// Try using engineClient streaming which forwards chunks as they arrive
	try {
		reqHandle = engine.streamContainerLogs(id, {
			onData: (chunk) => {
				if (closed) return;
				try {
					// chunk may be a Buffer; convert and split into lines
					const text = chunk.toString('utf8');
					text.split('\n').forEach(line => {
						if (line && line.trim()) {
							try { ws.send(JSON.stringify({ log: line })); } catch (e) {}
						}
					});
				} catch (e) {
					try { ws.send(JSON.stringify({ error: 'Failed to process log chunk' })); } catch (e) {}
				}
			},
			onEnd: () => { if (!closed) try { ws.send(JSON.stringify({ info: 'log stream ended' })); } catch (e) {} },
			onError: (err) => { if (!closed) try { ws.send(JSON.stringify({ error: String(err && err.message ? err.message : err) })); } catch (e) {} }
		});
	} catch (err) {
		// Fallback: try a single request via proxy (non-follow)
		(async () => {
			try {
				const result = await proxy.requestDockerAPI(`/containers/${id}/logs?stdout=1&stderr=1&tail=200`);
				if (typeof result.data === 'string') {
					result.data.split('\n').forEach(line => { if (!closed && line.trim()) ws.send(JSON.stringify({ log: line })); });
				} else {
					if (!closed) ws.send(JSON.stringify({ log: result.data }));
				}
			} catch (err2) {
				if (!closed) ws.send(JSON.stringify({ error: err2.message }));
			}
		})();
	}
}

module.exports = { streamLogs };
