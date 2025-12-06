import React, { useState, useEffect } from 'react';
import ReactFlow, { MiniMap, Controls, Background, useNodesState, useEdgesState, Position } from 'reactflow';
import 'reactflow/dist/style.css';

const MindmapGenerator: React.FC = () => {
  const [content, setContent] = useState('');
  const [mindmap, setMindmap] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (mindmap) {
      const { nodes: mindmapNodes, title } = mindmap;

      const initialNodes = mindmapNodes.map((node: any, index: number) => ({
        id: node.id,
        position: { x: index * 250, y: Math.random() * 400 },
        data: { label: node.text },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      }));

      const initialEdges = mindmapNodes
        .filter((node: any) => node.parent)
        .map((node: any) => ({
          id: `e${node.parent}-${node.id}`,
          source: node.parent,
          target: node.id,
          animated: true,
        }));

      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [mindmap, setNodes, setEdges]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setMindmap(null);
    setNodes([]);
    setEdges([]);


    try {
      const response = await fetch('http://localhost:5000/mindmap/generate-mindmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate mindmap');
      }

      const data = await response.json();
      setMindmap(data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4" style={{ height: '100vh' }}>
      <h1 className="text-2xl font-bold mb-4">AI Mindmap Generator</h1>
      <div className="input-section mb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter a topic, text, or your notes here..."
          className="w-full h-40 p-2 border rounded"
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded disabled:bg-gray-400"
        >
          {isLoading ? 'Generating...' : 'Generate Mindmap'}
        </button>
      </div>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div style={{ height: '70%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
};

export default MindmapGenerator;

