// src/components/CustomNode.tsx
import { Handle, Position } from '@xyflow/react';
import { Activity, AlertTriangle, ShieldAlert, Flame } from 'lucide-react';

export default function CustomNode({ data }: { data: any }) {
  const isDeficiency = data.type === 'DEFICIENCY';
  const isDisease = data.type === 'DISEASE';

  // 🔥 Heatmap Logic
  const { isHeatmapMode, heatScore = 0 } = data;

 let nodeStyles = `relative w-[300px] rounded-2xl shadow-sm border-2 p-5 flex flex-col gap-2 transition-all duration-300 bg-white cursor-pointer hover:-translate-y-1 hover:shadow-xl `;
  
  if (isHeatmapMode) {
    if (heatScore === 0) {
      nodeStyles += 'border-slate-200 opacity-40 scale-95 grayscale hover:grayscale-0 hover:opacity-100';
    } else if (heatScore <= 2) {
      nodeStyles += 'border-amber-400 bg-amber-50 shadow-amber-100';
    } else if (heatScore <= 4) {
      nodeStyles += 'border-orange-500 bg-orange-50 shadow-orange-200 scale-105';
    } else {
      // 🔥 Added a continuous pulse animation to the biggest bottlenecks
      nodeStyles += 'border-red-600 bg-red-50 shadow-red-300 shadow-lg scale-110 z-50 animate-[pulse_2s_ease-in-out_infinite] ring-4 ring-red-500/30';
    }
  } else {
    nodeStyles += isDeficiency ? 'border-amber-400' : isDisease ? 'border-rose-400' : 'border-blue-400';
  }

  return (
    <div className={nodeStyles}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white" />

      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
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

        {/* Heat Score Badge */}
        {isHeatmapMode && heatScore > 0 && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
            ${heatScore >= 5 ? 'bg-red-200 text-red-700' : heatScore >= 3 ? 'bg-orange-200 text-orange-700' : 'bg-amber-200 text-amber-700'}`}>
            <Flame className="w-3 h-3" />
            {heatScore}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 line-clamp-4 font-medium leading-relaxed">
        {data.description}
      </p>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white" />
    </div>
  );
}