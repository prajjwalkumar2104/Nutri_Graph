// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import CascadeGraph from '@/components/CascadeGraph';
import SearchBar from '@/components/SearchBar';
import Sidebar from '@/components/Sidebar';
import { Activity, LayoutGrid, ChevronLeft, Link as LinkIcon, Combine } from 'lucide-react';

interface RootEntity {
  id: string;
  name: string;
  description: string;
  type: string;
}

export default function Home() {
  const [roots, setRoots] = useState<RootEntity[]>([]);
  
  // 🔥 Upgraded to Array for Multi-Root Merging
  const [selectedRoots, setSelectedRoots] = useState<string[]>([]);
  const [isGraphActive, setIsGraphActive] = useState(false);
  
  // State for single node selection (Sidebar)
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);
  
  // State for multi-node selection (Algorithm Traversal)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [shortestPathIds, setShortestPathIds] = useState<string[] | null>(null);

  // Treatment Mode State
  const [treatedNodeIds, setTreatedNodeIds] = useState<string[]>([]);

  const [isLoadingRoots, setIsLoadingRoots] = useState(true);
  const [isCalculatingPath, setIsCalculatingPath] = useState(false);

  useEffect(() => {
    const fetchRoots = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/roots');
        if (res.ok) {
          const data = await res.json();
          setRoots(data);
        }
      } catch (err) {
        console.error("Failed to bootstrap catalog grid:", err);
      } finally {
        setIsLoadingRoots(false);
      }
    };
    fetchRoots();
  }, []);

  // 🔥 Toggle selection for multiple roots in the grid
  const toggleRootSelection = (id: string) => {
    setSelectedRoots((prev) => 
      prev.includes(id) 
        ? prev.filter(rootId => rootId !== id) // Remove if already selected
        : [...prev, id] // Add if not selected
    );
  };

  // Triggered when clicking a SearchBar result
  const handleSearchSelect = (id: string) => {
    setSelectedRoots([id]); // Overwrite selection with searched item
    setIsGraphActive(true); // Jump straight to graph
    resetCanvasState();
  };

  // Resets all interactive canvas states
  const resetCanvasState = () => {
    setSelectedNodeData(null);
    setSelectedNodeIds([]);
    setShortestPathIds(null);
    setTreatedNodeIds([]);
  };

  // Return to the home grid
  const handleBackToGrid = () => {
    setIsGraphActive(false);
    setSelectedRoots([]);
    resetCanvasState();
  };

  const handleCalculatePath = async () => {
    if (selectedNodeIds.length !== 2) return;
    setIsCalculatingPath(true);
    
    try {
      const res = await fetch(`http://localhost:5000/api/pathfinder?startNodeId=${selectedNodeIds[0]}&endNodeId=${selectedNodeIds[1]}`);
      
      if (res.ok) {
        const data = await res.json();
        setShortestPathIds(data.path); // Injects the glowing path into the graph!
      } else {
        alert("No biological link exists between these two nodes.");
        setShortestPathIds(null);
      }
    } catch (error) {
      console.error("Failed to calculate path:", error);
    } finally {
      setIsCalculatingPath(false);
    }
  };

  const handleToggleTreatment = (nodeId: string) => {
    setTreatedNodeIds((prev) => 
      prev.includes(nodeId) 
        ? prev.filter(id => id !== nodeId) 
        : [...prev, nodeId] 
    );
  };

  return (
    <main className="w-screen h-screen flex bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Floating Action Button for Pathfinding (Only shows in Graph View) */}
      {isGraphActive && selectedNodeIds.length === 2 && !shortestPathIds && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50">
          <button 
            onClick={handleCalculatePath}
            disabled={isCalculatingPath}
            className="flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-full shadow-lg shadow-amber-500/30 transition-all hover:scale-105 active:scale-95"
          >
            {isCalculatingPath ? (
              <Activity className="w-5 h-5 animate-spin" />
            ) : (
              <LinkIcon className="w-5 h-5" />
            )}
            {isCalculatingPath ? "Calculating Path..." : "Find Connection"}
          </button>
        </div>
      )}

      {/* 🔥 Floating Action Button for Merging Systems (Only shows in Grid View) */}
      {!isGraphActive && selectedRoots.length > 0 && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <button 
            onClick={() => {
              setIsGraphActive(true);
              resetCanvasState();
            }}
            className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            <Combine className="w-5 h-5" />
            Merge {selectedRoots.length} Systems 🧬
          </button>
        </div>
      )}

      {/* Dynamic Command Palette - Floats on both views */}
      <div className="absolute top-6 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-2xl">
          <SearchBar onSelect={handleSearchSelect} />
        </div>
      </div>

      {/* VIEW 1: LANDING CATALOG GRID */}
      {!isGraphActive ? (
        <div className="w-full h-full pt-32 px-8 pb-12 overflow-y-auto max-w-7xl mx-auto flex flex-col justify-start">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              <LayoutGrid className="w-8 h-8 text-blue-500" />
              Biochemical Cascade Catalog
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              Select multiple systems to merge them, or use the semantic search bar to chart complete pathological impact structures.
            </p>
          </div>

          {isLoadingRoots ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-44 bg-slate-200/60 rounded-3xl border border-slate-200" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
              {roots.map((root) => {
                const isSelected = selectedRoots.includes(root.id);
                return (
                  <button
                    key={root.id}
                    onClick={() => toggleRootSelection(root.id)}
                    className={`group text-left p-6 border transition-all duration-200 flex flex-col justify-between h-44 active:scale-[0.99] rounded-3xl ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50/20 shadow-md ring-4 ring-blue-500/10' 
                        : 'bg-white border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-amber-50 text-amber-600 group-hover:bg-blue-50 group-hover:text-blue-600'
                      }`}>
                        <Activity className="w-5 h-5" />
                      </div>
                      <h3 className={`font-bold text-lg mt-4 transition-colors ${
                        isSelected ? 'text-blue-700' : 'text-slate-800 group-hover:text-blue-600'
                      }`}>
                        {root.name}
                      </h3>
                      <p className="text-sm text-slate-500 line-clamp-2 mt-1 font-medium">{root.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        
        // VIEW 2: REACT FLOW KNOWLEDGE CANVAS
        <div 
          className={`flex-1 h-full relative transition-all duration-300 ${
            selectedNodeData ? 'w-[calc(100%-24rem)]' : 'w-full'
          }`}
        >
          {/* Back button to clear state and return to home catalog */}
          <button
            onClick={handleBackToGrid}
            className="absolute top-6 left-6 z-40 flex items-center gap-2 px-4 h-12 bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm hover:shadow-md rounded-2xl text-slate-600 font-semibold text-sm transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            Return to Grid
          </button>

          <CascadeGraph 
            key={selectedRoots.join('-')} 
            rootIds={selectedRoots} // 🔥 Passing the ARRAY to your updated Graph component!
            onNodeSelect={(data) => setSelectedNodeData(data)}
            onMultiSelect={(ids) => {
               setSelectedNodeIds(ids);
               setShortestPathIds(null); 
            }}
            shortestPathIds={shortestPathIds}
            treatedNodeIds={treatedNodeIds} 
          />
        </div>
      )}

      {/* VIEW 3: INTERACTIVE SIDEBAR SUMMARY PANEL */}
      <Sidebar 
        nodeData={selectedNodeData} 
        onClose={() => setSelectedNodeData(null)} 
        isTreated={selectedNodeData ? treatedNodeIds.includes(selectedNodeData.id) : false}
        onToggleTreatment={handleToggleTreatment}
      />

    </main>
  );
}