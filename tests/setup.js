// Mock global dependencies
jest.mock('mongoose');
jest.mock('redis');
jest.mock('../models/db_schema', () => ({
  User: jest.fn(),
  Course: jest.fn(),
  Group: jest.fn(),
  Subject: jest.fn(),
  Badge: jest.fn()
}));

// Mock mongoose models with proper method chaining
const mockQuery = {
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  exec: jest.fn(),
  then: jest.fn()
};

const mockModel = {
  find: jest.fn(() => mockQuery),
  findOne: jest.fn(() => mockQuery),
  findById: jest.fn(() => mockQuery),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(() => mockQuery),
  findByIdAndDelete: jest.fn(() => mockQuery),
  countDocuments: jest.fn(),
  save: jest.fn()
};

// Apply mock methods to all models
const originalModule = jest.requireActual('../models/db_schema');
const mockSchema = {
  ...originalModule,
  User: Object.assign(jest.fn(() => ({ save: jest.fn() })), mockModel),
  Course: Object.assign(jest.fn(() => ({ save: jest.fn() })), mockModel),
  Group: Object.assign(jest.fn(() => ({ save: jest.fn() })), mockModel),
  Subject: Object.assign(jest.fn(() => ({ save: jest.fn() })), mockModel),
  Badge: Object.assign(jest.fn(() => ({ save: jest.fn() })), mockModel)
};

// Mock mongoose
jest.mock('mongoose', () => ({
  Schema: jest.fn(),
  model: jest.fn(),
  connect: jest.fn(),
  connection: {
    close: jest.fn()
  }
}));

// Mock external modules
jest.mock('nodemailer');
jest.mock('jsonwebtoken');
jest.mock('bcrypt');
jest.mock('passport');
jest.mock('socket.io');
jest.mock('multer', () => ({
  diskStorage: jest.fn(() => ({})),
  __esModule: true
}));

// Mock controller functions
jest.mock('../controllers/course-controller', () => ({
  renderCourseListing: jest.fn(),
  renderAddCourse: jest.fn(),
  renderMain: jest.fn(),
  addCoursePostAction: jest.fn(),
  renderAbout: jest.fn(),
  multerStorage: {
    single: jest.fn(() => (req, res, next) => next())
  },
  getCourseMatches: jest.fn(),
  getUserMatches: jest.fn(),
  trackCourseActivity: jest.fn()
}));

// Set up default mock implementations for controller functions
const courseController = require('../controllers/course-controller');
courseController.renderMain.mockImplementation((req, res) => {
  res.status(200).render('main.njk');
});
courseController.renderAbout.mockImplementation((req, res) => {
  res.status(200).render('about.njk');
});
courseController.renderAddCourse.mockImplementation((req, res) => {
  res.status(200).render('add-course.njk');
});
courseController.renderCourseListing.mockImplementation(async (req, res) => {
  res.status(200).render('course-list.njk', {
    courses: [{ _id: 'course1', title: 'Test Course' }],
    totalPages: 1,
    currentPage: 1
  });
});
courseController.addCoursePostAction.mockImplementation(async (req, res) => {
  req.session.flash = { type: 'success', message: 'Course created.' };
  res.status(302).redirect('/courses');
});
courseController.getCourseMatches.mockImplementation(async (req, res) => {
  res.status(200).json({ recommendations: [{ _id: 'rec1', title: 'Recommended Course' }] });
});
courseController.getUserMatches.mockImplementation(async (req, res) => {
  res.status(200).json({ recommendations: [{ _id: 'user1', username: 'matcheduser' }] });
});
courseController.trackCourseActivity.mockImplementation((req, res, next) => next());

// Mock session store
const mockSessionStore = {
  get: jest.fn(),
  set: jest.fn(),
  destroy: jest.fn(),
  touch: jest.fn(),
  regenerate: jest.fn()
};

// Mock session object
const mockSession = {
  id: 'test-session-id',
  cookie: {
    maxAge: 86400000,
    expires: false,
    secure: false,
    httpOnly: true,
    path: '/'
  },
  userId: 'testuser123',
  username: 'testuser',
  userEmail: 'test@example.com',
  flash: {},
  save: jest.fn((callback) => callback && callback()),
  destroy: jest.fn((callback) => callback && callback()),
  regenerate: jest.fn((callback) => callback && callback()),
  touch: jest.fn(),
  reload: jest.fn((callback) => callback && callback())
};

// Mock express-session
jest.mock('express-session', () => ({
  __esModule: true,
  default: jest.fn(() => (req, res, next) => {
    req.session = mockSession;
    req.sessionStore = mockSessionStore;
    next();
  })
}));

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Mock console.error to prevent test failures from unhandled rejections
jest.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  // Clean up any open handles
  jest.clearAllTimers();
});

afterAll(() => {
  console.error.mockRestore();
});