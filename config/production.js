/**
 * Production-specific configuration overrides
 * This file is loaded when NODE_ENV=production
 */

const productionConfig = {
  // Enhanced security for production
  helmet: {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  },

  // Production rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    message: {
      error: 'Too many requests, please try again later.',
      retryAfter: 900 // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Production session configuration
  session: {
    secret: process.env.SESSION_SECRET,
    name: 'connect.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: true, // HTTPS only
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    rolling: true,
    unset: 'destroy',
    proxy: true // Trust proxy headers
  },

  // Production logging
  logging: {
    level: 'warn', // Only warnings and errors in production
    format: 'combined',
    timestamp: true
  },

  // Production database settings
  database: {
    connectionTimeout: 30000,
    maxPoolSize: 20,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    bufferMaxEntries: 0
  },

  // Production caching
  cache: {
    defaultTtl: 1800, // 30 minutes
    maxKeys: 1000,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Production file upload
  upload: {
    maxFileSize: 2 * 1024 * 1024, // 2MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    uploadDir: 'public/uploads',
    tempDir: 'temp/uploads'
  },

  // Production monitoring
  monitoring: {
    enabled: true,
    collectMetrics: true,
    healthCheckPath: '/health',
    metricsPath: '/metrics',
    logSlowQueries: true,
    slowQueryThreshold: 1000 // ms
  }
}

module.exports = productionConfig