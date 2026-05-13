const express = require('express');
const { nanoid } = require('nanoid');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/auth');
const roomState = require('../socket/roomState');

const router = express.Router();

/**
 * POST /api/rooms
 * Create a new room. Returns roomCode.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, maxParticipants = 6 } = req.body;

    if (!name || name.trim().length < 1 || name.trim().length > 50) {
      return res.status(400).json({ error: 'Room name must be 1-50 characters' });
    }

    const roomCode = nanoid(6).toUpperCase();

    const room = await Room.create({
      roomCode,
      name: name.trim(),
      hostId: req.user.userId,
      maxParticipants: Math.min(Math.max(maxParticipants, 2), 6),
    });

    res.status(201).json({
      roomCode: room.roomCode,
      name: room.name,
      maxParticipants: room.maxParticipants,
    });
  } catch (error) {
    console.error('[Rooms] Create error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * GET /api/rooms/:code
 * Get room info by code.
 */
router.get('/:code', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findOne({
      roomCode: req.params.code.toUpperCase(),
      isActive: true,
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const participantCount = roomState.getParticipantCount(room.roomCode);

    res.json({
      roomCode: room.roomCode,
      name: room.name,
      hostId: room.hostId,
      maxParticipants: room.maxParticipants,
      currentParticipants: participantCount,
      videoUrl: room.videoUrl,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('[Rooms] Get error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

/**
 * GET /api/rooms/:code/messages
 * Get recent messages for a room (paginated).
 */
router.get('/:code/messages', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.code.toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before;

    const query = { roomId: room._id };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('[Rooms] Messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

module.exports = router;
