// Use SQLite models instead of Mongoose
const { User, Course, Group, GroupMember } = require('../db-sqlite')

module.exports = { User, Course, Group, GroupMember }
