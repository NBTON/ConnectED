const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Increase timeout for integration tests
jest.setTimeout(60000);

// Global test database instance
let mongoServer;

/**
 * Connect to the in-memory database before all tests
 */
beforeAll(async () => {
  try {
    // Use a simpler configuration for MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '6.0.14',
        skipMD5: true
      },
      instance: {
        port: 27017,
        dbName: 'testdb'
      }
    });

    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    // If MongoDB Memory Server fails, skip database tests
    console.warn('MongoDB Memory Server not available, skipping database tests');
  }
});

/**
 * Clear all test data after each test
 */
afterEach(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;

      for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
      }
    }
  } catch (error) {
    console.error('Failed to clear test data:', error);
  }
});

/**
 * Disconnect and stop the in-memory database after all tests
 */
afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }

    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (error) {
    console.error('Failed to disconnect from test database:', error);
  }
});

/**
 * Mock console methods to reduce noise in tests
 */
global.mockConsole = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
  info: jest.spyOn(console, 'info').mockImplementation(() => {}),
};

/**
 * Restore console methods after tests
 */
afterAll(() => {
  global.mockConsole.log.mockRestore();
  global.mockConsole.error.mockRestore();
  global.mockConsole.warn.mockRestore();
  global.mockConsole.info.mockRestore();
});