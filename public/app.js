async function fetchContainers() {
	const res = await fetch('/api/containers');
	return await res.json();
}

function createWS(path, id, onMessage) {
	const ws = new WebSocket(`${window.location.origin.replace('http', 'ws')}/ws${path}?id=${id}`);
	ws.onmessage = e => onMessage(JSON.parse(e.data));
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
		createWS('/stats', container.Id, stats => {
			card.querySelector('.stats').textContent = `CPU: ${stats.cpu_percent?.toFixed(2) || 'N/A'}% | Mem: ${stats.memory_stats?.usage || 'N/A'} bytes`;
		});
		// Logs WebSocket
		createWS('/logs', container.Id, logs => {
			card.querySelector('.logs').textContent = logs.log || logs.error || 'No logs';
		});
	});
}

fetchContainers().then(renderContainers);
