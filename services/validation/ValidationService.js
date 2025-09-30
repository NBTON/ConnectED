/**
 * Centralized validation service for input validation and sanitization
 * Implements consistent validation patterns across the application
 */
class ValidationService {
  /**
   * Validate and sanitize course creation data
   * @param {Object} data - Course data to validate
   * @returns {Object} Validation result with errors and sanitized data
   */
  static validateCourseData(data) {
    const errors = {}
    const sanitized = {}

    // Validate title
    if (!data.title || typeof data.title !== 'string') {
      errors.title = 'Title is required'
    } else {
      const trimmed = data.title.trim()
      if (trimmed.length === 0) {
        errors.title = 'Title cannot be empty'
      } else if (trimmed.length > 200) {
        errors.title = 'Title must be less than 200 characters'
      } else {
        sanitized.title = trimmed
      }
    }

    // Validate call link
    if (!data.linktoTheCall || typeof data.linktoTheCall !== 'string') {
      errors.linktoTheCall = 'Call link is required'
    } else {
      const trimmed = data.linktoTheCall.trim()
      if (trimmed.length === 0) {
        errors.linktoTheCall = 'Call link cannot be empty'
      } else if (trimmed.length > 500) {
        errors.linktoTheCall = 'Call link must be less than 500 characters'
      } else if (!this.isValidUrl(trimmed)) {
        errors.linktoTheCall = 'Call link must be a valid URL'
      } else {
        sanitized.linktoTheCall = trimmed
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitized
    }
  }

  /**
   * Validate and sanitize group creation data
   * @param {Object} data - Group data to validate
   * @returns {Object} Validation result with errors and sanitized data
   */
  static validateGroupData(data) {
    const errors = {}
    const sanitized = {}

    // Validate name
    if (!data.name || typeof data.name !== 'string') {
      errors.name = 'Group name is required'
    } else {
      const trimmed = data.name.trim()
      if (trimmed.length < 2) {
        errors.name = 'Group name must be at least 2 characters'
      } else if (trimmed.length > 60) {
        errors.name = 'Group name must be less than 60 characters'
      } else {
        sanitized.name = trimmed
      }
    }

    // Validate description (optional)
    if (data.description && typeof data.description === 'string') {
      const trimmed = data.description.trim()
      if (trimmed.length > 500) {
        errors.description = 'Description must be less than 500 characters'
      } else {
        sanitized.description = trimmed
      }
    }

    // Validate visibility
    const visibility = data.visibility === 'private' ? 'private' : 'public'
    if (!['public', 'private'].includes(visibility)) {
      errors.visibility = 'Visibility must be either public or private'
    } else {
      sanitized.visibility = visibility
    }

    // Validate max members
    let maxMembers = 25 // default
    if (data.maxMembers !== undefined && data.maxMembers !== null) {
      maxMembers = parseInt(data.maxMembers, 10)
      if (Number.isNaN(maxMembers)) {
        errors.maxMembers = 'Max members must be a valid number'
      } else if (maxMembers < 2) {
        errors.maxMembers = 'Max members must be at least 2'
      } else if (maxMembers > 100) {
        errors.maxMembers = 'Max members cannot exceed 100'
      }
    }
    sanitized.maxMembers = maxMembers

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitized
    }
  }

  /**
   * Validate and sanitize user registration data
   * @param {Object} data - User data to validate
   * @returns {Object} Validation result with errors and sanitized data
   */
  static validateUserData(data) {
    const errors = {}
    const sanitized = {}

    // Validate email
    if (!data.email || typeof data.email !== 'string') {
      errors.email = 'Email is required'
    } else {
      const trimmed = data.email.trim().toLowerCase()
      if (!this.isValidEmail(trimmed)) {
        errors.email = 'Please enter a valid email address'
      } else {
        sanitized.email = trimmed
      }
    }

    // Validate username
    if (!data.username || typeof data.username !== 'string') {
      errors.username = 'Username is required'
    } else {
      const trimmed = data.username.trim()
      if (trimmed.length < 3) {
        errors.username = 'Username must be at least 3 characters'
      } else if (trimmed.length > 30) {
        errors.username = 'Username must be less than 30 characters'
      } else if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        errors.username = 'Username can only contain letters, numbers, and underscores'
      } else {
        sanitized.username = trimmed
      }
    }

