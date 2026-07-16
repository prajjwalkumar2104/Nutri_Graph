// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import CascadeGraph from '@/components/CascadeGraph';
import SearchBar from '@/components/SearchBar';
import Sidebar from '@/components/Sidebar';

export default function Home() {
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  
  // State to track which node was clicked on the canvas
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);

  useEffect(() => {
    const bootstrapDefaultNode = async () => {
      try {
        // 🔥 FIX 1: Updated to hit the new Semantic Search endpoint!
        const res = await fetch('http://localhost:5000/search/semantic?query=Vitamin');
        const data = await res.json();
        if (data && data.length > 0) setActiveRootId(data[0].id);
      } catch (error) {
        console.error("Failed to bootstrap default graph node:", error);
      }
    };
    bootstrapDefaultNode();
  }, []);

  // When a user searches a new tree, close the sidebar automatically
  const handleSearchSelect = (id: string) => {
    setActiveRootId(id);
    setSelectedNodeData(null); 
  };

  return (
    <main className="w-screen h-screen flex bg-slate-50 relative overflow-hidden">
      
      {/* 🔥 FIX 2: Made the SearchBar float cleanly over the top of the canvas */}
      <div className="absolute top-6 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center">
        {/* We re-enable pointer events just for the search bar itself */}
        <div className="pointer-events-auto w-full max-w-2xl">
          {/* 🔥 FIX 3: Changed onSelectNode to onSelect to match the component */}
          <SearchBar onSelect={handleSearchSelect} />
        </div>
      </div>
      
      {/* The Graph Canvas Wrapper */}
      <div 
        className={`flex-1 h-full relative transition-all duration-300 ease-in-out ${
          selectedNodeData ? 'w-[calc(100%-24rem)]' : 'w-full'
        }`}
      >
        {activeRootId ? (
          <CascadeGraph 
            key={activeRootId} 
            rootId={activeRootId} 
            onNodeSelect={(data) => setSelectedNodeData(data)} 
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-semibold tracking-wide animate-pulse">
            Resolving pathological linkage paths...
          </div>
        )}
      </div>

      {/* The Interactive Sidebar */}
      <Sidebar 
        nodeData={selectedNodeData} 
        onClose={() => setSelectedNodeData(null)} 
      />

    </main>
  );
}