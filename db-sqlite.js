const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// Create database file in project root
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    linktoTheCall TEXT NOT NULL,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK(length(name) >= 2 AND length(name) <= 60),
    courseId INTEGER NOT NULL,
    ownerId INTEGER NOT NULL,
    description TEXT CHECK(length(description) <= 500),
    visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'private')),
    inviteToken TEXT UNIQUE NOT NULL,
    inviteTokenExpiresAt DATETIME NOT NULL,
    maxMembers INTEGER DEFAULT 25 CHECK(maxMembers >= 2 AND maxMembers <= 100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS groupMembers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    groupId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'member')),
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(groupId, userId)
  );

  CREATE INDEX IF NOT EXISTS idx_courses_title ON courses(title);
  CREATE INDEX IF NOT EXISTS idx_courses_linktoTheCall ON courses(linktoTheCall);
  CREATE INDEX IF NOT EXISTS idx_groups_courseId ON groups(courseId);
  CREATE INDEX IF NOT EXISTS idx_groups_ownerId ON groups(ownerId);
  CREATE INDEX IF NOT EXISTS idx_groups_inviteToken ON groups(inviteToken);
  CREATE INDEX IF NOT EXISTS idx_groups_courseId_name ON groups(courseId, name);
  CREATE INDEX IF NOT EXISTS idx_groupMembers_groupId ON groupMembers(groupId);
  CREATE INDEX IF NOT EXISTS idx_groupMembers_userId ON groupMembers(userId);
`);

// Helper functions
const generateInviteToken = () => crypto.randomBytes(16).toString('hex');

const getExpiryDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
};

// User model
const User = {
  create: (userData) => {
    const stmt = db.prepare('INSERT INTO users (email, password, username) VALUES (?, ?, ?)');
    const result = stmt.run(userData.email, userData.password, userData.username);
    return { _id: result.lastInsertRowid, ...userData };
  },

  findByUsername: (username) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  },

  findById: (id) => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }
};

// Course model
const Course = {
  create: (courseData) => {
    const stmt = db.prepare('INSERT INTO courses (title, linktoTheCall, image) VALUES (?, ?, ?)');
    const result = stmt.run(courseData.title, courseData.linktoTheCall, courseData.image || null);
    return { _id: result.lastInsertRowid, ...courseData };
  },

  find: (query = {}) => {
    let sql = 'SELECT * FROM courses';
    const params = [];
    
    if (query.search) {
      sql += ' WHERE title LIKE ? OR linktoTheCall LIKE ?';
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }
    
    if (query.skip) {
      sql += ' OFFSET ?';
      params.push(query.skip);
    }
    
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },

  count: (query = {}) => {
    let sql = 'SELECT COUNT(*) as count FROM courses';
    const params = [];
    
    if (query.search) {
      sql += ' WHERE title LIKE ? OR linktoTheCall LIKE ?';
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    const stmt = db.prepare(sql);
    return stmt.get(...params).count;
  },

  findById: (id) => {
    const stmt = db.prepare('SELECT * FROM courses WHERE id = ?');
    return stmt.get(id);
  }
};

// Group model
const Group = {
  create: (groupData) => {
    const inviteToken = generateInviteToken();
    const inviteTokenExpiresAt = getExpiryDate();
    
    const stmt = db.prepare(`
      INSERT INTO groups (name, courseId, ownerId, description, visibility, inviteToken, inviteTokenExpiresAt, maxMembers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      groupData.name,
      groupData.courseId,
      groupData.ownerId,
      groupData.description || null,
      groupData.visibility || 'public',
      inviteToken,
      inviteTokenExpiresAt,
      groupData.maxMembers || 25
    );
    
    return { _id: result.lastInsertRowid, ...groupData, inviteToken, inviteTokenExpiresAt };
  },

  findById: (id) => {
    const stmt = db.prepare('SELECT * FROM groups WHERE id = ?');
    return stmt.get(id);
  },

  findByCourseId: (courseId) => {
    const stmt = db.prepare(`
      SELECT g.*, 
             COUNT(gm.id) as memberCount,
             (SELECT COUNT(*) FROM groupMembers WHERE groupId = g.id AND userId = ?) as isOwner
      FROM groups g
      LEFT JOIN groupMembers gm ON g.id = gm.groupId
      WHERE g.courseId = ?
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);
    return stmt.all(0, courseId); // 0 as placeholder for userId
  },

  findByInviteToken: (token) => {
    const stmt = db.prepare('SELECT * FROM groups WHERE inviteToken = ? AND inviteTokenExpiresAt > datetime("now")');
    return stmt.get(token);
  },

  regenerateInvite: (id) => {
    const inviteToken = generateInviteToken();
    const inviteTokenExpiresAt = getExpiryDate();
    
    const stmt = db.prepare('UPDATE groups SET inviteToken = ?, inviteTokenExpiresAt = ? WHERE id = ?');
    stmt.run(inviteToken, inviteTokenExpiresAt, id);
    
    return { inviteToken, inviteTokenExpiresAt };
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM groups WHERE id = ?');
    return stmt.run(id);
  }
};

// GroupMember model
const GroupMember = {
  create: (memberData) => {
    const stmt = db.prepare('INSERT INTO groupMembers (groupId, userId, role) VALUES (?, ?, ?)');
    const result = stmt.run(memberData.groupId, memberData.userId, memberData.role || 'member');
    return { _id: result.lastInsertRowid, ...memberData };
  },

  findByGroupId: (groupId) => {
    const stmt = db.prepare(`
      SELECT gm.*, u.username, u.email
      FROM groupMembers gm
      LEFT JOIN users u ON gm.userId = u.id
      WHERE gm.groupId = ?
      ORDER BY gm.joinedAt ASC
    `);
    return stmt.all(groupId);
  },

  findByGroupAndUser: (groupId, userId) => {
    const stmt = db.prepare('SELECT * FROM groupMembers WHERE groupId = ? AND userId = ?');
    return stmt.get(groupId, userId);
  },

  findByUserId: (userId) => {
    const stmt = db.prepare(`
      SELECT gm.*, g.name as groupName, g.visibility, c.title as courseTitle, c.id as courseId
      FROM groupMembers gm
      JOIN groups g ON gm.groupId = g.id
      JOIN courses c ON g.courseId = c.id
      WHERE gm.userId = ?
      ORDER BY gm.joinedAt DESC
    `);
    return stmt.all(userId);
  },

  delete: (groupId, userId) => {
    const stmt = db.prepare('DELETE FROM groupMembers WHERE groupId = ? AND userId = ?');
    return stmt.run(groupId, userId);
  },

  countByGroupId: (groupId) => {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM groupMembers WHERE groupId = ?');
    return stmt.get(groupId).count;
  }
};

console.log('SQLite database initialized at:', dbPath);

module.exports = { User, Course, Group, GroupMember, db };