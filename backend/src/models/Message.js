const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  userId: {
    type: String, // String to support both ObjectId and guest_<nanoid> IDs
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  avatarColor: {
    type: String,
    default: '#7C83FD',
  },
  content: {
    type: String,
    required: true,
    maxlength: 500,
  },
  type: {
    type: String,
    enum: ['message', 'reaction', 'system'],
    default: 'message',
  },
  emoji: {
    type: String,
  },
}, {
  timestamps: true,
});

// Index for querying messages by room, ordered by time
messageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
