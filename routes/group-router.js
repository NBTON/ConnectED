const { requireAuth } = require("../middleware/auth")
const {
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
} = require("../controllers/group-controller")

const router = require("express").Router()

router.get("/courses/:courseId", requireAuth, renderCourseDetail)

router.get("/groups/new", requireAuth, renderNewGroupForm)
router.post("/groups", requireAuth, createGroup)

router.get("/g/:token", resolveInvite)

router.post("/groups/:id/join", requireAuth, joinGroup)
router.post("/groups/:id/leave", requireAuth, leaveGroup)

router.get("/groups/:id", requireAuth, renderGroupDetail)
router.post("/groups/:id/kick/:userId", requireAuth, kickMember)
router.post("/groups/:id/invite/regenerate", requireAuth, regenerateInvite)

router.get("/me/groups", requireAuth, listMyGroups)

module.exports = router
