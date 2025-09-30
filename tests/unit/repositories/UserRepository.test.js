const UserRepository = require('../../../services/repositories/UserRepository');
const BaseRepository = require('../../../services/repositories/BaseRepository');

// Mock the User model
jest.mock('../../../models/db_schema', () => ({
  User: jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', ...data })
  }))
}));

// Mock BaseRepository methods
jest.mock('../../../services/repositories/BaseRepository');

describe('UserRepository', () => {
  let userRepository;
  let mockBaseRepository;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create new instance for each test
    userRepository = new UserRepository();

    // Get the mock instance of BaseRepository
    mockBaseRepository = BaseRepository.mock.instances[BaseRepository.mock.instances.length - 1];
  });

  describe('constructor', () => {
    it('should initialize with User model', () => {
      expect(BaseRepository).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      const mockUser = { _id: '507f1f77bcf86cd799439011', email: 'test@example.com' };
      mockBaseRepository.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('test@example.com');

      expect(mockBaseRepository.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockBaseRepository.findOne.mockResolvedValue(null);

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should return null and handle error gracefully', async () => {
      const mockError = new Error('Database error');
      mockBaseRepository.findOne.mockRejectedValue(mockError);

      const result = await userRepository.findByEmail('test@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username successfully', async () => {
      const mockUser = { _id: '507f1f77bcf86cd799439011', username: 'testuser' };
      mockBaseRepository.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByUsername('testuser');

      expect(mockBaseRepository.findOne).toHaveBeenCalledWith({ username: 'testuser' });
      expect(result).toEqual(mockUser);
    });

    it('should return null when username not found', async () => {
      mockBaseRepository.findOne.mockResolvedValue(null);

      const result = await userRepository.findByUsername('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null and handle error gracefully', async () => {
      const mockError = new Error('Database error');
      mockBaseRepository.findOne.mockRejectedValue(mockError);

      const result = await userRepository.findByUsername('testuser');

      expect(result).toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should return empty array for empty userIds', async () => {
      const result = await userRepository.findByIds([]);

      expect(result).toEqual([]);
      expect(mockBaseRepository.find).not.toHaveBeenCalled();
    });

    it('should find users by IDs successfully', async () => {
      const userIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
      const mockUsers = [
        { _id: userIds[0], username: 'user1' },
        { _id: userIds[1], username: 'user2' }
      ];

      mockBaseRepository.find.mockResolvedValue(mockUsers);
      mockBaseRepository.toObjectId.mockImplementation(id => id);

      const result = await userRepository.findByIds(userIds);

      expect(mockBaseRepository.toObjectId).toHaveBeenCalledTimes(2);
      expect(mockBaseRepository.find).toHaveBeenCalledWith({
        _id: { $in: userIds }
      });
      expect(result).toEqual(mockUsers);
    });

    it('should return empty array on error', async () => {
      const userIds = ['507f1f77bcf86cd799439011'];
      const mockError = new Error('Database error');

      mockBaseRepository.find.mockRejectedValue(mockError);

      const result = await userRepository.findByIds(userIds);

      expect(result).toEqual([]);
    });
  });

  describe('createUser', () => {
    it('should create user successfully with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword'
      };
      const createdUser = { _id: '507f1f77bcf86cd799439011', ...userData };

      // Mock the base repository methods
      mockBaseRepository.findOne
        .mockResolvedValueOnce(null) // No existing email
        .mockResolvedValueOnce(null); // No existing username
      mockBaseRepository.create.mockResolvedValue(createdUser);

      const result = await userRepository.createUser(userData);

      expect(mockBaseRepository.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(mockBaseRepository.findOne).toHaveBeenCalledWith({ username: userData.username });
      expect(mockBaseRepository.create).toHaveBeenCalledWith(userData);
      expect(result).toEqual(createdUser);
    });

    it('should throw error for missing required fields', async () => {
      await expect(userRepository.createUser({ email: 'test@example.com' }))
        .rejects.toThrow('Email, username, and password are required');

      await expect(userRepository.createUser({ username: 'testuser' }))
        .rejects.toThrow('Email, username, and password are required');

      await expect(userRepository.createUser({ password: 'password' }))
        .rejects.toThrow('Email, username, and password are required');
    });

    it('should throw error when email already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        username: 'testuser',
        password: 'hashedpassword'
      };
      const existingUser = { _id: '507f1f77bcf86cd799439011', email: userData.email };

      mockBaseRepository.findOne.mockResolvedValueOnce(existingUser);

      await expect(userRepository.createUser(userData))
        .rejects.toThrow('Email already exists');

      expect(mockBaseRepository.findOne).toHaveBeenCalledWith({ email: userData.email });
    });

    it('should throw error when username already exists', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'existinguser',
        password: 'hashedpassword'
      };
      const existingUser = { _id: '507f1f77bcf86cd799439011', username: userData.username };

      mockBaseRepository.findOne
        .mockResolvedValueOnce(null) // No existing email
        .mockResolvedValueOnce(existingUser); // Existing username

      await expect(userRepository.createUser(userData))
        .rejects.toThrow('Username already exists');
    });

    it('should handle and rethrow creation errors', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword'
      };
      const mockError = new Error('Database error');

      mockBaseRepository.findOne.mockResolvedValue(null);
      mockBaseRepository.create.mockRejectedValue(mockError);

      await expect(userRepository.createUser(userData)).rejects.toThrow('Database error');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const updateData = {
        firstName: 'John',
        lastName: 'Doe',
        password: 'should-be-removed',
        _id: 'should-be-removed',
        __v: 'should-be-removed'
      };
      const expectedUpdateData = { firstName: 'John', lastName: 'Doe' };
      const updatedUser = { _id: userId, ...expectedUpdateData };

      mockBaseRepository.updateById.mockResolvedValue(updatedUser);

      const result = await userRepository.updateProfile(userId, updateData);

      expect(mockBaseRepository.updateById).toHaveBeenCalledWith(userId, expectedUpdateData);
      expect(result).toEqual(updatedUser);
    });

    it('should return null when user not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const updateData = { firstName: 'John' };

      mockBaseRepository.updateById.mockResolvedValue(null);

      const result = await userRepository.updateProfile(userId, updateData);

      expect(result).toBeNull();
    });

    it('should return null and handle error gracefully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const updateData = { firstName: 'John' };
      const mockError = new Error('Database error');

      mockBaseRepository.updateById.mockRejectedValue(mockError);

      const result = await userRepository.updateProfile(userId, updateData);

      expect(result).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update user password successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const hashedPassword = 'newhashedpassword';
      const updatedUser = { _id: userId, password: hashedPassword };

      mockBaseRepository.updateById.mockResolvedValue(updatedUser);

      const result = await userRepository.updatePassword(userId, hashedPassword);

      expect(mockBaseRepository.updateById).toHaveBeenCalledWith(userId, { password: hashedPassword });
      expect(result).toEqual(updatedUser);
    });

    it('should return null when user not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const hashedPassword = 'newhashedpassword';

      mockBaseRepository.updateById.mockResolvedValue(null);

      const result = await userRepository.updatePassword(userId, hashedPassword);

      expect(result).toBeNull();
    });

    it('should return null and handle error gracefully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const hashedPassword = 'newhashedpassword';
      const mockError = new Error('Database error');

      mockBaseRepository.updateById.mockRejectedValue(mockError);

      const result = await userRepository.updatePassword(userId, hashedPassword);

      expect(result).toBeNull();
    });
  });

  describe('searchUsers', () => {
    it('should return empty array for short search term', async () => {
      const result = await userRepository.searchUsers('a');

      expect(result).toEqual([]);
      expect(mockBaseRepository.find).not.toHaveBeenCalled();
    });

    it('should return empty array for empty search term', async () => {
      const result = await userRepository.searchUsers('');

      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only search term', async () => {
      const result = await userRepository.searchUsers('   ');

      expect(result).toEqual([]);
    });

    it('should search users successfully', async () => {
      const searchTerm = 'test';
      const mockUsers = [
        { username: 'testuser1', email: 'test1@example.com' },
        { username: 'testuser2', email: 'test2@example.com' }
      ];

      mockBaseRepository.find.mockResolvedValue(mockUsers);

      const result = await userRepository.searchUsers(searchTerm, 5);

      expect(mockBaseRepository.find).toHaveBeenCalledWith(
        {
          $or: [
            { username: { $regex: new RegExp('test', 'i') } },
            { email: { $regex: new RegExp('test', 'i') } }
          ]
        },
        {
          limit: 5,
          select: 'username email'
        }
      );
      expect(result).toEqual(mockUsers);
    });

    it('should use default limit when not provided', async () => {
      const searchTerm = 'test';
      const mockUsers = [];

      mockBaseRepository.find.mockResolvedValue(mockUsers);

      await userRepository.searchUsers(searchTerm);

      expect(mockBaseRepository.find).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          limit: 10,
          select: 'username email'
        })
      );
    });

    it('should return empty array on error', async () => {
      const searchTerm = 'test';
      const mockError = new Error('Database error');

      mockBaseRepository.find.mockRejectedValue(mockError);

      const result = await userRepository.searchUsers(searchTerm);

      expect(result).toEqual([]);
    });

    it('should trim search term and create case-insensitive regex', async () => {
      const searchTerm = '  Test User  ';
      const mockUsers = [];

      mockBaseRepository.find.mockResolvedValue(mockUsers);

      await userRepository.searchUsers(searchTerm);

      expect(mockBaseRepository.find).toHaveBeenCalledWith(
        {
          $or: [
            { username: { $regex: new RegExp('Test User', 'i') } },
            { email: { $regex: new RegExp('Test User', 'i') } }
          ]
        },
        expect.any(Object)
      );
    });
  });
});