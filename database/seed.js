const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'rubhi',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function seed() {
  try {
    const adminPassword = 'vinay9919@';
    const hash = await bcrypt.hash(adminPassword, 12);

    await pool.query(`
      INSERT INTO users (full_name, username, email, password_hash, role, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET password_hash = $4, role = $5, is_verified = $6
    `, ['Admin', 'admin', 'jaiswalvinay539@gmail.com', hash, 'admin', true]);

    console.log('Admin user seeded successfully.');
    console.log('  Email:    jaiswalvinay539@gmail.com');
    console.log('  Password: vinay9919@');
    console.log('  Role:     admin');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await pool.end();
  }
}

seed();
