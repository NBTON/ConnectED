const mongoose = require("mongoose")
const crypto = require("crypto")

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, required: true, unique: true },
})

const courseSchema = new mongoose.Schema({
  title: { type: String, trim: true, required: true },
  linktoTheCall: { type: String, trim: true, required: true },
  image: { type: String },
}, { timestamps: true })

courseSchema.index({ title: 1 })
courseSchema.index({ linktoTheCall: 1 })

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  description: { type: String, trim: true, maxlength: 500 },
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  inviteToken: { type: String, required: true, unique: true, index: true },
  inviteTokenExpiresAt: { type: Date, required: true },
  maxMembers: { type: Number, default: 25, min: 2, max: 100 },
}, { timestamps: true })

groupSchema.index({ courseId: 1, name: 1 })

groupSchema.pre("validate", function(next) {
  if (!this.inviteToken) {
    this.inviteToken = crypto.randomBytes(16).toString("hex")
  }
  if (!this.inviteTokenExpiresAt) {
    const expires = new Date()
    expires.setDate(expires.getDate() + 7)
    this.inviteTokenExpiresAt = expires
  }
  next()
})

groupSchema.methods.regenerateInvite = function() {
  this.inviteToken = crypto.randomBytes(16).toString("hex")
  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  this.inviteTokenExpiresAt = expires
}

const groupMemberSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["owner", "member"], default: "member" },
  joinedAt: { type: Date, default: Date.now },
})

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true })

const User = mongoose.model("User", userSchema)
// Map to legacy collection name 'subjects' to avoid data loss
const Course = mongoose.model("Course", courseSchema, "subjects")
const Group = mongoose.model("Group", groupSchema)
const GroupMember = mongoose.model("GroupMember", groupMemberSchema)

module.exports = { User, Course, Group, GroupMember }
