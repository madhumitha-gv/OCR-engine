import { useState, useCallback, useEffect } from 'react'
import type { PipelineResult } from '../api'
import { decompressOutput } from '../api'

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-16 px-8">
      {/* Neural network SVG illustration */}
      <svg width="180" height="140" viewBox="0 0 180 140" fill="none" aria-hidden>
        {/* Layer 1 nodes */}
        {[25, 55, 85, 115].map((y, i) => (
          <circle
            key={`l1-${i}`}
            cx="30" cy={y} r="10"
            fill="rgba(99,102,241,0.12)"
            stroke="#7c80b0"
            strokeWidth="1.5"
            style={{ animation: `pulse 3s ease-in-out ${i * 0.3}s infinite` }}
          />
        ))}
        {/* Layer 2 nodes */}
        {[40, 70, 100].map((y, i) => (
          <circle
            key={`l2-${i}`}
            cx="90" cy={y} r="10"
            fill="rgba(129,140,248,0.12)"
            stroke="#9094c4"
            strokeWidth="1.5"
            style={{ animation: `pulse 3s ease-in-out ${0.2 + i * 0.3}s infinite` }}
          />
        ))}
        {/* Layer 3 nodes */}
        {[55, 85].map((y, i) => (
          <circle
            key={`l3-${i}`}
            cx="150" cy={y} r="10"
            fill="rgba(165,180,252,0.12)"
            stroke="#a4a8d8"
            strokeWidth="1.5"
            style={{ animation: `pulse 3s ease-in-out ${0.4 + i * 0.3}s infinite` }}
          />
        ))}
        {/* Connections L1→L2 */}
        {[25, 55, 85, 115].flatMap((y1) =>
          [40, 70, 100].map((y2) => (
            <line
              key={`${y1}-${y2}`}
              x1="40" y1={y1} x2="80" y2={y2}
              stroke="#7c80b0" strokeWidth="0.75" strokeOpacity="0.25"
            />
          ))
        )}
        {/* Connections L2→L3 */}
        {[40, 70, 100].flatMap((y1) =>
          [55, 85].map((y2) => (
            <line
              key={`${y1}-${y2}-r`}
              x1="100" y1={y1} x2="140" y2={y2}
              stroke="#9094c4" strokeWidth="0.75" strokeOpacity="0.25"
            />
          ))
        )}
      </svg>

      <div className="text-center">
        <h2 className="text-[18px] font-semibold text-text-secondary mb-2 tracking-tight">
          Ready to process
        </h2>
        <p className="text-[14px] text-text-muted max-w-[260px] leading-relaxed">
          Upload an image and select a noise profile to begin the pipeline
        </p>
      </div>
    </div>
  )
}

// ── Loading stepper ───────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { label: 'Uploading image',    sublabel: 'Sending image to orchestrator…',     durationMs: 800  },
  { label: 'Denoising (CNN)',    sublabel: 'U-Net inference removing noise…',     durationMs: 5000 },
  { label: 'Running OCR',        sublabel: 'OCR reading denoised image…',          durationMs: 8000 },
  { label: 'Compressing output', sublabel: 'Adaptive Huffman FGK encoding…',      durationMs: 1000 },
]

