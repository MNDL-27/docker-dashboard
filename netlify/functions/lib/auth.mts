import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

export interface UserPayload {
  id: string;
  email: string;
}

export function signJwt(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyJwt(token: string): UserPayload {
  return jwt.verify(token, JWT_SECRET) as UserPayload;
}

export function getUserFromHeader(header: string | null | undefined): UserPayload {
  if (!header || !header.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  const token = header.replace('Bearer ', '');
  return verifyJwt(token);
}
