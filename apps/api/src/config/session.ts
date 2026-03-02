import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

const PgSession = connectPgSimple(session);
const isProduction = process.env.NODE_ENV === 'production';

// Create a PostgreSQL pool using the DATABASE_URL from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: isProduction,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  },
});

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}
