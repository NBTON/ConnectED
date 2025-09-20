const express = require("express")
const session = require("express-session")
const MemoryStore = require('memorystore')(session)
const MongoStore = require("connect-mongo")
const cors = require("cors")
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const csurf = require('csurf')
const compression = require('compression')
const nunjucks = require("nunjucks")
const { apiLimiter } = require("./middleware/rate-limit")
const { redisClient } = require("./middleware/cache")
const RedisStore = require('connect-redis').default
const http = require("http")
const socketIo = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.socket.io", "https://unpkg.com", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
    },
  },
}))
app.use(cookieParser())
app.use(compression())

// Apply rate limiting
app.use('/api/', apiLimiter)

const env = nunjucks.configure('views', { autoescape: true, express: app });

env.addFilter('date', function(date, format) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date.toString();

  switch (format) {
    case 'YYYY':
      return d.getFullYear().toString();
    case 'YYYY-MM-DD':
      return d.toISOString().split('T')[0];
    case 'MMM DD, YYYY':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    default:
      return d.toLocaleDateString();
  }
});

env.addGlobal('now', function() {
  return new Date();
});
app.use(express.static("public"))

const mongoose = require("./db")

const sessionSecret = process.env.SESSION_SECRET || 'dev_secret_change_me'
const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/conect-ed'

let redisStore;
let memoryStore;
try {
  redisStore = new RedisStore({ client: redisClient });
  console.log('Redis store initialized (will connect when first session is used)');
} catch (error) {
  console.log('Redis unavailable, will use memory store for sessions');
  redisStore = null;
}

app.use(csurf({ cookie: true, secret: process.env.CSRF_SECRET || 'default-secret' }));

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

memoryStore = new MemoryStore({
  checkPeriod: 86400000, // prune stale sessions every 24h
});

const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: redisStore || memoryStore,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false },
});

// Wrap session middleware to handle Redis errors
app.use((req, res, next) => {
  sessionMiddleware(req, res, (err) => {
    if (err && redisStore && err.message.includes('Redis')) {
      console.log('Redis session error, falling back to memory store');
      const fallbackSession = session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        store: memoryStore,
        cookie: { httpOnly: true, sameSite: 'lax', secure: false },
      });
      fallbackSession(req, res, next);
    } else {
      next(err);
    }
  });
});

const { flashMiddleware } = require('./middleware/flash')
app.use(flashMiddleware)

app.use((req, res, next) => {
  res.locals.currentUser = req.session?.userId ? { id: req.session.userId, username: req.session.username, email: req.session.userEmail } : null
  next()
})

// Initialize Socket.io handlers
const { initializeSocket } = require('./socket-handler')
initializeSocket(io)

const userRoutes = require("./routes/user_router")
const courseRoutes = require("./routes/course-router")
const subjectRedirectRoutes = require("./routes/subject-router")
const groupRoutes = require("./routes/group-router")
const realtimeRoutes = require("./routes/realtime-router")
const { initializeBadges } = require("./controllers/badge-controller")
const { startAnalyticsJobs } = require("./controllers/analytics-controller")

app.use("/", userRoutes)
app.use("/", courseRoutes)
app.use("/", subjectRedirectRoutes)
app.use("/", groupRoutes)
app.use("/api/realtime", realtimeRoutes)

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.use((req, res) => {
  res.status(404)
  res.render('404.njk', { title: 'Not Found' })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500)
  res.render('500.njk', { title: 'Server Error' })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, async () => {
  console.log(`server running on port ${PORT}`)
  // Initialize badges on server startup
  await initializeBadges()
  // Start analytics background jobs
  startAnalyticsJobs()
  // Redis connection is handled lazily by the store
  console.log('Server startup complete. Redis will be used if available.');
})


module.exports = { app, io }
