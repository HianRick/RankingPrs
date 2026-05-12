import { useState, useMemo } from 'react'
import { useLeaderboardWS } from './useLeaderboardWS'

const ITEMS_PER_PAGE = 8

function formatTime(seconds) {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return '--:--.---'
  const totalMs = Math.round(seconds * 1000)
  const minutes = Math.floor(totalMs / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000
  return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function StatusDot({ status }) {
  const config = {
    connecting: { label: 'Conectando',   color: '#f59e0b' },
    open:       { label: 'Ao Vivo',      color: '#22c55e' },
    closed:     { label: 'Reconectando', color: '#ef4444' },
    error:      { label: 'Erro',         color: '#dc2626' },
  }
  const cfg = config[status] ?? config.closed
  return (
    <div style={{ textAlign: 'center', padding: '12px 0', width: '100%' }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: cfg.color,
        boxShadow: status === 'open' ? `0 0 14px ${cfg.color}` : 'none',
        margin: '0 auto 10px',
        transition: 'all 0.3s ease',
      }} />
      <div style={{
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 11, letterSpacing: 2, fontWeight: 700,
        color: cfg.color, textTransform: 'uppercase',
      }}>
        {cfg.label}
      </div>
    </div>
  )
}

export default function Leaderboard() {
  const { entries, status } = useLeaderboardWS()

  const [isPaused, setIsPaused] = useState(false)
  const [frozenEntries, setFrozenEntries] = useState(null)
  const [selectedTrack, setSelectedTrack] = useState('all')
  const [selectedLayout, setSelectedLayout] = useState('all')
  const [selectedCar, setSelectedCar] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showSettings, setShowSettings] = useState(false)
  const [hiddenTracks, setHiddenTracks] = useState(new Set())

  const displayEntries = isPaused ? (frozenEntries ?? entries) : entries

  const togglePause = () => {
    if (!isPaused) setFrozenEntries([...entries])
    else setFrozenEntries(null)
    setIsPaused(p => !p)
  }

  const allTracks = useMemo(() =>
    [...new Set(entries.map(e => e.track).filter(Boolean))].sort(),
    [entries]
  )
  const allCars = useMemo(() =>
    [...new Set(entries.map(e => e.car).filter(Boolean))].sort(),
    [entries]
  )

  // Layouts disponíveis apenas para a pista selecionada
  const availableLayouts = useMemo(() => {
    const base = selectedTrack === 'all'
      ? entries
      : entries.filter(e => e.track === selectedTrack)
    return [...new Set(base.map(e => e.trackLayout).filter(Boolean))].sort()
  }, [entries, selectedTrack])

  const filteredEntries = useMemo(() =>
    displayEntries.filter(e => {
      if (hiddenTracks.has(e.track)) return false
      if (selectedTrack !== 'all' && e.track !== selectedTrack) return false
      if (selectedLayout !== 'all' && e.trackLayout !== selectedLayout) return false
      if (selectedCar !== 'all' && e.car !== selectedCar) return false
      return true
    }),
    [displayEntries, selectedTrack, selectedLayout, selectedCar, hiddenTracks]
  )

  const uniquePilotCount = useMemo(() => new Set(entries.map(e => e.driver)).size, [entries])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ITEMS_PER_PAGE))
  const page = Math.min(currentPage, totalPages)
  const pageEntries = filteredEntries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const toggleTrackVisibility = (track) => {
    setHiddenTracks(prev => {
      const next = new Set(prev)
      if (next.has(track)) next.delete(track)
      else next.add(track)
      return next
    })
    setCurrentPage(1)
  }

  const rowClass = (gi) => {
    if (gi === 0) return 'top-1'
    if (gi === 1) return 'top-2'
    if (gi === 2) return 'top-3'
    return ''
  }

  const positionBadge = (gi) => {
    if (gi === 0) return <span className="position-badge medal-1">🥇</span>
    if (gi === 1) return <span className="position-badge medal-2">🥈</span>
    if (gi === 2) return <span className="position-badge medal-3">🥉</span>
    return <span className="position-badge">{gi + 1}º</span>
  }

  return (
    <div className="leaderboard-container">
      {showSettings && (
        <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h2>⚙️ Configurações</h2>
              <button className="close-modal-button" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="settings-modal-content">
              <p className="settings-description">
                Selecione as pistas que devem aparecer no ranking:
              </p>
              <div className="tracks-checkbox-list">
                {allTracks.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '20px 0', fontFamily: 'Rajdhani, sans-serif' }}>
                    Nenhuma pista disponível ainda
                  </p>
                ) : allTracks.map(track => (
                  <label key={track} className="track-checkbox-label">
                    <input
                      type="checkbox"
                      checked={!hiddenTracks.has(track)}
                      onChange={() => toggleTrackVisibility(track)}
                    />
                    <span>{track}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="leaderboard-top">
        <div className="leaderboard-header">
          <button className="settings-button" onClick={() => setShowSettings(true)} title="Configurações">
            ⚙️
          </button>
          <h1>🏁 RANKING AO VIVO</h1>
        </div>

        <div className="leaderboard-layout">
          <div className="qr-panel">
            <h2>Status</h2>
            <StatusDot status={status} />
            <div style={{
              marginTop: 20,
              padding: '14px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 12,
              border: '1px solid rgba(220,38,38,0.2)',
              textAlign: 'center',
              width: '100%',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏎️</div>
              <div style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 22, fontWeight: 700, color: '#dc2626',
              }}>
                {uniquePilotCount}
              </div>
              <div style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: 13, color: 'rgba(255,255,255,0.55)',
                marginTop: 2, textTransform: 'uppercase', letterSpacing: 1,
              }}>
                piloto{uniquePilotCount !== 1 ? 's' : ''} registrado{uniquePilotCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="ranking-panel">
            <div className="ranking-header">
              <div className="ranking-title-section">
                <button
                  className="pause-button"
                  onClick={togglePause}
                  title={isPaused ? 'Retomar atualizações' : 'Pausar atualizações'}
                >
                  {isPaused ? '▶️' : '⏸️'}
                </button>
                <h2>CLASSIFICAÇÃO</h2>
              </div>
              {selectedTrack !== 'all' && (
                <div className="ranking-track-title">
                  <span className="ranking-track-name">{selectedTrack}</span>
                  {selectedLayout !== 'all' && (
                    <span className="ranking-layout-name">{selectedLayout}</span>
                  )}
                </div>
              )}
              <div className="filters-section">
                <div className="track-selector">
                  <select
                    className="track-dropdown"
                    value={selectedTrack}
                    onChange={e => { setSelectedTrack(e.target.value); setSelectedLayout('all'); setCurrentPage(1) }}
                  >
                    <option value="all">Todas as Pistas</option>
                    {allTracks.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {availableLayouts.length > 0 && (
                  <div className="car-selector">
                    <select
                      className="car-dropdown"
                      value={selectedLayout}
                      onChange={e => { setSelectedLayout(e.target.value); setCurrentPage(1) }}
                    >
                      <option value="all">Todos os Layouts</option>
                      {availableLayouts.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                )}
                <div className="car-selector">
                  <select
                    className="car-dropdown"
                    value={selectedCar}
                    onChange={e => { setSelectedCar(e.target.value); setCurrentPage(1) }}
                  >
                    <option value="all">Todos os Carros</option>
                    {allCars.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="ranking-table-wrapper">
              {status === 'connecting' && entries.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>Conectando ao servidor...</p>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🏁</span>
                  <p>Nenhum piloto registrado</p>
                  <span className="empty-hint">Aguardando dados do simulador...</span>
                </div>
              ) : (
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th className="col-pos">Pos</th>
                      <th className="col-player">Piloto</th>
                      <th className="col-car">Carro</th>
                      <th className="col-time">Melhor Volta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageEntries.map((entry, idx) => {
                      const gi = (page - 1) * ITEMS_PER_PAGE + idx
                      return (
                        <tr key={entry.id} className={rowClass(gi)}>
                          <td className="col-pos">{positionBadge(gi)}</td>
                          <td className="col-player">{entry.driver}</td>
                          <td className="col-car">{entry.car}</td>
                          <td className="col-time">{formatTime(entry.time)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  className="pagination-button"
                  disabled={page === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  ← Anterior
                </button>
                <span className="pagination-info">{page} / {totalPages}</span>
                <button
                  className="pagination-button"
                  disabled={page === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Próximo →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
