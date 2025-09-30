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

function imageFileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  if (allowed.includes(file.mimetype)) return cb(null, true)
  cb(new Error("Invalid file type. Only images are allowed."))
}

const multerStorage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
})

const addCoursePostAction = async (req, res) => {
  try {
    const title = (req.body.title || "").trim()
    const linktoTheCall = (req.body.linktoTheCall || "").trim()
    const errors = {}
    if (!title) errors.title = "Title is required."
    if (!linktoTheCall) errors.linktoTheCall = "Call link is required."
    if (Object.keys(errors).length) {
      req.session.flash = { type: "error", message: "Please fix the errors below.", errors }
      return res.redirect("/courses/add")
    }
    const payload = { title, linktoTheCall }
    if (req.file?.filename) payload.image = req.file.filename
    const newCourse = new Course(payload)
    await newCourse.save()
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
    const regex = new RegExp(text.trim(), "i")
    searchQuery = {
      $or: [
        { title: { $regex: regex } },
        { linktoTheCall: { $regex: regex } },
      ],
    }
  }

  const totalCount = await Course.countDocuments(searchQuery)
  const totalPages = Math.max(1, Math.ceil(totalCount / RECORDS_PER_PAGE))
  if (currentPage > totalPages) currentPage = totalPages

  const skipOffset = (currentPage - 1) * RECORDS_PER_PAGE
  const courses = await Course.find(searchQuery)
    .skip(skipOffset)
    .limit(RECORDS_PER_PAGE)
    .lean()

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
