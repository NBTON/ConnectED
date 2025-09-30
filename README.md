# ConnectED - Collaborative Learning Platform

A modern, secure, and scalable educational platform built with Express.js, Nunjucks templating, MongoDB, and Tailwind CSS. Features course management, study groups, and collaborative learning tools with enterprise-grade security and performance optimizations.

## 🚀 Features

- **Course Management**: Create, browse, and manage educational courses
- **Study Groups**: Form and join study groups for collaborative learning
- **User Authentication**: Secure login/registration with enhanced password policies
- **File Uploads**: Secure image uploads with comprehensive validation
- **Real-time Caching**: Redis/MongoDB caching for optimal performance
- **Responsive Design**: Mobile-first UI with Tailwind CSS
- **Security First**: Comprehensive security measures and input validation
- **Performance Monitoring**: Built-in performance tracking and health checks

## 📋 Prerequisites

- **Node.js 20+**
- **MongoDB 4.4+** (local installation or connection string)
- **Redis** (optional, for enhanced session storage and caching)

## 🔧 Environment Configuration

Create a `.env` file in the root directory:

```bash
# Database Configuration
MONGODB_URI=mongodb://127.0.0.1:27017/conect-ed
NODE_ENV=development

# Security Configuration
SESSION_SECRET=your-super-secure-random-session-secret-here
CORS_ORIGIN=http://localhost:3000

# Server Configuration
PORT=3000
STATIC_MAX_AGE=7d

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_WINDOW=300000
LOGIN_RATE_LIMIT_MAX=5

# Database Connection
DB_CONNECTION_TIMEOUT=30000
DB_RETRY_ATTEMPTS=3
DB_RETRY_DELAY=5000

# File Upload Configuration
MAX_FILE_SIZE=2097152
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp

# Session Configuration
SESSION_COOKIE_MAX_AGE=604800000
SESSION_ROLLING=true
```

