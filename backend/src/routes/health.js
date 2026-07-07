const express = require('express');
const mongoose = require('mongoose');
const roomState = require('../socket/roomState');

const router = express.Router();

router.get('/', (req, res) => {
  const stats = roomState.getStats();
  const mongoState = mongoose.connection.readyState;
  const mongoStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    mongo: mongoStatus[mongoState] || 'unknown',
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    ...stats,
  });
});

module.exports = router;
