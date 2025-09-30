# ConnectED API Documentation

## Overview

ConnectED is a Node.js/Express application for managing online courses and study groups. This document outlines the refactored architecture following SOLID principles and provides comprehensive documentation for all services and controllers.

## Architecture Overview

### SOLID Principles Implementation

#### 1. Single Responsibility Principle (SRP)
- **Controllers**: Handle HTTP requests/responses only
- **Services**: Contain business logic and orchestrate operations
- **Repositories**: Handle data access operations exclusively
- **Validation**: Centralized input validation and sanitization
- **Error Handling**: Consistent error processing and responses

#### 2. Open/Closed Principle (OCP)
- **Base Classes**: Extensible base service and repository classes
- **Service Container**: Easy to add new services without modifying existing code
- **Plugin Architecture**: Services can be extended without modification

#### 3. Liskov Substitution Principle (LSP)
- **Repository Pattern**: All repositories implement consistent interface
- **Service Inheritance**: Services extend BaseService with consistent behavior
- **Error Handling**: Uniform error handling across all layers

#### 4. Interface Segregation Principle (ISP)
- **Focused Interfaces**: Each service has specific, focused responsibilities
- **Repository Methods**: Specific methods for different data operations
- **Validation Services**: Separate validation for different data types

#### 5. Dependency Inversion Principle (DIP)
- **Service Container**: Dependency injection for loose coupling
- **Repository Abstraction**: Services depend on repository interfaces
- **Configuration**: Easy to swap implementations

## Service Layer Architecture

### BaseService
Core service class providing caching, error handling, and common functionality.

**Key Methods:**
- `executeCachedOperation()` - Execute operations with caching
- `invalidateCachePatterns()` - Clear related cached data
- `handleError()` - Consistent error handling

### CourseService
Handles course-related business logic.

**Key Methods:**
- `getCourseListing()` - Get paginated course list with search
- `getCourseById()` - Retrieve single course with caching
- `createCourse()` - Create new course with validation
- `searchCourses()` - Search courses by text

### GroupService
Manages group operations and business rules.

**Key Methods:**
- `getCourseGroups()` - Get groups for a course with member info
- `createGroup()` - Create new study group
- `joinGroup()` - Join group by ID
- `joinGroupByInvite()` - Join group via invite token
- `leaveGroup()` - Leave group with ownership handling
- `removeMember()` - Remove member (owner only)
- `regenerateInvite()` - Generate new invite token

### UserService
Handles user account operations.

**Key Methods:**
- `createUser()` - Register new user account
- `authenticateUser()` - Authenticate user credentials
- `getUserProfile()` - Get user profile (without sensitive data)
- `updateProfile()` - Update user information
- `changePassword()` - Change user password

## Repository Layer Architecture

### BaseRepository
Provides common data access operations for all entities.

**Key Methods:**
- `findById()` - Find entity by ID
- `find()` - Find entities with criteria and options
- `create()` - Create new entity
- `updateById()` - Update entity by ID
- `deleteById()` - Delete entity by ID
- `aggregate()` - Execute aggregation pipelines

### Specialized Repositories

#### CourseRepository
- `findWithPagination()` - Paginated course search
- `createCourse()` - Course creation with validation

#### GroupRepository
- `findByCourseIdWithMembers()` - Groups with member information
- `createWithOwner()` - Create group with owner membership
- `findByInviteToken()` - Find group by invite token
- `regenerateInviteToken()` - Generate new invite token

#### GroupMemberRepository
- `findGroupMembersWithUsers()` - Members with user details
- `findUserGroupsWithCourses()` - User's groups with course info
- `addMember()` - Add user to group
- `removeMember()` - Remove user from group

#### UserRepository
- `findByEmail()` - Find user by email address
- `findByUsername()` - Find user by username
- `createUser()` - Create user with validation
- `searchUsers()` - Search users by term

## Controller Layer Architecture

### GroupController
Refactored from 436-line monolithic controller to focused, single-responsibility controller.

