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
        <div class="bg-white p-4 rounded-lg shadow hover:shadow-lg transition">
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