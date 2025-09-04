const { renderCourseListing, renderAddCourse, renderMain, addCoursePostAction, renderAbout, multerStorage } = require("../controllers/course-controller")
const { requireAuth } = require("../middleware/auth")

const router = require("express").Router()

router.get("/courses", requireAuth, renderCourseListing)
router.get("/courses/add", requireAuth, renderAddCourse)
router.post("/courses/add", requireAuth, multerStorage.single("image"), addCoursePostAction)

router.get("/", renderMain)
router.get("/about", renderAbout)

module.exports = router
