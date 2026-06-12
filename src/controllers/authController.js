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
// SEND VERIFICATION EMAIL
const sendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    const user = result.rows[0];

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Save code to database
    await db.query(
      `INSERT INTO email_verifications (user_id, email, code)
       VALUES ($1, $2, $3)`,
      [user.id, email, code]
    );

    // Send email using Resend
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'VYBE <onboarding@resend.dev>',
      to: email,
      subject: 'Verify your VYBE account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d14; color: #ffffff; padding: 40px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: #8b5cf6; width: 60px; height: 60px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
              <span style="font-size: 28px; font-weight: 900; color: white;">V</span>
            </div>
            <h1 style="font-size: 28px; font-weight: 900; letter-spacing: 6px; color: #ffffff; margin: 0;">VYBE</h1>
          </div>
          <h2 style="font-size: 22px; font-weight: 700; color: #ffffff; text-align: center;">Verify Your Email</h2>
          <p style="color: #9999bb; text-align: center; font-size: 15px;">Enter this code in the app to verify your email address:</p>
          <div style="background: #1c1c2e; border: 2px solid #8b5cf6; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 42px; font-weight: 900; letter-spacing: 12px; color: #8b5cf6;">${code}</span>
          </div>
          <p style="color: #9999bb; text-align: center; font-size: 13px;">This code expires in 10 minutes.</p>
          <p style="color: #555577; text-align: center; font-size: 12px;">If you didn't create a VYBE account, ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: 'Verification code sent to your email!' });

  } catch (error) {
    console.error('Send verification email error:', error);
    res.status(500).json({ message: 'Failed to send verification email.' });
  }
};

// VERIFY EMAIL CODE
const verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    // Find the verification code
    const result = await db.query(
      `SELECT * FROM email_verifications
       WHERE email = $1 AND code = $2
       AND is_used = FALSE
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired code. Please try again.' });
    }

    const verification = result.rows[0];

    // Mark code as used
    await db.query(
      'UPDATE email_verifications SET is_used = TRUE WHERE id = $1',
      [verification.id]
    );

    // Mark user as verified
    await db.query(
      'UPDATE users SET is_email_verified = TRUE WHERE id = $1',
      [verification.user_id]
    );

    // Generate token
    const token = generateToken(verification.user_id);

    // Get user
    const userResult = await db.query(
      `SELECT id, name, username, email, avatar, bio, country, is_verified, is_email_verified
       FROM users WHERE id = $1`,
      [verification.user_id]
    );

    res.json({
      message: 'Email verified successfully! Welcome to VYBE 🎉',
      token,
      user: userResult.rows[0],
    });

  } catch (error) {
    console.error('Verify email code error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
module.exports = {
  signup,
  login,
  getMe,
  updateProfile,
  changePassword,
  sendVerificationEmail,
  verifyEmailCode,
};