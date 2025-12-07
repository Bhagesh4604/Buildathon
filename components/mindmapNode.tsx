import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChevronRight, Circle, MinusCircle, ZoomIn } from 'lucide-react';
import { cn } from '../lib/utils';

// Interface for the data passed to the custom node
export interface MindmapNodeData {
  label: string;
  depth: number;
  theme: string;
  isCollapsed: boolean;
  hasChildren: boolean;
  onToggle: (id: string) => void;
  onExpand: (label: string) => void;
}

// Visual themes corresponding to NotebookLM-style colors
const themeStyles: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-400',
  green: 'border-green-200 bg-green-50 text-green-900 hover:border-green-400',
  orange: 'border-orange-200 bg-orange-50 text-orange-900 hover:border-orange-400',
  purple: 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400',
  rose: 'border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-400',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900 hover:border-cyan-400',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400',
  default: 'border-gray-200 bg-white text-gray-900 hover:border-gray-300',
  root: 'border-indigo-500 bg-indigo-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50 hover:scale-105',
};

export const MindmapNode = memo(({ data, id }: NodeProps<MindmapNodeData>) => {
  const { label, depth, theme, isCollapsed, hasChildren, onToggle, onExpand } = data;

  const styleClass = depth === 0 
    ? themeStyles.root 
    : themeStyles[theme] || themeStyles.default;

  return (
    <div className="relative group flex items-center">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-transparent !border-none !w-0" // Hide standard handles visually
      />
      
      <div 
        className={cn(
          "px-6 py-3 rounded-full border-2 text-sm font-semibold transition-all duration-300 shadow-sm flex items-center justify-center min-w-[140px] max-w-[300px]",
          styleClass,
          depth > 0 && "cursor-default"
        )}
      >
        <span className="truncate leading-tight">{label}</span>
      </div>

      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(id);
          }}
          className={cn(
            "absolute -right-3 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all z-10 hover:scale-110",
            depth === 0 ? "text-indigo-600" : "text-gray-400"
          )}
          title={isCollapsed ? "Expand Branch" : "Collapse Branch"}
        >
          {isCollapsed ? (
             <ChevronRight className="w-4 h-4" />
          ) : (
             <MinusCircle className="w-3 h-3" />
          )}
        </button>
      )}

      {depth > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand(label);
          }}
          className="absolute -left-3 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-400 hover:bg-green-50 hover:text-green-600 transition-all z-10 hover:scale-110"
          title="Expand Topic"
        >
          <ZoomIn className="w-3 h-3" />
        </button>
      )}

      <Handle 
        type="source" 
        position={Position.Right} 
        className="!bg-transparent !border-none !w-0"
      />
    </div>
  );
});

MindmapNode.displayName = 'MindmapNode';