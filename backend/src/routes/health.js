const express = require('express');
const roomState = require('../socket/roomState');

const router = express.Router();

router.get('/', (req, res) => {
  const stats = roomState.getStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    ...stats,
  });
});

module.exports = router;
