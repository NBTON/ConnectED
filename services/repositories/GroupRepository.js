const BaseRepository = require('./BaseRepository')
const { Group } = require('../../models/db_schema')
const mongoose = require('mongoose')

/**
 * Repository for Group entity operations
 * Handles all data access logic for groups
 */
class GroupRepository extends BaseRepository {
  constructor() {
    super(Group)
  }

  /**
   * Find groups by course ID with member information
   * @param {string} courseId - Course ID
   * @param {string} userId - Current user ID (optional)
   * @returns {Promise<Array>} Groups with member counts and user membership info
   */
  async findByCourseIdWithMembers(courseId, userId = null) {
    try {
      const matchStage = {
        courseId: this.toObjectId(courseId),
        $or: [
          { visibility: 'public' }
        ]
      }

      // If user is provided, include private groups they're a member of
      if (userId) {
        matchStage.$or.push({
          _id: { $in: await this.getUserGroupIds(userId) }
        })
      }

      const groups = await this.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'groupmembers',
            localField: '_id',
            foreignField: 'groupId',
            as: 'members'
          }
        },
        {
          $addFields: {
            memberCount: { $size: '$members' },
            isOwner: userId ? { $eq: ['$ownerId', this.toObjectId(userId)] } : false,
            isMember: userId ? { $in: [this.toObjectId(userId), '$members.userId'] } : false
          }
        },
        {
          $project: {
            members: 0 // Remove members array from result
          }
        },
        { $sort: { createdAt: -1 } }
      ])

      return groups
    } catch (error) {
      this.handleError(error, 'findByCourseIdWithMembers')
      return []
    }
  }

  /**
   * Get group IDs for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of group ObjectIds
   */
  async getUserGroupIds(userId) {
    try {
      const { GroupMember } = require('../../models/db_schema')
      const memberships = await GroupMember.find({ userId }).select('groupId').lean()
      return memberships.map(m => this.toObjectId(m.groupId))
    } catch (error) {
      this.handleError(error, 'getUserGroupIds')
      return []
    }
  }

  /**
   * Create new group with owner membership
   * @param {Object} groupData - Group data
   * @param {string} ownerId - Owner user ID
   * @returns {Promise<Object>} Created group with membership
   */
  async createWithOwner(groupData, ownerId) {
    try {
      const group = await this.create(groupData)

      // Create owner membership
      const { GroupMember } = require('../../models/db_schema')
      await GroupMember.create({
        groupId: group._id,
        userId: ownerId,
        role: 'owner'
      })

      return group
    } catch (error) {
      this.handleError(error, 'createWithOwner')
      throw error
    }
  }

  /**
   * Find group by invite token
   * @param {string} token - Invite token
   * @returns {Promise<Object|null>} Group or null if not found/expired
   */
  async findByInviteToken(token) {
    try {
      const group = await this.findOne({ inviteToken: token })

      if (!group) return null

      // Check if token is expired
      if (new Date() > group.inviteTokenExpiresAt) {
        return null
      }

      return group
    } catch (error) {
      this.handleError(error, 'findByInviteToken')
      return null
    }
  }

  /**
   * Regenerate invite token for group
   * @param {string} groupId - Group ID
   * @returns {Promise<Object|null>} Updated group or null if not found
   */
  async regenerateInviteToken(groupId) {
    try {
      const crypto = require('crypto')
      const newToken = crypto.randomBytes(16).toString('hex')
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      return await this.updateById(groupId, {
        inviteToken: newToken,
        inviteTokenExpiresAt: expiresAt
      })
    } catch (error) {
      this.handleError(error, 'regenerateInviteToken')
      return null
    }
  }

  /**
   * Find groups by owner ID
   * @param {string} ownerId - Owner user ID
   * @returns {Promise<Array>} Groups owned by user
   */
  async findByOwnerId(ownerId) {
    try {
      return await this.find({ ownerId }, { sort: { createdAt: -1 } })
    } catch (error) {
      this.handleError(error, 'findByOwnerId')
      return []
    }
  }
}

module.exports = GroupRepository