export function LoadingState() {
  const [activeStep, setActiveStep] = useState(0)
  const [doneSteps,  setDoneSteps]  = useState<number[]>([])

  useEffect(() => {
    let step = 0
    function advance() {
      if (step >= PIPELINE_STEPS.length - 1) return
      const delay = PIPELINE_STEPS[step].durationMs
      const timer = setTimeout(() => {
        setDoneSteps((prev) => [...prev, step])
        step += 1
        setActiveStep(step)
        advance()
      }, delay)
      return timer
    }
    const t = advance()
    return () => { if (t) clearTimeout(t) }
  }, [])

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-8 py-16 px-8"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 70%)',
      }}
    >
      <div className="w-full max-w-xs flex flex-col gap-0">
        {PIPELINE_STEPS.map((step, i) => {
          const done    = doneSteps.includes(i)
          const active  = i === activeStep
          const pending = i > activeStep

          return (
            <div key={i}>
              <div
                className="flex items-start gap-3"
                style={{ animation: `fadeUp 0.4s ease-out ${i * 0.15}s both` }}
              >
                {/* Icon */}
                <div className="mt-0.5 w-5 h-5 flex-shrink-0">
                  {done ? (
                    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" style={{ color: '#22c55e' }}>
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" fill="currentColor" fillOpacity="0.1" />
                      <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : active ? (
                    <svg className="animate-spin w-5 h-5 text-accent" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                      <path d="M10 2a8 8 0 018 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-text-muted opacity-30">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 pb-3">
                  <p className={`text-[14px] font-medium ${done ? 'text-text-muted line-through' : active ? 'text-text-primary' : 'text-text-muted opacity-40'}`}>
                    {step.label}
                  </p>
                  {active && (
                    <p className="text-[12px] text-text-muted mt-0.5" style={{ animation: 'fadeUp 0.3s ease-out both' }}>
                      {step.sublabel}
                    </p>
                  )}
                  {done && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#22c55e', opacity: 0.7 }}>Complete</p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="ml-[9px] w-px h-3 mb-0" style={{ backgroundColor: done ? '#22c55e44' : '#ffffff10' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Noise badge map ───────────────────────────────────────────────────────────

const NOISE_META: Record<string, { label: string; cls: string }> = {
  gaussian:        { label: 'Gaussian',        cls: 'bg-bg-elevated text-text-secondary border-border-dim' },
  salt_and_pepper: { label: 'Salt & Pepper',   cls: 'bg-bg-elevated text-text-secondary border-border-dim' },
  both:            { label: 'All noise types', cls: 'bg-bg-elevated text-text-secondary border-border-dim' },
  crumpled:        { label: 'Crumpled',        cls: 'bg-bg-elevated text-text-secondary border-border-dim' },
  stained:         { label: 'Stained',         cls: 'bg-bg-elevated text-text-secondary border-border-dim' },
  none:            { label: 'No noise',        cls: 'bg-bg-elevated text-text-muted border-border-dim' },
}

// ── Results state ─────────────────────────────────────────────────────────────

interface Props {
  result: PipelineResult
  originalImageUrl?: string | null
}

export function ResultsState({ result, originalImageUrl }: Props) {
  const [recovered, setRecovered] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const [copied,      setCopied]      = useState(false)
  const [compareView, setCompareView] = useState(false)

  const conf = result.confidence
  const confClass = conf > 0.8 ? 'bg-success/10 text-success border-success/20'
    : conf >= 0.6 ? 'bg-warning/10 text-warning border-warning/20'
    : 'bg-error/10 text-error border-error/20'

  const noiseMeta = NOISE_META[result.noise_profile_detected] ?? NOISE_META['none']

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result.ocr_text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [result.ocr_text])

  const handleDownloadDenoised = useCallback(() => {
    if (!result.denoised_image) return
    const a = document.createElement('a')
    a.href = `data:image/png;base64,${result.denoised_image}`
    a.download = `denoised_${result.run_id ?? 'output'}.png`
    a.click()
  }, [result.denoised_image, result.run_id])

  const handleExportReport = useCallback(() => {
    const lines = [
      '╔══════════════════════════════════════╗',
      '║        CodeNova Pipeline Report       ║',
      '╚══════════════════════════════════════╝',
      '',
      `Run ID            : ${result.run_id ?? 'N/A'}`,
      `Timestamp         : ${new Date().toISOString()}`,
      '',
      '── OCR Results ──────────────────────────',
      `Extracted Text    : ${result.ocr_text}`,
      `Confidence        : ${(result.confidence * 100).toFixed(1)}%`,
      `Noise Detected    : ${result.noise_profile_detected}`,
      '',
      '── Compression ──────────────────────────',
      `Original Size     : ${result.original_size_bits} bits`,
      `Compressed Size   : ${result.compressed_size_bits} bits`,
      `Compression Ratio : ${result.compression_ratio.toFixed(2)}×`,
      `Entropy           : ${result.entropy.toFixed(2)} bits/char`,
      `Encoding Efficiency: ${(result.encoding_efficiency * 100).toFixed(1)}%`,
      `Num Symbols       : ${result.num_symbols}`,
      '',
      '── Performance ──────────────────────────',
      `Pipeline Latency  : ${result.pipeline_latency_ms.toFixed(0)} ms`,
      '',
      '── Algorithm ────────────────────────────',
      'Denoiser          : U-Net DenoisingCNN',
      'OCR Model         : Transformer-based OCR',
      'Compression       : Adaptive Huffman (FGK)',
      '',
      '════════════════════════════════════════',
      'Generated by CodeNova · IU Hackathon 2026',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `codenova_report_${result.run_id ?? Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [result])

  async function handleVerify() {
    setVerifying(true)
    setVerifyError(null)
    try {
      const res = await decompressOutput(result.compressed_bytes, result.num_symbols)
      setRecovered(res.recovered_text)
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const match = recovered !== null && recovered === result.ocr_text

  return (
    <div
      className="flex flex-col gap-4 p-1"
      style={{ animation: 'fadeUp 0.4s ease-out both' }}
    >
      {/* ── Extracted text card ───────────────────────────────── */}
      <div className="p-6 bg-bg-surface border border-border-dim rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <p className="label">Extracted Text</p>
          <button
            onClick={handleCopy}
            title="Copy text"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
              text-text-muted hover:text-text-primary border border-transparent hover:border-border-dim
              hover:bg-bg-elevated transition-all duration-150"
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-success">
                  <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ color: '#22c55e' }}>Copied!</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="4" y="1" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M1 4h1.5a1 1 0 011 1v5a1 1 0 001 1h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <p className="font-mono text-[28px] font-semibold text-text-primary tracking-[0.08em] text-center py-2">
          {result.ocr_text}
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          {/* Confidence badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${confClass}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
              <path d="M3 5l1.5 1.5L7 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {(conf * 100).toFixed(1)}% confidence
          </span>

          {/* Noise badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${noiseMeta.cls}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5c1-2 1.5-2 2 0s1 2 2 0 1.5-2 2 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {noiseMeta.label}
          </span>
        </div>
      </div>

      {/* ── Denoised image card ──────────────────────────────── */}
      {result.denoised_image && (
        <div className="p-5 bg-bg-surface border border-border-dim rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="label">Denoised Image</p>
              <p className="text-[11px] text-text-muted mt-0.5">CNN output — what the OCR model actually reads</p>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Compare toggle */}
              {originalImageUrl && (
                <button
                  onClick={() => setCompareView((v) => !v)}
                  title="Toggle comparison view"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
                    border transition-all duration-150
                    ${compareView
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-dim hover:bg-bg-elevated'
                    }`}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <rect x="1" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
                    <rect x="7" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
                  </svg>
                  Compare
                </button>
              )}
              <button
                onClick={handleDownloadDenoised}
                title="Download denoised image"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
                  text-text-muted hover:text-text-primary border border-transparent hover:border-border-dim
                  hover:bg-bg-elevated transition-all duration-150"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download
              </button>
            </div>
          </div>

          {compareView && originalImageUrl ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-text-muted text-center mb-1.5">Original</p>
                <img
                  src={originalImageUrl}
                  alt="Original"
                  className="w-full rounded-lg border border-border-dim bg-bg-elevated object-contain max-h-48"
                />
              </div>
              <div>
                <p className="text-[10px] text-text-muted text-center mb-1.5">Denoised</p>
                <img
                  src={`data:image/png;base64,${result.denoised_image}`}
                  alt="Denoised"
                  className="w-full rounded-lg border border-accent/30 bg-bg-elevated object-contain max-h-48"
                />
              </div>
            </div>
          ) : (
            <img
              src={`data:image/png;base64,${result.denoised_image}`}
              alt="Denoised"
              className="w-full rounded-lg border border-border-dim bg-bg-elevated object-contain"
            />
          )}
        </div>
      )}

      {/* ── Decompression verification card ──────────────────── */}
      <div className="p-5 bg-bg-surface border border-border-dim rounded-xl">
        <p className="label mb-4">Decompression Verification</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Original */}
          <div className="p-3 bg-bg-elevated rounded-lg">
            <p className="text-[11px] text-text-muted mb-2">Original OCR Output</p>
            <p className="font-mono text-[22px] font-medium text-text-primary tracking-[0.08em]">
              {result.ocr_text}
            </p>
          </div>
          {/* Recovered */}
          <div className="p-3 bg-bg-elevated rounded-lg">
            <p className="text-[11px] text-text-muted mb-2">Recovered Text</p>
            {recovered ? (
              <p className={`font-mono text-[22px] font-medium tracking-[0.08em] ${match ? 'text-success' : 'text-error'}`}>
                {recovered}
              </p>
            ) : (
              <p className="text-[13px] text-text-muted italic mt-1">
                Click verify to test
              </p>
            )}
          </div>
        </div>

        {/* Verify button */}
        {!recovered && (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="w-full py-2.5 rounded-lg border border-accent text-accent text-[13px] font-medium
              hover:bg-accent/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {verifying ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                  <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Verifying…
              </>
            ) : (
              'Verify Lossless Recovery'
            )}
          </button>
        )}

        {/* Result banner */}
        {recovered && match && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 mt-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-success flex-shrink-0">
              <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[13px] font-medium text-success">Lossless recovery confirmed</span>
          </div>
        )}
        {recovered && !match && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-error/10 border border-error/20 mt-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-error flex-shrink-0">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="text-[13px] font-medium text-error">
              Mismatch — expected "{result.ocr_text}", got "{recovered}"
            </span>
          </div>
        )}
        {verifyError && (
          <p className="text-[12px] text-error mt-2">{verifyError}</p>
        )}
      </div>

      {/* ── Export report ─────────────────────────────────── */}
      <button
        onClick={handleExportReport}
        className="w-full py-2.5 rounded-lg text-[13px] font-medium text-text-secondary
          border border-border-dim hover:border-border-bright hover:text-text-primary
          hover:bg-bg-elevated transition-all duration-200
          flex items-center justify-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 11h10M7 1v7M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Export Report
      </button>
    </div>
  )
}
