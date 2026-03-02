// src/components/Toolbar.jsx
function Toolbar({ tool, color, eraserSize, onToolChange, onColorChange, onEraserSizeChange }) {
  const tools = [
    {
      id: 'pen', name: 'Pen',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M16 3l5 5-11 11H5v-5L16 3z"/></svg>
    },
    {
      id: 'text', name: 'Text',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M10 6v12M14 6v12M7 18h10"/></svg>
    },
    {
      id: 'eraser', name: 'Eraser',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17h6l9-9a2.121 2.121 0 00-3-3l-9 9v6zM14 6l4 4"/></svg>
    },
  ];

  const colors = [
    '#ffffff', '#e5e5e5', '#888888', '#444444',
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  ];

  return (
    <aside className="flex flex-col gap-4 px-2.5 py-4 border-r flex-shrink-0" style={{ width: '56px', background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.07)' }}>
      {/* Tools */}
      <div className="flex flex-col items-center gap-1">
        {tools.map(t => (
          <button
            key={t.id}
            onClick={() => onToolChange(t.id)}
            title={t.name}
            className="w-9 h-9 rounded-lg flex items-center justify-center t"
            style={
              tool === t.id
                ? { background: '#ffffff', color: '#0a0a0a' }
                : { background: 'transparent', color: '#555', border: '1px solid transparent' }
            }
            onMouseEnter={e => { if (tool !== t.id) e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { if (tool !== t.id) e.currentTarget.style.color = '#555'; }}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

      {/* Color swatches (pen / text only) */}
      {(tool === 'pen' || tool === 'text') && (
        <div className="flex flex-col items-center gap-1.5">
          {colors.map(c => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              title={c}
              className="w-5 h-5 rounded t flex-shrink-0"
              style={{
                background: c,
                outline: color === c ? '2px solid #fff' : '2px solid transparent',
                outlineOffset: '2px',
                border: c === '#ffffff' ? '1px solid rgba(255,255,255,0.2)' : 'none',
              }}
            />
          ))}
          {/* Active color larger preview */}
          <div className="w-full h-px my-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <div className="w-6 h-6 rounded-md" style={{ background: color, border: '1px solid rgba(255,255,255,0.15)' }} title={`Active: ${color}`} />
        </div>
      )}

      {/* Eraser size */}
      {tool === 'eraser' && (
        <div className="flex flex-col items-center gap-3">
          <div
            className="rounded-full flex-shrink-0"
            style={{
              width: Math.max(6, Math.min(eraserSize * 0.5, 36)),
              height: Math.max(6, Math.min(eraserSize * 0.5, 36)),
              background: 'rgba(255,255,255,0.25)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          />
          <input
            type="range" min={5} max={80} value={eraserSize}
            onChange={e => onEraserSizeChange(Number(e.target.value))}
            className="cursor-pointer"
            style={{ writingMode: 'vertical-lr', direction: 'rtl', width: '4px', height: '80px', accentColor: '#fff' }}
            title={`Eraser: ${eraserSize}px`}
          />
          <span className="mono text-center leading-none" style={{ fontSize: '9px', color: '#555' }}>{eraserSize}</span>
        </div>
      )}
    </aside>
  );
}

export default Toolbar;