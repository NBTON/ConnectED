const mongoose = require("mongoose")
require("dotenv").config()

const DATABASE_URL = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/conect-ed"
;(async () => {
  try {
    const connectionInstance = await mongoose.connect(DATABASE_URL)
    console.log("db connected on", DATABASE_URL, connectionInstance.connection.host)
  } catch (error) {
    console.warn("MongoDB connection failed:", error?.message)
    // Do not crash in dev/preview; routes that need DB will still error gracefully
  }
})()

module.exports = mongoose
