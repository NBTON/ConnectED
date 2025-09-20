const {
  registerUser,
  loginUser,
  logoutUser,
  renderRegister,
  renderLogin
} = require('../../controllers/user_controller');

const User = require('../../models/db_schema').User;
const bcrypt = require('bcrypt');
const { generateToken } = require('../../middleware/auth');

jest.mock('../../models/db_schema');
jest.mock('bcrypt');
jest.mock('../../middleware/auth');

describe('User Controller Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      session: {},
      params: {}
    };
    res = {
      redirect: jest.fn(),
      render: jest.fn(),
      cookie: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('renderRegister', () => {
    it('should render register template with title', () => {
      renderRegister(req, res);
      expect(res.render).toHaveBeenCalledWith('register.njk', { title: 'Register' });
    });
  });

  describe('renderLogin', () => {
    it('should render login template with title', () => {
      renderLogin(req, res);
      expect(res.render).toHaveBeenCalledWith('login.njk', { title: 'Login' });
    });
  });

  describe('registerUser', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        confirmPassword: 'password123'
      };
      bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword');
      generateToken.mockReturnValue('mocktoken');
      User.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({ _id: 'user123', email: 'test@example.com', username: 'testuser' })
      }));
    });

    it('should register user successfully and redirect', async () => {
      await registerUser(req, res);
      
      expect(bcrypt.hash).toHaveBeenCalledWith('password123'.trim(), 10);
      expect(User).toHaveBeenCalledWith({
        email: 'test@example.com'.trim(),
        username: 'testuser'.trim(),
        password: '$2b$10$hashedpassword'
      });
      expect(req.session.userId).toBe('user123');
      expect(req.session.username).toBe('testuser');
      expect(req.session.userEmail).toBe('test@example.com');
      expect(req.session.flash).toEqual({ type: 'success', message: 'Account created. Welcome!' });
      expect(res.cookie).toHaveBeenCalledWith('token', 'mocktoken', { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 });
      expect(res.redirect).toHaveBeenCalledWith('/courses');
    });

    it('should validate missing fields', async () => {
      req.body = { email: '', username: '', password: '', confirmPassword: '' };
      
      await registerUser(req, res);
      
      expect(req.session.flash).toEqual({
        type: 'error',
        message: 'Please fix the errors below.',
        errors: {
          email: 'Email is required.',
          username: 'Username is required.',
          password: 'Password is required.',
          confirmPassword: 'Confirm your password.'
        }
      });
      expect(res.redirect).toHaveBeenCalledWith('/register');
      expect(User).not.toHaveBeenCalled();
    });

    it('should validate password mismatch', async () => {
      req.body.confirmPassword = 'differentpassword';
      
      await registerUser(req, res);
      
      expect(req.session.flash).toEqual({
        type: 'error',
        message: 'Passwords do not match.',
        errors: { confirmPassword: 'Passwords must match.' }
      });
      expect(res.redirect).toHaveBeenCalledWith('/register');
      expect(User).not.toHaveBeenCalled();
    });

    it('should handle duplicate user error', async () => {
      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue({
          code: 11000,
          keyValue: { email: 'test@example.com' }
        })
      }));

      await registerUser(req, res);
      
      expect(req.session.flash).toEqual({
        type: 'error',
        message: 'Email already exists.',
        errors: { email: 'Already exists.' }
      });
      expect(res.redirect).toHaveBeenCalledWith('/register');
    });

    it('should handle general registration error', async () => {
      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      }));

      await registerUser(req, res);
      
      expect(req.session.flash).toEqual({
        type: 'error',
        message: 'Something went wrong.',
        errors: {}
      });
      expect(res.redirect).toHaveBeenCalledWith('/register');
    });
  });

  describe('loginUser', () => {
    beforeEach(() => {
      req.body = {
        username: 'testuser',
        password: 'password123'
      };
      generateToken.mockReturnValue('mocktoken');
    });

    it('should login user successfully and redirect', async () => {
      User.findOne.mockResolvedValue({
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        password: '$2b$10$hashedpassword'
      });
      bcrypt.compare.mockResolvedValue(true);

      await loginUser(req, res);
      
      expect(User.findOne).toHaveBeenCalledWith({ username: 'testuser' });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', '$2b$10$hashedpassword');
      expect(req.session.userId).toBe('user123');
      expect(req.session.username).toBe('testuser');
      expect(req.session.userEmail).toBe('test@example.com');
      expect(req.session.flash).toEqual({ type: 'success', message: 'Signed in successfully.' });
      expect(res.cookie).toHaveBeenCalledWith('token', 'mocktoken', { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 });
      expect(res.redirect).toHaveBeenCalledWith('/courses');
    });

    it('should validate missing fields', async () => {
      req.body = { username: '', password: '' };
      
      await loginUser(req, res);
      
      expect(req.session.flash).toEqual({
        type: 'error',
        message: 'Please fill in all fields.',
        errors: {
          username: 'Username is required.',
          password: 'Password is required.'
        }
      });
      expect(res.redirect).toHaveBeenCalledWith('/login');
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it('should handle invalid username', async () => {
      User.findOne.mockResolvedValue(null);
      
      await loginUser(req, res);
      
      expect(req.session.flash).toEqual({
        type: 'error',
        message: 'Invalid credentials.',
        errors: { username: 'Check your username.' }
      });
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });

    it('should handle invalid password', async () => {
      User.findOne.mockResolvedValue({
        _id: 'user123',
        username: 'testuser',
        password: '$2b$10$hashedpassword'
      });
      bcrypt.compare.mockResolvedValue(false);
      
      await loginUser(req, res);
      
      expect(req.session.flash).toEqual({
        type: 'error',
        message: 'Invalid credentials.',
        errors: { password: 'Incorrect password.' }
      });
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect to returnTo URL if set', async () => {
      User.findOne.mockResolvedValue({
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        password: '$2b$10$hashedpassword'
      });
      bcrypt.compare.mockResolvedValue(true);
      req.session.returnTo = '/dashboard';

      await loginUser(req, res);
      
      expect(res.redirect).toHaveBeenCalledWith('/dashboard');
      expect(req.session.returnTo).toBeNull();
    });

    it('should handle login error', async () => {
      User.findOne.mockRejectedValue(new Error('DB Error'));
      
      await loginUser(req, res);
      
      expect(req.session.flash).toEqual({
        type: 'error',
        message: 'Something went wrong.'
      });
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('logoutUser', () => {
    it('should destroy session and clear cookies', () => {
      const destroyCallback = jest.fn();
      req.session = { destroy: jest.fn(callback => callback()) };
      
      logoutUser(req, res);
      
      expect(req.session.destroy).toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('connect.sid');
      expect(res.clearCookie).toHaveBeenCalledWith('token');
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });

    it('should handle session destroy error', () => {
      req.session = { destroy: jest.fn(() => { throw new Error('Destroy error'); }) };
      
      expect(() => logoutUser(req, res)).toThrow();
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });
  });
});