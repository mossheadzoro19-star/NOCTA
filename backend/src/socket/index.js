const { Server } = require('socket.io');
const { socketAuthMiddleware } = require('../middleware/auth');
const roomHandler = require('./roomHandler');
const chatHandler = require('./chatHandler');
const syncHandler = require('./syncHandler');
const signalingHandler = require('./signalingHandler');

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    // Allow both transports for reliability
    transports: ['websocket', 'polling'],
    // Connection state recovery
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: false,
    },
  });

  // Auth middleware — verify JWT on handshake
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.user.username} (${socket.id})`);

    // Wrap handler registration in try/catch to prevent one bad handler from killing the connection
    try {
      roomHandler(io, socket);
      chatHandler(io, socket);
      syncHandler(io, socket);
      signalingHandler(io, socket);
    } catch (err) {
      console.error('[Socket] Handler registration error:', err);
    }

    // Handle reconnection state recovery
    socket.on('reconnect:restore', () => {
      const roomCode = socket.roomCode;
      if (roomCode) {
        socket.emit('reconnect:state', {
          roomCode,
          playback: require('./roomState').getPlayback(roomCode),
          participants: require('./roomState').getParticipants(roomCode),
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.user?.username} (${reason})`);
    });

    // Catch any unhandled socket errors to prevent crashes
    socket.on('error', (err) => {
      console.error(`[Socket] Error for ${socket.user?.username}:`, err.message);
    });
  });

  // Server-level error handling
  io.engine.on('connection_error', (err) => {
    console.error('[Socket.IO Engine] Connection error:', err.code, err.message);
  });

  return io;
};

module.exports = initSocket;
