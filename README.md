# connectED (Phase 1)

Express + Nunjucks + MongoDB app modernized with Tailwind CSS, cookie sessions, and "Courses" model.

## Prerequisites
- Node.js 20+
- MongoDB running locally (or a connection string)

## Environment variables
Create a `.env` or export these in your shell:
- MONGODB_URI: Mongo connection string (e.g. mongodb://127.0.0.1:27017/conect-ed)
- SESSION_SECRET: Any random string for session signing (use a long, random value in prod)
- PORT: Optional (defaults to 3000)
- CORS_ORIGIN: Allowed origin for CORS (defaults to `*`)
- STATIC_MAX_AGE: Static assets cache max-age (e.g. `7d`)

## Install
```
npm install
```

## Run (with Tailwind in watch mode)
```
npm run dev
```
This runs the server with nodemon and builds Tailwind on changes.

## Build CSS once
```
npm run build:css
```

## Scripts
- dev: nodemon server.js & npx tailwindcss -i public/styles/tailwind-input.css -o public/styles/tailwind.css --watch
- build:css: npx tailwindcss -i public/styles/tailwind-input.css -o public/styles/tailwind.css --minify

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

## Security & Hardening

- Helmet is enabled with a conservative CSP in production; CSP is disabled in development for ease of iteration.
- Basic global rate limiting and stricter `/login` rate limit protect against brute force.
- Session cookies are `httpOnly`, `sameSite=lax`, and `secure` in production.
- MongoDB connection is centralized and resilient; the server starts even if DB is unreachable, and routes handle errors gracefully.
- CORS is configurable via `CORS_ORIGIN`; by default it’s permissive. Tighten this in production.

See `.env.example` for environment setup guidance.

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

## Notes
- Default maxMembers: 25. Maximum allowed: 100.
- Sessions use `req.session.userId`; after login, redirects to any saved `returnTo` (e.g., invite links).
