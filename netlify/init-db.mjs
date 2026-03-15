import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const url = process.env.NETLIFY_DATABASE_URL;
  if (!url) {
    console.error('NETLIFY_DATABASE_URL is required in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log('Connected to Neon DB. Executing schema...');
  
  try {
    await client.query(schema);
    console.log('✓ Successfully initialized schema in Neon DB.');
  } catch (err) {
    console.error('✗ Failed:', err.message);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
