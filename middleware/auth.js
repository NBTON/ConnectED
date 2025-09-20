const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_change_me'

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next()
  }
  if (!req.session) {
    req.session = {}
  }
  req.session.flash = { type: 'warning', message: 'Please sign in to continue.' }
  res.redirect('/login')
}

function requireJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    req.user = decoded
    next()
  })
}

function generateToken(user) {
  return jwt.sign({ id: user._id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '24h' })
}

module.exports = { requireAuth, requireJWT, generateToken }
