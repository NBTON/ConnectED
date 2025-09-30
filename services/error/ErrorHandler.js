/**
 * Centralized error handling service
 * Provides consistent error handling and logging across the application
 */
class ErrorHandler {
  /**
   * Handle errors in a consistent way
   * @param {Error} error - Error to handle
   * @param {Object} context - Error context (operation, userId, etc.)
   * @returns {Object} Standardized error response
   */
  static handleError(error, context = {}) {
    const errorResponse = {
      success: false,
      error: {
        message: this.getErrorMessage(error),
        code: this.getErrorCode(error),
        type: this.getErrorType(error)
      },
      context: this.sanitizeContext(context)
    }

    // Log error for debugging
    this.logError(error, context)

    return errorResponse
  }

  /**
   * Handle errors in Express middleware
   * @param {Error} error - Error to handle
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static handleExpressError(error, req, res, next) {
    const context = {
      operation: `${req.method} ${req.originalUrl}`,
      userId: req.session?.userId,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }

    const errorResponse = this.handleError(error, context)

    // Determine HTTP status code
    const statusCode = this.getHttpStatusCode(error)

    res.status(statusCode).json(errorResponse)
  }

  /**
   * Handle errors in service layer
   * @param {Error} error - Error to handle
   * @param {string} operation - Operation that failed
   * @param {string} userId - User ID if available
   * @returns {Object} Standardized error response
   */
  static handleServiceError(error, operation, userId = null) {
    const context = {
      operation,
      userId,
      layer: 'service'
    }

    return this.handleError(error, context)
  }

  /**
   * Handle errors in controller layer
   * @param {Error} error - Error to handle
   * @param {string} operation - Operation that failed
   * @param {Object} req - Express request object
   * @returns {Object} Standardized error response
   */
  static handleControllerError(error, operation, req) {
    const context = {
      operation,
      userId: req.session?.userId,
      layer: 'controller',
      method: req.method,
      url: req.originalUrl
    }

    return this.handleError(error, context)
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - Error object
   * @returns {string} User-friendly message
   */
  static getErrorMessage(error) {
    // Custom application errors
    if (error.message) {
      // Handle validation errors
      if (error.message.includes('validation') || error.message.includes('required')) {
        return error.message
      }

      // Handle business logic errors
      if (error.message.includes('not found')) {
        return error.message
      }

      if (error.message.includes('forbidden') || error.message.includes('unauthorized')) {
        return 'You do not have permission to perform this action'
      }

      if (error.message.includes('already exists')) {
        return error.message
      }

      if (error.message.includes('too many') || error.message.includes('limit')) {
        return error.message
      }
    }

    // Database errors
    if (error.name === 'ValidationError') {
      return 'Invalid data provided'
    }

    if (error.name === 'CastError') {
      return 'Invalid ID format'
    }

    if (error.code === 11000) {
      return 'This item already exists'
    }

    // Default error message
    return 'An unexpected error occurred'
  }

  /**
   * Get error code for programmatic handling
   * @param {Error} error - Error object
   * @returns {string} Error code
   */
  static getErrorCode(error) {
    if (error.code) {
      return error.code
    }

    if (error.name === 'ValidationError') {
      return 'VALIDATION_ERROR'
    }

    if (error.name === 'CastError') {
      return 'INVALID_ID'
    }

    if (error.message && error.message.includes('not found')) {
      return 'NOT_FOUND'
    }

    if (error.message && error.message.includes('forbidden')) {
      return 'FORBIDDEN'
    }

    if (error.message && error.message.includes('unauthorized')) {
      return 'UNAUTHORIZED'
    }

    return 'INTERNAL_ERROR'
  }

  /**
   * Get error type for categorization
   * @param {Error} error - Error object
   * @returns {string} Error type
   */
  static getErrorType(error) {
    if (error.name === 'ValidationError' || error.message?.includes('validation')) {
      return 'validation'
    }

    if (error.name === 'CastError' || error.message?.includes('not found')) {
      return 'not_found'
    }

    if (error.message?.includes('forbidden') || error.message?.includes('unauthorized')) {
      return 'authorization'
    }

    if (error.code === 11000) {
      return 'duplicate'
    }

    return 'internal'
  }

  /**
   * Get appropriate HTTP status code
   * @param {Error} error - Error object
   * @returns {number} HTTP status code
   */
  static getHttpStatusCode(error) {
    if (error.message?.includes('not found') || error.name === 'CastError') {
      return 404
    }

    if (error.message?.includes('forbidden')) {
      return 403
    }

    if (error.message?.includes('unauthorized')) {
      return 401
    }

    if (error.name === 'ValidationError' || error.message?.includes('validation')) {
      return 400
    }

    if (error.code === 11000) {
      return 409 // Conflict
    }

    return 500 // Internal Server Error
  }

  /**
   * Log error with context
   * @param {Error} error - Error to log
   * @param {Object} context - Error context
   */
  static logError(error, context) {
    const logData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      context,
      timestamp: new Date().toISOString()
    }

    console.error('Error occurred:', JSON.stringify(logData, null, 2))
  }

  /**
   * Sanitize context for logging (remove sensitive data)
   * @param {Object} context - Context to sanitize
   * @returns {Object} Sanitized context
   */
  static sanitizeContext(context) {
    if (!context) return {}

    const sanitized = { ...context }

    // Remove sensitive fields
    delete sanitized.password
    delete sanitized.token
    delete sanitized.authorization
    delete sanitized.cookie

    return sanitized
  }

  /**
   * Create custom application error
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {string} type - Error type
   * @returns {Error} Custom error
   */
  static createError(message, code = 'CUSTOM_ERROR', type = 'custom') {
    const error = new Error(message)
    error.code = code
    error.type = type
    return error
  }

  /**
   * Create validation error
   * @param {string} message - Error message
   * @returns {Error} Validation error
   */
  static createValidationError(message) {
    return this.createError(message, 'VALIDATION_ERROR', 'validation')
  }

  /**
   * Create not found error
   * @param {string} resource - Resource that was not found
   * @returns {Error} Not found error
   */
  static createNotFoundError(resource) {
    return this.createError(`${resource} not found`, 'NOT_FOUND', 'not_found')
  }

  /**
   * Create forbidden error
   * @param {string} message - Error message
   * @returns {Error} Forbidden error
   */
  static createForbiddenError(message = 'Forbidden') {
    return this.createError(message, 'FORBIDDEN', 'authorization')
  }
}

module.exports = ErrorHandler