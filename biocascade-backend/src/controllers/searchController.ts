import { type Request, type Response } from 'express';
// Double check the relative path based on where you save db.ts
import { pipeline } from '@xenova/transformers';
import { prisma } from '../prisma';

let localEmbedder: any = null;

export const semanticSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'A valid search query string parameter is required.' });
      return;
    }

    // 1. Lazy-load the local embedding transformer
    if (!localEmbedder) {
      localEmbedder = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
    }

    // 2. Compute vector representation for user input string locally
    const output = await localEmbedder(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data);
    const vectorString = `[${queryVector.join(',')}]`;

    // 3. Execute Vector Similarity Search using Cosine Distance (<=>) operator
    // Exclude records without valid embeddings
    const matchedEntities: any[] = await prisma.$queryRaw`
      SELECT 
        "id", 
        "name", 
        "type", 
        "description",
        ("embedding" <=> ${vectorString}::vector) AS "distance"
      FROM "Entity"
      WHERE "embedding" IS NOT NULL
      ORDER BY "distance" ASC
      LIMIT 8;
    `;

    // 4. Map geometric distance back to a user-friendly confidence metric
    const results = matchedEntities.map(entity => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      matchConfidence: Math.max(0, Math.min(100, Math.round((1 - entity.distance) * 100)))
    }));

    res.status(200).json(results);
  } catch (error: any) {
    console.error('Semantic search database execution failure:', error);
    res.status(500).json({ error: 'Internal server error processing semantic request.' });
  }
};