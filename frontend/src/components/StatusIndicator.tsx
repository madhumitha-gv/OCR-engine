import { useEffect, useState, useRef } from 'react'
import { checkHealth, type HealthResult } from '../api'

type DotStatus = 'checking' | 'ok' | 'mock' | 'unreachable' | 'degraded'

function statusColor(s: DotStatus): string {
  if (s === 'ok') return 'bg-success'
  if (s === 'mock') return 'bg-accent'
  if (s === 'checking') return 'bg-warning'
  if (s === 'degraded') return 'bg-warning'
  return 'bg-error'
}

function statusText(s: DotStatus): string {
  if (s === 'ok') return 'Online'
  if (s === 'mock') return 'Mock mode'
  if (s === 'checking') return 'Checking…'
  if (s === 'degraded') return 'Degraded'
  return 'Unreachable'
}

interface Dot {
  label: string
  status: DotStatus
}

export default function StatusIndicator() {
  const [dots, setDots] = useState<Dot[]>([
    { label: 'OCR',    status: 'checking' },
    { label: 'Huffman', status: 'checking' },
  ])
  const [allMock, setAllMock] = useState(false)
  const [tooltip, setTooltip] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function applyHealth(h: HealthResult) {
    const ocr     = h.stage1_ocr     as DotStatus
    const huffman = h.stage2_huffman as DotStatus
    setDots([
      { label: 'OCR',     status: ocr },
      { label: 'Huffman', status: huffman },
    ])
    setAllMock(ocr === 'mock' && huffman === 'mock')
  }

  async function poll() {
    try {
      const h = await checkHealth()
      applyHealth(h)
    } catch {
      setDots([
        { label: 'OCR',     status: 'unreachable' },
        { label: 'Huffman', status: 'unreachable' },
      ])
      setAllMock(false)
    }
  }

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 10_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (allMock) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide bg-accent/20 text-accent border border-accent/30">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        MOCK
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {dots.map((d, i) => (
        <div
          key={d.label}
          className="relative flex items-center gap-1.5 cursor-default"
          onMouseEnter={() => setTooltip(i)}
          onMouseLeave={() => setTooltip(null)}
        >
          <span className={`w-2 h-2 rounded-full ${statusColor(d.status)} ${d.status === 'ok' ? 'animate-pulse' : ''}`} />
          <span className="text-[11px] font-medium text-text-secondary">{d.label}</span>
          {tooltip === i && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md text-[11px] bg-bg-elevated border border-border-dim text-text-primary whitespace-nowrap shadow-card z-50">
              {d.label}: {statusText(d.status)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
