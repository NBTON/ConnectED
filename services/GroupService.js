const BaseService = require('./BaseService')
const GroupRepository = require('./repositories/GroupRepository')
const GroupMemberRepository = require('./repositories/GroupMemberRepository')

/**
 * Service class for group-related business logic
 * Handles all group operations and business rules
 */
class GroupService extends BaseService {
  /**
   * @param {Object} options - Service options
   * @param {Object} options.cacheService - Cache service instance
   */
  constructor({ cacheService } = {}) {
    super({
      groupRepository: new GroupRepository(),
      groupMemberRepository: new GroupMemberRepository()
    }, cacheService)

    this.groupRepository = this.repositories.groupRepository
    this.groupMemberRepository = this.repositories.groupMemberRepository
  }

  /**
   * Get course groups with member information
   * @param {string} courseId - Course ID
   * @param {string} userId - Current user ID (optional)
   * @returns {Promise<Array>} Groups with member details
   */
  async getCourseGroups(courseId, userId = null) {
    try {
      if (!courseId) {
        throw new Error('Course ID is required')
      }

      const cacheKey = this.generateCacheKey('courseGroups', courseId, userId || '')

      return await this.executeCachedOperation(
        cacheKey,
        () => this.groupRepository.findByCourseIdWithMembers(courseId, userId),
        300 // Cache for 5 minutes
      )
    } catch (error) {
      this.handleError(error, 'getCourseGroups')
      throw error
    }
  }

  /**
   * Create new group
   * @param {Object} groupData - Group data
   * @param {string} ownerId - Owner user ID
   * @returns {Promise<Object>} Created group
   */
  async createGroup(groupData, ownerId) {
    try {
      // Validate group data
      this.validateGroupData(groupData)

      // Check if course exists
      const { CourseRepository } = require('./repositories/CourseRepository')
      const courseRepository = new CourseRepository()
      const course = await courseRepository.findById(groupData.courseId)

      if (!course) {
        throw new Error('Invalid course')
      }

      const group = await this.groupRepository.createWithOwner(groupData, ownerId)

      // Invalidate relevant caches
      await this.invalidateCachePatterns(
        `course:${groupData.courseId}:*`,
        `user:${ownerId}:groups`
      )

      return group
    } catch (error) {
      this.handleError(error, 'createGroup')
      throw error
    }
  }

  /**
   * Join group by ID
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Membership record
   */
  async joinGroup(groupId, userId) {
    try {
      if (!groupId || !userId) {
        throw new Error('Group ID and User ID are required')
      }

      const group = await this.groupRepository.findById(groupId)
      if (!group) {
        throw new Error('Group not found')
      }

      // Check if group is public
      if (group.visibility === 'private') {
        throw new Error('This group is private. You need an invite link to join')
      }

      // Check if group is full
      const memberCount = await this.groupMemberRepository.countGroupMembers(groupId)
      if (memberCount >= group.maxMembers) {
        throw new Error('This group is full')
      }

      // Check if user is already a member
      const existingMembership = await this.groupMemberRepository.findMembership(groupId, userId)
      if (existingMembership) {
        return existingMembership // Already a member
      }

      const membership = await this.groupMemberRepository.addMember(groupId, userId, 'member')

      // Invalidate relevant caches
      await this.invalidateCachePatterns(
        `course:${group.courseId}:*`,
        `user:${userId}:groups`
      )

      return membership
    } catch (error) {
      this.handleError(error, 'joinGroup')
      throw error
    }
  }

  /**
   * Join group via invite token
   * @param {string} token - Invite token
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Group joined
   */
  async joinGroupByInvite(token, userId) {
    try {
      if (!token || !userId) {
        throw new Error('Invite token and User ID are required')
      }

      const group = await this.groupRepository.findByInviteToken(token)
      if (!group) {
        throw new Error('Invalid or expired invite link')
      }

      // Check if group is full
      const memberCount = await this.groupMemberRepository.countGroupMembers(group._id)
      if (memberCount >= group.maxMembers) {
        throw new Error('This group is full')
      }

      // Check if user is already a member
      const existingMembership = await this.groupMemberRepository.findMembership(group._id, userId)
      if (existingMembership) {
        return group // Already a member
      }

      await this.groupMemberRepository.addMember(group._id, userId, 'member')

      // Invalidate relevant caches
      await this.invalidateCachePatterns(
        `course:${group.courseId}:*`,
        `user:${userId}:groups`
      )

      return group
    } catch (error) {
      this.handleError(error, 'joinGroupByInvite')
      throw error
    }
  }

