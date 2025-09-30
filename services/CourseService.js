const BaseService = require('./BaseService')
const CourseRepository = require('./repositories/CourseRepository')

/**
 * Service class for course-related business logic
 * Handles all course operations and business rules
 */
class CourseService extends BaseService {
  /**
   * @param {Object} options - Service options
   * @param {Object} options.cacheService - Cache service instance
   */
  constructor({ cacheService } = {}) {
    super({ courseRepository: new CourseRepository() }, cacheService)
    this.courseRepository = this.repositories.courseRepository
  }

  /**
   * Get course listing with pagination and search
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search term
   * @returns {Promise<Object>} Paginated course results
   */
  async getCourseListing({ page, limit, search } = {}) {
    try {
      const cacheKey = this.generateCacheKey('listing', page, limit, search || '')

      return await this.executeCachedOperation(
        cacheKey,
        () => this.courseRepository.findWithPagination({ page, limit, search }),
        300 // Cache for 5 minutes
      )
    } catch (error) {
      this.handleError(error, 'getCourseListing')
      throw error
    }
  }

  /**
   * Get course by ID
   * @param {string} courseId - Course ID
   * @returns {Promise<Object|null>} Course or null if not found
   */
  async getCourseById(courseId) {
    try {
      if (!courseId) {
        throw new Error('Course ID is required')
      }

      const cacheKey = this.generateCacheKey('detail', courseId)

      return await this.executeCachedOperation(
        cacheKey,
        () => this.courseRepository.findByIdCached(courseId),
        1800 // Cache for 30 minutes
      )
    } catch (error) {
      this.handleError(error, 'getCourseById')
      throw error
    }
  }

  /**
   * Create new course
   * @param {Object} courseData - Course data
   * @param {string} courseData.title - Course title
   * @param {string} courseData.linktoTheCall - Course call link
   * @param {string} courseData.image - Course image filename (optional)
   * @returns {Promise<Object>} Created course
   */
  async createCourse(courseData) {
    try {
      // Validate course data
      this.validateCourseData(courseData)

      const course = await this.courseRepository.createCourse(courseData)

      // Invalidate course listing cache
      await this.invalidateCachePatterns('course:listing:*')

      return course
    } catch (error) {
      this.handleError(error, 'createCourse')
      throw error
    }
  }

  /**
   * Validate course data
   * @param {Object} courseData - Course data to validate
   * @throws {Error} If validation fails
   */
  validateCourseData(courseData) {
    const errors = []

    if (!courseData.title || courseData.title.trim().length === 0) {
      errors.push('Title is required')
    } else if (courseData.title.length > 200) {
      errors.push('Title must be less than 200 characters')
    }

    if (!courseData.linktoTheCall || courseData.linktoTheCall.trim().length === 0) {
      errors.push('Call link is required')
    } else if (courseData.linktoTheCall.length > 500) {
      errors.push('Call link must be less than 500 characters')
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '))
    }
  }

  /**
   * Search courses by text
   * @param {string} searchText - Search text
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchCourses(searchText, page = 1, limit = 6) {
    try {
      if (!searchText || searchText.trim().length < 2) {
        return this.getCourseListing({ page, limit, search: '' })
      }

      return await this.getCourseListing({
        page,
        limit,
        search: searchText.trim()
      })
    } catch (error) {
      this.handleError(error, 'searchCourses')
      throw error
    }
  }

  /**
   * Get course statistics
   * @param {string} courseId - Course ID
   * @returns {Promise<Object>} Course statistics
   */
  async getCourseStats(courseId) {
    try {
      if (!courseId) {
        throw new Error('Course ID is required')
      }

      const cacheKey = this.generateCacheKey('stats', courseId)

      return await this.executeCachedOperation(
        cacheKey,
        async () => {
          const { GroupRepository } = require('./repositories/GroupRepository')
          const groupRepository = new GroupRepository()

          const groupCount = await groupRepository.count({ courseId })

          return {
            groupCount,
            // Add more stats as needed
          }
        },
        600 // Cache for 10 minutes
      )
    } catch (error) {
      this.handleError(error, 'getCourseStats')
      throw error
    }
  }
}

module.exports = CourseService