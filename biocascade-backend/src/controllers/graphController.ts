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

export const getCascadeTree = async (req: any, res: any) => {
  try {
    // Safely extract the identifier from the route parameters
    const id = req.params.id || req.params.rootId;

    if (!id || id === 'undefined') {
      return res.status(400).json({ error: "Missing or invalid node ID parameter" });
    }

    // 1. Fetch the recursive edges WITH A DEPTH LIMIT
    const edges: any[] = await prisma.$queryRaw`
      WITH RECURSIVE CascadeTree AS (
        SELECT "sourceId", "targetId", "relation", 1 AS depth
        FROM "Edge"
        WHERE "sourceId" = ${id}

        UNION ALL

        SELECT e."sourceId", e."targetId", e."relation", ct.depth + 1
        FROM "Edge" e
        INNER JOIN CascadeTree ct ON e."sourceId" = ct."targetId"
        WHERE ct.depth < 7 
      )
      SELECT "sourceId", "targetId", "relation" FROM CascadeTree;
    `;

    if (!edges.length) {
      // If no edges, just return the single root node
      const rootNode = await prisma.entity.findUnique({ where: { id: id } });
      return res.json({ nodes: rootNode ? [rootNode] : [], edges: [] });
    }

    // 2. Extract all unique Node IDs from the edges
    const nodeIds = new Set<string>();
    edges.forEach((edge) => {
      nodeIds.add(edge.sourceId);
      nodeIds.add(edge.targetId);
    });

    // 3. Fetch the actual Node data for those IDs
    const nodes = await prisma.entity.findMany({
      where: {
        id: { in: Array.from(nodeIds) }
      }
    });

    // 4. Return the complete package to the frontend
    res.json({ nodes, edges });

  } catch (error: any) {
    console.error("Error fetching cascade tree:", error);
    res.status(500).json({ error: "Internal Server Error" });
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