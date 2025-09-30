/**
 * Base service class providing common functionality for all services
 * Implements Dependency Inversion Principle by depending on abstractions
 *
 * This class serves as the foundation for all service classes in the application,
 * providing shared functionality for caching, error handling, and repository access.
 *
 * @example
 * ```javascript
 * class UserService extends BaseService {
 *   constructor({ cacheService }) {
 *     super({ userRepository: new UserRepository() }, cacheService)
 *   }
 * }
 * ```
 */
class BaseService {
  /**
   * Initialize base service with repositories and cache service
   * @param {Object} repositories - Repository instances for data access
   * @param {Object} cacheService - Cache service instance for caching operations
   */
  constructor(repositories = {}, cacheService = null) {
    this.repositories = repositories
    this.cacheService = cacheService
  }

  /**
   * Generate standardized cache key for a given operation
   * Creates consistent cache keys across all services for better cache management
   *
   * @param {string} operation - Operation name (e.g., 'user', 'course', 'group')
   * @param  {...any} params - Parameters for key generation (will be joined with ':')
   * @returns {string} Standardized cache key
   *
   * @example
   * ```javascript
   * const cacheKey = this.generateCacheKey('user', userId, 'profile')
   * // Returns: "user:123:profile"
   * ```
   */
  generateCacheKey(operation, ...params) {
    return `${operation}:${params.join(':')}`
  }

  /**
   * Execute cached operation with fallback to fresh data
   * Provides transparent caching layer for expensive operations
   *
   * @param {string} cacheKey - Unique cache key for the operation
   * @param {Function} operation - Async function to execute if cache miss
   * @param {number} ttl - Time to live in seconds (default: 5 minutes)
   * @returns {Promise<any>} Operation result (from cache or fresh execution)
   *
   * @example
   * ```javascript
   * const user = await this.executeCachedOperation(
   *   'user:123',
   *   () => this.userRepository.findById(123),
   *   1800 // 30 minutes
   * )
   * ```
   */
  async executeCachedOperation(cacheKey, operation, ttl = 300) {
    if (!this.cacheService) {
      return await operation()
    }

    return await this.cacheService.cachedOperation(cacheKey, operation, ttl)
  }

  /**
   * Invalidate multiple cache patterns
   * Useful for clearing related cached data after mutations
   *
   * @param  {...string} patterns - Cache patterns to invalidate (e.g., 'user:*', 'course:123:*')
   * @returns {Promise<void>}
   *
   * @example
   * ```javascript
   * await this.invalidateCachePatterns('user:*', 'course:123:*')
   * ```
   */
  async invalidateCachePatterns(...patterns) {
    if (!this.cacheService) return

    for (const pattern of patterns) {
      await this.cacheService.invalidatePattern(pattern)
    }
  }

  /**
   * Delete specific cache key
   * Removes individual cache entry when precise control is needed
   *
   * @param {string} cacheKey - Exact cache key to delete
   * @returns {Promise<void>}
   */
  async deleteCacheKey(cacheKey) {
    if (!this.cacheService) return

    await this.cacheService.del(cacheKey)
  }

  /**
   * Handle service-level errors consistently
   * Provides standardized error logging and context enhancement
   *
   * @param {Error} error - Error that occurred
   * @param {string} operation - Operation that failed (for logging context)
   * @throws {Error} Enhanced error with context
   */
  handleError(error, operation) {
    console.error(`${this.constructor.name}:${operation} error`, error)
    throw error
  }
}

module.exports = BaseService