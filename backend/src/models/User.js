const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 20,
  },
  email: {
    type: String,
    sparse: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  password: {
    type: String,
    minlength: 6,
    select: false, // Don't return password by default
  },
  googleId: {
    type: String,
    sparse: true,
  },
  avatarColor: {
    type: String,
    default: () => {
      const colors = ['#8B9DC3', '#A7C4A0', '#C9B1D0', '#D4A88C', '#89B0AE', '#B8C9E1'];
      return colors[Math.floor(Math.random() * colors.length)];
    },
  },
  isGuest: {
    type: Boolean,
    default: true,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
