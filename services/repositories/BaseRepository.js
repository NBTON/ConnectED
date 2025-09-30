const mongoose = require('mongoose')

/**
 * Base repository class providing common data access operations
 * Implements Repository pattern for data access abstraction
 *
 * This class serves as the foundation for all repository classes, providing
 * standardized CRUD operations and query methods. It abstracts the data access
 * layer from business logic, following the Dependency Inversion Principle.
 *
 * @example
 * ```javascript
 * class UserRepository extends BaseRepository {
 *   constructor() {
 *     super(User)
 *   }
 *
 *   async findActiveUsers() {
 *     return this.find({ active: true })
 *   }
 * }
 * ```
 */
class BaseRepository {
  /**
   * Initialize repository with mongoose model
   * @param {mongoose.Model} model - Mongoose model for the entity
   * @throws {Error} If model is not provided or invalid
   */
  constructor(model) {
    if (!model || typeof model !== 'function') {
      throw new Error('Valid mongoose model is required')
    }
    this.model = model
  }

  /**
   * Find entity by ID
   * @param {string} id - Entity ID
   * @returns {Promise<Object|null>} Entity or null if not found
   */
  async findById(id) {
    try {
      return await this.model.findById(id).lean()
    } catch (error) {
      this.handleError(error, 'findById')
      return null
    }
  }

  /**
   * Find entities by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options (limit, skip, sort, etc.)
   * @returns {Promise<Array>} Array of entities
   */
  async find(criteria = {}, options = {}) {
    try {
      let query = this.model.find(criteria).lean()

      if (options.limit) query = query.limit(options.limit)
      if (options.skip) query = query.skip(options.skip)
      if (options.sort) query = query.sort(options.sort)
      if (options.select) query = query.select(options.select)

      return await query
    } catch (error) {
      this.handleError(error, 'find')
      return []
    }
  }

  /**
   * Find single entity by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Object|null>} Entity or null if not found
   */
  async findOne(criteria) {
    try {
      return await this.model.findOne(criteria).lean()
    } catch (error) {
      this.handleError(error, 'findOne')
      return null
    }
  }

  /**
   * Count entities by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<number>} Count of matching entities
   */
  async count(criteria = {}) {
    try {
      return await this.model.countDocuments(criteria)
    } catch (error) {
      this.handleError(error, 'count')
      return 0
    }
  }

  /**
   * Create new entity
   * @param {Object} data - Entity data
   * @returns {Promise<Object>} Created entity
   */
  async create(data) {
    try {
      const entity = new this.model(data)
      return await entity.save()
    } catch (error) {
      this.handleError(error, 'create')
      throw error
    }
  }

  /**
   * Update entity by ID
   * @param {string} id - Entity ID
   * @param {Object} data - Update data
   * @returns {Promise<Object|null>} Updated entity or null if not found
   */
  async updateById(id, data) {
    try {
      return await this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean()
    } catch (error) {
      this.handleError(error, 'updateById')
      return null
    }
  }

  /**
   * Delete entity by ID
   * @param {string} id - Entity ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteById(id) {
    try {
      const result = await this.model.findByIdAndDelete(id)
      return !!result
    } catch (error) {
      this.handleError(error, 'deleteById')
      return false
    }
  }

  /**
   * Execute aggregation pipeline
   * @param {Array} pipeline - MongoDB aggregation pipeline
   * @returns {Promise<Array>} Aggregation results
   */
  async aggregate(pipeline) {
    try {
      return await this.model.aggregate(pipeline)
    } catch (error) {
      this.handleError(error, 'aggregate')
      return []
    }
  }

  /**
   * Handle repository-level errors consistently
   * @param {Error} error - Error that occurred
   * @param {string} operation - Operation that failed
   * @throws {Error} Enhanced error with context
   */
  handleError(error, operation) {
    console.error(`${this.constructor.name}:${operation} error`, error)
    throw error
  }

  /**
   * Convert string ID to ObjectId if needed
   * @param {string} id - ID to convert
   * @returns {mongoose.Types.ObjectId|string} ObjectId or original string
   */
  toObjectId(id) {
    if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
      return new mongoose.Types.ObjectId(id)
    }
    return id
  }
}

module.exports = BaseRepository