// src/components/Toolbar.jsx
function Toolbar({ tool, color, onToolChange, onColorChange }) {
  const tools = [
    { id: 'pen', name: 'Pen', icon: '✏️' },
    { id: 'text', name: 'Text', icon: 'T' },
    { id: 'eraser', name: 'Eraser', icon: '🧹' },
  ];

  const colors = [
    '#000000', // Black
    '#FF0000', // Red
    '#00FF00', // Green
    '#0000FF', // Blue
    '#FFFF00', // Yellow
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#FF8800', // Orange
  ];

  return (
    <div className="w-20 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-6 space-y-6 relative z-10 shadow-elevation-1">
      {/* Tools */}
      <div className="flex flex-col space-y-3">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => onToolChange(t.id)}
            className={`w-14 h-14 rounded-xl flex items-center justify-center transition-smooth ${
              tool === t.id
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-elevation-2 scale-105'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 hover:scale-105 hover:shadow-elevation-1'
            }`}
            title={t.name}
          >
            <span className="text-2xl">{t.icon}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-12 border-t border-slate-700" />

      {/* Colors (only for pen and text tools) */}
      {(tool === 'pen' || tool === 'text') && (
        <div className="flex flex-col space-y-3">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className={`w-10 h-10 rounded-full border-2 transition-smooth ${
                color === c
                  ? 'border-white shadow-elevation-2 scale-110 ring-2 ring-blue-400/50'
                  : 'border-slate-600 hover:scale-105 hover:border-slate-500 hover:shadow-elevation-1'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Toolbar;