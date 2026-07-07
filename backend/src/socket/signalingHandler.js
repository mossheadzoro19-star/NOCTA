const roomState = require('./roomState');
const { validatePayload } = require('../lib/validate');

module.exports = (io, socket) => {
  /**
   * webrtc:offer — Forward SDP offer to target peer
   */
  socket.on('webrtc:offer', (payload) => {
    if (!socket.roomCode) return;

    const { valid, data } = validatePayload(payload, {
      targetSocketId: { type: 'string', required: true },
      sdp: { type: 'string', required: true, maxLength: 50000 },
    });
    if (!valid) return;

    io.to(data.targetSocketId).emit('webrtc:offer', {
      senderSocketId: socket.id,
      sdp: data.sdp,
      username: socket.user.username,
    });
  });

  /**
   * webrtc:answer — Forward SDP answer to target peer
   */
  socket.on('webrtc:answer', (payload) => {
    if (!socket.roomCode) return;

    const { valid, data } = validatePayload(payload, {
      targetSocketId: { type: 'string', required: true },
      sdp: { type: 'string', required: true, maxLength: 50000 },
    });
    if (!valid) return;

    io.to(data.targetSocketId).emit('webrtc:answer', {
      senderSocketId: socket.id,
      sdp: data.sdp,
    });
  });

  /**
   * webrtc:ice-candidate — Forward ICE candidate to target peer
   */
  socket.on('webrtc:ice-candidate', (payload) => {
    if (!socket.roomCode) return;

    const { valid, data } = validatePayload(payload, {
      targetSocketId: { type: 'string', required: true },
      candidate: { type: 'string', required: true, maxLength: 5000 },
    });
    if (!valid) return;

    io.to(data.targetSocketId).emit('webrtc:ice-candidate', {
      senderSocketId: socket.id,
      candidate: data.candidate,
    });
  });

  /**
   * webrtc:media-state — Broadcast camera/mic state changes
   */
  socket.on('webrtc:media-state', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const { valid, data } = validatePayload(payload, {
      isCameraOn: { type: 'boolean', required: true },
      isMicOn: { type: 'boolean', required: true },
    });
    if (!valid) return;

    socket.to(roomCode).emit('webrtc:media-state', {
      socketId: socket.id,
      username: socket.user.username,
      isCameraOn: data.isCameraOn,
      isMicOn: data.isMicOn,
    });
  });

  /**
   * Cleanup on disconnect
   */
  socket.on('disconnecting', () => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    socket.to(roomCode).emit('webrtc:peer-disconnected', {
      socketId: socket.id,
      username: socket.user?.username,
    });
  });
};
