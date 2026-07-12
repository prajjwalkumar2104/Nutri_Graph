// src/components/CustomNode.tsx
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, Activity, HeartPulse, Skull } from 'lucide-react';

export default function CustomNode({ data }: { data: any }) {
  // 1. Dynamic Styling based on the Entity Type
  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'DEFICIENCY':
        return { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', icon: <AlertCircle size={18} /> };
      case 'SYMPTOM':
        return { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', icon: <Activity size={18} /> };
      case 'CONDITION':
        return { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', icon: <HeartPulse size={18} /> };
      case 'DISEASE':
        return { bg: 'bg-rose-50', border: 'border-rose-500', text: 'text-rose-700', icon: <Skull size={18} /> };
      default:
        return { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-600', icon: <Activity size={18} /> };
    }
  };

  const styles = getTypeStyles(data.type);

  return (
    <div className={`w-72 shadow-lg rounded-2xl border-2 ${styles.border} ${styles.bg} p-4 transition-transform hover:scale-105`}>
      {/* Target Handle (Top) - Where incoming lines connect */}
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400 border-2 border-white" />
      
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg bg-white shadow-sm ${styles.text}`}>
          {styles.icon}
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-sm leading-tight">{data.label}</h3>
          <span className={`text-[10px] font-black uppercase tracking-wider ${styles.text}`}>
            {data.type}
          </span>
        </div>
      </div>
      
      {data.description && (
        <p className="text-xs text-slate-600 mt-2 leading-relaxed border-t border-slate-200/60 pt-2">
          {data.description}
        </p>
      )}

      {/* Source Handle (Bottom) - Where outgoing lines connect */}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400 border-2 border-white" />
    </div>
  );
}