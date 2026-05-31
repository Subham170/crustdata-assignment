import Redis from 'ioredis';
import { env } from './env.js';

let redis = null;

export function getRedis() {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
  }
  return redis;
}

export async function connectRedis() {
  const client = getRedis();
  if (client.status === 'ready') return client;
  await client.connect();
  return client;
}

export async function disconnectRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export async function checkRedisHealth() {
  try {
    const client = getRedis();
    if (client.status !== 'ready') {
      await client.connect();
    }
    const pong = await client.ping();
    return pong === 'PONG'
      ? { status: 'connected' }
      : { status: 'disconnected', error: 'Unexpected ping response' };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message,
    };
  }
}
