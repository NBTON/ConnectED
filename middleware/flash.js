function flashMiddleware(req, res, next) {
  res.locals.flash = req.session?.flash || null
  if (req.session) req.session.flash = null
  next()
}

module.exports = { flashMiddleware }
