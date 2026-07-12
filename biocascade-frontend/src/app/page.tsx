// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import CascadeGraph from '@/components/CascadeGraph';
import SearchBar from '@/components/SearchBar';

export default function Home() {
  // Initialize as null so it doesn't query a dead hardcoded UUID
  const [activeRootId, setActiveRootId] = useState<string | null>(null);

  // Automatically discover a valid default node on mount
  useEffect(() => {
    const bootstrapDefaultNode = async () => {
      try {
        // Query the search endpoint for any entity containing "Vitamin"
        const res = await fetch('http://127.0.0.1:5000/api/search?q=Vitamin');
        const data = await res.json();
        
        if (data && data.length > 0) {
          // Dynamically set the active ID to the first valid record returned
          setActiveRootId(data[0].id);
        }
      } catch (error) {
        console.error("Failed to bootstrap default graph node:", error);
      }
    };
    
    bootstrapDefaultNode();
  }, []);

  return (
    <main className="w-screen h-screen flex flex-col bg-slate-50 relative">
      {/* Floating Search Interface */}
      <SearchBar onSelectNode={(id) => setActiveRootId(id)} />
      
      <div className="flex-1 w-full relative">
        {activeRootId ? (
          <CascadeGraph key={activeRootId} rootId={activeRootId} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-semibold tracking-wide animate-pulse">
            Resolving pathological linkage paths...
          </div>
        )}
      </div>
    </main>
  );
}