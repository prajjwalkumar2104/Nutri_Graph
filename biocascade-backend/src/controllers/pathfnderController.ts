import { Request, Response } from 'express';
import { prisma } from '../utils/db';

export const findShortestPath = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startNodeId, endNodeId } = req.query;

    if (!startNodeId || !endNodeId) {
      res.status(400).json({ error: "Missing start or end node IDs." });
      return;
    }

    // 1. Fetch ALL edges (Since the dataset is specific, this is very fast)
    // If your graph grows to millions of edges, we would use a graph database, 
    // but for thousands, Node.js memory handles this in <5ms.
    const allEdges = await prisma.edge.findMany();

    // 2. Build an Adjacency List for the BFS algorithm
    const graph = new Map<string, string[]>();
    allEdges.forEach(edge => {
      if (!graph.has(edge.sourceId)) graph.set(edge.sourceId, []);
      if (!graph.has(edge.targetId)) graph.set(edge.targetId, []);
      
      // Add directional links (You can make this bidirectional if you want!)
      graph.get(edge.sourceId)!.push(edge.targetId);
    });

    // 3. The Breadth-First Search (BFS) Algorithm
    const queue: string[][] = [[startNodeId as string]]; // Queue stores the PATHS
    const visited = new Set<string>([startNodeId as string]);

    let shortestPath: string[] | null = null;

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const currentNode = currentPath[currentPath.length - 1];

      // If we reached the target, we found the shortest path!
      if (currentNode === endNodeId) {
        shortestPath = currentPath;
        break;
      }

      // Check all neighbors
      const neighbors = graph.get(currentNode) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...currentPath, neighbor]); // Push the new, longer path
        }
      }
    }

    if (!shortestPath) {
      res.status(404).json({ message: "No biological link exists between these nodes." });
      return;
    }

    // 4. Return the exact sequence of nodes that connect them
    res.status(200).json({ path: shortestPath });

  } catch (error) {
    console.error("Pathfinder error:", error);
    res.status(500).json({ error: "Failed to calculate path." });
  }
};