const { requireAuth, requireJWT, generateToken } = require('../../middleware/auth');
const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

describe('Auth Middleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      session: {},
      headers: {},
      cookies: {},
      user: null
    };
    res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should allow authenticated user to proceed', () => {
      req.session = { userId: 'user123' };
      
      requireAuth(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should redirect unauthenticated user to login', () => {
      req.session = {};
      
      requireAuth(req, res, next);
      
      expect(res.redirect).toHaveBeenCalledWith('/login');
      expect(req.session.flash).toEqual({
        type: 'warning',
        message: 'Please sign in to continue.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing session', () => {
      req.session = undefined;
      
      requireAuth(req, res, next);
      
      expect(res.redirect).toHaveBeenCalledWith('/login');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireJWT', () => {
    beforeEach(() => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { id: 'user123', username: 'testuser', email: 'test@example.com' });
      });
    });

    it('should allow valid JWT from authorization header', () => {
      req.headers.authorization = 'Bearer validtoken';
      
      requireJWT(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith('validtoken', expect.any(String), expect.any(Function));
      expect(req.user).toEqual({ id: 'user123', username: 'testuser', email: 'test@example.com' });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow valid JWT from cookie', () => {
      req.cookies.token = 'cookietoken';
      
      requireJWT(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith('cookietoken', expect.any(String), expect.any(Function));
      expect(req.user).toEqual({ id: 'user123', username: 'testuser', email: 'test@example.com' });
      expect(next).toHaveBeenCalled();
    });

    it('should reject missing token', () => {
      requireJWT(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      req.headers.authorization = 'Bearer invalidtoken';
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('Invalid token'), null);
      });
      
      requireJWT(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith('invalidtoken', expect.any(String), expect.any(Function));
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject expired token', () => {
      req.headers.authorization = 'Bearer expiredtoken';
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new jwt.TokenExpiredError('Token expired'), null);
      });
      
      requireJWT(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle JWT verification error', () => {
      req.headers.authorization = 'Bearer errortoken';
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('Verification error'), null);
      });
      
      requireJWT(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });
  });

  describe('generateToken', () => {
    beforeEach(() => {
      const mockUser = { _id: 'user123', username: 'testuser', email: 'test@example.com' };
      jwt.sign.mockReturnValue('generatedtoken');
      
      const token = generateToken(mockUser);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 'user123', username: 'testuser', email: 'test@example.com' },
        expect.any(String),
        { expiresIn: '24h' }
      );
      expect(token).toBe('generatedtoken');
    });

    it('should generate token with correct payload and options', () => {
      // Test is covered in beforeEach
      expect(jwt.sign).toHaveBeenCalledTimes(1);
    });

    it('should handle user without all required fields', () => {
      const partialUser = { _id: 'user123' };
      jwt.sign.mockReturnValue('partialtoken');
      
      const token = generateToken(partialUser);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 'user123', username: undefined, email: undefined },
        expect.any(String),
        { expiresIn: '24h' }
      );
      expect(token).toBe('partialtoken');
    });
  });

  describe('generateToken with mocked JWT errors', () => {
    it('should handle JWT signing error', () => {
      const mockUser = { _id: 'user123', username: 'testuser', email: 'test@example.com' };
      jwt.sign.mockImplementation(() => { throw new Error('Signing error'); });
      
      expect(() => generateToken(mockUser)).toThrow('Signing error');
    });
  });
});