const redis = require('redis')

// Initialize Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  socket: {
    connectTimeout: 5000,
    lazyConnect: true,
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        console.error('Redis server is not running. Caching disabled.')
        return new Error('Redis connection failed')
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        console.error('Redis retry time exhausted. Caching disabled.')
        return new Error('Retry time exhausted')
      }
      if (options.attempt > 3) {
        console.error('Redis max retries reached. Caching disabled.')
        return new Error('Max retries reached')
      }
      return Math.min(options.attempt * 100, 3000)
    }
  }
})

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message)
})

redisClient.on('connect', () => {
  console.log('Connected to Redis')
})

// Gracefully handle Redis connection failures
let redisConnected = false
redisClient.on('ready', () => {
  redisConnected = true
})

redisClient.on('end', () => {
  redisConnected = false
})

// Cache middleware
const cache = (duration) => {
  return async (req, res, next) => {
    if (!redisConnected || !redisClient.isOpen) {
      return next()
    }

    const key = `cache:${req.originalUrl}:${JSON.stringify(req.query)}`

    try {
      const cachedData = await redisClient.get(key)
      if (cachedData) {
        const parsedData = JSON.parse(cachedData)
        return res.json(parsedData)
      }

      // Store original send method
      const originalSend = res.json

      // Override res.json to cache the response
      res.json = function(data) {
        redisClient.setEx(key, duration, JSON.stringify(data))
        originalSend.call(this, data)
      }

      next()
    } catch (error) {
      console.error('Cache error:', error)
      next()
    }
  }
}

// Clear cache for specific patterns
const clearCache = async (pattern) => {
  try {
    if (!redisClient.isOpen) return

    const keys = await redisClient.keys(pattern)
    if (keys.length > 0) {
      await redisClient.del(keys)
      console.log(`Cleared ${keys.length} cache entries for pattern: ${pattern}`)
    }
  } catch (error) {
    console.error('Clear cache error:', error)
  }
}

// Cache feed data
const cacheFeed = cache(300) // 5 minutes

// Cache course recommendations
const cacheRecommendations = cache(600) // 10 minutes

// Cache analytics data
const cacheAnalytics = cache(1800) // 30 minutes

// Clear user-specific cache
const clearUserCache = async (userId) => {
  await clearCache(`cache:*userId=${userId}*`)
}

// Clear feed cache
const clearFeedCache = async () => {
  await clearCache('cache:*feed*')
}

// Clear course cache
const clearCourseCache = async () => {
  await clearCache('cache:*course*')
}

module.exports = {
  redisClient,
  cache,
  cacheFeed,
  cacheRecommendations,
  cacheAnalytics,
  clearCache,
  clearUserCache,
  clearFeedCache,
  clearCourseCache
}