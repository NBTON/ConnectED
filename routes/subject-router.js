const router = require('express').Router()

router.get('/subjects', (req, res) => res.redirect(301, '/courses'))
router.get('/subjects/add', (req, res) => res.redirect(301, '/courses/add'))
router.post('/subjects/add', (req, res) => res.redirect(307, '/courses/add'))

module.exports = router
