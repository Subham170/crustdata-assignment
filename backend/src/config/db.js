import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDb() {
  await prisma.$connect();
}

export async function disconnectDb() {
  await prisma.$disconnect();
}

export async function checkDbHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'connected' };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message,
    };
  }
}
