const mongoose = require("mongoose")
const config = require("./config")

mongoose.set("strictQuery", true)

// Configure mongoose connection options
const mongooseOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: config.DB_CONNECTION_TIMEOUT, // Keep trying to send operations for 30 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferCommands: false, // Disable mongoose buffering
  bufferMaxEntries: 0, // Disable mongoose buffering
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
}

// Connection state tracking
let isConnected = false
let connectionAttempts = 0

async function connectDB() {
  // Return existing connection if already connected
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  const maxRetries = config.DB_RETRY_ATTEMPTS
  const retryDelay = config.DB_RETRY_DELAY

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      connectionAttempts = attempt
      const conn = await mongoose.connect(config.MONGODB_URI, mongooseOptions)

      // Set up connection event listeners
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err)
        isConnected = false
      })

      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected')
        isConnected = false
      })

      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected')
        isConnected = true
      })

      isConnected = true
      console.log(`MongoDB connected successfully on ${config.MONGODB_URI} (${conn.connection.host}) - Attempt ${attempt}`)
      return conn

    } catch (error) {
      console.warn(`MongoDB connection attempt ${attempt}/${maxRetries} failed:`, error?.message)

      if (attempt === maxRetries) {
        console.error(`MongoDB connection failed after ${maxRetries} attempts`)
        // In production, we might want to exit, but in dev we'll continue gracefully
        if (config.isProd) {
          throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts: ${error?.message}`)
        }
        return null
      }

      // Wait before retrying
      if (attempt < maxRetries) {
        console.log(`Retrying MongoDB connection in ${retryDelay/1000} seconds...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }
}

// Health check function for monitoring
function getConnectionStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  }

  return {
    isConnected,
    state: states[mongoose.connection.readyState] || 'unknown',
    connectionAttempts,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || 'none',
    port: mongoose.connection.port || 'none',
    name: mongoose.connection.name || 'none'
  }
}

// Graceful shutdown
async function disconnectDB() {
  try {
    await mongoose.connection.close()
    isConnected = false
    console.log('MongoDB disconnected gracefully')
  } catch (error) {
    console.error('Error during MongoDB disconnect:', error?.message)
  }
}

module.exports = {
  mongoose,
  connectDB,
  disconnectDB,
  getConnectionStatus
}
