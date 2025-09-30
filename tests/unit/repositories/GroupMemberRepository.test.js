const GroupMemberRepository = require('../../../services/repositories/GroupMemberRepository');
const BaseRepository = require('../../../services/repositories/BaseRepository');

// Mock the models
jest.mock('../../../models/db_schema', () => ({
  GroupMember: jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', ...data })
  })),
  User: jest.fn(),
  Group: jest.fn(),
  Course: jest.fn()
}));

// Mock BaseRepository methods
jest.mock('../../../services/repositories/BaseRepository');

describe('GroupMemberRepository', () => {
  let groupMemberRepository;
  let mockBaseRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    groupMemberRepository = new GroupMemberRepository();
    mockBaseRepository = BaseRepository.mock.instances[BaseRepository.mock.instances.length - 1];
  });

  describe('constructor', () => {
    it('should initialize with GroupMember model', () => {
      expect(BaseRepository).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('findGroupMembersWithUsers', () => {
    it('should return members with user details successfully', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const mockMembers = [
        { _id: '507f1f77bcf86cd799439012', userId: '507f1f77bcf86cd799439013', role: 'member' },
        { _id: '507f1f77bcf86cd799439014', userId: '507f1f77bcf86cd799439015', role: 'admin' }
      ];
      const mockUsers = [
        { _id: '507f1f77bcf86cd799439013', username: 'user1', email: 'user1@example.com' },
        { _id: '507f1f77bcf86cd799439015', username: 'user2', email: 'user2@example.com' }
      ];

      const mockUserModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers)
        })
      };

      jest.doMock('../../../models/db_schema', () => ({
        GroupMember: {},
        User: mockUserModel
      }));

      mockBaseRepository.find.mockResolvedValue(mockMembers);

      const result = await groupMemberRepository.findGroupMembersWithUsers(groupId);

      expect(mockBaseRepository.find).toHaveBeenCalledWith(
        { groupId },
        { sort: { joinedAt: 1 } }
      );
      expect(mockUserModel.find).toHaveBeenCalledWith({
        _id: { $in: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439015'] }
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...mockMembers[0],
        user: mockUsers[0]
      });
      expect(result[1]).toEqual({
        ...mockMembers[1],
        user: mockUsers[1]
      });
    });

    it('should return empty array for group with no members', async () => {
      const groupId = '507f1f77bcf86cd799439011';

      mockBaseRepository.find.mockResolvedValue([]);

      const result = await groupMemberRepository.findGroupMembersWithUsers(groupId);

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      mockBaseRepository.find.mockRejectedValue(mockError);

      const result = await groupMemberRepository.findGroupMembersWithUsers(groupId);

      expect(result).toEqual([]);
    });
  });

  describe('findUserGroupsWithCourses', () => {
    it('should return user groups with course details successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockAggregationResult = [
        {
          _id: '507f1f77bcf86cd799439012',
          group: { _id: '507f1f77bcf86cd799439012', name: 'Test Group' },
          course: { _id: '507f1f77bcf86cd799439013', title: 'Test Course' },
          role: 'member',
          memberCount: 5
        }
      ];

      mockBaseRepository.aggregate.mockResolvedValue(mockAggregationResult);
      mockBaseRepository.toObjectId.mockReturnValue(userId);

      const result = await groupMemberRepository.findUserGroupsWithCourses(userId);

      expect(mockBaseRepository.toObjectId).toHaveBeenCalledWith(userId);
      expect(mockBaseRepository.aggregate).toHaveBeenCalledWith([
        { $match: { userId: userId } },
        {
          $lookup: {
            from: 'groups',
            localField: 'groupId',
            foreignField: '_id',
            as: 'group'
          }
        },
        { $unwind: '$group' },
        {
          $lookup: {
            from: 'subjects',
            localField: 'group.courseId',
            foreignField: '_id',
            as: 'course'
          }
        },
        { $unwind: '$course' },
        {
          $group: {
            _id: '$groupId',
            group: { $first: '$group' },
            course: { $first: '$course' },
            role: { $first: '$role' },
            memberCount: { $sum: 1 }
          }
        },
        {
          $project: {
            group: 1,
            course: 1,
            memberCount: 1,
            role: 1
          }
        },
        { $sort: { 'group.createdAt': -1 } }
      ]);
      expect(result).toEqual(mockAggregationResult);
    });

    it('should return empty array on error', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      mockBaseRepository.aggregate.mockRejectedValue(mockError);

      const result = await groupMemberRepository.findUserGroupsWithCourses(userId);

      expect(result).toEqual([]);
    });
  });

  describe('findMembership', () => {
    it('should find membership successfully', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockMembership = {
        _id: '507f1f77bcf86cd799439013',
        groupId,
        userId,
        role: 'member'
      };

      mockBaseRepository.findOne.mockResolvedValue(mockMembership);

      const result = await groupMemberRepository.findMembership(groupId, userId);

      expect(mockBaseRepository.findOne).toHaveBeenCalledWith({ groupId, userId });
      expect(result).toEqual(mockMembership);
    });

    it('should return null when membership not found', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';

      mockBaseRepository.findOne.mockResolvedValue(null);

      const result = await groupMemberRepository.findMembership(groupId, userId);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockError = new Error('Database error');

      mockBaseRepository.findOne.mockRejectedValue(mockError);

      const result = await groupMemberRepository.findMembership(groupId, userId);

      expect(result).toBeNull();
    });
  });

  describe('countGroupMembers', () => {
    it('should return member count successfully', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const memberCount = 5;

      mockBaseRepository.count.mockResolvedValue(memberCount);

      const result = await groupMemberRepository.countGroupMembers(groupId);

      expect(mockBaseRepository.count).toHaveBeenCalledWith({ groupId });
      expect(result).toBe(memberCount);
    });

    it('should return 0 on error', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      mockBaseRepository.count.mockRejectedValue(mockError);

      const result = await groupMemberRepository.countGroupMembers(groupId);

      expect(result).toBe(0);
    });
  });

  describe('addMember', () => {
    it('should add member successfully', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const role = 'admin';
      const createdMembership = {
        _id: '507f1f77bcf86cd799439013',
        groupId,
        userId,
        role,
        joinedAt: expect.any(Date)
      };

      mockBaseRepository.create.mockResolvedValue(createdMembership);

      const result = await groupMemberRepository.addMember(groupId, userId, role);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        groupId,
        userId,
        role,
        joinedAt: expect.any(Date)
      });
      expect(result).toEqual(createdMembership);
    });

    it('should use default role when not provided', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';

      mockBaseRepository.create.mockResolvedValue({});

      await groupMemberRepository.addMember(groupId, userId);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        groupId,
        userId,
        role: 'member',
        joinedAt: expect.any(Date)
      });
    });

    it('should handle and rethrow creation errors', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockError = new Error('Database error');

      mockBaseRepository.create.mockRejectedValue(mockError);

      await expect(groupMemberRepository.addMember(groupId, userId))
        .rejects.toThrow('Database error');
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const deletedMembership = {
        _id: '507f1f77bcf86cd799439013',
        groupId,
        userId,
        role: 'member'
      };

      // Mock the model directly for findOneAndDelete
      const mockModel = {
        findOneAndDelete: jest.fn().mockResolvedValue(deletedMembership)
      };

      groupMemberRepository.model = mockModel;

      const result = await groupMemberRepository.removeMember(groupId, userId);

      expect(mockModel.findOneAndDelete).toHaveBeenCalledWith({ groupId, userId });
      expect(result).toBe(true);
    });

    it('should return false when member not found', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';

      const mockModel = {
        findOneAndDelete: jest.fn().mockResolvedValue(null)
      };

      groupMemberRepository.model = mockModel;

      const result = await groupMemberRepository.removeMember(groupId, userId);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockError = new Error('Database error');

      const mockModel = {
        findOneAndDelete: jest.fn().mockRejectedValue(mockError)
      };

      groupMemberRepository.model = mockModel;

      const result = await groupMemberRepository.removeMember(groupId, userId);

      expect(result).toBe(false);
    });
  });

  describe('getMemberCounts', () => {
    it('should return member counts for groups successfully', async () => {
      const groupIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
      const mockAggregationResult = [
        { _id: '507f1f77bcf86cd799439011', count: 5 },
        { _id: '507f1f77bcf86cd799439012', count: 3 }
      ];
      const expectedCountMap = {
        '507f1f77bcf86cd799439011': 5,
        '507f1f77bcf86cd799439012': 3
      };

      mockBaseRepository.aggregate.mockResolvedValue(mockAggregationResult);
      mockBaseRepository.toObjectId.mockImplementation((id) => id);

      const result = await groupMemberRepository.getMemberCounts(groupIds);

      expect(mockBaseRepository.toObjectId).toHaveBeenCalledTimes(2);
      expect(mockBaseRepository.aggregate).toHaveBeenCalledWith([
        { $match: { groupId: { $in: groupIds } } },
        { $group: { _id: '$groupId', count: { $sum: 1 } } }
      ]);
      expect(result).toEqual(expectedCountMap);
    });

    it('should return empty object for empty groupIds', async () => {
      const result = await groupMemberRepository.getMemberCounts([]);

      expect(result).toEqual({});
      expect(mockBaseRepository.aggregate).not.toHaveBeenCalled();
    });

    it('should return empty object on error', async () => {
      const groupIds = ['507f1f77bcf86cd799439011'];
      const mockError = new Error('Database error');

      mockBaseRepository.aggregate.mockRejectedValue(mockError);

      const result = await groupMemberRepository.getMemberCounts(groupIds);

      expect(result).toEqual({});
    });
  });

  describe('findOwnerMembership', () => {
    it('should find owner membership successfully', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const mockOwnerMembership = {
        _id: '507f1f77bcf86cd799439012',
        groupId,
        userId: '507f1f77bcf86cd799439013',
        role: 'owner'
      };

      mockBaseRepository.findOne.mockResolvedValue(mockOwnerMembership);

      const result = await groupMemberRepository.findOwnerMembership(groupId);

      expect(mockBaseRepository.findOne).toHaveBeenCalledWith({ groupId, role: 'owner' });
      expect(result).toEqual(mockOwnerMembership);
    });

    it('should return null when owner not found', async () => {
      const groupId = '507f1f77bcf86cd799439011';

      mockBaseRepository.findOne.mockResolvedValue(null);

      const result = await groupMemberRepository.findOwnerMembership(groupId);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      mockBaseRepository.findOne.mockRejectedValue(mockError);

      const result = await groupMemberRepository.findOwnerMembership(groupId);

      expect(result).toBeNull();
    });
  });
});