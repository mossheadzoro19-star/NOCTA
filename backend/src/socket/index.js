const { Server } = require('socket.io');
const { socketAuthMiddleware } = require('../middleware/auth');
const roomHandler = require('./roomHandler');
const chatHandler = require('./chatHandler');
const syncHandler = require('./syncHandler');
const signalingHandler = require('./signalingHandler');
const logger = require('../config/logger');

const initSocket = (httpServer) => {
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Socket CORS: origin ${origin} not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false,
    },
  });

  // Auth middleware — verify JWT on handshake
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    logger.info({ username: socket.user.username, socketId: socket.id }, 'Socket connected');

    try {
      roomHandler(io, socket);
      chatHandler(io, socket);
      syncHandler(io, socket);
      signalingHandler(io, socket);
    } catch (err) {
      logger.error({ err: err.message }, 'Handler registration error');
    }

    // Handle reconnection state recovery
    socket.on('reconnect:restore', () => {
      const roomCode = socket.roomCode;
      if (roomCode) {
        const roomState = require('./roomState');
        socket.emit('reconnect:state', {
          roomCode,
          playback: roomState.getPlayback(roomCode),
          participants: roomState.getParticipants(roomCode),
        });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info({ username: socket.user?.username, reason }, 'Socket disconnected');
    });

    socket.on('error', (err) => {
      logger.error({ username: socket.user?.username, err: err.message }, 'Socket error');
    });
  });

  io.engine.on('connection_error', (err) => {
    logger.error({ code: err.code, message: err.message }, 'Socket.IO engine connection error');
  });

  return io;
};

module.exports = initSocket;
