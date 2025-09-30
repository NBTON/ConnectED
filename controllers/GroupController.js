const serviceContainer = require('../services/ServiceContainer')

/**
 * Group Controller - Handles HTTP requests for group operations
 * Refactored to follow SOLID principles with proper separation of concerns
 */
class GroupController {
  constructor() {
    // Get services from container (Dependency Injection)
    this.groupService = serviceContainer.get('groupService')
    this.courseService = serviceContainer.get('courseService')
    this.validationService = serviceContainer.get('validationService')
    this.errorHandler = serviceContainer.get('errorHandler')
  }

  /**
   * Render course detail page with groups
   * @route GET /courses/:courseId
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async renderCourseDetail(req, res) {
    try {
      const { courseId } = req.params
      const userId = req.session.userId
      const tab = req.query.tab === 'groups' ? 'groups' : 'overview'

      // Get course details
      const course = await this.courseService.getCourseById(courseId)
      if (!course) {
        req.session.flash = { type: 'error', message: 'Course not found.' }
        return res.redirect('/courses')
      }

      let groups = []
      if (tab === 'groups') {
        groups = await this.groupService.getCourseGroups(courseId, userId)
      }

      res.render('courses/detail.njk', { course, tab, groups })
    } catch (error) {
      console.error('renderCourseDetail error', error)
      res.status(500).render('500.njk')
    }
  }

  /**
   * Render new group form
   * @route GET /groups/new
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async renderNewGroupForm(req, res) {
    try {
      const courseId = req.query.course

      if (!courseId) {
        req.session.flash = { type: 'error', message: 'Course ID is required.' }
        return res.redirect('/courses')
      }

      const course = await this.courseService.getCourseById(courseId)
      if (!course) {
        req.session.flash = { type: 'error', message: 'Course not found.' }
        return res.redirect('/courses')
      }

      const values = (res.locals.flash && res.locals.flash.values) || {
        name: '',
        description: '',
        visibility: 'public',
        maxMembers: 25
      }
      const errors = (res.locals.flash && res.locals.flash.errors) || {}

      res.render('groups/new.njk', { course, values, errors })
    } catch (error) {
      console.error('renderNewGroupForm error', error)
      res.status(500).render('500.njk')
    }
  }

  /**
   * Create new group
   * @route POST /groups
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createGroup(req, res) {
    try {
      const { courseId, name, description, visibility, maxMembers } = req.body

      // Validate input data
      const validation = this.validationService.validateGroupData({
        name,
        description,
        visibility,
        maxMembers
      })

      if (!validation.isValid) {
        req.session.flash = {
          type: 'error',
          message: 'Please fix the errors below.',
          errors: validation.errors,
          values: { name, description, visibility, maxMembers }
        }
        return res.redirect(`/groups/new?course=${courseId}`)
      }

      const sanitizedData = validation.sanitized
      const ownerId = req.session.userId

      // Create group using service
      const group = await this.groupService.createGroup({
        courseId,
        ...sanitizedData
      }, ownerId)

      req.session.flash = { type: 'success', message: 'Study Group created.' }
      res.redirect(`/groups/${group._id}`)
    } catch (error) {
      const errorResponse = this.errorHandler.handleControllerError(error, 'createGroup', req)
      req.session.flash = { type: 'error', message: errorResponse.error.message }
      res.redirect('/courses')
    }
  }

  /**
   * Resolve invite link and join group
   * @route GET /groups/invite/:token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async resolveInvite(req, res) {
    try {
      const { token } = req.params

      if (!req.session?.userId) {
        req.session.returnTo = req.originalUrl
        req.session.flash = { type: 'warning', message: 'Please sign in to continue.' }
        return res.redirect('/login')
      }

      const userId = req.session.userId

      // Join group using service
      await this.groupService.joinGroupByInvite(token, userId)

      req.session.flash = { type: 'success', message: 'You have joined the Study Group.' }
      res.redirect(`/groups/${req.params.token}`) // This should be the group ID, not token
    } catch (error) {
      const errorResponse = this.errorHandler.handleControllerError(error, 'resolveInvite', req)
      req.session.flash = { type: 'error', message: errorResponse.error.message }
      res.redirect('/courses')
    }
  }

  /**
   * Join group by ID
   * @route POST /groups/:id/join
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async joinGroup(req, res) {
    try {
      const { id: groupId } = req.params
      const userId = req.session.userId

      // Join group using service
      await this.groupService.joinGroup(groupId, userId)

      req.session.flash = { type: 'success', message: 'Joined the Study Group.' }
      res.redirect(`/groups/${groupId}`)
    } catch (error) {
      const errorResponse = this.errorHandler.handleControllerError(error, 'joinGroup', req)
      req.session.flash = { type: 'error', message: errorResponse.error.message }
      res.redirect('/courses')
    }
  }

  /**
   * Leave group
   * @route POST /groups/:id/leave
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async leaveGroup(req, res) {
    try {
      const { id: groupId } = req.params
      const userId = req.session.userId

      // Leave group using service
      await this.groupService.leaveGroup(groupId, userId)

      req.session.flash = { type: 'success', message: 'You have left the group.' }
      res.redirect(`/courses/${req.query.courseId || ''}?tab=groups`)
    } catch (error) {
      const errorResponse = this.errorHandler.handleControllerError(error, 'leaveGroup', req)
      req.session.flash = { type: 'error', message: errorResponse.error.message }
      res.redirect('/courses')
    }
  }

  /**
   * Render group detail page
   * @route GET /groups/:id
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async renderGroupDetail(req, res) {
    try {
      const { id: groupId } = req.params

      // Get group details with members using service
      const { group, members } = await this.groupService.getGroupDetails(groupId)

      const course = await this.courseService.getCourseById(group.courseId)

      // Determine user permissions
      const isOwner = req.session.userId ? String(group.ownerId) === String(req.session.userId) : false
      const myMembership = req.session.userId ?
        members.find(m => String(m.userId) === String(req.session.userId)) : null

      // Calculate invite expiration
      const expiresInMs = Math.max(0, new Date(group.inviteTokenExpiresAt).getTime() - Date.now())

      res.render('groups/detail.njk', {
        group,
        course,
        members,
        isOwner,
        myMembership,
        expiresInMs
      })
    } catch (error) {
      const errorResponse = this.errorHandler.handleControllerError(error, 'renderGroupDetail', req)

      if (errorResponse.error.code === 'NOT_FOUND') {
        req.session.flash = { type: 'error', message: errorResponse.error.message }
        return res.redirect('/courses')
      }

      console.error('renderGroupDetail error', error)
      res.status(500).render('500.njk')
    }
  }

  /**
   * Remove member from group (owner only)
   * @route DELETE /groups/:id/members/:userId
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async kickMember(req, res) {
    try {
      const { id: groupId, userId: targetUserId } = req.params
      const requesterId = req.session.userId

      // Remove member using service
      await this.groupService.removeMember(groupId, targetUserId, requesterId)

      req.session.flash = { type: 'success', message: 'Member removed.' }
      res.redirect(`/groups/${groupId}`)
    } catch (error) {
      const errorResponse = this.errorHandler.handleControllerError(error, 'kickMember', req)

      if (errorResponse.error.code === 'FORBIDDEN') {
        req.session.flash = { type: 'error', message: errorResponse.error.message }
        return res.status(403).redirect(`/groups/${req.params.id}`)
      }

      req.session.flash = { type: 'error', message: errorResponse.error.message }
      res.redirect('/courses')
    }
  }

  /**
   * Regenerate group invite token (owner only)
   * @route POST /groups/:id/regenerate-invite
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async regenerateInvite(req, res) {
    try {
      const { id: groupId } = req.params
      const requesterId = req.session.userId

      // Regenerate invite using service
      await this.groupService.regenerateInvite(groupId, requesterId)

      req.session.flash = { type: 'success', message: 'Invite link regenerated.' }
      res.redirect(`/groups/${groupId}`)
    } catch (error) {
      const errorResponse = this.errorHandler.handleControllerError(error, 'regenerateInvite', req)

      if (errorResponse.error.code === 'FORBIDDEN') {
        req.session.flash = { type: 'error', message: errorResponse.error.message }
        return res.status(403).redirect(`/groups/${req.params.id}`)
      }

      req.session.flash = { type: 'error', message: errorResponse.error.message }
      res.redirect('/courses')
    }
  }

  /**
   * List user's groups
   * @route GET /me/groups
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async listMyGroups(req, res) {
    try {
      const userId = req.session.userId

      // Get user's groups using service
      const items = await this.groupService.getUserGroups(userId)

      res.render('me/groups.njk', { items })
    } catch (error) {
      console.error('listMyGroups error', error)
      res.status(500).render('500.njk')
    }
  }
}

// Create controller instance
const groupController = new GroupController()

// Export individual methods for use in routes
module.exports = {
  renderCourseDetail: (req, res) => groupController.renderCourseDetail(req, res),
  renderNewGroupForm: (req, res) => groupController.renderNewGroupForm(req, res),
  createGroup: (req, res) => groupController.createGroup(req, res),
  resolveInvite: (req, res) => groupController.resolveInvite(req, res),
  joinGroup: (req, res) => groupController.joinGroup(req, res),
  leaveGroup: (req, res) => groupController.leaveGroup(req, res),
  renderGroupDetail: (req, res) => groupController.renderGroupDetail(req, res),
  kickMember: (req, res) => groupController.kickMember(req, res),
  regenerateInvite: (req, res) => groupController.regenerateInvite(req, res),
  listMyGroups: (req, res) => groupController.listMyGroups(req, res),
}