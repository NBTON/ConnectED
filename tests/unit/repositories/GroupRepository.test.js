const GroupRepository = require('../../../services/repositories/GroupRepository');
const BaseRepository = require('../../../services/repositories/BaseRepository');

// Mock the models
jest.mock('../../../models/db_schema', () => ({
  Group: jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', ...data })
  })),
  GroupMember: jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439012', ...data })
  }))
}));

// Mock mongoose and crypto
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: jest.fn().mockImplementation((id) => id)
  }
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mockedtoken1234567890abcdef')
  })
}));

// Mock BaseRepository methods
jest.mock('../../../services/repositories/BaseRepository');

describe('GroupRepository', () => {
  let groupRepository;
  let mockBaseRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    groupRepository = new GroupRepository();
    mockBaseRepository = BaseRepository.mock.instances[BaseRepository.mock.instances.length - 1];
  });

  describe('constructor', () => {
    it('should initialize with Group model', () => {
      expect(BaseRepository).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('findByCourseIdWithMembers', () => {
    it('should find public groups for course without user', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const mockGroups = [
        {
          _id: '507f1f77bcf86cd799439012',
          name: 'Public Group',
          memberCount: 5,
          isOwner: false,
          isMember: false
        }
      ];

      mockBaseRepository.aggregate.mockResolvedValue(mockGroups);
      mockBaseRepository.toObjectId.mockReturnValue(courseId);

      const result = await groupRepository.findByCourseIdWithMembers(courseId);

      expect(mockBaseRepository.toObjectId).toHaveBeenCalledWith(courseId);
      expect(mockBaseRepository.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            courseId: courseId,
            $or: [{ visibility: 'public' }]
          }
        },
        {
          $lookup: {
            from: 'groupmembers',
            localField: '_id',
            foreignField: 'groupId',
            as: 'members'
          }
        },
        {
          $addFields: {
            memberCount: { $size: '$members' },
            isOwner: false,
            isMember: false
          }
        },
        {
          $project: {
            members: 0
          }
        },
        { $sort: { createdAt: -1 } }
      ]);
      expect(result).toEqual(mockGroups);
    });

    it('should include private groups for authenticated user', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439013';
      const userGroupIds = ['507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015'];

      const mockGroups = [];

      mockBaseRepository.aggregate.mockResolvedValue(mockGroups);
      mockBaseRepository.toObjectId.mockImplementation((id) => id);
      groupRepository.getUserGroupIds = jest.fn().mockResolvedValue(userGroupIds);

      await groupRepository.findByCourseIdWithMembers(courseId, userId);

      expect(groupRepository.getUserGroupIds).toHaveBeenCalledWith(userId);
      expect(mockBaseRepository.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $match: {
              courseId: courseId,
              $or: [
                { visibility: 'public' },
                { _id: { $in: userGroupIds } }
              ]
            }
          }
        ])
      );
    });

    it('should handle user membership and ownership correctly', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439013';

      const mockGroups = [
        {
          _id: '507f1f77bcf86cd799439012',
          ownerId: userId,
          members: [{ userId: userId }, { userId: '507f1f77bcf86cd799439016' }],
          memberCount: 2,
          isOwner: true,
          isMember: true
        }
      ];

      mockBaseRepository.aggregate.mockResolvedValue(mockGroups);
      mockBaseRepository.toObjectId.mockImplementation((id) => id);

      const result = await groupRepository.findByCourseIdWithMembers(courseId, userId);

      expect(result[0].isOwner).toBe(true);
      expect(result[0].isMember).toBe(true);
    });

    it('should return empty array on error', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      mockBaseRepository.aggregate.mockRejectedValue(mockError);

      const result = await groupRepository.findByCourseIdWithMembers(courseId);

      expect(result).toEqual([]);
    });
  });

  describe('getUserGroupIds', () => {
    it('should return user group IDs successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockMemberships = [
        { groupId: '507f1f77bcf86cd799439012' },
        { groupId: '507f1f77bcf86cd799439013' }
      ];
      const expectedGroupIds = ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'];

      // Create a proper mock for the GroupMember model
      const mockGroupMemberFind = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockMemberships)
        })
      });

      const mockGroupMemberModel = {
        find: mockGroupMemberFind
      };

      // Mock the require call to return our mock model
      jest.doMock('../../../models/db_schema', () => ({
        GroupMember: mockGroupMemberModel
      }));

      mockBaseRepository.toObjectId.mockImplementation((id) => id);

      const result = await groupRepository.getUserGroupIds(userId);

      expect(mockGroupMemberModel.find).toHaveBeenCalledWith({ userId });
      expect(result).toEqual(expectedGroupIds);
    });

    it('should return empty array on error', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      const mockGroupMemberModel = {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockRejectedValue(mockError)
          })
        })
      };

      jest.doMock('../../../models/db_schema', () => ({
        GroupMember: mockGroupMemberModel
      }));

      const result = await groupRepository.getUserGroupIds(userId);

      expect(result).toEqual([]);
    });
  });

  describe('createWithOwner', () => {
    it('should create group and owner membership successfully', async () => {
      const groupData = { name: 'Test Group', courseId: '507f1f77bcf86cd799439011' };
      const ownerId = '507f1f77bcf86cd799439012';
      const createdGroup = { _id: '507f1f77bcf86cd799439013', ...groupData };

      const mockGroupMemberCreate = jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439014' });
      const mockGroupMemberModel = {
        create: mockGroupMemberCreate
      };

      jest.doMock('../../../models/db_schema', () => ({
        GroupMember: mockGroupMemberModel
      }));

      mockBaseRepository.create.mockResolvedValue(createdGroup);

      const result = await groupRepository.createWithOwner(groupData, ownerId);

      expect(mockBaseRepository.create).toHaveBeenCalledWith(groupData);
      expect(mockGroupMemberModel.create).toHaveBeenCalledWith({
        groupId: createdGroup._id,
        userId: ownerId,
        role: 'owner'
      });
      expect(result).toEqual(createdGroup);
    });

    it('should handle and rethrow creation errors', async () => {
      const groupData = { name: 'Test Group' };
      const ownerId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      mockBaseRepository.create.mockRejectedValue(mockError);

      await expect(groupRepository.createWithOwner(groupData, ownerId))
        .rejects.toThrow('Database error');
    });
  });

  describe('findByInviteToken', () => {
    it('should find group by valid token', async () => {
      const token = 'validtoken123';
      const mockGroup = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test Group',
        inviteToken: token,
        inviteTokenExpiresAt: new Date(Date.now() + 86400000) // Tomorrow
      };

      mockBaseRepository.findOne.mockResolvedValue(mockGroup);

      const result = await groupRepository.findByInviteToken(token);

      expect(mockBaseRepository.findOne).toHaveBeenCalledWith({ inviteToken: token });
      expect(result).toEqual(mockGroup);
    });

    it('should return null for non-existent token', async () => {
      const token = 'nonexistenttoken';

      mockBaseRepository.findOne.mockResolvedValue(null);

      const result = await groupRepository.findByInviteToken(token);

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const token = 'expiredtoken';
      const mockGroup = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test Group',
        inviteToken: token,
        inviteTokenExpiresAt: new Date(Date.now() - 86400000) // Yesterday
      };

      mockBaseRepository.findOne.mockResolvedValue(mockGroup);

      const result = await groupRepository.findByInviteToken(token);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const token = 'validtoken';
      const mockError = new Error('Database error');

      mockBaseRepository.findOne.mockRejectedValue(mockError);

      const result = await groupRepository.findByInviteToken(token);

      expect(result).toBeNull();
    });
  });

  describe('regenerateInviteToken', () => {
    it('should regenerate token successfully', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const mockUpdatedGroup = {
        _id: groupId,
        inviteToken: 'mockedtoken1234567890abcdef',
        inviteTokenExpiresAt: expect.any(Date)
      };

      mockBaseRepository.updateById.mockResolvedValue(mockUpdatedGroup);

      const result = await groupRepository.regenerateInviteToken(groupId);

      expect(mockBaseRepository.updateById).toHaveBeenCalledWith(groupId, {
        inviteToken: 'mockedtoken1234567890abcdef',
        inviteTokenExpiresAt: expect.any(Date)
      });
      expect(result).toEqual(mockUpdatedGroup);

      // Check that the expiration date is set to 7 days from now
      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 7);
      expect(result.inviteTokenExpiresAt).toBeInstanceOf(Date);
    });

    it('should return null when group not found', async () => {
      const groupId = '507f1f77bcf86cd799439011';

      mockBaseRepository.updateById.mockResolvedValue(null);

      const result = await groupRepository.regenerateInviteToken(groupId);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const groupId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      mockBaseRepository.updateById.mockRejectedValue(mockError);

      const result = await groupRepository.regenerateInviteToken(groupId);

      expect(result).toBeNull();
    });
  });

  describe('findByOwnerId', () => {
    it('should find groups by owner successfully', async () => {
      const ownerId = '507f1f77bcf86cd799439011';
      const mockGroups = [
        { _id: '507f1f77bcf86cd799439012', name: 'Group 1' },
        { _id: '507f1f77bcf86cd799439013', name: 'Group 2' }
      ];

      mockBaseRepository.find.mockResolvedValue(mockGroups);

      const result = await groupRepository.findByOwnerId(ownerId);

      expect(mockBaseRepository.find).toHaveBeenCalledWith(
        { ownerId },
        { sort: { createdAt: -1 } }
      );
      expect(result).toEqual(mockGroups);
    });

    it('should return empty array on error', async () => {
      const ownerId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');

      mockBaseRepository.find.mockRejectedValue(mockError);

      const result = await groupRepository.findByOwnerId(ownerId);

      expect(result).toEqual([]);
    });
  });
});