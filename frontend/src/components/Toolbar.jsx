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
    <div className="w-20 bg-gray-800 flex flex-col items-center py-4 space-y-4">
      {/* Tools */}
      <div className="flex flex-col space-y-2">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => onToolChange(t.id)}
            className={`w-14 h-14 rounded-lg flex items-center justify-center transition ${
              tool === t.id
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={t.name}
          >
            <span className="text-2xl">{t.icon}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-12 border-t border-gray-600" />

      {/* Colors (only for pen and text tools) */}
      {(tool === 'pen' || tool === 'text') && (
        <div className="flex flex-col space-y-2">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className={`w-10 h-10 rounded-full border-2 transition ${
                color === c
                  ? 'border-white shadow-lg scale-110'
                  : 'border-gray-600 hover:scale-105'
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