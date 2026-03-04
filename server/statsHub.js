const proxy = require('./docker/proxy');

// Configuration
const COLLECTION_INTERVAL_MS = process.env.STATS_INTERVAL_MS ? parseInt(process.env.STATS_INTERVAL_MS) : 5000;
const CONCURRENCY_LIMIT = process.env.STATS_CONCURRENCY_LIMIT ? parseInt(process.env.STATS_CONCURRENCY_LIMIT) : 8;

// In-memory storage
let latestContainers = [];
let latestStats = {}; // { [containerId]: normalizedStats }
let lastCollectionTime = 0;

// Connected WebSocket clients
const clients = new Set();

/**
 * Fetch container list from Docker API
 */
async function fetchContainerList() {
  try {
    const result = await proxy.requestDockerAPI('/containers/json?all=true');
    const containers = Array.isArray(result) ? result : (result.data || []);
    return containers.map(c => ({
      Id: c.Id,
      Names: c.Names,
      Image: c.Image,
      State: c.State,
      Status: c.Status,
      Ports: c.Ports,
      Created: c.Created,
      Labels: c.Labels
    }));
  } catch (err) {
    console.error('[StatsHub] Failed to fetch container list:', err.message);
    return [];
  }
}

/**
 * Fetch stats for a single container
 */
async function fetchContainerStats(containerId) {
  try {
    const result = await proxy.requestDockerAPI(`/containers/${containerId}/stats?stream=0`);
    const stats = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    return normalizeStats(containerId, stats);
  } catch (err) {
    // Container might have stopped
    return null;
  }
}

/**
 * Normalize stats into a consistent format
 */
function normalizeStats(containerId, stats) {
  if (!stats) return null;
  
  let cpuPercent = 0;
  let memoryUsage = 0;
  let memoryLimit = 1;
  let memoryPercent = 0;
  let networkRx = 0;
  let networkTx = 0;
  let blockRead = 0;
  let blockWrite = 0;

  try {
    // CPU calculation
    if (stats.cpu_stats && stats.precpu_stats) {
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuCount = stats.cpu_stats.online_cpus || 1;
      if (sysDelta > 0 && cpuDelta > 0) {
        cpuPercent = (cpuDelta / sysDelta) * cpuCount * 100;
      }
    }

    // Memory
    if (stats.memory_stats) {
      memoryUsage = stats.memory_stats.usage || 0;
      memoryLimit = stats.memory_stats.limit || 1;
      memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;
    }

    // Network
    if (stats.networks) {
      for (const net of Object.values(stats.networks)) {
        networkRx += net.rx_bytes || 0;
        networkTx += net.tx_bytes || 0;
      }
    }

    // Block I/O
    if (stats.blkio_stats && stats.blkio_stats.io_service_bytes_recursive) {
      for (const io of stats.blkio_stats.io_service_bytes_recursive) {
        if (io.op === 'read' || io.op === 'Read') {
          blockRead += io.value || 0;
        } else if (io.op === 'write' || io.op === 'Write') {
          blockWrite += io.value || 0;
        }
      }
    }
  } catch (err) {
    console.error(`[StatsHub] Error normalizing stats for ${containerId}:`, err.message);
  }

  return {
    id: containerId,
    cpuPercent: Math.round(cpuPercent * 100) / 100,
    memoryUsage,
    memoryLimit,
    memoryPercent: Math.round(memoryPercent * 100) / 100,
    networkRx,
    networkTx,
    blockRead,
    blockWrite,
    timestamp: Date.now()
  };
}

/**
 * Fetch stats for all containers with concurrency limit
 */
async function fetchAllStats(containerIds) {
  const results = {};
  
  // Process in batches to respect concurrency limit
  for (let i = 0; i < containerIds.length; i += CONCURRENCY_LIMIT) {
    const batch = containerIds.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map(id => fetchContainerStats(id))
    );
    
    batchResults.forEach((stats, index) => {
      if (stats) {
        results[batch[index]] = stats;
      }
    });
  }
  
  return results;
}

/**
 * Main collector loop - runs every interval
 */
async function collect() {
  try {
    // Fetch container list
    latestContainers = await fetchContainerList();
    
    // Get running container IDs
    const runningIds = latestContainers
      .filter(c => c.State === 'running')
      .map(c => c.Id);
    
    // Fetch stats for running containers
    const stats = await fetchAllStats(runningIds);
    
    // Update latest stats
    latestStats = stats;
    lastCollectionTime = Date.now();
    
    // Broadcast to all connected clients
    broadcastTick();
    
  } catch (err) {
    console.error('[StatsHub] Collection error:', err.message);
  }
}

/**
 * Broadcast tick to all connected clients
 */
function broadcastTick() {
  if (clients.size === 0) return;
  
  const payload = JSON.stringify({
    type: 'tick',
    timestamp: lastCollectionTime,
    containers: latestContainers,
    stats: latestStats
  });
  
  // Remove closed clients and send to remaining
  for (const client of clients) {
    try {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(payload);
      } else {
        clients.delete(client);
      }
    } catch (err) {
      clients.delete(client);
    }
  }
}

/**
 * Add a client to the broadcast list
 */
function addClient(ws) {
  clients.add(ws);
  
  // Send initial snapshot immediately
  try {
    ws.send(JSON.stringify({
      type: 'snapshot',
      timestamp: lastCollectionTime,
      containers: latestContainers,
      stats: latestStats
    }));
  } catch (err) {
    console.error('[StatsHub] Failed to send snapshot:', err.message);
  }
}

/**
 * Remove a client from the broadcast list
 */
function removeClient(ws) {
  clients.delete(ws);
}

/**
 * Start the collector loop
 */
function startCollector() {
  console.log(`[StatsHub] Starting collector (interval: ${COLLECTION_INTERVAL_MS}ms, concurrency: ${CONCURRENCY_LIMIT})`);
  
  // Run immediately on start
  collect();
  
  // Then run at interval
  setInterval(collect, COLLECTION_INTERVAL_MS);
}

/**
 * Get current snapshot (for HTTP endpoint)
 */
function getSnapshot() {
  return {
    containers: latestContainers,
    stats: latestStats,
    timestamp: lastCollectionTime
  };
}

/**
 * Get client count (for monitoring)
 */
function getClientCount() {
  return clients.size;
}

module.exports = {
  startCollector,
  getSnapshot,
  addClient,
  removeClient,
  getClientCount
};
