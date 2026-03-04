const proxy = require('../docker/proxy');
const engine = require('../docker/engineClient');

function streamLogs(ws, id) {
	let closed = false;
	let reqHandle = null;
	ws.on('close', () => { 
		closed = true; 
		if (reqHandle && reqHandle.abort) {
			try { 
				reqHandle.abort(); 
			} catch (e) {
				// Ignore abort errors
			}
		}
	});

	// Try using engineClient streaming which forwards chunks as they arrive
	try {
		reqHandle = engine.streamContainerLogs(id, {
			onData: (chunk) => {
				if (closed) return;
				try {
					// chunk may be a Buffer; convert and split into lines
					const text = chunk.toString('utf8');
					const lines = text.split('\n');
					for (let i = 0; i < lines.length; i++) {
						const line = lines[i];
						if (line && line.trim()) {
							try {
								ws.send(JSON.stringify({ log: line }));
							} catch (sendErr) {
								// Connection closed, ignore
							}
						}
					}
				} catch (e) {
					try {
						ws.send(JSON.stringify({ error: 'Failed to process log chunk' }));
					} catch (sendErr) {
						// Connection closed, ignore
					}
				}
			},
			onEnd: () => { 
				if (!closed) {
					try { 
						ws.send(JSON.stringify({ info: 'log stream ended' })); 
					} catch (e) {
						// Ignore send errors
					}
				}
			},
			onError: (err) => { 
				if (!closed) {
					try { 
						ws.send(JSON.stringify({ error: String(err && err.message ? err.message : err) })); 
					} catch (e) {
						// Ignore send errors
					}
				}
			}
		});
	} catch (err) {
		// Fallback: try a single request via proxy (non-follow)
		(async () => {
			try {
				const result = await proxy.requestDockerAPI(`/containers/${id}/logs?stdout=1&stderr=1&tail=200`);
				if (typeof result.data === 'string') {
					const lines = result.data.split('\n');
					for (let i = 0; i < lines.length; i++) {
						const line = lines[i];
						if (!closed && line.trim()) {
							try {
								ws.send(JSON.stringify({ log: line }));
							} catch (sendErr) {
								// Connection closed, ignore
							}
						}
					}
				} else {
					if (!closed) {
						try {
							ws.send(JSON.stringify({ log: result.data }));
						} catch (sendErr) {
							// Connection closed, ignore
						}
					}
				}
			} catch (err2) {
				if (!closed) {
					try {
						ws.send(JSON.stringify({ error: err2.message }));
					} catch (sendErr) {
						// Connection closed, ignore
					}
				}
			}
		})();
	}
}

module.exports = { streamLogs };
