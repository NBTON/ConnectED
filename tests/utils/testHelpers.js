const bcrypt = require('bcrypt');

/**
 * Test data factories for creating consistent test data
 */
class TestDataFactory {
  /**
   * Create a test user object
   */
  static createUser(overrides = {}) {
    return {
      username: `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: `test_${Date.now()}@example.com`,
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'student',
      isActive: true,
      ...overrides
    };
  }

  /**
   * Create a test course object
   */
  static createCourse(overrides = {}) {
    return {
      title: `Test Course ${Date.now()}`,
      description: 'A test course for testing purposes',
      subject: 'Computer Science',
      instructor: `instructor_${Date.now()}`,
      maxStudents: 30,
      currentEnrollment: 0,
      schedule: {
        days: ['Monday', 'Wednesday'],
        time: '10:00-11:30',
        room: 'CS101'
      },
      isActive: true,
      ...overrides
    };
  }

  /**
   * Create a test group object
   */
  static createGroup(overrides = {}) {
    return {
      name: `Test Group ${Date.now()}`,
      description: 'A test group for collaboration',
      subject: 'Computer Science',
      maxMembers: 10,
      isPrivate: false,
      createdBy: `user_${Date.now()}`,
      ...overrides
    };
  }

  /**
   * Create a test group member object
   */
  static createGroupMember(overrides = {}) {
    return {
      groupId: `group_${Date.now()}`,
      userId: `user_${Date.now()}`,
      role: 'member',
      joinedAt: new Date(),
      ...overrides
    };
  }

  /**
   * Create test authentication credentials
   */
  static createAuthCredentials(overrides = {}) {
    return {
      username: `testuser_${Date.now()}`,
      password: 'password123',
      ...overrides
    };
  }

  /**
   * Create test file upload data
   */
  static createFileUpload(overrides = {}) {
    return {
      fieldname: 'file',
      originalname: 'test-file.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      buffer: Buffer.from('test file content'),
      size: 17,
      ...overrides
    };
  }
}

/**
 * Database helper functions for tests
 */
class DatabaseHelper {
  /**
   * Clear all collections
   */
  static async clearDatabase() {
    const mongoose = require('mongoose');
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }

  /**
   * Create test user in database
   */
  static async createTestUserInDB(UserModel, overrides = {}) {
    const userData = TestDataFactory.createUser(overrides);
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = new UserModel({
      ...userData,
      password: hashedPassword
    });
    return await user.save();
  }

  /**
   * Create test course in database
   */
  static async createTestCourseInDB(CourseModel, overrides = {}) {
    const courseData = TestDataFactory.createCourse(overrides);
    const course = new CourseModel(courseData);
    return await course.save();
  }

  /**
   * Create test group in database
   */
  static async createTestGroupInDB(GroupModel, overrides = {}) {
    const groupData = TestDataFactory.createGroup(overrides);
    const group = new GroupModel(groupData);
    return await group.save();
  }
}

/**
 * HTTP request helper for API testing
 */
class RequestHelper {
  constructor(app) {
    this.app = app;
    this.request = require('supertest')(app);
  }

  /**
   * Make authenticated request
   */
  async authenticatedRequest(method, url, token, data = null) {
    let request = this.request[method.toLowerCase()](url)
      .set('Authorization', `Bearer ${token}`);

    if (data && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put')) {
      request = request.send(data);
    }

    return request;
  }

  /**
   * Make unauthenticated request
   */
  async unauthenticatedRequest(method, url, data = null) {
    let request = this.request[method.toLowerCase()](url);

    if (data && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put')) {
      request = request.send(data);
    }

    return request;
  }
}

/**
 * Performance testing helpers
 */
class PerformanceHelper {
  /**
   * Measure execution time of a function
   */
  static async measureExecutionTime(fn, iterations = 1) {
    const startTime = process.hrtime.bigint();
    const promises = [];

    for (let i = 0; i < iterations; i++) {
      promises.push(fn());
    }

    await Promise.all(promises);
    const endTime = process.hrtime.bigint();

    return {
      totalTime: Number(endTime - startTime) / 1000000, // Convert to milliseconds
      averageTime: Number(endTime - startTime) / 1000000 / iterations,
      iterations
    };
  }

  /**
   * Assert performance requirement
   */
  static assertPerformance(result, maxTimeMs, operationName = 'operation') {
    if (result.averageTime > maxTimeMs) {
      throw new Error(
        `${operationName} took ${result.averageTime}ms on average, ` +
        `exceeding maximum of ${maxTimeMs}ms`
      );
    }
  }
}

/**
 * Security testing helpers
 */
class SecurityHelper {
  /**
   * Common XSS payloads for testing
   */
  static getXSSPayloads() {
    return [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src=x onerror=alert("xss")>',
      '\'; DROP TABLE users; --',
      '${7*7}',
      '{{7*7}}',
      '<svg onload=alert("xss")>',
      '"><script>alert("xss")</script>',
      '\'-alert("xss")-\'',
      '";alert("xss");//'
    ];
  }

  /**
   * Common SQL injection payloads for testing
   */
  static getSQLInjectionPayloads() {
    return [
      '\'; DROP TABLE users; --',
      '\' OR \'1\'=\'1',
      '\' OR \'1\'=\'1\' --',
      '\' OR \'1\'=\'1\' /*',
      '\') OR (\'1\'=\'1',
      '\'; EXEC xp_cmdshell(\'dir\'); --',
      '1\' UNION SELECT username, password FROM users --',
      'admin\'--',
      'admin\' /*',
      'admin\'#'
    ];
  }

  /**
   * Test input sanitization
   */
  static testInputSanitization(input, expectedOutput) {
    // This would contain logic to test if dangerous inputs are properly sanitized
    // Implementation depends on the sanitization method used
    return input === expectedOutput;
  }
}

module.exports = {
  TestDataFactory,
  DatabaseHelper,
  RequestHelper,
  PerformanceHelper,
  SecurityHelper
};