## 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd connect-ed
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   # Using local MongoDB
   mongod

   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Start Redis (optional)**
   ```bash
   # Using local Redis
   redis-server

   # Or using Docker
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

## 🚀 Development

**Start development server with hot reload:**
```bash
npm run dev
```
This runs the server with nodemon and builds Tailwind CSS with watch mode.

**Build CSS manually:**
```bash
npm run build:css
```

**Run tests:**
```bash
npm test
```

**Run tests with coverage:**
```bash
npm run test:coverage
```

## 🏗️ Production Deployment

**Build for production:**
```bash
npm run build
```

**Start production server:**
```bash
npm start
```

**Using Docker:**
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t connected .
docker run -p 3000:3000 --env-file .env connected
```

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build:css` - Build Tailwind CSS manually
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically

## What changed in Phase 1
- UI moved to Tailwind CSS with brand primary color #E45200
- Sessions via express-session + connect-mongo (cookie: httpOnly, sameSite=lax; secure only in production)
- Flash messaging for inline success/errors
- Route protection: /courses, /courses/add and POSTs require login
- Logout route (POST /logout)
- "Subject(s)" renamed to "Course(s)" (model name Course maps to legacy collection `subjects`)
- File uploads saved to public/uploads/courses with default fallback image
- New error pages: 404 and 500
- Views updated and responsive

## Routes
- GET / — Landing page
- GET /about — About page
- GET /login, POST /login — Auth
- GET /register, POST /register — Auth
- POST /logout — End session
- GET /courses — List courses (requires login)
- GET /courses/add — Add form (requires login)
- POST /courses/add — Create course (requires login)
- Legacy: /subjects* → redirects to /courses*

## Uploads
Images are uploaded to `public/uploads/courses`. A default fallback (`public/Assets/subject-img.jpg`) is used if a course image is missing.

Uploads are restricted to images (`jpeg`, `png`, `gif`, `webp`) and max 2MB.

---

## 🔒 Security Features

ConnectED implements enterprise-grade security measures:

### Authentication & Authorization
- **Enhanced Password Policies**: Minimum 8 characters with complexity requirements
- **Secure Session Management**: HTTP-only, secure, sameSite cookies with configurable expiration
- **Rate Limiting**: Configurable global and authentication-specific rate limits
- **Brute Force Protection**: Progressive delays and account lockout mechanisms

### Input Validation & Sanitization
- **Comprehensive Input Validation**: All user inputs validated and sanitized
- **SQL Injection Prevention**: Parameterized queries and input sanitization
- **XSS Protection**: Content Security Policy and HTML sanitization
- **File Upload Security**: Type validation, size limits, and malicious file detection

### Network Security
- **CORS Protection**: Configurable origin validation with credentials support
- **Helmet Security Headers**: Comprehensive security headers including CSP, HSTS, XSS protection
- **HTTPS Enforcement**: Automatic HTTPS redirection in production
- **Request Size Limiting**: Configurable payload size limits

### Data Protection
- **Secure Database Connections**: Connection pooling with retry logic and timeout handling
- **Environment-based Configuration**: Production/development security hardening
- **Error Handling**: Secure error responses that don't leak sensitive information
- **Graceful Degradation**: Application continues functioning during database outages

### Monitoring & Logging
- **Security Event Logging**: Failed authentication attempts and suspicious activities
- **Performance Monitoring**: Real-time performance metrics and health checks
- **Error Tracking**: Comprehensive error logging with stack traces in development

## 📊 Performance Optimizations

- **Caching Layer**: Redis/MongoDB caching for improved response times
- **Database Optimization**: Connection pooling and query optimization
- **Static Asset Optimization**: Compressed assets with long-term caching headers
- **Progressive Loading**: Optimized resource loading and rendering

---

# Study Groups (Phase 2 MVP)

Authenticated users can create per-course Study Groups, discover them from a Course detail page, and join via invite links. Minimal management is provided.

## Data models

### Group
- name: String (required, 2–60 chars)
- courseId: ObjectId (ref: `Course`, required, indexed)
- ownerId: ObjectId (ref: `User`, required, indexed)
- description: String (optional, max 500)
- visibility: `public` | `private` (default `public`)
- inviteToken: String (required, unique, indexed)
- inviteTokenExpiresAt: Date (required, default now + 7 days)
- maxMembers: Number (default 25, min 2, max 100)
- timestamps: createdAt/updatedAt
- Helpers:
  - pre-validate hook generates invite token and sets expiry to 7 days if missing
  - instance method `regenerateInvite()` resets token and extends expiry by 7 days
- Indexes: `courseId + name` (compound), unique index on `inviteToken`

### GroupMember
- groupId: ObjectId (ref: `Group`, required, indexed)
- userId: ObjectId (ref: `User`, required, indexed)
- role: `owner` | `member` (default `member`)
- joinedAt: Date (default now)
- Unique compound index on `{ groupId, userId }` prevents duplicate memberships

When a group is created, an owner membership is created automatically.

## Routes
- GET /courses/:courseId — Course detail with tabs (Overview | Study Groups). Requires login.
- GET /groups/new?course=:courseId — New group form. Requires login.
- POST /groups — Create group. Requires login.
- GET /groups/:id — Group detail. Requires login.
- POST /groups/:id/join — Join a public group. Requires login.
- POST /groups/:id/leave — Leave a group. Owner cannot leave while other members exist. If owner is the only member, the group is deleted. Requires login.
- POST /groups/:id/kick/:userId — Remove a member (owner-only). Requires login.
- POST /groups/:id/invite/regenerate — Regenerate invite link (owner-only). Requires login.
- GET /g/:token — Resolve invite. Redirects unauthenticated users to login and continues after login. Enforces 7-day expiry and capacity.
- GET /me/groups — "My Groups" list. Requires login.

## Behavior
- Visibility: Private groups are only discoverable by their members or via invite link; explicit joins are allowed for public groups only.
- Invite expiry: Joining via expired invite is blocked with a clear error; owners can regenerate a fresh invite.
- Capacity: Enforced at join/invite; default 25, range 2–100.
- Idempotent joins: Duplicate membership is prevented by a unique index.
- Owner actions: Remove members, see/copy invite link with visible expiry, regenerate link.

## UI
- Courses list cards now link to a Course detail page ("View Course").
- Course detail has tabs: Overview and Study Groups. The Groups tab lists groups with name, member count, and visibility, plus a button to create a group.
- Group detail shows invite (owner only), members with roles and Kick buttons (owner only), and Join/Leave actions.
- "My Groups" shows all memberships grouped by course.

## 🔧 API Documentation

### Authentication Endpoints
- `GET /login` - User login form
- `POST /login` - Authenticate user (rate limited)
- `GET /register` - User registration form
- `POST /register` - Create new account (rate limited)
- `POST /logout` - Destroy user session

### Course Management
- `GET /courses` - List all courses (authenticated)
- `GET /courses/add` - Course creation form (authenticated)
- `POST /courses/add` - Create new course (authenticated)
- `GET /courses/:id` - View course details with study groups

### Study Group Management
- `GET /groups/new?course=:id` - Create group form (authenticated)
- `POST /groups` - Create new study group (authenticated)
- `GET /groups/:id` - View group details (authenticated)
- `POST /groups/:id/join` - Join public group (authenticated)
- `POST /groups/:id/leave` - Leave group (authenticated)
- `GET /g/:token` - Join via invite link
- `GET /me/groups` - User's groups dashboard (authenticated)

### System Endpoints
- `GET /health` - Health check endpoint (monitoring)
- `GET /metrics` - Performance metrics (development only)

## 🐛 Troubleshooting Guide

### Common Issues

**Database Connection Issues:**
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check connection string
mongosh "mongodb://127.0.0.1:27017/conect-ed"

# View application logs for connection errors
npm run dev 2>&1 | grep -i mongodb
```

