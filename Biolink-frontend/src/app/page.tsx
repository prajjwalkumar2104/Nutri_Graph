'use client';

import { useState, useEffect, useRef } from 'react';
import CascadeGraph from '@/components/CascadeGraph';
import SearchBar from '@/components/SearchBar';
import Sidebar from '@/components/Sidebar';
import UploadModal from '@/components/UploadModal';
import { 
  Activity, LayoutGrid, ChevronLeft, Link as LinkIcon, Combine, 
  ArrowRight, ShieldAlert, Cpu, HeartPulse, Stethoscope, ChevronDown 
} from 'lucide-react';

interface RootEntity {
  id: string;
  name: string;
  description: string;
  type: string;
}

export default function Home() {
  // 1. APP ROUTING STATE
  const [activeView, setActiveView] = useState<'landing' | 'catalog' | 'graph'>('landing');
  
  // 2. DATA STATES
  const [roots, setRoots] = useState<RootEntity[]>([]);
  const [selectedRoots, setSelectedRoots] = useState<string[]>([]);
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [shortestPathIds, setShortestPathIds] = useState<string[] | null>(null);
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

  // 3. CATEGORIZED DATA (Edge Case: Normalize strings to prevent case-sensitive mismatches)
  const vitaminRoots = roots.filter(r => 
    r.type.toLowerCase().includes('vitamin') || r.type.toLowerCase().includes('mineral')
  );
  
  const hormonalRoots = roots.filter(r => 
    r.type.toLowerCase().includes('hormone') || r.type.toLowerCase().includes('endocrine')
  );

  const otherRoots = roots.filter(r => 
    !vitaminRoots.includes(r) && !hormonalRoots.includes(r)
  );

  // 4. HANDLERS
  const toggleRootSelection = (id: string) => {
    setSelectedRoots((prev) => 
      prev.includes(id) ? prev.filter(rootId => rootId !== id) : [...prev, id]
    );
  };

  const handleUploadSuccess = (data: any) => {
    if (data.rootIds && data.rootIds.length > 0) {
      setSelectedRoots(data.rootIds);
      setActiveView('graph');
      resetCanvasState();
    } else {
      alert("AI found no direct matches in the database.");
    }
  };

  const handleSearchSelect = (id: string) => {
    setSelectedRoots([id]);
    setActiveView('graph');
    resetCanvasState();
  };

  const resetCanvasState = () => {
    setSelectedNodeData(null);
    setSelectedNodeIds([]);
    setShortestPathIds(null);
    setTreatedNodeIds([]);
  };

  const handleCalculatePath = async () => {
    if (selectedNodeIds.length !== 2) return;
    setIsCalculatingPath(true);
    
    try {
      const res = await fetch(`http://localhost:5000/api/pathfinder?startNodeId=${selectedNodeIds[0]}&endNodeId=${selectedNodeIds[1]}`);
      if (res.ok) {
        const data = await res.json();
        setShortestPathIds(data.path);
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
      prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId] 
    );
  };

  // ==========================================
  // VIEW 1: THE LANDING PAGE (4 Scrolls)
  // ==========================================
  if (activeView === 'landing') {
    return (
      <div className="w-full bg-slate-50 text-slate-800 overflow-x-hidden font-sans smooth-scroll selection:bg-blue-200">
        
        {/* Scroll 1: Hero Intro */}
        <section className="relative min-h-screen flex flex-col justify-center items-center px-6 text-center pt-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-slate-50 -z-10" />
          <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl mb-8 animate-bounce shadow-sm">
            <Activity size={40} />
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 max-w-4xl">
            Decode the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-amber-500">Biological Butterfly Effect</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mb-12 font-medium leading-relaxed">
            BioCascade is an enterprise systems biology platform. We visualize how isolated deficiencies trigger massive, interconnected pathological cascades.
          </p>
          <button 
            onClick={() => setActiveView('catalog')}
            className="group flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full font-bold text-lg hover:bg-blue-600 transition-all shadow-xl hover:shadow-blue-500/30 hover:-translate-y-1"
          >
            Launch BioCascade App <ArrowRight className="group-hover:translate-x-1 transition-transform" />
          </button>
          
          <div className="absolute bottom-10 animate-pulse text-slate-400 flex flex-col items-center">
            {/* <span className="text-sm font-semibold mb-2 tracking-widest uppercase">Scroll to Explore</span> */}
            {/* <ChevronDown /> */}
          </div>
        </section>

        {/* Scroll 2: The Problem */}
        <section className="min-h-screen flex items-center px-6 py-24 bg-white">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                <ShieldAlert size={32} />
              </div>
              <h2 className="text-4xl font-bold mb-6">A single deficiency is never just a single problem.</h2>
              <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                Modern medicine often treats symptoms in isolation. However, the human body is a directed acyclic graph (DAG) of biochemical reactions. 
              </p>
              <p className="text-lg text-slate-600 leading-relaxed font-medium">
                A simple <span className="text-amber-600 font-bold">Vitamin D deficiency</span> doesn't just lower calcium absorption. Over years, it silently degrades bone density, disrupts immune regulation, alters insulin secretion, and ultimately acts as the invisible root cause for chronic autoimmune diseases and metabolic syndromes.
              </p>
            </div>
            <div className="relative h-96 bg-slate-100 rounded-3xl border border-slate-200 shadow-inner overflow-hidden flex items-center justify-center p-8">
               <div className="absolute w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-3xl" />
               <img src="/api/placeholder/600/400" alt="Graph visualization placeholder" className="relative z-10 rounded-xl shadow-lg border border-slate-200 opacity-80" />
            </div>
          </div>
        </section>

        {/* Scroll 3: What We Solve */}
        <section className="min-h-screen flex items-center px-6 py-24 bg-slate-900 text-slate-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-16 text-center">What BioCascade Solves</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 hover:border-blue-500 transition-colors">
                <Stethoscope className="text-blue-400 w-12 h-12 mb-6" />
                <h3 className="text-2xl font-bold mb-4 text-white">Siloed Diagnostics</h3>
                <p className="text-slate-400 leading-relaxed">
                  Endocrinologists and Nutritionists rarely cross-reference data. We merge hormonal and nutritional pathways into a single, unified topological map.
                </p>
              </div>
              <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 hover:border-amber-500 transition-colors">
                <HeartPulse className="text-amber-400 w-12 h-12 mb-6" />
                <h3 className="text-2xl font-bold mb-4 text-white">Root Cause Analysis</h3>
                <p className="text-slate-400 leading-relaxed">
                  Trace downstream symptoms back to their origins. By identifying bottleneck nodes in the graph, we find the exact biomarker causing the cascade.
                </p>
              </div>
              <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 hover:border-emerald-500 transition-colors">
                <Cpu className="text-emerald-400 w-12 h-12 mb-6" />
                <h3 className="text-2xl font-bold mb-4 text-white">Treatment Simulation</h3>
                <p className="text-slate-400 leading-relaxed">
                  Before prescribing, simulate the treatment. Our algorithms calculate which downstream chronic conditions are prevented by intervening early.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Scroll 4: How It Works & CTA */}
        <section className="min-h-[80vh] flex flex-col justify-center items-center px-6 py-24 bg-slate-50 text-center">
          <h2 className="text-4xl font-bold mb-12 text-slate-900">How the Engine Works</h2>
          <div className="flex flex-col md:flex-row gap-6 max-w-5xl mx-auto mb-16">
            <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="text-blue-600 font-bold text-xl mb-2">01. Upload Data</div>
              <p className="text-slate-600 text-sm">Provide standard lab reports (PDF/Images). Our UI accepts unstructured medical data securely.</p>
            </div>
            <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="text-amber-600 font-bold text-xl mb-2">02. AI Extraction</div>
              <p className="text-slate-600 text-sm">Gemini 2.5 Flash extracts critical out-of-range biomarkers and semantically maps them to our DB.</p>
            </div>
            <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="text-emerald-600 font-bold text-xl mb-2">03. Graph Generation</div>
              <p className="text-slate-600 text-sm">A multi-root BFS algorithm connects your deficiencies, dynamically generating the clinical UI.</p>
            </div>
          </div>
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' }) || setActiveView('catalog')}
            className="px-10 py-5 bg-blue-600 text-white rounded-full font-bold text-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-600/40 hover:-translate-y-1"
          >
            Enter the System
          </button>
        </section>
      </div>
    );
  }

  // ==========================================
  // APP LAYOUT WRAPPER (For Catalog & Graph)
  // ==========================================
  return (
    <main className="w-screen h-screen flex bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Global Modals & Overlays for App View */}
      {activeView === 'graph' && selectedNodeIds.length === 2 && !shortestPathIds && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50">
          <button 
            onClick={handleCalculatePath}
            disabled={isCalculatingPath}
            className="flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-full shadow-lg shadow-amber-500/30 transition-all hover:scale-105"
          >
            {isCalculatingPath ? <Activity className="w-5 h-5 animate-spin" /> : <LinkIcon className="w-5 h-5" />}
            {isCalculatingPath ? "Calculating Path..." : "Find Connection"}
          </button>
        </div>
      )}

      {activeView === 'catalog' && selectedRoots.length > 0 && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <button 
            onClick={() => { setActiveView('graph'); resetCanvasState(); }}
            className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-2xl transition-all hover:scale-105"
          >
            <Combine className="w-5 h-5" />
            Merge {selectedRoots.length} Systems 🧬
          </button>
        </div>
      )}

      <div className="absolute top-6 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-2xl">
          <SearchBar onSelect={handleSearchSelect} />
        </div>
      </div>

      <UploadModal onUploadSuccess={handleUploadSuccess} />

      {/* ==========================================
          VIEW 2: CATALOG GRID (Separated Sections)
          ========================================== */}
      {activeView === 'catalog' ? (
        <div className="w-full h-full pt-32 px-8 pb-24 overflow-y-auto max-w-7xl mx-auto flex flex-col justify-start">
          
          <button onClick={() => setActiveView('landing')} className="mb-8 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium w-fit transition-colors">
            <ChevronLeft size={18} /> Back to Intro
          </button>

          <div className="mb-12">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              <LayoutGrid className="w-8 h-8 text-blue-500" /> System Catalog
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Select elements across categories to merge their pathways.</p>
          </div>

          {isLoadingRoots ? (
             <div className="flex items-center justify-center py-20 text-slate-400 font-medium">
               <Activity className="w-6 h-6 animate-spin mr-3" /> Fetching Biomarkers...
             </div>
          ) : (
            <div className="space-y-16">
              
              {/* SECTION: VITAMINS & MINERALS */}
              <section>
                <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-amber-100">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Activity size={20} /></div>
                  <h2 className="text-2xl font-bold text-slate-800">Nutritional Deficiencies</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {vitaminRoots.map((root) => (
                    <RootCard key={root.id} root={root} isSelected={selectedRoots.includes(root.id)} onToggle={() => toggleRootSelection(root.id)} colorTheme="amber" />
                  ))}
                  {vitaminRoots.length === 0 && <p className="text-slate-400 italic">No nutritional roots found in DB.</p>}
                </div>
              </section>

              {/* SECTION: HORMONAL IMBALANCES */}
              <section>
                <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-rose-100">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><Activity size={20} /></div>
                  <h2 className="text-2xl font-bold text-slate-800">Endocrine & Hormonal</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hormonalRoots.map((root) => (
                    <RootCard key={root.id} root={root} isSelected={selectedRoots.includes(root.id)} onToggle={() => toggleRootSelection(root.id)} colorTheme="rose" />
                  ))}
                  {hormonalRoots.length === 0 && <p className="text-slate-400 italic">No hormonal roots found in DB.</p>}
                </div>
              </section>

              {/* SECTION: OTHERS (Fallback) */}
              {otherRoots.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">Other Systems</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {otherRoots.map((root) => (
                      <RootCard key={root.id} root={root} isSelected={selectedRoots.includes(root.id)} onToggle={() => toggleRootSelection(root.id)} colorTheme="blue" />
                    ))}
                  </div>
                </section>
              )}

            </div>
          )}
        </div>
      ) : (

        /* ==========================================
           VIEW 3: GRAPH CANVAS
           ========================================== */
        <div className={`flex-1 h-full relative transition-all duration-300 ${selectedNodeData ? 'w-[calc(100%-24rem)]' : 'w-full'}`}>
          <button
            onClick={() => setActiveView('catalog')}
            className="absolute top-6 left-6 z-40 flex items-center gap-2 px-4 h-12 bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm hover:shadow-md rounded-2xl text-slate-600 font-semibold text-sm transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" /> Return to Catalog
          </button>

          <CascadeGraph 
            key={selectedRoots.join('-')} 
            rootIds={selectedRoots} 
            onNodeSelect={(data) => setSelectedNodeData(data)}
            onMultiSelect={(ids) => { setSelectedNodeIds(ids); setShortestPathIds(null); }}
            shortestPathIds={shortestPathIds}
            treatedNodeIds={treatedNodeIds} 
          />
        </div>
      )}

      {/* Sidebar - Mounts conditionally if node is selected */}
      <Sidebar 
        nodeData={selectedNodeData} 
        onClose={() => setSelectedNodeData(null)} 
        isTreated={selectedNodeData ? treatedNodeIds.includes(selectedNodeData.id) : false}
        onToggleTreatment={handleToggleTreatment}
      />

    </main>
  );
}

