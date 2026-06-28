// src/controllers/graphController.ts
import 'dotenv/config';
import {type Request,type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Initialize Prisma with the pg adapter
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in your .env file');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const getCascadeTree = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Edge Case: Missing ID
    if (!id) {
      res.status(400).json({ error: 'Root entity id is required' });
      return;
    }

    // High-performance recursive query
    const rawGraphData = await prisma.$queryRaw`
      WITH RECURSIVE CascadeTree AS (
        -- Anchor member: Select the starting entity
        SELECT id, name, type, description, 0 AS level
        FROM "Entity"
        WHERE id = ${id}

        UNION ALL

        -- Recursive member: Join with downstream edges and entities
        SELECT e.id, e.name, e.type, e.description, ct.level + 1
        FROM "Entity" e
        INNER JOIN "Edge" edge ON e.id = edge."targetId"
        INNER JOIN CascadeTree ct ON edge."sourceId" = ct.id
      )
      SELECT DISTINCT * FROM CascadeTree ORDER BY level ASC;
    `;

    const nodeIds = (rawGraphData as any[]).map((node) => node.id);

    // Edge Case: ID does not exist in the database
    if (nodeIds.length === 0) {
      res.status(404).json({ error: 'No cascade tree found for this id' });
      return;
    }

    // Fetch matching edges for the discovered nodes
    const edges = await prisma.edge.findMany({
      where: {
        sourceId: { in: nodeIds },
        targetId: { in: nodeIds },
      },
    });

    res.status(200).json({
      nodes: rawGraphData,
      edges: edges,
    });
  } catch (error) {
    console.error('Error fetching cascade tree:', error);
    res.status(500).json({ error: 'Internal server error while traversing graph' });
  }
};

// Add this below getCascadeTree in src/controllers/graphController.ts

export const searchNodes = async (req: Request, res: Response): Promise<void> => {
  try {
    // Grab the 'q' parameter from the URL (e.g., ?q=vitamin)
    const searchQuery = req.query.q as string;

    if (!searchQuery) {
      res.status(200).json([]);
      return;
    }

    // Search the database for matching names, case-insensitive
    const results = await prisma.entity.findMany({
      where: {
        name: {
          contains: searchQuery,
          mode: 'insensitive', // Makes 'vitamin', 'Vitamin', and 'VITAMIN' return the same thing
        },
      },
      take: 5, // Limit to top 5 results for a clean dropdown
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    res.status(200).json(results);
  } catch (error) {
    console.error('Error searching nodes:', error);
    res.status(500).json({ error: 'Internal server error during search' });
  }
};