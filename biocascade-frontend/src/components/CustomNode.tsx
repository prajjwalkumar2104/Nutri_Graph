// src/components/CustomNode.tsx
import { Handle, Position } from '@xyflow/react';
import { Activity, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function CustomNode({ data }: { data: any }) {
  // Determine colors based on entity type
  const isDeficiency = data.type === 'DEFICIENCY';
  const isDisease = data.type === 'DISEASE';

  return (
    <div 
      className={`relative w-[300px] bg-white rounded-2xl shadow-sm border-2 p-5 flex flex-col gap-2 transition-all 
      ${isDeficiency ? 'border-amber-400' : isDisease ? 'border-rose-400' : 'border-blue-400'}`}
    >
      {/* ⬇️ INCOMING CONNECTION (TOP) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-slate-300 border-2 border-white"
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 mb-1">
        {isDeficiency && <AlertTriangle className="w-4 h-4 text-amber-500" />}
        {isDisease && <ShieldAlert className="w-4 h-4 text-rose-500" />}
        {!isDeficiency && !isDisease && <Activity className="w-4 h-4 text-blue-500" />}
        
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 text-sm leading-tight">{data.label}</span>
          <span className={`text-[10px] font-extrabold uppercase tracking-wider 
            ${isDeficiency ? 'text-amber-600' : isDisease ? 'text-rose-600' : 'text-blue-600'}`}
          >
            {data.type}
          </span>
        </div>
      </div>

      {/* Node Body */}
      <p className="text-xs text-slate-500 line-clamp-4 font-medium leading-relaxed">
        {data.description}
      </p>

      {/* ⬆️ OUTGOING CONNECTION (BOTTOM) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-slate-300 border-2 border-white"
      />
    </div>
  );
}