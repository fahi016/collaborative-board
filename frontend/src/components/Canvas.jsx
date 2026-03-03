// src/components/Canvas.jsx
import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

const Canvas = forwardRef(({ tool, color, eraserSize = 20, onAction }, ref) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const actionsRef = useRef([]);
  const currentPathRef = useRef([]);
  const isDrawingRef = useRef(false);
  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);
  const rafRef = useRef(null);
  const dirtyRef = useRef(true);

  // Props kept in refs so event handlers never go stale
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const eraserSizeRef = useRef(eraserSize);
  const onActionRef = useRef(onAction);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { eraserSizeRef.current = eraserSize; }, [eraserSize]);
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);

  // Text editor
  const [textEditor, setTextEditor] = useState(null); // null | { screenX, screenY, worldX, worldY }
  const textareaRef = useRef(null);
  const committingRef = useRef(false); // guard against double-commit

  // ─── Canvas Setup ────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctxRef.current = ctx;
      dirtyRef.current = true;
    };
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  }, []);

  // ─── RAF Render Loop ─────────────────────────────────────────────────────────

  useEffect(() => {
    const loop = () => {
      if (dirtyRef.current) { redraw(); dirtyRef.current = false; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const markDirty = () => { dirtyRef.current = true; };

  // ─── Redraw ──────────────────────────────────────────────────────────────────

  const redraw = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h);
    const { x, y, scale } = viewportRef.current;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    for (const action of actionsRef.current) renderAction(ctx, action);
    ctx.restore();
  };

  const renderAction = (ctx, action) => {
    if (action.type === 'draw') paintPath(ctx, action.data.points, action.data.color, action.data.width);
    else if (action.type === 'erase') paintErase(ctx, action.data.points, action.data.width);
    else if (action.type === 'text') paintText(ctx, action.data);
  };

  const drawGrid = (ctx, w, h) => {
    const { x, y, scale } = viewportRef.current;
    const gridSize = 24 * scale;
    if (gridSize < 6) return;
    const ox = ((x % gridSize) + gridSize) % gridSize;
    const oy = ((y % gridSize) + gridSize) % gridSize;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let gx = ox; gx < w; gx += gridSize) {
      for (let gy = oy; gy < h; gy += gridSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // ─── Draw Primitives ─────────────────────────────────────────────────────────

  const paintPath = (ctx, points, strokeColor, lineWidth = 2) => {
    if (!points || points.length < 2) return;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  };

  const paintErase = (ctx, points, lineWidth = 20) => {
    if (!points || points.length < 2) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  const paintText = (ctx, { text, x, y, fontSize, color: textColor }) => {
    ctx.font = `500 ${fontSize}px 'DM Sans', sans-serif`;
    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);
  };

  // ─── Coordinates ─────────────────────────────────────────────────────────────

  const screenToWorld = (sx, sy) => {
    const { x, y, scale } = viewportRef.current;
    return { x: (sx - x) / scale, y: (sy - y) / scale };
  };

  const getScreenPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ─── Stroke Preview ──────────────────────────────────────────────────────────

  const previewSegment = (prev, next) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y, scale } = viewportRef.current;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (toolRef.current === 'pen') {
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    } else if (toolRef.current === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = eraserSizeRef.current;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  };

  // ─── Text Editor ─────────────────────────────────────────────────────────────

  // Called from textarea keydown (Enter) or the Commit button
  const commitText = (editorState) => {
    if (committingRef.current) return;
    committingRef.current = true;
    const value = textareaRef.current?.value ?? '';
    const text = value.trim();
    setTextEditor(null);
    committingRef.current = false;
    if (!text || !editorState) return;
    const action = {
      type: 'text',
      data: { text, x: editorState.worldX, y: editorState.worldY, fontSize: 16, color: colorRef.current },
    };
    actionsRef.current.push(action);
    markDirty();
    onActionRef.current(action);
  };

  const handleTextareaKeyDown = (e, editorState) => {
    e.stopPropagation(); // prevent Space/etc triggering canvas shortcuts
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(editorState); }
    else if (e.key === 'Escape') { setTextEditor(null); }
  };

  // ─── Mouse Events ────────────────────────────────────────────────────────────

  const handleMouseDown = (e) => {
    // If text editor is open, clicking canvas should commit it (not cancel)
    // We use onMouseDown on the canvas, which fires AFTER the textarea's onBlur
    // but we deliberately do NOT use onBlur to commit — we use explicit actions only.
    if (toolRef.current === 'text') {
      if (textEditor) {
        // Commit current editor, then open a new one at new position
        commitText(textEditor);
      }
      const s = getScreenPos(e);
      const world = screenToWorld(s.x, s.y);
      setTextEditor({ screenX: s.x, screenY: s.y, worldX: world.x, worldY: world.y });
      return;
    }

    if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
      e.preventDefault();
      isPanningRef.current = true;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;

    isDrawingRef.current = true;
    const s = getScreenPos(e);
    currentPathRef.current = [screenToWorld(s.x, s.y)];
  };

  const handleMouseMove = (e) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanPosRef.current.x;
      const dy = e.clientY - lastPanPosRef.current.y;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      viewportRef.current = { ...viewportRef.current, x: viewportRef.current.x + dx, y: viewportRef.current.y + dy };
      markDirty();
      return;
    }
    if (!isDrawingRef.current) return;
    const s = getScreenPos(e);
    const world = screenToWorld(s.x, s.y);
    const path = currentPathRef.current;
    if (path.length > 0) previewSegment(path[path.length - 1], world);
    path.push(world);
  };

  const handleMouseUp = () => {
    if (isPanningRef.current) { isPanningRef.current = false; return; }
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const path = currentPathRef.current;
    currentPathRef.current = [];
    if (path.length < 2) return;
    let action = null;
    if (toolRef.current === 'pen') action = { type: 'draw', data: { points: path, color: colorRef.current, width: 2 } };
    else if (toolRef.current === 'eraser') action = { type: 'erase', data: { points: path, width: eraserSizeRef.current } };
    if (action) { actionsRef.current.push(action); markDirty(); onActionRef.current(action); }
  };

  // Focus textarea whenever textEditor state is set
  useEffect(() => {
    if (textEditor) {
      // rAF ensures the textarea is in the DOM
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [textEditor]);

  // ─── Wheel Zoom ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.003);
      const vp = viewportRef.current;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor));
      const sc = newScale / vp.scale;
      viewportRef.current = { scale: newScale, x: mx - sc * (mx - vp.x), y: my - sc * (my - vp.y) };
      markDirty();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // ─── Keyboard ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const isTypingContext = (eventTarget) => {
      const target = eventTarget || document.activeElement;
      if (!target) return false;

      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        return true;
      }

      // Extra safety: if focus is inside chat input wrapper, never hijack Space.
      if (typeof target.closest === 'function' && target.closest('[data-chat-input]')) {
        return true;
      }

      const active = document.activeElement;
      if (!active) return false;
      const activeTag = active.tagName;
      return activeTag === 'INPUT' || activeTag === 'TEXTAREA' || active.isContentEditable;
    };

    const down = (e) => {
      if (e.code === 'Space' && !textEditor) {
        if (isTypingContext(e.target)) return;
        e.preventDefault();
        spaceDownRef.current = true;
      }
    };
    const up = (e) => {
      if (e.code === 'Space') {
        if (isTypingContext(e.target)) return;
        spaceDownRef.current = false;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [textEditor]);

  // ─── Public API ──────────────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    loadState: (canvasData) => {
      try { actionsRef.current = JSON.parse(canvasData); markDirty(); }
      catch (err) { console.error('Failed to parse canvas data:', err); }
    },
    applyRemoteAction: (message) => {
      if (!message?.type || !message?.data) return;
      actionsRef.current.push({ type: message.type, data: message.data, timestamp: message.timestamp });
      markDirty();
    },
  }));

  // ─── Zoom Controls ───────────────────────────────────────────────────────────

  const zoomBy = (factor) => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const cx = canvas.width / dpr / 2;
    const cy = canvas.height / dpr / 2;
    const vp = viewportRef.current;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor));
    const sc = newScale / vp.scale;
    viewportRef.current = { scale: newScale, x: cx - sc * (cx - vp.x), y: cy - sc * (cy - vp.y) };
    markDirty();
  };

  const resetView = () => { viewportRef.current = { x: 0, y: 0, scale: 1 }; markDirty(); };

  return (
    <div className="relative flex-1 overflow-hidden" style={{ background: '#0f0f0f' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative h-full w-full"
        style={{ cursor: tool === 'pen' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'text' }}
      />

      {/* Inline text editor — no onBlur, committed only via Enter or clicking canvas */}
      {textEditor && (
        <div
          style={{
            position: 'absolute',
            left: textEditor.screenX,
            top: textEditor.screenY,
            transformOrigin: 'top left',
            transform: `scale(${viewportRef.current.scale})`,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 4,
          }}
        >
          <textarea
            key={`editor-${textEditor.screenX}-${textEditor.screenY}`}
            ref={textareaRef}
            rows={1}
            onKeyDown={(e) => handleTextareaKeyDown(e, textEditor)}
            onChange={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
              e.target.style.width = 'auto';
              e.target.style.width = Math.max(140, e.target.scrollWidth + 16) + 'px';
            }}
            style={{
              background: 'rgba(0,0,0,0.6)',
              border: `1.5px solid ${color}`,
              borderRadius: 4,
              outline: 'none',
              color: color,
              font: `500 16px 'DM Sans', sans-serif`,
              lineHeight: '1.5',
              resize: 'none',
              overflow: 'hidden',
              minWidth: 140,
              padding: '4px 8px',
              caretColor: color,
              whiteSpace: 'pre',
            }}
            placeholder="Type here…"
          />
          {/* Explicit action buttons — avoids all blur/focus issues */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onMouseDown={(e) => { e.preventDefault(); commitText(textEditor); }}
              style={{
                background: color, color: '#000', border: 'none', borderRadius: 3,
                fontSize: 11, padding: '2px 8px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Done
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); setTextEditor(null); }}
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#aaa', border: 'none', borderRadius: 3,
                fontSize: 11, padding: '2px 8px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Zoom buttons */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1" style={{ zIndex: 10 }}>
        {[
          { label: '+', fn: () => zoomBy(1.25), title: 'Zoom in' },
          { label: '−', fn: () => zoomBy(0.8),  title: 'Zoom out' },
          { label: '⌂', fn: resetView,           title: 'Reset view' },
        ].map(({ label, fn, title }) => (
          <button key={label} onClick={fn} title={title} style={{
            width: 32, height: 32, background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
            color: '#fff', fontSize: label === '⌂' ? 14 : 18, cursor: 'pointer',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{label}</button>
        ))}
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6, padding: '3px 10px', color: 'rgba(255,255,255,0.25)',
        fontSize: 11, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        {tool === 'text'
          ? 'Click to place · Enter or Done to commit · Esc to cancel'
          : 'Scroll to zoom · Middle-click or Space+drag to pan'}
      </div>
    </div>
  );
});

Canvas.displayName = 'Canvas';
export default Canvas;
