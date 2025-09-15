const DEFAULT_CONFIG = {
	apiBase: '', // empty means same origin
	defaultInterval: 1000
};

function loadConfig() {
	try {
		const raw = localStorage.getItem('dockerDashConfig');
		if (raw) return Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
	} catch (e) {}
	return Object.assign({}, DEFAULT_CONFIG);
}

function saveConfig(cfg) {
	localStorage.setItem('dockerDashConfig', JSON.stringify(cfg));
}

async function fetchContainers() {
	const cfg = loadConfig();
	const url = cfg.apiBase ? `${cfg.apiBase.replace(/\/$/, '')}/api/containers` : '/api/containers';
	const res = await fetch(url);
	return await res.json();
}

// Create a reconnecting WebSocket with exponential backoff.
// onMessage will be called for parsed JSON messages. onStatus(statusString) is optional and receives 'CONNECTING'|'OPEN'|'CLOSED'|'ERROR'.
function createReconnectWS(path, id, onMessage, onStatus) {
	const cfg = loadConfig();
	const baseStr = cfg.apiBase && cfg.apiBase.trim() ? cfg.apiBase.replace(/\/$/, '') : window.location.origin;
	let baseUrl;
	try { baseUrl = new URL(baseStr); } catch (e) { baseUrl = new URL(window.location.origin); }
	const wsProtocol = (baseUrl.protocol === 'https:' ? 'wss:' : 'ws:');
	const basePath = baseUrl.pathname.replace(/\/$/, '');
	const hostAndPort = baseUrl.host; // hostname[:port]
	const wsUrl = `${wsProtocol}//${hostAndPort}${basePath}/ws${path}?id=${encodeURIComponent(id)}`;

	let ws = null;
	let shouldStop = false;
	let attempt = 0;

	function setStatus(s) { if (typeof onStatus === 'function') onStatus(s); }

	function connect() {
		if (shouldStop) return;
		attempt += 1;
		setStatus('CONNECTING');
		ws = new WebSocket(wsUrl);
		ws.onopen = () => {
			attempt = 0; // reset backoff
			setStatus('OPEN');
		};
		ws.onmessage = e => {
			try { onMessage(JSON.parse(e.data)); } catch (err) { console.warn('Failed to parse WS message', err); }
		};
		ws.onerror = (e) => {
			console.warn('WS error', e);
			setStatus('ERROR');
		};
		ws.onclose = () => {
			setStatus('CLOSED');
			if (shouldStop) return;
			// exponential backoff: cap at 30s
			const delay = Math.min(30000, Math.pow(2, Math.min(attempt, 6)) * 1000);
			setTimeout(connect, delay);
		};
	}

	// kick off
	connect();

	return {
		send: (obj) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); },
		close: () => { shouldStop = true; if (ws) ws.close(); }
	};
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

		// Stats WebSocket (reconnecting)
		const badge = document.createElement('div');
		badge.className = 'ws-badge';
		badge.textContent = 'CONNECTING';
		badge.style.fontSize = '0.8em';
		badge.style.marginTop = '6px';
		card.appendChild(badge);

		const statsWs = createReconnectWS('/stats', container.Id, stats => {
			try {
				card.querySelector('.stats').textContent = `CPU: ${Number(stats.cpu_percent || 0).toFixed(2)}% | Mem: ${stats.memory_stats?.usage || 'N/A'} bytes`;
			} catch (e) {
				console.warn('Failed to render stats', e);
			}
		}, status => {
			badge.textContent = status;
			if (status === 'OPEN') badge.style.color = '#8ef';
			if (status === 'CLOSED' || status === 'ERROR') badge.style.color = '#f88';
			if (status === 'CONNECTING') badge.style.color = '#888';
		});

		// store websocket handle so we can update interval later
		window._dockerDashboardStats = window._dockerDashboardStats || new Map();
		window._dockerDashboardStats.set(container.Id, statsWs);

		// send initial interval (createReconnectWS exposes .send)
		const initialIntervalMs = parseInt(document.getElementById('refresh-interval').value, 10) || 1000;
		statsWs.send({ type: 'interval', interval: initialIntervalMs });

		// Logs WebSocket (reconnecting)
		const logsHandle = createReconnectWS('/logs', container.Id, logs => {
			card.querySelector('.logs').textContent = logs.log || logs.error || 'No logs';
		});
	});
}

// simple router
function mountDashboard() {
	const root = document.getElementById('app-root');
	root.innerHTML = `
		<div style="margin-bottom:1em;">
			<label for="refresh-interval">Stats refresh rate:</label>
			<select id="refresh-interval">
				<option value="1000">1s</option>
				<option value="2000">2s</option>
				<option value="3000">3s</option>
				<option value="5000">5s</option>
				<option value="10000">10s</option>
			</select>
		</div>
		<div id="container-grid"></div>
	`;
	const cfg = loadConfig();
	document.getElementById('refresh-interval').value = String(cfg.defaultInterval || 1000);
	fetchContainers().then(renderContainers);
	document.getElementById('refresh-interval').addEventListener('change', (e) => {
		const ms = parseInt(e.target.value, 10) || 1000;
		if (window._dockerDashboardStats) {
			for (const ws of window._dockerDashboardStats.values()) {
				if (ws && ws.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ type: 'interval', interval: ms }));
				}
			}
		}
		// persist default
		const cfg = loadConfig(); cfg.defaultInterval = ms; saveConfig(cfg);
	});
}

function mountConfig() {
	const root = document.getElementById('app-root');
	const cfg = loadConfig();
	root.innerHTML = `
		<h2>Config</h2>
		<form id="config-form">
			<label>API Base URL (leave empty for same origin)</label>
			<input type="text" id="apiBase" value="${cfg.apiBase || ''}" style="width:100%" />
			<label>Default refresh interval (ms)</label>
			<input type="number" id="defaultInterval" value="${cfg.defaultInterval}" />
			<div style="margin-top:8px">
				<button type="submit">Save</button>
				<button type="button" id="exportConfig">Export</button>
				<button type="button" id="importConfig">Import</button>
			</div>
			<p style="color:#f88">Do not store secrets or API keys here. Browser storage is not secure.</p>
		</form>
	`;
	document.getElementById('config-form').addEventListener('submit', (ev) => {
		ev.preventDefault();
		const newCfg = { apiBase: document.getElementById('apiBase').value.trim(), defaultInterval: Number(document.getElementById('defaultInterval').value) || 1000 };
		saveConfig(newCfg);
		alert('Saved');
	});
	document.getElementById('exportConfig').addEventListener('click', () => {
		const data = localStorage.getItem('dockerDashConfig') || '{}';
		navigator.clipboard.writeText(data).then(()=>alert('Config copied to clipboard'));
	});
	document.getElementById('importConfig').addEventListener('click', async () => {
		const text = prompt('Paste config JSON');
		try { const parsed = JSON.parse(text); saveConfig(parsed); alert('Imported'); } catch (e) { alert('Invalid JSON'); }
	});
}

function navigate(route) {
	if (route === 'config') mountConfig(); else mountDashboard();
}

document.addEventListener('click', (e) => {
	const btn = e.target.closest && e.target.closest('.nav-btn');
	if (btn) {
		const route = btn.getAttribute('data-route');
		navigate(route);
	}
});

// initial route
navigate('dashboard');
