const ValidationService = require('../../../services/validation/ValidationService');

// Mock mongoose for ObjectId validation
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn((id) => /^[0-9a-fA-F]{24}$/.test(id))
    }
  }
}));

describe('ValidationService', () => {
  describe('validateCourseData', () => {
    it('should validate correct course data', () => {
      const validData = {
        title: 'Valid Course Title',
        linktoTheCall: 'https://example.com/call'
      };

      const result = ValidationService.validateCourseData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.sanitized.title).toBe('Valid Course Title');
      expect(result.sanitized.linktoTheCall).toBe('https://example.com/call');
    });

    it('should reject missing title', () => {
      const invalidData = {
        linktoTheCall: 'https://example.com/call'
      };

      const result = ValidationService.validateCourseData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.title).toBe('Title is required');
    });

    it('should reject empty title', () => {
      const invalidData = {
        title: '   ',
        linktoTheCall: 'https://example.com/call'
      };

      const result = ValidationService.validateCourseData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.title).toBe('Title cannot be empty');
    });

    it('should reject title too long', () => {
      const longTitle = 'a'.repeat(201);
      const invalidData = {
        title: longTitle,
        linktoTheCall: 'https://example.com/call'
      };

      const result = ValidationService.validateCourseData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.title).toBe('Title must be less than 200 characters');
    });

    it('should reject missing call link', () => {
      const invalidData = {
        title: 'Valid Title'
      };

      const result = ValidationService.validateCourseData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.linktoTheCall).toBe('Call link is required');
    });

    it('should reject empty call link', () => {
      const invalidData = {
        title: 'Valid Title',
        linktoTheCall: '   '
      };

      const result = ValidationService.validateCourseData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.linktoTheCall).toBe('Call link cannot be empty');
    });

    it('should reject call link too long', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(500);
      const invalidData = {
        title: 'Valid Title',
        linktoTheCall: longUrl
      };

      const result = ValidationService.validateCourseData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.linktoTheCall).toBe('Call link must be less than 500 characters');
    });

    it('should reject invalid URL format', () => {
      const invalidData = {
        title: 'Valid Title',
        linktoTheCall: 'not-a-valid-url'
      };

      const result = ValidationService.validateCourseData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.linktoTheCall).toBe('Call link must be a valid URL');
    });

    it('should trim whitespace from inputs', () => {
      const dataWithWhitespace = {
        title: '  Trimmed Title  ',
        linktoTheCall: '  https://example.com/call  '
      };

      const result = ValidationService.validateCourseData(dataWithWhitespace);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.title).toBe('Trimmed Title');
      expect(result.sanitized.linktoTheCall).toBe('https://example.com/call');
    });
  });

  describe('validateGroupData', () => {
    it('should validate correct group data', () => {
      const validData = {
        name: 'Valid Group Name',
        description: 'Valid description',
        visibility: 'public',
        maxMembers: 25
      };

      const result = ValidationService.validateGroupData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.sanitized.name).toBe('Valid Group Name');
      expect(result.sanitized.visibility).toBe('public');
      expect(result.sanitized.maxMembers).toBe(25);
    });

    it('should reject missing name', () => {
      const invalidData = {
        visibility: 'public'
      };

      const result = ValidationService.validateGroupData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe('Group name is required');
    });

    it('should reject name too short', () => {
      const invalidData = {
        name: 'A',
        visibility: 'public'
      };

      const result = ValidationService.validateGroupData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe('Group name must be at least 2 characters');
    });

    it('should reject name too long', () => {
      const longName = 'a'.repeat(61);
      const invalidData = {
        name: longName,
        visibility: 'public'
      };

      const result = ValidationService.validateGroupData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe('Group name must be less than 60 characters');
    });

    it('should reject invalid visibility', () => {
      const invalidData = {
        name: 'Valid Name',
        visibility: 'invalid'
      };

      const result = ValidationService.validateGroupData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.visibility).toBe('Visibility must be either public or private');
    });

    it('should default to public visibility', () => {
      const dataWithoutVisibility = {
        name: 'Valid Name'
      };

      const result = ValidationService.validateGroupData(dataWithoutVisibility);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.visibility).toBe('public');
    });

    it('should reject invalid max members', () => {
      const invalidData = {
        name: 'Valid Name',
        maxMembers: 'not-a-number'
      };

      const result = ValidationService.validateGroupData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.maxMembers).toBe('Max members must be a valid number');
    });

    it('should reject max members too low', () => {
      const invalidData = {
        name: 'Valid Name',
        maxMembers: 1
      };

      const result = ValidationService.validateGroupData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.maxMembers).toBe('Max members must be at least 2');
    });

    it('should reject max members too high', () => {
      const invalidData = {
        name: 'Valid Name',
        maxMembers: 101
      };

      const result = ValidationService.validateGroupData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.maxMembers).toBe('Max members cannot exceed 100');
    });

    it('should use default max members when not provided', () => {
      const dataWithoutMaxMembers = {
        name: 'Valid Name'
      };

      const result = ValidationService.validateGroupData(dataWithoutMaxMembers);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.maxMembers).toBe(25);
    });

    it('should validate description length', () => {
      const longDescription = 'a'.repeat(501);
      const invalidData = {
        name: 'Valid Name',
        description: longDescription
      };

      const result = ValidationService.validateGroupData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.description).toBe('Description must be less than 500 characters');
    });

    it('should trim whitespace from name and description', () => {
      const dataWithWhitespace = {
        name: '  Trimmed Name  ',
        description: '  Trimmed description  ',
        visibility: 'public'
      };

      const result = ValidationService.validateGroupData(dataWithWhitespace);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.name).toBe('Trimmed Name');
      expect(result.sanitized.description).toBe('Trimmed description');
    });
  });

  describe('validateUserData', () => {
    it('should validate correct user data', () => {
      const validData = {
        email: 'test@example.com',
        username: 'testuser123',
        password: 'password123'
      };

      const result = ValidationService.validateUserData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.sanitized.email).toBe('test@example.com');
      expect(result.sanitized.username).toBe('testuser123');
      expect(result.sanitized.password).toBe('password123');
    });

    it('should reject missing email', () => {
      const invalidData = {
        username: 'testuser',
        password: 'password123'
      };

      const result = ValidationService.validateUserData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe('Email is required');
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        username: 'testuser',
        password: 'password123'
      };

      const result = ValidationService.validateUserData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe('Please enter a valid email address');
    });

    it('should convert email to lowercase', () => {
      const dataWithUppercase = {
        email: 'TEST@EXAMPLE.COM',
        username: 'testuser',
        password: 'password123'
      };

      const result = ValidationService.validateUserData(dataWithUppercase);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.email).toBe('test@example.com');
    });

    it('should reject missing username', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = ValidationService.validateUserData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.username).toBe('Username is required');
    });

    it('should reject username too short', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'ab',
        password: 'password123'
      };

      const result = ValidationService.validateUserData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.username).toBe('Username must be at least 3 characters');
    });

    it('should reject username too long', () => {
      const longUsername = 'a'.repeat(31);
      const invalidData = {
        email: 'test@example.com',
        username: longUsername,
        password: 'password123'
      };

      const result = ValidationService.validateUserData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.username).toBe('Username must be less than 30 characters');
    });

    it('should reject username with invalid characters', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'test-user!',
        password: 'password123'
      };

      const result = ValidationService.validateUserData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.username).toBe('Username can only contain letters, numbers, and underscores');
    });

    it('should accept valid username characters', () => {
      const validUsernames = ['testuser123', 'user_name', 'User123', 'test_123'];

      validUsernames.forEach(username => {
        const data = {
          email: 'test@example.com',
          username,
          password: 'password123'
        };

        const result = ValidationService.validateUserData(data);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject missing password', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser'
      };

      const result = ValidationService.validateUserData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.password).toBe('Password is required');
    });

    it('should reject password too short', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser',
        password: '12345'
      };

      const result = ValidationService.validateUserData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.password).toBe('Password must be at least 6 characters');
    });

    it('should reject password too long', () => {
      const longPassword = 'a'.repeat(129);
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser',
        password: longPassword
      };

      const result = ValidationService.validateUserData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.password).toBe('Password must be less than 128 characters');
    });

    it('should not trim password', () => {
      const dataWithPasswordSpaces = {
        email: 'test@example.com',
        username: 'testuser',
        password: '  password123  '
      };

      const result = ValidationService.validateUserData(dataWithPasswordSpaces);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.password).toBe('  password123  ');
    });
  });

  describe('validatePagination', () => {
    it('should validate correct pagination parameters', () => {
      const validParams = {
        page: 2,
        limit: 20
      };

      const result = ValidationService.validatePagination(validParams);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitized.page).toBe(2);
      expect(result.sanitized.limit).toBe(20);
    });

    it('should use defaults for missing parameters', () => {
      const result = ValidationService.validatePagination({});

      expect(result.isValid).toBe(true);
      expect(result.sanitized.page).toBe(1);
      expect(result.sanitized.limit).toBe(10);
    });

    it('should reject invalid page number', () => {
      const invalidParams = {
        page: 0
      };

      const result = ValidationService.validatePagination(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Page must be a positive number');
      expect(result.sanitized.page).toBe(1); // Should default to 1
    });

    it('should reject non-numeric page', () => {
      const invalidParams = {
        page: 'not-a-number'
      };

      const result = ValidationService.validatePagination(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Page must be a positive number');
      expect(result.sanitized.page).toBe(1);
    });

    it('should reject invalid limit', () => {
      const invalidParams = {
        limit: 150
      };

      const result = ValidationService.validatePagination(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Limit must be between 1 and 100');
      expect(result.sanitized.limit).toBe(10); // Should default to 10
    });

    it('should reject limit too low', () => {
      const invalidParams = {
        limit: 0
      };

      const result = ValidationService.validatePagination(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Limit must be between 1 and 100');
      expect(result.sanitized.limit).toBe(10);
    });

    it('should handle null values', () => {
      const paramsWithNulls = {
        page: null,
        limit: null
      };

      const result = ValidationService.validatePagination(paramsWithNulls);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.page).toBe(1);
      expect(result.sanitized.limit).toBe(10);
    });
  });

  describe('validateSearch', () => {
    it('should validate correct search parameters', () => {
      const validParams = {
        search: 'valid search term'
      };

      const result = ValidationService.validateSearch(validParams);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitized.search).toBe('valid search term');
    });

    it('should handle missing search parameter', () => {
      const result = ValidationService.validateSearch({});

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitized.search).toBeUndefined();
    });

    it('should reject search term too long', () => {
      const longSearch = 'a'.repeat(101);
      const invalidParams = {
        search: longSearch
      };

      const result = ValidationService.validateSearch(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Search term must be less than 100 characters');
    });

    it('should trim search term', () => {
      const paramsWithWhitespace = {
        search: '  trimmed search  '
      };

      const result = ValidationService.validateSearch(paramsWithWhitespace);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.search).toBe('trimmed search');
    });

    it('should ignore empty search after trimming', () => {
      const paramsWithWhitespace = {
        search: '   '
      };

      const result = ValidationService.validateSearch(paramsWithWhitespace);

      expect(result.isValid).toBe(true);
      expect(result.sanitized.search).toBeUndefined();
    });
  });

  describe('isValidObjectId', () => {
    it('should validate correct ObjectId format', () => {
      const validId = '507f1f77bcf86cd799439011';

      const result = ValidationService.isValidObjectId(validId);

      expect(result).toBe(true);
    });

    it('should reject invalid ObjectId format', () => {
      const invalidId = 'invalid-id';

      const result = ValidationService.isValidObjectId(invalidId);

      expect(result).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(ValidationService.isValidObjectId(null)).toBe(false);
      expect(ValidationService.isValidObjectId(undefined)).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(ValidationService.isValidObjectId(123)).toBe(false);
      expect(ValidationService.isValidObjectId({})).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        '123@domain.com'
      ];

      validEmails.forEach(email => {
        expect(ValidationService.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(ValidationService.isValidEmail(email)).toBe(false);
      });
    });

    it('should reject null or undefined', () => {
      expect(ValidationService.isValidEmail(null)).toBe(false);
      expect(ValidationService.isValidEmail(undefined)).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(ValidationService.isValidEmail(123)).toBe(false);
      expect(ValidationService.isValidEmail({})).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://example.com/path',
        'https://example.com:8080/path',
        'https://subdomain.example.com/path?query=value'
      ];

      validUrls.forEach(url => {
        expect(ValidationService.isValidUrl(url)).toBe(true);
      });
    });

    it('should reject invalid URL formats', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        '://example.com',
        'https://',
        ''
      ];

      invalidUrls.forEach(url => {
        expect(ValidationService.isValidUrl(url)).toBe(false);
      });
    });

    it('should reject null or undefined', () => {
      expect(ValidationService.isValidUrl(null)).toBe(false);
      expect(ValidationService.isValidUrl(undefined)).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(ValidationService.isValidUrl(123)).toBe(false);
      expect(ValidationService.isValidUrl({})).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim and remove angle brackets', () => {
      const input = '  <script>alert("xss")</script>  ';

      const result = ValidationService.sanitizeString(input);

      expect(result).toBe('alert("xss")');
    });

    it('should handle normal strings', () => {
      const input = 'Normal string without HTML';

      const result = ValidationService.sanitizeString(input);

      expect(result).toBe('Normal string without HTML');
    });

    it('should return empty string for non-string input', () => {
      expect(ValidationService.sanitizeString(null)).toBe('');
      expect(ValidationService.sanitizeString(undefined)).toBe('');
      expect(ValidationService.sanitizeString(123)).toBe('');
      expect(ValidationService.sanitizeString({})).toBe('');
    });

    it('should handle empty string', () => {
      const result = ValidationService.sanitizeString('');

      expect(result).toBe('');
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = 'Some text <script>alert("xss")</script> more text';

      const result = ValidationService.sanitizeHtml(input);

      expect(result).toBe('Some text  more text');
    });

    it('should remove all HTML tags', () => {
      const input = '<div><p>Hello <strong>world</strong></p></div>';

      const result = ValidationService.sanitizeHtml(input);

      expect(result).toBe('Helloworld');
    });

    it('should return empty string for non-string input', () => {
      expect(ValidationService.sanitizeHtml(null)).toBe('');
      expect(ValidationService.sanitizeHtml(undefined)).toBe('');
      expect(ValidationService.sanitizeHtml(123)).toBe('');
      expect(ValidationService.sanitizeHtml({})).toBe('');
    });

    it('should handle empty string', () => {
      const result = ValidationService.sanitizeHtml('');

      expect(result).toBe('');
    });
  });
});