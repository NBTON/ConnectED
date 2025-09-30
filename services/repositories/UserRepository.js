const BaseRepository = require('./BaseRepository')
const { User } = require('../../models/db_schema')

/**
 * Repository for User entity operations
 * Handles all data access logic for users
 */
class UserRepository extends BaseRepository {
  constructor() {
    super(User)
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User or null if not found
   */
  async findByEmail(email) {
    try {
      return await this.findOne({ email })
    } catch (error) {
      this.handleError(error, 'findByEmail')
      return null
    }
  }

  /**
   * Find user by username
   * @param {string} username - Username
   * @returns {Promise<Object|null>} User or null if not found
   */
  async findByUsername(username) {
    try {
      return await this.findOne({ username })
    } catch (error) {
      this.handleError(error, 'findByUsername')
      return null
    }
  }

  /**
   * Find users by IDs
   * @param {Array<string>} userIds - Array of user IDs
   * @returns {Promise<Array>} Array of users
   */
  async findByIds(userIds) {
    try {
      if (!userIds.length) return []

      const objectIds = userIds.map(id => this.toObjectId(id))
      return await this.find({ _id: { $in: objectIds } })
    } catch (error) {
      this.handleError(error, 'findByIds')
      return []
    }
  }

  /**
   * Create new user with validation
   * @param {Object} userData - User data
   * @param {string} userData.email - User email
   * @param {string} userData.username - Username
   * @param {string} userData.password - Hashed password
   * @returns {Promise<Object>} Created user
   */
  async createUser(userData) {
    try {
      // Validate required fields
      if (!userData.email || !userData.username || !userData.password) {
        throw new Error('Email, username, and password are required')
      }

      // Check for existing email/username
      const existingEmail = await this.findByEmail(userData.email)
      if (existingEmail) {
        throw new Error('Email already exists')
      }

      const existingUsername = await this.findByUsername(userData.username)
      if (existingUsername) {
        throw new Error('Username already exists')
      }

      return await this.create(userData)
    } catch (error) {
      this.handleError(error, 'createUser')
      throw error
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>} Updated user or null if not found
   */
  async updateProfile(userId, updateData) {
    try {
      // Remove fields that shouldn't be updated directly
      const { password, _id, __v, ...safeUpdateData } = updateData

      return await this.updateById(userId, safeUpdateData)
    } catch (error) {
      this.handleError(error, 'updateProfile')
      return null
    }
  }

  /**
   * Update user password
   * @param {string} userId - User ID
   * @param {string} hashedPassword - New hashed password
   * @returns {Promise<Object|null>} Updated user or null if not found
   */
  async updatePassword(userId, hashedPassword) {
    try {
      return await this.updateById(userId, { password: hashedPassword })
    } catch (error) {
      this.handleError(error, 'updatePassword')
      return null
    }
  }

  /**
   * Search users by username or email
   * @param {string} searchTerm - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of matching users
   */
  async searchUsers(searchTerm, limit = 10) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        return []
      }

      const regex = new RegExp(searchTerm.trim(), 'i')
      return await this.find(
        {
          $or: [
            { username: { $regex: regex } },
            { email: { $regex: regex } }
          ]
        },
        {
          limit,
          select: 'username email' // Only return safe fields
        }
      )
    } catch (error) {
      this.handleError(error, 'searchUsers')
      return []
    }
  }
}

module.exports = UserRepository