const { execSync } = require('child_process');
const path = require('path');

// Load env first
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Fallback if DATABASE_URL not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./prisma/posdb.db';
}

console.log('DATABASE_URL:', process.env.DATABASE_URL);

try {
  console.log('Running prisma db push...');
  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });
  console.log('Running seed...');
  execSync('node src/seed.js', {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });
} catch (e) {
  console.error('Setup error (continuing anyway):', e.message);
}

console.log('Starting server...');
require('./src/index');
