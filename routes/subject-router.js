

const { renderSubjectListing, renderAddSubject, renderMain, addSubjectPostAction, renderAbout, multerStorage } = require("../controllers/subject-controller")

const router = require("express").Router()

router.get("/subjects", renderSubjectListing)

router.get("/subjects/add", renderAddSubject)

router.post("/subjects/add", multerStorage.single("image"), addSubjectPostAction)

router.get("/", renderMain)
router.get("/about", renderAbout)

module.exports = router