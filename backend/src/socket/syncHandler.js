const roomState = require('./roomState');
const { createSocketRateLimiter } = require('../middleware/rateLimiter');

const syncLimiter = createSocketRateLimiter(5);

module.exports = (io, socket) => {
  /**
   * sync:play — Host plays video
   */
  socket.on('sync:play', ({ currentTime }) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;
    if (syncLimiter(socket.id)) return;

    const playback = roomState.updatePlayback(roomCode, {
      isPlaying: true,
      currentTime,
    });

    socket.to(roomCode).emit('sync:play', {
      currentTime,
      serverTimestamp: Date.now(),
    });
  });

  /**
   * sync:pause — Host pauses video
   */
  socket.on('sync:pause', ({ currentTime }) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;
    if (syncLimiter(socket.id)) return;

    roomState.updatePlayback(roomCode, {
      isPlaying: false,
      currentTime,
    });

    socket.to(roomCode).emit('sync:pause', {
      currentTime,
      serverTimestamp: Date.now(),
    });
  });

  /**
   * sync:seek — Host seeks to position
   */
  socket.on('sync:seek', ({ targetTime }) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;
    if (syncLimiter(socket.id)) return;

    roomState.updatePlayback(roomCode, {
      currentTime: targetTime,
    });

    socket.to(roomCode).emit('sync:seek', {
      targetTime,
      serverTimestamp: Date.now(),
    });
  });

  /**
   * sync:heartbeat — Client reports current playback position.
   * Server checks drift and sends correction if needed.
   * 
   * Correction thresholds (from review):
   * - drift > 2.0s → hard seek
   * - drift 0.5–2.0s → playback rate adjust
   * - drift < 0.5s → ignore
   */
  socket.on('sync:heartbeat', ({ currentTime }) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    // Don't check host against themselves
    if (roomState.isHost(roomCode, socket.id)) return;

    const playback = roomState.getPlayback(roomCode);
    if (!playback || !playback.isPlaying) return;

    // Calculate expected time
    const elapsed = (Date.now() - playback.lastUpdated) / 1000;
    const expectedTime = playback.currentTime + elapsed * playback.playbackRate;
    const drift = Math.abs(expectedTime - currentTime);

    if (drift > 2.0) {
      // Hard seek — significant desync
      socket.emit('sync:correct', {
        targetTime: expectedTime,
        mode: 'seek',
      });
    } else if (drift > 0.5) {
      // Subtle rate adjustment
      const rate = currentTime < expectedTime ? 1.05 : 0.95;
      socket.emit('sync:correct', {
        targetTime: expectedTime,
        mode: 'rate',
        playbackRate: rate,
      });
    }
    // drift < 0.5s → ignore, natural variance
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
        magnetURI: room.p2p.magnetURI
      });
    }
  });

  /**
   * p2p:magnet — Host shares torrent magnet link
   */
  socket.on('p2p:magnet', ({ magnetURI }) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !roomState.isHost(roomCode, socket.id)) return;

    const room = roomState.getRoom(roomCode);
    if (room) {
      room.p2p.magnetURI = magnetURI;
      socket.to(roomCode).emit('p2p:magnet', { magnetURI });
    }
  });
};
