const express = require("express")
const session = require("express-session")
const MongoStore = require("connect-mongo")
const cors = require("cors")
const nunjucks = require("nunjucks")
const compression = require("compression")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const fs = require("fs")
const config = require("./config")

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: config.CORS_ORIGIN, credentials: false }))
app.use(compression())
app.use(helmet(config.isProd ? {
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
} : { contentSecurityPolicy: false }))

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

const sessionSecret = config.SESSION_SECRET
const mongoUrl = config.MONGODB_URI

let sessionStore
try {
  sessionStore = MongoStore.create({ mongoUrl })
} catch (err) {
  console.warn("Mongo session store init failed, falling back to MemoryStore. Error:", err?.message)
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}))

// Global rate limit (basic hardening)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
})
app.use(globalLimiter)

// Stricter rate limit for login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again later.",
})
app.use('/login', loginLimiter)

const { flashMiddleware } = require('./middleware/flash')
app.use(flashMiddleware)

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

app.use((req, res) => {
  res.status(404)
  res.render('404.njk', { title: 'Not Found' })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500)
  res.render('500.njk', { title: 'Server Error' })
})

const PORT = config.PORT
connectDB().finally(() => {
  app.listen(PORT, () => console.log(`server running on port ${PORT}`))
})

module.exports = app
