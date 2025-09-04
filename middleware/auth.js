function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next()
  }
  req.session.flash = { type: 'warning', message: 'Please sign in to continue.' }
  res.redirect('/login')
}

module.exports = { requireAuth }
