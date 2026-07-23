import { createClient } from 'redis';

// Use a local instance for development, or a managed URL (like Upstash/AWS) for production
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = createClient({
  url: REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 10000,
    keepAlive: true,
  }
});

// CRITICAL EDGE CASE: Prevent Redis connection drops from crashing the Express event loop
redis.on('error', (err) => {
  console.error('⚠️ Redis Connection Error (Gracefully degrading to Postgres):', err.message);
});

redis.on('connect', () => {
  console.log('✅ Redis Cache connected successfully.');
});

// Initialize connection
export const connectRedis = async () => {
  try {
    await redis.connect();
  } catch (err) {
    console.error('Failed to connect to Redis on startup:', err);
  }
};