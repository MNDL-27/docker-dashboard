/**
 * Prisma Client Singleton
 * 
 * This module provides a singleton instance of the Prisma Client
 * for use across the API. This prevents creating multiple connections
 * during development hot-reloading.
 * 
 * Usage:
 * import { prisma } from './lib/prisma';
 * const users = await prisma.user.findMany();
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prevent multiple instances of Prisma Client in development
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
