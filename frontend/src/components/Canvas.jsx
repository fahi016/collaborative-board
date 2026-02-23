// src/components/Canvas.jsx
import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

const Canvas = forwardRef(({ tool, color, userColor, onAction }, ref) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [actions, setActions] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      // Get context
      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.lineJoin = 'round';
      contextRef.current = context;

      // Redraw all actions
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    loadState: (canvasData) => {
      try {
        const parsedActions = JSON.parse(canvasData);
        setActions(parsedActions);
      } catch (error) {
        console.error('Failed to parse canvas data:', error);
      }
    },
    applyRemoteAction: (message) => {
      const newAction = {
        type: message.type,
        data: message.data,
        timestamp: message.timestamp,
      };
      setActions((prev) => [...prev, newAction]);
    },
  }));

  // Redraw canvas with all actions
  useEffect(() => {
    redrawCanvas();
  }, [actions]);

  const redrawCanvas = () => {
    const context = contextRef.current;
    if (!context) return;

    // Clear canvas
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Redraw all actions
    actions.forEach((action) => {
      if (action.type === 'draw') {
        drawPath(action.data.points, action.data.color, action.data.width);
      } else if (action.type === 'text') {
        drawText(
          action.data.text,
          action.data.x,
          action.data.y,
          action.data.fontSize,
          action.data.color
        );
      } else if (action.type === 'erase') {
        erasePath(action.data.points, action.data.width);
      }
    });
  };

  const drawPath = (points, strokeColor, lineWidth = 2) => {
    const context = contextRef.current;
    if (!context || points.length < 2) return;

    context.strokeStyle = strokeColor;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      context.lineTo(points[i].x, points[i].y);
    }

    context.stroke();
  };

  const drawText = (text, x, y, fontSize, textColor) => {
    const context = contextRef.current;
    if (!context) return;

    context.font = `${fontSize}px Arial`;
    context.fillStyle = textColor;
    context.fillText(text, x, y);
  };

  const erasePath = (points, lineWidth = 20) => {
    const context = contextRef.current;
    if (!context || points.length < 2) return;

    context.globalCompositeOperation = 'destination-out';
    context.lineWidth = lineWidth;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      context.lineTo(points[i].x, points[i].y);
    }

    context.stroke();
    context.globalCompositeOperation = 'source-over';
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e) => {
    if (tool === 'text') {
      handleTextTool(e);
      return;
    }

    setIsDrawing(true);
    const pos = getMousePos(e);
    setCurrentPath([pos]);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;

    const pos = getMousePos(e);
    setCurrentPath((prev) => [...prev, pos]);

    // Draw preview
    if (tool === 'pen') {
      const context = contextRef.current;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.beginPath();
      if (currentPath.length > 0) {
        context.moveTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y);
      }
      context.lineTo(pos.x, pos.y);
      context.stroke();
    } else if (tool === 'eraser') {
      const context = contextRef.current;
      context.globalCompositeOperation = 'destination-out';
      context.lineWidth = 20;
      context.lineCap = 'round';
      context.beginPath();
      if (currentPath.length > 0) {
        context.moveTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y);
      }
      context.lineTo(pos.x, pos.y);
      context.stroke();
      context.globalCompositeOperation = 'source-over';
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPath.length < 2) {
      setCurrentPath([]);
      return;
    }

    // Create action
    let action = null;

    if (tool === 'pen') {
      action = {
        type: 'draw',
        data: {
          points: currentPath,
          color: color,
          width: 2,
        },
      };
    } else if (tool === 'eraser') {
      action = {
        type: 'erase',
        data: {
          points: currentPath,
          width: 20,
        },
      };
    }

    if (action) {
      // Add to local actions
      setActions((prev) => [...prev, action]);

      // Send to server
      onAction(action);
    }

    setCurrentPath([]);
  };

  const handleTextTool = (e) => {
    const pos = getMousePos(e);
    const text = window.prompt('Enter text:');

    if (text && text.trim()) {
      const action = {
        type: 'text',
        data: {
          text: text.trim(),
          x: pos.x,
          y: pos.y,
          fontSize: 16,
          color: color,
        },
      };

      setActions((prev) => [...prev, action]);
      onAction(action);
    }
  };

  return (
    <div className="flex-1 bg-slate-900 relative">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full ${
          tool === 'pen' ? 'cursor-crosshair' : tool === 'eraser' ? 'cursor-cell' : 'cursor-text'
        }`}
      />
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;