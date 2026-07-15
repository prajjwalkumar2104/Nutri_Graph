// src/components/Sidebar.tsx
import { X, ExternalLink, Activity, AlertCircle, HeartPulse, Skull } from 'lucide-react';

interface SidebarProps {
  nodeData: any | null;
  onClose: () => void;
}

export default function Sidebar({ nodeData, onClose }: SidebarProps) {
  const isOpen = nodeData !== null;

  const getTypeConfig = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'DEFICIENCY': return { color: 'text-amber-600', bg: 'bg-amber-100', icon: <AlertCircle size={20} /> };
      case 'SYMPTOM': return { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Activity size={20} /> };
      case 'CONDITION': return { color: 'text-purple-600', bg: 'bg-purple-100', icon: <HeartPulse size={20} /> };
      case 'DISEASE': return { color: 'text-rose-600', bg: 'bg-rose-100', icon: <Skull size={20} /> };
      default: return { color: 'text-slate-600', bg: 'bg-slate-100', icon: <Activity size={20} /> };
    }
  };

  const config = nodeData ? getTypeConfig(nodeData.type) : getTypeConfig('');

  return (
    <div 
      className={`absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-slate-200 flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {nodeData && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${config.bg} ${config.color}`}>
                {config.icon}
              </div>
              <span className={`text-xs font-black uppercase tracking-widest ${config.color}`}>
                {nodeData.type}
              </span>
            </div>
            
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex-1 overflow-y-auto">
            <h2 className="text-2xl font-extrabold text-slate-800 mb-4 leading-tight">
              {nodeData.label}
            </h2>
            
            <div className="prose prose-slate prose-sm mb-8">
              <h4 className="text-slate-400 uppercase tracking-wider text-xs font-semibold mb-2">Clinical Summary</h4>
              <p className="text-slate-600 leading-relaxed text-base">
                {nodeData.description || "No clinical description available in the database for this specific node."}
              </p>
            </div>

            <a 
              href={`https://en.wikipedia.org/wiki/${encodeURIComponent(nodeData.label)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium transition-colors shadow-sm"
            >
              Read Medical Literature <ExternalLink size={16} />
            </a>
          </div>
        </>
      )}
    </div>
  );
}