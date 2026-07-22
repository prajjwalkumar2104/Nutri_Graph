// src/components/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Sparkles, Activity, Apple, Zap, Loader2, CheckCircle2 } from 'lucide-react';

interface SidebarProps {
  nodeData: any | null;
  onClose: () => void;
  isTreated: boolean; 
  onToggleTreatment: (nodeId: string) => void;
}

interface AIData {
  clinicalSummary: string;
  treatmentAndSources: string[];
  absorptionTips: string[];
}

export default function Sidebar({ nodeData, onClose, isTreated, onToggleTreatment }: SidebarProps) {
  const [aiData, setAiData] = useState<AIData | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // EDGE CASE PREVENTER: Reset AI state if user clicks a new node while sidebar is open
  useEffect(() => {
    setAiData(null);
    setAiError(null);
    setIsAiLoading(false);
  }, [nodeData?.label]);

  if (!nodeData) {
    return (
      <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 transform translate-x-full transition-transform duration-300 z-50 shadow-2xl" />
    );
  }

  const wikiUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(nodeData.name || nodeData.label)}`;

  const getTypeColor = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'DEFICIENCY': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'SYMPTOM': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'DISEASE': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleFetchAI = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('http://localhost:5000/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nodeData.label || nodeData.name,
          type: nodeData.type,
          description: nodeData.description
        })
      });

      if (!res.ok) throw new Error("Failed to fetch AI insights");
      const data = await res.json();
      setAiData(data);
    } catch (err) {
      console.error(err);
      setAiError("AI analysis temporarily unavailable.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-slate-50 border-l border-slate-200 transform translate-x-0 transition-transform duration-300 z-50 shadow-2xl overflow-y-auto flex flex-col">
      
      {/* HEADER SECTION */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-200 p-6 flex justify-between items-start">
        <div>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-3 ${getTypeColor(nodeData.type)}`}>
            {nodeData.type}
          </span>
          <h2 className="text-2xl font-extrabold text-slate-800 leading-tight">
            {nodeData.label || nodeData.name}
          </h2>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* BASE CONTENT SECTION */}
      <div className="p-6 space-y-6 flex-1">
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Base Description</h3>
          <p className="text-slate-600 leading-relaxed font-medium">
            {nodeData.description}
          </p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-200">

          {/* 🔥 NEW TREATMENT BUTTON */}
          <button 
            onClick={() => onToggleTreatment(nodeData.id)}
            className={`flex items-center justify-center gap-2 w-full py-3 px-4 font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98] ${
              isTreated 
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200' 
                : 'bg-white border border-emerald-500 text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            {isTreated ? <CheckCircle2 className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
            {isTreated ? "Cancel Treatment" : "Apply Clinical Treatment"}
          </button>
          
          <a 
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            <ExternalLink className="w-4 h-4" />
            Learn more on Wikipedia
          </a>

          {!aiData && (
            <button 
              onClick={handleFetchAI}
              disabled={isAiLoading}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isAiLoading ? "Analyzing cascade..." : "Generate AI Summary"}
            </button>
          )}
          
          {aiError && <p className="text-red-500 text-sm text-center font-medium mt-1">{aiError}</p>}
        </div>

        {/* AI GENERATED CONTENT SECTION */}
        {aiData && (
          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-indigo-700 mb-2">
                <Activity className="w-4 h-4" /> Clinical Summary
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">{aiData.clinicalSummary}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-emerald-700 mb-3">
                <Apple className="w-4 h-4" /> Sources & Treatment
              </h3>
              <ul className="space-y-2">
                {aiData.treatmentAndSources.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span className="leading-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm mb-6">
              <h3 className="flex items-center gap-2 font-bold text-amber-600 mb-3">
                <Zap className="w-4 h-4" /> Absorption Mechanics
              </h3>
              <ul className="space-y-2">
                {aiData.absorptionTips.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span className="leading-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}