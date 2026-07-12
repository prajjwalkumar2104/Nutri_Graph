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
  
  // TB = Top to Bottom. Adjust spacing here if needed.
  dagreGraph.setGraph({ rankdir: direction, ranksep: 150, nodesep: 80 });

  // Define node dimensions based on our Tailwind classes (w-72 is approx 288px)
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

export default function CascadeGraph({ rootId }: { rootId: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/cascade/${rootId}`);
        const data = await res.json();

        const formattedNodes: Node[] = data.nodes.map((n: any) => ({
          id: n.id,
          type: 'customCard',
          position: { x: 0, y: 0 }, // Dagre will overwrite this!
          data: { label: n.name, type: n.type, description: n.description },
        }));

        const formattedEdges: Edge[] = data.edges.map((e: any) => ({
          id: e.id,
          source: e.sourceId,
          target: e.targetId,
          label: e.relation,
          animated: true,
          style: { stroke: '#64748b', strokeWidth: 3 },
          labelStyle: { fill: '#475569', fontWeight: 700, fontSize: 12 },
          labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9, rx: 5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#64748b' },
        }));

        // Pass the raw nodes and edges through the layout calculator
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          formattedNodes,
          formattedEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      } catch (error) {
        console.error("Failed to fetch graph:", error);
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
        fitView
      >
        <Background color="#94a3b8" gap={24} size={2} />
        <Controls />
      </ReactFlow>
    </div>
  );
}