const mongoose = require("mongoose")
const config = require("./config")

mongoose.set("strictQuery", true)

async function connectDB() {
  try {
    const conn = await mongoose.connect(config.MONGODB_URI)
    console.log("db connected on", config.MONGODB_URI, conn.connection.host)
    return conn
  } catch (error) {
    console.warn("MongoDB connection failed:", error?.message)
    // In dev, do not crash; dependent routes will handle errors gracefully
    return null
  }
}

module.exports = { mongoose, connectDB }
