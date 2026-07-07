const roomState = require('./roomState');
const { createSocketRateLimiter } = require('../middleware/rateLimiter');
const { validatePayload } = require('../lib/validate');
const logger = require('../config/logger');

const syncLimiter = createSocketRateLimiter(5);

module.exports = (io, socket) => {
  /**
   * sync:play — Host plays video
   */
  socket.on('sync:play', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;
    if (syncLimiter(socket.id)) return;

    const { valid, data } = validatePayload(payload, {
      currentTime: { type: 'number', required: true, min: 0 },
    });
    if (!valid) return;

    roomState.updatePlayback(roomCode, {
      isPlaying: true,
      currentTime: data.currentTime,
    });

    socket.to(roomCode).emit('sync:play', {
      currentTime: data.currentTime,
      serverTimestamp: Date.now(),
    });
  });

  /**
   * sync:pause — Host pauses video
   */
  socket.on('sync:pause', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;
    if (syncLimiter(socket.id)) return;

    const { valid, data } = validatePayload(payload, {
      currentTime: { type: 'number', required: true, min: 0 },
    });
    if (!valid) return;

    roomState.updatePlayback(roomCode, {
      isPlaying: false,
      currentTime: data.currentTime,
    });

    socket.to(roomCode).emit('sync:pause', {
      currentTime: data.currentTime,
      serverTimestamp: Date.now(),
    });
  });

  /**
   * sync:seek — Host seeks to position
   */
  socket.on('sync:seek', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;
    if (syncLimiter(socket.id)) return;

    const { valid, data } = validatePayload(payload, {
      targetTime: { type: 'number', required: true, min: 0 },
    });
    if (!valid) return;

    roomState.updatePlayback(roomCode, {
      currentTime: data.targetTime,
    });

    socket.to(roomCode).emit('sync:seek', {
      targetTime: data.targetTime,
      serverTimestamp: Date.now(),
    });
  });

  /**
   * sync:heartbeat — Client reports current playback position.
   * Server checks drift and sends correction if needed.
   *
   * Correction thresholds:
   * - drift > 2.0s → hard seek
   * - drift 0.5–2.0s → playback rate adjust
   * - drift < 0.5s → ignore
   */
  socket.on('sync:heartbeat', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    // Don't check host against themselves
    if (roomState.isHost(roomCode, socket.id)) return;

    const { valid, data } = validatePayload(payload, {
      currentTime: { type: 'number', required: true, min: 0 },
    });
    if (!valid) return;

    const playback = roomState.getPlayback(roomCode);
    if (!playback || !playback.isPlaying) return;

    // Calculate expected time
    const elapsed = (Date.now() - playback.lastUpdated) / 1000;
    const expectedTime = playback.currentTime + elapsed * playback.playbackRate;
    const drift = Math.abs(expectedTime - data.currentTime);

    if (drift > 2.0) {
      socket.emit('sync:correct', {
        targetTime: expectedTime,
        mode: 'seek',
      });
    } else if (drift > 0.5) {
      const rate = data.currentTime < expectedTime ? 1.05 : 0.95;
      socket.emit('sync:correct', {
        targetTime: expectedTime,
        mode: 'rate',
        playbackRate: rate,
      });
    }
  });

  /**
   * sync:request-state — Client requests current playback state (for reconnect)
   */
  socket.on('sync:request-state', () => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const room = roomState.getRoom(roomCode);
    if (room && room.playback) {
      socket.emit('sync:state', {
        ...room.playback,
        serverTimestamp: Date.now(),
        magnetURI: room.p2p.magnetURI,
      });
    }
  });

  /**
   * p2p:magnet — Host shares torrent magnet link
   */
  socket.on('p2p:magnet', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;

    const { valid, data } = validatePayload(payload, {
      magnetURI: { type: 'string', required: true, maxLength: 5000 },
    });
    if (!valid) return;

    const room = roomState.getRoom(roomCode);
    if (room) {
      room.p2p.magnetURI = data.magnetURI;
      socket.to(roomCode).emit('p2p:magnet', { magnetURI: data.magnetURI });
    }
  });
};
