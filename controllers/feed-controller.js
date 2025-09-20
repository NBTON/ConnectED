const { Feed, User, Course, Group, Analytics } = require("../models/db_schema")

const ITEMS_PER_PAGE = 20

const getPersonalizedFeed = async (req, res) => {
  try {
    const userId = req.session?.userId
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" })
    }

    const page = parseInt(req.query.page) || 1
    const skip = (page - 1) * ITEMS_PER_PAGE

    // Get user's interests for personalization
    const user = await User.findById(userId).select('interests profile.skills')

    // Build aggregation pipeline for personalized feed
    const pipeline = [
      {
        $match: {
          $or: [
            { visibility: "public" },
            { authorId: userId }, // User's own posts
            {
              visibility: "friends",
              authorId: { $in: await getFriendsList(userId) }
            }
          ],
          isModerated: { $ne: true }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          as: "author"
        }
      },
      {
        $unwind: "$author"
      },
      {
        $lookup: {
          from: "groups",
          localField: "groupId",
          foreignField: "_id",
          as: "group"
        }
      },
      {
        $unwind: {
          path: "$group",
          preserveNullAndEmptyArrays: true
        }
      },
      // Add relevance scoring based on user interests
      {
        $addFields: {
          relevanceScore: {
            $add: [
              {
                $cond: {
                  if: { $in: ["$type", ["recommendation", "announcement"]] },
                  then: 2,
                  else: 1
                }
              },
              {
                $size: {
                  $setIntersection: [
                    user.interests || [],
                    "$tags"
                  ]
                }
              }
            ]
          }
        }
      },
      {
        $sort: {
          relevanceScore: -1,
          createdAt: -1
        }
      },
      {
        $skip: skip
      },
      {
        $limit: ITEMS_PER_PAGE
      }
    ]

    const feedItems = await Feed.aggregate(pipeline)

    // Get total count for pagination
    const totalCount = await Feed.countDocuments({
      $or: [
        { visibility: "public" },
        { authorId: userId },
        {
          visibility: "friends",
          authorId: { $in: await getFriendsList(userId) }
        }
      ],
      isModerated: { $ne: true }
    })

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

    // Track analytics
    await Analytics.create({
      userId,
      action: "feed_view",
      metadata: { page, itemsCount: feedItems.length }
    })

    res.json({
      feed: feedItems,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error("Feed error:", error)
    res.status(500).json({ error: "Failed to load feed" })
  }
}

const createFeedPost = async (req, res) => {
  try {
    const userId = req.session?.userId
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" })
    }

    const { type, title, content, tags, visibility, groupId } = req.body

    // Basic spam detection
    if (content && content.length > 1000) {
      return res.status(400).json({ error: "Content too long" })
    }

    const newPost = new Feed({
      authorId: userId,
      type: type || "post",
      title,
      content,
      tags: tags || [],
      visibility: visibility || "public",
      groupId
    })

    await newPost.save()

    // Track analytics
    await Analytics.create({
      userId,
      action: "feed_post_created",
      resourceType: "feed",
      resourceId: newPost._id,
      metadata: { type, visibility }
    })

    res.status(201).json({ post: newPost })

  } catch (error) {
    console.error("Create post error:", error)
    res.status(500).json({ error: "Failed to create post" })
  }
}

const getFeedRecommendations = async (req, res) => {
  try {
    const userId = req.session?.userId
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" })
    }

    // Generate recommendations based on user activity
    const recommendations = await generateFeedRecommendations(userId)

    res.json({ recommendations })

  } catch (error) {
    console.error("Recommendations error:", error)
    res.status(500).json({ error: "Failed to get recommendations" })
  }
}

// Helper function to get user's friends (simplified - in real app would have friends/followers system)
const getFriendsList = async (userId) => {
  // For now, return empty array - would need friends/followers relationship
  return []
}

// Helper function to generate feed recommendations
const generateFeedRecommendations = async (userId) => {
  const user = await User.findById(userId).select('interests')

  // Get trending posts based on user interests
  const recommendations = await Feed.aggregate([
    {
      $match: {
        visibility: "public",
        isModerated: { $ne: true },
        tags: { $in: user.interests || [] }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "authorId",
        foreignField: "_id",
        as: "author"
      }
    },
    {
      $unwind: "$author"
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $limit: 5
    }
  ])

  return recommendations
}

module.exports = {
  getPersonalizedFeed,
  createFeedPost,
  getFeedRecommendations
}