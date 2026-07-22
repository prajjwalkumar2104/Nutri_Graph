import { type Request,type Response } from 'express';
import { prisma } from '../prisma';

export const findShortestPath = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startNodeId, endNodeId } = req.query;

    if (!startNodeId || !endNodeId) {
      res.status(400).json({ error: "Missing start or end node IDs." });
      return;
    }

    const allEdges = await prisma.edge.findMany();

    // 🔥 THE FIX: Build a BIDIRECTIONAL Adjacency List
    const graph = new Map<string, string[]>();
    
    allEdges.forEach(edge=> {
      if (!graph.has(edge.sourceId)) graph.set(edge.sourceId, []);
      if (!graph.has(edge.targetId)) graph.set(edge.targetId, []);
      
      // Push the connection in BOTH directions
      graph.get(edge.sourceId)!.push(edge.targetId);
      graph.get(edge.targetId)!.push(edge.sourceId); 
    });

    const queue: string[][] = [[startNodeId as string]]; 
    const visited = new Set<string>([startNodeId as string]);

    let shortestPath: string[] | null = null;

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const currentNode = currentPath[currentPath.length - 1] as string;

      if (currentNode === endNodeId) {
        shortestPath = currentPath;
        break;
      }

      const neighbors = graph.get(currentNode) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...currentPath, neighbor]); 
        }
      }
    }

    if (!shortestPath) {
      res.status(404).json({ message: "No biological link exists between these nodes." });
      return;
    }

    res.status(200).json({ path: shortestPath });

  } catch (error) {
    console.error("Pathfinder error:", error);
    res.status(500).json({ error: "Failed to calculate path." });
  }
};