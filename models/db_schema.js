const mongoose = require("mongoose")
const crypto = require("crypto")

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  interests: [{ type: String }],
  preferences: {
    matchingConsent: { type: Boolean, default: true },
    feedVisibility: { type: String, enum: ["public", "friends", "private"], default: "public" }
  },
  badges: [{ type: mongoose.Schema.Types.ObjectId, ref: "Badge" }],
  profile: {
    bio: { type: String, maxlength: 500 },
    avatar: { type: String },
    skills: [{ type: String }],
    experience: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" }
  },
  lastActivity: { type: Date, default: Date.now },
}, { timestamps: true })

const courseSchema = new mongoose.Schema({
  title: { type: String, trim: true, required: true },
  linktoTheCall: { type: String, trim: true, required: true },
  image: { type: String },
  description: { type: String, maxlength: 1000 },
  tags: [{ type: String }],
  difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
  category: { type: String },
  instructor: { type: String },
  duration: { type: Number }, // in hours
  rating: { type: Number, min: 0, max: 5, default: 0 },
  enrolledCount: { type: Number, default: 0 },
}, { timestamps: true })

courseSchema.index({ title: 1 })
courseSchema.index({ linktoTheCall: 1 })
courseSchema.index({ tags: 1 })
courseSchema.index({ difficulty: 1 })
courseSchema.index({ category: 1 })
courseSchema.index({ rating: -1 })

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

// Badge schema for gamification
const badgeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  icon: { type: String },
  type: { type: String, enum: ["achievement", "participation", "milestone"], required: true },
  criteria: {
    action: { type: String }, // e.g., "courses_completed", "groups_joined"
    threshold: { type: Number, default: 1 }
  },
  rarity: { type: String, enum: ["common", "rare", "epic", "legendary"], default: "common" },
}, { timestamps: true })

// Analytics schema for tracking user activities
const analyticsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: { type: String, required: true }, // e.g., "course_view", "group_join", "login"
  resourceType: { type: String }, // e.g., "course", "group", "user"
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  metadata: { type: mongoose.Schema.Types.Mixed }, // additional data
  ipAddress: { type: String },
  userAgent: { type: String },
}, { timestamps: true })

analyticsSchema.index({ userId: 1, createdAt: -1 })
analyticsSchema.index({ action: 1, createdAt: -1 })

// Feed schema for posts and events
const feedSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["post", "event", "announcement", "recommendation"], required: true },
  title: { type: String, required: true },
  content: { type: String, maxlength: 2000 },
  tags: [{ type: String }],
  visibility: { type: String, enum: ["public", "friends", "group"], default: "public" },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" }, // for group-specific posts
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now }
  }],
  isModerated: { type: Boolean, default: false },
  moderationReason: { type: String },
}, { timestamps: true })

feedSchema.index({ authorId: 1, createdAt: -1 })
feedSchema.index({ type: 1, createdAt: -1 })
feedSchema.index({ tags: 1 })

// User activity schema for matching and recommendations
const userActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: { type: String, required: true }, // "view_course", "join_group", "complete_course"
  resourceType: { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  weight: { type: Number, default: 1 }, // for scoring relevance
}, { timestamps: true })

userActivitySchema.index({ userId: 1, createdAt: -1 })
userActivitySchema.index({ userId: 1, resourceType: 1, resourceId: 1 }, { unique: true })

// Chat message schema for real-time messaging
const chatMessageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true }, // groupId or courseId
  roomType: { type: String, enum: ["group", "course"], required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, maxlength: 2000 },
  messageType: { type: String, enum: ["text", "file", "image", "system"], default: "text" },
  fileData: {
    filename: { type: String },
    originalName: { type: String },
    size: { type: Number },
    mimeType: { type: String },
    url: { type: String }
  },
  encrypted: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  editedAt: { type: Date },
  isModerated: { type: Boolean, default: false },
  moderationReason: { type: String },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "ChatMessage" },
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    emoji: { type: String },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true })

chatMessageSchema.index({ roomId: 1, createdAt: -1 })
chatMessageSchema.index({ senderId: 1, createdAt: -1 })

// Notification schema for real-time notifications
const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["message", "group_invite", "event", "mention", "like", "comment", "system"], required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed }, // additional data for the notification
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  actionUrl: { type: String }, // URL to redirect when clicked
  priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" }
}, { timestamps: true })

notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 })

// Event schema for scheduling and calendar integration
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, maxlength: 1000 },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" }, // optional, for group events
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" }, // optional, for course events
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  timezone: { type: String, default: "UTC" },
  location: { type: String }, // physical or virtual location
  meetingLink: { type: String }, // for virtual events
  attendees: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "accepted", "declined", "tentative"], default: "pending" },
    respondedAt: { type: Date }
  }],
  reminders: [{
    time: { type: Number }, // minutes before event
    sent: { type: Boolean, default: false }
  }],
  googleEventId: { type: String }, // for Google Calendar integration
  visibility: { type: String, enum: ["public", "private", "group"], default: "public" },
  maxAttendees: { type: Number },
  tags: [{ type: String }],
  isRecurring: { type: Boolean, default: false },
  recurrenceRule: { type: String } // RRULE for recurring events
}, { timestamps: true })

eventSchema.index({ organizerId: 1, startTime: 1 })
eventSchema.index({ groupId: 1, startTime: 1 })
eventSchema.index({ startTime: 1 })

// File sharing schema
const fileShareSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  url: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  roomId: { type: String, required: true }, // groupId or courseId
  roomType: { type: String, enum: ["group", "course"], required: true },
  version: { type: Number, default: 1 },
  parentFileId: { type: mongoose.Schema.Types.ObjectId, ref: "FileShare" }, // for versioning
  accessLevel: { type: String, enum: ["public", "group", "private"], default: "group" },
  downloadCount: { type: Number, default: 0 },
  lastDownloaded: { type: Date },
  tags: [{ type: String }],
  description: { type: String, maxlength: 500 },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true })

fileShareSchema.index({ roomId: 1, createdAt: -1 })
fileShareSchema.index({ uploadedBy: 1, createdAt: -1 })

// User presence schema for tracking online status
const userPresenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  status: { type: String, enum: ["online", "away", "busy", "offline"], default: "offline" },
  lastSeen: { type: Date, default: Date.now },
  currentRoom: { type: String }, // current chat room
  socketId: { type: String },
  deviceInfo: {
    userAgent: { type: String },
    ipAddress: { type: String }
  }
}, { timestamps: true })

userPresenceSchema.index({ userId: 1 }, { unique: true })

const User = mongoose.model("User", userSchema)
// Map to legacy collection name 'subjects' to avoid data loss
const Course = mongoose.model("Course", courseSchema, "subjects")
const Group = mongoose.model("Group", groupSchema)
const GroupMember = mongoose.model("GroupMember", groupMemberSchema)
const Badge = mongoose.model("Badge", badgeSchema)
const Analytics = mongoose.model("Analytics", analyticsSchema)
const Feed = mongoose.model("Feed", feedSchema)
const UserActivity = mongoose.model("UserActivity", userActivitySchema)
const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema)
const Notification = mongoose.model("Notification", notificationSchema)
const Event = mongoose.model("Event", eventSchema)
const FileShare = mongoose.model("FileShare", fileShareSchema)
const UserPresence = mongoose.model("UserPresence", userPresenceSchema)

module.exports = { User, Course, Group, GroupMember, Badge, Analytics, Feed, UserActivity, ChatMessage, Notification, Event, FileShare, UserPresence }
