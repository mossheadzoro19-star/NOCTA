const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      username: user.username,
      avatarColor: user.avatarColor,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * POST /api/auth/register
 * Register a new user with email and password.
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Gmail only constraint
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return res.status(400).json({ error: 'Only @gmail.com addresses are allowed' });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 2-20 characters' });
    }

    // Password constraints: 8+ chars, at least one number and one special char
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be 8+ characters and include a number and a special character' 
      });
    }

    // Check if user exists (case-insensitive check for username)
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: { $regex: new RegExp(`^${username}$`, 'i') } }
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
    console.error('[Auth] Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password.
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
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/guest
 * Create guest user with username, return JWT.
 */
router.post('/guest', authLimiter, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.trim().length < 2 || username.trim().length > 20) {
      return res.status(400).json({ error: 'Username must be 2-20 characters' });
    }

    const cleanUsername = username.trim();

    // Check if username is taken (case-insensitive)
    const existing = await User.findOne({ 
      username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') } 
    });
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const user = await User.create({
      username: cleanUsername,
      isGuest: true,
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        avatarColor: user.avatarColor,
        isGuest: true,
      },
    });
  } catch (error) {
    console.error('[Auth] Guest creation error:', error);
    res.status(500).json({ error: 'Failed to create guest user' });
  }
});

/**
 * POST /api/auth/google
 * Handle Google sign-in.
 * NOTE: In a real app, you would verify the idToken from Google.
 */
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { email, username, googleId } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ error: 'Invalid Google data' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (!user) {
      // Check if username is taken
      const usernameTaken = await User.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });
      
      const finalUsername = usernameTaken 
        ? `${username}${Math.floor(1000 + Math.random() * 9000)}` 
        : username;

      user = await User.create({
        username: finalUsername,
        email: email.toLowerCase(),
        googleId,
        isGuest: false,
      });
    } else if (!user.googleId) {
      // Link Google ID if user already exists by email
      user.googleId = googleId;
      await user.save();
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        avatarColor: user.avatarColor,
        isGuest: false,
      },
    });
  } catch (error) {
    console.error('[Auth] Google error:', error);
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

/**
 * GET /api/auth/me
 * Verify token and return user data.
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
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
