const express = require('express');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');
const escapeRegex = require('../lib/escapeRegex');
const logger = require('../config/logger');

const router = express.Router();

const AVATAR_COLORS = ['#8B9DC3', '#A7C4A0', '#C9B1D0', '#D4A88C', '#89B0AE', '#B8C9E1'];

const randomAvatarColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

// ponytail: one regex, one list — covers all username validation
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const RESERVED_NAMES = ['admin', 'system', 'nocta', 'host', 'mod', 'moderator', 'bot'];

function validateUsername(username) {
  if (!username || username.trim().length < 2 || username.trim().length > 20) {
    return 'Username must be 2-20 characters';
  }
  if (!USERNAME_REGEX.test(username.trim())) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  if (RESERVED_NAMES.includes(username.trim().toLowerCase())) {
    return 'That username is reserved';
  }
  return null;
}

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id || user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      isGuest: user.isGuest || false,
    },
    process.env.JWT_SECRET,
    { expiresIn: user.isGuest ? '24h' : '7d' }
  );
};

/**
 * POST /api/auth/register
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return res.status(400).json({ error: 'Only @gmail.com addresses are allowed' });
    }

    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be 8+ characters and include a number and a special character'
      });
    }

    const escaped = escapeRegex(username);
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: { $regex: new RegExp(`^${escaped}$`, 'i') } }
      ]
    });

    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      return res.status(409).json({ error: 'Email already in use' });
    }

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password,
      isGuest: false,
    });

    const token = generateToken(user);

    logger.info({ userId: user._id, username: user.username }, 'User registered');

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        avatarColor: user.avatarColor,
        isGuest: false,
      },
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Register error');
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    logger.info({ userId: user._id, username: user.username }, 'User logged in');

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        avatarColor: user.avatarColor,
        isGuest: user.isGuest,
      },
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Login error');
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/guest
 * Stateless — no database write. Guest identity lives only in the JWT.
 */
router.post('/guest', authLimiter, async (req, res) => {
  try {
    const { username } = req.body;

    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    const cleanUsername = username.trim();

    // ponytail: one DB query to block guests from impersonating registered users
    const escaped = escapeRegex(cleanUsername);
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${escaped}$`, 'i') },
      isGuest: false,
    });
    if (existingUser) {
      return res.status(409).json({ error: 'That username belongs to a registered account' });
    }

    const guestId = `guest_${nanoid(12)}`;
    const avatarColor = randomAvatarColor();

    const token = jwt.sign(
      { userId: guestId, username: cleanUsername, avatarColor, isGuest: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info({ guestId, username: cleanUsername }, 'Guest session created');

    res.status(201).json({
      token,
      user: {
        id: guestId,
        username: cleanUsername,
        avatarColor,
        isGuest: true,
      },
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Guest creation error');
    res.status(500).json({ error: 'Failed to create guest session' });
  }
});

/**
 * GET /api/auth/me
 * Verify token and return user data. Handles both DB users and stateless guests.
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);

    // Stateless guests — return JWT payload directly
    if (decoded.isGuest) {
      return res.json({
        user: {
          id: decoded.userId,
          username: decoded.username,
          avatarColor: decoded.avatarColor,
          isGuest: true,
        },
      });
    }

    // DB users — fetch from Mongo
    const user = await User.findById(decoded.userId).select('-__v');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        avatarColor: user.avatarColor,
        isGuest: user.isGuest,
      },
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
