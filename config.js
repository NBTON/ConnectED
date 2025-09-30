require("dotenv").config()

const isProd = process.env.NODE_ENV === "production"

const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  isProd,
  PORT: parseInt(process.env.PORT || "3000", 10),
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/conect-ed",
  SESSION_SECRET: process.env.SESSION_SECRET || "dev_secret_change_me",
  STATIC_MAX_AGE: process.env.STATIC_MAX_AGE || (isProd ? "7d" : "0"),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
}

module.exports = config