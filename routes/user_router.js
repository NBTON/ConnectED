

const { registerUser, renderRegister, loginUser, renderLogin } = require("../controllers/user_controller")

const router = require("express").Router()

router.get("/register", renderRegister)

router.post("/register", registerUser)

router.get("/login", renderLogin)

router.post("/login", loginUser)

module.exports = router