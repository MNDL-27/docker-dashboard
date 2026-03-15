import dotenv from 'dotenv';
dotenv.config();
import { sql } from '../netlify/functions/lib/db.mjs';

async function run() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users'
  `;
  console.log('Columns in users:', cols);
  process.exit(0);
}
run().catch(console.error);
