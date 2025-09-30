const BaseService = require('../../../services/BaseService');

// Mock cache service
const createMockCacheService = () => ({
  cachedOperation: jest.fn(),
  invalidatePattern: jest.fn(),
  del: jest.fn()
});

describe('BaseService', () => {
  let baseService;
  let mockCacheService;

  beforeEach(() => {
    mockCacheService = createMockCacheService();
    baseService = new BaseService({}, mockCacheService);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with repositories and cache service', () => {
      const repositories = { userRepository: 'mockRepo' };
      const service = new BaseService(repositories, mockCacheService);

      expect(service.repositories).toEqual(repositories);
      expect(service.cacheService).toBe(mockCacheService);
    });

    it('should initialize with empty repositories when none provided', () => {
      const service = new BaseService();

      expect(service.repositories).toEqual({});
      expect(service.cacheService).toBeNull();
    });

    it('should initialize with null cache service when none provided', () => {
      const service = new BaseService({});

      expect(service.repositories).toEqual({});
      expect(service.cacheService).toBeNull();
    });
  });

  describe('generateCacheKey', () => {
    it('should generate cache key with single parameter', () => {
      const result = baseService.generateCacheKey('user', '123');

      expect(result).toBe('user:123');
    });

    it('should generate cache key with multiple parameters', () => {
      const result = baseService.generateCacheKey('user', '123', 'profile');

      expect(result).toBe('user:123:profile');
    });

    it('should generate cache key with operation only', () => {
      const result = baseService.generateCacheKey('users');

      expect(result).toBe('users:');
    });

    it('should handle numeric parameters', () => {
      const result = baseService.generateCacheKey('course', 123, 'students');

      expect(result).toBe('course:123:students');
    });

    it('should handle special characters in parameters', () => {
      const result = baseService.generateCacheKey('group', 'test-group', 'members');

      expect(result).toBe('group:test-group:members');
    });

    it('should handle empty parameters', () => {
      const result = baseService.generateCacheKey('test', '', 'data');

      expect(result).toBe('test::data');
    });
  });

  describe('executeCachedOperation', () => {
    it('should execute operation through cache service when available', async () => {
      const cacheKey = 'user:123';
      const mockOperation = jest.fn().mockResolvedValue({ id: 123, name: 'Test User' });
      const ttl = 1800;
      const expectedResult = { id: 123, name: 'Test User' };

      mockCacheService.cachedOperation.mockResolvedValue(expectedResult);

      const result = await baseService.executeCachedOperation(cacheKey, mockOperation, ttl);

      expect(mockCacheService.cachedOperation).toHaveBeenCalledWith(cacheKey, mockOperation, ttl);
      expect(result).toEqual(expectedResult);
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should execute operation directly when cache service unavailable', async () => {
      const serviceWithoutCache = new BaseService({}, null);
      const cacheKey = 'user:123';
      const mockOperation = jest.fn().mockResolvedValue({ id: 123, name: 'Test User' });
      const expectedResult = { id: 123, name: 'Test User' };

      const result = await serviceWithoutCache.executeCachedOperation(cacheKey, mockOperation);

      expect(result).toEqual(expectedResult);
      expect(mockOperation).toHaveBeenCalledWith();
    });

    it('should use default TTL when not provided', async () => {
      const cacheKey = 'user:123';
      const mockOperation = jest.fn();

      mockCacheService.cachedOperation.mockResolvedValue({});

      await baseService.executeCachedOperation(cacheKey, mockOperation);

      expect(mockCacheService.cachedOperation).toHaveBeenCalledWith(cacheKey, mockOperation, 300);
    });

    it('should handle operation errors correctly', async () => {
      const cacheKey = 'user:123';
      const mockError = new Error('Database error');
      const mockOperation = jest.fn().mockRejectedValue(mockError);

      mockCacheService.cachedOperation.mockRejectedValue(mockError);

      await expect(baseService.executeCachedOperation(cacheKey, mockOperation))
        .rejects.toThrow('Database error');

      expect(mockCacheService.cachedOperation).toHaveBeenCalledWith(cacheKey, mockOperation, 300);
    });

    it('should handle cache service errors correctly', async () => {
      const cacheKey = 'user:123';
      const mockOperation = jest.fn().mockResolvedValue({ id: 123 });
      const cacheError = new Error('Cache error');

      mockCacheService.cachedOperation.mockRejectedValue(cacheError);

      await expect(baseService.executeCachedOperation(cacheKey, mockOperation))
        .rejects.toThrow('Cache error');
    });
  });

  describe('invalidateCachePatterns', () => {
    it('should invalidate multiple patterns when cache service available', async () => {
      const patterns = ['user:*', 'course:123:*', 'group:456:*'];

      await baseService.invalidateCachePatterns(...patterns);

      expect(mockCacheService.invalidatePattern).toHaveBeenCalledTimes(3);
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('user:*');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('course:123:*');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('group:456:*');
    });

    it('should do nothing when cache service unavailable', async () => {
      const serviceWithoutCache = new BaseService({}, null);
      const patterns = ['user:*', 'course:*'];

      await serviceWithoutCache.invalidateCachePatterns(...patterns);

      // No expectations - should not throw or call anything
    });

    it('should handle cache service errors gracefully', async () => {
      const cacheError = new Error('Cache invalidation error');
      mockCacheService.invalidatePattern.mockRejectedValueOnce(cacheError);

      // Should not throw - errors are handled internally
      await expect(baseService.invalidateCachePatterns('user:*')).resolves.not.toThrow();
    });

    it('should handle empty patterns array', async () => {
      await baseService.invalidateCachePatterns();

      expect(mockCacheService.invalidatePattern).not.toHaveBeenCalled();
    });
  });

  describe('deleteCacheKey', () => {
    it('should delete cache key when cache service available', async () => {
      const cacheKey = 'user:123';

      await baseService.deleteCacheKey(cacheKey);

      expect(mockCacheService.del).toHaveBeenCalledWith(cacheKey);
    });

    it('should do nothing when cache service unavailable', async () => {
      const serviceWithoutCache = new BaseService({}, null);
      const cacheKey = 'user:123';

      await serviceWithoutCache.deleteCacheKey(cacheKey);

      // No expectations - should not throw or call anything
    });

    it('should handle cache service errors gracefully', async () => {
      const cacheError = new Error('Cache deletion error');
      mockCacheService.del.mockRejectedValueOnce(cacheError);

      // Should not throw - errors are handled internally
      await expect(baseService.deleteCacheKey('user:123')).resolves.not.toThrow();
    });
  });

  describe('handleError', () => {
    it('should log error and throw it', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockError = new Error('Test error');
      const operation = 'testOperation';

      expect(() => baseService.handleError(mockError, operation)).toThrow('Test error');

      expect(consoleSpy).toHaveBeenCalledWith('BaseService:testOperation error', mockError);

      consoleSpy.mockRestore();
    });

    it('should preserve original error properties', () => {
      const originalError = new Error('Original error');
      originalError.code = 'DB_ERROR';
      originalError.statusCode = 500;

      expect(() => baseService.handleError(originalError, 'testOp')).toThrow(originalError);
    });

    it('should handle non-Error objects', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorString = 'String error';
      const operation = 'testOperation';

      expect(() => baseService.handleError(errorString, operation)).toThrow(errorString);

      expect(consoleSpy).toHaveBeenCalledWith('BaseService:testOperation error', errorString);

      consoleSpy.mockRestore();
    });
  });
});