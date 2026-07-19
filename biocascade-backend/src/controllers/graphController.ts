// src/controllers/graphController.ts
import { type Request, type Response } from 'express';
import { prisma } from '../utils/db'; // <-- This is all we need now!
import { PrismaClient } from '../generated/client/index.js';
export const getCascadeTree = async (req: any, res: any) => {
  try {
    // Safely extract the identifier from the route parameters
    const id = req.params.id || req.params.rootId;

    if (!id || id === 'undefined') {
      return res.status(400).json({ error: "Missing or invalid node ID parameter" });
    }

    // 1. BIDIRECTIONAL RECURSIVE FETCH
    // We run two CTEs (Common Table Expressions) simultaneously:
    // - Downstream: Finds all effects cascading FROM this node
    // - Upstream: Finds all root causes leading TO this node
    const edges: any[] = await prisma.$queryRaw`
      WITH RECURSIVE 
      Downstream AS (
        SELECT "sourceId", "targetId", "relation", 1 AS depth
        FROM "Edge"
        WHERE "sourceId" = ${id}

        UNION ALL

        SELECT e."sourceId", e."targetId", e."relation", d.depth + 1
        FROM "Edge" e
        INNER JOIN Downstream d ON e."sourceId" = d."targetId"
        WHERE d.depth < 6 
      ),
      Upstream AS (
        SELECT "sourceId", "targetId", "relation", 1 AS depth
        FROM "Edge"
        WHERE "targetId" = ${id}

        UNION ALL

        SELECT e."sourceId", e."targetId", e."relation", u.depth + 1
        FROM "Edge" e
        INNER JOIN Upstream u ON e."targetId" = u."sourceId"
        WHERE u.depth < 6
      )
      
      -- Combine the results of both searches and remove duplicates
      SELECT "sourceId", "targetId", "relation" FROM Downstream
      UNION
      SELECT "sourceId", "targetId", "relation" FROM Upstream;
    `;

    if (!edges.length) {
      // If no edges at all (it's a floating island node), just return itself
      const rootNode = await prisma.entity.findUnique({ where: { id: id } });
      return res.json({ nodes: rootNode ? [rootNode] : [], edges: [] });
    }

    // 2. Extract all unique Node IDs from the combined edges
    const nodeIds = new Set<string>();
    edges.forEach((edge) => {
      nodeIds.add(edge.sourceId);
      nodeIds.add(edge.targetId);
    });

    // 3. Fetch the actual Node data for all gathered IDs
    const nodes = await prisma.entity.findMany({
      where: {
        id: { in: Array.from(nodeIds) }
      }
    });

    // 4. Return the complete package to the frontend
    res.json({ nodes, edges });

  } catch (error: any) {
    console.error("Error fetching bidirectional cascade tree:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getRootDeficiencies = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch only entities flagged as DEFICIENCY to show on the landing catalog grid
    const roots = await prisma.entity.findMany({
      where: {
        type: 'DEFICIENCY'
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json(roots);
  } catch (error) {
    console.error('Failed to pull root deficiency catalog:', error);
    res.status(500).json({ error: 'Internal server error fetching root catalog.' });
  }
};


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