function fetchStats() {
  fetch('/api/containers')
    .then(res => res.json())
    .then(data => {
      const statsDiv = document.getElementById('stats');
      if (!Array.isArray(data)) {
        statsDiv.innerHTML = '<p>No container data found.</p>';
        return;
      }
      statsDiv.innerHTML = data.map(container => `
        <div class="bg-white p-4 rounded-lg shadow hover:shadow-lg transition cursor-pointer"
             onclick="showStatsModal('${container.Id}', '${container.Names ? container.Names.join(', ') : container.Id}')">
          <div class="flex items-center mb-2">
            <span class="font-semibold text-lg text-blue-900">${container.Names ? container.Names.join(', ') : container.Id}</span>
            <span class="ml-auto px-2 py-1 text-xs rounded ${container.Status.includes('Up') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
              ${container.Status}
            </span>
          </div>
          <div class="text-gray-700">
            <span class="font-medium text-gray-500">Image:</span> ${container.Image}
          </div>
        </div>
      `).join('');
    })
    .catch(err => {
      document.getElementById('stats').innerHTML = `<p class="text-red-600">Error fetching stats: ${err}</p>`;
    });
}
window.onload = fetchStats;

// Modal handling code

function showStatsModal(containerId, containerName) {
  document.getElementById('stats-modal').classList.remove('hidden');
  document.getElementById('modal-title').innerText = containerName || containerId;
  document.getElementById('modal-content').innerHTML = '<p class="text-gray-400">Loading...</p>';

  fetch(`/api/containers/${containerId}/stats`)
    .then(res => res.json())
    .then(stats => {
      document.getElementById('modal-content').innerHTML = `
        <div>
          <div class="mb-2"><span class="font-semibold">CPU:</span> ${formatCPU(stats)}%</div>
          <div class="mb-2"><span class="font-semibold">RAM:</span> ${formatBytes(stats.memory_stats.usage)} / ${formatBytes(stats.memory_stats.limit)}</div>
          <div class="mb-2"><span class="font-semibold">Disk:</span> ${formatDisk(stats)}</div>
          <div class="mb-2"><span class="font-semibold">Network:</span> ${formatNetwork(stats)}</div>
        </div>
      `;
    })
    .catch(err => {
      document.getElementById('modal-content').innerHTML = `<p class="text-red-600">Failed to load stats: ${err}</p>`;
    });
}

function closeStatsModal() {
  document.getElementById('stats-modal').classList.add('hidden');
}

// Helpers
function formatBytes(bytes) {
  if (bytes === 0 || isNaN(bytes)) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}
function formatCPU(stats) {
  if (!stats.cpu_stats || !stats.precpu_stats) return '?';
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus || 1;
  if (cpuDelta && sysDelta) {
    return ((cpuDelta / sysDelta) * cpuCount * 100).toFixed(2);
  }
  return '?';
}
function formatDisk(stats) {
  if (stats.storage_stats && stats.storage_stats.size) {
    return formatBytes(stats.storage_stats.size);
  }
  return 'N/A';
}
function formatNetwork(stats) {
  if (stats.networks) {
    let rx = 0, tx = 0;
    Object.values(stats.networks).forEach(nw => {
      rx += nw.rx_bytes || 0;
      tx += nw.tx_bytes || 0;
    });
    return `↓ ${formatBytes(rx)} / ↑ ${formatBytes(tx)}`;
  }
  return 'N/A';
}
