'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Activity } from 'lucide-react';

interface SearchResult {
  id: string;
  name: string;
  type: string;
  description: string;
  matchConfidence?: number; // Semantic similarity score
}

export default function SearchBar({ onSelect }: { onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Semantic Search Fetch
  useEffect(() => {
    const fetchSemanticResults = async () => {
      if (!query.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsSearching(true);
      setIsOpen(true);

      try {
        // Hitting our new Vector Semantic Search Endpoint!
        const res = await fetch(`http://localhost:5000/search/semantic?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (error) {
        console.error("Semantic search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };

    // 300ms delay so we don't calculate vectors on every single keystroke
    const debounceTimer = setTimeout(fetchSemanticResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  return (
    <div className="relative w-full max-w-2xl mx-auto z-50" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative flex items-center w-full h-14 rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200 shadow-sm focus-within:shadow-md focus-within:border-blue-400 transition-all">
        <Search className="w-5 h-5 text-slate-400 ml-4 mr-2" />
        <input
          type="text"
          className="w-full h-full bg-transparent outline-none text-slate-700 placeholder:text-slate-400 font-medium"
          placeholder="Describe a symptom (e.g. 'My gums are bleeding easily')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query) setIsOpen(true); }}
        />
        {isSearching && <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-4" />}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-16 left-0 w-full bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="max-h-[400px] overflow-y-auto p-2 space-y-1">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  onClick={() => {
                    onSelect(result.id);
                    setIsOpen(false);
                    setQuery(''); // Optional: clear query after selection
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-start gap-4 group"
                >
                  <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                    ${result.type === 'DEFICIENCY' ? 'bg-amber-100 text-amber-600' : 
                      result.type === 'SYMPTOM' ? 'bg-blue-100 text-blue-600' : 
                      'bg-rose-100 text-rose-600'}`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800">{result.name}</span>
                      {result.matchConfidence && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          {result.matchConfidence}% Match
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">{result.description}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No Results Fallback */}
      {isOpen && !isSearching && query && results.length === 0 && (
        <div className="absolute top-16 left-0 w-full bg-white border border-slate-200 shadow-xl rounded-2xl p-6 text-center">
          <p className="text-slate-500 font-medium">No pathological links found for that description.</p>
        </div>
      )}
    </div>
  );
}