let expandedContainer = null;       // Only one expanded at a time
let statIntervals = {};            // Track intervals for live updates per container
let charts = {};

function getStatusColor(status) {
  if (status && status.includes('Up') && status.includes('healthy')) return 'bg-green-200 text-green-800';
  if (status && status.includes('Up')) return 'bg-blue-200 text-blue-800';
  return 'bg-red-200 text-red-800';
}
function getStatusText(status) {
  if (status && status.includes('Up') && status.includes('healthy')) return 'Healthy';
  if (status && status.includes('Up')) return 'Running';
  return 'Stopped';
}

function stopStatsUpdates(id) {
  if (statIntervals[id]) {
    clearInterval(statIntervals[id]);
    delete statIntervals[id];
  }
  if (charts[id]) {
    charts[id].cpu.destroy();
    charts[id].ram.destroy();
    charts[id].net.destroy();
    delete charts[id];
  }
}

function fetchStatsAndRender() {
  fetch('/api/containers')
    .then(res => res.json())
    .then(containers => {
      // Build cards
      document.getElementById('stats').innerHTML = containers.map(container => {
        const isExpanded = expandedContainer === container.Id;
        return `
        <div class="glass rounded-2xl p-6 shadow-lg text-white transition relative ${isExpanded ? 'ring-4 ring-indigo-400/40' : ''}">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-lg truncate">${container.Names ? container.Names.join(', ') : container.Id}</span>
            <span class="px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(container.Status)}">
              ${getStatusText(container.Status)}
            </span>
          </div>
          <div class="text-xs text-gray-300 mb-2"><span class="font-semibold">Image:</span> ${container.Image}</div>
          <div class="flex gap-2 mt-2 mb-1">
            <button onclick="expandContainer('${container.Id}')" class="text-xs px-2 py-1 rounded bg-indigo-700 text-white hover:bg-indigo-500
            transition">${isExpanded ? "Hide Stats" : "Show Stats"}</button>
            <button onclick="containerAction('${container.Id}','start')" class="text-xs px-2 py-1 rounded bg-green-500 hover:bg-green-700 text-white transition">Start</button>
            <button onclick="containerAction('${container.Id}','stop')" class="text-xs px-2 py-1 rounded bg-red-500 hover:bg-red-700 text-white transition">Stop</button>
            <button onclick="containerAction('${container.Id}','restart')" class="text-xs px-2 py-1 rounded bg-blue-500 hover:bg-blue-700 text-white transition">Restart</button>
          </div>
          ${isExpanded ? `
            <div id="stats-area-${container.Id}" class="bg-black/20 rounded-xl mt-3 p-4">
              <div class="flex flex-col sm:flex-row gap-4">
                <div class="flex-1">
                  <div class="text-xs text-gray-300 font-semibold mb-1">CPU Usage</div>
                  <span class="block text-xl font-bold mb-1" id="cpu-${container.Id}">--%</span>
                  <canvas id="cpuChart-${container.Id}" height="40"></canvas>
                </div>
                <div class="flex-1">
                  <div class="text-xs text-gray-300 font-semibold mb-1">RAM Usage</div>
                  <span class="block text-xl font-bold mb-1" id="ram-${container.Id}">-- / --</span>
                  <canvas id="ramChart-${container.Id}" height="40"></canvas>
                </div>
                <div class="flex-1">
                  <div class="text-xs text-gray-300 font-semibold mb-1">Network RX/TX</div>
                  <span class="block text-xl font-bold mb-1" id="net-${container.Id}">-- / --</span>
                  <canvas id="netChart-${container.Id}" height="40"></canvas>
                </div>
              </div>
            </div>
          ` : ""}
        </div>`;
      }).join('');
      // Start/stop stat updates
      containers.forEach(container => {
        if (expandedContainer === container.Id) {
          startStatsUpdates(container.Id);
        } else {
          stopStatsUpdates(container.Id);
        }
      });
    });
}

window.expandContainer = function(id) {
  if (expandedContainer === id) {
    stopStatsUpdates(id);
    expandedContainer = null;
  } else {
    // collapse others
    Object.keys(statIntervals).forEach(stopStatsUpdates);
    expandedContainer = id;
  }
  fetchStatsAndRender();
};

