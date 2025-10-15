const express = require('express');
const router = express.Router();
const proxy = require('../docker/proxy');
const Docker = require('dockerode');
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

// --- METRICS HISTORY SUPPORT ---
const METRICS_WINDOW = 300; // e.g. 300 points = 10 minutes if polled every 2s
const metricsHistory = {};  // { [containerId]: [{ time, cpu, ram, rx, tx, disk, ramTotal }, ...] }

function saveContainerMetrics(id, stats, info) {
  let cpu=0, ram=0, rx=0, tx=0, disk=0, ramTotal=1;
  try {
    if(stats.cpu_stats && stats.precpu_stats) {
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuCount = stats.cpu_stats.online_cpus||1;
      if(cpuDelta > 0 && sysDelta > 0) cpu = ((cpuDelta/sysDelta)*cpuCount*100);
    }
    if(stats.memory_stats && stats.memory_stats.usage) {
      ram = stats.memory_stats.usage / 1024 / 1024 / 1024;
      ramTotal = stats.memory_stats.limit / 1024 / 1024 / 1024;
    }
    if(stats.networks) {
      for (const nw of Object.values(stats.networks)) {
        rx += nw.rx_bytes || 0;
        tx += nw.tx_bytes || 0;
      }
    }
    if(info && info.SizeRw) disk = info.SizeRw / 1024 / 1024 / 1024;
  } catch(e) {}
  if(!metricsHistory[id]) metricsHistory[id] = [];
  metricsHistory[id].push({
    time: Date.now(),
    cpu, ram, ramTotal, rx, tx, disk
  });
  if (metricsHistory[id].length > METRICS_WINDOW) metricsHistory[id].shift();
}

// --- DISK USAGE / CONTAINER INFO ENDPOINT ---
// This must come FIRST!
router.get('/:id/json', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect({ size: true });
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- STATS ROUTE ---
router.get('/:id/stats', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await proxy.requestDockerAPI(`/containers/${id}/stats?stream=0`);
    
    // Only fetch disk info if explicitly requested (to reduce load)
    const includeHistory = req.query.history === 'true';
    let info = null;
    if (includeHistory) {
      const container = docker.getContainer(id);
      try { info = await container.inspect({ size: true }); } catch { info = null; }
    }
    
    const stats = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    
    if (includeHistory) {
      saveContainerMetrics(id, stats, info); // <- !!! HISTORY !!!
    }
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- HISTORY ENDPOINT (for dashboard chart prefill) ---
router.get('/:id/history', (req, res) => {
  const id = req.params.id;
  let data = metricsHistory[id] || [];
  let t = parseInt(req.query.t, 10) || METRICS_WINDOW;
  if (t > 0 && t < data.length) data = data.slice(-t);
  res.json(data);
});

// --- LIST ALL CONTAINERS ---
router.get('/', async (req, res) => {
  try {
    const result = await proxy.requestDockerAPI('/containers/json?all=1');
    if (typeof result.data === 'string') {
      try {
        res.json(JSON.parse(result.data));
      } catch {
        res.status(500).json({ error: 'Invalid container data' });
      }
    } else {
      res.json(result.data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
