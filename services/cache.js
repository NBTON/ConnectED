const Redis = require('redis')
const performanceMonitor = require('./performance')

class CacheService {
  constructor() {
    this.client = null
    this.isConnected = false
    this.defaultTTL = 3600 // 1 hour default TTL
  }

  async connect(redisUrl = process.env.REDIS_URL || 'redis://localhost:6379') {
    try {
      this.client = Redis.createClient({ url: redisUrl })
      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err)
        this.isConnected = false
      })
      this.client.on('connect', () => {
        console.log('Connected to Redis')
        this.isConnected = true
      })
      await this.client.connect()
    } catch (err) {
      console.error('Failed to connect to Redis:', err.message)
      console.log('Falling back to in-memory cache')
      this.client = null
      this.isConnected = false
    }
  }

  async get(key) {
    const startTime = process.hrtime.bigint()
    try {
      let value = null
      if (this.isConnected && this.client) {
        value = await this.client.get(key)
      } else {
        // Fallback to in-memory cache if Redis is not available
        value = global.inMemoryCache ? global.inMemoryCache[key] : null
      }

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000

      if (value) {
        performanceMonitor.recordCacheHit()
      } else {
        performanceMonitor.recordCacheMiss()
      }

      return value ? JSON.parse(value) : null
    } catch (err) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000
      performanceMonitor.recordError(err)
      console.error('Cache get error:', err)
      return null
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      const serializedValue = JSON.stringify(value)
      if (this.isConnected && this.client) {
        await this.client.setEx(key, ttl, serializedValue)
      } else {
        // Fallback to in-memory cache
        if (!global.inMemoryCache) {
          global.inMemoryCache = {}
        }
        global.inMemoryCache[key] = value
        // Simple TTL for in-memory cache
        setTimeout(() => {
          delete global.inMemoryCache[key]
        }, ttl * 1000)
      }
    } catch (err) {
      console.error('Cache set error:', err)
    }
  }

  async del(key) {
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key)
      } else {
        // Fallback to in-memory cache
        if (global.inMemoryCache) {
          delete global.inMemoryCache[key]
        }
      }
    } catch (err) {
      console.error('Cache del error:', err)
    }
  }

  async invalidatePattern(pattern) {
    try {
      if (this.isConnected && this.client) {
        const keys = await this.client.keys(pattern)
        if (keys.length > 0) {
          await this.client.del(keys)
        }
      } else {
        // For in-memory cache, we can't easily do pattern matching
        // This is a limitation of the fallback cache
        console.warn('Pattern invalidation not supported with in-memory cache')
      }
    } catch (err) {
      console.error('Cache invalidate pattern error:', err)
    }
  }

  // Cache key generators for common operations
  generateCourseKey(courseId) {
    return `course:${courseId}`
  }

  generateGroupKey(groupId) {
    return `group:${groupId}`
  }

  generateUserGroupsKey(userId) {
    return `user:${userId}:groups`
  }

  generateCourseGroupsKey(courseId) {
    return `course:${courseId}:groups`
  }

  generateMemberCountKey(groupId) {
    return `group:${groupId}:memberCount`
  }

  // Cache wrapper for database operations
  async cachedOperation(key, operation, ttl = this.defaultTTL) {
    const cached = await this.get(key)
    if (cached !== null) {
      return cached
    }

    const result = await operation()
    await this.set(key, result, ttl)
    return result
  }
}

// Create singleton instance
const cacheService = new CacheService()

module.exports = cacheService