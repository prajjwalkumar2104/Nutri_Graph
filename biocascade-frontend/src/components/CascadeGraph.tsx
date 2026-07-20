// src/components/CascadeGraph.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Position,
  Panel,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import CustomNode from "./CustomNode";
import { Flame } from "lucide-react";

const nodeTypes = {
  customCard: CustomNode,
};

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "TB"
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 150, nodesep: 80 });

  const nodeWidth = 300;
  const nodeHeight = 150;

  nodes.forEach((node) =>
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  );
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));

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

// 🔥 UPDATED: Now accepts an array of rootIds for Multi-Root Merging
interface CascadeGraphProps {
  rootIds: string[]; 
  onNodeSelect: (data: any) => void;
  onMultiSelect: (ids: string[]) => void;
  shortestPathIds?: string[] | null;
  treatedNodeIds: string[];
}

export default function CascadeGraph({
  rootIds, // 🔥 UPDATED
  onNodeSelect,
  onMultiSelect,
  shortestPathIds,
  treatedNodeIds,
}: CascadeGraphProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isHeatmapMode, setIsHeatmapMode] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // 1. Fetch & Layout Data
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        // 🔥 UPDATED: Hitting the Multi-Root POST API Endpoint
        const res = await fetch(`http://localhost:5000/api/cascade/multi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootIds })
        });
        
        if (!res.ok)
          throw new Error(`Backend failed with status: ${res.status}`);

        const data = await res.json();
        if (!data || !data.nodes || !data.edges) return;

        // Calculate Out-Degree Map for Heatmap
        const outDegreeMap = new Map<string, number>();
        data.edges.forEach((edge: any) => {
          outDegreeMap.set(
            edge.sourceId,
            (outDegreeMap.get(edge.sourceId) || 0) + 1
          );
        });

        // Map raw nodes and inject Heatmap data
        const rawNodes: Node[] = data.nodes.map((n: any) => ({
          id: n.id,
          type: "customCard",
          position: { x: 0, y: 0 },
          targetPosition: Position.Top,
          sourcePosition: Position.Bottom,
          data: {
            id: n.id,
            label: n.name,
            type: n.type,
            description: n.description,
            heatScore: outDegreeMap.get(n.id) || 0,
            isHeatmapMode: isHeatmapMode, // Initial state
          },
        }));

        // Deduplicate nodes (crucial for Multi-Root merging!)
        const uniqueNodes = Array.from(
          new Map(rawNodes.map((node) => [node.id, node])).values()
        );

        const rawEdges: Edge[] = data.edges.map((e: any, index: number) => ({
          id: e.id || `edge-${e.sourceId}-${e.targetId}-${index}`,
          source: e.sourceId,
          target: e.targetId,
          label: e.relation || "",
          animated: true,
          style: {
            stroke: "#94a3b8",
            strokeWidth: 3,
            transition:
              "stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease",
          },
          labelStyle: { fill: "#64748b", fontWeight: 700, fontSize: 12 },
          labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9, rx: 5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: "#94a3b8",
          },
        }));

        // Deduplicate edges to prevent rendering crashes
        const uniqueEdgesMap = new Map();
        rawEdges.forEach((edge) =>
          uniqueEdgesMap.set(`${edge.source}-${edge.target}`, edge)
        );
        const deduplicatedEdges = Array.from(uniqueEdgesMap.values());

        const nodeIds = new Set(uniqueNodes.map((n) => n.id));
        const validEdges = deduplicatedEdges.filter(
          (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
        );

        const { nodes: layoutedNodes, edges: layoutedEdges } =
          getLayoutedElements(uniqueNodes, validEdges);

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setSelectedNodeIds([]);
        onMultiSelect([]);
      } catch (error) {
        console.error("Failed to fetch graph:", error);
      }
    };

    // 🔥 UPDATED: Only fetch if the array has IDs
    if (rootIds && rootIds.length > 0) fetchGraph();
  }, [rootIds]); // Note: Dependency array updated to rootIds

  // 2. Reactively update node data when Heatmap toggle changes (avoids re-fetching)
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isHeatmapMode: isHeatmapMode,
        },
      }))
    );
  }, [isHeatmapMode]);

  // 3. Highlight Logic (Treatment Simulation / BFS / Pathfinder / Selection / Hover)
  const { displayNodes, displayEdges } = useMemo(() => {
    // 🔥 TREATMENT SIMULATION BFS (Downward Crawl)
    const preventedNodes = new Set<string>();
    const preventedEdges = new Set<string>();
    const treatedSet = new Set(treatedNodeIds || []);

    if (treatedSet.size > 0) {
      let currentTargets = Array.from(treatedSet);
      
      while (currentTargets.length > 0) {
        const nextTargets: string[] = [];
        currentTargets.forEach((targetId) => {
          edges.forEach((edge) => {
            if (edge.source === targetId) {
              preventedEdges.add(edge.id);
              // If the child is not ALSO treated, mark it as prevented
              if (!treatedSet.has(edge.target) && !preventedNodes.has(edge.target)) {
                preventedNodes.add(edge.target);
                nextTargets.push(edge.target);
              }
            }
          });
        });
        currentTargets = nextTargets; // Move one layer deeper
      }
    }

    // 🔥 Inject Treatment state into nodes BEFORE running other scenarios
    const baseNodes = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isTreated: treatedSet.has(node.id),
        isPrevented: preventedNodes.has(node.id),
      },
    }));

    // SCENARIO 1: We have a calculated path from the backend
    if (shortestPathIds && shortestPathIds.length > 0) {
      const pathNodesSet = new Set(shortestPathIds);
      const pathEdgesSet = new Set<string>();

      for (let i = 0; i < shortestPathIds.length - 1; i++) {
        const n1 = shortestPathIds[i];
        const n2 = shortestPathIds[i + 1];
        const edge = edges.find(
          (e) =>
            (e.source === n1 && e.target === n2) ||
            (e.source === n2 && e.target === n1)
        );
        if (edge) pathEdgesSet.add(edge.id);
      }

      return {
        displayNodes: baseNodes.map((node) => ({
          ...node,
          style: {
            ...node.style,
            opacity: pathNodesSet.has(node.id) ? 1 : 0.2,
            transition: "opacity 0.3s ease",
          },
        })),
        displayEdges: edges.map((edge) => {
          const isActive = pathEdgesSet.has(edge.id);
          const isPrevented = preventedEdges.has(edge.id);
          const strokeColor = isPrevented ? "#10b981" : isActive ? "#f59e0b" : "#e2e8f0";

          return {
            ...edge,
            animated: isActive && !isPrevented,
            style: {
              stroke: strokeColor,
              strokeWidth: isActive && !isPrevented ? 5 : 2,
              strokeDasharray: isPrevented ? "5,5" : "none",
              transition: "stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease",
              opacity: isPrevented ? 0.3 : isActive ? 1 : 0.2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: strokeColor,
            },
          };
        }),
      };
    }

    // SCENARIO 2: Two nodes selected (Awaiting algorithm calculation)
    if (selectedNodeIds.length === 2) {
      const selectedSet = new Set(selectedNodeIds);
      return {
        displayNodes: baseNodes.map((node) => ({
          ...node,
          style: {
            ...node.style,
            opacity: selectedSet.has(node.id) ? 1 : 0.3,
            transition: "opacity 0.3s ease",
          },
        })),
        displayEdges: edges.map((edge) => ({
          ...edge,
          style: { ...edge.style, opacity: 0.1 },
        })),
      };
    }

    // SCENARIO 3: Single node clicked, do standard loop-shielded highlighting
    if (selectedNodeIds.length === 1) {
      const selectedRootId = selectedNodeIds[0];
      const pathNodes = new Set<string>([selectedRootId]);
      const pathEdges = new Set<string>();
      const visited = new Set<string>();

      let currentTargets = [selectedRootId];
      while (currentTargets.length > 0) {
        const nextTargets: string[] = [];
        currentTargets.forEach((targetId) => {
          if (visited.has(targetId)) return;
          visited.add(targetId);
          edges.forEach((edge) => {
            if (edge.target === targetId) {
              pathEdges.add(edge.id);
              pathNodes.add(edge.source);
              nextTargets.push(edge.source);
            }
          });
        });
        currentTargets = nextTargets;
      }

      const styledNodes = baseNodes.map((node) => ({
        ...node,
        style: {
          ...node.style,
          opacity: pathNodes.has(node.id) ? 1 : 0.2,
          transition: "opacity 0.3s ease",
        },
      }));

      const styledEdges = edges.map((edge) => {
        const isActive = pathEdges.has(edge.id);
        const isPrevented = preventedEdges.has(edge.id);
        const strokeColor = isPrevented ? "#10b981" : isActive ? "#3b82f6" : "#e2e8f0";

        return {
          ...edge,
          animated: isActive && !isPrevented,
          style: {
            stroke: strokeColor,
            strokeWidth: isActive && !isPrevented ? 4 : 2,
            strokeDasharray: isPrevented ? "5,5" : "none",
            transition: "stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease",
            opacity: isPrevented ? 0.3 : isActive ? 1 : 0.2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: strokeColor,
          },
        };
      });

      return { displayNodes: styledNodes, displayEdges: styledEdges };
    }

    // SCENARIO 4: Mouse Hover (If no nodes are clicked/selected, highlight edges on hover)
    if (hoveredNodeId && selectedNodeIds.length === 0 && (!shortestPathIds || shortestPathIds.length === 0)) {
      const styledEdges = edges.map((edge) => {
        const isHovered = edge.source === hoveredNodeId || edge.target === hoveredNodeId;
        const isPrevented = preventedEdges.has(edge.id);
        const strokeColor = isPrevented ? "#10b981" : isHovered ? '#8b5cf6' : '#e2e8f0';

        return {
          ...edge,
          animated: isHovered && !isPrevented,
          style: {
            stroke: strokeColor, 
            strokeWidth: isHovered && !isPrevented ? 4 : 2,
            strokeDasharray: isPrevented ? "5,5" : "none",
            transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease',
            opacity: isPrevented ? 0.3 : isHovered ? 1 : 0.3,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: strokeColor,
          },
        };
      });
      return { displayNodes: baseNodes, displayEdges: styledEdges };
    }

    // SCENARIO 5: No selection, show standard graph WITH Treatment styles applied
    const standardEdges = edges.map((edge) => {
      const isPrevented = preventedEdges.has(edge.id);
      if (!isPrevented) return edge;
      
      return {
        ...edge,
        animated: false,
        style: { ...edge.style, stroke: '#10b981', opacity: 0.3, strokeDasharray: '5,5' },
       markerEnd: { 
          type: MarkerType.ArrowClosed, 
          width: 20, 
          height: 20, 
          color: '#10b981' 
        },
      };
    });

    return { displayNodes: baseNodes, displayEdges: standardEdges };

  }, [nodes, edges, selectedNodeIds, shortestPathIds, hoveredNodeId, treatedNodeIds]);

  const onNodesChange = (changes: NodeChange[]) =>
    setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes: EdgeChange[]) =>
    setEdges((eds) => applyEdgeChanges(changes, eds));

  const getMiniMapNodeColor = (node: Node) => {
    if (node.data?.isTreated) return "#10b981"; // Emerald for treated
    if (node.data?.isPrevented) return "#e2e8f0"; // Slate for prevented

  switch (String(node.data?.type || "").toUpperCase()) {
    case "DEFICIENCY":
    case "HORMONE_IMBALANCE":
    case "GLANDULAR_DYSFUNCTION":
      return "#f59e0b"; // Root causes
    case "SYMPTOM":
      return "#3b82f6";
    case "DISEASE":
      return "#f43f5e";
    default:
      return "#cbd5e1";
  }
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onNodeClick={(event, node) => {
          // SHIFT-CLICK LOGIC
          let newSelection: string[] = [];
          if (event.shiftKey) {
            if (selectedNodeIds.includes(node.id)) {
              newSelection = selectedNodeIds.filter((id) => id !== node.id); // Toggle off
            } else if (selectedNodeIds.length >= 2) {
              newSelection = [selectedNodeIds[1], node.id]; // Keep max 2
            } else {
              newSelection = [...selectedNodeIds, node.id]; // Add second node
            }
          } else {
            newSelection = [node.id]; // Standard single click
          }

          setSelectedNodeIds(newSelection);
          onMultiSelect(newSelection);

          // Only show sidebar if exactly 1 node is selected
          onNodeSelect(newSelection.length === 1 ? node.data : null);
        }}
        onPaneClick={() => {
          setSelectedNodeIds([]);
          onMultiSelect([]);
          onNodeSelect(null);
        }}
        fitView
      >
        <Background color="#94a3b8" gap={24} size={2} />
        <Controls className="bg-white/80 backdrop-blur-md border border-slate-200 shadow-lg rounded-xl overflow-hidden p-1" />
        
        {/* 🔥 Heatmap Toggle Panel */}
        <Panel position="top-right" className="m-4">
          <button
            onClick={() => setIsHeatmapMode(!isHeatmapMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold shadow-md transition-all active:scale-95 border-2 ${
              isHeatmapMode 
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Flame className={`w-5 h-5 ${isHeatmapMode ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
            {isHeatmapMode ? 'Disable Heatmap' : 'Show Bottlenecks'}
          </button>
        </Panel>

        {/* 🔥 Heatmap Legend (Only shows when Heatmap is ON) */}
        {isHeatmapMode && (
          <Panel position="bottom-left" className="m-4 bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" /> Bottleneck Severity
            </h4>
            <div className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-200 animate-pulse"></div>
                <span>Critical (5+ downstream)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                <span>High (3-4 downstream)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <span>Moderate (1-2 downstream)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                <span className="text-slate-400">Dead End (0 downstream)</span>
              </div>
            </div>
          </Panel>
        )}

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