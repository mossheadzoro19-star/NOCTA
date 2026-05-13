const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' },
});

/**
 * Socket event rate limiter — throttles per socket.
 * Returns true if the event should be BLOCKED.
 */
const createSocketRateLimiter = (maxPerSecond = 10) => {
  const counters = new Map();

  return (socketId) => {
    const now = Date.now();
    const entry = counters.get(socketId);

    if (!entry || now - entry.windowStart > 1000) {
      counters.set(socketId, { windowStart: now, count: 1 });
      return false; // allow
    }

    entry.count++;
    if (entry.count > maxPerSecond) {
      return true; // block
    }

    return false; // allow
  };
};

module.exports = { apiLimiter, authLimiter, createSocketRateLimiter };
