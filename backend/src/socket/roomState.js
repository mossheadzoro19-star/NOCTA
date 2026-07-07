/**
 * In-Memory Room State Manager
 *
 * ALL transient state lives here — NOT in MongoDB.
 * Handles: participants, playback state, typing, peer mapping, kicked users.
 *
 * Structure:
 * activeRooms = Map<roomCode, {
 *   participants: Map<socketId, { userId, username, avatarColor, joinedAt, isHost }>,
 *   playback: { isPlaying, currentTime, lastUpdated, playbackRate, videoUrl },
 *   typing: Set<username>,
 *   peers: Map<socketId, { userId, username }>,
 *   kicked: Set<userId>,
 *   p2p: { magnetURI }
 * }>
 */

class RoomStateManager {
  constructor() {
    this.activeRooms = new Map();
  }

  // --- Room Lifecycle ---

  createRoom(roomCode, hostSocketId, hostData) {
    const room = {
      participants: new Map(),
      playback: {
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now(),
        playbackRate: 1,
        videoUrl: '',
      },
      p2p: {
        magnetURI: null,
      },
      typing: new Set(),
      peers: new Map(),
      kicked: new Set(),
    };

    room.participants.set(hostSocketId, {
      userId: hostData.userId,
      username: hostData.username,
      avatarColor: hostData.avatarColor,
      joinedAt: Date.now(),
      isHost: true,
    });

    room.peers.set(hostSocketId, {
      userId: hostData.userId,
      username: hostData.username,
    });

    this.activeRooms.set(roomCode, room);
    return room;
  }

  getRoom(roomCode) {
    return this.activeRooms.get(roomCode);
  }

  deleteRoom(roomCode) {
    this.activeRooms.delete(roomCode);
  }

  // --- Kicked Users ---

  kickUser(roomCode, userId) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return;
    room.kicked.add(userId);
  }

  isKicked(roomCode, userId) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return false;
    return room.kicked.has(userId);
  }

  // --- Name Conflict Resolution ---

  /**
   * Resolve username conflicts within a room.
   * If "Alex" already exists, returns "Alex (2)". If "Alex (2)" exists, returns "Alex (3)", etc.
   */
  resolveUsername(roomCode, username) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return username;

    const existing = Array.from(room.participants.values()).map((p) => p.username.toLowerCase());

    if (!existing.includes(username.toLowerCase())) {
      return username;
    }

    let suffix = 2;
    while (existing.includes(`${username} (${suffix})`.toLowerCase())) {
      suffix++;
    }
    return `${username} (${suffix})`;
  }

  // --- Participants ---

  addParticipant(roomCode, socketId, userData) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return null;

    const participant = {
      userId: userData.userId,
      username: userData.username,
      avatarColor: userData.avatarColor,
      joinedAt: Date.now(),
      isHost: false,
    };

    room.participants.set(socketId, participant);
    room.peers.set(socketId, {
      userId: userData.userId,
      username: userData.username,
    });

    return participant;
  }

  removeParticipant(roomCode, socketId) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return null;

    const participant = room.participants.get(socketId);
    room.participants.delete(socketId);
    room.peers.delete(socketId);

    if (participant) {
      room.typing.delete(participant.username);
    }

    // If room is empty, clean it up
    if (room.participants.size === 0) {
      this.activeRooms.delete(roomCode);
      return { participant, roomDeleted: true };
    }

    // If host left, transfer host to next participant
    if (participant?.isHost) {
      const nextHost = room.participants.entries().next().value;
      if (nextHost) {
        nextHost[1].isHost = true;
      }
    }

    return { participant, roomDeleted: false };
  }

  /**
   * Remove a participant by userId (for kick). Returns the socketId that was removed.
   */
  removeParticipantByUserId(roomCode, userId) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return null;

    for (const [socketId, participant] of room.participants.entries()) {
      if (participant.userId === userId) {
        return { socketId, ...this.removeParticipant(roomCode, socketId) };
      }
    }
    return null;
  }

  getParticipants(roomCode) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return [];

    return Array.from(room.participants.entries()).map(([socketId, data]) => ({
      socketId,
      ...data,
    }));
  }

  getParticipantCount(roomCode) {
    const room = this.activeRooms.get(roomCode);
    return room ? room.participants.size : 0;
  }

  isHost(roomCode, socketId) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return false;
    const participant = room.participants.get(socketId);
    return participant?.isHost || false;
  }

  // --- Playback State ---

  updatePlayback(roomCode, updates) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return null;

    room.playback = {
      ...room.playback,
      ...updates,
      lastUpdated: Date.now(),
    };

    return room.playback;
  }

  getPlayback(roomCode) {
    const room = this.activeRooms.get(roomCode);
    return room?.playback || null;
  }

  // --- Typing ---

  setTyping(roomCode, username, isTyping) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return;

    if (isTyping) {
      room.typing.add(username);
    } else {
      room.typing.delete(username);
    }
  }

  getTypingUsers(roomCode) {
    const room = this.activeRooms.get(roomCode);
    return room ? Array.from(room.typing) : [];
  }

  // --- Peer Mapping (WebRTC) ---

  getPeers(roomCode) {
    const room = this.activeRooms.get(roomCode);
    if (!room) return [];

    return Array.from(room.peers.entries()).map(([socketId, data]) => ({
      socketId,
      ...data,
    }));
  }

  // --- Utility ---

  findRoomBySocketId(socketId) {
    for (const [roomCode, room] of this.activeRooms.entries()) {
      if (room.participants.has(socketId)) {
        return roomCode;
      }
    }
    return null;
  }

  getStats() {
    return {
      activeRooms: this.activeRooms.size,
      totalParticipants: Array.from(this.activeRooms.values())
        .reduce((sum, room) => sum + room.participants.size, 0),
    };
  }
}

// Singleton
module.exports = new RoomStateManager();
