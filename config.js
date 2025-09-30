require("dotenv").config()

const isProd = process.env.NODE_ENV === "production"
const isDev = process.env.NODE_ENV === "development"

// Load environment-specific configurations
let envConfig = {}
if (isProd) {
  envConfig = require("./config/production")
} else if (isDev) {
  envConfig = require("./config/development")
}

// Validate required environment variables
if (isProd) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "dev_secret_change_me") {
    throw new Error("SESSION_SECRET must be set to a secure random value in production")
  }
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes("127.0.0.1")) {
    throw new Error("MONGODB_URI must be properly configured for production")
  }
  if (process.env.CORS_ORIGIN === "*") {
    throw new Error("CORS_ORIGIN cannot be '*' in production - specify allowed origins")
  }
}

// Base configuration
const baseConfig = {
  NODE_ENV: process.env.NODE_ENV || "development",
  isProd,
  isDev,
  PORT: parseInt(process.env.PORT || "3000", 10),
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/conect-ed",
  SESSION_SECRET: process.env.SESSION_SECRET || "dev_secret_change_me_in_production_use_secure_random",
  STATIC_MAX_AGE: process.env.STATIC_MAX_AGE || (isProd ? "7d" : "0"),
  CORS_ORIGIN: process.env.CORS_ORIGIN || (isProd ? "http://localhost:3000" : "*"),
  REDIS_URL: process.env.REDIS_URL,
  LOG_LEVEL: process.env.LOG_LEVEL || (isProd ? "warn" : "info"),
}

// Environment-specific overrides
const config = {
  ...baseConfig,
  ...envConfig,
  // Core security configurations
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || "15", 10) * 60 * 1000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  LOGIN_RATE_LIMIT_WINDOW: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW || "5", 10) * 60 * 1000,
  LOGIN_RATE_LIMIT_MAX: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || "5", 10),
  // Database connection settings
  DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || "30000", 10),
  DB_RETRY_ATTEMPTS: parseInt(process.env.DB_RETRY_ATTEMPTS || "3", 10),
  DB_RETRY_DELAY: parseInt(process.env.DB_RETRY_DELAY || "5000", 10),
  // Session security settings
  SESSION_COOKIE_MAX_AGE: parseInt(process.env.SESSION_COOKIE_MAX_AGE || "7", 10) * 24 * 60 * 60 * 1000,
  SESSION_ROLLING: process.env.SESSION_ROLLING !== "false",
  // File upload settings
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || "2097152", 10),
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES || "image/jpeg,image/png,image/gif,image/webp",
}

// Export both the merged config and individual sections for specific use
config.helmet = config.helmet || (isProd ? require("./config/production").helmet : { contentSecurityPolicy: false })
config.rateLimit = config.rateLimit || (isProd ? require("./config/production").rateLimit : require("./config/development").rateLimit)
config.session = config.session || (isProd ? require("./config/production").session : require("./config/development").session)

module.exports = config