const mongoose = require("mongoose")

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

const User = mongoose.model("User", userSchema)
// Map to legacy collection name 'subjects' to avoid data loss
const Course = mongoose.model("Course", courseSchema, "subjects")

module.exports = { User, Course }
