const CourseMatcher = require('../../utils/matching');
const natural = require('natural');
const { User, Course, UserActivity } = require('../../models/db_schema');
const { cosine } = require('ml-distance');

// Create proper Mongoose mock with chainable methods
const createMockModel = () => {
  const mockFind = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    })
  });
  const mockModel = { find: mockFind, findById: jest.fn().mockResolvedValue({}) };
  mockModel.findOne = jest.fn().mockResolvedValue({});
  return mockModel;
};

jest.mock('../../models/db_schema', () => ({
  User: createMockModel(),
  Course: createMockModel(),
  UserActivity: createMockModel()
}));

jest.mock('natural', () => ({
  WordTokenizer: {
    tokenize: jest.fn()
  }
}));
jest.mock('ml-distance', () => ({
  cosine: jest.fn()
}));

describe('CourseMatcher Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    natural.WordTokenizer.tokenize.mockImplementation(text => text.toLowerCase().split(' '));
    
    // Mock console.error to prevent test output pollution
    console.error = jest.fn();
    
    // Ensure proper mocking for UserActivity.find with chainable methods
    const { UserActivity } = require('../../models/db_schema');
    UserActivity.find.mockImplementation(() => ({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([])
        })
      })
    }));
    
    // Ensure proper mocking for User.find with chainable methods
    const { User } = require('../../models/db_schema');
    User.find.mockImplementation(() => ({
      lean: jest.fn().mockResolvedValue([])
    }));
  });

  describe('calculateSimilarity', () => {
    it('should calculate cosine similarity for valid vectors', () => {
      const userVector = [1, 2, 3];
      const courseVector = [4, 5, 6];
      cosine.mockReturnValue(0.9746318461970762);
      
      const result = CourseMatcher.calculateSimilarity(userVector, courseVector);
      
      expect(cosine).toHaveBeenCalledWith(userVector, courseVector);
      expect(result).toBe(0.9746318461970762);
    });

    it('should return 0 for invalid userVector', () => {
      const result = CourseMatcher.calculateSimilarity(null, [1, 2, 3]);
      expect(result).toBe(0);
    });

    it('should return 0 for invalid courseVector', () => {
      const result = CourseMatcher.calculateSimilarity([1, 2, 3], null);
      expect(result).toBe(0);
    });

    it('should return 0 for vectors of different lengths', () => {
      const result = CourseMatcher.calculateSimilarity([1, 2], [1, 2, 3]);
      expect(result).toBe(0);
    });

    it('should return 0 for empty vectors', () => {
      cosine.mockReturnValue(0); // Mock cosine to return 0 for this test
      const result = CourseMatcher.calculateSimilarity([], []);
      expect(result).toBe(0);
    });
  });

  describe('createUserVector', () => {
    it('should create vector from user interests and skills', () => {
      const mockUser = {
        interests: ['math', 'programming'],
        profile: { skills: ['javascript', 'python'], experience: 'intermediate' }
      };
      
      const result = CourseMatcher.createUserVector(mockUser);
      
      expect(result).toEqual([1, 1, 1, 1, 1]);
      expect(result.length).toBe(5);
    });

    it('should handle missing interests', () => {
      const mockUser = {
        profile: { skills: ['javascript'], experience: 'beginner' }
      };
      
      const result = CourseMatcher.createUserVector(mockUser);
      
      expect(result).toEqual([1, 1]);
    });

    it('should handle missing profile', () => {
      const mockUser = {
        interests: ['math']
      };
      
      const result = CourseMatcher.createUserVector(mockUser);
      
      expect(result).toEqual([1, 1]); // [1] for 'math' and [1] for default 'beginner'
    });

    it('should handle empty user object', () => {
      const result = CourseMatcher.createUserVector({});
      
      expect(result).toEqual([1]); // default experience 'beginner'
    });
  });

  describe('createCourseVector', () => {
    it('should create vector from course data', () => {
      const mockCourse = {
        tags: ['math', 'algebra'],
        title: 'Advanced Mathematics',
        description: 'Learn advanced math concepts including calculus and linear algebra',
        difficulty: 'advanced',
        category: 'science'
      };
      
      const result = CourseMatcher.createCourseVector(mockCourse);
      
      // Expect tokens from title and description
      expect(natural.WordTokenizer.tokenize).toHaveBeenCalledTimes(2);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle course with minimal data', () => {
      const mockCourse = {
        title: 'Basic Course'
      };
      
      const result = CourseMatcher.createCourseVector(mockCourse);
      
      expect(result).toEqual([1, 1, 1]); // basic, course, beginner
    });

    it('should limit title words to 5', () => {
      const mockCourse = {
        title: 'Very Long Course Title That Should Be Truncated To Five Words Only'
      };
      
      natural.WordTokenizer.tokenize.mockReturnValueOnce([
        'very', 'long', 'course', 'title', 'that', 'should', 'be', 'truncated'
      ]);
      
      const result = CourseMatcher.createCourseVector(mockCourse);
      
      // Should only include first 5 words + beginner (category filtered out)
      expect(result.length).toBe(6); // 5 title words + 'beginner' (category is filtered out as empty string)
    });

    it('should limit description words to 10', () => {
      const mockCourse = {
        description: 'This is a very long description that should be limited to ten words maximum for vector creation purposes in the matching algorithm'
      };
      
      natural.WordTokenizer.tokenize.mockReturnValueOnce([
        'this', 'is', 'a', 'very', 'long', 'description', 'that', 'should', 'be', 'limited', 'to', 'ten', 'words'
      ]);
      
      const result = CourseMatcher.createCourseVector(mockCourse);
      
      // Should include first 10 words + beginner (category filtered out)
      expect(result.length).toBe(11); // 10 description words + 'beginner' (category is filtered out as empty string)
    });
  });

  describe('termsToVector', () => {
    it('should create frequency vector from terms', () => {
      const terms = ['math', 'programming', 'math', 'science'];
      
      const result = CourseMatcher.termsToVector(terms);
      
      // Expect [2, 1, 1] for math:2, programming:1, science:1
      expect(result).toEqual([2, 1, 1]);
    });

    it('should handle single term', () => {
      const terms = ['math'];
      
      const result = CourseMatcher.termsToVector(terms);
      
      expect(result).toEqual([1]);
    });

    it('should handle empty terms array', () => {
      const result = CourseMatcher.termsToVector([]);
      
      expect(result).toEqual([]);
    });

    it('should handle terms with duplicates', () => {
      const terms = ['a', 'b', 'a', 'a', 'c', 'b'];
      
      const result = CourseMatcher.termsToVector(terms);
      
      expect(result).toEqual([3, 2, 1]); // a:3, b:2, c:1
    });
  });

  describe('getRecommendations', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue({
        _id: 'user123',
        preferences: { matchingConsent: true },
        interests: ['math'],
        profile: { skills: ['calculus'], experience: 'intermediate' }
      });
      
      // Set up UserActivity.find with chainable methods
      UserActivity.find.mockImplementation(() => ({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                userId: 'user123',
                resourceType: 'course',
                resourceId: { _id: 'course1' },
                weight: 2,
                createdAt: new Date()
              }
            ])
          })
        })
      }));
      
      // Set up Course.find with chainable methods
      Course.find.mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue([
          {
            _id: 'course1',
            title: 'Advanced Math',
            description: 'Learn advanced mathematics',
            tags: ['math', 'calculus'],
            difficulty: 'intermediate',
            category: 'science'
          },
          {
            _id: 'course2',
            title: 'Programming Basics',
            description: 'Learn programming fundamentals',
            tags: ['programming'],
            difficulty: 'beginner',
            category: 'technology'
          }
        ])
      }));
    });

    it('should return recommendations for user with consent', async () => {
      const recommendations = await CourseMatcher.getRecommendations('user123', 2);
      
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(UserActivity.find).toHaveBeenCalledWith({ userId: 'user123' });
      expect(Course.find).toHaveBeenCalledWith({});
      expect(recommendations.length).toBe(2);
      expect(recommendations[0].matchScore).toBeDefined();
      expect(recommendations[0].similarity).toBeDefined();
    });

    it('should return empty array for user without consent', async () => {
      User.findById.mockResolvedValueOnce({
        _id: 'user123',
        preferences: { matchingConsent: false }
      });
      
      const recommendations = await CourseMatcher.getRecommendations('user123');
      
      expect(recommendations).toEqual([]);
    });

    it('should boost score for viewed courses', async () => {
      const recommendations = await CourseMatcher.getRecommendations('user123', 2);
      
      // Course1 should have activity boost of 2 * 0.1 = 0.2
      expect(recommendations[0].matchScore).toBeGreaterThan(recommendations[1].matchScore);
    });

    it('should handle no user activities', async () => {
      UserActivity.find.mockImplementationOnce(() => ({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      }));
      
      const recommendations = await CourseMatcher.getRecommendations('user123');
      
      expect(recommendations.length).toBe(2);
      // No boost applied
    });

    it('should handle user not found', async () => {
      User.findById.mockResolvedValueOnce(null);
      
      const recommendations = await CourseMatcher.getRecommendations('user123');
      
      expect(recommendations).toEqual([]);
    });

    it('should handle database errors', async () => {
      User.findById.mockRejectedValueOnce(new Error('DB Error'));
      
      const recommendations = await CourseMatcher.getRecommendations('user123');
      
      expect(recommendations).toEqual([]);
    });

    it('should limit recommendations by parameter', async () => {
      const recommendations = await CourseMatcher.getRecommendations('user123', 1);
      
      expect(recommendations.length).toBe(1);
    });
  });

  describe('getUserRecommendations', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue({
        _id: 'user123',
        preferences: { matchingConsent: true },
        interests: ['math', 'science'],
        profile: { skills: ['calculus', 'physics'] }
      });
      
      // Set up User.find with chainable methods
      User.find.mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue([
          {
            _id: 'user456',
            username: 'john_doe',
            preferences: { matchingConsent: true },
            interests: ['math', 'calculus'],
            profile: { skills: ['algebra', 'trigonometry'] }
          },
          {
            _id: 'user789',
            username: 'jane_smith',
            preferences: { matchingConsent: true },
            interests: ['biology'],
            profile: { skills: ['chemistry'] }
          }
        ])
      }));
    });

    it('should return user recommendations based on similarity', async () => {
      const recommendations = await CourseMatcher.getUserRecommendations('user123', 2);
      
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(User.find).toHaveBeenCalledWith({
        _id: { $ne: 'user123' },
        'preferences.matchingConsent': true
      });
      expect(recommendations.length).toBe(2);
      expect(recommendations[0].matchScore).toBeDefined();
      expect(recommendations[0].username).toBe('john_doe'); // Higher similarity expected
    });

    it('should return empty array for user without consent', async () => {
      User.findById.mockResolvedValueOnce({
        _id: 'user123',
        preferences: { matchingConsent: false }
      });
      
      const recommendations = await CourseMatcher.getUserRecommendations('user123');
      
      expect(recommendations).toEqual([]);
    });

    it('should exclude current user from recommendations', async () => {
      const recommendations = await CourseMatcher.getUserRecommendations('user123');
      
      expect(recommendations.length).toBe(2);
      expect(recommendations[0]._id).not.toBe('user123');
      expect(recommendations[1]._id).not.toBe('user123');
    });

    it('should handle no other users with consent', async () => {
      User.find.mockImplementationOnce(() => ({
        lean: jest.fn().mockResolvedValue([])
      }));
      
      const recommendations = await CourseMatcher.getUserRecommendations('user123');
      
      expect(recommendations).toEqual([]);
    });

    it('should handle user not found', async () => {
      User.findById.mockResolvedValueOnce(null);
      
      const recommendations = await CourseMatcher.getUserRecommendations('user123');
      
      expect(recommendations).toEqual([]);
    });

    it('should handle database errors', async () => {
      User.findById.mockRejectedValueOnce(new Error('DB Error'));
      
      const recommendations = await CourseMatcher.getUserRecommendations('user123');
      
      expect(recommendations).toEqual([]);
    });

    it('should limit recommendations by parameter', async () => {
      const recommendations = await CourseMatcher.getUserRecommendations('user123', 1);
      
      expect(recommendations.length).toBe(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle getRecommendations with invalid userId', async () => {
      User.findById.mockResolvedValue(null);
      
      const recommendations = await CourseMatcher.getRecommendations(null);
      
      expect(recommendations).toEqual([]);
    });

    it('should handle getUserRecommendations with invalid userId', async () => {
      User.findById.mockResolvedValue(null);
      
      const recommendations = await CourseMatcher.getUserRecommendations(null);
      
      expect(recommendations).toEqual([]);
    });

    it('should handle malformed course data in recommendations', async () => {
      User.findById.mockResolvedValue({
        _id: 'user123',
        preferences: { matchingConsent: true },
        interests: ['math']
      });
      
      Course.find.mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue([
          { _id: 'course1', title: 'Math Course' }, // Missing description/tags
          null // Malformed course
        ])
      }));
      
      const recommendations = await CourseMatcher.getRecommendations('user123', 2);
      
      expect(recommendations.length).toBe(0); // Function throws error on null course, returns empty array
    });

    it('should handle empty course collection', async () => {
      User.findById.mockResolvedValue({
        _id: 'user123',
        preferences: { matchingConsent: true },
        interests: ['math']
      });
      
      Course.find.mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue([])
      }));
      
      const recommendations = await CourseMatcher.getRecommendations('user123');
      
      expect(recommendations).toEqual([]);
    });
  });
});