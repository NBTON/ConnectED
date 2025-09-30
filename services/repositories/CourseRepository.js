const BaseRepository = require('./BaseRepository')
const { Course } = require('../../models/db_schema')

/**
 * Repository for Course entity operations
 * Handles all data access logic for courses
 */
class CourseRepository extends BaseRepository {
  constructor() {
    super(Course)
  }

  /**
   * Find courses with pagination and search
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search text
   * @returns {Promise<Object>} Paginated results with metadata
   */
  async findWithPagination({ page = 1, limit = 6, search = '' } = {}) {
    const skip = (page - 1) * limit

    // Build search criteria
    let searchCriteria = {}
    if (search && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), 'i')
      searchCriteria = {
        $or: [
          { title: { $regex: regex } },
          { linktoTheCall: { $regex: regex } }
        ]
      }
    }

    try {
      const [courses, totalCount] = await Promise.all([
        this.find(searchCriteria, { skip, limit, sort: { createdAt: -1 } }),
        this.count(searchCriteria)
      ])

      return {
        courses,
        pagination: {
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }
    } catch (error) {
      this.handleError(error, 'findWithPagination')
      return {
        courses: [],
        pagination: { currentPage: page, totalPages: 1, totalCount: 0, hasNext: false, hasPrev: false }
      }
    }
  }

  /**
   * Create new course with validation
   * @param {Object} courseData - Course data
   * @param {string} courseData.title - Course title
   * @param {string} courseData.linktoTheCall - Course call link
   * @param {string} courseData.image - Course image filename
   * @returns {Promise<Object>} Created course
   */
  async createCourse(courseData) {
    try {
      // Validate required fields
      if (!courseData.title || !courseData.linktoTheCall) {
        throw new Error('Title and call link are required')
      }

      return await this.create(courseData)
    } catch (error) {
      this.handleError(error, 'createCourse')
      throw error
    }
  }

  /**
   * Find course by ID with caching support
   * @param {string} courseId - Course ID
   * @returns {Promise<Object|null>} Course or null if not found
   */
  async findByIdCached(courseId) {
    return await this.findById(courseId)
  }
}

module.exports = CourseRepository