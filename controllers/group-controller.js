const mongoose = require("mongoose")
const { Course, Group, GroupMember, User } = require("../models/db_schema")

async function getMemberCounts(groupIds) {
  if (!groupIds.length) return {}
  const rows = await GroupMember.aggregate([
    { $match: { groupId: { $in: groupIds.map(id => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: "$groupId", count: { $sum: 1 } } },
  ])
  const map = {}
  for (const r of rows) map[String(r._id)] = r.count
  return map
}

function ensureOwner(req, group) {
  const userId = String(req.session.userId)
  return String(group.ownerId) === userId
}

const renderCourseDetail = async (req, res) => {
  try {
    const courseId = req.params.courseId
    const course = await Course.findById(courseId).lean()
    if (!course) {
      req.session.flash = { type: "error", message: "Course not found." }
      return res.redirect("/courses")
    }

    const tab = req.query.tab === "groups" ? "groups" : "overview"

    let groups = []
    let memberCounts = {}
    if (tab === "groups") {
      const userId = req.session.userId
      let myGroupIds = []
      if (userId) {
        const myMemberships = await GroupMember.find({ userId }).select("groupId").lean()
        myGroupIds = myMemberships.map(m => m.groupId)
      }
      const query = { courseId: course._id, $or: [{ visibility: "public" }, { _id: { $in: myGroupIds } }] }
      groups = await Group.find(query).sort({ createdAt: -1 }).lean()
      memberCounts = await getMemberCounts(groups.map(g => g._id))
      groups = groups.map(g => ({ ...g, memberCount: memberCounts[String(g._id)] || 0, isOwner: userId ? String(g.ownerId) === String(userId) : false }))
    }

    res.render("courses/detail.njk", { course, tab, groups })
  } catch (err) {
    console.error("renderCourseDetail error", err)
    res.status(500)
    res.render("500.njk")
  }
}

const renderNewGroupForm = async (req, res) => {
  try {
    const courseId = req.query.course
    const course = await Course.findById(courseId).lean()
    if (!course) {
      req.session.flash = { type: "error", message: "Course not found." }
      return res.redirect("/courses")
    }
    const values = (res.locals.flash && res.locals.flash.values) || { name: "", description: "", visibility: "public", maxMembers: 25 }
    const errors = (res.locals.flash && res.locals.flash.errors) || {}
    res.render("groups/new.njk", { course, values, errors })
  } catch (err) {
    console.error("renderNewGroupForm error", err)
    res.status(500).render("500.njk")
  }
}

const createGroup = async (req, res) => {
  try {
    const { courseId, name, description, visibility, maxMembers } = req.body
    const course = await Course.findById(courseId).lean()
    const errors = {}
    const values = { name: name?.trim() || "", description: description?.trim() || "", visibility: visibility || "public", maxMembers }

    if (!course) errors.courseId = "Invalid course."
    if (!name || name.trim().length < 2 || name.trim().length > 60) errors.name = "Name must be 2–60 characters."
    if (description && description.trim().length > 500) errors.description = "Description too long (max 500)."
    const vis = visibility === "private" ? "private" : "public"
    let max = parseInt(maxMembers, 10)
    if (Number.isNaN(max)) max = 25
    if (max < 2 || max > 100) errors.maxMembers = "Max members must be between 2 and 100."

    if (Object.keys(errors).length) {
      req.session.flash = { type: "error", message: "Please fix the errors below.", errors, values }
      return res.redirect(`/groups/new?course=${courseId}`)
    }

    const ownerId = req.session.userId
    const group = new Group({ name: name.trim(), description: description?.trim() || "", visibility: vis, maxMembers: max, courseId, ownerId })
    await group.save()
    await GroupMember.create({ groupId: group._id, userId: ownerId, role: "owner" })

    req.session.flash = { type: "success", message: "Study Group created." }
    res.redirect(`/groups/${group._id}`)
  } catch (err) {
    console.error("createGroup error", err)
    req.session.flash = { type: "error", message: "Failed to create group." }
    res.redirect("/courses")
  }
}

const resolveInvite = async (req, res) => {
  try {
    const { token } = req.params
    const group = await Group.findOne({ inviteToken: token })
    if (!group) {
      req.session.flash = { type: "error", message: "Invalid or expired invite link." }
      return res.redirect("/courses")
    }

    const now = new Date()
    if (now > group.inviteTokenExpiresAt) {
      req.session.flash = { type: "error", message: "This invite link has expired. Please ask the owner to regenerate a new link." }
      return res.redirect(`/groups/${group._id}`)
    }

    if (!req.session?.userId) {
      req.session.returnTo = req.originalUrl
      req.session.flash = { type: "warning", message: "Please sign in to continue." }
      return res.redirect("/login")
    }

    const count = await GroupMember.countDocuments({ groupId: group._id })
    if (count >= group.maxMembers) {
      req.session.flash = { type: "error", message: "This group is full." }
      return res.redirect(`/groups/${group._id}`)
    }

    const userId = req.session.userId
    const existing = await GroupMember.findOne({ groupId: group._id, userId })
    if (!existing) {
      await GroupMember.create({ groupId: group._id, userId, role: "member" })
    }

    req.session.flash = { type: "success", message: "You have joined the Study Group." }
    res.redirect(`/groups/${group._id}`)
  } catch (err) {
    console.error("resolveInvite error", err)
    req.session.flash = { type: "error", message: "Could not process invite." }
    res.redirect("/courses")
  }
}

const joinGroup = async (req, res) => {
  try {
    const groupId = req.params.id
    const group = await Group.findById(groupId)
    if (!group) {
      req.session.flash = { type: "error", message: "Group not found." }
      return res.redirect("/courses")
    }
    if (group.visibility === "private") {
      req.session.flash = { type: "error", message: "This Study Group is private. You need an invite link to join." }
      return res.redirect(`/groups/${group._id}`)
    }

    const count = await GroupMember.countDocuments({ groupId: group._id })
    if (count >= group.maxMembers) {
      req.session.flash = { type: "error", message: "This group is full." }
      return res.redirect(`/groups/${group._id}`)
    }

    const userId = req.session.userId
    const existing = await GroupMember.findOne({ groupId: group._id, userId })
    if (!existing) await GroupMember.create({ groupId: group._id, userId, role: "member" })

    req.session.flash = { type: "success", message: "Joined the Study Group." }
    res.redirect(`/groups/${group._id}`)
  } catch (err) {
    console.error("joinGroup error", err)
    req.session.flash = { type: "error", message: "Could not join group." }
    res.redirect("/courses")
  }
}

const leaveGroup = async (req, res) => {
  try {
    const groupId = req.params.id
    const userId = req.session.userId
    const group = await Group.findById(groupId)
    if (!group) {
      req.session.flash = { type: "error", message: "Group not found." }
      return res.redirect("/courses")
    }

    const membership = await GroupMember.findOne({ groupId, userId })
    if (!membership) {
      req.session.flash = { type: "success", message: "You have left the group." }
      return res.redirect(`/courses/${group.courseId}?tab=groups`)
    }

    const memberCount = await GroupMember.countDocuments({ groupId })

    if (membership.role === "owner") {
      if (memberCount > 1) {
        req.session.flash = { type: "error", message: "Owner cannot leave while members exist." }
        return res.redirect(`/groups/${groupId}`)
      }
      await GroupMember.deleteOne({ _id: membership._id })
      await Group.deleteOne({ _id: groupId })
      req.session.flash = { type: "success", message: "Group deleted." }
      return res.redirect(`/courses/${group.courseId}?tab=groups`)
    }

    await GroupMember.deleteOne({ _id: membership._id })
    req.session.flash = { type: "success", message: "You have left the group." }
    res.redirect(`/courses/${group.courseId}?tab=groups`)
  } catch (err) {
    console.error("leaveGroup error", err)
    req.session.flash = { type: "error", message: "Could not leave group." }
    res.redirect("/courses")
  }
}

const renderGroupDetail = async (req, res) => {
  try {
    const groupId = req.params.id
    const group = await Group.findById(groupId).lean()
    if (!group) {
      req.session.flash = { type: "error", message: "Group not found." }
      return res.redirect("/courses")
    }

    const course = await Course.findById(group.courseId).lean()
    const members = await GroupMember.find({ groupId }).lean()
    const userIds = members.map(m => m.userId)
    const users = await User.find({ _id: { $in: userIds } }).lean()
    const userMap = {}
    for (const u of users) userMap[String(u._id)] = u

    const enrichedMembers = members.map(m => ({ ...m, user: userMap[String(m.userId)] }))

    const isOwner = req.session.userId ? String(group.ownerId) === String(req.session.userId) : false
    const myMembership = req.session.userId ? members.find(m => String(m.userId) === String(req.session.userId)) : null

    const expiresInMs = Math.max(0, new Date(group.inviteTokenExpiresAt).getTime() - Date.now())

    res.render("groups/detail.njk", { group, course, members: enrichedMembers, isOwner, myMembership, expiresInMs })
  } catch (err) {
    console.error("renderGroupDetail error", err)
    res.status(500)
    res.render("500.njk")
  }
}

const kickMember = async (req, res) => {
  try {
    const groupId = req.params.id
    const targetUserId = req.params.userId
    const group = await Group.findById(groupId)
    if (!group) {
      req.session.flash = { type: "error", message: "Group not found." }
      return res.redirect("/courses")
    }

    if (!ensureOwner(req, group)) {
      req.session.flash = { type: "error", message: "Forbidden." }
      return res.status(403).redirect(`/groups/${groupId}`)
    }

    if (String(group.ownerId) === String(targetUserId)) {
      req.session.flash = { type: "error", message: "Owner cannot be removed." }
      return res.redirect(`/groups/${groupId}`)
    }

    await GroupMember.deleteOne({ groupId, userId: targetUserId })
    req.session.flash = { type: "success", message: "Member removed." }
    res.redirect(`/groups/${groupId}`)
  } catch (err) {
    console.error("kickMember error", err)
    req.session.flash = { type: "error", message: "Could not remove member." }
    res.redirect("/courses")
  }
}

const regenerateInvite = async (req, res) => {
  try {
    const groupId = req.params.id
    const group = await Group.findById(groupId)
    if (!group) {
      req.session.flash = { type: "error", message: "Group not found." }
      return res.redirect("/courses")
    }
    if (!ensureOwner(req, group)) {
      req.session.flash = { type: "error", message: "Forbidden." }
      return res.status(403).redirect(`/groups/${groupId}`)
    }

    group.regenerateInvite()
    await group.save()
    req.session.flash = { type: "success", message: "Invite link regenerated." }
    res.redirect(`/groups/${groupId}`)
  } catch (err) {
    console.error("regenerateInvite error", err)
    req.session.flash = { type: "error", message: "Could not regenerate invite." }
    res.redirect("/courses")
  }
}

const listMyGroups = async (req, res) => {
  try {
    const userId = req.session.userId
    const memberships = await GroupMember.find({ userId }).lean()
    const groupIds = memberships.map(m => m.groupId)
    const groups = await Group.find({ _id: { $in: groupIds } }).lean()
    const courseIds = Array.from(new Set(groups.map(g => String(g.courseId))))
    const courses = await Course.find({ _id: { $in: courseIds } }).lean()
    const courseMap = {}
    for (const c of courses) courseMap[String(c._id)] = c

    const memberCounts = await getMemberCounts(groups.map(g => g._id))

    const items = groups.map(g => ({ group: g, course: courseMap[String(g.courseId)], memberCount: memberCounts[String(g._id)] || 0, role: memberships.find(m => String(m.groupId) === String(g._id))?.role || "member" }))

    res.render("me/groups.njk", { items })
  } catch (err) {
    console.error("listMyGroups error", err)
    res.status(500).render("500.njk")
  }
}

module.exports = {
  renderCourseDetail,
  renderNewGroupForm,
  createGroup,
  resolveInvite,
  joinGroup,
  leaveGroup,
  renderGroupDetail,
  kickMember,
  regenerateInvite,
  listMyGroups,
}
