const { registerUser, renderRegister, loginUser, renderLogin, logoutUser } = require("../controllers/user_controller")

const router = require("express").Router()

router.get("/register", renderRegister)
router.post("/register", registerUser)

router.get("/login", renderLogin)
router.post("/login", loginUser)

router.post("/logout", logoutUser)

module.exports = router
