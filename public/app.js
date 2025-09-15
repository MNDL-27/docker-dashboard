async function fetchContainers() {
	const res = await fetch('/api/containers');
	return await res.json();
}

function createWS(path, id, onMessage) {
	const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
	const ws = new WebSocket(`${protocol}://${window.location.host}/ws${path}?id=${id}`);
	ws.onmessage = e => onMessage(JSON.parse(e.data));
	ws.onerror = e => console.warn('WS error', e);
	return ws;
}

function renderContainers(containers) {
	const grid = document.getElementById('container-grid');
	grid.innerHTML = '';
	containers.forEach(container => {
		const card = document.createElement('div');
		card.className = 'container-card';
		card.innerHTML = `<h2>${container.Names[0]}</h2>
			<div class="stats">Loading stats...</div>
			<div class="logs">Loading logs...</div>`;
		grid.appendChild(card);

		// Stats WebSocket
		const statsWs = createWS('/stats', container.Id, stats => {
			try {
				card.querySelector('.stats').textContent = `CPU: ${Number(stats.cpu_percent || 0).toFixed(2)}% | Mem: ${stats.memory_stats?.usage || 'N/A'} bytes`;
			} catch (e) {
				console.warn('Failed to render stats', e);
			}
		});
		// add ws status badge
		const badge = document.createElement('div');
		badge.className = 'ws-badge';
		badge.textContent = 'CONNECTING';
		badge.style.fontSize = '0.8em';
		badge.style.marginTop = '6px';
		card.appendChild(badge);
		statsWs.addEventListener('open', () => { badge.textContent = 'OPEN'; badge.style.color = '#8ef'; });
		statsWs.addEventListener('close', () => { badge.textContent = 'CLOSED'; badge.style.color = '#f88'; });
		statsWs.addEventListener('error', () => { badge.textContent = 'ERROR'; badge.style.color = '#f88'; });
		// send initial interval when open
		statsWs.addEventListener('open', () => {
			const ms = parseInt(document.getElementById('refresh-interval').value, 10) || 1000;
			statsWs.send(JSON.stringify({ type: 'interval', interval: ms }));
		});
		// store websocket so we can update interval later
		window._dockerDashboardStats = window._dockerDashboardStats || new Map();
		window._dockerDashboardStats.set(container.Id, statsWs);
		// Logs WebSocket
		createWS('/logs', container.Id, logs => {
			card.querySelector('.logs').textContent = logs.log || logs.error || 'No logs';
		});
	});
}

fetchContainers().then(renderContainers);

// refresh interval control
document.getElementById('refresh-interval').addEventListener('change', (e) => {
	const ms = parseInt(e.target.value, 10) || 1000;
	if (window._dockerDashboardStats) {
		for (const ws of window._dockerDashboardStats.values()) {
			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'interval', interval: ms }));
			}
		}
	}
});
