import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Header from './components/Header'
import AuthPage from './components/AuthPage'
import ImageUploader from './components/ImageUploader'
import NoiseSelector from './components/NoiseSelector'
import MetricsGrid from './components/MetricsGrid'
import CompressionVisualizer from './components/CompressionVisualizer'
import HistoryDrawer from './components/HistoryDrawer'
import { EmptyState, LoadingState, ResultsState } from './components/ResultsPanel'
import PipelineDiagram from './components/PipelineDiagram'
import { runPipeline, type PipelineResult, type NoiseProfile } from './api'

type AppState = 'idle' | 'loading' | 'done' | 'error'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary mb-3">
      {children}
    </p>
  )
}

export default function App() {
  const { token, user } = useAuth()

  const [file,          setFile]          = useState<File | null>(null)
  const [noise,         setNoise]         = useState<NoiseProfile>('none')
  const [state,         setState]         = useState<AppState>('idle')
  const [result,        setResult]        = useState<PipelineResult | null>(null)
  const [errMsg,        setErrMsg]        = useState<string | null>(null)
  const [historyOpen,   setHistoryOpen]   = useState(false)
  const [origImgUrl,    setOrigImgUrl]    = useState<string | null>(null)

  // Not logged in — show auth page
  if (!token || !user) return <AuthPage />

  async function handleRun() {
    if (!file || !token) return
    setState('loading')
    setResult(null)
    setErrMsg(null)
    setOrigImgUrl(URL.createObjectURL(file))
    try {
      const res = await runPipeline({ image: file, noiseProfile: noise, token })
      setResult(res)
      setState('done')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Unknown error')
      setState('error')
    }
  }

  const canRun = !!file && state !== 'loading'

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Header onOpenHistory={() => setHistoryOpen(true)} />

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onLoadRun={(r) => { setResult(r); setState('done') }}
      />

      <div className="pt-14 min-h-screen">
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-56px)]">

          {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
          <aside className="flex-none lg:w-[280px] border-b lg:border-b-0 lg:border-r border-border-dim p-6 flex flex-col gap-6 overflow-y-auto">

            <div>
              <SectionLabel>Input Image</SectionLabel>
              <ImageUploader file={file} onChange={setFile} />
            </div>

            <div className="h-px bg-border-dim" />

            <div>
              <SectionLabel>Noise Profile</SectionLabel>
              <NoiseSelector
                value={noise}
                onChange={(v) => setNoise(v as NoiseProfile)}
              />
            </div>

            <div className="h-px bg-border-dim" />

            <div>
              <button
                onClick={handleRun}
                disabled={!canRun}
                className={`relative w-full h-12 rounded-lg font-semibold text-[14px] text-white
                  flex items-center justify-center gap-2.5 overflow-hidden
                  transition-all duration-200
                  ${canRun
                    ? 'cursor-pointer hover:brightness-110 hover:shadow-glow active:scale-[0.98]'
                    : 'opacity-40 cursor-not-allowed'
                  }`}
                style={{ background: 'linear-gradient(135deg, #5a5e8a, #464a78)' }}
              >
                {state === 'loading' ? (
                  <>
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite',
                      }}
                    />
                    <svg className="animate-spin w-4 h-4 relative z-10" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
                      <path d="M8 2a6 6 0 016 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="relative z-10">Processing…</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 2l10 5-10 5V2z" fill="white" />
                    </svg>
                    Run Pipeline
                  </>
                )}
              </button>

              {state === 'error' && errMsg && (
                <p className="mt-3 text-[12px] text-error leading-relaxed">{errMsg}</p>
              )}
            </div>
          </aside>

          {/* ── CENTER PANEL ─────────────────────────────────────── */}
          <main className="flex-1 border-b lg:border-b-0 lg:border-r border-border-dim overflow-y-auto min-h-[400px]">
            {state === 'idle' || (state === 'error' && !result) ? (
              <EmptyState />
            ) : state === 'loading' ? (
              <LoadingState />
            ) : result ? (
              <div className="p-6">
                <ResultsState result={result} originalImageUrl={origImgUrl} />
              </div>
            ) : null}
          </main>

          {/* ── RIGHT PANEL ──────────────────────────────────────── */}
          <aside className="flex-none lg:w-[320px] p-6 overflow-y-auto flex flex-col gap-6">
            {result ? (
              <>
                <div>
                  <SectionLabel>Pipeline Metrics</SectionLabel>
                  <MetricsGrid result={result} />
                </div>
                <CompressionVisualizer result={result} />
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <PipelineDiagram />
                <div className="flex flex-col gap-3 opacity-30 pointer-events-none">
                  <SectionLabel>Pipeline Metrics</SectionLabel>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-bg-surface border border-border-dim rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
