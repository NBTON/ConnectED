class PerformanceMonitor {
  constructor() {
    this.metrics = {
      responseTimes: [],
      databaseQueries: [],
      cacheHits: 0,
      cacheMisses: 0,
      errors: []
    }
    this.maxMetrics = 1000 // Keep only last 1000 measurements
  }

  // Middleware to track response times
  middleware() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint()

      res.on('finish', () => {
        const endTime = process.hrtime.bigint()
        const duration = Number(endTime - startTime) / 1000000 // Convert to milliseconds

        this.recordResponseTime(req, res, duration)
      })

      next()
    }
  }

  recordResponseTime(req, res, duration) {
    const metric = {
      timestamp: new Date(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }

    this.metrics.responseTimes.push(metric)

    // Keep only recent metrics
    if (this.metrics.responseTimes.length > this.maxMetrics) {
      this.metrics.responseTimes = this.metrics.responseTimes.slice(-this.maxMetrics)
    }

    // Log slow requests
    if (duration > 1000) { // More than 1 second
      console.warn(`Slow request: ${req.method} ${req.url} took ${duration.toFixed(2)}ms`)
    }
  }

  recordDatabaseQuery(operation, collection, duration, success = true) {
    const metric = {
      timestamp: new Date(),
      type: 'database',
      operation,
      collection,
      duration,
      success
    }

    this.metrics.databaseQueries.push(metric)

    if (this.metrics.databaseQueries.length > this.maxMetrics) {
      this.metrics.databaseQueries = this.metrics.databaseQueries.slice(-this.maxMetrics)
    }

    if (duration > 100) { // More than 100ms
      console.warn(`Slow database query: ${operation} on ${collection} took ${duration.toFixed(2)}ms`)
    }
  }

  recordCacheHit() {
    this.metrics.cacheHits++
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++
  }

  recordError(error, req = null) {
    const metric = {
      timestamp: new Date(),
      type: 'error',
      error: error.message,
      stack: error.stack,
      url: req ? req.url : null,
      method: req ? req.method : null
    }

    this.metrics.errors.push(metric)

    if (this.metrics.errors.length > this.maxMetrics) {
      this.metrics.errors = this.metrics.errors.slice(-this.maxMetrics)
    }

    console.error('Performance monitor error:', error.message)
  }

  // Get performance statistics
  getStats() {
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    const fiveMinutesAgo = now - 300000

    const recentResponseTimes = this.metrics.responseTimes.filter(m => m.timestamp.getTime() > fiveMinutesAgo)
    const recentDBQueries = this.metrics.databaseQueries.filter(m => m.timestamp.getTime() > fiveMinutesAgo)

    const stats = {
      responseTimes: {
        total: recentResponseTimes.length,
        average: recentResponseTimes.length > 0 ?
          recentResponseTimes.reduce((sum, m) => sum + m.duration, 0) / recentResponseTimes.length : 0,
        slowest: recentResponseTimes.length > 0 ?
          Math.max(...recentResponseTimes.map(m => m.duration)) : 0,
        fastest: recentResponseTimes.length > 0 ?
          Math.min(...recentResponseTimes.map(m => m.duration)) : 0
      },
      database: {
        totalQueries: recentDBQueries.length,
        averageQueryTime: recentDBQueries.length > 0 ?
          recentDBQueries.reduce((sum, m) => sum + m.duration, 0) / recentDBQueries.length : 0,
        slowQueries: recentDBQueries.filter(m => m.duration > 100).length
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ?
          (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100 : 0
      },
      errors: {
        total: this.metrics.errors.length,
        recent: this.metrics.errors.filter(e => e.timestamp.getTime() > oneMinuteAgo).length
      }
    }

    return stats
  }

  // Reset metrics (useful for testing)
  reset() {
    this.metrics = {
      responseTimes: [],
      databaseQueries: [],
      cacheHits: 0,
      cacheMisses: 0,
      errors: []
    }
  }

  // Health check endpoint data
  getHealthData() {
    const stats = this.getStats()

    return {
      status: stats.errors.recent === 0 ? 'healthy' : 'degraded',
      responseTime: {
        average: Math.round(stats.responseTimes.average),
        status: stats.responseTimes.average < 500 ? 'good' : stats.responseTimes.average < 2000 ? 'warning' : 'critical'
      },
      database: {
        averageQueryTime: Math.round(stats.database.averageQueryTime),
        status: stats.database.averageQueryTime < 50 ? 'good' : stats.database.averageQueryTime < 200 ? 'warning' : 'critical'
      },
      cache: {
        hitRate: Math.round(stats.cache.hitRate * 100) / 100,
        status: stats.cache.hitRate > 80 ? 'good' : stats.cache.hitRate > 50 ? 'warning' : 'critical'
      },
      errors: {
        recent: stats.errors.recent,
        status: stats.errors.recent === 0 ? 'good' : 'critical'
      }
    }
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor()

module.exports = performanceMonitor