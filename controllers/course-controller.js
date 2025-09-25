const { Course } = require("../models/db_schema")
const multer = require("multer")

const RECORDS_PER_PAGE = 6

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/courses"),
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}_${file.originalname}`
    cb(null, fileName)
  },
})

const multerStorage = multer({ storage })

const addCoursePostAction = async (req, res) => {
  try {
    const payload = { ...req.body }
    if (req.file?.filename) payload.image = req.file.filename
    const newCourse = Course.create(payload)
    req.session.flash = { type: "success", message: "Course created." }
    res.redirect("/courses")
  } catch (error) {
    console.log("Course Added Failure!", error)
    req.session.flash = { type: "error", message: "Failed to create course." }
    res.redirect("/courses/add")
  }
}

const renderCourseListing = async (req, res) => {
  let currentPage = parseInt(req.query?.page ?? "1", 10)
  if (Number.isNaN(currentPage) || currentPage < 1) currentPage = 1

  const text = req.query.search
  let searchQuery = {}
  if (text && text.trim().length > 0) {
    searchQuery = { search: text.trim() }
  }

  const totalCount = Course.count(searchQuery)
  const totalPages = Math.max(1, Math.ceil(totalCount / RECORDS_PER_PAGE))
  if (currentPage > totalPages) currentPage = totalPages

  const skipOffset = (currentPage - 1) * RECORDS_PER_PAGE
  const courses = Course.find({
    ...searchQuery,
    skip: skipOffset,
    limit: RECORDS_PER_PAGE
  })

  res.render("course-list.njk", { courses, totalPages, currentPage, text })
}

const renderAddCourse = (req, res) => {
  res.render("add-course.njk")
}

const renderMain = (req, res) => {
  res.render("main.njk")
}

const renderAbout = (req, res) => {
  res.render("about.njk")
}

module.exports = {
  renderCourseListing,
  renderAddCourse,
  renderMain,
  renderAbout,
  addCoursePostAction,
  multerStorage,
}
