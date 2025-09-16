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
        <div class="container-card">
          <h2>${container.Names ? container.Names.join(', ') : container.Id}</h2>
          <p><strong>Image:</strong> ${container.Image}</p>
          <p><strong>Status:</strong> ${container.Status}</p>
        </div>
      `).join('');
    })
    .catch(err => {
      document.getElementById('stats').innerHTML = `<p style="color:red;">Error fetching stats: ${err}</p>`;
    });
}
window.onload = fetchStats;
