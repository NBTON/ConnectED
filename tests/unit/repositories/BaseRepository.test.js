const mongoose = require('mongoose');
const BaseRepository = require('../../../services/repositories/BaseRepository');

// Mock mongoose model for testing
const createMockModel = () => {
  const mockData = [];

  return {
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    aggregate: jest.fn(),
    save: jest.fn(),
    mockData
  };
};

// Test schema for creating mock model
const testSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const TestModel = mongoose.model('Test', testSchema);

describe('BaseRepository', () => {
  let baseRepository;
  let mockModel;

  beforeEach(() => {
    mockModel = createMockModel();
    baseRepository = new BaseRepository(TestModel);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid model', () => {
      expect(baseRepository.model).toBe(TestModel);
    });

    it('should throw error for invalid model', () => {
      expect(() => new BaseRepository(null)).toThrow('Valid mongoose model is required');
      expect(() => new BaseRepository('invalid')).toThrow('Valid mongoose model is required');
      expect(() => new BaseRepository({})).toThrow('Valid mongoose model is required');
    });
  });

  describe('findById', () => {
    it('should return entity when found', async () => {
      const mockEntity = { _id: '507f1f77bcf86cd799439011', name: 'Test Entity' };
      mockModel.findById.mockResolvedValue(mockEntity);

      const result = await baseRepository.findById('507f1f77bcf86cd799439011');

      expect(mockModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockEntity);
    });

    it('should return null when entity not found', async () => {
      mockModel.findById.mockResolvedValue(null);

      const result = await baseRepository.findById('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
    });

    it('should return null and handle error gracefully', async () => {
      const mockError = new Error('Database error');
      mockModel.findById.mockRejectedValue(mockError);

      const result = await baseRepository.findById('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
    });
  });

  describe('find', () => {
    it('should return entities with default parameters', async () => {
      const mockEntities = [
        { _id: '507f1f77bcf86cd799439011', name: 'Test Entity 1' },
        { _id: '507f1f77bcf86cd799439012', name: 'Test Entity 2' }
      ];
      mockModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockEntities)
      });

      const result = await baseRepository.find();

      expect(mockModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockEntities);
    });

    it('should apply query options correctly', async () => {
      const mockEntities = [{ name: 'Test Entity' }];
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockEntities)
      };
      mockModel.find.mockReturnValue(mockQuery);

      const criteria = { active: true };
      const options = {
        limit: 10,
        skip: 5,
        sort: { name: 1 },
        select: 'name email'
      };

      await baseRepository.find(criteria, options);

      expect(mockModel.find).toHaveBeenCalledWith(criteria);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.skip).toHaveBeenCalledWith(5);
      expect(mockQuery.sort).toHaveBeenCalledWith({ name: 1 });
      expect(mockQuery.select).toHaveBeenCalledWith('name email');
    });

    it('should return empty array on error', async () => {
      const mockError = new Error('Database error');
      mockModel.find.mockReturnValue({
        lean: jest.fn().mockRejectedValue(mockError)
      });

      const result = await baseRepository.find();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return entity when found', async () => {
      const mockEntity = { _id: '507f1f77bcf86cd799439011', name: 'Test Entity' };
      mockModel.findOne.mockResolvedValue(mockEntity);

      const result = await baseRepository.findOne({ name: 'Test Entity' });

      expect(mockModel.findOne).toHaveBeenCalledWith({ name: 'Test Entity' });
      expect(result).toEqual(mockEntity);
    });

    it('should return null when entity not found', async () => {
      mockModel.findOne.mockResolvedValue(null);

      const result = await baseRepository.findOne({ name: 'Non-existent' });

      expect(result).toBeNull();
    });

    it('should return null and handle error gracefully', async () => {
      const mockError = new Error('Database error');
      mockModel.findOne.mockRejectedValue(mockError);

      const result = await baseRepository.findOne({ name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('count', () => {
    it('should return count of matching documents', async () => {
      mockModel.countDocuments.mockResolvedValue(5);

      const result = await baseRepository.count({ active: true });

      expect(mockModel.countDocuments).toHaveBeenCalledWith({ active: true });
      expect(result).toBe(5);
    });

    it('should return 0 for empty criteria', async () => {
      mockModel.countDocuments.mockResolvedValue(0);

      const result = await baseRepository.count();

      expect(mockModel.countDocuments).toHaveBeenCalledWith({});
      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      const mockError = new Error('Database error');
      mockModel.countDocuments.mockRejectedValue(mockError);

      const result = await baseRepository.count({ active: true });

      expect(result).toBe(0);
    });
  });

  describe('create', () => {
    it('should create and return new entity', async () => {
      const entityData = { name: 'New Entity', email: 'test@example.com' };
      const savedEntity = { _id: '507f1f77bcf86cd799439011', ...entityData };

      const mockSave = jest.fn().mockResolvedValue(savedEntity);
      const mockEntity = {
        ...entityData,
        save: mockSave
      };

      // Mock the constructor to return our mock entity
      const originalModel = baseRepository.model;
      baseRepository.model = jest.fn().mockImplementation((data) => ({
        ...data,
        save: mockSave
      }));

      const result = await baseRepository.create(entityData);

      expect(result).toEqual(savedEntity);
      expect(baseRepository.model).toHaveBeenCalledWith(entityData);
    });

    it('should throw error when creation fails', async () => {
      const entityData = { name: 'New Entity' };
      const mockError = new Error('Validation error');

      const mockSave = jest.fn().mockRejectedValue(mockError);
      const mockEntity = {
        ...entityData,
        save: mockSave
      };

      // Mock the constructor to return our mock entity
      const originalModel = baseRepository.model;
      baseRepository.model = jest.fn().mockImplementation((data) => ({
        ...data,
        save: mockSave
      }));

      await expect(baseRepository.create(entityData)).rejects.toThrow('Validation error');
    });
  });

  describe('updateById', () => {
    it('should update and return entity', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedEntity = { _id: '507f1f77bcf86cd799439011', name: 'Updated Name' };
      mockModel.findByIdAndUpdate.mockResolvedValue(updatedEntity);

      const result = await baseRepository.updateById('507f1f77bcf86cd799439011', updateData);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        updateData,
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedEntity);
    });

    it('should return null when entity not found', async () => {
      mockModel.findByIdAndUpdate.mockResolvedValue(null);

      const result = await baseRepository.updateById('507f1f77bcf86cd799439011', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should return null and handle error gracefully', async () => {
      const mockError = new Error('Database error');
      mockModel.findByIdAndUpdate.mockRejectedValue(mockError);

      const result = await baseRepository.updateById('507f1f77bcf86cd799439011', { name: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('should return true when entity is deleted', async () => {
      const deletedEntity = { _id: '507f1f77bcf86cd799439011', name: 'Deleted Entity' };
      mockModel.findByIdAndDelete.mockResolvedValue(deletedEntity);

      const result = await baseRepository.deleteById('507f1f77bcf86cd799439011');

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toBe(true);
    });

    it('should return false when entity not found', async () => {
      mockModel.findByIdAndDelete.mockResolvedValue(null);

      const result = await baseRepository.deleteById('507f1f77bcf86cd799439011');

      expect(result).toBe(false);
    });

    it('should return false and handle error gracefully', async () => {
      const mockError = new Error('Database error');
      mockModel.findByIdAndDelete.mockRejectedValue(mockError);

      const result = await baseRepository.deleteById('507f1f77bcf86cd799439011');

      expect(result).toBe(false);
    });
  });

  describe('aggregate', () => {
    it('should return aggregation results', async () => {
      const pipeline = [{ $match: { active: true } }];
      const mockResults = [{ count: 5 }, { count: 3 }];
      mockModel.aggregate.mockResolvedValue(mockResults);

      const result = await baseRepository.aggregate(pipeline);

      expect(mockModel.aggregate).toHaveBeenCalledWith(pipeline);
      expect(result).toEqual(mockResults);
    });

    it('should return empty array on error', async () => {
      const pipeline = [{ $match: { active: true } }];
      const mockError = new Error('Aggregation error');
      mockModel.aggregate.mockRejectedValue(mockError);

      const result = await baseRepository.aggregate(pipeline);

      expect(result).toEqual([]);
    });
  });

  describe('handleError', () => {
    it('should log error and throw it', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockError = new Error('Test error');
      const operation = 'testOperation';

      expect(() => baseRepository.handleError(mockError, operation)).toThrow('Test error');

      expect(consoleSpy).toHaveBeenCalledWith('BaseRepository:testOperation error', mockError);

      consoleSpy.mockRestore();
    });
  });

  describe('toObjectId', () => {
    it('should convert valid string ID to ObjectId', () => {
      const validId = '507f1f77bcf86cd799439011';
      const result = baseRepository.toObjectId(validId);

      expect(result).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(result.toString()).toBe(validId);
    });

    it('should return string if not a valid ObjectId', () => {
      const invalidId = 'invalid-id';
      const result = baseRepository.toObjectId(invalidId);

      expect(result).toBe(invalidId);
    });

    it('should return ObjectId if already an ObjectId', () => {
      const objectId = new mongoose.Types.ObjectId();
      const result = baseRepository.toObjectId(objectId);

      expect(result).toBe(objectId);
    });
  });
});