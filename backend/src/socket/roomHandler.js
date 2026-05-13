const Room = require('../models/Room');
const roomState = require('./roomState');

module.exports = (io, socket) => {
  /**
   * room:join — Join a room by code
   */
  socket.on('room:join', async ({ roomCode }) => {
    try {
      roomCode = roomCode?.toUpperCase();
      if (!roomCode) return;

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
        // First user — create room state, they become host
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
      });

      // Notify others
      socket.to(roomCode).emit('room:user-joined', {
        user: userData,
        participants,
      });

      console.log(`[Room] ${socket.user.username} joined ${roomCode} (${participants.length}/${room.maxParticipants})`);
    } catch (error) {
      console.error('[Room] Join error:', error);
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
   * room:update-video — Host sets video URL
   */
  socket.on('room:update-video', async ({ videoUrl }) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;

    // Update in DB (persistent)
    await Room.updateOne({ roomCode }, { videoUrl });

    // Update in-memory
    roomState.updatePlayback(roomCode, {
      videoUrl,
      currentTime: 0,
      isPlaying: false,
    });

    io.to(roomCode).emit('room:video-changed', { videoUrl });
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
    console.log(`[Room] ${roomCode} deleted (empty)`);
  } else {
    const participants = roomState.getParticipants(roomCode);

    io.to(roomCode).emit('room:user-left', {
      user: {
        userId: result.participant.userId,
        username: result.participant.username,
      },
      participants,
      newHost: result.participant.isHost ? participants.find(p => p.isHost)?.username : null,
    });
  }

  console.log(`[Room] ${result.participant.username} left ${roomCode}`);
}
