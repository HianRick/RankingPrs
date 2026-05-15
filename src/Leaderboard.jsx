import { useState, useMemo, useRef, useEffect } from 'react'
import { LayoutEditor } from './LayoutSettingsPanel'

function formatTime(seconds) {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return '--:--.---'
  const totalMs = Math.round(seconds * 1000)
  const minutes = Math.floor(totalMs / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000
  return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

const BLUR_OPTIONS = [
  { label: 'Sem desfoque', value: 0 },
  { label: 'Leve',         value: 4 },
  { label: 'Médio',        value: 10 },
  { label: 'Forte',        value: 20 },
]

function displayDriver(driver) {
  if (!driver) return ''
  const parts = driver.replace(/[_-]/g, ' ').trim().split(/\s+/)
  if (parts.length <= 2) return parts.join(' ')
  return `${parts[0]} ${parts[parts.length - 1]}`
}

export default function Leaderboard({
  entries, status, layout, onLayoutChange, customTitle, onTitleChange,
  sponsors, sponsorInputRef, onAddSponsors, onRemoveSponsor,
  accentColor, onAccentChange, palettes,
  rankBgImage, rankBgInputRef, onRankBgImage, onRemoveRankBg, rankBgBlur, onRankBgBlur,
  selectedTrack, selectedLayout, onTrackChange, onLayoutChange2,
  driverPhotos, driverPhotoInputRef, onDriverPhotoChange, onRemoveDriverPhoto,
  pendingPhotoDriver, onPendingPhotoDriver,
  carouselActive, onCarouselActiveChange,
  blockColors, onBlockColorChange,
  hiddenTracks, onToggleTrack,
  hiddenBlocks, onToggleBlock,
  mediaContent, mediaInputRef, onMediaContent, onRemoveMedia, mediaFit, onMediaFit,
}) {
  const [isPaused, setIsPaused] = useState(false)
  const [frozenEntries, setFrozenEntries] = useState(null)
  const [selectedCar, setSelectedCar] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('config')
  const [tracksExpanded, setTracksExpanded] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(13)
  const [carAliases, setCarAliases] = useState(() => {
    try { return JSON.parse(localStorage.getItem('carAliases') || '{}') } catch { return {} }
  })
  const [aliasSelectedCar, setAliasSelectedCar] = useState('')
  const [aliasInput, setAliasInput] = useState('')
  const tableWrapperRef = useRef(null)

  useEffect(() => {
    const calculate = () => {
      if (!tableWrapperRef.current) return
      const height = tableWrapperRef.current.clientHeight
      const calculated = Math.max(5, Math.floor((height - 56) / 54))
      setItemsPerPage(calculated)
    }
    calculate()
    window.addEventListener('resize', calculate)
    return () => window.removeEventListener('resize', calculate)
  }, [])

  const displayEntries = isPaused ? (frozenEntries ?? entries) : entries

  const togglePause = () => {
    if (!isPaused) setFrozenEntries([...entries])
    else setFrozenEntries(null)
    setIsPaused(p => !p)
  }

  const allTracks = useMemo(() =>
    [...new Set(entries.map(e => e.track).filter(Boolean))].sort(), [entries])

  const visibleTracks = useMemo(() =>
    allTracks.filter(t => !hiddenTracks.has(t)), [allTracks, hiddenTracks])

  const allCars = useMemo(() =>
    [...new Set(entries.map(e => e.car).filter(Boolean))].sort(), [entries])

  const allDrivers = useMemo(() =>
    [...new Set(entries.map(e => e.driver).filter(Boolean))].sort(), [entries])

  const availableLayouts = useMemo(() => {
    const base = selectedTrack === 'all' ? entries : entries.filter(e => e.track === selectedTrack)
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

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / itemsPerPage))
  const page = Math.min(currentPage, totalPages)
  const pageEntries = filteredEntries.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const saveCarAlias = () => {
    if (!aliasSelectedCar) return
    const updated = { ...carAliases, [aliasSelectedCar]: aliasInput.trim() }
    setCarAliases(updated)
    localStorage.setItem('carAliases', JSON.stringify(updated))
    setAliasSelectedCar('')
    setAliasInput('')
  }

  const removeCarAlias = (car) => {
    const updated = { ...carAliases }
    delete updated[car]
    setCarAliases(updated)
    localStorage.setItem('carAliases', JSON.stringify(updated))
  }

  const displayCar = (car) => (carAliases[car] ?? car)?.replace(/[_-]/g, ' ')


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
    <div className="ranking-panel" style={blockColors?.ranking ? { background: blockColors.ranking } : undefined}>
      {rankBgImage && (
        <div
          className="ranking-bg"
          style={{
            backgroundImage: `url(${rankBgImage})`,
            filter: rankBgBlur > 0 ? `blur(${rankBgBlur}px)` : undefined,
          }}
        />
      )}
      {showSettings && (
        <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h2>⚙️ Configurações</h2>
              <button className="close-modal-button" onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <div className="settings-tabs">
              <button
                className={`settings-tab${settingsTab === 'config' ? ' settings-tab-active' : ''}`}
                onClick={() => setSettingsTab('config')}
              >
                ⚙️ Geral
              </button>
              <button
                className={`settings-tab${settingsTab === 'layout' ? ' settings-tab-active' : ''}`}
                onClick={() => setSettingsTab('layout')}
              >
                ⊞ Layout
              </button>
              <button
                className={`settings-tab${settingsTab === 'cores' ? ' settings-tab-active' : ''}`}
                onClick={() => setSettingsTab('cores')}
              >
                🎨 Cores
              </button>
              <button
                className={`settings-tab${settingsTab === 'midia' ? ' settings-tab-active' : ''}`}
                onClick={() => setSettingsTab('midia')}
              >
                🖼️ Mídia
              </button>
            </div>

            {settingsTab === 'layout' ? (
              <div className="settings-modal-content">
                <LayoutEditor
                  layout={layout}
                  onLayoutChange={onLayoutChange}
                  hiddenBlocks={hiddenBlocks}
                  onToggleBlock={onToggleBlock}
                />
              </div>
            ) : settingsTab === 'cores' ? (
              <div className="settings-modal-content">
                <p className="settings-description">Cor de destaque:</p>
                <div className="palette-grid">
                  {palettes.map(p => (
                    <button
                      key={p.hex}
                      className={`palette-swatch${accentColor === p.hex ? ' active' : ''}`}
                      style={{ background: p.hex }}
                      title={p.name}
                      onClick={() => onAccentChange(p.hex)}
                    />
                  ))}
                </div>
                <div className="palette-custom">
                  <input
                    type="color"
                    className="palette-custom-input"
                    value={accentColor}
                    onChange={e => onAccentChange(e.target.value)}
                  />
                  <span className="palette-custom-label">Cor personalizada</span>
                </div>

                <div className="settings-section-divider" />
                <p className="settings-description">Cor de fundo dos blocos:</p>
                <div className="block-color-grid">
                  {[['header','Header'],['status','Status'],['ranking','Ranking'],['media','Mídia']].map(([key, label]) => (
                    <div key={key} className="block-color-row">
                      <span className="block-color-label">{label}</span>
                      <input type="color" className="palette-custom-input"
                        value={blockColors?.[key] || '#1a1a1a'}
                        onChange={e => onBlockColorChange(key, e.target.value)} />
                      <button className="bg-remove-btn" style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => onBlockColorChange(key, '')}>Reset</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : settingsTab === 'midia' ? (
              <div className="settings-modal-content">
                <p className="settings-description">Imagem de fundo do ranking:</p>
                <div className="bg-upload-row">
                  <button className="banner-upload-button" onClick={() => rankBgInputRef?.current?.click()}>
                    {rankBgImage ? 'Trocar imagem' : '+ Adicionar imagem'}
                  </button>
                  {rankBgImage && (
                    <button className="bg-remove-btn" onClick={onRemoveRankBg}>Remover</button>
                  )}
                </div>
                <p className="banner-hint">PNG ou JPG</p>
                {rankBgImage && (
                  <>
                    <p className="settings-description" style={{ marginTop: 16 }}>Desfoque:</p>
                    <div className="blur-options">
                      {BLUR_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          className={`blur-btn${rankBgBlur === opt.value ? ' active' : ''}`}
                          onClick={() => onRankBgBlur(opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="settings-section-divider" />
                <p className="settings-description">Conteúdo do bloco de mídia:</p>
                <div className="bg-upload-row">
                  <button className="banner-upload-button" onClick={() => mediaInputRef?.current?.click()}>
                    {mediaContent ? 'Trocar mídia' : '+ Adicionar imagem / vídeo'}
                  </button>
                  {mediaContent && (
                    <button className="bg-remove-btn" onClick={onRemoveMedia}>Remover</button>
                  )}
                </div>
                <p className="banner-hint">PNG, JPG ou MP4 / WebM</p>
                {mediaContent && (
                  <>
                    <p className="settings-description" style={{ marginTop: 12 }}>Ajuste da imagem:</p>
                    <div className="blur-options">
                      {[['Conter', 'contain'], ['Cobrir', 'cover']].map(([label, val]) => (
                        <button key={val} className={`blur-btn${mediaFit === val ? ' active' : ''}`}
                          onClick={() => onMediaFit(val)}>{label}</button>
                      ))}
                    </div>
                  </>
                )}

                <div className="settings-section-divider" />
                <p className="settings-description">Banners de patrocinadores (passam na horizontal):</p>
                <button
                  className="banner-upload-button"
                  onClick={() => sponsorInputRef?.current?.click()}
                >
                  + Adicionar banners
                </button>
                <p className="banner-hint">PNG, JPG ou SVG • selecione múltiplos de uma vez</p>
                {sponsors?.length > 0 && (
                  <div className="sponsors-settings-list">
                    {sponsors.map((s, i) => (
                      <div key={s.id} className="sponsor-settings-item">
                        <img src={s.data} alt={`Sponsor ${i + 1}`} className="sponsor-settings-thumb" />
                        <span className="sponsor-settings-label">Banner {i + 1}</span>
                        <button className="car-alias-remove sponsor-remove-btn" onClick={() => onRemoveSponsor(s.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="settings-section-divider" />
                <p className="settings-description">Carrossel de logos:</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[['Animado', true], ['Estático', false]].map(([label, val]) => (
                    <button key={label} className={`blur-btn${carouselActive === val ? ' active' : ''}`}
                      onClick={() => onCarouselActiveChange(val)}>{label}</button>
                  ))}
                </div>

                <div className="settings-section-divider" />
                <p className="settings-description">Foto dos pilotos:</p>
                <div className="car-alias-form">
                  <select className="car-alias-select" value={pendingPhotoDriver}
                    onChange={e => onPendingPhotoDriver(e.target.value)}>
                    <option value="">Selecione um piloto...</option>
                    {allDrivers.map(d => <option key={d} value={d}>{displayDriver(d)}</option>)}
                  </select>
                  <button className="banner-upload-button"
                    onClick={() => pendingPhotoDriver && driverPhotoInputRef?.current?.click()}>
                    + Foto
                  </button>
                </div>
                {Object.keys(driverPhotos || {}).length > 0 && (
                  <div className="car-alias-list">
                    {Object.entries(driverPhotos).map(([driver, photo]) => (
                      <div key={driver} className="car-alias-item">
                        <img src={photo} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                        <span className="car-alias-name">{displayDriver(driver)}</span>
                        <button className="car-alias-remove" onClick={() => onRemoveDriverPhoto(driver)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
            <div className="settings-modal-content">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
                <p className="settings-description" style={{ margin: 0 }}>Pistas visíveis no ranking:</p>
                <button
                  className="blur-btn"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => setTracksExpanded(p => !p)}
                >
                  {tracksExpanded ? '▲ Recolher' : '▼ Expandir'}
                </button>
              </div>
              {tracksExpanded && (
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
                        onChange={() => { onToggleTrack(track); setCurrentPage(1) }}
                      />
                      <span>{track}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="settings-section-divider" />

              <p className="settings-description">Renomear carros no ranking:</p>
              <div className="car-alias-form">
                <select
                  className="car-alias-select"
                  value={aliasSelectedCar}
                  onChange={e => {
                    setAliasSelectedCar(e.target.value)
                    setAliasInput(carAliases[e.target.value] ?? '')
                  }}
                >
                  <option value="">Selecione um carro...</option>
                  {allCars.map(c => (
                    <option key={c} value={c}>{c.replace(/[_-]/g, ' ')}</option>
                  ))}
                </select>
                <input
                  className="car-alias-input"
                  type="text"
                  placeholder="Nome a exibir"
                  value={aliasInput}
                  onChange={e => setAliasInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveCarAlias()}
                />
                <button className="car-alias-save-button" onClick={saveCarAlias}>Salvar</button>
              </div>

              {Object.keys(carAliases).length > 0 && (
                <div className="car-alias-list">
                  {Object.entries(carAliases).map(([original, alias]) => (
                    <div key={original} className="car-alias-item">
                      <span className="car-alias-original">{original.replace(/[_-]/g, ' ')}</span>
                      <span className="car-alias-arrow">→</span>
                      <span className="car-alias-name">{alias}</span>
                      <button className="car-alias-remove" onClick={() => removeCarAlias(original)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="settings-section-divider" />

              <p className="settings-description">Título exibido no header:</p>
              <input
                className="car-alias-input"
                type="text"
                placeholder="🏁 RANKING AO VIVO"
                value={customTitle}
                onChange={e => onTitleChange(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            )}
          </div>
        </div>
      )}

      <div className="ranking-header">
        <div className="ranking-title-section">
          <button className="settings-button" onClick={() => setShowSettings(true)} title="Configurações">⚙️</button>
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
              onChange={e => { onTrackChange(e.target.value); setCurrentPage(1) }}
            >
              <option value="all">Todas as Pistas</option>
              {visibleTracks.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {availableLayouts.length > 0 && (
            <div className="car-selector">
              <select
                className="car-dropdown"
                value={selectedLayout}
                onChange={e => { onLayoutChange2(e.target.value); setCurrentPage(1) }}
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

      <div className="ranking-table-wrapper" ref={tableWrapperRef}>
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
                {selectedTrack === 'all' && <th className="col-track">Pista</th>}
                <th className="col-time">Melhor Volta</th>
              </tr>
            </thead>
            <tbody>
              {pageEntries.map((entry, idx) => {
                const gi = (page - 1) * itemsPerPage + idx
                return (
                  <tr key={entry.id} className={rowClass(gi)}>
                    <td className="col-pos">{positionBadge(gi)}</td>
                    <td className="col-player">{displayDriver(entry.driver)}</td>
                    <td className="col-car">{displayCar(entry.car)}</td>
                    {selectedTrack === 'all' && <td className="col-track">{entry.track}</td>}
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
  )
}
