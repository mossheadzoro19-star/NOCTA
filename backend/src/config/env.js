const logger = require('./logger');

const DEFAULT_JWT_SECRET = 'nocta-dev-secret-change-in-production';

/**
 * Validate all required environment variables at startup.
 * Fails fast in production if anything is misconfigured.
 */
function validateEnv() {
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.fatal({ missing }, 'Missing required environment variables');
    process.exit(1);
  }

  // JWT secret — crash in production if still using default
  if (process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      logger.fatal('JWT_SECRET is set to the default value. Cannot start in production.');
      process.exit(1);
    }
    logger.warn('Using default JWT_SECRET. Set a unique secret before deploying.');
  }

  // Warn about optional but recommended vars
  if (!process.env.CLIENT_URL) {
    logger.warn('CLIENT_URL not set, defaulting to http://localhost:3000');
  }
}

module.exports = validateEnv;
