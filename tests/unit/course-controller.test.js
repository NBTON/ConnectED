const {
  renderCourseListing,
  renderAddCourse,
  renderMain,
  renderAbout,
  addCoursePostAction,
  getCourseMatches,
  getUserMatches,
  trackCourseActivity
} = require('../../controllers/course-controller');

const Course = require('../../models/db_schema').Course;
const Analytics = require('../../models/db_schema').Analytics;
const UserActivity = require('../../models/db_schema').UserActivity;
const CourseMatcher = require('../../utils/matching');

jest.mock('../../models/db_schema');
jest.mock('../../utils/matching');

describe('Course Controller Unit Tests', () => {
  let req, res;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    req = {
      body: {},
      query: {},
      file: null,
      session: {},
      params: {}
    };
    res = {
      render: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('renderAddCourse', () => {
    it('should render add-course template', () => {
      renderAddCourse(req, res);
      expect(res.render).toHaveBeenCalledWith('add-course.njk');
    });
  });

  describe('renderMain', () => {
    it('should render main template', () => {
      renderMain(req, res);
      expect(res.render).toHaveBeenCalledWith('main.njk');
    });
  });

  describe('renderAbout', () => {
    it('should render about template', () => {
      renderAbout(req, res);
      expect(res.render).toHaveBeenCalledWith('about.njk');
    });
  });

  describe('renderCourseListing', () => {
    beforeEach(() => {
      Course.countDocuments.mockResolvedValue(12);
      Course.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ _id: '1', title: 'Test Course' }])
      });
    });

    it('should render course list with pagination', async () => {
      req.query = { page: '1' };
      await renderCourseListing(req, res);
      expect(Course.countDocuments).toHaveBeenCalled();
      expect(Course.find).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('course-list.njk', expect.objectContaining({
        courses: expect.any(Array),
        totalPages: 2,
        currentPage: 1
      }));
    });

    it('should handle search query', async () => {
      req.query = { search: 'test' };
      await renderCourseListing(req, res);
      expect(Course.find).toHaveBeenCalledWith(expect.objectContaining({
        $or: expect.any(Array)
      }));
    });

    it('should default to page 1 if invalid page', async () => {
      req.query = { page: 'abc' };
      await renderCourseListing(req, res);
      expect(res.render).toHaveBeenCalledWith('course-list.njk', expect.objectContaining({
        currentPage: 1
      }));
    });
  });

  describe('addCoursePostAction', () => {
    beforeEach(() => {
      Course.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({ _id: '1' })
      }));
      req.body = { title: 'Test Course', description: 'Test' };
      req.file = { filename: 'test.jpg' };
    });

    it('should create course and redirect on success', async () => {
      await addCoursePostAction(req, res);
      expect(Course).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Test Course',
        image: 'test.jpg'
      }));
      expect(res.redirect).toHaveBeenCalledWith('/courses');
      expect(req.session.flash).toEqual({ type: 'success', message: 'Course created.' });
    });

    it('should handle creation error', async () => {
      Course.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('DB Error'))
      }));
      
      await addCoursePostAction(req, res);
      expect(res.redirect).toHaveBeenCalledWith('/courses/add');
      expect(req.session.flash).toEqual({ type: 'error', message: 'Failed to create course.' });
    });

    it('should handle no file upload', async () => {
      req.file = null;
      await addCoursePostAction(req, res);
      expect(Course).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Test Course'
      }));
    });
  });

  describe('getCourseMatches', () => {
    beforeEach(() => {
      req.session.userId = 'user123';
      CourseMatcher.getRecommendations.mockResolvedValue(['course1', 'course2']);
      Analytics.create.mockResolvedValue({});
    });

    it('should return course recommendations when authenticated', async () => {
      req.query = { limit: '5' };
      await getCourseMatches(req, res);
      expect(CourseMatcher.getRecommendations).toHaveBeenCalledWith('user123', 5);
      expect(Analytics.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user123',
        action: 'course_match_request'
      }));
      expect(res.json).toHaveBeenCalledWith({ recommendations: ['course1', 'course2'] });
    });

    it('should return 401 when not authenticated', async () => {
      req.session.userId = null;
      await getCourseMatches(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should handle matching error', async () => {
      CourseMatcher.getRecommendations.mockRejectedValue(new Error('Match Error'));
      await getCourseMatches(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get course recommendations' });
    });
  });

  describe('getUserMatches', () => {
    beforeEach(() => {
      req.session.userId = 'user123';
      CourseMatcher.getUserRecommendations.mockResolvedValue(['user1', 'user2']);
      Analytics.create.mockResolvedValue({});
    });

    it('should return user recommendations when authenticated', async () => {
      req.query = { limit: '3' };
      await getUserMatches(req, res);
      expect(CourseMatcher.getUserRecommendations).toHaveBeenCalledWith('user123', 3);
      expect(Analytics.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user123',
        action: 'user_match_request'
      }));
      expect(res.json).toHaveBeenCalledWith({ recommendations: ['user1', 'user2'] });
    });

    it('should return 401 when not authenticated', async () => {
      req.session.userId = null;
      await getUserMatches(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });
  });

  describe('trackCourseActivity', () => {
    let next;

    beforeEach(() => {
      next = jest.fn();
      req.session.userId = 'user123';
      req.params.id = 'course456';
      req.method = 'GET';
      UserActivity.findOneAndUpdate.mockResolvedValue({});
      Analytics.create.mockResolvedValue({});
    });

    it('should track course view activity', async () => {
      await trackCourseActivity(req, res, next);
      expect(UserActivity.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user123', resourceType: 'course', resourceId: 'course456' },
        expect.objectContaining({
          action: 'view_course',
          weight: 1
        }),
        { upsert: true, new: true }
      );
      expect(Analytics.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user123',
        action: 'view_course'
      }));
      expect(next).toHaveBeenCalled();
    });

    it('should track course interaction activity', async () => {
      req.method = 'POST';
      await trackCourseActivity(req, res, next);
      expect(UserActivity.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          action: 'interact_course',
          weight: 2
        }),
        expect.any(Object)
      );
    });

    it('should skip tracking when no userId', async () => {
      req.session.userId = null;
      await trackCourseActivity(req, res, next);
      expect(UserActivity.findOneAndUpdate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip tracking when no courseId', async () => {
      req.params.id = null;
      req.body.courseId = null;
      await trackCourseActivity(req, res, next);
      expect(UserActivity.findOneAndUpdate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should handle tracking errors gracefully', async () => {
      UserActivity.findOneAndUpdate.mockRejectedValue(new Error('DB Error'));
      await trackCourseActivity(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});