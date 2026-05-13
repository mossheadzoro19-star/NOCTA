require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const connectDB = require('./config/db');
const initSocket = require('./socket');
const { apiLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const healthRoutes = require('./routes/health');

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/health', healthRoutes);

// Socket.IO
const io = initSocket(httpServer);

// File Upload Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only videos are allowed'));
  }
});

// Upload Route
app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Global error handler — catch unhandled route/middleware errors
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect DB and start server
const PORT = process.env.PORT || 3001;

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`\n  ╔══════════════════════════════════╗`);
      console.log(`  ║  NOCTA Backend — port ${PORT}        ║`);
      console.log(`  ║  Socket.IO ready                 ║`);
      console.log(`  ║  MongoDB connected               ║`);
      console.log(`  ╚══════════════════════════════════╝\n`);
    });
  })
  .catch((err) => {
    console.error('[Server] Failed to connect to MongoDB:', err.message);
    console.log('[Server] Starting WITHOUT database — socket features only...\n');
    httpServer.listen(PORT, () => {
      console.log(`\n  ╔══════════════════════════════════╗`);
      console.log(`  ║  NOCTA Backend — port ${PORT}        ║`);
      console.log(`  ║  Socket.IO ready                 ║`);
      console.log(`  ║  ⚠ MongoDB NOT connected         ║`);
      console.log(`  ╚══════════════════════════════════╝\n`);
    });
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  io.close();
  httpServer.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received. Shutting down...');
  io.close();
  httpServer.close(() => {
    process.exit(0);
  });
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});
