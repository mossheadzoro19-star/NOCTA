const Room = require('../models/Room');
const roomState = require('./roomState');
const logger = require('../config/logger');
const { validatePayload } = require('../lib/validate');

module.exports = (io, socket) => {
  /**
   * room:join — Join a room by code
   */
  socket.on('room:join', async (payload) => {
    try {
      const { valid, data } = validatePayload(payload, {
        roomCode: { type: 'string', required: true, minLength: 1, maxLength: 10 },
      });
      if (!valid) return;

      const roomCode = data.roomCode.toUpperCase();

      // Check if kicked from this room
      if (roomState.isKicked(roomCode, socket.user.userId)) {
        socket.emit('room:error', { message: 'You have been removed from this room' });
        return;
      }

      // Check if locked
      if (roomState.isRoomLocked(roomCode)) {
        socket.emit('room:error', { message: 'This room is currently locked by the host' });
        return;
      }

      // Validate room exists in DB
      const room = await Room.findOne({ roomCode, isActive: true });
      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      // Check capacity
      const currentCount = roomState.getParticipantCount(roomCode);
      if (currentCount >= room.maxParticipants) {
        socket.emit('room:error', { message: 'Room is full' });
        return;
      }

      // Leave any previous room
      const prevRoom = roomState.findRoomBySocketId(socket.id);
      if (prevRoom) {
        handleLeaveRoom(io, socket, prevRoom);
      }

      // Reject duplicate usernames within the room
      if (roomState.hasUsername(roomCode, socket.user.username)) {
        socket.emit('room:error', { message: 'Username already in use in this room' });
        return;
      }

      // Join Socket.IO room
      socket.join(roomCode);
      socket.roomCode = roomCode;

      const userData = {
        userId: socket.user.userId,
        username: socket.user.username,
        avatarColor: socket.user.avatarColor,
      };

      // Add to in-memory state
      const existingRoom = roomState.getRoom(roomCode);
      if (!existingRoom) {
        roomState.createRoom(roomCode, socket.id, userData);
      } else {
        roomState.addParticipant(roomCode, socket.id, userData);
      }

      // Send current state to the joining user
      const playback = roomState.getPlayback(roomCode);
      const participants = roomState.getParticipants(roomCode);

      socket.emit('room:joined', {
        roomCode,
        name: room.name,
        videoUrl: room.videoUrl,
        playback,
        participants,
        isHost: roomState.isHost(roomCode, socket.id),
        isLocked: roomState.isRoomLocked(roomCode),
      });

      // Notify others
      socket.to(roomCode).emit('room:user-joined', {
        user: userData,
        participants,
      });

      logger.info({ roomCode, username: socket.user.username, count: participants.length }, 'User joined room');
    } catch (error) {
      logger.error({ err: error.message }, 'Room join error');
      socket.emit('room:error', { message: 'Failed to join room' });
    }
  });

  /**
   * room:leave — Leave current room
   */
  socket.on('room:leave', () => {
    const roomCode = socket.roomCode;
    if (roomCode) {
      handleLeaveRoom(io, socket, roomCode);
    }
  });

  /**
   * room:kick — Host kicks a user by userId
   */
  socket.on('room:kick', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;

    const { valid, data } = validatePayload(payload, {
      userId: { type: 'string', required: true },
    });
    if (!valid) return;

    // Cannot kick yourself
    if (data.userId === socket.user.userId) return;

    // Add to kicked set (prevents rejoining)
    roomState.kickUser(roomCode, data.userId);

    // Remove from room
    const result = roomState.removeParticipantByUserId(roomCode, data.userId);
    if (!result?.participant) return;

    // Disconnect the kicked socket from the room
    const kickedSocket = io.sockets.sockets.get(result.socketId);
    if (kickedSocket) {
      kickedSocket.leave(roomCode);
      kickedSocket.roomCode = null;
      kickedSocket.emit('room:kicked', { message: 'You have been removed by the host' });
    }

    // Notify remaining participants
    const participants = roomState.getParticipants(roomCode);
    io.to(roomCode).emit('room:user-left', {
      user: { userId: result.participant.userId, username: result.participant.username },
      participants,
      kicked: true,
    });

    logger.info({ roomCode, kicked: result.participant.username, by: socket.user.username }, 'User kicked');
  });

  /**
   * room:transfer-host — Host transfers privileges
   */
  socket.on('room:transfer-host', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;

    const { valid, data } = validatePayload(payload, {
      userId: { type: 'string', required: true },
    });
    if (!valid) return;

    const newHost = roomState.transferHost(roomCode, data.userId);
    if (newHost) {
      const participants = roomState.getParticipants(roomCode);
      io.to(roomCode).emit('room:host-changed', {
        username: newHost.username,
        userId: newHost.userId,
        participants
      });
      logger.info({ roomCode, newHost: newHost.username }, 'Host transferred');
    }
  });

  /**
   * room:toggle-lock — Host locks/unlocks room
   */
  socket.on('room:toggle-lock', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;

    const isLocked = roomState.toggleLock(roomCode);
    io.to(roomCode).emit('room:locked', { isLocked });
    logger.info({ roomCode, isLocked }, 'Room lock toggled');
  });

  /**
   * room:update-video — Host sets video URL
   */
  socket.on('room:update-video', async (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;

    const { valid, data } = validatePayload(payload, {
      videoUrl: { type: 'string', required: true, maxLength: 2000 },
    });
    if (!valid) return;

    // Update in DB (persistent)
    await Room.updateOne({ roomCode }, { videoUrl: data.videoUrl });

    // Update in-memory
    roomState.updatePlayback(roomCode, {
      videoUrl: data.videoUrl,
      currentTime: 0,
      isPlaying: false,
    });

    io.to(roomCode).emit('room:video-changed', { videoUrl: data.videoUrl });
    logger.info({ roomCode, videoUrl: data.videoUrl.substring(0, 50) }, 'Video changed');
  });

  /**
   * room:nudge — Play a sound and shake screen for everyone
   */
  socket.on('room:nudge', () => {
    const roomCode = socket.roomCode;
    if (roomCode) {
      io.to(roomCode).emit('room:nudge', { username: socket.user.username });
    }
  });

  /**
   * room:raise-hand — Toggle hand raise status
   */
  socket.on('room:raise-hand', (payload) => {
    const roomCode = socket.roomCode;
    if (roomCode) {
      io.to(roomCode).emit('room:raise-hand', { 
        userId: socket.user.userId, 
        isRaised: Boolean(payload?.isRaised) 
      });
    }
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnecting', () => {
    const roomCode = socket.roomCode;
    if (roomCode) {
      handleLeaveRoom(io, socket, roomCode);
    }
  });
};

function handleLeaveRoom(io, socket, roomCode) {
  const result = roomState.removeParticipant(roomCode, socket.id);
  if (!result?.participant) return;

  socket.leave(roomCode);
  socket.roomCode = null;

  if (result.roomDeleted) {
    logger.info({ roomCode }, 'Room deleted (empty)');
  } else {
    const participants = roomState.getParticipants(roomCode);
    const newHostInfo = result.participant.isHost ? participants.find((p) => p.isHost) : null;

    io.to(roomCode).emit('room:user-left', {
      user: {
        userId: result.participant.userId,
        username: result.participant.username,
      },
      participants,
      newHost: newHostInfo?.username || null,
    });

    // Notify about host transfer
    if (newHostInfo) {
      io.to(roomCode).emit('room:host-changed', {
        username: newHostInfo.username,
        userId: newHostInfo.userId,
      });
    }
  }

  logger.info({ roomCode, username: result.participant.username }, 'User left room');
}
