/**
 * Development-specific configuration overrides
 * This file is loaded when NODE_ENV=development
 */

const developmentConfig = {
  // Relaxed security for development
  helmet: {
    contentSecurityPolicy: false, // Disabled for easier development
    hsts: false
  },

  // Development rate limiting (more permissive)
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // More requests allowed for development
    message: {
      error: 'Too many requests, please slow down.',
      retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Development session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    name: 'connect.sid.dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // Allow HTTP in development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours for development
    },
    rolling: true,
    unset: 'destroy'
  },

  // Development logging (verbose)
  logging: {
    level: 'debug',
    format: 'dev',
    timestamp: true,
    colorize: true
  },

  // Development database settings
  database: {
    connectionTimeout: 10000,
    maxPoolSize: 5,
    minPoolSize: 1,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    bufferCommands: true,
    bufferMaxEntries: 0
  },

  // Development caching (shorter TTL)
  cache: {
    defaultTtl: 300, // 5 minutes
    maxKeys: 100,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Development file upload (more permissive)
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB for development
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    uploadDir: 'public/uploads',
    tempDir: 'temp/uploads'
  },

  // Development monitoring
  monitoring: {
    enabled: true,
    collectMetrics: true,
    healthCheckPath: '/health',
    metricsPath: '/metrics', // Available in development
    logSlowQueries: true,
    slowQueryThreshold: 500 // ms (lower threshold for development)
  },

  // Development-specific settings
  development: {
    hotReload: true,
    sourceMaps: true,
    debugMode: true,
    verboseErrors: true,
    skipAuth: false // Set to true for testing without authentication
  }
}

module.exports = developmentConfig