**Session Issues:**
```bash
# Clear session cookies in browser
# Or restart Redis if using Redis store
redis-cli FLUSHALL
```

**File Upload Problems:**
```bash
# Check upload directory permissions
ls -la public/uploads/

# Verify file size limits in config
cat config.js | grep MAX_FILE_SIZE
```

**Performance Issues:**
```bash
# Check memory usage
node --expose-gc node_modules/.bin/clinic doctor -- npm start

# Monitor database performance
npm run dev 2>&1 | grep -i "slow query\|timeout"
```

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=connect-ed:* npm run dev
```

### Production Deployment Issues

**Environment Variables:**
```bash
# Verify all required environment variables are set
node -e "require('dotenv').config(); console.log(process.env.SESSION_SECRET ? 'Session secret: OK' : 'Session secret: MISSING')"

# Check database connectivity
node -e "require('./db').connectDB().then(() => console.log('DB: OK')).catch(console.error)"
```

**Docker Issues:**
```bash
# Check container logs
docker-compose logs -f app

# Verify environment file is copied
docker-compose exec app cat .env

# Check MongoDB container connectivity
docker-compose exec mongodb mongo --eval "db.stats()"
```

## 📈 Monitoring & Health Checks

The application includes built-in monitoring:

- **Health Check**: `GET /health` - Returns system status and metrics
- **Performance Metrics**: `GET /metrics` - Detailed performance statistics (dev only)
- **Database Status**: Connection pool and query performance metrics
- **Cache Statistics**: Hit rates and memory usage for caching layer

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: [API Documentation](API_DOCUMENTATION.md)
- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)

## 🔄 Updates & Changes

### Recent Improvements
- ✅ Enhanced security with comprehensive input validation
- ✅ Improved database connection handling with retry logic
- ✅ Advanced caching system with Redis/MongoDB support
- ✅ Performance monitoring and health check endpoints
- ✅ Docker containerization support
- ✅ Comprehensive error handling and logging
- ✅ Rate limiting and DDoS protection
- ✅ File upload security enhancements

---

**ConnectED** - Building collaborative learning communities with modern web technologies.
