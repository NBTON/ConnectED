const serviceContainer = require('../services/ServiceContainer')
const multer = require('multer')
const fs = require('fs').promises
const path = require('path')

/**
 * Course Controller - Handles HTTP requests for course operations
 * Refactored to follow SOLID principles with proper separation of concerns
 */
class CourseController {
  constructor() {
    // Get services from container (Dependency Injection)
    this.courseService = serviceContainer.get('courseService')
    this.validationService = serviceContainer.get('validationService')
    this.errorHandler = serviceContainer.get('errorHandler')

    // Configure multer for file uploads
    this.setupMulter()
  }

  /**
   * Setup multer configuration for file uploads
   */
  setupMulter() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = 'public/uploads/courses'
        fs.mkdir(uploadDir, { recursive: true })
          .then(() => cb(null, uploadDir))
          .catch(err => cb(err))
      },
      filename: (req, file, cb) => {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}_${file.originalname}`
        cb(null, fileName)
      },
    })

    const fileFilter = (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      const maxSize = 2 * 1024 * 1024 // 2MB

      if (!allowed.includes(file.mimetype)) {
        return cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'))
      }

      if (file.size > maxSize) {
        return cb(new Error('File too large. Maximum size is 2MB.'))
      }

      cb(null, true)
    }

    this.multerStorage = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 2 * 1024 * 1024,
        files: 1
      },
    })
  }

  /**
   * Handle multer errors
   * @param {Error} err - Multer error
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  handleMulterErrors(err, req, res, next) {
    if (err instanceof multer.MulterError) {
      this.cleanupFailedUpload(req.file?.path)

      let message = 'File upload error.'
      switch (err.code) {
        case 'LIMIT_FILE_SIZE':
          message = 'File too large. Maximum size is 2MB.'
          break
        case 'LIMIT_FILE_COUNT':
          message = 'Too many files. Only one file is allowed.'
          break
        case 'LIMIT_UNEXPECTED_FILE':
          message = 'Unexpected file field.'
          break
      }

      req.session.flash = { type: 'error', message }
      return res.redirect('back')
    }

    if (err.message.includes('Invalid file type') || err.message.includes('File too large')) {
      this.cleanupFailedUpload(req.file?.path)
      req.session.flash = { type: 'error', message: err.message }
      return res.redirect('back')
    }

    next(err)
  }

  /**
   * Cleanup failed upload
   * @param {string} filePath - Path to file to cleanup
   */
  cleanupFailedUpload(filePath) {
    if (filePath) {
      fs.unlink(filePath).catch(err => {
        console.warn('Failed to cleanup uploaded file:', filePath, err.message)
      })
    }
  }

  /**
   * Render course listing page
   * @route GET /courses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async renderCourseListing(req, res) {
    try {
      const { page = 1, search = '' } = req.query

      // Validate pagination parameters
      const paginationValidation = this.validationService.validatePagination({ page })
      const searchValidation = this.validationService.validateSearch({ search })

      if (!paginationValidation.isValid || !searchValidation.isValid) {
        req.session.flash = { type: 'error', message: 'Invalid search parameters.' }
        return res.redirect('/courses')
      }

      // Get courses using service
      const result = await this.courseService.getCourseListing({
        page: paginationValidation.sanitized.page,
        limit: 6,
        search: searchValidation.sanitized.search
      })

      res.render('course-list.njk', {
        courses: result.courses,
        totalPages: result.pagination.totalPages,
        currentPage: result.pagination.currentPage,
        text: searchValidation.sanitized.search || ''
      })
    } catch (error) {
      console.error('renderCourseListing error', error)
      res.status(500).render('500.njk')
    }
  }

  /**
   * Render add course form
   * @route GET /courses/add
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  renderAddCourse(req, res) {
    res.render('add-course.njk')
  }

  /**
   * Create new course
   * @route POST /courses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async addCoursePostAction(req, res) {
    try {
      const { title, linktoTheCall } = req.body

      // Validate course data
      const validation = this.validationService.validateCourseData({
        title,
        linktoTheCall
      })

      if (!validation.isValid) {
        this.cleanupFailedUpload(req.file?.path)
        req.session.flash = {
          type: 'error',
          message: 'Please fix the errors below.',
          errors: validation.errors
        }
        return res.redirect('/courses/add')
      }

      const sanitizedData = validation.sanitized

      // Add image if uploaded
      if (req.file?.filename) {
        sanitizedData.image = req.file.filename
      }

      // Create course using service
      await this.courseService.createCourse(sanitizedData)

      req.session.flash = { type: 'success', message: 'Course created.' }
      res.redirect('/courses')
    } catch (error) {
      this.cleanupFailedUpload(req.file?.path)
      const errorResponse = this.errorHandler.handleControllerError(error, 'addCoursePostAction', req)
      req.session.flash = { type: 'error', message: errorResponse.error.message }
      res.redirect('/courses/add')
    }
  }

  /**
   * Render main page
   * @route GET /
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  renderMain(req, res) {
    res.render('main.njk')
  }

  /**
   * Render about page
   * @route GET /about
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  renderAbout(req, res) {
    res.render('about.njk')
  }
}

// Create controller instance
const courseController = new CourseController()

// Export individual methods for use in routes
module.exports = {
  renderCourseListing: (req, res) => courseController.renderCourseListing(req, res),
  renderAddCourse: (req, res) => courseController.renderAddCourse(req, res),
  renderMain: (req, res) => courseController.renderMain(req, res),
  renderAbout: (req, res) => courseController.renderAbout(req, res),
  addCoursePostAction: (req, res) => courseController.addCoursePostAction(req, res),
  multerStorage: courseController.multerStorage,
  handleMulterErrors: (err, req, res, next) => courseController.handleMulterErrors(err, req, res, next),
}