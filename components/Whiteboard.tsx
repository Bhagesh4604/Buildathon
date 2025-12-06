import { Tldraw, useEditor } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { forwardRef, useImperativeHandle, useState, useRef } from 'react'
import Draggable from 'react-draggable';
import { Resizable } from 're-resizable';

const WhiteboardEditor = forwardRef(({ onExplain, onMinimize }, ref) => {
  const editor = useEditor()

  useImperativeHandle(ref, () => ({
    addShapes(shapes) {
      editor.createShapes(shapes)
    },
    getShapes() {
      return editor.getCurrentPageShapes()
    }
  }));

  const handleExplain = () => {
    const shapes = editor.getCurrentPageShapes();
    onExplain(shapes);
  };

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 1000, display: 'flex', gap: '10px', padding: '10px' }}>
      <button
        onClick={handleExplain}
        style={{
          backgroundColor: 'white',
          border: '1px solid lightgray',
          borderRadius: '5px',
          padding: '10px',
          cursor: 'pointer'
        }}
      >
        Explain
      </button>
      <button
        onClick={onMinimize}
        style={{
          backgroundColor: 'white',
          border: '1px solid lightgray',
          borderRadius: '5px',
          padding: '10px',
          cursor: 'pointer'
        }}
      >
        Minimize
      </button>
    </div>
  )
})

export const Whiteboard = forwardRef(({ onExplain }, ref) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [size, setSize] = useState({ width: 600, height: 400 });
  const nodeRef = useRef(null);

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (isMinimized) {
    return (
      <Draggable nodeRef={nodeRef}>
        <div 
          ref={nodeRef}
          style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, cursor: 'pointer' }}
          onClick={handleMinimize}
        >
          <div style={{
            width: '200px',
            height: '50px',
            backgroundColor: '#f0f0f0',
            border: '1px solid lightgray',
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
          }}>
            Whiteboard
          </div>
        </div>
      </Draggable>
    )
  }

  return (
    <Draggable handle=".handle" nodeRef={nodeRef}>
      <div ref={nodeRef} style={{ position: 'fixed', zIndex: 1000 }}>
        <Resizable
          size={size}
          onResizeStop={(e, direction, ref, d) => {
            setSize({
              width: size.width + d.width,
              height: size.height + d.height,
            });
          }}
          style={{ border: '1px solid lightgray', borderRadius: '5px', backgroundColor: 'white' }}
        >
          <div className="handle" style={{ height: '40px', backgroundColor: '#f0f0f0', cursor: 'move', borderTopLeftRadius: '5px', borderTopRightRadius: '5px' }}></div>
          <Tldraw>
            <WhiteboardEditor ref={ref} onExplain={onExplain} onMinimize={handleMinimize} />
          </Tldraw>
        </Resizable>
      </div>
    </Draggable>
  )
})