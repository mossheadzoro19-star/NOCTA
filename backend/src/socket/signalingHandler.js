const roomState = require('./roomState');

module.exports = (io, socket) => {
  /**
   * webrtc:offer — Forward SDP offer to target peer
   */
  socket.on('webrtc:offer', ({ targetSocketId, sdp }) => {
    if (!socket.roomCode || !targetSocketId) return;

    io.to(targetSocketId).emit('webrtc:offer', {
      senderSocketId: socket.id,
      sdp,
      username: socket.user.username,
    });
  });

  /**
   * webrtc:answer — Forward SDP answer to target peer
   */
  socket.on('webrtc:answer', ({ targetSocketId, sdp }) => {
    if (!socket.roomCode || !targetSocketId) return;

    io.to(targetSocketId).emit('webrtc:answer', {
      senderSocketId: socket.id,
      sdp,
    });
  });

  /**
   * webrtc:ice-candidate — Forward ICE candidate to target peer
   */
  socket.on('webrtc:ice-candidate', ({ targetSocketId, candidate }) => {
    if (!socket.roomCode || !targetSocketId) return;

    io.to(targetSocketId).emit('webrtc:ice-candidate', {
      senderSocketId: socket.id,
      candidate,
    });
  });

  /**
   * webrtc:media-state — Broadcast camera/mic state changes
   */
  socket.on('webrtc:media-state', ({ isCameraOn, isMicOn }) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    socket.to(roomCode).emit('webrtc:media-state', {
      socketId: socket.id,
      username: socket.user.username,
      isCameraOn,
      isMicOn,
    });
  });

  /**
   * Cleanup on disconnect — close all peer connections
   * This is critical for preventing ghost users and camera leaks.
   */
  socket.on('disconnecting', () => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    // Notify all peers in room to close connections to this socket
    socket.to(roomCode).emit('webrtc:peer-disconnected', {
      socketId: socket.id,
      username: socket.user?.username,
    });
  });
};