  /**
   * Leave group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if left successfully
   */
  async leaveGroup(groupId, userId) {
    try {
      if (!groupId || !userId) {
        throw new Error('Group ID and User ID are required')
      }

      const group = await this.groupRepository.findById(groupId)
      if (!group) {
        throw new Error('Group not found')
      }

      const membership = await this.groupMemberRepository.findMembership(groupId, userId)
      if (!membership) {
        return true // Already not a member
      }

      const memberCount = await this.groupMemberRepository.countGroupMembers(groupId)

      // If user is owner, handle ownership transfer or group deletion
      if (membership.role === 'owner') {
        if (memberCount > 1) {
          throw new Error('Owner cannot leave while members exist')
        }
        // Delete group if owner is the only member
        await this.groupRepository.deleteById(groupId)
        await this.groupMemberRepository.removeMember(groupId, userId)
      } else {
        // Regular member leaving
        await this.groupMemberRepository.removeMember(groupId, userId)
      }

      // Invalidate relevant caches
      await this.invalidateCachePatterns(
        `course:${group.courseId}:*`,
        `user:${userId}:groups`
      )

      return true
    } catch (error) {
      this.handleError(error, 'leaveGroup')
      throw error
    }
  }

  /**
   * Get group details with members
   * @param {string} groupId - Group ID
   * @returns {Promise<Object>} Group with member details
   */
  async getGroupDetails(groupId) {
    try {
      if (!groupId) {
        throw new Error('Group ID is required')
      }

      const group = await this.groupRepository.findById(groupId)
      if (!group) {
        throw new Error('Group not found')
      }

      const members = await this.groupMemberRepository.findGroupMembersWithUsers(groupId)

      return { group, members }
    } catch (error) {
      this.handleError(error, 'getGroupDetails')
      throw error
    }
  }

  /**
   * Remove member from group (owner only)
   * @param {string} groupId - Group ID
   * @param {string} targetUserId - User ID to remove
   * @param {string} requesterId - User making the request (must be owner)
   * @returns {Promise<boolean>} True if removed successfully
   */
  async removeMember(groupId, targetUserId, requesterId) {
    try {
      if (!groupId || !targetUserId || !requesterId) {
        throw new Error('Group ID, target user ID, and requester ID are required')
      }

      const group = await this.groupRepository.findById(groupId)
      if (!group) {
        throw new Error('Group not found')
      }

      // Check if requester is owner
      if (String(group.ownerId) !== String(requesterId)) {
        throw new Error('Forbidden')
      }

      // Owner cannot be removed
      if (String(group.ownerId) === String(targetUserId)) {
        throw new Error('Owner cannot be removed')
      }

      const removed = await this.groupMemberRepository.removeMember(groupId, targetUserId)

      if (removed) {
        // Invalidate relevant caches
        await this.invalidateCachePatterns(
          `course:${group.courseId}:*`,
          `user:${targetUserId}:groups`
        )
      }

      return removed
    } catch (error) {
      this.handleError(error, 'removeMember')
      throw error
    }
  }

  /**
   * Regenerate group invite token (owner only)
   * @param {string} groupId - Group ID
   * @param {string} requesterId - User making the request (must be owner)
   * @returns {Promise<Object>} Updated group
   */
  async regenerateInvite(groupId, requesterId) {
    try {
      if (!groupId || !requesterId) {
        throw new Error('Group ID and requester ID are required')
      }

      const group = await this.groupRepository.findById(groupId)
      if (!group) {
        throw new Error('Group not found')
      }

      // Check if requester is owner
      if (String(group.ownerId) !== String(requesterId)) {
        throw new Error('Forbidden')
      }

      const updatedGroup = await this.groupRepository.regenerateInviteToken(groupId)

      if (updatedGroup) {
        // Invalidate relevant caches
        await this.invalidateCachePatterns(`course:${group.courseId}:*`)
      }

      return updatedGroup
    } catch (error) {
      this.handleError(error, 'regenerateInvite')
      throw error
    }
  }

  /**
   * Get user's groups with course details
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's groups with course information
   */
  async getUserGroups(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required')
      }

      const cacheKey = this.generateCacheKey('userGroups', userId)

      return await this.executeCachedOperation(
        cacheKey,
        () => this.groupMemberRepository.findUserGroupsWithCourses(userId),
        300 // Cache for 5 minutes
      )
    } catch (error) {
      this.handleError(error, 'getUserGroups')
      throw error
    }
  }

  /**
   * Validate group data
   * @param {Object} groupData - Group data to validate
   * @throws {Error} If validation fails
   */
  validateGroupData(groupData) {
    const errors = []

    if (!groupData.name || groupData.name.trim().length < 2 || groupData.name.trim().length > 60) {
      errors.push('Name must be 2-60 characters')
    }

    if (groupData.description && groupData.description.trim().length > 500) {
      errors.push('Description too long (max 500 characters)')
    }

    const visibility = groupData.visibility === 'private' ? 'private' : 'public'
    if (!['public', 'private'].includes(visibility)) {
      errors.push('Invalid visibility setting')
    }

    let maxMembers = parseInt(groupData.maxMembers, 10)
    if (Number.isNaN(maxMembers)) maxMembers = 25
    if (maxMembers < 2 || maxMembers > 100) {
      errors.push('Max members must be between 2 and 100')
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '))
    }
  }
}

module.exports = GroupService