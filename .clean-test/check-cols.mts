import dotenv from 'dotenv';
dotenv.config();
import { sql } from './netlify/functions/lib/db.mjs';

sql`SELECT column_name FROM information_schema.columns WHERE table_name='users'`.then(cols => {
  console.log(cols);
}).catch(console.error).finally(() => process.exit(0));
