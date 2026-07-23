import { type Request,type Response,type NextFunction } from 'express';
import { redis } from '../redis';

export const cacheMultiCascade = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rootIds } = req.body;

    // Edge Case: Validate payload
    if (!rootIds || !Array.isArray(rootIds) || rootIds.length === 0) {
      res.status(400).json({ error: 'Valid array of rootIds is required.' });
      return;
    }

    // Edge Case: Sort the IDs so [A, B] and [B, A] produce the exact same cache key
    const sortedIds = [...rootIds].sort();
    const cacheKey = `cascade:multi:${sortedIds.join(',')}`;

    // Check if Redis is actually connected before querying to avoid timeout hangs
    if (redis.isOpen) {
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        console.log(`🟢 REDIS CACHE HIT: Served ${cacheKey} in <1ms`); // Add this
        res.setHeader('X-Cache', 'HIT');
        res.status(200).json(JSON.parse(cachedData));
        return;
      }
    }

    console.log(`🔴 REDIS CACHE MISS: Computing BFS for ${cacheKey}`); // Add this
    (req as any).cacheKey = cacheKey;
    res.setHeader('X-Cache', 'MISS');
    
    next();
  } catch (error) {
    // Graceful Degradation: If Redis fails, log it and proceed to the actual DB query
    console.error('Redis Cache Middleware Error:', error);
    next();
  }
};