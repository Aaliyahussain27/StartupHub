const { Client } = require('pg');

const connectionString = 'postgresql://postgres.chsxnssddtndqigfabvd:StartupHub%4026@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Testing connection to pooler string...');
  try {
    await client.connect();
    console.log('SUCCESS: Connected to PostgreSQL database pooler successfully!');
    const res = await client.query('SELECT NOW() as current_time');
    console.log('Query result:', res.rows[0]);
  } catch (err) {
    console.error('FAILED: Could not connect to pooler:', err.message);
  } finally {
    await client.end();
  }
}

run();
