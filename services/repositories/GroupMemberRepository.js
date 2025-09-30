const BaseRepository = require('./BaseRepository')
const { GroupMember } = require('../../models/db_schema')

/**
 * Repository for GroupMember entity operations
 * Handles all data access logic for group memberships
 */
class GroupMemberRepository extends BaseRepository {
  constructor() {
    super(GroupMember)
  }

  /**
   * Find members of a specific group with user details
   * @param {string} groupId - Group ID
   * @returns {Promise<Array>} Members with enriched user data
   */
  async findGroupMembersWithUsers(groupId) {
    try {
      const { User } = require('../../models/db_schema')

      const members = await this.find({ groupId }, { sort: { joinedAt: 1 } })
      const userIds = members.map(m => m.userId)

      if (userIds.length === 0) return []

      const users = await User.find({ _id: { $in: userIds } }).lean()
      const userMap = {}
      for (const user of users) {
        userMap[String(user._id)] = user
      }

      return members.map(member => ({
        ...member,
        user: userMap[String(member.userId)]
      }))
    } catch (error) {
      this.handleError(error, 'findGroupMembersWithUsers')
      return []
    }
  }

  /**
   * Find user's groups with course details
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's groups with course information
   */
  async findUserGroupsWithCourses(userId) {
    try {
      const { Group, Course } = require('../../models/db_schema')

      const result = await this.aggregate([
        { $match: { userId: this.toObjectId(userId) } },
        {
          $lookup: {
            from: 'groups',
            localField: 'groupId',
            foreignField: '_id',
            as: 'group'
          }
        },
        { $unwind: '$group' },
        {
          $lookup: {
            from: 'subjects', // Course collection is mapped to 'subjects'
            localField: 'group.courseId',
            foreignField: '_id',
            as: 'course'
          }
        },
        { $unwind: '$course' },
        {
          $group: {
            _id: '$groupId',
            group: { $first: '$group' },
            course: { $first: '$course' },
            role: { $first: '$role' },
            memberCount: { $sum: 1 }
          }
        },
        {
          $project: {
            group: 1,
            course: 1,
            memberCount: 1,
            role: 1
          }
        },
        { $sort: { 'group.createdAt': -1 } }
      ])

      return result
    } catch (error) {
      this.handleError(error, 'findUserGroupsWithCourses')
      return []
    }
  }

  /**
   * Check if user is member of group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Membership record or null if not member
   */
  async findMembership(groupId, userId) {
    try {
      return await this.findOne({ groupId, userId })
    } catch (error) {
      this.handleError(error, 'findMembership')
      return null
    }
  }

  /**
   * Count members in a group
   * @param {string} groupId - Group ID
   * @returns {Promise<number>} Member count
   */
  async countGroupMembers(groupId) {
    try {
      return await this.count({ groupId })
    } catch (error) {
      this.handleError(error, 'countGroupMembers')
      return 0
    }
  }

  /**
   * Add user to group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @param {string} role - User role (default: 'member')
   * @returns {Promise<Object>} Created membership
   */
  async addMember(groupId, userId, role = 'member') {
    try {
      return await this.create({
        groupId,
        userId,
        role,
        joinedAt: new Date()
      })
    } catch (error) {
      this.handleError(error, 'addMember')
      throw error
    }
  }

  /**
   * Remove member from group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if removed, false if not found
   */
  async removeMember(groupId, userId) {
    try {
      const result = await this.model.findOneAndDelete({ groupId, userId })
      return !!result
    } catch (error) {
      this.handleError(error, 'removeMember')
      return false
    }
  }

  /**
   * Get member counts for multiple groups
   * @param {Array<string>} groupIds - Array of group IDs
   * @returns {Promise<Object>} Map of groupId -> member count
   */
  async getMemberCounts(groupIds) {
    try {
      if (!groupIds.length) return {}

      const objectIds = groupIds.map(id => this.toObjectId(id))
      const rows = await this.aggregate([
        { $match: { groupId: { $in: objectIds } } },
        { $group: { _id: '$groupId', count: { $sum: 1 } } }
      ])

      const countMap = {}
      for (const row of rows) {
        countMap[String(row._id)] = row.count
      }

      return countMap
    } catch (error) {
      this.handleError(error, 'getMemberCounts')
      return {}
    }
  }

  /**
   * Find owner membership for a group
   * @param {string} groupId - Group ID
   * @returns {Promise<Object|null>} Owner membership or null if not found
   */
  async findOwnerMembership(groupId) {
    try {
      return await this.findOne({ groupId, role: 'owner' })
    } catch (error) {
      this.handleError(error, 'findOwnerMembership')
      return null
    }
  }
}

module.exports = GroupMemberRepository