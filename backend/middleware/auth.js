const jwt = require('jsonwebtoken');
const { query: db } = require('../config/db');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db('SELECT id, username, email, role, is_banned FROM users WHERE id = ?', [decoded.userId]);
    if (!result.rows.length) return res.status(401).json({ error: 'User not found' });

    const user = result.rows[0];
    if (user.is_banned) return res.status(403).json({ error: 'Your account has been banned.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied. Admin only.' });
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) { req.user = null; return next(); }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db('SELECT id, username, email, role, is_banned FROM users WHERE id = ?', [decoded.userId]);
    req.user = result.rows[0] || null;
    next();
  } catch { req.user = null; next(); }
};

module.exports = { authenticateToken, requireAdmin, optionalAuth };
