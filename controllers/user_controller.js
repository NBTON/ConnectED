const { User } = require("../models/db_schema")
const bcrypt = require("bcrypt")
const { generateToken } = require("../middleware/auth")

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
    const newUser = new User({ email: email.trim(), username: username.trim(), password: hashPassword })
    await newUser.save()

    req.session.userId = newUser._id
    req.session.username = newUser.username
    req.session.userEmail = newUser.email
    req.session.flash = { type: 'success', message: 'Account created. Welcome!' }
    const token = generateToken(newUser)
    res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 })
    res.redirect('/courses')
  } catch (error) {
    let msg = 'Something went wrong.'
    let errors = {}
    if (error?.code === 11000) {
      const dupField = Object.keys(error.keyValue || {})[0]
      if (dupField) {
        msg = `${dupField.charAt(0).toUpperCase() + dupField.slice(1)} already exists.`
        errors[dupField] = 'Already exists.'
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

    const user = await User.findOne({ username }).lean()

    if (!user?._id) {
      req.session.flash = { type: 'error', message: 'Invalid credentials.', errors: { username: 'Check your username.' } }
      return res.redirect('/login')
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      req.session.flash = { type: 'error', message: 'Invalid credentials.', errors: { password: 'Incorrect password.' } }
      return res.redirect('/login')
    }

    req.session.userId = user._id
    req.session.username = user.username
    req.session.userEmail = user.email
    req.session.flash = { type: 'success', message: 'Signed in successfully.' }
    const token = generateToken(user)
    res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 })
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
    res.clearCookie('token')
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
