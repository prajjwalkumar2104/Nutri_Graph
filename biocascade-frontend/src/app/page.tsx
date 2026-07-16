'use client';

import { useState, useEffect } from 'react';
import CascadeGraph from '@/components/CascadeGraph';
import SearchBar from '@/components/SearchBar';
import Sidebar from '@/components/Sidebar';
import { Activity, LayoutGrid, ChevronLeft } from 'lucide-react';

interface RootEntity {
  id: string;
  name: string;
  description: string;
  type: string;
}

export default function Home() {
  const [roots, setRoots] = useState<RootEntity[]>([]);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);
  const [isLoadingRoots, setIsLoadingRoots] = useState(true);

  // 1. Fetch all unique vitamins and minerals for the catalog view
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

  const handleSelectRoot = (id: string) => {
    setActiveRootId(id);
    setSelectedNodeData(null); // Clear sidebars between tree shifts
  };

  return (
    <main className="w-screen h-screen flex bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Dynamic Command Palette - Floats on both views */}
      <div className="absolute top-6 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-2xl">
          <SearchBar onSelect={handleSelectRoot} />
        </div>
      </div>

      {/* VIEW 1: LANDING CATALOG GRID */}
      {!activeRootId ? (
        <div className="w-full h-full pt-28 px-8 overflow-y-auto max-w-7xl mx-auto flex flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              <LayoutGrid className="w-8 h-8 text-blue-500" />
              Biochemical Cascade Catalog
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              Select a foundational micronutrient or use the semantic search bar to chart complete pathological impact structures.
            </p>
          </div>

          {isLoadingRoots ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-40 bg-slate-200/60 rounded-3xl border border-slate-200" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
              {roots.map((root) => (
                <button
                  key={root.id}
                  onClick={() => handleSelectRoot(root.id)}
                  className="group text-left p-6 bg-white border border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-md rounded-3xl transition-all duration-200 flex flex-col justify-between h-44 active:scale-[0.99]"
                >
                  <div>
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Activity className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mt-4 group-hover:text-blue-600 transition-colors">{root.name}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-1 font-medium">{root.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        
        // VIEW 2: REACT FLOW KNOWLEDGE CANVAS
        <div 
          className={`flex-1 h-full relative transition-all duration-300 ease-in-out ${
            selectedNodeData ? 'w-[calc(100%-24rem)]' : 'w-full'
          }`}
        >
          {/* Back button to clear state and return to home catalog */}
          <button
            onClick={() => {
              setActiveRootId(null);
              setSelectedNodeData(null);
            }}
            className="absolute top-6 left-6 z-40 flex items-center gap-2 px-4 h-12 bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm hover:shadow-md rounded-2xl text-slate-600 font-semibold text-sm transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            Return to Grid
          </button>

          <CascadeGraph 
            key={activeRootId} 
            rootId={activeRootId} 
            onNodeSelect={(data) => setSelectedNodeData(data)} 
          />
        </div>
      )}

      {/* VIEW 3: INTERACTIVE SIDEBAR SUMMARY PANEL */}
      <Sidebar 
        nodeData={selectedNodeData} 
        onClose={() => setSelectedNodeData(null)} 
      />

    </main>
  );
}