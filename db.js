// Use SQLite instead of MongoDB for local development
const { User, Course, Group, GroupMember } = require('./db-sqlite')

// Export the models directly
module.exports = { User, Course, Group, GroupMember }
