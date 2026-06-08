import { neon } from '@neondatabase/serverless';

// The Neon client automatically picks up NETLIFY_DATABASE_URL
export const sql = neon(process.env.NETLIFY_DATABASE_URL!);
