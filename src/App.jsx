import { useState, useMemo, useRef, useEffect } from 'react'
import { useLeaderboardWS } from './useLeaderboardWS'
import logo from '../assets/logo3.png'
import Leaderboard from './Leaderboard'
import { DEFAULT_LAYOUT } from './LayoutSettingsPanel'

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '--:--.---'
  const totalMs = Math.round(seconds * 1000)
  const minutes = Math.floor(totalMs / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000
  return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function displayDriver(driver) {
  if (!driver) return ''
  const parts = driver.replace(/[_-]/g, ' ').trim().split(/\s+/)
  return parts.length <= 2 ? parts.join(' ') : `${parts[0]} ${parts[parts.length - 1]}`
}

const GRID_ROWS = 5
const GRID_COLS = 5

function validateLayout(l) {
  if (!l || typeof l !== 'object') return false
  const required = ['header', 'status', 'ranking']
  const ok = required.every(k => {
    const s = l[k]
    return s?.row >= 1 && s?.col >= 1 &&
      s.row + s.rowSpan - 1 <= GRID_ROWS &&
      s.col + s.colSpan - 1 <= GRID_COLS
  })
  if (!ok) return false
  if (l.media) {
    const s = l.media
    if (!(s.row >= 1 && s.col >= 1 && s.row + s.rowSpan - 1 <= GRID_ROWS && s.col + s.colSpan - 1 <= GRID_COLS)) return false
  }
  return true
}

function blockStyle(item) {
  return {
    gridRowStart: item.row,
    gridRowEnd: Math.min(item.row + item.rowSpan, GRID_ROWS + 1),
    gridColumnStart: item.col,
    gridColumnEnd: Math.min(item.col + item.colSpan, GRID_COLS + 1),
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  }
}

function StatusDot({ status }) {
  const cfg = {
    connecting: { label: 'Conectando',   color: '#f59e0b' },
    open:       { label: 'Ao Vivo',      color: '#22c55e' },
    closed:     { label: 'Reconectando', color: '#ef4444' },
    error:      { label: 'Erro',         color: '#dc2626' },
  }[status] ?? { label: 'Reconectando', color: '#ef4444' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: cfg.color,
        boxShadow: status === 'open' ? `0 0 10px ${cfg.color}` : 'none',
        flexShrink: 0,
        transition: 'all 0.3s ease',
      }} />
      <div style={{
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 10, letterSpacing: 2, fontWeight: 700,
        color: cfg.color, textTransform: 'uppercase',
      }}>
        {cfg.label}
      </div>
    </div>
  )
}

function HeaderCarousel({ logo, sponsors, active }) {
  if (!active) {
    return (
      <img src={logo} alt="logo" className="header-logo-static" />
    )
  }

  const items = [{ id: '__logo__', src: logo }, ...sponsors.map(s => ({ id: s.id, src: s.data }))]
  const COPIES = Math.max(6, Math.ceil(12 / items.length))
  const track = Array.from({ length: COPIES }, (_, c) =>
    items.map(item => ({ src: item.src, key: `${item.id}-${c}` }))
  ).flat()
  const duration = Math.max(15, items.length * 8)
  const endPct = `${-(100 / COPIES).toFixed(3)}%`

  return (
    <div className="header-marquee">
      <div
        className="header-marquee-track"
        style={{ animationDuration: `${duration}s`, '--marquee-end': endPct }}
      >
        {track.map(item => (
          <img key={item.key} src={item.src} alt="" className="header-marquee-img" />
        ))}
      </div>
    </div>
  )
}

function MediaBlock({ mediaContent, mediaType, mediaFit, blockColor }) {
  return (
    <div className="media-block" style={blockColor ? { background: blockColor } : undefined}>
      {mediaContent ? (
        mediaType === 'video' ? (
          <video
            src={mediaContent}
            autoPlay loop muted playsInline
            className="media-block-media"
            style={{ objectFit: mediaFit }}
          />
        ) : (
          <img
            src={mediaContent}
            alt=""
            className="media-block-media"
            style={{ objectFit: mediaFit }}
          />
        )
      ) : (
        <div className="media-block-empty">
          <span>🎞️</span>
          <span>Sem mídia</span>
        </div>
      )}
    </div>
  )
}

