// src/components/CascadeGraph.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap, // NEW IMPORT
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

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 150, nodesep: 80 });

  const nodeWidth = 300; 
  const nodeHeight = 150;

  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: { x: nodeWithPosition.x - nodeWidth / 2, y: nodeWithPosition.y - nodeHeight / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export default function CascadeGraph({ rootId, onNodeSelect }: { rootId: string, onNodeSelect: (data: any) => void }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/cascade/${rootId}`);
        if (!res.ok) throw new Error(`Backend failed with status: ${res.status}`);
        
        const data = await res.json();
        if (!data || !data.nodes || !data.edges) return;

        const rawNodes: Node[] = data.nodes.map((n: any) => ({
          id: n.id,
          type: 'customCard',
          position: { x: 0, y: 0 }, 
          data: { label: n.name, type: n.type, description: n.description },
        }));

        const uniqueNodes = Array.from(new Map(rawNodes.map((node) => [node.id, node])).values());

        const rawEdges: Edge[] = data.edges.map((e: any, index: number) => ({
          id: e.id || `edge-${e.sourceId}-${e.targetId}-${index}`,
          source: e.sourceId,
          target: e.targetId,
          label: e.relation || '',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 3, transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease' },
          labelStyle: { fill: '#64748b', fontWeight: 700, fontSize: 12 },
          labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9, rx: 5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#94a3b8' },
        }));

        const uniqueEdgesMap = new Map();
        rawEdges.forEach(edge => uniqueEdgesMap.set(`${edge.source}-${edge.target}`, edge));
        const deduplicatedEdges = Array.from(uniqueEdgesMap.values());

        const nodeIds = new Set(uniqueNodes.map((n) => n.id));
        const validEdges = deduplicatedEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(uniqueNodes, validEdges);

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setSelectedNodeId(null);
      } catch (error) {
        console.error("Failed to fetch graph:", error);
        setNodes([]);
        setEdges([]);
      }
    };

    if (rootId) fetchGraph();
  }, [rootId]);

  const { displayNodes, displayEdges } = useMemo(() => {
    if (!selectedNodeId) return { displayNodes: nodes, displayEdges: edges };

    const pathNodes = new Set<string>([selectedNodeId]);
    const pathEdges = new Set<string>();
    const visited = new Set<string>(); // 🛡️ The Loop Shield

    let currentTargets = [selectedNodeId];

    while (currentTargets.length > 0) {
      const nextTargets: string[] = [];
      
      currentTargets.forEach(targetId => {
        // If we have already crawled backward from this node, skip it to prevent freezing
        if (visited.has(targetId)) return;
        visited.add(targetId);

        edges.forEach(edge => {
          if (edge.target === targetId) {
            pathEdges.add(edge.id);
            pathNodes.add(edge.source);
            nextTargets.push(edge.source);
          }
        });
      });

      currentTargets = nextTargets;
    }

    const styledNodes = nodes.map(node => ({
      ...node,
      style: { ...node.style, opacity: pathNodes.has(node.id) ? 1 : 0.2, transition: 'opacity 0.3s ease' }
    }));

    const styledEdges = edges.map(edge => {
      const isActive = pathEdges.has(edge.id);
      return {
        ...edge,
        animated: isActive,
        style: {
          stroke: isActive ? '#3b82f6' : '#e2e8f0', 
          strokeWidth: isActive ? 4 : 2,
          transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease',
          opacity: isActive ? 1 : 0.2
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: isActive ? '#3b82f6' : '#e2e8f0' },
        labelStyle: { fill: isActive ? '#1e293b' : '#94a3b8', fontWeight: 700, fontSize: 12 }
      };
    });

    return { displayNodes: styledNodes, displayEdges: styledEdges };
  }, [nodes, edges, selectedNodeId]);

  
  const onNodesChange = (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds));

  // Dynamic styling mapping for the Mini-Map preview nodes
  const getMiniMapNodeColor = (node: Node) => {
    switch (node.data?.type?.toUpperCase()) {
      case 'DEFICIENCY': return '#f59e0b';
      case 'SYMPTOM': return '#3b82f6';
      case 'DISEASE': return '#f43f5e';
      default: return '#cbd5e1';
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(event, node) => {
          setSelectedNodeId(node.id);
          onNodeSelect(node.data);
        }}
        onPaneClick={() => {
          setSelectedNodeId(null);
          onNodeSelect(null);
        }}
        fitView
      >
        <Background color="#94a3b8" gap={24} size={2} />
        
        {/* Sleek Floating Control Utilities Menu */}
        <Controls className="bg-white/80 backdrop-blur-md border border-slate-200 shadow-lg rounded-xl overflow-hidden p-1" />
        
        {/* NEW: Clean Mini-Map Positioning Component */}
        <MiniMap 
          nodeColor={getMiniMapNodeColor}
          nodeStrokeWidth={3}
          maskColor="rgba(241, 245, 249, 0.6)"
          className="!bg-white/80 !backdrop-blur-md !border !border-slate-200 !shadow-lg !rounded-2xl !overflow-hidden !m-4"
          style={{ width: 180, height: 120 }}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}