require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./config/logger');
const validateEnv = require('./config/env');
const connectDB = require('./config/db');
const initSocket = require('./socket');
const { apiLimiter } = require('./middleware/rateLimiter');

// Validate environment before anything else
validateEnv();

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const healthRoutes = require('./routes/health');

const app = express();
const httpServer = createServer(app);

// Parse CLIENT_URL — supports comma-separated list for multi-origin (dev + prod)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

// Middleware
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled temporarily for Socket.IO compat
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Render health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/health', healthRoutes);

// Socket.IO
const io = initSocket(httpServer);

// Global error handler
app.use((err, req, res, next) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled route error');
  res.status(500).json({ error: 'Internal server error' });
});

// Connect DB and start server
const PORT = process.env.PORT || 3001;

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      logger.info({ port: PORT, mongo: true, socketIO: true }, 'NOCTA backend started');
    });
  })
  .catch((err) => {
    logger.error({ err: err.message }, 'Failed to connect to MongoDB');
    logger.warn('Starting WITHOUT database — socket features only');
    httpServer.listen(PORT, () => {
      logger.info({ port: PORT, mongo: false, socketIO: true }, 'NOCTA backend started (no DB)');
    });
  });

// Graceful shutdown
const shutdown = (signal) => {
  logger.info({ signal }, 'Shutdown signal received');
  io.close();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception');
  process.exit(1);
});
