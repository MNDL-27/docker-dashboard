import dotenv from 'dotenv';
dotenv.config();
import { sql } from '../netlify/functions/lib/db.mjs';

async function check() {
  const rs = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`;
  console.log('Columns in users:', rs.map((c: any) => c.column_name).join(', '));
  process.exit(0);
}
check();
