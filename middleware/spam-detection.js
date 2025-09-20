const { Analytics } = require('../models/db_schema')

// Simple spam detection patterns
const SPAM_PATTERNS = [
  /\b(?:viagra|casino|lottery|winner|prize)\b/i,
  /\b(?:free|cheap|discount|buy now)\b.*\b(?:money|cash|dollars)\b/i,
  /(?:http|https|www\.)\S+/gi, // URLs
  /\b\d{10,}\b/g, // Long numbers (potentially phone numbers)
  /[A-Z]{5,}/g, // Excessive caps
  /(.)\1{4,}/g, // Repeated characters
]

// Content analysis for spam
const analyzeContent = (content) => {
  if (!content || typeof content !== 'string') return { isSpam: false, score: 0 }

  let spamScore = 0
  const reasons = []

  // Check for spam patterns
  SPAM_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern)
    if (matches) {
      spamScore += matches.length * 2
      reasons.push(`Pattern match: ${pattern}`)
    }
  })

  // Check content length (very short or very long)
  if (content.length < 10) {
    spamScore += 1
    reasons.push('Content too short')
  } else if (content.length > 2000) {
    spamScore += 2
    reasons.push('Content too long')
  }

  // Check for excessive punctuation
  const punctuationCount = (content.match(/[!?.,;:-]/g) || []).length
  if (punctuationCount > content.length * 0.3) {
    spamScore += 1
    reasons.push('Excessive punctuation')
  }

  // Check for repetitive words
  const words = content.toLowerCase().split(/\s+/)
  const wordCounts = {}
  words.forEach(word => {
    if (word.length > 3) { // Only count meaningful words
      wordCounts[word] = (wordCounts[word] || 0) + 1
    }
  })

  const repetitiveWords = Object.values(wordCounts).filter(count => count > 3)
  if (repetitiveWords.length > 0) {
    spamScore += repetitiveWords.length
    reasons.push('Repetitive words')
  }

  return {
    isSpam: spamScore >= 5,
    score: spamScore,
    reasons
  }
}

// Rate limiting for content creation
const checkUserActivityRate = async (userId, action, timeWindow = 3600000) => { // 1 hour default
  const recentActivities = await Analytics.countDocuments({
    userId,
    action,
    createdAt: { $gte: new Date(Date.now() - timeWindow) }
  })

  // Allow reasonable limits based on action type
  const limits = {
    feed_post_created: 10,
    course_created: 5,
    group_created: 3
  }

  const limit = limits[action] || 10
  return {
    isRateLimited: recentActivities >= limit,
    currentCount: recentActivities,
    limit
  }
}

// Spam detection middleware
const spamDetection = (action) => {
  return async (req, res, next) => {
    try {
      const userId = req.session?.userId
      if (!userId) return next()

      // Check content for spam
      const content = req.body.content || req.body.description || req.body.title || ''
      const analysis = analyzeContent(content)

      if (analysis.isSpam) {
        return res.status(400).json({
          error: 'Content flagged as potential spam',
          details: analysis.reasons
        })
      }

      // Check user activity rate
      const rateCheck = await checkUserActivityRate(userId, action)
      if (rateCheck.isRateLimited) {
        return res.status(429).json({
          error: 'Too many posts recently. Please slow down.',
          currentCount: rateCheck.currentCount,
          limit: rateCheck.limit
        })
      }

      // Add spam analysis to request for logging
      req.spamAnalysis = analysis
      next()

    } catch (error) {
      console.error('Spam detection error:', error)
      next() // Continue on error to avoid blocking legitimate users
    }
  }
}

// Moderation queue for suspicious content
const moderationQueue = async (content, userId, contentType) => {
  const analysis = analyzeContent(content)

  if (analysis.score >= 3) { // Lower threshold for moderation queue
    // In a real app, this would add to a moderation queue
    console.log(`Content queued for moderation: ${contentType} by user ${userId}`)
    console.log('Spam analysis:', analysis)

    // Track moderation event
    await Analytics.create({
      userId,
      action: 'content_moderation_queued',
      resourceType: contentType,
      metadata: {
        spamScore: analysis.score,
        reasons: analysis.reasons
      }
    })

    return true // Queued for moderation
  }

  return false
}

module.exports = {
  analyzeContent,
  checkUserActivityRate,
  spamDetection,
  moderationQueue
}