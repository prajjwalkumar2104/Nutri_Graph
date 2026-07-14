// src/components/CascadeGraph.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import CustomNode from './CustomNode';

const nodeTypes = {
  customCard: CustomNode,
};

// Initialize the Dagre Layout Engine
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // TB = Top to Bottom
  dagreGraph.setGraph({ rankdir: direction, ranksep: 150, nodesep: 80 });

  const nodeWidth = 300; 
  const nodeHeight = 150;

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export default function CascadeGraph({ rootId, onNodeSelect }: { rootId: string, onNodeSelect: (data: any) => void }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/cascade/${rootId}`);
        
        // 1. DEFENSIVE GUARD: Catch 500 Server Errors gracefully
        if (!res.ok) {
          throw new Error(`Backend failed with status: ${res.status}`);
        }

        const data = await res.json();

        // 2. DEFENSIVE GUARD: Prevent '.map is not a function' crashes
        if (!data || !data.nodes || !data.edges) {
          console.warn("Invalid or empty data received from API.");
          setNodes([]);
          setEdges([]);
          return;
        }

        const rawNodes: Node[] = data.nodes.map((n: any) => ({
          id: n.id,
          type: 'customCard',
          position: { x: 0, y: 0 }, 
          data: { label: n.name, type: n.type, description: n.description },
        }));

        // 3. DEDUPLICATION FIX: Merge overlapping nodes (Fixes Vitamin B12 and Zinc)
        const uniqueNodes = Array.from(
          new Map(rawNodes.map((node) => [node.id, node])).values()
        );

        // 3. Map the raw edges with a fallback unique ID
        const rawEdges: Edge[] = data.edges.map((e: any, index: number) => ({
          // FIX: Generate a unique ID if the database didn't provide one
          id: e.id || `edge-${e.sourceId}-${e.targetId}-${index}`,
          source: e.sourceId,
          target: e.targetId,
          label: e.relation || '',
          animated: true,
          style: { stroke: '#64748b', strokeWidth: 3 },
          labelStyle: { fill: '#475569', fontWeight: 700, fontSize: 12 },
          labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9, rx: 5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#64748b' },
        }));

        // DEDUPLICATION FIX: Merge duplicate edges to prevent rendering glitches
        const uniqueEdgesMap = new Map();
        rawEdges.forEach(edge => {
          const edgeSignature = `${edge.source}-${edge.target}`;
          if (!uniqueEdgesMap.has(edgeSignature)) {
            uniqueEdgesMap.set(edgeSignature, edge);
          }
        });
        const deduplicatedEdges = Array.from(uniqueEdgesMap.values());

        // 4. EDGE VALIDATION: Ensure Dagre doesn't crash drawing lines to missing nodes
        const nodeIds = new Set(uniqueNodes.map((n) => n.id));
        const validEdges = deduplicatedEdges.filter(
          (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
        );

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          uniqueNodes,
          validEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      } catch (error) {
        console.error("Failed to fetch graph:", error);
        setNodes([]); // Clear the canvas instead of crashing
        setEdges([]);
      }
    };

    if (rootId) fetchGraph();
  }, [rootId]);

  const onNodesChange = (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds));

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(event, node) => onNodeSelect(node.data)}
        fitView
      >
        <Background color="#94a3b8" gap={24} size={2} />
        <Controls />
      </ReactFlow>
    </div>
  );
}