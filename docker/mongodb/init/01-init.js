// MongoDB initialization script for ConnectED production database
db = db.getSiblingDB('connected');

// Create collections with proper indexes
db.createCollection('users');
db.createCollection('courses');
db.createCollection('groups');
db.createCollection('groupmembers');
db.createCollection('sessions');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "createdAt": -1 });

db.courses.createIndex({ "title": 1 });
db.courses.createIndex({ "instructor": 1 });
db.courses.createIndex({ "createdAt": -1 });

db.groups.createIndex({ "name": 1 });
db.groups.createIndex({ "createdBy": 1 });
db.groups.createIndex({ "createdAt": -1 });

db.groupmembers.createIndex({ "groupId": 1, "userId": 1 }, { unique: true });
db.groupmembers.createIndex({ "userId": 1 });

// Create application user if it doesn't exist
db.users.updateOne(
  { email: "admin@connected.edu" },
  {
    $setOnInsert: {
      username: "admin",
      email: "admin@connected.edu",
      password: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi", // password
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },
  { upsert: true }
);

print("ConnectED database initialized successfully");