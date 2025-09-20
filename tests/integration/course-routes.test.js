const request = require('supertest');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const courseRouter = require('../../routes/course-router');
const { Course } = require('../../models/db_schema');
// Controller functions are now mocked in setup.js
const CourseMatcher = require('../../utils/matching');
const { requireAuth } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rate-limit');
const {
  renderCourseListing,
  renderAddCourse,
  addCoursePostAction,
  getCourseMatches,
  getUserMatches,
  trackCourseActivity,
  renderMain,
  renderAbout
} = require('../../controllers/course-controller');

// Mock dependencies
jest.mock('../../models/db_schema');
jest.mock('../../utils/matching');
jest.mock('../../middleware/auth');
jest.mock('../../middleware/rate-limit', () => ({
  apiLimiter: (req, res, next) => next(), // Mock rate limiter to bypass during tests
  authLimiter: (req, res, next) => next(),
  feedLimiter: (req, res, next) => next(),
  courseLimiter: (req, res, next) => next()
}));

describe('Course Routes Integration Tests', () => {
  let app;
  let mockUser;
  let mockSession;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock user data
    mockUser = {
      _id: 'testuser456',
      username: 'courseuser',
      email: 'course@example.com',
      session: { userId: 'testuser456' }
    };

    // Mock session
    mockSession = {
      userId: mockUser._id,
      username: mockUser.username,
      userEmail: mockUser.email
    };

    // Controllers are now mocked in setup.js

    // Mock requireAuth to allow requests in tests
    requireAuth.mockImplementation((req, res, next) => {
      req.session = mockSession;
      next();
    });

    // Mock Course model
    Course.find.mockResolvedValue([{ _id: 'course1', title: 'Test Course', description: 'Test' }]);
    Course.countDocuments.mockResolvedValue(1);
    Course.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ _id: 'newcourse1', title: 'New Course' })
    }));

    // Mock CourseMatcher
    CourseMatcher.getRecommendations.mockResolvedValue([
      { _id: 'course1', title: 'Recommended Course', matchScore: 0.85 }
    ]);
    CourseMatcher.getUserRecommendations.mockResolvedValue([
      { _id: 'user1', username: 'matcheduser', matchScore: 0.78 }
    ]);


    // Create test app
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(cookieParser());
    app.use(session({
      secret: 'course-test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }));

    // Mock Nunjucks
    app.set('view engine', 'njk');
    app.engine('njk', (filePath, options, callback) => {
      const templateName = filePath.split('\\').pop().split('/').pop();
      callback(null, `Mock rendered: ${templateName}`);
    });

    // Use the course router
    app.use('/', courseRouter);

    // Global error handler
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
  });

  describe('Public Routes', () => {
    describe('GET /', () => {
      it('should render main page successfully', async () => {
        const response = await request(app)
          .get('/')
          .expect(200);

        expect(response.text).toContain('Mock rendered: main.njk');
        expect(renderMain).toHaveBeenCalledTimes(1);
      });
    });

    describe('GET /about', () => {
      it('should render about page successfully', async () => {
        const response = await request(app)
          .get('/about')
          .expect(200);

        expect(response.text).toContain('Mock rendered: about.njk');
        expect(renderAbout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Protected Course Routes', () => {
    describe('GET /courses', () => {
      it('should render course listing when authenticated', async () => {
        const response = await request(app)
          .get('/courses')
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(200);

        expect(response.text).toContain('Mock rendered: course-list.njk');
        expect(renderCourseListing).toHaveBeenCalledTimes(1);
        expect(trackCourseActivity).toHaveBeenCalledTimes(1);
        expect(Course.find).toHaveBeenCalled();
        expect(Course.countDocuments).toHaveBeenCalled();
      });

      it('should redirect to login when not authenticated', async () => {
        requireAuth.mockImplementationOnce((req, res, next) => {
          res.status(302).redirect('/login');
        });

        const response = await request(app)
          .get('/courses')
          .expect(302);

        expect(response.headers.location).toBe('/login');
        expect(requireAuth).toHaveBeenCalledTimes(1);
      });

      it('should handle search query parameter', async () => {
        const response = await request(app)
          .get('/courses')
          .query({ search: 'math', page: '1' })
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(200);

        expect(renderCourseListing).toHaveBeenCalledWith(
          expect.objectContaining({
            query: expect.objectContaining({
              search: 'math',
              page: '1'
            })
          }),
          expect.any(Object)
        );
      });

      it('should track course activity for authenticated users', async () => {
        const response = await request(app)
          .get('/courses')
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(200);

        expect(trackCourseActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            session: expect.objectContaining({
              userId: mockUser._id
            }),
            method: 'GET'
          }),
          expect.any(Object),
          expect.any(Function)
        );
      });
    });

    describe('GET /courses/add', () => {
      it('should render add course form when authenticated', async () => {
        const response = await request(app)
          .get('/courses/add')
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(200);

        expect(response.text).toContain('Mock rendered: add-course.njk');
        expect(renderAddCourse).toHaveBeenCalledTimes(1);
      });

      it('should redirect to login when not authenticated', async () => {
        requireAuth.mockImplementationOnce((req, res, next) => {
          res.status(302).redirect('/login');
        });

        const response = await request(app)
          .get('/courses/add')
          .expect(302);

        expect(response.headers.location).toBe('/login');
      });
    });

    describe('POST /courses/add', () => {
      it('should create course with file upload when authenticated', async () => {
        const courseData = {
          title: 'New Test Course',
          description: 'Course description',
          difficulty: 'intermediate',
          category: 'technology'
        };

        const response = await request(app)
          .post('/courses/add')
          .field('title', courseData.title)
          .field('description', courseData.description)
          .field('difficulty', courseData.difficulty)
          .field('category', courseData.category)
          .attach('image', 'test/fixtures/test-image.jpg', 'test-image.jpg')
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(302);

        expect(response.headers.location).toBe('/courses');
        expect(addCoursePostAction).toHaveBeenCalledWith(
          expect.objectContaining({
            body: courseData,
            file: { filename: 'test-image.jpg', fieldname: 'image' },
            session: expect.objectContaining({
              userId: mockUser._id
            })
          }),
          expect.any(Object)
        );
        expect(response.session.flash).toEqual({
          type: 'success',
          message: 'Course created.'
        });
      });

      it('should create course without file upload', async () => {
        const courseData = {
          title: 'Course Without Image',
          description: 'No image attached'
        };

        const response = await request(app)
          .post('/courses/add')
          .field('title', courseData.title)
          .field('description', courseData.description)
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(302);

        expect(response.headers.location).toBe('/courses');
        expect(addCoursePostAction).toHaveBeenCalledWith(
          expect.objectContaining({
            body: courseData,
            file: undefined,
            session: expect.objectContaining({
              userId: mockUser._id
            })
          }),
          expect.any(Object)
        );
      });

      it('should handle course creation errors', async () => {
        addCoursePostAction.mockImplementation(async (req, res) => {
          req.session.flash = { type: 'error', message: 'Failed to create course.' };
          res.status(302).redirect('/courses/add');
        });

        const response = await request(app)
          .post('/courses/add')
          .field('title', 'Error Course')
          .field('description', 'Error description')
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(302);

        expect(response.headers.location).toBe('/courses/add');
        expect(response.session.flash).toEqual({
          type: 'error',
          message: 'Failed to create course.'
        });
      });

      it('should reject unauthenticated course creation', async () => {
        requireAuth.mockImplementationOnce((req, res, next) => {
          res.status(302).redirect('/login');
        });

        const response = await request(app)
          .post('/courses/add')
          .field('title', 'Unauthorized Course')
          .field('description', 'Unauthorized')
          .expect(302);

        expect(response.headers.location).toBe('/login');
      });

      it('should handle multer file upload errors', async () => {
        const mockMulterError = new Error('File upload failed');

        // Mock multer to throw an error
        const multerMock = require('multer');
        multerMock.diskStorage.mockReturnValueOnce({
          single: jest.fn().mockImplementation((field) => (req, res, next) => {
            next(mockMulterError);
          })
        });

        const response = await request(app)
          .post('/courses/add')
          .field('title', 'Multer Error Course')
          .attach('image', 'test/fixtures/invalid.jpg')
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(500);

        expect(response.body.error).toBe('File upload failed');
      });
    });
  });

  describe('AI Matching API Routes', () => {
    describe('GET /api/match/courses', () => {
      it('should return course recommendations when authenticated', async () => {
        const response = await request(app)
          .get('/api/match/courses')
          .query({ limit: '3' })
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(200);

        expect(response.body.recommendations).toEqual([
          { _id: 'course1', title: 'Recommended Course', matchScore: 0.85 }
        ]);
        expect(response.body.recommendations.length).toBe(1);
        expect(getCourseMatches).toHaveBeenCalledWith(
          expect.objectContaining({
            session: expect.objectContaining({
              userId: mockUser._id
            }),
            query: { limit: '3' }
          }),
          expect.any(Object)
        );
        expect(CourseMatcher.getRecommendations).toHaveBeenCalledWith(mockUser._id, 3);
      });

      it('should use default limit when not specified', async () => {
        const response = await request(app)
          .get('/api/match/courses')
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(200);

        expect(CourseMatcher.getRecommendations).toHaveBeenCalledWith(mockUser._id, 10);
      });

      it('should return 401 when not authenticated', async () => {
        requireAuth.mockImplementationOnce((req, res, next) => {
          res.status(401).json({ error: 'Authentication required' });
        });

        const response = await request(app)
          .get('/api/match/courses')
          .expect(401);

        expect(response.body.error).toBe('Authentication required');
      });

      it('should handle matching errors', async () => {
        CourseMatcher.getRecommendations.mockRejectedValueOnce(new Error('Matching service unavailable'));

        const response = await request(app)
          .get('/api/match/courses')
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(500);

        expect(response.body.error).toBe('Matching service unavailable');
      });
    });

    describe('GET /api/match/users', () => {
      it('should return user recommendations when authenticated', async () => {
        const response = await request(app)
          .get('/api/match/users')
          .query({ limit: '5' })
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(200);

        expect(response.body.recommendations).toEqual([
          { _id: 'user1', username: 'matcheduser', matchScore: 0.78 }
        ]);
        expect(getUserMatches).toHaveBeenCalledWith(
          expect.objectContaining({
            session: expect.objectContaining({
              userId: mockUser._id
            }),
            query: { limit: '5' }
          }),
          expect.any(Object)
        );
        expect(CourseMatcher.getUserRecommendations).toHaveBeenCalledWith(mockUser._id, 5);
      });

      it('should return 401 when not authenticated', async () => {
        requireAuth.mockImplementationOnce((req, res, next) => {
          res.status(401).json({ error: 'Authentication required' });
        });

        const response = await request(app)
          .get('/api/match/users')
          .expect(401);

        expect(response.body.error).toBe('Authentication required');
      });

      it('should handle user matching errors', async () => {
        CourseMatcher.getUserRecommendations.mockRejectedValueOnce(new Error('User matching failed'));

        const response = await request(app)
          .get('/api/match/users')
          .set('Cookie', 'connect.sid=s%3Amocksession')
          .expect(500);

        expect(response.body.error).toBe('User matching failed');
      });
    });
  });

  describe('Pagination and Search Integration', () => {
    it('should handle course listing with pagination', async () => {
      const response = await request(app)
        .get('/courses')
        .query({ page: '2' })
        .set('Cookie', 'connect.sid=s%3Amocksession')
        .expect(200);

      expect(renderCourseListing).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            page: '2'
          })
        }),
        expect.any(Object)
      );
    });

    it('should handle invalid page parameter', async () => {
      const response = await request(app)
        .get('/courses')
        .query({ page: 'invalid' })
        .set('Cookie', 'connect.sid=s%3Amocksession')
        .expect(200);

      // Controller should handle invalid page and default to 1
      expect(renderCourseListing).toHaveBeenCalledTimes(1);
    });

    it('should handle course search functionality', async () => {
      const response = await request(app)
        .get('/courses')
        .query({ search: 'advanced programming' })
        .set('Cookie', 'connect.sid=s%3Amocksession')
        .expect(200);

      expect(Course.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({
              title: expect.objectContaining({ $regex: expect.any(RegExp) })
            })
          ])
        })
      );
    });
  });

  describe('Middleware Integration', () => {
    it('should properly chain authentication and activity tracking middleware', async () => {
      // Reset requireAuth to test actual flow
      requireAuth.mockImplementation((req, res, next) => {
        req.session = mockSession;
        next();
      });

      const response = await request(app)
        .get('/courses')
        .set('Cookie', 'connect.sid=s%3Amocksession')
        .expect(200);

      // Verify middleware chain: requireAuth -> trackCourseActivity -> renderCourseListing
      expect(requireAuth).toHaveBeenCalledTimes(1);
      expect(trackCourseActivity).toHaveBeenCalledTimes(1);
      expect(renderCourseListing).toHaveBeenCalledTimes(1);
    });

    it('should handle authentication failure in middleware chain', async () => {
      requireAuth.mockImplementationOnce((req, res, next) => {
        res.status(302).redirect('/login');
      });

      const response = await request(app)
        .get('/courses')
        .expect(302);

      expect(trackCourseActivity).not.toHaveBeenCalled();
      expect(renderCourseListing).not.toHaveBeenCalled();
    });

    it('should handle activity tracking errors gracefully', async () => {
      trackCourseActivity.mockImplementationOnce((req, res, next) => {
        next(new Error('Activity tracking failed'));
      });

      const response = await request(app)
        .get('/courses')
        .set('Cookie', 'connect.sid=s%3Amocksession')
        .expect(500);

      expect(response.body.error).toBe('Activity tracking failed');
      expect(renderCourseListing).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database query errors in course listing', async () => {
      Course.find.mockRejectedValueOnce(new Error('Database query failed'));

      const response = await request(app)
        .get('/courses')
        .set('Cookie', 'connect.sid=s%3Amocksession')
        .expect(500);

      expect(response.body.error).toBe('Database query failed');
    });

    it('should handle course save errors', async () => {
      Course.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValue(new Error('Save failed'))
      }));

      addCoursePostAction.mockImplementation(async (req, res) => {
        throw new Error('Course save error');
      });

      const response = await request(app)
        .post('/courses/add')
        .field('title', 'Error Course')
        .field('description', 'Error description')
        .set('Cookie', 'connect.sid=s%3Amocksession')
        .expect(500);

      expect(response.body.error).toBe('Course save error');
    });

    it('should handle missing route parameters', async () => {
      const response = await request(app)
        .get('/courses/invalid')
        .set('Cookie', 'connect.sid=s%3Amocksession')
        .expect(404);

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .get('/api/match/courses')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .set('Cookie', 'connect.sid=s%3Amocksession')
        .expect(400);

      // Express should handle JSON parsing errors
      expect(response.status).toBe(400);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});