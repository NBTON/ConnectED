const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('./models/db_schema');

async function createTestUser() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/conect-ed', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const username = 'testuser2';
    const email = 'test3@example.com';
    const password = 'password';

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    console.log('Test user created successfully!');
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    mongoose.disconnect();
  }
}

createTestUser();