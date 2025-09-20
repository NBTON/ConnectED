const { renderCourseListing, renderAddCourse, renderMain, addCoursePostAction, renderAbout, multerStorage, getCourseMatches, getUserMatches, trackCourseActivity } = require("../controllers/course-controller")
const { requireAuth } = require("../middleware/auth")

const router = require("express").Router()

router.get("/courses", requireAuth, trackCourseActivity, renderCourseListing)
router.get("/courses/add", requireAuth, renderAddCourse)
router.post("/courses/add", requireAuth, multerStorage.single("image"), addCoursePostAction)

// AI Matching API routes
router.get("/api/match/courses", requireAuth, getCourseMatches)
router.get("/api/match/users", requireAuth, getUserMatches)

router.get("/", renderMain)
router.get("/about", renderAbout)

module.exports = router
