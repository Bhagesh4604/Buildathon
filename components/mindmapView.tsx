import 'reactflow/dist/style.css';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, { 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  Position,
  Node,
  Edge,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { MindmapData } from '@/types';
import { MindmapNode, MindmapNodeData } from '@/components/mindmapNode';

interface MindmapViewProps {
  data: MindmapData;
}

// Register custom node types
const nodeTypes = {
  mindmap: MindmapNode,
};

// Layout Configuration
const NODE_WIDTH = 250;
const NODE_HEIGHT = 60;
const X_SPACING = 350; // Horizontal gap between levels
const Y_SPACING = 80;  // Vertical gap between nodes

export const MindmapView: React.FC<MindmapViewProps> = ({ data }) => {
  return (
    <ReactFlowProvider>
      <MindmapFlow data={data} />
    </ReactFlowProvider>
  );
};

const MindmapFlow: React.FC<MindmapViewProps> = ({ data }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { fitView } = useReactFlow();

  // Reset collapse state when data changes (new generation)
  useEffect(() => {
    setCollapsedIds(new Set());
  }, [data]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // --- LAYOUT ENGINE ---
  const calculateLayout = useCallback(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return;

    // 1. Build Tree Structure
    const nodeMap = new Map<string, any>();
    const childrenMap = new Map<string, string[]>();
    let rootId: string | null = null;

    data.nodes.forEach(node => {
      nodeMap.set(node.id, { ...node });
      if (!childrenMap.has(node.id)) childrenMap.set(node.id, []);
      
      if (node.parentId) {
        if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
        childrenMap.get(node.parentId)!.push(node.id);
      } else {
        rootId = node.id;
      }
    });

    if (!rootId) return;

    // 2. Traversal for Themes & Positions
    let yCursor = 0;
    const layoutNodes: Node[] = [];
    const layoutEdges: Edge[] = [];

    // Helper to assign themes if missing
    const assignTheme = (id: string, inheritedTheme: string) => {
      const node = nodeMap.get(id);
      // If node doesn't have a theme, use parent's (inherited)
      // If it's the root, ignore
      // If it has a theme, use it
      if (!node.theme && inheritedTheme) node.theme = inheritedTheme;
      
      const children = childrenMap.get(id) || [];
      children.forEach(childId => assignTheme(childId, node.theme));
    };
    assignTheme(rootId, ''); // Start propagation

    // Recursive Position Calculator
    // Returns the center Y coordinate of the subtree rooted at 'id'
    const processNode = (id: string, depth: number): number => {
      const node = nodeMap.get(id);
      const children = childrenMap.get(id) || [];
      const isCollapsed = collapsedIds.has(id);
      const hasVisibleChildren = children.length > 0 && !isCollapsed;

      let myY: number;

      if (hasVisibleChildren) {
        // Calculate Y for all children
        const childrenYs = children.map(childId => processNode(childId, depth + 1));
        
        // Center parent relative to children
        const minY = Math.min(...childrenYs);
        const maxY = Math.max(...childrenYs);
        myY = (minY + maxY) / 2;
      } else {
        // Leaf node (or collapsed parent acting as leaf)
        myY = yCursor;
        yCursor += Y_SPACING;
      }

      // Create ReactFlow Node
      layoutNodes.push({
        id: node.id,
        type: 'mindmap',
        position: { x: depth * X_SPACING, y: myY },
        data: {
          label: node.label,
          depth: depth,
          theme: node.theme || 'default',
          isCollapsed: isCollapsed,
          hasChildren: children.length > 0,
          onToggle: toggleCollapse
        } as MindmapNodeData,
      });

      // Create Edges
      if (node.parentId) {
        layoutEdges.push({
          id: `e-${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          type: 'smoothstep', // Or 'bezier' for curvier lines
          animated: true,
          style: { 
            stroke: depth === 1 ? '#94a3b8' : '#cbd5e1', 
            strokeWidth: depth === 1 ? 2 : 1.5,
          },
        });
      }

      return myY;
    };

    processNode(rootId, 0);

    setNodes(layoutNodes);
    setEdges(layoutEdges);

  }, [data, collapsedIds, toggleCollapse, setNodes, setEdges]);

  // Recalculate layout whenever dependencies change
  useEffect(() => {
    calculateLayout();
  }, [calculateLayout]);

  // Initial Fit View
  useEffect(() => {
     // Small delay to ensure nodes are rendered before fitting
     const timer = setTimeout(() => {
       fitView({ padding: 0.2, duration: 800 });
     }, 100);
     return () => clearTimeout(timer);
  }, [data, fitView]);

  return (
    <div className={`transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-50' : 'w-full h-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200 relative'}`}>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={true}
        nodesConnectable={true}
        zoomOnScroll={true}
        minZoom={0.1}
        maxZoom={4}
        attributionPosition="bottom-right"
      >
        <MiniMap 
          nodeStrokeColor="#cbd5e1" 
          nodeColor="#f1f5f9" 
          maskColor="rgba(240, 242, 245, 0.7)"
          style={{ height: 100, width: 150 }}
        />
        <Controls className="bg-white shadow-lg border border-gray-100 rounded-lg overflow-hidden" />
        <Background gap={24} size={1} color="#e2e8f0" />
      </ReactFlow>

      {/* Toolbar */}
      <div className="absolute top-4 right-4 flex space-x-2 z-10">
        <button 
          onClick={() => fitView({ padding: 0.2, duration: 800 })}
          className="p-2 bg-white rounded-lg shadow-md border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-all"
          title="Reset View"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 bg-white rounded-lg shadow-md border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-all"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};