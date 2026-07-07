const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  hostId: {
    type: String, // String to support both Mongo ObjectIds and guest IDs
    required: true,
  },
  videoUrl: {
    type: String,
    default: '',
  },
  maxParticipants: {
    type: Number,
    default: 6,
    min: 2,
    max: 6,
  },
  isPrivate: {
    type: Boolean,
    default: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
  },
}, {
  timestamps: true,
});

roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Cascade-delete messages when room is removed (TTL or manual)
roomSchema.pre('deleteOne', { document: true, query: false }, async function () {
  const Message = mongoose.model('Message');
  await Message.deleteMany({ roomId: this._id });
});

// Also handle findOneAndDelete / TTL cleanup
roomSchema.pre('findOneAndDelete', async function () {
  const room = await this.model.findOne(this.getFilter());
  if (room) {
    const Message = mongoose.model('Message');
    await Message.deleteMany({ roomId: room._id });
  }
});

module.exports = mongoose.model('Room', roomSchema);
