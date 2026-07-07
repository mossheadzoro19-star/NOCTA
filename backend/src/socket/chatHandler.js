const Message = require('../models/Message');
const Room = require('../models/Room');
const roomState = require('./roomState');
const { createSocketRateLimiter } = require('../middleware/rateLimiter');
const { validatePayload } = require('../lib/validate');
const logger = require('../config/logger');

const chatLimiter = createSocketRateLimiter(5);

module.exports = (io, socket) => {
  /**
   * chat:message — Send a chat message
   */
  socket.on('chat:message', async (payload, callback) => {
    const roomCode = socket.roomCode;
    if (!roomCode) {
      if (typeof callback === 'function') callback({ error: 'Not in a room' });
      return;
    }

    // Rate limit
    if (chatLimiter(socket.id)) {
      socket.emit('chat:error', { message: 'Slow down!' });
      if (typeof callback === 'function') callback({ error: 'Slow down!' });
      return;
    }

    const { valid, data } = validatePayload(payload, {
      content: { type: 'string', required: true, minLength: 1, maxLength: 500 },
      tempId: { type: 'string', required: false, maxLength: 50 },
    });
    if (!valid) {
      if (typeof callback === 'function') callback({ error: 'Invalid payload' });
      return;
    }

    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return;

      // Persist message
      const message = await Message.create({
        roomId: room._id,
        userId: socket.user.userId,
        username: socket.user.username,
        avatarColor: socket.user.avatarColor,
        content: data.content,
        type: 'message',
      });

      // Broadcast to room
      socket.to(roomCode).emit('chat:message', {
        id: message._id.toString(),
        userId: socket.user.userId,
        username: socket.user.username,
        avatarColor: socket.user.avatarColor,
        content: data.content,
        type: 'message',
        createdAt: message.createdAt,
      });

      // Acknowledge to sender with real ID
      if (typeof callback === 'function') {
        callback({
          success: true,
          tempId: data.tempId,
          message: {
            id: message._id.toString(),
            userId: socket.user.userId,
            username: socket.user.username,
            avatarColor: socket.user.avatarColor,
            content: data.content,
            type: 'message',
            createdAt: message.createdAt,
          },
        });
      }

      // Clear typing indicator
      roomState.setTyping(roomCode, socket.user.username, false);
      socket.to(roomCode).emit('chat:typing', {
        username: socket.user.username,
        isTyping: false,
      });
    } catch (error) {
      logger.error({ err: error.message }, 'Chat message error');
      if (typeof callback === 'function') callback({ error: 'Server error' });
    }
  });

  /**
   * chat:typing — Typing indicator
   */
  socket.on('chat:typing', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const { valid, data } = validatePayload(payload, {
      isTyping: { type: 'boolean', required: true },
    });
    if (!valid) return;

    roomState.setTyping(roomCode, socket.user.username, data.isTyping);

    socket.to(roomCode).emit('chat:typing', {
      username: socket.user.username,
      isTyping: data.isTyping,
    });
  });

  /**
   * chat:reaction — Emoji reaction (broadcast only, not persisted)
   */
  socket.on('chat:reaction', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const { valid, data } = validatePayload(payload, {
      emoji: { type: 'string', required: true, maxLength: 10 },
    });
    if (!valid) return;

    io.to(roomCode).emit('chat:reaction', {
      userId: socket.user.userId,
      username: socket.user.username,
      emoji: data.emoji,
    });
  });
};
