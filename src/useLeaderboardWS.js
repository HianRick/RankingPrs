import { useState, useEffect, useRef } from 'react'

const API_BASE = 'https://wc-prs.fastalk.com.br'
const WS_URL = `${API_BASE.replace('https', 'wss')}/output`
const EVENT_NAME = 'teste'

function parseRaw(raw) {
  const pilotName = raw['pilot-name']
  if (!pilotName) return null

  // bestLap/bestTime of 0 means "no best lap set yet" — treat as absent and fall through
  let lapTimeMs = null
  if (raw.bestTime > 0) lapTimeMs = raw.bestTime
  else if (raw.bestLap > 0) lapTimeMs = raw.bestLap
  else if (raw.lapData?.lapTime > 0 && raw.lapData?.isValid !== false) lapTimeMs = raw.lapData.lapTime
  if (!lapTimeMs) return null

  return {
    id: `${pilotName}||${raw.track ?? ''}||${raw.trackLayout ?? ''}`,
    driver: pilotName,
    car: raw.car ?? '',
    carClass: raw.event ?? '',
    track: raw.track ?? '',
    trackLayout: raw.trackLayout ?? '',
    layout: raw.simNum != null ? `SIM ${raw.simNum}` : '',
    time: lapTimeMs / 1000, // convert ms → seconds for formatTime
    date: new Date().toISOString().split('T')[0],
  }
}

export function useLeaderboardWS() {
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState('connecting') // connecting | open | closed | error
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)

  useEffect(() => {
    let destroyed = false

    async function fetchStored() {
      try {
        const res = await fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventName: EVENT_NAME }),
        })
        if (!res.ok || destroyed) return
        const data = await res.json()
        if (!data?.pilots) return

        const stored = Object.values(data.pilots)
          .filter(p => p.pilotName && p.bestLapTime > 0)
          .map(p => ({
            id: `${p.pilotName}||${p.track ?? ''}||${p.trackLayout ?? ''}`,
            driver: p.pilotName,
            car: p.car ?? '',
            carClass: '',
            track: p.track ?? '',
            trackLayout: p.trackLayout ?? '',
            layout: p.simNum != null ? `SIM ${p.simNum}` : '',
            time: p.bestLapTime / 1000,
            date: p.timestamp ? new Date(p.timestamp).toISOString().split('T')[0] : '',
          }))

        // Merge with any WS entries already received rather than overwriting them
        if (!destroyed) {
          setEntries(prev => {
            const map = new Map(stored.map(e => [e.id, e]))
            prev.forEach(e => {
              const s = map.get(e.id)
              if (!s || e.time < s.time) map.set(e.id, e)
            })
            return Array.from(map.values()).sort((a, b) => a.time - b.time)
          })
        }
      } catch {
        // server unreachable or no event yet — ignore
      }
    }

    function connect() {
      if (destroyed) return
      setStatus('connecting')

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (destroyed) { ws.close(); return }
        setStatus('open')
      }

      ws.onmessage = (event) => {
        if (destroyed) return
        try {
          const msg = JSON.parse(event.data)

          // Ignore server control messages
          if (msg.type === 'connected' || msg.type === 'stats' || msg.type === 'error') return

          // Support wrapped {type, data} or raw RawSimulatorData
          const raw = (msg.type === 'simulator-update' && msg.data) ? msg.data : msg

          const entry = parseRaw(raw)
          if (!entry) return

          setEntries(prev => {
            const map = new Map(prev.map(e => [e.id, e]))
            const existing = map.get(entry.id)
            // Only replace if new time is strictly better (lower)
            if (!existing || entry.time < existing.time) {
              map.set(entry.id, entry)
            }
            return Array.from(map.values()).sort((a, b) => a.time - b.time)
          })
        } catch {
          // ignore non-JSON or malformed messages
        }
      }

      ws.onerror = () => {
        if (destroyed) return
        setStatus('error')
      }

      ws.onclose = () => {
        if (destroyed) return
        setStatus('closed')
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    fetchStored()
    connect()

    return () => {
      destroyed = true
      clearTimeout(reconnectTimer.current)
      const ws = wsRef.current
      if (ws) {
        wsRef.current = null
        // Only close if already OPEN; if still CONNECTING, destroyed=true makes
        // onopen call ws.close() safely once the handshake completes.
        if (ws.readyState === WebSocket.OPEN) ws.close()
      }
    }
  }, [])

  return { entries, status }
}