**Routes Handled:**
- `GET /courses/:courseId` - Course detail with groups
- `GET /groups/new` - New group form
- `POST /groups` - Create group
- `GET /groups/invite/:token` - Join via invite
- `POST /groups/:id/join` - Join group
- `POST /groups/:id/leave` - Leave group
- `GET /groups/:id` - Group details
- `DELETE /groups/:id/members/:userId` - Remove member
- `POST /groups/:id/regenerate-invite` - Regenerate invite
- `GET /me/groups` - User's groups

### CourseController
Handles course-related HTTP operations.

**Routes Handled:**
- `GET /courses` - Course listing with pagination
- `GET /courses/add` - Add course form
- `POST /courses` - Create course
- `GET /` - Main page
- `GET /about` - About page

## Validation System

### ValidationService
Centralized validation for all input types.

**Validation Methods:**
- `validateCourseData()` - Course creation/update validation
- `validateGroupData()` - Group creation/update validation
- `validateUserData()` - User registration/update validation
- `validatePagination()` - Pagination parameter validation
- `validateSearch()` - Search parameter validation

**Features:**
- Input sanitization
- XSS protection
- Type validation
- Range validation
- Format validation

## Error Handling System

### ErrorHandler
Consistent error handling across all layers.

**Features:**
- Standardized error responses
- Error categorization
- HTTP status code mapping
- Error logging with context
- Custom error creation

**Error Types:**
- Validation errors (400)
- Not found errors (404)
- Forbidden errors (403)
- Conflict errors (409)
- Server errors (500)

## Service Container

### Dependency Injection
The ServiceContainer implements dependency injection for loose coupling.

**Usage:**
```javascript
const serviceContainer = require('./services/ServiceContainer')
const groupService = serviceContainer.get('groupService')
```

**Registered Services:**
- `courseService` - Course business logic
- `groupService` - Group business logic
- `userService` - User business logic
- `validationService` - Input validation
- `errorHandler` - Error handling
- `cacheService` - Caching operations

## Code Metrics Improvement

### Before Refactoring
- **Group Controller**: 436 lines, multiple responsibilities
- **Course Controller**: 187 lines, mixed concerns
- **No service layer**: Business logic in controllers
- **Inconsistent error handling**: Various patterns
- **No centralized validation**: Duplicated validation logic

### After Refactoring
- **Group Controller**: 295 lines, single responsibility
- **Course Controller**: 188 lines, focused HTTP handling
- **Service Layer**: 4 dedicated services with clear responsibilities
- **Repository Layer**: 5 repositories with consistent interfaces
- **Centralized validation**: Single source of truth for validation
- **Consistent error handling**: Standardized across all layers

### Benefits Achieved
1. **Maintainability**: Clear separation of concerns
2. **Testability**: Services can be unit tested independently
3. **Extensibility**: Easy to add new features without modifying existing code
4. **Consistency**: Uniform patterns across the application
5. **Error Handling**: Reliable error processing and user feedback
6. **Performance**: Efficient caching and optimized queries
7. **Documentation**: Comprehensive JSDoc documentation

## Migration Guide

### Backward Compatibility
All existing functionality is preserved. The refactored code maintains the same:
- API endpoints
- Request/response formats
- Database schema
- User interface behavior

### New Capabilities
- Enhanced error messages
- Better input validation
- Improved caching
- Cleaner code structure
- Comprehensive documentation

## Best Practices Implemented

1. **SOLID Principles**: Full implementation across all layers
2. **Repository Pattern**: Data access abstraction
3. **Dependency Injection**: Loose coupling between components
4. **Consistent Error Handling**: Standardized error responses
5. **Input Validation**: Centralized and comprehensive validation
6. **Caching Strategy**: Intelligent caching with proper invalidation
7. **Documentation**: Extensive JSDoc comments and API documentation

## Future Enhancements

1. **Unit Testing**: Services are now easily testable in isolation
2. **API Versioning**: Easy to implement new API versions
3. **Feature Addition**: Simple to add new services and repositories
4. **Performance Monitoring**: Better structure for metrics collection
5. **Configuration Management**: Easy to swap implementations

---

*This documentation reflects the refactored architecture implementing SOLID principles and best practices for maintainable, scalable code.*