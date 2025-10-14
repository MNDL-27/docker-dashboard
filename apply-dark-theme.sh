# Dark Professional Theme for Docker Dashboard
# Run this script on your Ubuntu server to update the design

cat > /tmp/dark-index.html << 'HTMLEOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Docker Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body { 
      background: linear-gradient(to bottom, #1a202c 0%, #2d3748 100%);
      min-height: 100vh;
      overflow-x: hidden;
    }
    .card {
      background: rgba(45, 55, 72, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      transition: all 0.3s ease;
    }
    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      animation: pulse 2s infinite;
    }
    .status-running {
      background: #48bb78;
      box-shadow: 0 0 8px #48bb78;
    }
    .status-exited {
      background: #f56565;
      box-shadow: 0 0 8px #f56565;
    }
    .badge {
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .badge-running {
      background: rgba(72, 187, 120, 0.2);
      color: #48bb78;
      border: 1px solid rgba(72, 187, 120, 0.3);
    }
    .badge-exited {
      background: rgba(245, 101, 101, 0.2);
      color: #f56565;
      border: 1px solid rgba(245, 101, 101, 0.3);
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  </style>
</head>
<body class="p-6">
  <header class="max-w-7xl mx-auto mb-8">
    <div class="text-center space-y-3">
      <div class="flex items-center justify-center gap-3">
        <svg class="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
        </svg>
        <h1 class="text-4xl font-bold text-white">Docker Dashboard</h1>
      </div>
      <p class="text-gray-400 text-base">A modern dashboard for your containers.</p>
    </div>
  </header>

  <div id="loading" class="text-center py-20">
    <div class="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    <p class="text-gray-400 mt-4">Loading containers...</p>
  </div>

  <main class="max-w-7xl mx-auto">
    <div id="stats" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"></div>
    <div id="empty-state" class="hidden text-center py-20">
      <svg class="w-20 h-20 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
      </svg>
      <h3 class="text-xl font-bold text-gray-400 mb-2">No containers found</h3>
      <p class="text-gray-500">Start some Docker containers to see them here</p>
    </div>
  </main>

  <script>
    function getStatusBadge(state) {
      if (state === 'running') {
        return { class: 'badge-running', dot: 'status-running', text: 'Running' };
      } else {
        return { class: 'badge-exited', dot: 'status-exited', text: 'Exited' };
      }
    }

    function formatUptime(status) {
      if (!status) return '';
      const match = status.match(/Up\s+(.+?)(\s+\(|$)/);
      if (match) return match[1];
      const exitMatch = status.match(/Exited.*?(\d+\s+\w+\s+ago)/);
      return exitMatch ? exitMatch[1] : '';
    }

    function renderContainers(containers) {
      const loading = document.getElementById('loading');
      const statsDiv = document.getElementById('stats');
      const emptyState = document.getElementById('empty-state');
      
      loading.classList.add('hidden');

      if (!containers || containers.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      }

      statsDiv.innerHTML = '';
      
      containers.forEach(container => {
        const status = getStatusBadge(container.State);
        const uptime = formatUptime(container.Status);
        const truncImage = container.Image.length > 25 ? container.Image.substring(0, 22) + '...' : container.Image;
        
        const card = document.createElement('div');
        card.className = 'card p-4';
        card.innerHTML = `
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <h3 class="text-white font-semibold text-base truncate" title="${container.Names}">${container.Names}</h3>
              <p class="text-gray-400 text-sm mt-1 truncate" title="${container.Image}">${truncImage}</p>
            </div>
            <span class="badge ${status.class} ml-2 flex-shrink-0">
              <span class="status-dot ${status.dot}"></span>
              ${status.text}
            </span>
          </div>
          ${uptime ? `<p class="text-gray-500 text-xs mb-3">${uptime}</p>` : ''}
          <button onclick="window.location.href='container.html?id=${container.Id}'" 
                  class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors">
            Show Stats
          </button>
        `;
        statsDiv.appendChild(card);
      });
    }

    async function fetchContainers() {
      try {
        const res = await fetch('/api/containers');
        const containers = await res.json();
        renderContainers(containers);
      } catch (err) {
        document.getElementById('loading').innerHTML = `
          <div class="text-red-400">
            <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <p class="text-lg font-medium">Error loading containers</p>
            <p class="text-sm text-gray-500 mt-2">${err.message}</p>
          </div>
        `;
      }
    }

    fetchContainers();
    setInterval(fetchContainers, 5000);
  </script>
</body>
</html>
HTMLEOF

# Backup current file and replace
cd ~/software/docker-dashboard
cp public/index.html public/index.html.backup
cp /tmp/dark-index.html public/index.html

# Restart Docker container to pick up changes
docker compose down
docker compose up -d

echo "✅ Dark theme applied! Refresh your browser."
