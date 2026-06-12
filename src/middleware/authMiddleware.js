const jwt = require('jsonwebtoken');
const db = require('../config/database');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized. Please login.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const result = await db.query(
      'SELECT id, name, username, email, account_status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    const user = result.rows[0];

    // Check account status
    if (user.account_status === 'banned') {
      return res.status(403).json({ message: 'Your account has been banned.' });
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({ message: 'Your account has been suspended.' });
    }

    // Attach user to request
    req.userId = user.id;
    req.user = user;

    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Not authorized. Token invalid.' });
  }
};

module.exports = { protect };