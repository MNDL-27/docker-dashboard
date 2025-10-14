// server/routes/qbittorrent.js
const express = require('express');
const router = express.Router();
const QBittorrentClient = require('../docker/qbittorrentClient');

// Get qBittorrent config from environment variables
const qbittorrentUrl = process.env.QBITTORRENT_URL || 'http://localhost:8080';
const qbittorrentUsername = process.env.QBITTORRENT_USERNAME || 'admin';
const qbittorrentPassword = process.env.QBITTORRENT_PASSWORD || 'adminadmin';

const qbClient = new QBittorrentClient(qbittorrentUrl, qbittorrentUsername, qbittorrentPassword);

/**
 * GET /api/qbittorrent/transfer
 * Get qBittorrent transfer statistics
 */
router.get('/transfer', async (req, res) => {
  try {
    const result = await qbClient.getTransferInfo();
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        error: 'Failed to fetch qBittorrent transfer info',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error in /api/qbittorrent/transfer:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * GET /api/qbittorrent/torrents
 * Get list of torrents
 */
router.get('/torrents', async (req, res) => {
  try {
    const result = await qbClient.getTorrents();
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        error: 'Failed to fetch qBittorrent torrents',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error in /api/qbittorrent/torrents:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

module.exports = router;
