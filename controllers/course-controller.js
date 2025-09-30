const { Course } = require("../models/db_schema")
const multer = require("multer")
const fs = require("fs").promises
const path = require("path")
const cacheService = require("../services/cache")

const RECORDS_PER_PAGE = 6

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "public/uploads/courses"
    // Ensure directory exists
    fs.mkdir(uploadDir, { recursive: true }).then(() => {
      cb(null, uploadDir)
    }).catch(err => {
      cb(err)
    })
  },
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}_${file.originalname}`
    cb(null, fileName)
  },
})

// Enhanced file filter with better validation
function imageFileFilter(req, file, cb) {
  const config = require("../config")
  const allowedTypes = config.ALLOWED_FILE_TYPES.split(',').map(type => type.trim())
  const maxSize = config.MAX_FILE_SIZE

  // Check file type
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`))
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / 1024 / 1024)
    return cb(new Error(`File too large. Maximum size is ${maxSizeMB}MB.`))
  }

  // Check for suspicious file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.js', '.php']
  const filename = file.originalname.toLowerCase()
  if (dangerousExtensions.some(ext => filename.includes(ext))) {
    return cb(new Error("File type not allowed for security reasons."))
  }

  cb(null, true)
}

// Cleanup function for failed uploads
function cleanupFailedUpload(filePath) {
  if (filePath) {
    fs.unlink(filePath).catch(err => {
      console.warn("Failed to cleanup uploaded file:", filePath, err.message)
    })
  }
}

const multerStorage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 1, // Only one file at a time
    fieldSize: 1024 * 1024 // 1MB field size limit
  },
})

// Enhanced multer error handling middleware
function handleMulterErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    // Cleanup any uploaded files on multer errors
    if (req.file && req.file.path) {
      cleanupFailedUpload(req.file.path)
    }

    let message = "File upload error."
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = "File too large. Maximum size is 2MB."
        break
      case "LIMIT_FILE_COUNT":
        message = "Too many files. Only one file is allowed."
        break
      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected file field."
        break
    }

    req.session.flash = { type: "error", message }
    return res.redirect("back")
  }

  if (err.message.includes("Invalid file type") || err.message.includes("File too large")) {
    // Cleanup any uploaded files on validation errors
    if (req.file && req.file.path) {
      cleanupFailedUpload(req.file.path)
    }

    req.session.flash = { type: "error", message: err.message }
    return res.redirect("back")
  }

  next(err)
}

const addCoursePostAction = async (req, res) => {
  try {
    const title = (req.body.title || "").trim()
    const linktoTheCall = (req.body.linktoTheCall || "").trim()
    const errors = {}

    if (!title) errors.title = "Title is required."
    if (!linktoTheCall) errors.linktoTheCall = "Call link is required."

    if (Object.keys(errors).length) {
      // Cleanup uploaded file if validation fails
      if (req.file?.path) {
        cleanupFailedUpload(req.file.path)
      }
      req.session.flash = { type: "error", message: "Please fix the errors below.", errors }
      return res.redirect("/courses/add")
    }

    const payload = { title, linktoTheCall }
    if (req.file?.filename) payload.image = req.file.filename

    const newCourse = new Course(payload)
    await newCourse.save()

    // Invalidate course listing cache
    await cacheService.invalidatePattern("course:*")

    req.session.flash = { type: "success", message: "Course created." }
    res.redirect("/courses")
  } catch (error) {
    console.log("Course Added Failure!", error)

    // Cleanup uploaded file on database errors
    if (req.file?.path) {
      cleanupFailedUpload(req.file.path)
    }

    req.session.flash = { type: "error", message: "Failed to create course." }
    res.redirect("/courses/add")
  }
}

const renderCourseListing = async (req, res) => {
  try {
    // Enhanced pagination validation
    let currentPage = parseInt(req.query?.page ?? "1", 10)
    if (Number.isNaN(currentPage) || currentPage < 1) {
      currentPage = 1
    }

    // Validate and sanitize search input
    const text = req.query.search ? String(req.query.search).trim() : ""
    if (text.length > 100) {
      req.session.flash = { type: "error", message: "Search term too long." }
      return res.redirect("/courses")
    }

    let searchQuery = {}
    if (text.length > 0) {
      // Use safer regex with escape
      const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedText, "i")
      searchQuery = {
        $or: [
          { title: { $regex: regex } },
          { linktoTheCall: { $regex: regex } },
        ],
      }
    }

    const totalCount = await Course.countDocuments(searchQuery).catch(err => {
      console.error("Error counting courses:", err)
      return 0
    })

    const totalPages = Math.max(1, Math.ceil(totalCount / RECORDS_PER_PAGE))

    // Handle edge case where currentPage exceeds totalPages
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages
    }

    const skipOffset = Math.max(0, (currentPage - 1) * RECORDS_PER_PAGE)

    const courses = await Course.find(searchQuery)
      .skip(skipOffset)
      .limit(RECORDS_PER_PAGE)
      .sort({ createdAt: -1 }) // Most recent first
      .lean()
      .catch(err => {
        console.error("Error fetching courses:", err)
        return []
      })

    // Add pagination metadata
    const pagination = {
      currentPage,
      totalPages,
      totalCount,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null
    }

    res.render("course-list.njk", {
      courses,
      pagination,
      search: text,
      title: "Courses"
    })

  } catch (error) {
    console.error("Error in renderCourseListing:", error)
    req.session.flash = { type: "error", message: "Failed to load courses." }
    res.redirect("/")
  }
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
  handleMulterErrors,
}
