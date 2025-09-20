const { registerUser, renderRegister, loginUser, renderLogin, logoutUser } = require("../controllers/user_controller")
const { getPersonalizedFeed, createFeedPost, getFeedRecommendations } = require("../controllers/feed-controller")
const { getUserBadges, getAllBadges, awardBadgeManually, badgeMiddleware } = require("../controllers/badge-controller")
const { getAnalyticsDashboard, getAdminAnalytics, analyticsMiddleware } = require("../controllers/analytics-controller")
const { requireAuth } = require("../middleware/auth")
const { authLimiter, feedLimiter } = require("../middleware/rate-limit")
const { cacheFeed, cacheRecommendations } = require("../middleware/cache")
const { spamDetection } = require("../middleware/spam-detection")

const router = require("express").Router()

router.get("/register", renderRegister)
router.post("/register", authLimiter, registerUser)

router.get("/login", renderLogin)
router.post("/login", authLimiter, loginUser)

router.post("/logout", logoutUser)

// Feed routes
router.get("/feed", requireAuth, cacheFeed, getPersonalizedFeed)
router.post("/feed", requireAuth, feedLimiter, spamDetection('feed_post_created'), createFeedPost)
router.get("/feed/recommendations", requireAuth, cacheRecommendations, getFeedRecommendations)

// Badge routes
router.get("/badges", requireAuth, getUserBadges)
router.get("/badges/all", getAllBadges)
router.post("/badges/award", requireAuth, awardBadgeManually)

// Analytics routes
router.get("/analytics", requireAuth, getAnalyticsDashboard)
router.get("/analytics/admin", requireAuth, getAdminAnalytics)

module.exports = router
