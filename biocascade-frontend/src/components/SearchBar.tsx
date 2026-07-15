// src/components/SearchBar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Activity, AlertCircle, HeartPulse, Skull, ChevronRight, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSelectNode: (id: string) => void;
}

export default function SearchBar({ onSelectNode }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown if user clicks outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Search API Call
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.slice(0, 8)); // Keep UI clean by limiting to top 8 results
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // 300ms delay to prevent spamming your backend on every keystroke
    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (id: string, name: string) => {
    setQuery(name); // Fill input with selected name
    setIsOpen(false);
    onSelectNode(id);
  };

  const getIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'DEFICIENCY': return <AlertCircle size={16} className="text-amber-500" />;
      case 'SYMPTOM': return <Activity size={16} className="text-blue-500" />;
      case 'CONDITION': return <HeartPulse size={16} className="text-purple-500" />;
      case 'DISEASE': return <Skull size={16} className="text-rose-500" />;
      default: return <Activity size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl" ref={dropdownRef}>
      
      {/* The Main Input Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 size={20} className="text-slate-400 animate-spin" />
          ) : (
            <Search size={20} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          )}
        </div>
        
        <input
          type="text"
          className="w-full bg-white/90 backdrop-blur-md border border-slate-200 text-slate-800 text-lg rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 block pl-12 pr-4 py-4 shadow-xl transition-all outline-none"
          placeholder="Search for a deficiency, symptom, or disease..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClick={() => query.trim().length >= 2 && setIsOpen(true)}
        />
        
        {/* Keyboard shortcut hint (purely visual polish) */}
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
            Ctrl K
          </span>
        </div>
      </div>

      {/* The Autocomplete Dropdown Menu */}
      {isOpen && results.length > 0 && (
        <div className="absolute mt-2 w-full bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="max-h-96 overflow-y-auto py-2">
            {results.map((node) => (
              <li key={node.id}>
                <button
                  className="w-full text-left px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                  onClick={() => handleSelect(node.id, node.name)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors border border-slate-200/50">
                      {getIcon(node.type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                        {node.name}
                      </h4>
                      <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase mt-0.5">
                        {node.type}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {isOpen && results.length === 0 && !isLoading && query.length >= 2 && (
        <div className="absolute mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-center">
          <p className="text-slate-500 font-medium">No pathways found for "{query}"</p>
        </div>
      )}

    </div>
  );
}