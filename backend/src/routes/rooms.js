const express = require('express');
const { nanoid } = require('nanoid');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/auth');
const roomState = require('../socket/roomState');
const logger = require('../config/logger');

const router = express.Router();

/**
 * POST /api/rooms
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, maxParticipants = 6 } = req.body;

    if (!name || name.trim().length < 1 || name.trim().length > 50) {
      return res.status(400).json({ error: 'Room name must be 1-50 characters' });
    }

    // ponytail: one regex covers XSS, injection, and weird unicode
    const ROOM_NAME_REGEX = /^[a-zA-Z0-9 _\-'.!]+$/;
    if (!ROOM_NAME_REGEX.test(name.trim())) {
      return res.status(400).json({ error: 'Room name can only contain letters, numbers, spaces, and basic punctuation' });
    }

    const roomCode = nanoid(6).toUpperCase();

    const room = await Room.create({
      roomCode,
      name: name.trim(),
      hostId: req.user.userId,
      maxParticipants: Math.min(Math.max(maxParticipants, 2), 6),
    });

    logger.info({ roomCode, host: req.user.username }, 'Room created');

    res.status(201).json({
      roomCode: room.roomCode,
      name: room.name,
      maxParticipants: room.maxParticipants,
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Room create error');
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * GET /api/rooms/:code
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
    logger.error({ err: error.message }, 'Room get error');
    res.status(500).json({ error: 'Failed to get room' });
  }
});

/**
 * GET /api/rooms/:code/messages
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

    const normalizedMessages = messages.reverse().map((msg) => {
      const { _id, __v, updatedAt, roomId, ...rest } = msg;
      return { id: _id.toString(), ...rest };
    });

    res.json({ messages: normalizedMessages });
  } catch (error) {
    logger.error({ err: error.message }, 'Messages fetch error');
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

module.exports = router;
