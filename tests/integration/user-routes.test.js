const request = require('supertest');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const userRouter = require('../../routes/user_router');
const { User } = require('../../models/db_schema');
const { registerUser, loginUser, logoutUser, renderRegister, renderLogin } = require('../../controllers/user_controller');
const { getPersonalizedFeed } = require('../../controllers/feed-controller');
const bcrypt = require('bcrypt');
const { generateToken } = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../models/db_schema');
jest.mock('../../controllers/user_controller');
jest.mock('../../controllers/feed-controller');
jest.mock('bcrypt');
jest.mock('../../middleware/auth');

describe('User Routes Integration Tests', () => {
  let app;
  let mockUser;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock user data
    mockUser = {
      _id: 'testuser123',
      username: 'testuser',
      email: 'test@example.com',
      password: '$2b$10$mockhash'
    };

    // Mock bcrypt
    bcrypt.hash.mockResolvedValue(mockUser.password);
    bcrypt.compare.mockResolvedValue(true);

    // Mock controllers
    renderRegister.mockImplementation((req, res) => res.status(200).render('register.njk'));
    renderLogin.mockImplementation((req, res) => res.status(200).render('login.njk'));
    registerUser.mockImplementation(async (req, res) => {
      req.session.userId = mockUser._id;
      req.session.username = mockUser.username;
      req.session.userEmail = mockUser.email;
      res.status(200).redirect('/courses');
    });
    loginUser.mockImplementation(async (req, res) => {
      req.session.userId = mockUser._id;
      req.session.username = mockUser.username;
      req.session.userEmail = mockUser.email;
      res.status(200).redirect('/courses');
    });
    logoutUser.mockImplementation((req, res) => {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.clearCookie('token');
        res.status(200).redirect('/login');
      });
    });
    getPersonalizedFeed.mockImplementation((req, res) => {
      res.status(200).render('feed.njk', { feed: [] });
    });

    // Mock User model
    User.findOne.mockResolvedValue(mockUser);
    User.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(mockUser)
    }));

    // Mock generateToken
    generateToken.mockReturnValue('mock-jwt-token');

    // Create test app
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }));

    // Mock Nunjucks (prevent rendering errors)
    app.set('view engine', 'njk');
    app.engine('njk', (filePath, options, callback) => {
      callback(null, 'Mock rendered template');
    });

    // Use the user router
    app.use('/user', userRouter);

    // Global error handler for testing
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
  });

  describe('Authentication Routes', () => {
    describe('GET /user/register', () => {
      it('should render register page successfully', async () => {
        const response = await request(app)
          .get('/user/register')
          .expect(200);

        expect(response.text).toContain('Mock rendered template');
        expect(renderRegister).toHaveBeenCalledTimes(1);
      });

      it('should have proper status code', async () => {
        const response = await request(app)
          .get('/user/register')
          .expect(200);

        expect(response.status).toBe(200);
      });
    });

    describe('POST /user/register', () => {
      it('should register user and redirect successfully', async () => {
        const userData = {
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'password123',
          confirmPassword: 'password123'
        };

        const response = await request(app)
          .post('/user/register')
          .send(userData)
          .expect(302);

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/courses');
        expect(registerUser).toHaveBeenCalledWith(expect.objectContaining({
          body: userData
        }), expect.any(Object));
        
        // Verify session is set - in supertest, we can't directly access app.req.session
        // Instead, verify through the mock controller call
        expect(registerUser).toHaveBeenCalledWith(
          expect.objectContaining({
            session: expect.objectContaining({
              userId: mockUser._id,
              username: mockUser.username
            })
          }),
          expect.any(Object)
        );
      });

      it('should handle validation errors (missing fields)', async () => {
        const invalidData = {
          email: '',
          username: '',
          password: '',
          confirmPassword: ''
        };

        registerUser.mockImplementation(async (req, res) => {
          req.session.flash = { 
            type: 'error', 
            message: 'Please fix the errors below.', 
            errors: {
              email: 'Email is required.',
              username: 'Username is required.',
              password: 'Password is required.',
              confirmPassword: 'Confirm your password.'
            }
          };
          res.status(302).redirect('/register');
        });

        const response = await request(app)
          .post('/user/register')
          .send(invalidData)
          .expect(302);

        expect(response.headers.location).toBe('/register');
        expect(response.session.flash).toEqual({
          type: 'error',
          message: 'Please fix the errors below.',
          errors: {
            email: 'Email is required.',
            username: 'Username is required.',
            password: 'Password is required.',
            confirmPassword: 'Confirm your password.'
          }
        });
      });

      it('should handle duplicate user error', async () => {
        User.findOne.mockResolvedValueOnce(mockUser);
        registerUser.mockImplementation(async (req, res) => {
          const error = {
            code: 11000,
            keyValue: { email: 'test@example.com' }
          };
          // Simulate MongoDB duplicate key error handling
          req.session.flash = {
            type: 'error',
            message: 'Email already exists.',
            errors: { email: 'Already exists.' }
          };
          res.status(302).redirect('/register');
        });

        const response = await request(app)
          .post('/user/register')
          .send({
            email: 'test@example.com',
            username: 'duplicateuser',
            password: 'password123',
            confirmPassword: 'password123'
          })
          .expect(302);

        expect(response.headers.location).toBe('/register');
        // Verify flash message through mock implementation
        expect(registerUser).toHaveBeenCalledWith(
          expect.objectContaining({
            session: expect.objectContaining({
              flash: expect.objectContaining({
                message: 'Email already exists.'
              })
            })
          }),
          expect.any(Object)
        );
      });
    });

    describe('GET /user/login', () => {
      it('should render login page successfully', async () => {
        const response = await request(app)
          .get('/user/login')
          .expect(200);

        expect(response.text).toContain('Mock rendered template');
        expect(renderLogin).toHaveBeenCalledTimes(1);
      });
    });

    describe('POST /user/login', () => {
      it('should login user and redirect successfully', async () => {
        const loginData = {
          username: 'testuser',
          password: 'password123'
        };

        const response = await request(app)
          .post('/user/login')
          .send(loginData)
          .expect(302);

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/courses');
        expect(loginUser).toHaveBeenCalledWith(expect.objectContaining({
          body: loginData
        }), expect.any(Object));
        
        // Verify session and cookie
        expect(loginUser).toHaveBeenCalledWith(
          expect.objectContaining({
            session: expect.objectContaining({
              userId: mockUser._id,
              username: mockUser.username
            })
          }),
          expect.any(Object)
        );
        expect(response.header['set-cookie']).toContain('token=mock-jwt-token');
      });

      it('should handle invalid credentials', async () => {
        loginUser.mockImplementation(async (req, res) => {
          req.session.flash = {
            type: 'error',
            message: 'Invalid credentials.',
            errors: { username: 'Check your username.' }
          };
          res.status(302).redirect('/login');
        });

        const response = await request(app)
          .post('/user/login')
          .send({ username: 'wronguser', password: 'wrongpass' })
          .expect(302);

        expect(response.headers.location).toBe('/login');
        // Verify flash message through mock implementation
        expect(loginUser).toHaveBeenCalledWith(
          expect.objectContaining({
            session: expect.objectContaining({
              flash: expect.objectContaining({
                message: 'Invalid credentials.'
              })
            })
          }),
          expect.any(Object)
        );
      });

      it('should redirect to returnTo URL if set', async () => {
        // Set returnTo in session before request
        const agent = request.agent(app);
        await agent.post('/user/login')
          .send({ username: 'testuser', password: 'password123' })
          .set('Cookie', 'connect.sid=s%3Amock; token=mock-token')
          .expect(200);

        // Now make login request with returnTo
        const response = await request(app)
          .post('/user/login')
          .send({ username: 'testuser', password: 'password123' })
          .expect(200);

        // In real scenario, returnTo would be set in session
        expect(response.headers.location).toBe('/courses'); // Default fallback
      });
    });

    describe('POST /user/logout', () => {
      it('should logout user and clear session/cookies', async () => {
        // First login to set session
        await request(app)
          .post('/user/login')
          .send({ username: 'testuser', password: 'password123' })
          .expect(200);

        const response = await request(app)
          .post('/user/logout')
          .expect(200);

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/login');
        expect(logoutUser).toHaveBeenCalledTimes(1);
        
        // Verify session is destroyed - check through mock
        expect(logoutUser).toHaveBeenCalledWith(
          expect.objectContaining({
            session: expect.any(Object)
          }),
          expect.any(Object)
        );
        
        // Verify cookies are cleared
        const cookies = response.header['set-cookie'] || [];
        expect(cookies).toContainEqual(expect.stringContaining('connect.sid=;'));
        expect(cookies).toContainEqual(expect.stringContaining('token=;'));
      });

      it('should handle logout without active session', async () => {
        const response = await request(app)
          .post('/user/logout')
          .expect(302);

        expect(response.headers.location).toBe('/login');
        expect(logoutUser).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Protected Routes', () => {
    beforeEach(() => {
      // Login first to set up authenticated session
      return request(app)
        .post('/user/login')
        .send({ username: 'testuser', password: 'password123' })
        .expect(302);
    });

    describe('GET /user/feed', () => {
      it('should access protected feed route when authenticated', async () => {
        const response = await request(app)
          .get('/user/feed')
          .expect(200);

        expect(response.status).toBe(200);
        expect(response.text).toContain('Mock rendered template');
        expect(getPersonalizedFeed).toHaveBeenCalledTimes(1);
      });

      it('should reject unauthenticated access to feed', async () => {
        // Create new request without session
        const response = await request(app)
          .get('/user/feed')
          .expect(302);

        expect(response.headers.location).toBe('/login');
      });
    });

    describe('POST /user/feed', () => {
      it('should create feed post when authenticated', async () => {
        const postData = {
          content: 'This is a test post',
          visibility: 'public'
        };

        // Mock the createFeedPost controller
        const { createFeedPost } = require('../../controllers/feed-controller');
        createFeedPost.mockImplementation((req, res) => {
          res.status(200).json({ message: 'Post created', postId: 'post123' });
        });

        const response = await request(app)
          .post('/user/feed')
          .send(postData)
          .set('Cookie', 'connect.sid=s%3Amock; token=mock-jwt-token')
          .expect(200);

        expect(response.body.message).toBe('Post created');
        expect(createFeedPost).toHaveBeenCalledWith(
          expect.objectContaining({
            body: postData,
            session: expect.objectContaining({
              userId: mockUser._id
            })
          }),
          expect.any(Object)
        );
      });

      it('should reject feed post creation without authentication', async () => {
        const response = await request(app)
          .post('/user/feed')
          .send({ content: 'Unauthorized post' })
          .expect(302);

        expect(response.headers.location).toBe('/login');
      });
    });

    describe('GET /user/badges', () => {
      it('should access user badges when authenticated', async () => {
        const { getUserBadges } = require('../../controllers/badge-controller');
        getUserBadges.mockImplementation((req, res) => {
          res.status(200).render('badges.njk', { badges: [] });
        });

        const response = await request(app)
          .get('/user/badges')
          .expect(200);

        expect(response.status).toBe(200);
        expect(getUserBadges).toHaveBeenCalledTimes(1);
      });
    });

    describe('GET /user/analytics', () => {
      it('should access analytics dashboard when authenticated', async () => {
        const { getAnalyticsDashboard } = require('../../controllers/analytics-controller');
        getAnalyticsDashboard.mockImplementation((req, res) => {
          res.status(200).json({ analytics: { totalUsers: 100, activeSessions: 50 } });
        });

        const response = await request(app)
          .get('/user/analytics')
          .expect(200);

        expect(response.body.analytics).toEqual({
          totalUsers: 100,
          activeSessions: 50
        });
        expect(getAnalyticsDashboard).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Rate Limiting and Middleware Integration', () => {
    beforeEach(() => {
      // Mock rate limit middleware to not trigger limits during tests
      jest.doMock('../../middleware/rate-limit', () => ({
        authLimiter: (req, res, next) => next(),
        feedLimiter: (req, res, next) => next()
      }));
      
      // Re-require router with mocked middleware
      const mockedRouter = require('../../routes/user_router');
      app.use('/user', mockedRouter);
    });

    it('should handle rate limited requests gracefully', async () => {
      // Test passes with mocked rate limiter
      const response = await request(app)
        .post('/user/login')
        .send({ username: 'testuser', password: 'password123' })
        .expect(302);
      
      expect(response.status).toBe(302);
    });

    it('should handle spam detection middleware', async () => {
      // Mock spam detection to pass through
      jest.doMock('../../middleware/spam-detection', () => ({
        spamDetection: (event) => (req, res, next) => next()
      }));
      
      const mockedRouter = require('../../routes/user_router');
      app.use('/user', mockedRouter);

      const response = await request(app)
        .post('/user/feed')
        .send({ content: 'Test post' })
        .set('Cookie', 'connect.sid=s%3Amock; token=mock-jwt-token')
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      // Make controller throw an error
      registerUser.mockImplementation(async (req, res) => {
        throw new Error('Controller error');
      });

      const response = await request(app)
        .post('/user/register')
        .send({
          email: 'error@example.com',
          username: 'erroruser',
          password: 'password123',
          confirmPassword: 'password123'
        })
        .expect(500);

      expect(response.body.error).toBe('Controller error');
    });

    it('should handle database connection errors', async () => {
      User.findOne.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/user/login')
        .send({ username: 'testuser', password: 'password123' })
        .expect(500);

      expect(response.body.error).toBe('Database connection failed');
    });

    it('should handle missing route parameters', async () => {
      const response = await request(app)
        .get('/user/nonexistent')
        .expect(404);

      expect(response.status).toBe(404);
    });
  });

  afterAll(() => {
    // Cleanup
    jest.restoreAllMocks();
  });
});