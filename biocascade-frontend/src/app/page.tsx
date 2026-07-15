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
        const res = await fetch('http://127.0.0.1:5000/api/search?q=Vitamin');
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
    <main className="w-screen h-screen flex flex-col bg-slate-50 relative overflow-hidden">
      
      <SearchBar onSelectNode={handleSearchSelect} />
      
      {/* We wrap the graph in a transition div so it slightly shifts left when the sidebar opens */}
      <div 
        className={`flex-1 w-full relative transition-all duration-300 ease-in-out ${
          selectedNodeData ? 'pr-96' : 'pr-0'
        }`}
      >
        {activeRootId ? (
          <CascadeGraph 
            key={activeRootId} 
            rootId={activeRootId} 
            // FIX: This passes the clicked node data up to this page component
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