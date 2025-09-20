const { Analytics, User, Course, Feed } = require("../models/db_schema")
const cron = require('node-cron')

const ITEMS_PER_PAGE = 50

// Analytics middleware to track user activities
const analyticsMiddleware = (action) => {
  return async (req, res, next) => {
    try {
      const userId = req.session?.userId
      if (userId) {
        const resourceType = getResourceTypeFromUrl(req.path)
        const resourceId = extractResourceId(req)

        await Analytics.create({
          userId,
          action,
          resourceType,
          resourceId,
          metadata: {
            method: req.method,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          }
        })
      }
    } catch (error) {
      console.error("Analytics middleware error:", error)
    }
    next()
  }
}

// Helper function to determine resource type from URL
const getResourceTypeFromUrl = (path) => {
  if (path.includes('/courses')) return 'course'
  if (path.includes('/groups')) return 'group'
  if (path.includes('/feed')) return 'feed'
  if (path.includes('/users') || path.includes('/profile')) return 'user'
  return 'unknown'
}

// Helper function to extract resource ID from request
const extractResourceId = (req) => {
  const id = req.params.id || req.params.courseId || req.params.groupId || req.params.userId
  return id || null
}

const getAnalyticsDashboard = async (req, res) => {
  try {
    const userId = req.session?.userId
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" })
    }

    // Get date range (default to last 30 days)
    const days = parseInt(req.query.days) || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // User activity summary
    const userActivitySummary = await Analytics.aggregate([
      { $match: { userId: userId, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
          lastActivity: { $max: "$createdAt" }
        }
      },
      { $sort: { count: -1 } }
    ])

    // Course engagement metrics
    const courseEngagement = await Analytics.aggregate([
      { $match: { userId: userId, resourceType: "course", createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: "$resourceId",
          views: { $sum: 1 },
          lastViewed: { $max: "$createdAt" }
        }
      },
      {
        $lookup: {
          from: "subjects",
          localField: "_id",
          foreignField: "_id",
          as: "course"
        }
      },
      { $unwind: "$course" },
      { $sort: { views: -1 } },
      { $limit: 10 }
    ])

    // Daily activity chart data
    const dailyActivity = await Analytics.aggregate([
      { $match: { userId: userId, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ])

    // Badge progress (simplified)
    const badgeProgress = await getBadgeProgress(userId)

    res.json({
      summary: {
        totalActivities: userActivitySummary.reduce((sum, item) => sum + item.count, 0),
        uniqueActions: userActivitySummary.length,
        period: `${days} days`
      },
      activityBreakdown: userActivitySummary,
      courseEngagement,
      dailyActivity,
      badgeProgress
    })

  } catch (error) {
    console.error("Analytics dashboard error:", error)
    res.status(500).json({ error: "Failed to load analytics" })
  }
}

const getAdminAnalytics = async (req, res) => {
  try {
    // Platform-wide analytics (simplified - would need admin check in real app)
    const totalUsers = await User.countDocuments()
    const totalCourses = await Course.countDocuments()
    const totalFeedPosts = await Feed.countDocuments()

    // User registration trend (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const newUsersTrend = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ])

    // Most active users
    const mostActiveUsers = await Analytics.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: "$userId",
          activities: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      { $sort: { activities: -1 } },
      { $limit: 10 }
    ])

    res.json({
      overview: {
        totalUsers,
        totalCourses,
        totalFeedPosts
      },
      trends: {
        newUsers: newUsersTrend
      },
      topUsers: mostActiveUsers
    })

  } catch (error) {
    console.error("Admin analytics error:", error)
    res.status(500).json({ error: "Failed to load admin analytics" })
  }
}

const getBadgeProgress = async (userId) => {
  // Simplified badge progress - in real app would calculate based on actual criteria
  const user = await User.findById(userId).populate('badges')

  return {
    earned: user.badges.length,
    total: 7, // Based on our default badges
    recent: user.badges.slice(-3) // Last 3 earned badges
  }
}

// Background job for analytics processing
const startAnalyticsJobs = () => {
  // Clean up old analytics data (older than 1 year)
  cron.schedule('0 0 * * 0', async () => {
    try {
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      const result = await Analytics.deleteMany({
        createdAt: { $lt: oneYearAgo }
      })

      console.log(`Cleaned up ${result.deletedCount} old analytics records`)
    } catch (error) {
      console.error("Analytics cleanup error:", error)
    }
  })

  // Generate weekly reports
  cron.schedule('0 0 * * 1', async () => {
    try {
      // This would generate and store weekly analytics reports
      console.log("Generating weekly analytics report...")
      // Implementation would depend on reporting requirements
    } catch (error) {
      console.error("Weekly report error:", error)
    }
  })
}

module.exports = {
  analyticsMiddleware,
  getAnalyticsDashboard,
  getAdminAnalytics,
  startAnalyticsJobs
}