    // Validate password with enhanced security
    const passwordValidation = this.validatePasswordStrength(data.password)
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.errors.join(', ')
    } else {
      sanitized.password = data.password // Don't trim password
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitized
    }
  }

  /**
   * Validate pagination parameters
   * @param {Object} params - Pagination parameters
   * @returns {Object} Validation result with sanitized parameters
   */
  static validatePagination(params) {
    const sanitized = {}
    const errors = []

    // Validate page
    let page = 1
    if (params.page !== undefined && params.page !== null) {
      page = parseInt(params.page, 10)
      if (Number.isNaN(page) || page < 1) {
        errors.push('Page must be a positive number')
        page = 1
      }
    }
    sanitized.page = page

    // Validate limit
    let limit = 10
    if (params.limit !== undefined && params.limit !== null) {
      limit = parseInt(params.limit, 10)
      if (Number.isNaN(limit) || limit < 1 || limit > 100) {
        errors.push('Limit must be between 1 and 100')
        limit = 10
      }
    }
    sanitized.limit = limit

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    }
  }

  /**
   * Validate search parameters
   * @param {Object} params - Search parameters
   * @returns {Object} Validation result with sanitized parameters
   */
  static validateSearch(params) {
    const sanitized = {}
    const errors = []

    // Validate search text
    if (params.search && typeof params.search === 'string') {
      const trimmed = params.search.trim()
      if (trimmed.length > 100) {
        errors.push('Search term must be less than 100 characters')
      } else if (trimmed.length > 0) {
        sanitized.search = trimmed
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    }
  }

  /**
   * Validate MongoDB ObjectId
   * @param {string} id - ID to validate
   * @returns {boolean} True if valid ObjectId format
   */
  static isValidObjectId(id) {
    if (!id || typeof id !== 'string') return false
    const ObjectId = require('mongoose').Types.ObjectId
    return ObjectId.isValid(id)
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email format
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL format
   */
  static isValidUrl(url) {
    if (!url || typeof url !== 'string') return false
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Validate file upload
   * @param {Object} file - File object to validate
   * @param {Object} config - Configuration object
   * @returns {Object} Validation result
   */
  static validateFileUpload(file, config = {}) {
    const errors = []
    const maxSize = config.maxSize || 2 * 1024 * 1024 // 2MB default
    const allowedTypes = config.allowedTypes || ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    if (!file) {
      errors.push('No file provided')
    } else {
      // Check file size
      if (file.size > maxSize) {
        errors.push(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`)
      }

      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`)
      }

      // Check for malicious file extensions
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar']
      const filename = file.name.toLowerCase()
      if (dangerousExtensions.some(ext => filename.includes(ext))) {
        errors.push('File type not allowed')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Sanitize string input with enhanced security
   * @param {string} input - Input to sanitize
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized string
   */
  static sanitizeString(input, options = {}) {
    if (typeof input !== 'string') return ''

    let sanitized = input.trim()

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '')

    // Remove potential XSS vectors
    if (!options.allowHtml) {
      sanitized = sanitized.replace(/[<>]/g, '')
    }

    // Remove control characters except newlines and tabs
    if (!options.allowControlChars) {
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    }

    // Limit length if specified
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength)
    }

    return sanitized
  }

  /**
   * Sanitize HTML content with enhanced security
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized string
   */
  static sanitizeHtml(input) {
    if (typeof input !== 'string') return ''

    return input
      .trim()
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove other dangerous tags
      .replace(/<(object|embed|applet|iframe|frame|frameset|meta|link|style|form|input|button|select|textarea|option|optgroup)[^>]*>/gi, '')
      // Remove event handlers
      .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove javascript: and data: protocols
      .replace(/javascript:/gi, '')
      .replace(/data:(?!image\/)/gi, '')
      // Remove null bytes
      .replace(/\0/g, '')
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  static validatePasswordStrength(password) {
    const errors = []

    if (!password || typeof password !== 'string') {
      errors.push('Password is required')
    } else {
      if (password.length < 8) {
        errors.push('Password must be at least 8 characters long')
      }
      if (password.length > 128) {
        errors.push('Password must be less than 128 characters long')
      }
      if (!/(?=.*[a-z])/.test(password)) {
        errors.push('Password must contain at least one lowercase letter')
      }
      if (!/(?=.*[A-Z])/.test(password)) {
        errors.push('Password must contain at least one uppercase letter')
      }
      if (!/(?=.*\d)/.test(password)) {
        errors.push('Password must contain at least one number')
      }
      if (!/(?=.*[@$!%*?&])/.test(password)) {
        errors.push('Password must contain at least one special character (@$!%*?&)')
      }
      // Check for common weak passwords
      const weakPasswords = ['password', '123456', 'password123', 'admin', 'qwerty', 'letmein']
      if (weakPasswords.includes(password.toLowerCase())) {
        errors.push('Password is too common, please choose a stronger password')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: this.getPasswordStrength(password)
    }
  }

  /**
   * Get password strength score
   * @param {string} password - Password to evaluate
   * @returns {string} Strength level
   */
  static getPasswordStrength(password) {
    if (!password) return 'none'

    let score = 0

    // Length bonus
    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1
    if (password.length >= 16) score += 1

    // Character variety bonus
    if (/[a-z]/.test(password)) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/\d/.test(password)) score += 1
    if (/[@$!%*?&]/.test(password)) score += 1

    // Pattern penalties
    if (/(.)\1{2,}/.test(password)) score -= 1 // Repeated characters
    if (/123|abc|qwe/i.test(password)) score -= 1 // Sequential patterns

    if (score >= 6) return 'strong'
    if (score >= 4) return 'medium'
    if (score >= 2) return 'weak'
    return 'very-weak'
  }
}

module.exports = ValidationService