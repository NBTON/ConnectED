const { Course, UserActivity, Analytics } = require("../models/db_schema")
const multer = require("multer")
const CourseMatcher = require("../utils/matching")

const RECORDS_PER_PAGE = 6

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/courses"),
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}_${file.originalname}`
    cb(null, fileName)
  },
})

const multerStorage = multer({ storage })

const addCoursePostAction = async (req, res) => {
  try {
    const payload = { ...req.body }
    if (req.file?.filename) payload.image = req.file.filename
    const newCourse = new Course(payload)
    await newCourse.save()
    req.session.flash = { type: "success", message: "Course created." }
    res.redirect("/courses")
  } catch (error) {
    console.log("Course Added Failure!", error)
    req.session.flash = { type: "error", message: "Failed to create course." }
    res.redirect("/courses/add")
  }
}

const renderCourseListing = async (req, res) => {
  let currentPage = parseInt(req.query?.page ?? "1", 10)
  if (Number.isNaN(currentPage) || currentPage < 1) currentPage = 1

  const text = req.query.search
  let searchQuery = {}
  if (text && text.trim().length > 0) {
    const regex = new RegExp(text.trim(), "i")
    searchQuery = {
      $or: [
        { title: { $regex: regex } },
        { linktoTheCall: { $regex: regex } },
      ],
    }
  }

  const totalCount = await Course.countDocuments(searchQuery)
  const totalPages = Math.max(1, Math.ceil(totalCount / RECORDS_PER_PAGE))
  if (currentPage > totalPages) currentPage = totalPages

  const skipOffset = (currentPage - 1) * RECORDS_PER_PAGE
  const courses = await Course.find(searchQuery)
    .skip(skipOffset)
    .limit(RECORDS_PER_PAGE)
    .lean()

  res.render("course-list.njk", { courses, totalPages, currentPage, text })
}

const renderAddCourse = (req, res) => {
  res.render("add-course.njk")
}

const renderMain = (req, res) => {
  res.render("main.njk")
}

const renderAbout = (req, res) => {
  res.render("about.njk")
}

// AI-Powered Course Matching
const getCourseMatches = async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const limit = parseInt(req.query.limit) || 10;
    const recommendations = await CourseMatcher.getRecommendations(userId, limit);

    // Track analytics
    await Analytics.create({
      userId,
      action: "course_match_request",
      resourceType: "course",
      metadata: { limit, resultsCount: recommendations.length }
    });

    res.json({ recommendations });
  } catch (error) {
    console.error("Course matching error:", error);
    res.status(500).json({ error: "Failed to get course recommendations" });
  }
}

const getUserMatches = async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const limit = parseInt(req.query.limit) || 10;
    const recommendations = await CourseMatcher.getUserRecommendations(userId, limit);

    // Track analytics
    await Analytics.create({
      userId,
      action: "user_match_request",
      resourceType: "user",
      metadata: { limit, resultsCount: recommendations.length }
    });

    res.json({ recommendations });
  } catch (error) {
    console.error("User matching error:", error);
    res.status(500).json({ error: "Failed to get user recommendations" });
  }
}

// Track user activity for better recommendations
const trackCourseActivity = async (req, res, next) => {
  try {
    const userId = req.session?.userId;
    const courseId = req.params.id || req.body.courseId;

    if (userId && courseId) {
      const action = req.method === 'GET' ? 'view_course' : 'interact_course';

      await UserActivity.findOneAndUpdate(
        { userId, resourceType: 'course', resourceId: courseId },
        {
          userId,
          action,
          resourceType: 'course',
          resourceId: courseId,
          weight: action === 'view_course' ? 1 : 2
        },
        { upsert: true, new: true }
      );

      // Track analytics
      await Analytics.create({
        userId,
        action,
        resourceType: 'course',
        resourceId: courseId
      });
    }
  } catch (error) {
    console.error("Activity tracking error:", error);
  }
  next();
}

module.exports = {
  renderCourseListing,
  renderAddCourse,
  renderMain,
  renderAbout,
  addCoursePostAction,
  multerStorage,
  getCourseMatches,
  getUserMatches,
  trackCourseActivity,
}
