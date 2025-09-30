const CourseRepository = require('../../../services/repositories/CourseRepository');
const BaseRepository = require('../../../services/repositories/BaseRepository');

// Mock the Course model
jest.mock('../../../models/db_schema', () => ({
  Course: jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', ...data })
  }))
}));

// Mock BaseRepository methods
jest.mock('../../../services/repositories/BaseRepository');

describe('CourseRepository', () => {
  let courseRepository;
  let mockBaseRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepository = new CourseRepository();
    mockBaseRepository = BaseRepository.mock.instances[BaseRepository.mock.instances.length - 1];
  });

  describe('constructor', () => {
    it('should initialize with Course model', () => {
      expect(BaseRepository).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('findWithPagination', () => {
    it('should return paginated results with default parameters', async () => {
      const mockCourses = [
        { _id: '507f1f77bcf86cd799439011', title: 'Course 1' },
        { _id: '507f1f77bcf86cd799439012', title: 'Course 2' }
      ];

      mockBaseRepository.find.mockResolvedValue(mockCourses);
      mockBaseRepository.count.mockResolvedValue(2);

      const result = await courseRepository.findWithPagination();

      expect(mockBaseRepository.find).toHaveBeenCalledWith(
        {},
        { skip: 0, limit: 6, sort: { createdAt: -1 } }
      );
      expect(mockBaseRepository.count).toHaveBeenCalledWith({});
      expect(result).toEqual({
        courses: mockCourses,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 2,
          hasNext: false,
          hasPrev: false
        }
      });
    });

    it('should handle search criteria correctly', async () => {
      const options = { page: 2, limit: 10, search: 'javascript' };
      const mockCourses = [];
      const searchRegex = new RegExp('javascript', 'i');

      mockBaseRepository.find.mockResolvedValue(mockCourses);
      mockBaseRepository.count.mockResolvedValue(0);

      await courseRepository.findWithPagination(options);

      expect(mockBaseRepository.find).toHaveBeenCalledWith(
        {
          $or: [
            { title: { $regex: searchRegex } },
            { linktoTheCall: { $regex: searchRegex } }
          ]
        },
        { skip: 10, limit: 10, sort: { createdAt: -1 } }
      );
      expect(mockBaseRepository.count).toHaveBeenCalledWith({
        $or: [
          { title: { $regex: searchRegex } },
          { linktoTheCall: { $regex: searchRegex } }
        ]
      });
    });

    it('should trim search term and handle empty search', async () => {
      const options = { search: '  test  ' };
      const mockCourses = [];

      mockBaseRepository.find.mockResolvedValue(mockCourses);
      mockBaseRepository.count.mockResolvedValue(0);

      await courseRepository.findWithPagination(options);

      const searchRegex = new RegExp('test', 'i');
      expect(mockBaseRepository.find).toHaveBeenCalledWith(
        {
          $or: [
            { title: { $regex: searchRegex } },
            { linktoTheCall: { $regex: searchRegex } }
          ]
        },
        expect.any(Object)
      );
    });

    it('should handle search with no results correctly', async () => {
      const options = { page: 1, limit: 6, search: 'nonexistent' };
      const mockCourses = [];

      mockBaseRepository.find.mockResolvedValue(mockCourses);
      mockBaseRepository.count.mockResolvedValue(0);

      const result = await courseRepository.findWithPagination(options);

      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should calculate pagination metadata correctly', async () => {
      const options = { page: 3, limit: 5 };
      const mockCourses = [];
      const totalCount = 23;

      mockBaseRepository.find.mockResolvedValue(mockCourses);
      mockBaseRepository.count.mockResolvedValue(totalCount);

      const result = await courseRepository.findWithPagination(options);

      expect(result.pagination).toEqual({
        currentPage: 3,
        totalPages: 5, // Math.ceil(23/5) = 5
        totalCount: 23,
        hasNext: true, // 3 * 5 = 15 < 23
        hasPrev: true  // 3 > 1
      });
    });

    it('should handle edge case with page 1 and no results', async () => {
      const options = { page: 1, limit: 10 };
      const mockCourses = [];

      mockBaseRepository.find.mockResolvedValue(mockCourses);
      mockBaseRepository.count.mockResolvedValue(0);

      const result = await courseRepository.findWithPagination(options);

      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        hasNext: false,
        hasPrev: false
      });
    });

    it('should return default structure on error', async () => {
      const mockError = new Error('Database error');
      mockBaseRepository.find.mockRejectedValue(mockError);

      const result = await courseRepository.findWithPagination({ page: 2, limit: 5 });

      expect(result).toEqual({
        courses: [],
        pagination: {
          currentPage: 2,
          totalPages: 1,
          totalCount: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    });
  });

  describe('createCourse', () => {
    it('should create course successfully with valid data', async () => {
      const courseData = {
        title: 'Test Course',
        linktoTheCall: 'https://example.com/call',
        image: 'course.jpg'
      };
      const createdCourse = { _id: '507f1f77bcf86cd799439011', ...courseData };

      mockBaseRepository.create.mockResolvedValue(createdCourse);

      const result = await courseRepository.createCourse(courseData);

      expect(mockBaseRepository.create).toHaveBeenCalledWith(courseData);
      expect(result).toEqual(createdCourse);
    });

    it('should throw error for missing title', async () => {
      const courseData = {
        linktoTheCall: 'https://example.com/call',
        image: 'course.jpg'
      };

      await expect(courseRepository.createCourse(courseData))
        .rejects.toThrow('Title and call link are required');
    });

    it('should throw error for missing call link', async () => {
      const courseData = {
        title: 'Test Course',
        image: 'course.jpg'
      };

      await expect(courseRepository.createCourse(courseData))
        .rejects.toThrow('Title and call link are required');
    });

    it('should throw error for missing both required fields', async () => {
      const courseData = {
        image: 'course.jpg'
      };

      await expect(courseRepository.createCourse(courseData))
        .rejects.toThrow('Title and call link are required');
    });

    it('should handle and rethrow creation errors', async () => {
      const courseData = {
        title: 'Test Course',
        linktoTheCall: 'https://example.com/call'
      };
      const mockError = new Error('Database error');

      mockBaseRepository.create.mockRejectedValue(mockError);

      await expect(courseRepository.createCourse(courseData)).rejects.toThrow('Database error');
    });
  });

  describe('findByIdCached', () => {
    it('should delegate to findById method', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const mockCourse = { _id: courseId, title: 'Test Course' };

      mockBaseRepository.findById.mockResolvedValue(mockCourse);

      const result = await courseRepository.findByIdCached(courseId);

      expect(mockBaseRepository.findById).toHaveBeenCalledWith(courseId);
      expect(result).toEqual(mockCourse);
    });

    it('should return null when course not found', async () => {
      const courseId = '507f1f77bcf86cd799439011';

      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await courseRepository.findByIdCached(courseId);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      mockBaseRepository.findById.mockRejectedValue(mockError);

      const result = await courseRepository.findByIdCached(courseId);

      expect(result).toBeNull();
    });
  });
});