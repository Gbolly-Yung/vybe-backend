const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// SIGNUP
const signup = async (req, res) => {
  try {
    const { name, username, email, password, country } = req.body;

    // Check all fields
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if email exists
    const emailExists = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (emailExists.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Check if username exists
    const usernameExists = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (usernameExists.rows.length > 0) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await db.query(
      `INSERT INTO users (name, username, email, password, country)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, username, email, country, avatar, bio, is_verified, created_at`,
      [name, username, email, hashedPassword, country || 'Nigeria']
    );

    const user = newUser.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'Account created successfully! 🎉',
      token,
      user,
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check account status
    if (user.account_status === 'banned') {
      return res.status(403).json({ message: 'Your account has been banned.' });
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({ message: 'Your account has been suspended.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) {
  return res.status(400).json({ message: 'Incorrect password. Please try again.' });
}

    const token = generateToken(user.id);

    res.json({
      message: 'Welcome back! 🚀',
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        country: user.country,
        is_verified: user.is_verified,
        followers_count: user.followers_count,
        following_count: user.following_count,
        posts_count: user.posts_count,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// GET CURRENT USER
const getMe = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, username, email, avatar, bio, website, country,
       is_verified, is_private, followers_count, following_count, posts_count,
       earnings_total, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
  try {
    const { name, username, bio, website, country } = req.body;

    const result = await db.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        username = COALESCE($2, username),
        bio = COALESCE($3, bio),
        website = COALESCE($4, website),
        country = COALESCE($5, country),
        updated_at = NOW()
       WHERE id = $6
       RETURNING id, name, username, email, avatar, bio, website, country, is_verified`,
      [name, username, bio, website, country, req.userId]
    );

    res.json({
      message: 'Profile updated successfully!',
      user: result.rows[0],
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// CHANGE PASSWORD
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.userId]);

    res.json({ message: 'Password changed successfully!' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { signup, login, getMe, updateProfile, changePassword };