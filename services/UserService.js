const BaseService = require('./BaseService')
const UserRepository = require('./repositories/UserRepository')
const bcrypt = require('bcrypt')

/**
 * Service class for user-related business logic
 * Handles all user operations and business rules
 */
class UserService extends BaseService {
  /**
   * @param {Object} options - Service options
   * @param {Object} options.cacheService - Cache service instance
   */
  constructor({ cacheService } = {}) {
    super({ userRepository: new UserRepository() }, cacheService)
    this.userRepository = this.repositories.userRepository
  }

  /**
   * Create new user account
   * @param {Object} userData - User data
   * @param {string} userData.email - User email
   * @param {string} userData.username - Username
   * @param {string} userData.password - Plain text password
   * @returns {Promise<Object>} Created user (without password)
   */
  async createUser(userData) {
    try {
      // Validate user data
      this.validateUserData(userData)

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10)

      const user = await this.userRepository.createUser({
        email: userData.email,
        username: userData.username,
        password: hashedPassword
      })

      // Remove password from returned user object
      const { password, ...userWithoutPassword } = user.toObject ? user.toObject() : user
      return userWithoutPassword
    } catch (error) {
      this.handleError(error, 'createUser')
      throw error
    }
  }

  /**
   * Authenticate user with email/username and password
   * @param {string} identifier - Email or username
   * @param {string} password - Plain text password
   * @returns {Promise<Object|null>} User if authenticated, null otherwise
   */
  async authenticateUser(identifier, password) {
    try {
      if (!identifier || !password) {
        throw new Error('Email/username and password are required')
      }

      // Find user by email or username
      let user = await this.userRepository.findByEmail(identifier)
      if (!user) {
        user = await this.userRepository.findByUsername(identifier)
      }

      if (!user) {
        return null // User not found
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        return null // Invalid password
      }

      // Remove password from returned user object
      const { password: _, ...userWithoutPassword } = user
      return userWithoutPassword
    } catch (error) {
      this.handleError(error, 'authenticateUser')
      throw error
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User or null if not found
   */
  async getUserById(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required')
      }

      return await this.userRepository.findById(userId)
    } catch (error) {
      this.handleError(error, 'getUserById')
      throw error
    }
  }

  /**
   * Get user profile (without sensitive data)
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User profile or null if not found
   */
  async getUserProfile(userId) {
    try {
      const user = await this.getUserById(userId)
      if (!user) return null

      // Remove sensitive data
      const { password, ...profile } = user
      return profile
    } catch (error) {
      this.handleError(error, 'getUserProfile')
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
      if (!userId) {
        throw new Error('User ID is required')
      }

      // Validate update data
      this.validateUpdateData(updateData)

      const updatedUser = await this.userRepository.updateProfile(userId, updateData)

      if (updatedUser) {
        // Invalidate user cache
        await this.deleteCacheKey(`user:${userId}`)
      }

      return updatedUser
    } catch (error) {
      this.handleError(error, 'updateProfile')
      throw error
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current plain text password
   * @param {string} newPassword - New plain text password
   * @returns {Promise<boolean>} True if password changed successfully
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      if (!userId || !currentPassword || !newPassword) {
        throw new Error('User ID, current password, and new password are required')
      }

      // Validate new password
      this.validatePassword(newPassword)

      // Get current user
      const user = await this.userRepository.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password)
      if (!isValidPassword) {
        throw new Error('Current password is incorrect')
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10)

      // Update password
      const updated = await this.userRepository.updatePassword(userId, hashedNewPassword)

      if (updated) {
        // Invalidate user cache
        await this.deleteCacheKey(`user:${userId}`)
      }

      return !!updated
    } catch (error) {
      this.handleError(error, 'changePassword')
      throw error
    }
  }

  /**
   * Search users by term
   * @param {string} searchTerm - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of matching users (without sensitive data)
   */
  async searchUsers(searchTerm, limit = 10) {
    try {
      const users = await this.userRepository.searchUsers(searchTerm, limit)

      // Remove sensitive data from results
      return users.map(user => {
        const { password, ...safeUser } = user
        return safeUser
      })
    } catch (error) {
      this.handleError(error, 'searchUsers')
      throw error
    }
  }

  /**
   * Validate user registration data
   * @param {Object} userData - User data to validate
   * @throws {Error} If validation fails
   */
  validateUserData(userData) {
    const errors = []

    if (!userData.email || !this.isValidEmail(userData.email)) {
      errors.push('Valid email is required')
    }

    if (!userData.username || userData.username.length < 3 || userData.username.length > 30) {
      errors.push('Username must be 3-30 characters')
    } else if (!/^[a-zA-Z0-9_]+$/.test(userData.username)) {
      errors.push('Username can only contain letters, numbers, and underscores')
    }

    if (!userData.password || userData.password.length < 6) {
      errors.push('Password must be at least 6 characters')
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '))
    }
  }

  /**
   * Validate user update data
   * @param {Object} updateData - Data to validate
   * @throws {Error} If validation fails
   */
  validateUpdateData(updateData) {
    const errors = []

    if (updateData.email && !this.isValidEmail(updateData.email)) {
      errors.push('Valid email is required')
    }

    if (updateData.username && (updateData.username.length < 3 || updateData.username.length > 30)) {
      errors.push('Username must be 3-30 characters')
    } else if (updateData.username && !/^[a-zA-Z0-9_]+$/.test(updateData.username)) {
      errors.push('Username can only contain letters, numbers, and underscores')
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '))
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @throws {Error} If password is too weak
   */
  validatePassword(password) {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    if (password.length > 128) {
      throw new Error('Password must be less than 128 characters')
    }
  }

  /**
   * Check if email format is valid
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}

module.exports = UserService