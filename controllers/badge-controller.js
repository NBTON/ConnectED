const { Badge, User, Analytics, UserActivity } = require("../models/db_schema")

// Predefined badges
const DEFAULT_BADGES = [
  {
    name: "First Steps",
    description: "Complete your profile setup",
    type: "achievement",
    criteria: { action: "profile_completed", threshold: 1 },
    rarity: "common"
  },
  {
    name: "Course Explorer",
    description: "View 5 different courses",
    type: "achievement",
    criteria: { action: "courses_viewed", threshold: 5 },
    rarity: "common"
  },
  {
    name: "Group Joiner",
    description: "Join 3 study groups",
    type: "achievement",
    criteria: { action: "groups_joined", threshold: 3 },
    rarity: "common"
  },
  {
    name: "Social Butterfly",
    description: "Create 10 feed posts",
    type: "achievement",
    criteria: { action: "posts_created", threshold: 10 },
    rarity: "rare"
  },
  {
    name: "Knowledge Seeker",
    description: "Complete 5 courses",
    type: "achievement",
    criteria: { action: "courses_completed", threshold: 5 },
    rarity: "rare"
  },
  {
    name: "Mentor",
    description: "Help 10 other users",
    type: "achievement",
    criteria: { action: "users_helped", threshold: 10 },
    rarity: "epic"
  },
  {
    name: "Early Bird",
    description: "Active during first month",
    type: "participation",
    criteria: { action: "account_age_days", threshold: 30 },
    rarity: "common"
  }
]

const initializeBadges = async () => {
  try {
    for (const badgeData of DEFAULT_BADGES) {
      await Badge.findOneAndUpdate(
        { name: badgeData.name },
        badgeData,
        { upsert: true, new: true }
      )
    }
    console.log("Badges initialized successfully")
  } catch (error) {
    console.error("Error initializing badges:", error)
  }
}

const checkAndAwardBadges = async (userId, action, metadata = {}) => {
  try {
    const user = await User.findById(userId).populate('badges')
    if (!user) return

    const existingBadgeIds = user.badges.map(badge => badge._id.toString())
    const earnedBadges = []

    // Get all badges
    const allBadges = await Badge.find({})

    for (const badge of allBadges) {
      // Skip if user already has this badge
      if (existingBadgeIds.includes(badge._id.toString())) continue

      // Check if badge criteria is met
      const isEligible = await checkBadgeCriteria(userId, badge, action, metadata)

      if (isEligible) {
        // Award the badge
        user.badges.push(badge._id)
        earnedBadges.push(badge)

        // Track analytics
        await Analytics.create({
          userId,
          action: "badge_earned",
          resourceType: "badge",
          resourceId: badge._id,
          metadata: { badgeName: badge.name, rarity: badge.rarity }
        })
      }
    }

    if (earnedBadges.length > 0) {
      await user.save()
      return earnedBadges
    }

    return []
  } catch (error) {
    console.error("Error checking badges:", error)
    return []
  }
}

const checkBadgeCriteria = async (userId, badge, action, metadata) => {
  const { criteria } = badge

  switch (criteria.action) {
    case "profile_completed":
      const profileUser = await User.findById(userId)
      return profileUser.profile?.bio && profileUser.interests?.length > 0

    case "courses_viewed":
      const courseViews = await Analytics.countDocuments({
        userId,
        action: "view_course"
      })
      return courseViews >= criteria.threshold

    case "groups_joined":
      const groupJoins = await Analytics.countDocuments({
        userId,
        action: "group_join"
      })
      return groupJoins >= criteria.threshold

    case "posts_created":
      const posts = await Analytics.countDocuments({
        userId,
        action: "feed_post_created"
      })
      return posts >= criteria.threshold

    case "courses_completed":
      // This would need a completion tracking system
      const completions = await UserActivity.countDocuments({
        userId,
        action: "course_completed"
      })
      return completions >= criteria.threshold

    case "users_helped":
      const helps = await Analytics.countDocuments({
        userId,
        action: "user_helped"
      })
      return helps >= criteria.threshold

    case "account_age_days":
      const ageUser = await User.findById(userId)
      const accountAge = Math.floor((Date.now() - ageUser.createdAt) / (1000 * 60 * 60 * 24))
      return accountAge >= criteria.threshold

    default:
      return false
  }
}

const getUserBadges = async (req, res) => {
  try {
    const userId = req.session?.userId
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" })
    }

    const user = await User.findById(userId).populate('badges')
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json({ badges: user.badges })
  } catch (error) {
    console.error("Get badges error:", error)
    res.status(500).json({ error: "Failed to get badges" })
  }
}

const getAllBadges = async (req, res) => {
  try {
    const badges = await Badge.find({}).sort({ rarity: 1, name: 1 })
    res.json({ badges })
  } catch (error) {
    console.error("Get all badges error:", error)
    res.status(500).json({ error: "Failed to get badges" })
  }
}

const awardBadgeManually = async (req, res) => {
  try {
    const { userId, badgeName } = req.body
    const moderatorId = req.session?.userId

    if (!moderatorId) {
      return res.status(401).json({ error: "Authentication required" })
    }

    const badge = await Badge.findOne({ name: badgeName })
    if (!badge) {
      return res.status(404).json({ error: "Badge not found" })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Check if user already has the badge
    const hasBadge = user.badges.some(badgeId => badgeId.toString() === badge._id.toString())
    if (hasBadge) {
      return res.status(400).json({ error: "User already has this badge" })
    }

    user.badges.push(badge._id)
    await user.save()

    // Track analytics
    await Analytics.create({
      userId,
      action: "badge_awarded_manually",
      resourceType: "badge",
      resourceId: badge._id,
      metadata: { awardedBy: moderatorId, badgeName: badge.name }
    })

    res.json({ message: "Badge awarded successfully", badge })
  } catch (error) {
    console.error("Award badge error:", error)
    res.status(500).json({ error: "Failed to award badge" })
  }
}

// Middleware to check badges after user actions
const badgeMiddleware = (action) => {
  return async (req, res, next) => {
    try {
      const userId = req.session?.userId
      if (userId) {
        const earnedBadges = await checkAndAwardBadges(userId, action, req.body)
        if (earnedBadges.length > 0) {
          // Add earned badges to response for frontend notification
          res.locals.earnedBadges = earnedBadges
        }
      }
    } catch (error) {
      console.error("Badge middleware error:", error)
    }
    next()
  }
}

module.exports = {
  initializeBadges,
  checkAndAwardBadges,
  getUserBadges,
  getAllBadges,
  awardBadgeManually,
  badgeMiddleware
}