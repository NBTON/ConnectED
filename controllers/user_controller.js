const { User } = require("../models/db_schema")
const bcrypt = require("bcrypt")

const registerUser = async (req, res) => {
  try {
    const { email, username, password, confirmPassword } = req.body

    const errors = {}
    if (!email) errors.email = 'Email is required.'
    if (!username) errors.username = 'Username is required.'
    if (!password) errors.password = 'Password is required.'
    if (!confirmPassword) errors.confirmPassword = 'Confirm your password.'
    if (Object.keys(errors).length) {
      req.session.flash = { type: 'error', message: 'Please fix the errors below.', errors }
      return res.redirect('/register')
    }

    if (password !== confirmPassword) {
      req.session.flash = { type: 'error', message: 'Passwords do not match.', errors: { confirmPassword: 'Passwords must match.' } }
      return res.redirect('/register')
    }

    const hashPassword = await bcrypt.hash(password.trim(), 10)
    const newUser = User.create({ email: email.trim(), username: username.trim(), password: hashPassword })

    req.session.userId = newUser._id
    req.session.username = newUser.username
    req.session.userEmail = newUser.email
    req.session.flash = { type: 'success', message: 'Account created. Welcome!' }
    res.redirect('/courses')
  } catch (error) {
    let msg = 'Something went wrong.'
    let errors = {}
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // Check which field is duplicated
      if (error.message.includes('email')) {
        msg = 'Email already exists.'
        errors.email = 'Already exists.'
      } else if (error.message.includes('username')) {
        msg = 'Username already exists.'
        errors.username = 'Already exists.'
      }
    }
    req.session.flash = { type: 'error', message: msg, errors }
    res.redirect('/register')
  }
}

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body
    const errors = {}
    if (!username) errors.username = 'Username is required.'
    if (!password) errors.password = 'Password is required.'
    if (Object.keys(errors).length) {
      req.session.flash = { type: 'error', message: 'Please fill in all fields.', errors }
      return res.redirect('/login')
    }

    const user = User.findByUsername(username)

    if (!user?.id) {
      req.session.flash = { type: 'error', message: 'Invalid credentials.', errors: { username: 'Check your username.' } }
      return res.redirect('/login')
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      req.session.flash = { type: 'error', message: 'Invalid credentials.', errors: { password: 'Incorrect password.' } }
      return res.redirect('/login')
    }

    req.session.userId = user.id
    req.session.username = user.username
    req.session.userEmail = user.email
    req.session.flash = { type: 'success', message: 'Signed in successfully.' }
    const returnTo = req.session.returnTo || '/courses'
    req.session.returnTo = null
    res.redirect(returnTo)
  } catch (error) {
    console.log('Login error', error)
    req.session.flash = { type: 'error', message: 'Something went wrong.' }
    res.redirect('/login')
  }
}

const logoutUser = (req, res) => {
  req.session?.destroy(() => {
    res.clearCookie('connect.sid')
    res.redirect('/login')
  })
}

const renderRegister = (req, res) => {
  res.render('register.njk', { title: 'Register' })
}

const renderLogin = (req, res) => {
  res.render('login.njk', { title: 'Login' })
}

module.exports = { registerUser, renderRegister, loginUser, renderLogin, logoutUser }
