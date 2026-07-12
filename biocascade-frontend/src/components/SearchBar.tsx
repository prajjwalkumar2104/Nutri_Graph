// src/components/SearchBar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface SearchResult {
  id: string;
  name: string;
  type: string;
}

interface SearchBarProps {
  onSelectNode: (id: string) => void;
}

export default function SearchBar({ onSelectNode }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown if user clicks outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch results as user types
  useEffect(() => {
    const fetchSearch = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/search?q=${query}`);
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch (error) {
        console.error("Search failed:", error);
      }
    };

    // Simple debounce to prevent spamming the backend
    const timeoutId = setTimeout(() => fetchSearch(), 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <div ref={wrapperRef} className="absolute top-6 left-6 z-50 w-80">
      <div className="relative">
       <input
          type="text"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder-slate-400 font-medium"
          placeholder="Search a deficiency or disease..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClick={() => query.length >= 2 && setIsOpen(true)}
        />
        <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-hidden">
          {results.map((result) => (
            <li
              key={result.id}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
              onClick={() => {
                onSelectNode(result.id);
                setIsOpen(false);
                setQuery(result.name); // Autofill the box with their selection
              }}
            >
              <div className="font-semibold text-slate-800">{result.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{result.type}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}