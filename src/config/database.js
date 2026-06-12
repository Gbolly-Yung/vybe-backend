const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.message);
    console.error('Full error:', err);
  } else {
    console.log('Database connected successfully! ✅');
    release();
  }
});

module.exports = pool;