const PALETTES = [
  { name: 'Vermelho',  hex: '#dc2626', rgb: '220, 38, 38'  },
  { name: 'Azul',     hex: '#2563eb', rgb: '37, 99, 235'   },
  { name: 'Verde',    hex: '#16a34a', rgb: '22, 163, 74'   },
  { name: 'Roxo',     hex: '#7c3aed', rgb: '124, 58, 237'  },
  { name: 'Laranja',  hex: '#ea580c', rgb: '234, 88, 12'   },
  { name: 'Ciano',    hex: '#0891b2', rgb: '8, 145, 178'   },
  { name: 'Rosa',     hex: '#db2777', rgb: '219, 39, 119'  },
  { name: 'Amarelo',  hex: '#ca8a04', rgb: '202, 138, 4'   },
]

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1],16)}, ${parseInt(r[2],16)}, ${parseInt(r[3],16)}` : '220, 38, 38'
}

function applyAccent(hex) {
  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent-rgb', hexToRgb(hex))
}

export default function App() {
  const { entries, status } = useLeaderboardWS()

  const [layout, setLayout] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('leaderboardLayout') || 'null')
      if (validateLayout(saved)) {
        return { ...DEFAULT_LAYOUT, ...saved, media: saved.media || DEFAULT_LAYOUT.media }
      }
    } catch {}
    return DEFAULT_LAYOUT
  })

  const [customTitle, setCustomTitle] = useState(() => localStorage.getItem('headerTitle') || '')

  const [sponsors, setSponsors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('headerSponsors') || '[]') } catch { return [] }
  })

  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || '#dc2626')
  const [rankBgImage, setRankBgImage] = useState(() => localStorage.getItem('rankBgImage') || '')
  const [rankBgBlur, setRankBgBlur] = useState(() => Number(localStorage.getItem('rankBgBlur') || 0))

  const [blockColors, setBlockColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('blockColors') || '{}') } catch { return {} }
  })

  const [carouselActive, setCarouselActive] = useState(() => localStorage.getItem('carouselActive') !== 'false')

  const [selectedTrack, setSelectedTrack] = useState('all')
  const [selectedLayout, setSelectedLayout] = useState('all')
  const [hiddenTracks, setHiddenTracks] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('hiddenTracks') || '[]')) } catch { return new Set() }
  })

  const [hiddenBlocks, setHiddenBlocks] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('hiddenBlocks') || '["media"]')) } catch { return new Set(['media']) }
  })

  const [driverPhotos, setDriverPhotos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('driverPhotos') || '{}') } catch { return {} }
  })
  const driverPhotoInputRef = useRef(null)
  const [pendingPhotoDriver, setPendingPhotoDriver] = useState('')

  const [mediaContent, setMediaContent] = useState(() => localStorage.getItem('mediaContent') || '')
  const [mediaType, setMediaType] = useState(() => localStorage.getItem('mediaType') || 'image')
  const [mediaFit, setMediaFit] = useState(() => localStorage.getItem('mediaFit') || 'contain')
  const mediaInputRef = useRef(null)

  useEffect(() => { applyAccent(accentColor) }, [accentColor])

  const sponsorInputRef = useRef(null)
  const rankBgInputRef = useRef(null)

  const uniquePilotCount = useMemo(() => new Set(entries.map(e => e.driver)).size, [entries])

  const top3 = useMemo(() => {
    let base = entries.filter(e => !hiddenTracks.has(e.track))
    if (selectedTrack !== 'all') base = base.filter(e => e.track === selectedTrack)
    if (selectedLayout !== 'all') base = base.filter(e => e.trackLayout === selectedLayout)
    return base.slice(0, 3)
  }, [entries, selectedTrack, selectedLayout, hiddenTracks])

  const toggleHiddenTrack = (track) => {
    setHiddenTracks(prev => {
      const next = new Set(prev)
      if (next.has(track)) next.delete(track); else next.add(track)
      localStorage.setItem('hiddenTracks', JSON.stringify([...next]))
      if (track === selectedTrack) { setSelectedTrack('all'); setSelectedLayout('all') }
      return next
    })
  }

  const toggleHiddenBlock = (block) => {
    setHiddenBlocks(prev => {
      const next = new Set(prev)
      if (next.has(block)) next.delete(block); else next.add(block)
      localStorage.setItem('hiddenBlocks', JSON.stringify([...next]))
      return next
    })
  }

  const handleBlockColor = (block, color) => {
    const updated = { ...blockColors, [block]: color }
    setBlockColors(updated)
    localStorage.setItem('blockColors', JSON.stringify(updated))
  }

  const handleCarouselActive = (v) => {
    setCarouselActive(v)
    localStorage.setItem('carouselActive', v)
  }

  const handleLayoutChange = (newLayout) => {
    if (validateLayout(newLayout)) {
      setLayout(newLayout)
      localStorage.setItem('leaderboardLayout', JSON.stringify(newLayout))
    }
  }

  const handleTitleChange = (title) => {
    setCustomTitle(title)
    localStorage.setItem('headerTitle', title)
  }

  const handleAddSponsors = (files) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const newSponsor = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, data: ev.target.result }
        setSponsors(prev => {
          const updated = [...prev, newSponsor]
          try { localStorage.setItem('headerSponsors', JSON.stringify(updated)) } catch {}
          return updated
        })
      }
      reader.readAsDataURL(file)
    })
    sponsorInputRef.current && (sponsorInputRef.current.value = '')
  }

  const handleRemoveSponsor = (id) => {
    setSponsors(prev => {
      const updated = prev.filter(s => s.id !== id)
      localStorage.setItem('headerSponsors', JSON.stringify(updated))
      return updated
    })
  }

  const handleAccentChange = (hex) => {
    setAccentColor(hex)
    localStorage.setItem('accentColor', hex)
  }

  const handleRankBgImage = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const data = ev.target.result
      setRankBgImage(data)
      try { localStorage.setItem('rankBgImage', data) } catch {}
    }
    reader.readAsDataURL(file)
    rankBgInputRef.current && (rankBgInputRef.current.value = '')
  }

  const handleRemoveRankBg = () => {
    setRankBgImage('')
    localStorage.removeItem('rankBgImage')
  }

  const handleRankBgBlur = (val) => {
    setRankBgBlur(val)
    localStorage.setItem('rankBgBlur', val)
  }

  const handleDriverPhoto = (driver, file) => {
    if (!driver || !file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const updated = { ...driverPhotos, [driver]: ev.target.result }
      setDriverPhotos(updated)
      try { localStorage.setItem('driverPhotos', JSON.stringify(updated)) } catch {}
    }
    reader.readAsDataURL(file)
    driverPhotoInputRef.current && (driverPhotoInputRef.current.value = '')
  }

  const handleRemoveDriverPhoto = (driver) => {
    const updated = { ...driverPhotos }
    delete updated[driver]
    setDriverPhotos(updated)
    localStorage.setItem('driverPhotos', JSON.stringify(updated))
  }

  const handleMediaContent = (file) => {
    if (!file) return
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    const reader = new FileReader()
    reader.onload = ev => {
      const data = ev.target.result
      setMediaContent(data)
      setMediaType(type)
      try {
        localStorage.setItem('mediaContent', data)
        localStorage.setItem('mediaType', type)
      } catch {}
    }
    reader.readAsDataURL(file)
    mediaInputRef.current && (mediaInputRef.current.value = '')
  }

  const handleRemoveMedia = () => {
    setMediaContent('')
    localStorage.removeItem('mediaContent')
  }

  const handleMediaFit = (fit) => {
    setMediaFit(fit)
    localStorage.setItem('mediaFit', fit)
  }

  return (
    <div className="app-grid">
      <div className="app-bg-fx" />

      {/* ── Header block ── */}
      {!hiddenBlocks.has('header') && (
        <div style={blockStyle(layout.header)}>
          <div className="header-block" style={{ '--header-bg': blockColors.header || 'rgb(26,26,26)', ...(blockColors.header ? { background: blockColors.header } : {}) }}>
            <HeaderCarousel logo={logo} sponsors={sponsors} active={carouselActive} />
            {customTitle && (
              <div className="header-title-mask">
                <h1 className="header-title">{customTitle}</h1>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Status block ── */}
      {!hiddenBlocks.has('status') && (
        <div style={blockStyle(layout.status)}>
          <div className="status-block" style={blockColors.status ? { background: blockColors.status } : undefined}>
            <div className="status-info-row">
              <StatusDot status={status} />
              <span className="pilot-count-inline">🏎️ <strong>{uniquePilotCount}</strong> piloto{uniquePilotCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="podium-section">
              <div className="podium-header">
                🏆 Top 3
                {selectedTrack !== 'all' && (
                  <span className="podium-track-label">{selectedTrack}{selectedLayout !== 'all' ? ` · ${selectedLayout}` : ''}</span>
                )}
              </div>
              {top3.length === 0 ? (
                <div className="podium-empty">Aguardando dados...</div>
              ) : (
                <div className="podium-cards">
                  {top3.map((entry, i) => (
                    <div key={entry.id ?? i} className={`podium-card podium-pos-${i + 1}`}>
                      <div className="podium-photo-area">
                        {driverPhotos[entry.driver]
                          ? <img className="podium-photo" src={driverPhotos[entry.driver]} alt="" />
                          : <div className="podium-photo-placeholder">{entry.driver?.[0]?.toUpperCase() ?? '?'}</div>
                        }
                      </div>
                      <div className="podium-details">
                        <div className="podium-name">{displayDriver(entry.driver)}</div>
                        <div className="podium-time">{formatTime(entry.time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Ranking block ── */}
      {!hiddenBlocks.has('ranking') && (
        <div style={blockStyle(layout.ranking)}>
          <Leaderboard
            entries={entries}
            status={status}
            layout={layout}
            onLayoutChange={handleLayoutChange}
            customTitle={customTitle}
            onTitleChange={handleTitleChange}
            sponsors={sponsors}
            sponsorInputRef={sponsorInputRef}
            onAddSponsors={handleAddSponsors}
            onRemoveSponsor={handleRemoveSponsor}
            accentColor={accentColor}
            onAccentChange={handleAccentChange}
            palettes={PALETTES}
            rankBgImage={rankBgImage}
            rankBgInputRef={rankBgInputRef}
            onRankBgImage={handleRankBgImage}
            onRemoveRankBg={handleRemoveRankBg}
            rankBgBlur={rankBgBlur}
            onRankBgBlur={handleRankBgBlur}
            selectedTrack={selectedTrack}
            selectedLayout={selectedLayout}
            onTrackChange={(t) => { setSelectedTrack(t); setSelectedLayout('all') }}
            onLayoutChange2={setSelectedLayout}
            driverPhotos={driverPhotos}
            driverPhotoInputRef={driverPhotoInputRef}
            onDriverPhotoChange={handleDriverPhoto}
            onRemoveDriverPhoto={handleRemoveDriverPhoto}
            pendingPhotoDriver={pendingPhotoDriver}
            onPendingPhotoDriver={setPendingPhotoDriver}
            carouselActive={carouselActive}
            onCarouselActiveChange={handleCarouselActive}
            blockColors={blockColors}
            onBlockColorChange={handleBlockColor}
            hiddenTracks={hiddenTracks}
            onToggleTrack={toggleHiddenTrack}
            hiddenBlocks={hiddenBlocks}
            onToggleBlock={toggleHiddenBlock}
            mediaContent={mediaContent}
            mediaInputRef={mediaInputRef}
            onMediaContent={handleMediaContent}
            onRemoveMedia={handleRemoveMedia}
            mediaFit={mediaFit}
            onMediaFit={handleMediaFit}
          />
        </div>
      )}

      {/* ── Media block ── */}
      {!hiddenBlocks.has('media') && (
        <div style={blockStyle(layout.media)}>
          <MediaBlock
            mediaContent={mediaContent}
            mediaType={mediaType}
            mediaFit={mediaFit}
            blockColor={blockColors.media}
          />
        </div>
      )}

      <input
        ref={sponsorInputRef}
        type="file" accept="image/*" multiple
        style={{ display: 'none' }}
        onChange={e => handleAddSponsors(e.target.files)}
      />
      <input
        ref={rankBgInputRef}
        type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleRankBgImage(e.target.files[0])}
      />
      <input
        ref={driverPhotoInputRef}
        type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleDriverPhoto(pendingPhotoDriver, e.target.files[0])}
      />
      <input
        ref={mediaInputRef}
        type="file" accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={e => handleMediaContent(e.target.files[0])}
      />
    </div>
  )
}
