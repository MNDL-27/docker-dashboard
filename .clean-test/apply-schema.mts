import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import { sql } from '../netlify/functions/lib/db.mjs';

async function run() {
  const schema = fs.readFileSync('./netlify/schema.sql', 'utf8');
  console.log('Applying schema...');
  await sql.unsafe(schema);
  console.log('Schema applied.');
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
