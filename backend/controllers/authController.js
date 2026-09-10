import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_production_123!';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Check login directly against environment configs
  if (username !== 'admin' || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Generate JWT token (lasts 30 days)
  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return res.json({
    token,
    user: {
      id: 1,
      username: 'admin',
      role: 'admin'
    }
  });
};

export const validateToken = (req, res) => {
  // If the request passes the authenticateToken middleware, it's valid
  return res.json({
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    }
  });
};

export const logout = (req, res) => {
  return res.json({ success: true, message: 'Logged out successfully.' });
};
