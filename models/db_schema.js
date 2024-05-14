
const mongoose = require("mongoose")

const userSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        required: true,
        unique: true,
    },
})


const subjectSchema = mongoose.Schema({
    title: { type: String },
    linktoTheCall: { type: String },
    image: { type: String },
})

// subjectSchema.index({ title: 'text', description: 'text' })
subjectSchema.index({ title: 1 });
subjectSchema.index({ linktoTheCall: 1 });

const User = mongoose.model("User", userSchema)

const Subjects = mongoose.model("Subjects", subjectSchema)


module.exports = {
    User,
    Subjects
}