// ---------------------------------------------------------
// HELPER COMPONENT: Reusable Card for Grid Items
// ---------------------------------------------------------
function RootCard({ root, isSelected, onToggle, colorTheme }: { root: RootEntity, isSelected: boolean, onToggle: () => void, colorTheme: 'amber' | 'rose' | 'blue' }) {
  
  // Dynamic Tailwind map to keep compiler happy
  const colors = {
    amber: { selected: 'border-amber-500 bg-amber-50/30 ring-amber-500/10 text-amber-700', icon: 'bg-amber-600 text-white', hoverIcon: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100' },
    rose: { selected: 'border-rose-500 bg-rose-50/30 ring-rose-500/10 text-rose-700', icon: 'bg-rose-600 text-white', hoverIcon: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100' },
    blue: { selected: 'border-blue-500 bg-blue-50/20 ring-blue-500/10 text-blue-700', icon: 'bg-blue-600 text-white', hoverIcon: 'bg-slate-100 text-slate-600 group-hover:text-blue-600' }
  };

  const theme = colors[colorTheme];

  return (
    <button
      onClick={onToggle}
      className={`group text-left p-6 border transition-all duration-200 flex flex-col justify-between h-44 active:scale-[0.99] rounded-3xl ${
        isSelected ? `${theme.selected} shadow-md ring-4` : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
      }`}
    >
      <div>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${isSelected ? theme.icon : theme.hoverIcon}`}>
          <Activity className="w-5 h-5" />
        </div>
        <h3 className={`font-bold text-lg mt-4 transition-colors ${isSelected ? theme.selected.split(' ')[4] : 'text-slate-800'}`}>
          {root.name}
        </h3>
        <p className="text-sm text-slate-500 line-clamp-2 mt-1 font-medium">{root.description}</p>
      </div>
    </button>
  );
}