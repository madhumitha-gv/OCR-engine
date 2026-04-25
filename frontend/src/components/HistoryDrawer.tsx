import { useEffect, useState } from 'react'
import { getRunHistory, deleteRun, type RunSummary, type PipelineResult } from '../api'
import { useAuth } from '../context/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
  onLoadRun: (result: PipelineResult) => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)   return 'just now'
  if (min < 60)  return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

const NOISE_LABEL: Record<string, string> = {
  none:            'None',
  gaussian:        'Gaussian',
  salt_and_pepper: 'Salt & Pepper',
  both:            'All',
  crumpled:        'Crumpled',
  stained:         'Stained',
}

function confColor(c: number | null): string {
  if (c === null) return 'text-text-muted'
  if (c > 0.9) return 'text-success'
  if (c >= 0.7) return 'text-warning'
  return 'text-error'
}

export default function HistoryDrawer({ open, onClose, onLoadRun }: Props) {
  const { token } = useAuth()
  const [runs,    setRuns]    = useState<RunSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !token) return
    setLoading(true)
    getRunHistory(token)
      .then(setRuns)
      .catch(() => {/* silent */})
      .finally(() => setLoading(false))
  }, [open, token])

  async function handleDelete(e: React.MouseEvent, runId: number) {
    e.stopPropagation()
    if (!token) return
    setDeleting(runId)
    try {
      await deleteRun(token, runId)
      setRuns((prev) => prev.filter((r) => r.id !== runId))
    } catch { /* silent */ }
    finally { setDeleting(null) }
  }

  function handleLoad(run: RunSummary) {
    if (!run.ocr_text) return
    onLoadRun({
      run_id:                  run.id,
      ocr_text:                run.ocr_text,
      confidence:              run.confidence ?? 0,
      noise_profile_detected:  run.noise_profile,
      compressed_bytes:        '',
      original_size_bits:      0,
      compressed_size_bits:    0,
      compression_ratio:       run.compression_ratio ?? 0,
      entropy:                 0,
      encoding_efficiency:     0,
      num_symbols:             run.ocr_text ? run.ocr_text.length : 0,
      pipeline_latency_ms:     run.pipeline_latency_ms ?? 0,
    })
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[360px] bg-bg-surface border-l border-border-dim
          z-50 flex flex-col transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-dim">
          <p className="text-[14px] font-semibold text-text-primary">Run History</p>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted
              hover:text-text-primary hover:bg-bg-elevated transition-all duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex flex-col gap-2 mt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-bg-elevated rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!loading && runs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-text-muted">
                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
                <path d="M20 12v8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-[13px] text-text-muted">No runs yet</p>
            </div>
          )}

          {!loading && runs.map((run) => (
            <button
              key={run.id}
              onClick={() => handleLoad(run)}
              className="w-full text-left p-3.5 mb-2 rounded-xl border border-border-dim bg-bg-base
                hover:border-border-bright hover:bg-bg-elevated transition-all duration-150 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* OCR text */}
                  <p className="font-mono text-[20px] font-medium text-accent tracking-[0.08em] leading-none mb-2">
                    {run.ocr_text ?? '—'}
                  </p>

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-elevated border border-border-dim text-text-muted">
                      {NOISE_LABEL[run.noise_profile] ?? run.noise_profile}
                    </span>
                    {run.compression_ratio !== null && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent border border-accent/20">
                        {run.compression_ratio.toFixed(2)}× ratio
                      </span>
                    )}
                    {run.confidence !== null && (
                      <span className={`text-[10px] font-medium ${confColor(run.confidence)}`}>
                        {(run.confidence * 100).toFixed(0)}% conf
                      </span>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[11px] text-text-muted">
                    {run.image_filename && (
                      <span className="truncate max-w-[120px]">{run.image_filename}</span>
                    )}
                    <span>{timeAgo(run.created_at)}</span>
                    {run.pipeline_latency_ms !== null && (
                      <span>{run.pipeline_latency_ms.toFixed(0)}ms</span>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, run.id)}
                  disabled={deleting === run.id}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 rounded-md
                    flex items-center justify-center text-text-muted hover:text-error
                    hover:bg-error/10 transition-all duration-150 disabled:opacity-50"
                >
                  {deleting === run.id ? (
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
                      <path d="M6 2a4 4 0 014 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 3h8M5 3V2h2v1M4 3v6.5a.5.5 0 00.5.5h3a.5.5 0 00.5-.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
