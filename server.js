const express = require("express")
const session = require("express-session")
const MongoStore = require("connect-mongo")
const cors = require("cors")
const nunjucks = require("nunjucks")

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

nunjucks.configure('views', { autoescape: true, express: app })
app.use(express.static("public"))

const mongoose = require("./db")

const sessionSecret = process.env.SESSION_SECRET || 'dev_secret_change_me'
const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/conect-ed'

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: false },
}))

const { flashMiddleware } = require('./middleware/flash')
app.use(flashMiddleware)

app.use((req, res, next) => {
  res.locals.currentUser = req.session?.userId ? { id: req.session.userId, username: req.session.username, email: req.session.userEmail } : null
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

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`server running on port ${PORT}`))

module.exports = app
