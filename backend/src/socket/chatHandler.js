const Message = require('../models/Message');
const Room = require('../models/Room');
const roomState = require('./roomState');
const { createSocketRateLimiter } = require('../middleware/rateLimiter');

const chatLimiter = createSocketRateLimiter(5); // 5 messages per second max

module.exports = (io, socket) => {
  /**
   * chat:message — Send a chat message
   */
  socket.on('chat:message', async ({ content }) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !content?.trim()) return;

    // Rate limit
    if (chatLimiter(socket.id)) {
      socket.emit('chat:error', { message: 'Slow down!' });
      return;
    }

    const cleanContent = content.trim().slice(0, 500);

    try {
      // Find room in DB for roomId reference
      const room = await Room.findOne({ roomCode });
      if (!room) return;

      // Persist message
      const message = await Message.create({
        roomId: room._id,
        userId: socket.user.userId,
        username: socket.user.username,
        avatarColor: socket.user.avatarColor,
        content: cleanContent,
        type: 'message',
      });

      // Broadcast to room
      io.to(roomCode).emit('chat:message', {
        id: message._id,
        userId: socket.user.userId,
        username: socket.user.username,
        avatarColor: socket.user.avatarColor,
        content: cleanContent,
        type: 'message',
        createdAt: message.createdAt,
      });

      // Clear typing indicator
      roomState.setTyping(roomCode, socket.user.username, false);
      socket.to(roomCode).emit('chat:typing', {
        username: socket.user.username,
        isTyping: false,
      });
    } catch (error) {
      console.error('[Chat] Message error:', error);
    }
  });

  /**
   * chat:typing — Typing indicator
   */
  socket.on('chat:typing', ({ isTyping }) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    roomState.setTyping(roomCode, socket.user.username, isTyping);

    socket.to(roomCode).emit('chat:typing', {
      username: socket.user.username,
      isTyping,
    });
  });

  /**
   * chat:reaction — Emoji reaction (broadcast only, not persisted)
   */
  socket.on('chat:reaction', ({ emoji }) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !emoji) return;

    io.to(roomCode).emit('chat:reaction', {
      userId: socket.user.userId,
      username: socket.user.username,
      emoji,
    });
  });
};
