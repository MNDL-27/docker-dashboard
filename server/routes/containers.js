const express = require('express');
const router = express.Router();
const proxy = require('../docker/proxy');
const Docker = require('dockerode');
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

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
    if (typeof result.data === 'string') {
      res.json(JSON.parse(result.data));
    } else {
      res.json(result.data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// *** THIS LINE IS CRUCIAL ***
module.exports = router;
