const cacheService = require('./cache')
const CourseService = require('./CourseService')
const GroupService = require('./GroupService')
const UserService = require('./UserService')
const ValidationService = require('./validation/ValidationService')
const ErrorHandler = require('./error/ErrorHandler')

/**
 * Service Container for Dependency Injection
 * Implements Dependency Inversion Principle by providing service instances
 */
class ServiceContainer {
  constructor() {
    this._services = new Map()
    this._initialized = false
  }

  /**
   * Initialize all services with their dependencies
   */
  initialize() {
    if (this._initialized) return

    // Create service instances with dependencies
    const courseService = new CourseService({ cacheService })
    const groupService = new GroupService({ cacheService })
    const userService = new UserService({ cacheService })

    // Register services
    this._services.set('courseService', courseService)
    this._services.set('groupService', groupService)
    this._services.set('userService', userService)
    this._services.set('validationService', ValidationService)
    this._services.set('errorHandler', ErrorHandler)
    this._services.set('cacheService', cacheService)

    this._initialized = true
  }

  /**
   * Get service instance by name
   * @param {string} serviceName - Name of the service to retrieve
   * @returns {Object} Service instance
   * @throws {Error} If service is not found or not initialized
   */
  get(serviceName) {
    if (!this._initialized) {
      this.initialize()
    }

    const service = this._services.get(serviceName)
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`)
    }

    return service
  }

  /**
   * Get all registered service names
   * @returns {Array<string>} Array of service names
   */
  getServiceNames() {
    return Array.from(this._services.keys())
  }

  /**
   * Check if service is registered
   * @param {string} serviceName - Name of the service to check
   * @returns {boolean} True if service is registered
   */
  has(serviceName) {
    return this._services.has(serviceName)
  }

  /**
   * Register a custom service
   * @param {string} serviceName - Name of the service
   * @param {Object} serviceInstance - Service instance
   */
  register(serviceName, serviceInstance) {
    this._services.set(serviceName, serviceInstance)
  }

  /**
   * Reset container (mainly for testing)
   */
  reset() {
    this._services.clear()
    this._initialized = false
  }
}

// Create singleton instance
const serviceContainer = new ServiceContainer()

module.exports = serviceContainer