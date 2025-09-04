# connectED (Phase 1)

Express + Nunjucks + MongoDB app modernized with Tailwind CSS, cookie sessions, and "Courses" model.

## Prerequisites
- Node.js 20+
- MongoDB running locally (or a connection string)

## Environment variables
Create a `.env` or export these in your shell:
- MONGODB_URI: Mongo connection string (e.g. mongodb://127.0.0.1:27017/conect-ed)
- SESSION_SECRET: Any random string for session signing
- PORT: Optional (defaults to 3000)

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
- Sessions via express-session + connect-mongo (cookie: httpOnly, sameSite=lax, secure=false in dev)
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