window.containerAction = function(id, action) {
  fetch(`/api/containers/${id}/${action}`, { method: 'POST' })
    .then(res => res.json())
    .then(() => {
      fetchStatsAndRender();
      alert(`Action ${action} on container ${id} successful!`);
    })
    .catch(err => alert(`Failed to ${action}: ${err}`));
};

function startStatsUpdates(id) {
  // already has updater?
  if (statIntervals[id]) return;
  // history for chart
  let cpuH=[], ramH=[], netH=[];
  async function pollStats() {
    // poll stats
    const res = await fetch(`/api/containers/${id}/stats`);
    const stats = await res.json();
    // Parse stats (your Docker parse logic as before)
    let cpu = 0, ram=0, ramTotal=1, rx=0, tx=0;
    try {
      if (stats.cpu_stats && stats.precpu_stats) {
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuCount = stats.cpu_stats.online_cpus || 1;
        if (cpuDelta > 0 && sysDelta > 0) {
          cpu = ((cpuDelta / sysDelta) * cpuCount * 100);
        }
      }
      if (stats.memory_stats && stats.memory_stats.usage) {
        ram = stats.memory_stats.usage / 1024 / 1024 / 1024;
        ramTotal = stats.memory_stats.limit / 1024 / 1024 / 1024;
      }
      if (stats.networks) {
        let totalRx = 0, totalTx = 0;
        Object.values(stats.networks).forEach(nw => {
          totalRx += nw.rx_bytes || 0;
          totalTx += nw.tx_bytes || 0;
        });
        rx = totalRx / 1024;
        tx = totalTx / 1024;
      }
    } catch(e) {}

    // keep short history
    cpuH.push(cpu); if (cpuH.length>15) cpuH.shift();
    ramH.push(ram); if (ramH.length>15) ramH.shift();
    netH.push(rx); if (netH.length>15) netH.shift();

    // Update stats UI
    const cpuEL = document.getElementById(`cpu-${id}`);
    const ramEL = document.getElementById(`ram-${id}`);
    const netEL = document.getElementById(`net-${id}`);
    if(cpuEL) cpuEL.textContent = `${cpu.toFixed(1)}%`;
    if(ramEL) ramEL.textContent = `${ram.toFixed(2)} / ${ramTotal.toFixed(2)} GB`;
    if(netEL) netEL.textContent = `↑ ${rx.toFixed(1)} KB/s ↓ ${tx.toFixed(1)} KB/s`;

    // Render charts (handle repeated creation)
    if(!charts[id]) {
      charts[id] = {
        cpu: new Chart(document.getElementById(`cpuChart-${id}`), {
          type: 'line',
          data: { labels:Array(cpuH.length).fill(''), datasets:[{label:"CPU",data:cpuH,borderColor:"#3b82f6",backgroundColor:"rgba(59,130,246,.11)",fill:true,tension:.45}] },
          options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{display:false},y:{display:false,min:0,max:100}}}
        }),
        ram: new Chart(document.getElementById(`ramChart-${id}`), {
          type: 'line',
          data: { labels:Array(ramH.length).fill(''), datasets:[{label:"RAM",data:ramH,borderColor:"#10b981",backgroundColor:"rgba(16,185,129,.15)",fill:true,tension:.45}] },
          options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false,min:0}}}
        }),
        net: new Chart(document.getElementById(`netChart-${id}`), {
          type: 'line',
          data:{labels:Array(netH.length).fill(''),datasets:[{label:"NET",data:netH,borderColor:"#fde047",backgroundColor:"rgba(250,204,21,.09)",fill:true,tension:.45}]},
          options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false,min:0}}}
        }),
      };
    } else {
      charts[id].cpu.data.datasets[0].data = cpuH;
      charts[id].cpu.update('none');
      charts[id].ram.data.datasets[0].data = ramH;
      charts[id].ram.update('none');
      charts[id].net.data.datasets[0].data = netH;
      charts[id].net.update('none');
    }
  }
  pollStats(); // initial
  statIntervals[id] = setInterval(pollStats, 2000);
}

// Initial boot
window.onload = fetchStatsAndRender;
