import { useState, useRef, useEffect } from 'react'

const GRID_ROWS = 5
const GRID_COLS = 5

const BLOCKS = [
  { key: 'header',  label: 'Header',  icon: '📋' },
  { key: 'status',  label: 'Status',  icon: '📡' },
  { key: 'ranking', label: 'Ranking', icon: '🏆' },
  { key: 'media',   label: 'Mídia',   icon: '🎞️' },
]

export const DEFAULT_LAYOUT = {
  header:  { row: 1, col: 1, rowSpan: 1, colSpan: 5 },
  status:  { row: 2, col: 1, rowSpan: 4, colSpan: 1 },
  ranking: { row: 2, col: 2, rowSpan: 4, colSpan: 4 },
  media:   { row: 2, col: 4, rowSpan: 2, colSpan: 2 },
}

export function LayoutEditor({ layout, onLayoutChange, hiddenBlocks = new Set(), onToggleBlock }) {
  const [editingLayout, setEditingLayout] = useState(() => ({ ...DEFAULT_LAYOUT, ...layout }))
  const [draggedKey, setDraggedKey] = useState(null)
  const [selectedKey, setSelectedKey] = useState(null)
  const [hoveredCell, setHoveredCell] = useState(null)
  const gridRef = useRef(null)
  const draggedKeyRef = useRef(null)
  const hoveredCellRef = useRef(null)

  useEffect(() => { draggedKeyRef.current = draggedKey }, [draggedKey])
  useEffect(() => { hoveredCellRef.current = hoveredCell }, [hoveredCell])

  useEffect(() => {
    if (!draggedKey) return

    const handleMouseMove = (e) => {
      if (!gridRef.current) return
      const rect = gridRef.current.getBoundingClientRect()
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        setHoveredCell(null)
        return
      }
      const col = Math.max(1, Math.min(GRID_COLS, Math.ceil((e.clientX - rect.left) / (rect.width / GRID_COLS))))
      const row = Math.max(1, Math.min(GRID_ROWS, Math.ceil((e.clientY - rect.top) / (rect.height / GRID_ROWS))))
      setHoveredCell({ row, col })
    }

    const handleMouseUp = () => {
      const cell = hoveredCellRef.current
      const key = draggedKeyRef.current
      if (cell && key) {
        setEditingLayout(prev => {
          const s = prev[key]
          const newRow = Math.max(1, Math.min(GRID_ROWS - s.rowSpan + 1, cell.row))
          const newCol = Math.max(1, Math.min(GRID_COLS - s.colSpan + 1, cell.col))
          return { ...prev, [key]: { ...s, row: newRow, col: newCol } }
        })
      }
      setDraggedKey(null)
      setHoveredCell(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggedKey])

  const startDrag = (e, key) => {
    e.preventDefault()
    setDraggedKey(key)
  }

  const handleResize = (key, prop, delta) => {
    const s = editingLayout[key]
    const newValue = prop === 'rowSpan'
      ? Math.max(1, Math.min(GRID_ROWS - s.row + 1, s.rowSpan + delta))
      : Math.max(1, Math.min(GRID_COLS - s.col + 1, s.colSpan + delta))
    setEditingLayout(prev => ({ ...prev, [key]: { ...prev[key], [prop]: newValue } }))
  }

  const activeBlocks = BLOCKS.filter(b => !hiddenBlocks.has(b.key))
  const selectedBlock = BLOCKS.find(b => b.key === selectedKey)
  const sel = selectedKey ? editingLayout[selectedKey] : null

  return (
    <div className="layout-editor">
      <p className="settings-description" style={{ margin: '0 0 8px' }}>Blocos ativos:</p>
      <div className="block-toggles">
        {BLOCKS.map(({ key, label, icon }) => (
          <label key={key} className={`block-toggle-label${!hiddenBlocks.has(key) ? ' active' : ''}`}>
            <input
              type="checkbox"
              checked={!hiddenBlocks.has(key)}
              onChange={() => onToggleBlock && onToggleBlock(key)}
            />
            <span>{icon} {label}</span>
          </label>
        ))}
      </div>

      <p className="layout-hint">Arraste para mover • Clique para selecionar e redimensionar</p>

      <div className="grid-preview-wrapper">
        <div
          ref={gridRef}
          className="grid-preview-grid"
          style={{
            gridTemplateRows: `repeat(${GRID_ROWS}, 58px)`,
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          }}
        >
          {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
            const row = Math.floor(i / GRID_COLS) + 1
            const col = (i % GRID_COLS) + 1
            const isTarget = draggedKey && hoveredCell?.row === row && hoveredCell?.col === col
            return (
              <div
                key={`cell-${row}-${col}`}
                className={`grid-cell${isTarget ? ' grid-cell-target' : ''}`}
                style={{ gridRow: row, gridColumn: col }}
              />
            )
          })}

          {activeBlocks.map(({ key, label, icon }) => {
            const s = editingLayout[key]
            const isDragging = draggedKey === key
            const isSelected = selectedKey === key
            return (
              <div
                key={key}
                className={`grid-block${isDragging ? ' grid-block-dragging' : ''}${isSelected ? ' grid-block-selected' : ''}`}
                style={{
                  gridRowStart: s.row,
                  gridRowEnd: Math.min(s.row + s.rowSpan, GRID_ROWS + 1),
                  gridColumnStart: s.col,
                  gridColumnEnd: Math.min(s.col + s.colSpan, GRID_COLS + 1),
                }}
                onMouseDown={e => startDrag(e, key)}
                onClick={e => {
                  e.stopPropagation()
                  setSelectedKey(selectedKey === key ? null : key)
                }}
              >
                <span className="grid-block-icon">{icon}</span>
                <span className="grid-block-label">{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="resize-panel">
        {selectedBlock && sel && !hiddenBlocks.has(selectedKey) ? (
          <>
            <div className="resize-panel-title">
              {selectedBlock.icon} {selectedBlock.label}
              <span className="resize-panel-size">{sel.colSpan}×{sel.rowSpan} colunas×linhas</span>
            </div>
            <div className="resize-panel-row">
              <span className="resize-panel-label">Altura</span>
              <div className="resize-panel-btns">
                <button className="resize-btn" disabled={sel.rowSpan <= 1} onClick={() => handleResize(selectedKey, 'rowSpan', -1)}>−</button>
                <span className="resize-panel-val">{sel.rowSpan}</span>
                <button className="resize-btn" disabled={sel.row + sel.rowSpan > GRID_ROWS} onClick={() => handleResize(selectedKey, 'rowSpan', 1)}>+</button>
              </div>
              <span className="resize-panel-label" style={{ marginLeft: 16 }}>Largura</span>
              <div className="resize-panel-btns">
                <button className="resize-btn" disabled={sel.colSpan <= 1} onClick={() => handleResize(selectedKey, 'colSpan', -1)}>−</button>
                <span className="resize-panel-val">{sel.colSpan}</span>
                <button className="resize-btn" disabled={sel.col + sel.colSpan > GRID_COLS} onClick={() => handleResize(selectedKey, 'colSpan', 1)}>+</button>
              </div>
            </div>
          </>
        ) : (
          <p className="resize-panel-empty">Clique em um bloco ativo para redimensionar</p>
        )}
      </div>

      <div className="layout-editor-actions">
        <button className="layout-btn-secondary" onClick={() => { setEditingLayout({ ...DEFAULT_LAYOUT }); setSelectedKey(null) }}>
          Resetar
        </button>
        <button className="layout-btn-primary" onClick={() => onLayoutChange(editingLayout)}>
          Aplicar Layout
        </button>
      </div>
    </div>
  )
}
