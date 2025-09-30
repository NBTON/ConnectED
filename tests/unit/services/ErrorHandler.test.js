const ErrorHandler = require('../../../services/error/ErrorHandler');

// Mock console.error to capture log output
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('handleError', () => {
    it('should handle error with context', () => {
      const error = new Error('Test error');
      const context = { operation: 'testOperation', userId: '123' };

      const result = ErrorHandler.handleError(error, context);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          type: 'internal'
        },
        context: context
      });
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should handle error without context', () => {
      const error = new Error('Test error');

      const result = ErrorHandler.handleError(error);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          type: 'internal'
        },
        context: {}
      });
    });

    it('should sanitize context by removing sensitive data', () => {
      const error = new Error('Test error');
      const context = {
        operation: 'testOperation',
        userId: '123',
        password: 'secret',
        token: 'bearer-token',
        authorization: 'auth-header',
        cookie: 'session-cookie'
      };

      const result = ErrorHandler.handleError(error, context);

      expect(result.context).toEqual({
        operation: 'testOperation',
        userId: '123'
      });
      expect(result.context.password).toBeUndefined();
      expect(result.context.token).toBeUndefined();
      expect(result.context.authorization).toBeUndefined();
      expect(result.context.cookie).toBeUndefined();
    });
  });

  describe('handleExpressError', () => {
    it('should handle Express error and send response', () => {
      const error = new Error('Test error');
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        session: { userId: '123' },
        get: jest.fn().mockReturnValue('test-agent'),
        ip: '127.0.0.1'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      ErrorHandler.handleExpressError(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          type: 'internal'
        },
        context: {
          operation: 'GET /api/test',
          userId: '123',
          userAgent: 'test-agent',
          ip: '127.0.0.1'
        }
      });
    });

    it('should handle Express error without session', () => {
      const error = new Error('Test error');
      const mockReq = {
        method: 'POST',
        originalUrl: '/api/test',
        session: null,
        get: jest.fn().mockReturnValue('test-agent'),
        ip: '127.0.0.1'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      ErrorHandler.handleExpressError(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            userId: undefined
          })
        })
      );
    });
  });

  describe('handleServiceError', () => {
    it('should handle service error with user ID', () => {
      const error = new Error('Service error');
      const operation = 'testOperation';
      const userId = '123';

      const result = ErrorHandler.handleServiceError(error, operation, userId);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          type: 'internal'
        },
        context: {
          operation,
          userId,
          layer: 'service'
        }
      });
    });

    it('should handle service error without user ID', () => {
      const error = new Error('Service error');
      const operation = 'testOperation';

      const result = ErrorHandler.handleServiceError(error, operation);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          type: 'internal'
        },
        context: {
          operation,
          userId: null,
          layer: 'service'
        }
      });
    });
  });

  describe('handleControllerError', () => {
    it('should handle controller error', () => {
      const error = new Error('Controller error');
      const operation = 'testOperation';
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        session: { userId: '123' }
      };

      const result = ErrorHandler.handleControllerError(error, operation, mockReq);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          type: 'internal'
        },
        context: {
          operation,
          userId: '123',
          layer: 'controller',
          method: 'GET',
          url: '/api/test'
        }
      });
    });

    it('should handle controller error without session', () => {
      const error = new Error('Controller error');
      const operation = 'testOperation';
      const mockReq = {
        method: 'POST',
        originalUrl: '/api/test',
        session: null
      };

      const result = ErrorHandler.handleControllerError(error, operation, mockReq);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          type: 'internal'
        },
        context: {
          operation,
          userId: undefined,
          layer: 'controller',
          method: 'POST',
          url: '/api/test'
        }
      });
    });
  });

  describe('getErrorMessage', () => {
    it('should return validation error message', () => {
      const error = new Error('Username is required');

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('Username is required');
    });

    it('should return not found error message', () => {
      const error = new Error('User not found');

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('User not found');
    });

    it('should return forbidden message for forbidden errors', () => {
      const error = new Error('Access forbidden');

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('You do not have permission to perform this action');
    });

    it('should return already exists message', () => {
      const error = new Error('Email already exists');

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('Email already exists');
    });

    it('should return limit error message', () => {
      const error = new Error('too many');

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('too many');
    });

    it('should return validation error for ValidationError', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('Invalid data provided');
    });

    it('should return invalid ID message for CastError', () => {
      const error = new Error('Cast failed');
      error.name = 'CastError';

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('Invalid ID format');
    });

    it('should return duplicate message for code 11000', () => {
      const error = new Error('Duplicate key');
      error.code = 11000;

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('This item already exists');
    });

    it('should return default message for unknown error', () => {
      const error = new Error('Unknown error');

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('An unexpected error occurred');
    });

    it('should handle error without message', () => {
      const error = {};

      const result = ErrorHandler.getErrorMessage(error);

      expect(result).toBe('An unexpected error occurred');
    });
  });

  describe('getErrorCode', () => {
    it('should return error code when present', () => {
      const error = new Error('Test error');
      error.code = 'CUSTOM_CODE';

      const result = ErrorHandler.getErrorCode(error);

      expect(result).toBe('CUSTOM_CODE');
    });

    it('should return VALIDATION_ERROR for ValidationError', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      const result = ErrorHandler.getErrorCode(error);

      expect(result).toBe('VALIDATION_ERROR');
    });

    it('should return INVALID_ID for CastError', () => {
      const error = new Error('Cast failed');
      error.name = 'CastError';

      const result = ErrorHandler.getErrorCode(error);

      expect(result).toBe('INVALID_ID');
    });

    it('should return NOT_FOUND for not found message', () => {
      const error = new Error('User not found');

      const result = ErrorHandler.getErrorCode(error);

      expect(result).toBe('NOT_FOUND');
    });

    it('should return FORBIDDEN for forbidden message', () => {
      const error = new Error('Access forbidden');

      const result = ErrorHandler.getErrorCode(error);

      expect(result).toBe('FORBIDDEN');
    });

    it('should return UNAUTHORIZED for unauthorized message', () => {
      const error = new Error('unauthorized');

      const result = ErrorHandler.getErrorCode(error);

      expect(result).toBe('UNAUTHORIZED');
    });

    it('should return INTERNAL_ERROR as default', () => {
      const error = new Error('Unknown error');

      const result = ErrorHandler.getErrorCode(error);

      expect(result).toBe('INTERNAL_ERROR');
    });
  });

  describe('getErrorType', () => {
    it('should return validation for ValidationError', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      const result = ErrorHandler.getErrorType(error);

      expect(result).toBe('validation');
    });

    it('should return not_found for CastError', () => {
      const error = new Error('Cast failed');
      error.name = 'CastError';

      const result = ErrorHandler.getErrorType(error);

      expect(result).toBe('not_found');
    });

    it('should return authorization for forbidden message', () => {
      const error = new Error('Access forbidden');

      const result = ErrorHandler.getErrorType(error);

      expect(result).toBe('authorization');
    });

    it('should return duplicate for code 11000', () => {
      const error = new Error('Duplicate key');
      error.code = 11000;

      const result = ErrorHandler.getErrorType(error);

      expect(result).toBe('duplicate');
    });

    it('should return internal as default', () => {
      const error = new Error('Unknown error');

      const result = ErrorHandler.getErrorType(error);

      expect(result).toBe('internal');
    });
  });

  describe('getHttpStatusCode', () => {
    it('should return 404 for not found errors', () => {
      const error = new Error('User not found');

      const result = ErrorHandler.getHttpStatusCode(error);

      expect(result).toBe(404);
    });

    it('should return 404 for CastError', () => {
      const error = new Error('Cast failed');
      error.name = 'CastError';

      const result = ErrorHandler.getHttpStatusCode(error);

      expect(result).toBe(404);
    });

    it('should return 403 for forbidden errors', () => {
      const error = new Error('Access forbidden');

      const result = ErrorHandler.getHttpStatusCode(error);

      expect(result).toBe(403);
    });

    it('should return 401 for unauthorized errors', () => {
      const error = new Error('Not authorized');

      const result = ErrorHandler.getHttpStatusCode(error);

      expect(result).toBe(401);
    });

    it('should return 400 for validation errors', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      const result = ErrorHandler.getHttpStatusCode(error);

      expect(result).toBe(400);
    });

    it('should return 409 for duplicate key errors', () => {
      const error = new Error('Duplicate key');
      error.code = 11000;

      const result = ErrorHandler.getHttpStatusCode(error);

      expect(result).toBe(409);
    });

    it('should return 500 as default', () => {
      const error = new Error('Unknown error');

      const result = ErrorHandler.getHttpStatusCode(error);

      expect(result).toBe(500);
    });
  });

  describe('logError', () => {
    it('should log error with context', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      error.name = 'TestError';
      error.code = 'TEST_CODE';

      const context = { operation: 'testOperation', userId: '123' };

      ErrorHandler.logError(error, context);

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error occurred:',
        expect.stringContaining('Test error')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error occurred:',
        expect.stringContaining('Error stack trace')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error occurred:',
        expect.stringContaining('TestError')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error occurred:',
        expect.stringContaining('TEST_CODE')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error occurred:',
        expect.stringContaining('testOperation')
      );
    });

    it('should handle error without stack', () => {
      const error = new Error('Test error');
      delete error.stack;

      ErrorHandler.logError(error, {});

      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('sanitizeContext', () => {
    it('should remove sensitive fields from context', () => {
      const context = {
        operation: 'testOperation',
        userId: '123',
        password: 'secret',
        token: 'bearer-token',
        authorization: 'auth-header',
        cookie: 'session-cookie',
        safeField: 'safe-value'
      };

      const result = ErrorHandler.sanitizeContext(context);

      expect(result).toEqual({
        operation: 'testOperation',
        userId: '123',
        safeField: 'safe-value'
      });
      expect(result.password).toBeUndefined();
      expect(result.token).toBeUndefined();
      expect(result.authorization).toBeUndefined();
      expect(result.cookie).toBeUndefined();
    });

    it('should return empty object for null context', () => {
      const result = ErrorHandler.sanitizeContext(null);

      expect(result).toEqual({});
    });

    it('should return empty object for undefined context', () => {
      const result = ErrorHandler.sanitizeContext(undefined);

      expect(result).toEqual({});
    });

    it('should handle context without sensitive fields', () => {
      const context = {
        operation: 'testOperation',
        userId: '123',
        safeField: 'safe-value'
      };

      const result = ErrorHandler.sanitizeContext(context);

      expect(result).toEqual(context);
    });
  });

  describe('createError', () => {
    it('should create custom error with default values', () => {
      const error = ErrorHandler.createError('Custom error message');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Custom error message');
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.type).toBe('custom');
    });

    it('should create custom error with provided values', () => {
      const error = ErrorHandler.createError('Custom error', 'MY_CODE', 'my_type');

      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('MY_CODE');
      expect(error.type).toBe('my_type');
    });
  });

  describe('createValidationError', () => {
    it('should create validation error', () => {
      const error = ErrorHandler.createValidationError('Invalid input');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.type).toBe('validation');
    });
  });

  describe('createNotFoundError', () => {
    it('should create not found error', () => {
      const error = ErrorHandler.createNotFoundError('User');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.type).toBe('not_found');
    });
  });

  describe('createForbiddenError', () => {
    it('should create forbidden error with default message', () => {
      const error = ErrorHandler.createForbiddenError();

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Forbidden');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.type).toBe('authorization');
    });

    it('should create forbidden error with custom message', () => {
      const error = ErrorHandler.createForbiddenError('Custom forbidden message');

      expect(error.message).toBe('Custom forbidden message');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.type).toBe('authorization');
    });
  });
});