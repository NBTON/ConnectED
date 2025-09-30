const express = require("express")
const session = require("express-session")
const MongoStore = require("connect-mongo")
const cors = require("cors")
const nunjucks = require("nunjucks")
const compression = require("compression")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const fs = require("fs")
const path = require("path")
const config = require("./config")

const app = express()

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true)

    // In production, check against allowed origins
    if (config.isProd) {
      const allowedOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim())
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      } else {
        return callback(new Error('Not allowed by CORS'), false)
      }
    } else {
      // In development, allow all origins
      return callback(null, true)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}
app.use(cors(corsOptions))

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  }
}))

app.use(helmet(config.isProd ? {
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
} : {
  contentSecurityPolicy: false,
  hsts: false
}))

if (config.isProd) {
  // Ensure secure cookies behind reverse proxies
  app.set("trust proxy", 1)
}

nunjucks.configure('views', { autoescape: true, express: app })

// Ensure uploads directory exists to avoid runtime errors
try {
  fs.mkdirSync("public/uploads/courses", { recursive: true })
} catch (_) {}

// Static assets with caching
app.use(express.static("public", {
  maxAge: config.STATIC_MAX_AGE,
  immutable: true,
}))

const { connectDB } = require("./db")
const cacheService = require("./services/cache")
const performanceMonitor = require("./services/performance")

const sessionSecret = config.SESSION_SECRET
const mongoUrl = config.MONGODB_URI

// Initialize cache service
cacheService.connect().catch(err => {
  console.warn("Cache service initialization failed:", err?.message)
})

let sessionStore
try {
  // Try Redis store first for better performance
  const RedisStore = require('connect-redis')(session)
  const redisClient = require('redis').createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' })

  sessionStore = new RedisStore({
    client: redisClient,
    prefix: 'session:'
  })

  redisClient.connect().catch(err => {
    console.warn("Redis session store failed, falling back to MongoStore. Error:", err?.message)
    throw err
  })
} catch (err) {
  console.warn("Redis session store init failed, falling back to MongoStore. Error:", err?.message)
  try {
    sessionStore = MongoStore.create({ mongoUrl })
  } catch (mongoErr) {
    console.warn("Mongo session store init failed, falling back to MemoryStore. Error:", mongoErr?.message)
  }
}

app.use(session({
  secret: sessionSecret,
  name: 'connect.sid', // Don't use default session name
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'strict', // More secure than 'lax'
    secure: config.isProd,
    maxAge: config.SESSION_COOKIE_MAX_AGE,
  },
  // Enhanced security settings
  rolling: config.SESSION_ROLLING, // Reset expiration on activity
  unset: 'destroy', // Clean up session on logout
  proxy: config.isProd, // Trust proxy in production
  // Security hardening
  secret: sessionSecret,
  genid: (req) => {
    // Use a more secure session ID generator
    return require('crypto').randomBytes(32).toString('hex')
  }
}))

// Session cleanup middleware
app.use((req, res, next) => {
  // Clean up flash messages after they're consumed
  if (req.session && req.session.flash) {
    const flash = req.session.flash
    delete req.session.flash
    req.session.save(err => {
      if (err) console.warn('Session save error:', err)
      res.locals.flash = flash
      next()
    })
  } else {
    res.locals.flash = null
    next()
  }
})

// Enhanced global rate limit
const globalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW / 1000),
      message: 'Too many requests, please try again later.'
    })
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health'
  }
})
app.use(globalLimiter)

// Stricter rate limit for authentication routes
const authLimiter = rateLimit({
  windowMs: config.LOGIN_RATE_LIMIT_WINDOW,
  max: config.LOGIN_RATE_LIMIT_MAX,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: Math.ceil(config.LOGIN_RATE_LIMIT_WINDOW / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      retryAfter: Math.ceil(config.LOGIN_RATE_LIMIT_WINDOW / 1000),
      message: 'Please try again later.'
    })
  },
  skipSuccessfulRequests: true // Don't count successful requests
})
app.use(['/login', '/register'], authLimiter)

const { flashMiddleware } = require('./middleware/flash')
app.use(flashMiddleware)

// Performance monitoring middleware
app.use(performanceMonitor.middleware())

app.use((req, res, next) => {
  res.locals.currentUser = req.session?.userId ? { id: req.session.userId, username: req.session.username, email: req.session.userEmail } : null
  res.locals.currentYear = new Date().getFullYear()
  next()
})

const userRoutes = require("./routes/user_router")
const courseRoutes = require("./routes/course-router")
const subjectRedirectRoutes = require("./routes/subject-router")
const groupRoutes = require("./routes/group-router")

app.use("/", userRoutes)
app.use("/", courseRoutes)
app.use("/", subjectRedirectRoutes)
app.use("/", groupRoutes)

// Health check endpoint for monitoring
app.get("/health", (req, res) => {
  const healthData = performanceMonitor.getHealthData()
  const statusCode = healthData.status === 'healthy' ? 200 : 503

  res.status(statusCode).json({
    status: healthData.status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: require('./package.json').version,
    performance: healthData
  })
})

// Performance metrics endpoint (development only)
if (!config.isProd) {
  app.get("/metrics", (req, res) => {
    res.json(performanceMonitor.getStats())
  })
}

app.use((req, res) => {
  res.status(404)
  res.render('404.njk', { title: 'Not Found' })
})

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)

  // Don't expose stack traces in production
  const errorDetails = config.isProd ? {} : { stack: err.stack }

  res.status(err.status || 500)
  res.render('500.njk', {
    title: 'Server Error',
    error: config.isProd ? 'Internal Server Error' : err.message,
    ...errorDetails
  })
})

// Global promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason)
  // In production, you might want to exit the process
  if (config.isProd) {
    console.error('Shutting down due to unhandled promise rejection')
    process.exit(1)
  }
})

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // In production, you might want to exit the process
  if (config.isProd) {
    console.error('Shutting down due to uncaught exception')
    process.exit(1)
  }
})

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  const { disconnectDB } = require('./db')
  await disconnectDB()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully')
  const { disconnectDB } = require('./db')
  await disconnectDB()
  process.exit(0)
})

const PORT = config.PORT
connectDB().finally(() => {
  app.listen(PORT, () => console.log(`server running on port ${PORT}`))
})

module.exports = app
